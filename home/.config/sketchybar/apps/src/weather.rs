use objc2::rc::Retained;
use objc2::runtime::NSObjectProtocol;
use objc2::runtime::ProtocolObject;
use objc2::{define_class, msg_send, AnyThread};
use objc2_core_location::{
    CLAuthorizationStatus, CLLocation, CLLocationManager, CLLocationManagerDelegate,
};
use objc2_foundation::{NSDate, NSObject as FoundationNSObject, NSRunLoop};
use once_cell::sync::OnceCell;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::error::Error;
use std::process;
use std::sync::{Arc, LazyLock, Mutex};
use std::time::{Duration, Instant, SystemTime};
use tokio::task;
use tokio::time::timeout;

// We prefer reading configuration from a .env file placed next to the apps.
// The file path we look for first is: $HOME/.config/sketchybar-bottom/weather/apps/.env
// If that doesn't exist, we fall back to loading the default dotenv behavior (./.env or env vars already set).
fn load_env() {
    // Try the specific path first
    if let Some(home) = dirs::home_dir() {
        let env_path = ".config/sketchybar/apps/.env";
        let env_file = home.join(env_path);
        if env_file.exists() {
            if let Err(e) = dotenvy::from_path(env_file) {
                eprintln!("Failed to load env from {env_path}: {e}");
            }
            return;
        }
    }

    // Fallback to loading from current dir or existing env
    if let Err(e) = dotenvy::dotenv() {
        // It's fine if there's no .env; variables may be present in the process environment.
        eprintln!("No .env loaded: {e}");
    }
}

#[tokio::main]
async fn main() {
    // load .env into environment variables (if present)
    load_env();

    eprintln!("Starting Weather Watcher...");

    // Configuration via env vars:
    // VISUAL_CROSSING_KEY (required) - your Visual Crossing API key
    let key = std::env::var("VISUAL_CROSSING_KEY").unwrap_or_else(|_| {
        eprintln!("Environment variable VISUAL_CROSSING_KEY not set. Exiting.");
        process::exit(1);
    });

    // Update interval in minutes (from env or default to 15 minutes)
    let update_interval_mins = std::env::var("WEATHER_UPDATE_INTERVAL_MINS")
        .ok()
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(15);
    let update_interval = Duration::from_secs(update_interval_mins * 60);

    eprintln!("Update interval set to {} minutes", update_interval_mins);

    // Run the update loop forever
    loop {
        // Get location - will use cache if available and fresh
        let location = match get_location().await {
            Some(loc) => loc,
            None => {
                eprintln!("Failed to infer location. Will retry in 60 seconds.");
                tokio::time::sleep(Duration::from_secs(60)).await;
                continue;
            }
        };

        // Update the weather data
        match update(&key, &location).await {
            Ok(_) => eprintln!("Weather update successful"),
            Err(e) => eprintln!("Weather update failed: {e}"),
        }

        // Sleep until next update
        eprintln!(
            "Sleeping for {} minutes until next update",
            update_interval_mins
        );
        tokio::time::sleep(update_interval).await;
    }
}

// Global HTTP client to reuse connections
static HTTP_CLIENT: OnceCell<Client> = OnceCell::new();

// Get or initialize the HTTP client
fn client() -> &'static Client {
    HTTP_CLIENT.get_or_init(|| {
        Client::builder()
            .timeout(Duration::from_secs(10))
            .pool_max_idle_per_host(10)
            .build()
            .expect("Failed to create HTTP client")
    })
}

#[derive(Debug, Clone, Deserialize)]
struct LocationInfo {
    /// The query string to send to Visual Crossing (lat,lon or "City, Country")
    query: String,
    /// A human-friendly city/name if available (used in the UI payload)
    city: Option<String>,
    /// When this location was determined (for caching purposes)
    #[serde(skip)]
    timestamp: Option<SystemTime>,
}

impl LocationInfo {
    fn new(query: String, city: Option<String>) -> Self {
        Self {
            query,
            city,
            timestamp: Some(SystemTime::now()),
        }
    }

    fn is_fresh(&self) -> bool {
        match self.timestamp {
            Some(time) => {
                SystemTime::now()
                    .duration_since(time)
                    .map(|duration| duration < Duration::from_secs(3600)) // Cache for 1 hour
                    .unwrap_or(false)
            }
            None => false,
        }
    }
}

// Cache location to avoid re-querying unnecessarily
static CACHED_LOCATION: LazyLock<Mutex<Option<LocationInfo>>> = LazyLock::new(|| Mutex::new(None));

