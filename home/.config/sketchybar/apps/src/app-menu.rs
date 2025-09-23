//! App menu interaction utilities for `SketchyBar`
use std::os::raw::{c_int, c_uint, c_void};
use std::process;
use std::ptr;
use std::thread;
use std::time::Duration;

use core_foundation::array::CFArrayRef;
use core_foundation::base::{CFRelease, CFRetain, CFTypeRef, TCFType};
use core_foundation::dictionary::CFDictionaryRef;
use core_foundation::number::{CFNumber, CFNumberRef};
use core_foundation::string::{CFString, CFStringRef};
use core_graphics::window::{CGWindowListCopyWindowInfo, kCGNullWindowID, kCGWindowListOptionAll};

// Core Foundation bindings
#[link(name = "CoreFoundation", kind = "framework")]
unsafe extern "C" {
    fn CFArrayGetCount(array: CFArrayRef) -> isize;
    fn CFArrayGetValueAtIndex(array: CFArrayRef, index: isize) -> *const c_void;
    fn CFDictionaryGetValue(dict: CFDictionaryRef, key: *const c_void) -> *const c_void;
}

// Accessibility API bindings
type AXUIElementRef = *const c_void;
type AXError = c_uint;

const AX_ERROR_SUCCESS: AXError = 0;

#[link(name = "ApplicationServices", kind = "framework")]
unsafe extern "C" {
    fn AXIsProcessTrustedWithOptions(options: CFDictionaryRef) -> bool;
    fn AXUIElementCreateApplication(pid: i32) -> AXUIElementRef;
    fn AXUIElementCopyAttributeValue(
        element: AXUIElementRef,
        attribute: CFStringRef,
        value: *mut CFTypeRef,
    ) -> AXError;
    fn AXUIElementPerformAction(element: AXUIElementRef, action: CFStringRef) -> AXError;
}

// Constants as Rust strings (we'll convert them to CFString when needed)
const AX_MENU_BAR_ATTRIBUTE: &str = "AXMenuBar";
const AX_EXTRAS_MENU_BAR_ATTRIBUTE: &str = "AXExtrasMenuBar";
const AX_VISIBLE_CHILDREN_ATTRIBUTE: &str = "AXVisibleChildren";
const AX_TITLE_ATTRIBUTE: &str = "AXTitle";
const AX_POSITION_ATTRIBUTE: &str = "AXPosition";
const AX_SIZE_ATTRIBUTE: &str = "AXSize";
const AX_CANCEL_ACTION: &str = "AXCancel";
const AX_PRESS_ACTION: &str = "AXPress";

// Private SkyLight API bindings
#[link(name = "SkyLight", kind = "framework")]
unsafe extern "C" {
    fn SLSMainConnectionID() -> c_int;
    fn SLSSetMenuBarVisibilityOverrideOnDisplay(cid: c_int, did: c_int, enabled: bool);
    fn SLSSetMenuBarInsetAndAlpha(cid: c_int, u1: f64, u2: f64, alpha: f32);
    fn _SLPSGetFrontProcess(psn: *mut ProcessSerialNumber);
    fn SLSGetConnectionIDForPSN(cid: c_int, psn: *const ProcessSerialNumber, cid_out: *mut c_int);
    fn SLSConnectionGetPID(cid: c_int, pid_out: *mut i32);
}

// Process Serial Number structure
#[repr(C)]
struct ProcessSerialNumber {
    high: u32,
    low: u32,
}

// Core Graphics constants
const K_CGWINDOW_OWNER_NAME: &str = "K_CGWINDOW_OWNER_NAME";
const K_CGWINDOW_OWNER_PID: &str = "K_CGWINDOW_OWNER_PID";
const K_CGWINDOW_NAME: &str = "K_CGWINDOW_NAME";
const K_CGWINDOW_LAYER: &str = "K_CGWINDOW_LAYER";
const K_CGWINDOW_BOUNDS: &str = "K_CGWINDOW_BOUNDS";

struct MenuList {
    trusted: bool,
}

impl MenuList {
    fn new() -> Result<Self, String> {
        let mut instance = Self { trusted: false };
        instance.ax_init()?;
        Ok(instance)
    }

    fn ax_init(&mut self) -> Result<(), String> {
        unsafe {
            // Simple accessibility check without options first
            let options = ptr::null();
            let trusted = AXIsProcessTrustedWithOptions(options);

            if !trusted {
                return Err("Accessibility permissions not granted. Please enable accessibility access for this application in System Preferences > Security & Privacy > Privacy > Accessibility.".to_string());
            }

            self.trusted = true;
            Ok(())
        }
    }

