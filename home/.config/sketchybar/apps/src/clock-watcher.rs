use chrono::Local;
use std::error::Error;
use std::time::Duration;
use tokio::time;

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    println!("Starting clock event emitter for sketchybar-top...");

    loop {
        // Get current time using chrono
        let now = Local::now();

        // Format similar to Lua's os.date("%a %b %d %H:%M:%S")
        let time_str = now.format("%a  %b %d  %H:%M:%S").to_string();

        // Format the argument for sketchybar-top
        let time_arg = format!("TIME={time_str}");

        // Use tokio::process for the external command
        let status = tokio::process::Command::new("sketchybar-top")
            .arg("--trigger")
            .arg("os_time_changed")
            .arg(&time_arg)
            .status()
            .await;

        println!("Dispatched time update: {time_str}");

        match status {
            Ok(exit_status) => {
                if !exit_status.success() {
                    eprintln!("sketchybar-top command failed with exit code: {exit_status:?}");
                }
            }
            Err(e) => {
                eprintln!("Failed to execute sketchybar-top: {e}");
            }
        }

        // Sleep for one second before the next update
        time::sleep(Duration::from_secs(1)).await;
    }
}