async fn get_location() -> Option<LocationInfo> {
    // Check if we have a cached location that's still fresh
    if let Ok(cached) = CACHED_LOCATION.lock() {
        if let Some(location) = cached.as_ref() {
            if location.is_fresh() {
                eprintln!("Using cached location: {}", location.query);
                return Some(location.clone());
            }
        }
    }

    // Try to get location from multiple sources in parallel
    let (macos_location, ip_location) =
        tokio::join!(get_location_from_macos(), get_location_from_ip());

    // Prefer macOS location if available
    let location = if let Some(loc) = macos_location {
        eprintln!(
            "Inferred location via macOS Location Services: {}",
            loc.query
        );
        Some(loc)
    } else {
        eprintln!("macOS Location Services not available or permission denied.");

        if let Some(loc) = ip_location {
            eprintln!("Inferred location via IP geolocation: {}", loc.query);
            Some(loc)
        } else {
            eprintln!("Failed to infer location via IP geolocation.");
            eprintln!("All methods to infer location failed.");
            None
        }
    };

    // Cache the result if successful
    if let Some(loc) = &location {
        if let Ok(mut cached) = CACHED_LOCATION.lock() {
            *cached = Some(loc.clone());
        }
    }

    location
}

async fn get_location_from_macos() -> Option<LocationInfo> {
    // We run CoreLocation on a blocking thread because it needs a run loop,
    // with a timeout to prevent blocking for too long
    timeout(
        Duration::from_secs(5),
        task::spawn_blocking(macos_core_location_once),
    )
    .await
    .ok()?
    .ok()
    .flatten()
}

static LOCATION_STATE: LazyLock<Arc<Mutex<MacLocationState>>> =
    LazyLock::new(|| Arc::new(Mutex::new(MacLocationState::default())));

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
            match status { // just trigger request on not determined
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
    // Set initial values
    if let Ok(mut state) = LOCATION_STATE.lock() {
        state.coord = None;
        state.finished = false;
    }

    unsafe {
        let manager: Retained<CLLocationManager> = CLLocationManager::new();
        // allocate and init delegate
        let delegate = RustCLDelegate::alloc();
        let delegate: Retained<RustCLDelegate> = msg_send![delegate, init];
        // set delegate (CLLocationManager expects a ProtocolObject)
        let proto: Retained<ProtocolObject<dyn CLLocationManagerDelegate>> =
            ProtocolObject::from_retained(delegate);
        manager.setDelegate(Some(&*proto));

        // Check current authorization
        let status = manager.authorizationStatus();
        if status == CLAuthorizationStatus::NotDetermined {
            manager.requestWhenInUseAuthorization();
        } else if status == CLAuthorizationStatus::Denied
            || status == CLAuthorizationStatus::Restricted
        {
            return None;
        } else {
            manager.requestLocation();
        }

        let start = Instant::now();
        let timeout = Duration::from_secs(3); // Reduce timeout to 3 seconds
        let poll_interval = Duration::from_millis(50); // Poll more frequently

        // Run the run loop until we have a coordinate or timeout
        while start.elapsed() < timeout {
            // Check if we have location data yet
            if let Ok(st) = LOCATION_STATE.lock() {
                if st.finished {
                    if let Some((lat, lon)) = st.coord {
                        return Some(LocationInfo::new(format!("{lat},{lon}"), None));
                    }
                    return None;
                }
            }

            // Process events for a short time
            let rl = NSRunLoop::currentRunLoop();
            let date = NSDate::dateWithTimeIntervalSinceNow(poll_interval.as_secs_f64());
            rl.runMode_beforeDate(objc2_foundation::NSDefaultRunLoopMode, &date);
        }
    }
    None
}

#[derive(Deserialize)]
struct IpApiResponse {
    loc: Option<String>,
    city: Option<String>,
    timezone: Option<String>,
}

#[derive(Deserialize)]
struct IpInfoResponse {
    loc: Option<String>,
    city: Option<String>,
    timezone: Option<String>,
}

async fn get_location_from_ipapi() -> Option<LocationInfo> {
    // Fix the double ?? operator issue by handling the Result properly
    let timeout_result = timeout(
        Duration::from_secs(3),
        client().get("https://ipapi.co/json/").send(),
    )
    .await;

    // First handle the timeout Result
    let send_result = match timeout_result {
        Ok(result) => result,
        Err(_) => return None,
    };

    // Then handle the request Result
    let resp = match send_result {
        Ok(resp) => resp,
        Err(_) => return None,
    };

    let api_data: IpApiResponse = resp.json().await.ok()?;
    let loc = api_data.loc?;

    // Prefer explicit city if present, otherwise try timezone split
    let city = api_data.city.or_else(|| {
        api_data
            .timezone
            .and_then(|tz| tz.split('/').next_back().map(|s| s.replace('_', " ")))
    });

    Some(LocationInfo::new(loc, city))
}