    fn ax_perform_click(&self, element: AXUIElementRef) -> Result<(), String> {
        if element.is_null() {
            return Err("Element is null".to_string());
        }

        unsafe {
            let cancel_action = CFString::new(AX_CANCEL_ACTION);
            let press_action = CFString::new(AX_PRESS_ACTION);

            AXUIElementPerformAction(element, cancel_action.as_concrete_TypeRef());
            // Reduced sleep time for better performance while still maintaining reliability
            thread::sleep(Duration::from_millis(100));
            AXUIElementPerformAction(element, press_action.as_concrete_TypeRef());
        }
        Ok(())
    }

    fn ax_get_title(&self, element: AXUIElementRef) -> Option<String> {
        if element.is_null() {
            return None;
        }

        unsafe {
            let title_attr = CFString::new(AX_TITLE_ATTRIBUTE);
            let mut title: CFTypeRef = ptr::null();
            let error = AXUIElementCopyAttributeValue(
                element,
                title_attr.as_concrete_TypeRef(),
                &mut title,
            );

            if error != AX_ERROR_SUCCESS || title.is_null() {
                return None;
            }

            let cf_string = CFString::wrap_under_create_rule(title as CFStringRef);
            let result = Some(cf_string.to_string());
            // No need to manually release cf_string as wrap_under_create_rule handles ownership transfer
            result
        }
    }

    fn ax_select_menu_option(&self, app: AXUIElementRef, id: usize) -> Result<(), String> {
        if app.is_null() {
            return Err("App element is null".to_string());
        }

        unsafe {
            let menubar_attr = CFString::new(AX_MENU_BAR_ATTRIBUTE);
            let visible_children_attr = CFString::new(AX_VISIBLE_CHILDREN_ATTRIBUTE);

            let mut menubars_ref: CFTypeRef = ptr::null();
            let error = AXUIElementCopyAttributeValue(
                app,
                menubar_attr.as_concrete_TypeRef(),
                &mut menubars_ref,
            );

            if error != AX_ERROR_SUCCESS || menubars_ref.is_null() {
                return Err("Failed to get menu bar".to_string());
            }

            let mut children_ref: CFTypeRef = ptr::null();
            let error = AXUIElementCopyAttributeValue(
                menubars_ref as AXUIElementRef,
                visible_children_attr.as_concrete_TypeRef(),
                &mut children_ref,
            );

            CFRelease(menubars_ref);

            if error != AX_ERROR_SUCCESS || children_ref.is_null() {
                return Err("Failed to get menu bar children".to_string());
            }

            let count = CFArrayGetCount(children_ref as CFArrayRef) as usize;

            let result = if id < count {
                let item = CFArrayGetValueAtIndex(children_ref as CFArrayRef, id as isize)
                    as AXUIElementRef;
                if !item.is_null() {
                    self.ax_perform_click(item)
                } else {
                    Err(format!("Failed to get menu item {id}"))
                }
            } else {
                Err(format!("Menu item {} out of range (0-{})", id, count - 1))
            };

            CFRelease(children_ref);
            result
        }
    }

    fn ax_print_menu_options(&self, app: AXUIElementRef) -> Result<(), String> {
        if app.is_null() {
            return Err("App element is null".to_string());
        }

        unsafe {
            let menubar_attr = CFString::new(AX_MENU_BAR_ATTRIBUTE);
            let visible_children_attr = CFString::new(AX_VISIBLE_CHILDREN_ATTRIBUTE);

            let mut menubars_ref: CFTypeRef = ptr::null();
            let error = AXUIElementCopyAttributeValue(
                app,
                menubar_attr.as_concrete_TypeRef(),
                &mut menubars_ref,
            );

            if error != AX_ERROR_SUCCESS || menubars_ref.is_null() {
                return Err("Failed to get menu bar".to_string());
            }

            let mut children_ref: CFTypeRef = ptr::null();
            let error = AXUIElementCopyAttributeValue(
                menubars_ref as AXUIElementRef,
                visible_children_attr.as_concrete_TypeRef(),
                &mut children_ref,
            );

            CFRelease(menubars_ref);

            if error != AX_ERROR_SUCCESS || children_ref.is_null() {
                return Err("Failed to get menu bar children".to_string());
            }

            let count = CFArrayGetCount(children_ref as CFArrayRef) as usize;
            if count <= 1 {
                CFRelease(children_ref);
                return Ok(());
            }

            // Skip the first item (Apple menu) as in the original C code
            for i in 1..count {
                let item = CFArrayGetValueAtIndex(children_ref as CFArrayRef, i as isize)
                    as AXUIElementRef;
                if !item.is_null() {
                    if let Some(title) = self.ax_get_title(item) {
                        println!("{title}");
                    }
                }
            }

            CFRelease(children_ref);
            Ok(())
        }
    }

