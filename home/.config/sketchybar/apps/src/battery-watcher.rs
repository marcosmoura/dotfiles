use std::env;
use std::error::Error;
use std::fmt;
use std::process::Command;
use std::thread;
use std::time::Duration;

#[derive(Debug, PartialEq, Clone, Copy)]
enum BatteryStatus {
    Charging,
    Discharging,
    Full,
}

impl BatteryStatus {
    const fn as_str(self) -> &'static str {
        match self {
            Self::Charging => "charging",
            Self::Discharging => "discharging",
            Self::Full => "full",
        }
    }
}

#[derive(Debug, PartialEq, Clone)]
struct BatteryInfo {
    level: u8,
    status: BatteryStatus,
    time_remaining: Option<String>,
}

#[derive(Debug)]
enum BatteryError {
    CommandFailed(std::io::Error),
    InvalidUtf8,
    ParseError(String),
    SketchybarFailed,
}

impl fmt::Display for BatteryError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::CommandFailed(e) => write!(f, "Command failed: {}", e),
            Self::InvalidUtf8 => write!(f, "Invalid UTF-8 in command output"),
            Self::ParseError(msg) => write!(f, "Parse error: {}", msg),
            Self::SketchybarFailed => write!(f, "Failed to trigger sketchybar"),
        }
    }
}

impl Error for BatteryError {}

fn get_battery_info() -> Result<BatteryInfo, BatteryError> {
    // Get battery percentage using macOS pmset command
    let output = Command::new("pmset")
        .arg("-g")
        .arg("batt")
        .output()
        .map_err(BatteryError::CommandFailed)?;

    let output_str = std::str::from_utf8(&output.stdout).map_err(|_| BatteryError::InvalidUtf8)?;

    // Parse both level and status in a single pass
    parse_battery_info(output_str)
}

fn parse_battery_info(output: &str) -> Result<BatteryInfo, BatteryError> {
    let mut level = None;
    let mut status = None;
    let mut time_remaining = None;

    // Parse in a single pass through the lines
    for line in output.lines() {
        // Skip lines that don't contain battery info
        if !line.contains('%') {
            continue;
        }

        // Find percentage
        if level.is_none() {
            for word in line.split_whitespace() {
                // Handle both "100%" and "100%;" formats
                let percent_str = if let Some(s) = word.strip_suffix("%;") {
                    s
                } else if let Some(s) = word.strip_suffix('%') {
                    s
                } else {
                    continue;
                };

                level = Some(percent_str.parse::<u8>().map_err(|_| {
                    BatteryError::ParseError("Invalid battery percentage".to_string())
                })?);
                break;
            }
        }

        // Parse time remaining
        if time_remaining.is_none()
            && let Some(remaining_pos) = line.find(" remaining")
        {
            // Look backwards from " remaining" to find the time pattern
            let before_remaining = &line[..remaining_pos];
            if let Some(time_start) = before_remaining.rfind(' ') {
                let time_str = &before_remaining[time_start + 1..];
                // Validate it looks like a time format (contains ':')
                if time_str.contains(':') {
                    time_remaining = Some(time_str.to_string());
                }
            }
        }

        // Determine status based on keywords (case-insensitive check without allocation)
        if status.is_none() {
            // Use ASCII case-insensitive matching for better performance
            let line_bytes = line.as_bytes();
            if contains_ignore_ascii_case(line_bytes, b"charging") {
                status = Some(BatteryStatus::Charging);
            } else if contains_ignore_ascii_case(line_bytes, b"discharging")
                || contains_ignore_ascii_case(line_bytes, b"battery power")
            {
                status = Some(BatteryStatus::Discharging);
            } else if contains_ignore_ascii_case(line_bytes, b"charged")
                || (contains_ignore_ascii_case(line_bytes, b"ac power")
                    && !contains_ignore_ascii_case(line_bytes, b"discharging"))
            {
                status = Some(BatteryStatus::Full);
            }
        }

        // Early exit if we have all values
        if level.is_some() && status.is_some() && time_remaining.is_some() {
            break;
        }
    }

    let level = level
        .ok_or_else(|| BatteryError::ParseError("Battery percentage not found".to_string()))?;
    let status =
        status.ok_or_else(|| BatteryError::ParseError("Battery status not found".to_string()))?;

    if level > 100 {
        return Err(BatteryError::ParseError(
            "Invalid battery level".to_string(),
        ));
    }

    Ok(BatteryInfo {
        level,
        status,
        time_remaining,
    })
}