async fn get_location_from_ipinfo() -> Option<LocationInfo> {
    // Fix the double ?? operator issue by handling the Result properly
    let timeout_result = timeout(
        Duration::from_secs(3),
        client().get("https://ipinfo.io/json").send(),
    )
    .await;

    // First handle the timeout Result
    let send_result = match timeout_result {
        Ok(result) => result,
        Err(_) => return None,
    };

    // Then handle the request Result
    let resp = match send_result {
        Ok(resp) => resp,
        Err(_) => return None,
    };

    let api_data: IpInfoResponse = resp.json().await.ok()?;
    let loc = api_data.loc?;

    // Prefer explicit city if present, otherwise try timezone split
    let city = api_data.city.or_else(|| {
        api_data
            .timezone
            .and_then(|tz| tz.split('/').next_back().map(|s| s.replace('_', " ")))
    });

    Some(LocationInfo::new(loc, city))
}

async fn get_location_from_ip() -> Option<LocationInfo> {
    // Try both services in parallel and take the first successful response
    let (ipapi, ipinfo) = tokio::join!(get_location_from_ipapi(), get_location_from_ipinfo());

    ipapi.or(ipinfo)
}

#[derive(Serialize, Deserialize)]
struct WeatherData {
    #[serde(skip_serializing_if = "Option::is_none")]
    name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(rename = "resolvedAddress")]
    resolved_address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    feels_like: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    moon_phase: Option<f64>,
    conditions: String,
    description: String,
    icon: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    temp: Option<f64>,
    location: String,
    city: String,
}

#[derive(Deserialize)]
struct WeatherResponse {
    timezone: Option<String>,
    #[serde(rename = "currentConditions")]
    current_conditions: Option<CurrentConditions>,
    days: Option<Vec<DayForecast>>,
    name: Option<String>,
    address: Option<String>,
    #[serde(rename = "resolvedAddress")]
    resolved_address: Option<String>,
}

#[derive(Deserialize)]
struct CurrentConditions {
    temp: Option<f64>,
    feelslike: Option<f64>,
    conditions: Option<String>,
    icon: Option<String>,
    description: Option<String>,
}

#[derive(Deserialize)]
struct DayForecast {
    icon: Option<String>,
    description: Option<String>,
    moonphase: Option<f64>,
}

async fn update(key: &str, location: &LocationInfo) -> Result<(), Box<dyn Error>> {
    // Use const strings where possible to avoid allocations
    const BASE_URL: &str =
        "https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline";
    const ELEMENTS: &str =
        "name,address,resolvedAddress,feelslike,moonphase,conditions,description,icon";
    const INCLUDE: &str = "alerts,current,fcst,days";

    // Build the URL
    let encoded_loc = urlencoding::encode(&location.query);
    let url = format!(
        "{BASE_URL}/{encoded_loc}/today?key={key}&unitGroup=metric&elements={ELEMENTS}&include={INCLUDE}&iconSet=icons2&contentType=json"
    );

    eprintln!("Fetching weather data (today) for {}...", location.query);

    // Use the cached client for better connection reuse
    let resp = client()
        .get(&url)
        .timeout(Duration::from_secs(5))
        .send()
        .await?
        .error_for_status()?;

    // Parse JSON directly into our struct
    let weather: WeatherResponse = resp.json().await?;

    if let Some(tz) = &weather.timezone {
        eprintln!("Timezone: {tz}");
    }

    // Extract data with more efficient processing
    let current = weather.current_conditions.as_ref();
    let first_day = weather.days.as_ref().and_then(|days| days.first());

    // Get the city, prioritizing existing value
    let city = location
        .city
        .clone()
        .unwrap_or_else(|| location.query.clone());

    // Build structured data with all fields
    let data = WeatherData {
        name: weather.name,
        address: weather.address,
        resolved_address: weather.resolved_address,
        feels_like: current
            .and_then(|c| c.feelslike)
            .or_else(|| current.and_then(|c| c.temp)),
        moon_phase: first_day.and_then(|d| d.moonphase),
        conditions: current
            .and_then(|c| c.conditions.clone())
            .unwrap_or_default(),
        description: current
            .and_then(|c| c.description.clone())
            .or_else(|| first_day.and_then(|d| d.description.clone()))
            .unwrap_or_default(),
        icon: current
            .and_then(|c| c.icon.clone())
            .or_else(|| first_day.and_then(|d| d.icon.clone()))
            .unwrap_or_default(),
        temp: current.and_then(|c| c.temp),
        location: location.query.clone(),
        city,
    };

    // Serialize to JSON directly
    let data_str = serde_json::to_string(&data)?;

    // Build the sketchybar trigger argument
    let weather_arg = format!("WEATHER={data_str}");

    // Use tokio::process for the external command
    let status = tokio::process::Command::new("sketchybar-bottom")
        .arg("--trigger")
        .arg("weather_changed")
        .arg(&weather_arg)
        .status()
        .await?;

    if !status.success() {
        eprintln!("sketchybar-bottom exited with: {status:?}");
    }

    Ok(())
}
