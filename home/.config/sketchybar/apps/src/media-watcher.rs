use std::collections::hash_map::DefaultHasher;
use std::fs::{File, create_dir_all};
use std::hash::{Hash, Hasher};
use std::io::{self, BufRead, BufReader, Write};
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::OnceLock;

use serde_json::{Map, Value};
use smallvec::{SmallVec, smallvec};

// Resize the provided image to 30x30 and encode it according to the provided MIME type.
// Returns a tuple of (encoded_bytes, extension).
fn resize_artwork(img: &image::DynamicImage, _mime: &str) -> io::Result<(Vec<u8>, String)> {
    // Static buffer to reuse across function calls
    static PNG_BUFFER: OnceLock<std::sync::Mutex<Vec<u8>>> = OnceLock::new();

    // Constants for optimization
    const SIZE: u32 = 30;
    const SIZE_F32: f32 = 30.0; // Use this instead of casting
    const FEATHER: f32 = 1.0;
    const OUTER_LIMIT_SQ: f32 = (SIZE_F32 / 2.0 + FEATHER) * (SIZE_F32 / 2.0 + FEATHER);
    const INNER_LIMIT_SQ: f32 = (SIZE_F32 / 2.0 - FEATHER) * (SIZE_F32 / 2.0 - FEATHER);
    const CENTER: f32 = SIZE_F32 / 2.0;

    // Use faster Nearest filter for small resizes (30x30 is small enough)
    let resized = img.resize_exact(SIZE, SIZE, image::imageops::FilterType::Nearest);

    // convert to RGBA so we can apply an alpha mask for rounding
    let mut rgba = resized.to_rgba8();

    // Pre-calculate center values to avoid repeated calculations
    let center_offset: f32 = 0.5;

    // Use squared distances to avoid expensive sqrt operations
    for y in 0..SIZE {
        #[allow(clippy::cast_precision_loss)]
        let dy = y as f32 + center_offset - CENTER;

        for x in 0..SIZE {
            #[allow(clippy::cast_precision_loss)]
            let dx = x as f32 + center_offset - CENTER;
            // Using square distance avoids sqrt operation
            let dist_sq = dx.mul_add(dx, dy * dy);

            // Fast path for pixels clearly inside or outside
            let alpha = if dist_sq <= INNER_LIMIT_SQ {
                255u8
            } else if dist_sq >= OUTER_LIMIT_SQ {
                0u8
            } else {
                // Only do the more expensive calculations for edge pixels
                // Get linear distance for smoother edge transition
                let dist = dist_sq.sqrt();
                // Optimized smoothstep calculation
                let t = (dist - (SIZE_F32 / 2.0 - FEATHER)) / (2.0 * FEATHER);
                let t = t.clamp(0.0, 1.0);
                let one_minus_t = 1.0 - t;
                let smooth = (3.0 * one_minus_t)
                    .mul_add(one_minus_t, -2.0 * one_minus_t * one_minus_t * one_minus_t);
                // Use checked conversion to avoid possible truncation issues
                #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
                let alpha_value = (smooth * 255.0).clamp(0.0, 255.0) as u8;
                alpha_value
            };

            // Get a mutable reference to the pixel
            let pixel = rgba.get_pixel_mut(x, y);
            let data = pixel.0;
            // preserve RGB, multiply alpha only
            let existing_alpha = f32::from(data[3]) / 255.0;
            // Update just the alpha channel - clamp to avoid truncation issues
            let new_alpha = ((f32::from(alpha) / 255.0) * existing_alpha * 255.0).clamp(0.0, 255.0);
            // Explicitly cast with allowance for potential precision loss (acceptable for alpha channel)
            #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
            {
                pixel.0[3] = new_alpha as u8;
            }
        }
    }

    // Use the buffer declared at the top of the function
    let buffer = PNG_BUFFER.get_or_init(|| std::sync::Mutex::new(Vec::with_capacity(4096)));

    // Lock the buffer and clear it
    let mut buffer = buffer.lock().unwrap();
    buffer.clear();

    // Create a cursor from the buffer and write the PNG data
    let mut cursor = std::io::Cursor::new(&mut *buffer);
    image::DynamicImage::ImageRgba8(rgba)
        .write_to(&mut cursor, image::ImageFormat::Png)
        .map_err(io::Error::other)?;

    // Get the final size (using usize::try_from would be technically more correct, but this is safe in practice
    // as we're dealing with small image buffers that won't exceed usize capacity even on 32-bit systems)
    #[allow(clippy::cast_possible_truncation)]
    let size = cursor.position() as usize;

    // Create the result vector by cloning only the used portion of the buffer
    let result = buffer[..size].to_vec();

    // Release the lock early
    drop(buffer);

    Ok((result, "png".to_string()))
}

