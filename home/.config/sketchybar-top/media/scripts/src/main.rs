use std::fs::{create_dir_all, File};
use std::io::{self, BufRead, BufReader, Write};
use std::process::{Command, Stdio};

use serde_json::{Map, Value};

// Resize the provided image to 30x30 and encode it according to the provided MIME type.
// Returns a tuple of (encoded_bytes, extension).
fn resize_artwork(img: image::DynamicImage, _mime: &str) -> io::Result<(Vec<u8>, String)> {
    // resize to 30x30 using Lanczos3 for quality
    let resized = img.resize_exact(30, 30, image::imageops::FilterType::Lanczos3);

    // convert to RGBA so we can apply an alpha mask for rounding
    let mut rgba = resized.to_rgba8();
    let (w, h) = rgba.dimensions();

    // create circular mask (center, radius)
    let cx = (w as f32) / 2.0;
    let cy = (h as f32) / 2.0;
    let radius = (w.min(h) as f32) / 2.0;

    // optional 1px antialiasing feather
    let feather: f32 = 1.0;

    for y in 0..h {
        for x in 0..w {
            let dx = x as f32 + 0.5 - cx;
            let dy = y as f32 + 0.5 - cy;
            let dist = (dx * dx + dy * dy).sqrt();

            let alpha = if dist <= radius - feather {
                255u8
            } else if dist >= radius + feather {
                0u8
            } else {
                // smoothstep between radius-feather and radius+feather
                let t = (dist - (radius - feather)) / (2.0 * feather);
                let t = t.clamp(0.0, 1.0);
                let smooth = (1.0 - t) * (1.0 - t) * (3.0 - 2.0 * (1.0 - t));
                // return expression directly
                (smooth * 255.0).round() as u8
            };

            let p = rgba.get_pixel_mut(x, y);
            // preserve RGB, set alpha multiplied by existing alpha
            let existing_alpha = p[3] as f32 / 255.0;
            let new_alpha = ((alpha as f32 / 255.0) * existing_alpha * 255.0).round() as u8;
            p[3] = new_alpha;
        }
    }

    // always output PNG
    let ext = "png".to_string();
    let mut buf = std::io::Cursor::new(Vec::new());
    image::DynamicImage::ImageRgba8(rgba)
        .write_to(&mut buf, image::ImageFormat::Png)
        .map_err(io::Error::other)?;

    Ok((buf.into_inner(), ext))
}

fn save_artwork(state: &Map<String, Value>) -> io::Result<Option<String>> {
    if let Some(Value::String(art)) = state.get("artworkData") {
        if art.starts_with('<') {
            // placeholder like "<image/jpeg 71558 bytes...>", nothing we can decode
            return Ok(None);
        }

        if let Some(Value::String(mime)) = state.get("artworkMimeType") {
            // use modern base64 Engine API
            use base64::engine::general_purpose::STANDARD;
            use base64::Engine;
            match STANDARD.decode(art) {
                Ok(bytes) => {
                    // attempt to load image from bytes
                    match image::load_from_memory(&bytes) {
                        Ok(img) => {
                            // perform resize + encoding via helper
                            let (enc_bytes, ext) = resize_artwork(img, mime.as_str())?;

                            let dir = "/tmp/sketchybar";
                            create_dir_all(dir)?;
                            let path = format!("{}/sketchybar-media-artwork.{}", dir, ext);

                            let mut out = File::create(&path)?;
                            out.write_all(&enc_bytes)?;
                            return Ok(Some(path));
                        }
                        Err(_) => return Ok(None),
                    }
                }
                Err(_) => return Ok(None),
            }
        }
    }
    Ok(None)
}

fn merge_state(base: &mut Map<String, Value>, diff: &Map<String, Value>) {
    for (k, v) in diff {
        if v.is_null() {
            base.remove(k);
        } else {
            base.insert(k.clone(), v.clone());
        }
    }
}

fn trigger_sketchybar(payload: &Value) -> io::Result<()> {
    let payload_str = payload.to_string();
    let media_arg = format!("MEDIA={}", payload_str);

    let _ = Command::new("sketchybar-top")
        .arg("--trigger")
        .arg("os_media_changed")
        .arg(media_arg)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()?;
    Ok(())
}

fn main() -> io::Result<()> {
    let mut child = Command::new("media-control")
        .arg("stream")
        .stdout(Stdio::piped())
        .spawn()
        .expect("failed to spawn media-control stream");

    let stdout = child.stdout.take().expect("failed to capture stdout");
    let reader = BufReader::new(stdout);

    let mut last_full: Map<String, Value> = Map::new();

    for line in reader.lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => continue,
        };
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        let v: Value = match serde_json::from_str(line) {
            Ok(j) => j,
            Err(_) => continue,
        };

        let obj = match v.as_object() {
            Some(o) => o,
            None => continue,
        };

        let diff = obj.get("diff").and_then(|d| d.as_bool()).unwrap_or(false);
        let payload_val = obj
            .get("payload")
            .cloned()
            .unwrap_or(Value::Object(Map::new()));

        let payload_map = match payload_val {
            Value::Object(m) => m,
            _ => Map::new(),
        };

        if diff {
            merge_state(&mut last_full, &payload_map);
        } else if !payload_map.is_empty() {
            last_full = payload_map.clone();
        }

        // attempt to save artwork when present; if saved, replace artworkData with the file path
        match save_artwork(&last_full) {
            Ok(Some(path)) => {
                last_full.insert("artworkData".to_string(), Value::String(path));
            }
            Ok(None) => {}
            Err(e) => eprintln!("failed to save artwork: {}", e),
        }

        let payload_value = Value::Object(last_full.clone());
        let _ = trigger_sketchybar(&payload_value);
    }

    // ensure we wait on the child to avoid leaving a zombie process
    let _ = child.wait();

    Ok(())
}