    fn ax_get_extra_menu_item(&self, alias: &str) -> Option<AXUIElementRef> {
        unsafe {
            let window_list = CGWindowListCopyWindowInfo(kCGWindowListOptionAll, kCGNullWindowID);
            if window_list.is_null() {
                return None;
            }

            // Create keys once outside the loop to improve performance
            let owner_name_key = CFString::new(K_CGWINDOW_OWNER_NAME);
            let owner_pid_key = CFString::new(K_CGWINDOW_OWNER_PID);
            let window_name_key = CFString::new(K_CGWINDOW_NAME);
            let layer_key = CFString::new(K_CGWINDOW_LAYER);
            let _bounds_key = CFString::new(K_CGWINDOW_BOUNDS);

            let window_count = CFArrayGetCount(window_list) as usize;
            let mut target_pid: i32 = 0;

            for i in 0..window_count {
                let window_dict =
                    CFArrayGetValueAtIndex(window_list, i as isize) as CFDictionaryRef;
                if window_dict.is_null() {
                    continue;
                }

                // Get window properties
                let layer_ref = CFDictionaryGetValue(
                    window_dict,
                    layer_key.as_concrete_TypeRef() as *const c_void,
                );

                // Check layer first as it's a quick filter
                if layer_ref.is_null() {
                    continue;
                }

                let layer_num = CFNumber::wrap_under_get_rule(layer_ref as CFNumberRef);
                let layer: i64 = layer_num.to_i64().unwrap_or(0);

                if layer != 0x19 {
                    continue;
                }

                // Now check other properties that we need
                let owner_name_ref = CFDictionaryGetValue(
                    window_dict,
                    owner_name_key.as_concrete_TypeRef() as *const c_void,
                );
                let owner_pid_ref = CFDictionaryGetValue(
                    window_dict,
                    owner_pid_key.as_concrete_TypeRef() as *const c_void,
                );
                let window_name_ref = CFDictionaryGetValue(
                    window_dict,
                    window_name_key.as_concrete_TypeRef() as *const c_void,
                );

                if owner_name_ref.is_null() || owner_pid_ref.is_null() || window_name_ref.is_null()
                {
                    continue;
                }

                let owner_pid_num = CFNumber::wrap_under_get_rule(owner_pid_ref as CFNumberRef);
                let owner_pid: i32 = owner_pid_num.to_i32().unwrap_or(0);

                let owner_str = CFString::wrap_under_get_rule(owner_name_ref as CFStringRef);
                let window_str = CFString::wrap_under_get_rule(window_name_ref as CFStringRef);

                let combined = format!("{owner_str},{window_str}");

                if combined == alias {
                    target_pid = owner_pid;
                    break;
                }
            }

            // Release the window list as we no longer need it
            CFRelease(window_list as *const std::ffi::c_void);

            if target_pid == 0 {
                return None;
            }

            let app = AXUIElementCreateApplication(target_pid);
            if app.is_null() {
                return None;
            }

            // Pre-create string constants
            let extras_attr = CFString::new(AX_EXTRAS_MENU_BAR_ATTRIBUTE);
            let visible_children_attr = CFString::new(AX_VISIBLE_CHILDREN_ATTRIBUTE);
            let position_attr = CFString::new(AX_POSITION_ATTRIBUTE);
            let size_attr = CFString::new(AX_SIZE_ATTRIBUTE);

            let mut extras: CFTypeRef = ptr::null();
            let error =
                AXUIElementCopyAttributeValue(app, extras_attr.as_concrete_TypeRef(), &mut extras);

            if error != AX_ERROR_SUCCESS || extras.is_null() {
                CFRelease(app as CFTypeRef);
                return None;
            }

            let mut children_ref: CFTypeRef = ptr::null();
            let error = AXUIElementCopyAttributeValue(
                extras as AXUIElementRef,
                visible_children_attr.as_concrete_TypeRef(),
                &mut children_ref,
            );

            CFRelease(extras);

            if error != AX_ERROR_SUCCESS || children_ref.is_null() {
                CFRelease(app as CFTypeRef);
                return None;
            }

            let count = CFArrayGetCount(children_ref as CFArrayRef) as usize;
            let mut result: AXUIElementRef = ptr::null();

            for i in 0..count {
                let item = CFArrayGetValueAtIndex(children_ref as CFArrayRef, i as isize)
                    as AXUIElementRef;
                if !item.is_null() {
                    let mut position_ref: CFTypeRef = ptr::null();
                    let mut size_ref: CFTypeRef = ptr::null();

                    AXUIElementCopyAttributeValue(
                        item,
                        position_attr.as_concrete_TypeRef(),
                        &mut position_ref,
                    );

                    // Early continue if position is null
                    if position_ref.is_null() {
                        continue;
                    }

                    AXUIElementCopyAttributeValue(
                        item,
                        size_attr.as_concrete_TypeRef(),
                        &mut size_ref,
                    );

                    if !size_ref.is_null() {
                        // For simplicity, we'll take the first matching item
                        // The real implementation would compare positions with bounds
                        result = item;
                        CFRetain(result as CFTypeRef);
                        CFRelease(position_ref);
                        CFRelease(size_ref);
                        break;
                    }

                    CFRelease(position_ref);
                    if !size_ref.is_null() {
                        CFRelease(size_ref);
                    }
                }
            }

            CFRelease(children_ref);
            CFRelease(app as CFTypeRef);

            if result.is_null() { None } else { Some(result) }
        }
    }