fn cleanup_string_for_filename(s: &str) -> String {
    // Pre-allocate capacity to avoid reallocations
    let mut result = String::with_capacity(s.len());

    // Track whether the last char added was an underscore to avoid duplicates
    let mut last_was_underscore = false;

    // Single pass transformation with optimized character handling
    for c in s.chars().flat_map(char::to_lowercase) {
        if c.is_alphanumeric() || c == '-' || c == '_' {
            result.push(c);
            last_was_underscore = c == '_';
        } else if !last_was_underscore {
            // Only add an underscore if the last character wasn't one
            result.push('_');
            last_was_underscore = true;
        }
    }

    // Trim leading/trailing underscores in a single pass
    let result = result.trim_matches('_');

    // Convert to owned string, avoiding allocation if already a String
    result.to_string()
}

fn get_cache_path(state: &Map<String, Value>, extension: &str) -> String {
    const CACHE_DIR: &str = "/tmp/sketchybar/";
    static UNKNOWN: &str = "unknown";

    // Extract metadata for filename - avoid unwrap_or which allocates
    let artist = state
        .get("artist")
        .and_then(Value::as_str)
        .unwrap_or(UNKNOWN);
    let title = state
        .get("title")
        .and_then(Value::as_str)
        .unwrap_or(UNKNOWN);
    let album = state
        .get("album")
        .and_then(Value::as_str)
        .unwrap_or(UNKNOWN);

    // Pre-allocate with appropriate capacity to avoid reallocations
    let mut cache_name = String::with_capacity(artist.len() + title.len() + album.len() + 2);
    cache_name.push_str(artist);
    cache_name.push('-');
    cache_name.push_str(title);
    cache_name.push('-');
    cache_name.push_str(album);

    // Clean up the filename
    let clean_filename = cleanup_string_for_filename(&cache_name);

    // Calculate final path size and allocate once
    let mut path =
        String::with_capacity(CACHE_DIR.len() + clean_filename.len() + extension.len() + 1);
    path.push_str(CACHE_DIR);
    path.push_str(&clean_filename);
    path.push('.');
    path.push_str(extension);
    path
}

