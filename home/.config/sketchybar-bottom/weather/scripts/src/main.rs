use std::error::Error;
use std::process;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use once_cell::sync::Lazy;
use tokio::task;
use objc2::rc::Retained;
use objc2::{define_class, msg_send, AnyThread};
use objc2::runtime::ProtocolObject;
use objc2::runtime::NSObjectProtocol;
use objc2_foundation::{NSObject as FoundationNSObject, NSRunLoop, NSDate};
use objc2_core_location::{CLLocationManager, CLLocation, CLAuthorizationStatus, CLLocationManagerDelegate};

// We prefer reading configuration from a .env file placed next to the scripts.
// The file path we look for first is: $HOME/.config/sketchybar-bottom/weather/scripts/.env
// If that doesn't exist, we fall back to loading the default dotenv behavior (./.env or env vars already set).
fn load_env() {
    // Try the specific path first
    if let Some(home) = dirs::home_dir() {
        let env_path = home.join(".config/sketchybar-bottom/weather/scripts/.env");
        if env_path.exists() {
            if let Err(e) = dotenvy::from_path(env_path) {
                eprintln!("Failed to load env from .config/sketchybar-bottom/weather/scripts/.env: {}", e);
            }
            return;
        }
    }

    // Fallback to loading from current dir or existing env
    if let Err(e) = dotenvy::dotenv() {
        // It's fine if there's no .env; variables may be present in the process environment.
        eprintln!("No .env loaded: {}", e);
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    // load .env into environment variables (if present)
    load_env();

    eprintln!("Starting Weather Watcher...");

    // Configuration via env vars:
    // VISUAL_CROSSING_KEY (required) - your Visual Crossing API key
    // Poll interval is fixed to 30 minutes.
    let key = std::env::var("VISUAL_CROSSING_KEY").unwrap_or_else(|_| {
        eprintln!("Environment variable VISUAL_CROSSING_KEY not set. Exiting.");
        process::exit(1);
    });
    // Always infer the location via the IP geolocation service on startup and pass
    // the resulting "lat,lon" (or "City, Country") to Visual Crossing. If we
    // cannot infer the location, exit so the user can provide an explicit value.
    let location = match get_location().await {
        Some(loc) => {
            loc
        }
        None => {
            eprintln!("Failed to infer location. Please set VISUAL_CROSSING_LOCATION env var.");
            process::exit(1);
        }
    };


    if let Err(e) = update(&key, &location).await {
        eprintln!("Weather update failed: {}", e);
    }

    Ok(())
}

struct LocationInfo {
    /// The query string to send to Visual Crossing (lat,lon or "City, Country")
    query: String,
    /// A human-friendly city/name if available (used in the UI payload)
    city: Option<String>,
}

async fn get_location() -> Option<LocationInfo> {
    // Try to get location from macOS Location Services
    if let Some(location) = get_location_from_macos().await {
        eprintln!("Inferred location via macOS Location Services: {}", location.query);

        return Some(location);
    } else {
        eprintln!("macOS Location Services not available or permission denied.");
    }

    // Try to get location from IP geolocation services
    if let Some(location) = get_location_from_ip().await {
        eprintln!("Inferred location via IP geolocation: {}", location.query);

        return Some(location);
    } else {
        eprintln!("Failed to infer location via IP geolocation.");
    }

    eprintln!("All methods to infer location failed.");

    None
}

async fn get_location_from_macos() -> Option<LocationInfo> {
    // We run CoreLocation on a blocking thread because it needs a run loop.
    let result = task::spawn_blocking(|| { macos_core_location_once() }).await.ok().flatten();
    result
}

static LOCATION_STATE: Lazy<Arc<Mutex<MacLocationState>>> = Lazy::new(|| Arc::new(Mutex::new(MacLocationState::default())));

#[derive(Default)]
struct MacLocationState {
    coord: Option<(f64, f64)>,
    finished: bool,
}

define_class!(
    #[unsafe(super(FoundationNSObject))]
    struct RustCLDelegate;

    impl RustCLDelegate {

        #[unsafe(method(locationManager:didUpdateLocations:))]
        fn did_update_locations(&self, _manager: &CLLocationManager, locations: &objc2_foundation::NSArray<CLLocation>) {
            if let Some(loc) = locations.lastObject() { // get most recent
                let (lat, lon) = unsafe { let c = loc.coordinate(); (c.latitude, c.longitude) };
                if let Ok(mut st) = LOCATION_STATE.lock() { st.coord = Some((lat, lon)); st.finished = true; }
            }
        }

        #[unsafe(method(locationManager:didFailWithError:))]
        fn did_fail_with_error(&self, _manager: &CLLocationManager, _error: *mut objc2::runtime::AnyObject) {
            if let Ok(mut st) = LOCATION_STATE.lock() { st.finished = true; }
        }

        #[unsafe(method(locationManagerDidChangeAuthorization:))]
        fn did_change_auth(&self, manager: &CLLocationManager) {
            let status = unsafe { manager.authorizationStatus() };
            match status.to_owned() { // just trigger request on not determined
                s if s == CLAuthorizationStatus::NotDetermined => {
                    unsafe { manager.requestWhenInUseAuthorization(); }
                },
                CLAuthorizationStatus::Denied | CLAuthorizationStatus::Restricted => {
                    if let Ok(mut st) = LOCATION_STATE.lock() { st.finished = true; }
                },
                _ => {
                    unsafe { manager.requestLocation(); }
                }
            }
        }
    }

    // Ensure RustCLDelegate implements NSObjectProtocol so it can be used as a delegate
    unsafe impl NSObjectProtocol for RustCLDelegate {}

    unsafe impl CLLocationManagerDelegate for RustCLDelegate {}
);

fn macos_core_location_once() -> Option<LocationInfo> {
    unsafe {
        let manager: Retained<CLLocationManager> = CLLocationManager::new();
        // allocate and init delegate
        let delegate = RustCLDelegate::alloc();
        let delegate: Retained<RustCLDelegate> = msg_send![delegate, init];
        // set delegate (CLLocationManager expects a ProtocolObject)
        let proto: Retained<ProtocolObject<dyn CLLocationManagerDelegate>> = ProtocolObject::from_retained(delegate);
        manager.setDelegate(Some(&*proto));

        // Check current authorization
        let status = manager.authorizationStatus();
        if status == CLAuthorizationStatus::NotDetermined { manager.requestWhenInUseAuthorization(); }
        else if status == CLAuthorizationStatus::Denied || status == CLAuthorizationStatus::Restricted { return None; }
        else { manager.requestLocation(); }

        let start = Instant::now();
        // Run the run loop until we have a coordinate or timeout
        while start.elapsed() < Duration::from_secs(5) {
            if let Ok(st) = LOCATION_STATE.lock() {
                if st.finished {
                    if let Some((lat, lon)) = st.coord {
                        return Some(LocationInfo { query: format!("{},{}", lat, lon), city: None });
                    } else { return None; }
                }
            }
            let rl = NSRunLoop::currentRunLoop();
            let date = NSDate::dateWithTimeIntervalSinceNow(0.1);
            rl.runMode_beforeDate(objc2_foundation::NSDefaultRunLoopMode, &date);
        }
    }
    None
}


async fn get_location_from_ipapi() -> Option<LocationInfo> {
    let resp = reqwest::get("https://ipapi.co/json/").await.ok()?;
    let json: serde_json::Value = resp.json().await.ok()?;
    let loc = json.get("loc")?.as_str()?;

    // Prefer explicit city if present, otherwise try timezone split
    let city = json.get("city").and_then(|c| c.as_str()).map(|s| s.to_string())
        .or_else(|| {
            json.get("timezone").and_then(|t| t.as_str()).and_then(|tz| tz.split('/').next_back()).map(|s| s.replace('_', " "))
        });

    Some(LocationInfo { query: loc.to_string(), city })
}

async fn get_location_from_ipinfo() -> Option<LocationInfo> {
    let resp = reqwest::get("https://ipinfo.io/json").await.ok()?;
    let json: serde_json::Value = resp.json().await.ok()?;
    let loc = json.get("loc")?.as_str()?;

    let city = json.get("city").and_then(|c| c.as_str()).map(|s| s.to_string())
        .or_else(|| {
            json.get("timezone").and_then(|t| t.as_str()).and_then(|tz| tz.split('/').next_back()).map(|s| s.replace('_', " "))
        });

    Some(LocationInfo { query: loc.to_string(), city })
}

async fn get_location_from_ip() -> Option<LocationInfo> {
    // Get IP from https://ipapi.co/json/
    if let Some(loc) = get_location_from_ipapi().await {
        return Some(loc);
    }

    // In case of any errors, fallback to ipinfo.io
    if let Some(loc) = get_location_from_ipinfo().await {
        return Some(loc);
    }

    None
}

async fn update(key: &str, location: &LocationInfo) -> Result<(), Box<dyn Error>> {
    // Use Visual Crossing 'today' endpoint and request specific elements
    // See: https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/<location>/today
    let base = "https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline";
    let elements = "name,address,resolvedAddress,feelslike,moonphase,conditions,description,icon";
    let include = "alerts,current,fcst,days";
    let url = format!(
        "{base}/{loc}/today?key={key}&unitGroup=metric&elements={elements}&include={include}&iconSet=icons2&contentType=json",
        base = base,
        loc = urlencoding::encode(&location.query),
        key = key,
        elements = elements,
        include = include
    );

    eprintln!("Fetching weather data (today) for {}...", location.query);

    let resp = reqwest::get(&url).await?.error_for_status()?;
    let text = resp.text().await?;
    let v: serde_json::Value = serde_json::from_str(&text)?;

    if let Some(tz) = v.get("timezone").and_then(|t| t.as_str()) {
        eprintln!("Timezone: {}", tz);
    }

    // currentConditions is expected when include=current
    let current = v.get("currentConditions").unwrap_or(&serde_json::Value::Null);

    // Extract fields with sensible fallbacks
    let temp = current.get("temp").and_then(|t| t.as_f64());
    // prefer feels_like if present
    let feels_like = current.get("feelslike").and_then(|t| t.as_f64()).or(temp);
    let conditions = current.get("conditions").and_then(|c| c.as_str()).unwrap_or("").to_string();
    let icon = current.get("icon").and_then(|i| i.as_str())
        .map(|s| s.to_string())
        .or_else(|| {
            // try to pull from first day entry
            v.get("days").and_then(|d| d.get(0)).and_then(|day| day.get("icon")).and_then(|i| i.as_str()).map(|s| s.to_string())
        })
        .unwrap_or_default();

    // Top-level fields
    let name = v.get("name").and_then(|s| s.as_str()).map(|s| s.to_string());
    let address = v.get("address").and_then(|s| s.as_str()).map(|s| s.to_string());
    let resolved_address = v.get("resolvedAddress").and_then(|s| s.as_str()).map(|s| s.to_string());

    // description: prefer current, otherwise first day
    let description = current.get("description").and_then(|d| d.as_str()).map(|s| s.to_string())
        .or_else(|| v.get("days").and_then(|d| d.get(0)).and_then(|day| day.get("description")).and_then(|d| d.as_str()).map(|s| s.to_string()))
        .unwrap_or_default();

    // moon_phase: from first day if present
    let moon_phase = v.get("days").and_then(|d| d.get(0)).and_then(|day| day.get("moonphase")).and_then(|m| m.as_f64());

    let city = location.city.clone().unwrap_or_else(|| location.query.clone());

    // Build JSON payload with the requested fields
    let mut data = serde_json::Map::new();
    if let Some(n) = name { data.insert("name".to_string(), serde_json::Value::String(n)); }
    if let Some(a) = address { data.insert("address".to_string(), serde_json::Value::String(a)); }
    if let Some(r) = resolved_address { data.insert("resolvedAddress".to_string(), serde_json::Value::String(r)); }
    if let Some(f) = feels_like { data.insert("feels_like".to_string(), serde_json::Value::Number(serde_json::Number::from_f64(f).unwrap())); }
    if let Some(m) = moon_phase { data.insert("moon_phase".to_string(), serde_json::Value::Number(serde_json::Number::from_f64(m).unwrap())); }
    data.insert("conditions".to_string(), serde_json::Value::String(conditions));
    data.insert("description".to_string(), serde_json::Value::String(description));
    data.insert("icon".to_string(), serde_json::Value::String(icon));
    if let Some(t) = temp { data.insert("temp".to_string(), serde_json::Value::Number(serde_json::Number::from_f64(t).unwrap())); }
    data.insert("location".to_string(), serde_json::Value::String(location.query.clone()));
    data.insert("city".to_string(), serde_json::Value::String(city));

    let data_val = serde_json::Value::Object(data);
    let data_str = data_val.to_string();

    // Build the sketchybar trigger argument
    let weather_arg = format!("WEATHER={}", data_str);

    // Call the sketchybar-bottom helper to notify the bar about new data
    // This uses the same command style you provided in the prompt
    let status = tokio::process::Command::new("sketchybar-bottom")
      .arg("--trigger")
      .arg("weather_changed")
      .arg(&weather_arg)
      .status()
      .await?;

    if !status.success() {
        eprintln!("sketchybar-bottom exited with: {:?}", status);
    }

    Ok(())
}
