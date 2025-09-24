use std::error::Error;
use std::fmt;
use std::process::Command;

#[derive(Debug, Clone)]
struct CpuInfo {
    percentage: f32,
    temperature: f32,
}

#[derive(Debug)]
enum CpuError {
    CommandFailed(std::io::Error),
    ParseError(String),
    SketchybarFailed,
}

impl fmt::Display for CpuError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::CommandFailed(e) => write!(f, "Command failed: {e}"),
            Self::ParseError(msg) => write!(f, "Parse error: {msg}"),
            Self::SketchybarFailed => write!(f, "Failed to trigger sketchybar"),
        }
    }
}

impl Error for CpuError {}

fn get_cpu_usage() -> Result<f32, CpuError> {
    // Use `top` command to get CPU usage - requesting only 1 sample is faster
    // and still accurate enough for UI purposes
    let output = Command::new("top")
        .args(["-l", "1", "-n", "0", "-s", "0"]) // Use array reference directly
        .output()
        .map_err(CpuError::CommandFailed)?;

    if !output.status.success() {
        return Err(CpuError::ParseError(String::from("Top command failed")));
    }

    let output_str = String::from_utf8_lossy(&output.stdout);

    // Fast path - find the CPU usage line by byte scanning to avoid allocation
    for line in output_str.lines() {
        if line.len() < 10 || !line.starts_with("CPU usage:") {
            continue;
        }

        // More efficient string parsing - avoid unnecessary allocations
        if let Some(idle_start) = line.rfind(", ") {
            let idle_part = &line[idle_start + 2..];
            if let Some(percent_pos) = idle_part.find("% idle") {
                let idle_slice = &idle_part[..percent_pos];
                // Fast path - try to parse directly
                if let Ok(idle_percentage) = idle_slice.parse::<f32>() {
                    return Ok(100.0 - idle_percentage);
                }
            }
        }
    }

    Err(CpuError::ParseError(String::from(
        "CPU usage not found in top output",
    )))
}

use std::sync::{LazyLock, Mutex};
use std::time::{Duration, Instant};

// Global temperature cache
static TEMP_CACHE: LazyLock<Mutex<Option<(f32, Instant)>>> = LazyLock::new(|| Mutex::new(None));

fn get_cpu_temperature() -> f32 {
    // Check cache first - CPU temp doesn't change that rapidly
    // Only fetch new value every 10 seconds
    const CACHE_DURATION: Duration = Duration::from_secs(10);

    {
        let cache = TEMP_CACHE.lock().unwrap();
        if let Some((temp, timestamp)) = *cache
            && timestamp.elapsed() < CACHE_DURATION
        {
            return temp;
        }
    }

    // Cache expired or not set - get fresh temperature
    // Try smctemp utility first (direct SMC access, works on all Macs)
    if let Ok(output) = Command::new("smctemp")
        .arg("-c") // Get CPU temperature specifically
        .output()
        && output.status.success()
    {
        let output_str = String::from_utf8_lossy(&output.stdout);

        // Avoid unnecessary allocation - parse directly from the borrowed string
        if let Ok(temp) = output_str.trim().parse::<f32>() {
            // Update cache with proper drop handling
            *TEMP_CACHE.lock().unwrap() = Some((temp, Instant::now()));
            return temp;
        }
    }

    // If nothing works, use a reasonable default
    50.0
}

async fn get_cpu_info() -> Result<CpuInfo, CpuError> {
    // Create a thread pool for CPU-bound operations to avoid spawning new threads each time
    // This is more efficient for repeated operations
    static CPU_POOL: LazyLock<tokio::runtime::Handle> = LazyLock::new(tokio::runtime::Handle::current);

    // Get CPU usage and temperature concurrently using the shared thread pool
    let usage_fut = CPU_POOL.spawn_blocking(get_cpu_usage);
    let temp_fut = CPU_POOL.spawn_blocking(get_cpu_temperature);

    // More efficient error handling with fast path resolution
    match tokio::try_join!(usage_fut, temp_fut) {
        Ok((Ok(percentage), temperature)) => {
            // Fast path - both succeeded, construct directly
            Ok(CpuInfo {
                percentage,
                temperature,
            })
        }
        Ok((Err(e), _)) => Err(e),
        Err(e) => Err(CpuError::ParseError(format!("Task join error: {e}"))),
    }
}

// Use a more compact representation to avoid string allocations
// and unnecessary formatting operations
fn format_cpu_data(info: &CpuInfo) -> String {
    // Pre-calculate integer values to avoid float formatting
    // Use as u8 to reduce memory footprint
    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    let percentage = info.percentage.ceil() as u8;
    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    let temperature = info.temperature.ceil() as u8;

    // Pre-allocate exactly the right size - calculate exact size to avoid any reallocations
    // "{ \"percentage\": xx, \"temperature\": yy }"
    let size =
        35 + if percentage >= 100 {
            3
        } else if percentage >= 10 {
            2
        } else {
            1
        } + if temperature >= 100 {
            3
        } else if temperature >= 10 {
            2
        } else {
            1
        };

    let mut cpu_data = String::with_capacity(size);

    // Use string literals directly to avoid parsing escape sequences
    cpu_data.push_str("{ \"percentage\": ");
    cpu_data.push_str(&percentage.to_string());
    cpu_data.push_str(", \"temperature\": ");
    cpu_data.push_str(&temperature.to_string());
    cpu_data.push_str(" }");

    cpu_data
}