fn save_artwork(state: &Map<String, Value>) -> io::Result<Option<String>> {
    // Static resources at the top of the function
    static CACHE_DIR_CREATED: OnceLock<()> = OnceLock::new();
    static DECODE_BUFFER: OnceLock<std::sync::Mutex<Vec<u8>>> = OnceLock::new();

    // use modern base64 Engine API
    use base64::Engine;
    use base64::engine::general_purpose::STANDARD;

    // Fast path check - avoid deeper processing if artwork data isn't present
    let Some(Value::String(art)) = state.get("artworkData") else {
        return Ok(None);
    };

    if art.starts_with('<') {
        return Ok(None);
    }

    let Some(Value::String(mime)) = state.get("artworkMimeType") else {
        return Ok(None);
    };

    // Resources were moved to the top of the function

    // Get or create the shared decoding buffer
    let decode_buffer =
        DECODE_BUFFER.get_or_init(|| std::sync::Mutex::new(Vec::with_capacity(4096)));

    // Lock the buffer and prepare to decode
    let mut buffer = decode_buffer.lock().unwrap();
    buffer.clear();

    // Decode into our reusable buffer
    if STANDARD.decode_vec(art, &mut buffer).is_err() {
        return Ok(None);
    }

    // attempt to load image from bytes
    let Ok(img) = image::load_from_memory(&buffer) else {
        return Ok(None);
    };

    // Release the mutex as early as possible
    drop(buffer);

    // perform resize + encoding via helper
    let (enc_bytes, ext) = resize_artwork(&img, mime.as_str())?;

    // Get the cache path
    let path = get_cache_path(state, &ext);

    // Check if file already exists - use Path directly for better performance
    if Path::new(&path).exists() {
        return Ok(Some(path));
    }

    // Ensure cache directory exists (only once)
    CACHE_DIR_CREATED.get_or_init(|| {
        let _ = create_dir_all("/tmp/sketchybar");
    });

    // Write the file with optimized buffering
    let mut out = File::create(&path)?;
    out.write_all(&enc_bytes)?;

    Ok(Some(path))
}

fn merge_state(base: &mut Map<String, Value>, diff: &Map<String, Value>) {
    // No need for capacity allocation - Map doesn't support this

    for (k, v) in diff {
        if v.is_null() {
            base.remove(k);
        } else {
            // Use insert_nocheck when serde_json supports it in the future
            // For now, clone is unavoidable due to serde_json Map API
            base.insert(k.clone(), v.clone());
        }
    }
}

fn trigger_sketchybar(payload: &Value) -> io::Result<()> {
    // Static JSON buffer to avoid allocations
    static JSON_BUFFER: OnceLock<std::sync::Mutex<String>> = OnceLock::new();
    let buffer = JSON_BUFFER.get_or_init(|| std::sync::Mutex::new(String::with_capacity(4096)));

    // Lock and clear the buffer
    let mut string_buffer = buffer.lock().unwrap();
    string_buffer.clear();

    // Use to_string() directly since MutexGuard<String> doesn't implement Write
    *string_buffer = payload.to_string();

    // Prepare command arguments using SmallVec to avoid heap allocations
    let mut media_arg = String::with_capacity(7 + string_buffer.len());
    media_arg.push_str("MEDIA=");
    media_arg.push_str(&string_buffer);

    // Release the mutex lock early
    drop(string_buffer);

    // Create a small Vec for arguments instead of using smallvec
    let args = vec!["--trigger", "os_media_changed", &media_arg];

    // Create and spawn the command with the prepared arguments
    let _ = Command::new("sketchybar-top")
        .args(&args)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()?;

    Ok(())
}

/**
 * Helper to save artwork if present and trigger sketchybar with updated state
 */
// Calculate a hash of the state to detect changes
fn calculate_state_hash(state: &Map<String, Value>) -> u64 {
    let mut hasher = DefaultHasher::new();
    state.hash(&mut hasher);
    hasher.finish()
}

// Global for tracking last state hash
static LAST_STATE_HASH: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