// Fast ASCII case-insensitive substring search
fn contains_ignore_ascii_case(haystack: &[u8], needle: &[u8]) -> bool {
    if needle.is_empty() {
        return true;
    }
    if haystack.len() < needle.len() {
        return false;
    }

    for i in 0..=haystack.len() - needle.len() {
        let mut matches = true;
        for j in 0..needle.len() {
            if !haystack[i + j].eq_ignore_ascii_case(&needle[j]) {
                matches = false;
                break;
            }
        }
        if matches {
            return true;
        }
    }
    false
}

fn format_battery_data(info: &BatteryInfo) -> String {
    // Pre-allocate string with estimated capacity to avoid reallocations
    let mut result = String::with_capacity(64);
    result.push_str("{ \"level\": ");
    result.push_str(&info.level.to_string());
    result.push_str(", \"status\": \"");
    result.push_str(info.status.as_str());
    result.push('"');

    if let Some(time) = &info.time_remaining {
        result.push_str(", \"time_remaining\": \"");
        result.push_str(time);
        result.push('"');
    }

    result.push_str(" }");
    result
}

fn trigger_sketchybar(battery_data: &str) -> Result<(), BatteryError> {
    // Pre-allocate string to avoid reallocations
    let mut battery_arg = String::with_capacity(8 + battery_data.len());
    battery_arg.push_str("BATTERY=");
    battery_arg.push_str(battery_data);

    let status = Command::new("sketchybar-top")
        .arg("--trigger")
        .arg("battery_level_changed")
        .arg(&battery_arg)
        .status()
        .map_err(BatteryError::CommandFailed)?;

    if !status.success() {
        return Err(BatteryError::SketchybarFailed);
    }

    Ok(())
}

fn main() -> Result<(), BatteryError> {
    let args: Vec<String> = env::args().collect();
    let prog = &args[0];

    // Parse command line arguments
    let mode = if args.len() > 1 {
        match args[1].as_str() {
            "--stream" => Mode::Stream,
            "--get" => Mode::Get,
            "--help" | "-h" => {
                print_usage(prog);
                return Ok(());
            }
            _ => {
                eprintln!("Error: Unknown option '{}'", args[1]);
                print_usage(prog);
                std::process::exit(1);
            }
        }
    } else {
        // Default to stream mode if no arguments provided
        Mode::Stream
    };

    match mode {
        Mode::Stream => run_stream_mode(),
        Mode::Get => run_get_mode(),
    }
}

#[derive(Debug, PartialEq)]
enum Mode {
    Stream,
    Get,
}

fn print_usage(prog: &str) {
    println!("Usage: {} [--stream | --get]", prog);
    println!("  --stream    Start streaming battery info to sketchybar");
    println!("  --get       Get current battery info once and send to sketchybar");
}

fn run_stream_mode() -> Result<(), BatteryError> {
    println!("Battery watcher started in stream mode");

    let mut last_info = get_battery_info()?;
    let battery_data = format_battery_data(&last_info);
    trigger_sketchybar(&battery_data)?;

    loop {
        // Check battery status every 30 seconds
        thread::sleep(Duration::from_secs(30));

        match get_battery_info() {
            Ok(info) => {
                // Only trigger if the battery level, status, or time remaining changed
                if info != last_info {
                    let battery_data = format_battery_data(&info);

                    println!("Battery change detected: {}", battery_data);

                    if let Err(e) = trigger_sketchybar(&battery_data) {
                        eprintln!("Error triggering sketchybar: {}", e);
                    }

                    last_info = info;
                }
            }
            Err(e) => {
                eprintln!("Error getting battery info: {}", e);
            }
        }
    }
}

fn run_get_mode() -> Result<(), BatteryError> {
    let info = get_battery_info()?;
    let battery_data = format_battery_data(&info);

    println!("Current battery info: {}", battery_data);
    trigger_sketchybar(&battery_data)?;

    Ok(())
}