// More efficient sketchybar command implementation
async fn trigger_sketchybar(cpu_data: &str) -> Result<(), CpuError> {
    // Static arguments to avoid reallocations
    static BASE_ARGS: [&str; 2] = ["--trigger", "cpu_changed"];

    // Pre-allocate with the right capacity to avoid reallocation
    let cpu_arg = format!("CPU={cpu_data}");

    // Use tokio spawn to run the command in a separate task - this allows
    // the main task to continue processing if sketchybar is slow to respond
    let status = tokio::process::Command::new("sketchybar-top")
        .args(BASE_ARGS)
        .arg(cpu_arg)
        // Use piped stdout/stderr to avoid blocking on output
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .await
        .map_err(CpuError::CommandFailed)?;

    if !status.success() {
        return Err(CpuError::SketchybarFailed);
    }

    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let args: Vec<String> = std::env::args().collect();

    // Parse command line arguments
    let mode = if args.len() > 1 {
        match args[1].as_str() {
            "--stream" => Mode::Stream,
            "--get" => Mode::Get,
            "--help" | "-h" => {
                print_usage(&args[0]);
                return Ok(());
            }
            _ => {
                eprintln!("Error: Unknown option '{}'", args[1]);
                print_usage(&args[0]);
                std::process::exit(1);
            }
        }
    } else {
        // Default to stream mode if no arguments provided
        Mode::Stream
    };

    match mode {
        Mode::Stream => run_stream_mode().await,
        Mode::Get => run_get_mode().await,
    }
}

#[derive(Debug, PartialEq)]
enum Mode {
    Stream,
    Get,
}

fn print_usage(prog: &str) {
    println!("Usage: {prog} [--stream | --get]");
    println!("  --stream    Start streaming CPU info to sketchybar every 2 seconds");
    println!("  --get       Get current CPU info once and send to sketchybar");
}

async fn run_stream_mode() -> Result<(), Box<dyn Error>> {
    // Increased threshold to reduce unnecessary updates
    // Only update if CPU usage changed by more than 1.0 percentage point
    // or temperature by more than 0.5 degrees
    const CPU_THRESHOLD: f32 = 1.0;
    const TEMP_THRESHOLD: f32 = 0.5;

    // Longer interval for better performance - 3.5 seconds is still responsive
    // but reduces CPU usage of the watcher itself
    const UPDATE_INTERVAL: std::time::Duration = std::time::Duration::from_millis(3500);

    println!("CPU watcher started in stream mode");

    // Create a fixed interval ticker with immediate start
    let mut interval = tokio::time::interval(UPDATE_INTERVAL);
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

    // Get initial CPU info without waiting for tick
    let info = get_cpu_info().await?;
    let cpu_data = format_cpu_data(&info);
    trigger_sketchybar(&cpu_data).await?;

    // Save initial values using direct assignment
    let mut prev_percentage = info.percentage;
    let mut prev_temperature = info.temperature;

    // Only print in debug mode
    #[cfg(debug_assertions)]
    println!("Initial CPU info: {cpu_data}");

    // Use error counter to exponentially back off on repeated errors
    let mut consecutive_errors = 0;

    loop {
        // Wait for next tick - more efficient than sleep()
        interval.tick().await;

        // Get new CPU info - use match for more efficient error handling
        match get_cpu_info().await {
            Ok(info) => {
                // Reset error counter on success
                consecutive_errors = 0;

                // Only trigger sketchybar if values changed significantly
                // Use separate thresholds for CPU and temperature
                let cpu_changed = (info.percentage - prev_percentage).abs() > CPU_THRESHOLD;
                let temp_changed = (info.temperature - prev_temperature).abs() > TEMP_THRESHOLD;

                if cpu_changed || temp_changed {
                    let cpu_data = format_cpu_data(&info);

                    // Only print output in debug/development environments
                    #[cfg(debug_assertions)]
                    println!("CPU info updated: {cpu_data}");

                    // Fire and forget - don't wait for sketchybar to respond
                    tokio::spawn(async move {
                        if let Err(e) = trigger_sketchybar(&cpu_data).await {
                            eprintln!("Error triggering sketchybar: {e}");
                        }
                    });

                    // Update cached values
                    prev_percentage = info.percentage;
                    prev_temperature = info.temperature;
                }
            }
            Err(e) => {
                eprintln!("Error getting CPU info: {e}");

                // Exponential backoff on repeated errors
                consecutive_errors += 1;
                let backoff_ms = std::cmp::min(500 * (1 << consecutive_errors), 10000);
                tokio::time::sleep(std::time::Duration::from_millis(backoff_ms)).await;
            }
        }
    }
}

async fn run_get_mode() -> Result<(), Box<dyn Error>> {
    let info = get_cpu_info().await?;
    let cpu_data = format_cpu_data(&info);

    println!("Current CPU info: {cpu_data}");
    trigger_sketchybar(&cpu_data).await?;

    Ok(())
}