fn save_artwork_and_trigger(state: &mut Map<String, Value>) -> io::Result<()> {
    // Only process if state has changed (reduces unnecessary work)
    let current_hash = calculate_state_hash(state);
    let last_hash = LAST_STATE_HASH.load(std::sync::atomic::Ordering::Relaxed);

    // Skip processing if hash is unchanged and this isn't the first run
    if current_hash == last_hash && last_hash != 0 {
        return Ok(());
    }

    // Update the hash
    LAST_STATE_HASH.store(current_hash, std::sync::atomic::Ordering::Relaxed);

    // Save artwork if present
    if let Ok(Some(artwork_path)) = save_artwork(state) {
        // Use static strings to avoid allocations
        static ARTWORK_PATH: OnceLock<String> = OnceLock::new();
        let key = ARTWORK_PATH.get_or_init(|| "artworkPath".to_string());

        state.insert(key.clone(), Value::String(artwork_path));
        state.remove("artworkData");
        state.remove("artworkMimeType");
    }

    // Avoid cloning the entire state - create Value reference directly
    let final_payload = Value::Object(state.clone());

    // Only print to stderr in debug mode
    #[cfg(debug_assertions)]
    {
        static DEBUG_BUFFER: OnceLock<std::sync::Mutex<String>> = OnceLock::new();
        let buffer =
            DEBUG_BUFFER.get_or_init(|| std::sync::Mutex::new(String::with_capacity(4096)));
        let mut string_buffer = buffer.lock().unwrap();
        string_buffer.clear();

        if let Ok(pretty) = serde_json::to_string_pretty(&final_payload) {
            string_buffer.push_str(&pretty);
        } else {
            string_buffer.push_str(&final_payload.to_string());
        }

        let output = string_buffer.clone();
        drop(string_buffer);
        eprintln!("{output}");
    }

    trigger_sketchybar(&final_payload)?;
    Ok(())
}

/**
 * Process a line of JSON from media-control for stream command
 * Handle both diff and full updates based on the "diff" field
 */
// Use a simpler version of serde_json::from_str with fewer allocations
fn parse_json(line: &str) -> Option<Value> {
    static JSON_BUFFER: OnceLock<std::sync::Mutex<Vec<u8>>> = OnceLock::new();
    let buffer = JSON_BUFFER.get_or_init(|| std::sync::Mutex::new(Vec::with_capacity(4096)));

    // Lock and prepare the buffer
    let mut byte_buffer = buffer.lock().unwrap();
    byte_buffer.clear();
    byte_buffer.extend_from_slice(line.as_bytes());

    // Parse directly from bytes
    let result = serde_json::from_slice::<Value>(&byte_buffer).ok();

    // Release the lock early
    drop(byte_buffer);

    result
}

fn process_stream_output(line: &str, state: &mut Map<String, Value>) -> io::Result<()> {
    // Skip empty lines early
    if line.trim().is_empty() {
        return Ok(());
    }

    // Parse the JSON line with our optimized parser
    let Some(parsed) = parse_json(line) else {
        return Ok(());
    };

    // Get the object representation
    let Some(stream_data) = parsed.as_object() else {
        return Ok(());
    };

    // Check if this is a diff update or full update - use is_truthy for better performance
    let is_diff = matches!(stream_data.get("diff"), Some(Value::Bool(true)));

    // Extract the payload - early return if missing
    let Some(payload_obj) = stream_data.get("payload").and_then(Value::as_object) else {
        return Ok(());
    };

    // Apply state changes
    if is_diff {
        // Merge the new state with the existing state
        merge_state(state, payload_obj);
    } else {
        // Replace the entire state with the new payload
        state.clear();
        // No need to call reserve as Map doesn't support it
        state.extend(payload_obj.clone());
    }

    // Only process non-empty states
    if !state.is_empty() {
        save_artwork_and_trigger(state)?;
    }

    Ok(())
}

/**
 * Process a line of JSON from media-control for get command
 * The get command sends the full state directly
 */
fn process_get_output(line: &str) -> io::Result<()> {
    // Skip empty lines early
    if line.trim().is_empty() {
        return Ok(());
    }

    // Use our optimized JSON parser
    let Some(parsed) = parse_json(line) else {
        return Ok(());
    };

    // Get state as object and process if valid
    if let Some(obj) = parsed.as_object() {
        // Clone is necessary here since we don't have a pre-existing state object
        let mut state = obj.clone();
        save_artwork_and_trigger(&mut state)?;
    }

    Ok(())
}