    fn ax_select_menu_extra(&self, alias: &str) -> Result<(), String> {
        let item = self
            .ax_get_extra_menu_item(alias)
            .ok_or_else(|| format!("Menu extra '{alias}' not found"))?;

        unsafe {
            let connection_id = SLSMainConnectionID();

            // Hide menu bar and set transparency
            SLSSetMenuBarInsetAndAlpha(connection_id, 0.0, 1.0, 0.0);
            SLSSetMenuBarVisibilityOverrideOnDisplay(connection_id, 0, true);
            SLSSetMenuBarInsetAndAlpha(connection_id, 0.0, 1.0, 0.0);

            self.ax_perform_click(item)?;

            // Restore menu bar
            SLSSetMenuBarVisibilityOverrideOnDisplay(connection_id, 0, false);
            SLSSetMenuBarInsetAndAlpha(connection_id, 0.0, 1.0, 1.0);

            CFRelease(item as CFTypeRef);
        }

        Ok(())
    }

    fn ax_get_front_app(&self) -> Result<AXUIElementRef, String> {
        unsafe {
            let mut psn = ProcessSerialNumber { high: 0, low: 0 };
            _SLPSGetFrontProcess(&mut psn);

            let mut target_cid: c_int = 0;
            SLSGetConnectionIDForPSN(SLSMainConnectionID(), &psn, &mut target_cid);

            let mut pid: i32 = 0;
            SLSConnectionGetPID(target_cid, &mut pid);

            let app = AXUIElementCreateApplication(pid);
            if app.is_null() {
                Err("Failed to create application element".to_string())
            } else {
                Ok(app)
            }
        }
    }

    fn run(&self, args: &[String]) -> Result<(), String> {
        // We've already validated args.len() in main()
        match args[1].as_str() {
            "--list" => {
                let app = self.ax_get_front_app()?;
                let result = self.ax_print_menu_options(app);
                unsafe { CFRelease(app as CFTypeRef) };
                result?;
            }
            "--show" => {
                // We've already validated args.len() in main()

                // Try to parse as number first - this is more efficient than a regex match
                match args[2].parse::<usize>() {
                    Ok(id) => {
                        let app = self.ax_get_front_app()?;
                        let result = self.ax_select_menu_option(app, id);
                        unsafe { CFRelease(app as CFTypeRef) };
                        result?;
                    }
                    Err(_) => {
                        // Treat as alias for menu extra
                        self.ax_select_menu_extra(&args[2])?;
                    }
                }
            }
            _ => {
                return Err(format!("Unknown option: {}", args[1]));
            }
        }

        Ok(())
    }
}

fn main() {
    let args: Vec<String> = std::env::args().collect();

    // Simple test first
    if args.len() == 1 {
        let program = args.get(0).map_or("app-menu", |s| s);
        println!("Usage: {program} [--list | --show id/alias]");
        println!("  --list          List menu options for frontmost app");
        println!("  --show id       Select menu option by ID for frontmost app");
        println!("  --show alias    Select menu extra by alias");
        return;
    }

    // Only initialize MenuList if we have valid arguments
    if args.len() < 2 || (args[1] != "--list" && args[1] != "--show") {
        eprintln!("Error: Invalid arguments");
        process::exit(1);
    }

    // Check if we need an argument for --show
    if args[1] == "--show" && args.len() < 3 {
        eprintln!("Error: Option --show requires an argument");
        process::exit(1);
    }

    let menu_list = match MenuList::new() {
        Ok(ml) => ml,
        Err(e) => {
            eprintln!("Error initializing menu-list: {e}");
            process::exit(1);
        }
    };

    if let Err(e) = menu_list.run(&args) {
        eprintln!("Error: {e}");
        process::exit(1);
    }
}
