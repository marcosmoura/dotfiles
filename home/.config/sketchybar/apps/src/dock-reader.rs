use objc2::msg_send;
use objc2::rc::Retained;
use objc2_app_kit::{NSRunningApplication, NSWorkspace};
use objc2_foundation::{NSArray, NSString};
use serde_json::{Value, json};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

#[derive(Debug, Clone)]
pub struct DockApp {
    pub name: String,
    pub bundle_identifier: String,
    pub icon_path: Option<String>,
    pub is_running: bool,
    pub process_id: Option<i32>,
    pub is_frontmost: bool,
    pub dock_position: Option<usize>,
}

impl DockApp {
    #[must_use]
    pub fn to_json(&self) -> Value {
        json!({
            "name": self.name,
            "bundle_identifier": self.bundle_identifier,
            "icon_path": self.icon_path,
            "is_running": self.is_running,
            "process_id": self.process_id,
            "is_frontmost": self.is_frontmost
        })
    }
}

pub struct DockReader {
    workspace: Retained<NSWorkspace>,
    // Finder bundle identifier constant
    finder_bundle_id: &'static str,
    // Cache for commonly used icon extensions
    common_extensions: [&'static str; 3],
    // Cache for commonly used icon filenames
    common_icon_names: [&'static str; 3],
}

// Global icon cache using thread-safe static
static ICON_CACHE: OnceLock<std::sync::Mutex<HashMap<String, Option<String>>>> = OnceLock::new();

impl Default for DockReader {
    fn default() -> Self {
        Self::new()
    }
}

impl DockReader {
    #[must_use]
    pub fn new() -> Self {
        let workspace = unsafe { NSWorkspace::sharedWorkspace() };

        // Initialize the icon cache if not already done
        ICON_CACHE.get_or_init(|| std::sync::Mutex::new(HashMap::new()));

        Self {
            workspace,
            common_extensions: ["icns", "png", "ico"],
            common_icon_names: ["app.icns", "icon.icns", "AppIcon.icns"],
            finder_bundle_id: "com.apple.finder",
        }
    }

    /// Get all running applications from `NSWorkspace`
    ///
    /// # Errors
    /// Returns an error if unable to access running applications or convert bundle identifiers
    pub fn get_running_apps(&self) -> Result<Vec<DockApp>, Box<dyn std::error::Error>> {
        unsafe {
            let running_apps: Retained<NSArray<NSRunningApplication>> =
                msg_send![&self.workspace, runningApplications];

            // Pre-allocate with estimated capacity
            let count = running_apps.count();
            let mut apps = Vec::with_capacity(count);

            let frontmost_app: Option<Retained<NSRunningApplication>> =
                msg_send![&self.workspace, frontmostApplication];

            let frontmost_bundle = frontmost_app
                .as_ref()
                .and_then(|app| Self::get_bundle_identifier(app))
                .unwrap_or_default();

            for i in 0..count {
                let app = running_apps.objectAtIndex(i);
                if let Some(dock_app) = self.process_running_app(&app, &frontmost_bundle) {
                    apps.push(dock_app);
                }
            }

            Ok(apps)
        }
    }

    /// Get dock persistent applications from dock plist
    ///
    /// # Errors
    /// Returns an error if unable to read the dock plist or parse bundle identifiers
    pub fn get_dock_persistent_apps(&self) -> Result<Vec<DockApp>, Box<dyn std::error::Error>> {
        // Read dock preferences using defaults command
        let output = std::process::Command::new("defaults")
            .args(["read", "com.apple.dock", "persistent-apps"])
            .output()?;

        if !output.status.success() {
            return Err("Failed to read dock preferences".into());
        }

        let plist_content = String::from_utf8(output.stdout)?;

        // Count approximate number of apps by counting bundle-identifier occurrences
        let app_count_estimate = plist_content.matches("bundle-identifier").count();
        let mut apps = Vec::with_capacity(app_count_estimate);

        // Parse plist format (simplified parsing) and track order
        let mut position = 0;

        // Using a single pass through the content
        let bundle_id_marker = "bundle-identifier";
        for line in plist_content.lines() {
            if line.contains(bundle_id_marker)
                && let Some(bundle_id) = Self::extract_bundle_identifier(line)
            {
                let mut dock_app = self.create_dock_app_from_bundle(&bundle_id);
                dock_app.dock_position = Some(position);
                apps.push(dock_app);
                position += 1;
            }
        }

        Ok(apps)
    }

    /// Get all dock apps (both running and persistent)
    ///
    /// # Errors
    /// Returns an error if unable to read running or persistent applications
    pub fn get_all_dock_apps(&self) -> Result<Vec<DockApp>, Box<dyn std::error::Error>> {
        // Get running apps first
        let running_apps = self.get_running_apps()?;
        let mut all_apps = HashMap::with_capacity(running_apps.len() * 2);

        // Insert running apps
        for app in running_apps {
            all_apps.insert(app.bundle_identifier.clone(), app);
        }

        // Get persistent apps and merge
        let persistent_apps = self.get_dock_persistent_apps()?;
        for mut app in persistent_apps {
            if let Some(existing) = all_apps.get(&app.bundle_identifier) {
                // Update persistent app with running state
                app.is_running = existing.is_running;
                app.process_id = existing.process_id;
                app.is_frontmost = existing.is_frontmost;
                // If persistent app doesn't have icon_path but running app does, use the running app's path
                if app.icon_path.is_none() && existing.icon_path.is_some() {
                    app.icon_path.clone_from(&existing.icon_path);
                }
            }
            all_apps.insert(app.bundle_identifier.clone(), app);
        }

        // Pre-allocate result vector with known size
        let mut result = Vec::with_capacity(all_apps.len());
        result.extend(all_apps.into_values());

        // Sort by dock position first (None values go to the end), then by bundle identifier
        // But always put Finder first
        let finder_id = self.finder_bundle_id;
        result.sort_unstable_by(|a, b| {
            // Finder always comes first (using cached constant)
            if a.bundle_identifier == finder_id {
                return std::cmp::Ordering::Less;
            }
            if b.bundle_identifier == finder_id {
                return std::cmp::Ordering::Greater;
            }

            // For non-Finder apps, sort by dock position
            match (a.dock_position, b.dock_position) {
                (Some(pos_a), Some(pos_b)) => pos_a.cmp(&pos_b),
                (Some(_), None) => std::cmp::Ordering::Less,
                (None, Some(_)) => std::cmp::Ordering::Greater,
                (None, None) => a.bundle_identifier.cmp(&b.bundle_identifier),
            }
        });

        Ok(result)
    }

    fn process_running_app(
        &self,
        app: &NSRunningApplication,
        frontmost_bundle: &str,
    ) -> Option<DockApp> {
        unsafe {
            // Check if app has regular activation policy (excludes background processes)
            let activation_policy: isize = msg_send![app, activationPolicy];
            if activation_policy != 0 {
                // NSApplicationActivationPolicyRegular = 0
                return None;
            }

            let bundle_identifier = Self::get_bundle_identifier(app)?;
            let localized_name = Self::get_localized_name(app)?;
            let process_id: i32 = msg_send![app, processIdentifier];
            let is_frontmost = bundle_identifier == frontmost_bundle;

            // Use cached icon path if available
            let icon_path = {
                let cache = ICON_CACHE.get().unwrap();

                // We need to use #[allow(clippy::option_if_let_else)] here because
                // the alternative with map_or_else causes borrow checker issues
                #[allow(clippy::option_if_let_else)]
                cache.try_lock().map_or_else(
                    |_| self.get_app_path_from_bundle(&bundle_identifier),
                    |mut cache_lock| {
                        if let Some(cached_path) = cache_lock.get(&bundle_identifier) {
                            cached_path.clone()
                        } else {
                            let path = self.get_app_path_from_bundle(&bundle_identifier);
                            cache_lock.insert(bundle_identifier.clone(), path.clone());
                            path
                        }
                    },
                )
            };

            Some(DockApp {
                name: localized_name,
                bundle_identifier,
                icon_path,
                is_running: true,
                process_id: Some(process_id),
                is_frontmost,
                dock_position: None, // Will be set when merging with persistent apps
            })
        }
    }

    fn get_bundle_identifier(app: &NSRunningApplication) -> Option<String> {
        unsafe {
            let bundle_id: Option<Retained<NSString>> = msg_send![app, bundleIdentifier];
            bundle_id.map(|id| id.to_string())
        }
    }

    fn get_localized_name(app: &NSRunningApplication) -> Option<String> {
        unsafe {
            let name: Option<Retained<NSString>> = msg_send![app, localizedName];
            name.map(|n| n.to_string())
        }
    }

    fn get_app_path_from_bundle(&self, bundle_identifier: &str) -> Option<String> {
        // First check if we have this path cached globally
        if let Some(cache) = ICON_CACHE.get()
            && let Ok(cache_lock) = cache.try_lock()
            && let Some(cached_path) = cache_lock.get(bundle_identifier)
        {
            return cached_path.clone();
        }

        unsafe {
            let bundle_id_nsstring = NSString::from_str(bundle_identifier);
            let app_path: Option<Retained<NSString>> = msg_send![&self.workspace, absolutePathForAppBundleWithIdentifier: &*bundle_id_nsstring];

            if let Some(app_path) = app_path {
                let app_path_str = app_path.to_string();

                // Try to find the icon file in the app bundle
                if let Some(icon_path) = self.find_icon_in_bundle(&app_path_str) {
                    return Some(icon_path);
                }

                // Fallback to app bundle path if icon not found
                Some(app_path_str)
            } else {
                None
            }
        }
    }

    fn find_icon_in_bundle(&self, app_bundle_path: &str) -> Option<String> {
        use std::fs;

        // Create a static set of common icon paths to check
        static ICON_PATHS_CHECKED: OnceLock<HashSet<PathBuf>> = OnceLock::new();
        // Use underscore prefix to avoid the unused variable warning
        let _icon_paths_checked = ICON_PATHS_CHECKED.get_or_init(HashSet::new);

        // Use Path for efficient path operations
        let bundle_path = Path::new(app_bundle_path);
        let info_plist_path = bundle_path.join("Contents/Info.plist");
        let resources_path = bundle_path.join("Contents/Resources");

        // Early return if this resources path doesn't exist
        if !resources_path.exists() {
            return None;
        }

        // Try to read the Info.plist to get the icon file name
        if info_plist_path.exists()
            && let Ok(plist_content) = fs::read_to_string(&info_plist_path)
        {
            // Look for CFBundleIconFile in the plist
            if let Some(icon_name) = Self::extract_icon_name_from_plist(&plist_content) {
                // Try different extensions using cached common extensions
                for &ext in &self.common_extensions {
                    let icon_file = if icon_name.ends_with(&format!(".{ext}")) {
                        icon_name.clone()
                    } else {
                        format!("{icon_name}.{ext}")
                    };

                    let icon_path = resources_path.join(&icon_file);

                    // Use exists() which is more efficient than metadata() or similar
                    if icon_path.exists() {
                        return Some(icon_path.to_string_lossy().to_string());
                    }
                }
            }
        }

        // Fallback: look for common icon files in Resources using cached names
        for &icon_name in &self.common_icon_names {
            let icon_path = resources_path.join(icon_name);
            if icon_path.exists() {
                return Some(icon_path.to_string_lossy().to_string());
            }
        }

        // Final fallback: look for any .icns file
        // This is potentially expensive, so we try to avoid it when possible
        if let Ok(mut entries) = fs::read_dir(&resources_path) {
            // Find first .icns file
            while let Some(Ok(entry)) = entries.next() {
                let path = entry.path();
                if let Some(ext) = path.extension()
                    && ext == "icns"
                {
                    return Some(path.to_string_lossy().to_string());
                }
            }
        }

        None
    }

    fn extract_icon_name_from_plist(plist_content: &str) -> Option<String> {
        // Define these constants once
        static KEY_TAG: &str = "<key>CFBundleIconFile</key>";
        static STRING_OPEN_TAG: &str = "<string>";
        static STRING_CLOSE_TAG: &str = "</string>";

        // Quick check to avoid unnecessary string scanning
        if !plist_content.contains(KEY_TAG) {
            return None;
        }

        // Find key tag
        let start = plist_content.find(KEY_TAG)?;

        // Find string tag after key tag
        let string_start = plist_content[start..].find(STRING_OPEN_TAG)?;
        let string_content_start = start + string_start + STRING_OPEN_TAG.len();

        // Find end of string tag
        let string_end = plist_content[string_content_start..].find(STRING_CLOSE_TAG)?;

        // Extract the icon name
        let icon_name = &plist_content[string_content_start..string_content_start + string_end];

        // Only allocate if non-empty
        if icon_name.is_empty() {
            None
        } else {
            Some(icon_name.to_string())
        }
    }

    fn extract_bundle_identifier(line: &str) -> Option<String> {
        // Quick check to avoid unnecessary parsing
        if !line.contains("bundle-identifier") {
            return None;
        }

        // Find equals sign
        let equals_pos = line.find('=')?;

        // Find start quote after equals
        let start = line[equals_pos..].find('"')?;
        let content_start = equals_pos + start + 1;

        // Find end quote
        let end = line[content_start..].find('"')?;

        // Extract bundle ID
        let bundle_id = &line[content_start..content_start + end];

        // Validate bundle ID (non-empty and contains a dot)
        if !bundle_id.is_empty() && bundle_id.contains('.') {
            Some(bundle_id.to_string())
        } else {
            None
        }
    }

    fn create_dock_app_from_bundle(&self, bundle_identifier: &str) -> DockApp {
        // Get icon path (using cached value if available)
        let icon_path = self.get_app_path_from_bundle(bundle_identifier);

        // Get app name from bundle identifier (simple approach)
        // Avoid allocating a new string when possible
        let name = match bundle_identifier.rsplit('.').next() {
            Some(last_part) if !last_part.is_empty() => last_part.to_string(),
            _ => bundle_identifier.to_string(),
        };

        DockApp {
            name,
            bundle_identifier: bundle_identifier.to_string(),
            icon_path,
            is_running: false,
            process_id: None,
            is_frontmost: false,
            dock_position: None, // Will be set when parsing
        }
    }

    /// Print all dock apps as JSON
    ///
    /// # Errors
    /// Returns an error if unable to get dock applications or serialize to JSON
    pub fn print_dock_apps_json(&self) -> Result<(), Box<dyn std::error::Error>> {
        let apps = self.get_all_dock_apps()?;

        // Pre-allocate with known capacity
        let mut json_output = Vec::with_capacity(apps.len());

        // Map to JSON values
        for app in &apps {
            json_output.push(app.to_json());
        }

        // Serialize directly to stdout to avoid an extra allocation
        println!("{}", serde_json::to_string_pretty(&json_output)?);
        Ok(())
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Check if --bench flag is provided
    let bench_mode = std::env::args().any(|arg| arg == "--bench");

    let dock_reader = DockReader::new();

    if bench_mode {
        // Run in benchmark mode
        let start = std::time::Instant::now();
        let iterations = 10;

        for _ in 0..iterations {
            let _ = dock_reader.get_all_dock_apps()?;
        }

        let elapsed = start.elapsed();
        eprintln!(
            "Benchmark completed {} iterations in {:.2?} ({:.2?} per iteration)",
            iterations,
            elapsed,
            elapsed / iterations
        );
    }

    // Always print the JSON output
    dock_reader.print_dock_apps_json()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dock_reader_creation() {
        let _dock_reader = DockReader::new();
        // If we get here without panicking, the basic creation works
    }

    #[test]
    fn test_get_running_apps() {
        let dock_reader = DockReader::new();
        let result = dock_reader.get_running_apps();
        assert!(result.is_ok());
        let apps = result.unwrap();
        // Should have at least some running apps (like Finder)
        assert!(!apps.is_empty());
    }
}