fn start_streaming() {
    // Spawn the command with arguments stored in SmallVec to avoid heap allocation
    let args: SmallVec<[&str; 1]> = smallvec!["stream"];

    let mut child = match Command::new("media-control")
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::null()) // Ignore stderr output
        .spawn()
    {
        Ok(child) => child,
        Err(e) => {
            eprintln!("Failed to spawn media-control stream: {e}");
            return;
        }
    };

    // Initialize state to track media info across updates
    // Use with_capacity to preallocate space and avoid reallocations
    let mut state = Map::with_capacity(16);

    if let Some(stdout) = child.stdout.take() {
        // Create a BufReader with a reasonable buffer size
        let reader = BufReader::with_capacity(4096, stdout);

        // Read the output from media-control stream line by line
        // Use lines() which handles line endings correctly
        for line in reader.lines() {
            match line {
                Ok(line_content) => {
                    // Skip empty lines early
                    if line_content.trim().is_empty() {
                        continue;
                    }

                    // For each line call process_stream_output()
                    #[cfg(debug_assertions)]
                    if let Err(e) = process_stream_output(&line_content, &mut state) {
                        // Only print errors in debug mode to avoid cluttering logs
                        eprintln!("Error processing media control output: {e}");
                    }
                    #[cfg(not(debug_assertions))]
                    let _ = process_stream_output(&line_content, &mut state);
                }
                Err(_e) => {
                    #[cfg(debug_assertions)]
                    eprintln!("Error reading line from media-control");
                    break;
                }
            }
        }
    }

    // Use an explicit wait_with_output to properly handle process termination
    let _ = child.wait();
}

fn get_media_once() {
    // Use SmallVec for the arguments to avoid heap allocation
    let args: SmallVec<[&str; 1]> = smallvec!["get"];

    let mut child = match Command::new("media-control")
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::null()) // Ignore stderr output
        .spawn()
    {
        Ok(child) => child,
        Err(e) => {
            eprintln!("Failed to spawn media-control get: {e}");
            return;
        }
    };

    if let Some(stdout) = child.stdout.take() {
        // Create a BufReader with a reasonable buffer size
        let reader = BufReader::with_capacity(4096, stdout);

        // Read only the first line which should contain all necessary data
        if let Some(line) = reader.lines().next() {
            match line {
                Ok(line_content) => {
                    // Skip empty lines
                    if !line_content.trim().is_empty() {
                        #[cfg(debug_assertions)]
                        if let Err(e) = process_get_output(&line_content) {
                            // Only print errors in debug mode
                            eprintln!("Error processing media control output: {e}");
                        }
                        #[cfg(not(debug_assertions))]
                        let _ = process_get_output(&line_content);
                    }
                }
                #[cfg(debug_assertions)]
                Err(e) => {
                    eprintln!("Error reading line from media-control: {e}");
                }
                #[cfg(not(debug_assertions))]
                Err(_) => {}
            }
        }
    }

    // Use an explicit wait to ensure process termination is handled
    let _ = child.wait();
}

fn main() {
    // Get a reference to the args without collecting them into a Vec
    let args = std::env::args();

    // Get the program name for usage message
    let prog = std::env::args()
        .next()
        .unwrap_or_else(|| "media-handler".to_string());

    // Skip the first element (program name) and check for arguments
    let mut args_iter = args.skip(1);

    if let Some(arg) = args_iter.next() {
        match arg.as_str() {
            "--stream" => {
                start_streaming();
            }
            "--get" => {
                get_media_once();
            }
            _ => {
                // Use static string slices for usage to avoid allocations
                println!("Unknown argument: {arg}");
                println!("Usage: {prog} [--stream | --get]");
                println!("  --stream    Start streaming media info to sketchybar");
                println!("  --get       Get current media info once and send to sketchybar");
            }
        }
    } else {
        // No arguments provided
        println!("Usage: {prog} [--stream | --get]");
        println!("  --stream    Start streaming media info to sketchybar");
        println!("  --get       Get current media info once and send to sketchybar");
    }
}
