use objc2::rc::Retained;
use objc2::{ClassType, msg_send};
use objc2_app_kit::{NSEvent, NSScreen};
use objc2_foundation::{NSArray, NSPoint, NSRect};
use std::{
    process::{Command, Stdio},
    thread,
    time::Duration,
};

fn is_menu_bar_visible(is_visible: bool) -> bool {
    unsafe {
        // First, check if any screen has a visible menubar (frame difference)
        let screens: Retained<NSArray<NSScreen>> = msg_send![NSScreen::class(), screens];
        let count: usize = msg_send![&*screens, count];

        // Get mouse location once - avoid redundant system calls
        let mouse_loc: NSPoint = msg_send![NSEvent::class(), mouseLocation];
        let visible_threshold = if is_visible { 30.0 } else { 2.0 };

        // Variables to track if we found the screen the mouse is on
        let mut mouse_screen_index = None;

        // Check all screens for visible menubar and find which screen the mouse is on
        for i in 0..count {
            let screen: *const NSScreen = msg_send![&*screens, objectAtIndex: i];
            let frame: NSRect = msg_send![screen, frame];

            // Check if menubar is visible (not auto-hidden)
            let visible_frame: NSRect = msg_send![screen, visibleFrame];
            if visible_frame.origin.y + visible_frame.size.height
                < frame.origin.y + frame.size.height
            {
                return true;
            }

            // Check if mouse is within this screen's bounds
            let is_mouse_on_screen = mouse_loc.x >= frame.origin.x
                && mouse_loc.x <= frame.origin.x + frame.size.width
                && mouse_loc.y >= frame.origin.y
                && mouse_loc.y <= frame.origin.y + frame.size.height;

            if is_mouse_on_screen {
                // Check if mouse is near the top of this screen
                if mouse_loc.y >= (frame.origin.y + frame.size.height - visible_threshold) {
                    return true;
                }
                mouse_screen_index = Some(i);
            }
        }

        // If we found which screen the mouse is on but it's not at the top,
        // we can confidently say the menubar is not visible
        if mouse_screen_index.is_some() {
            return false;
        }

        // If mouse isn't on any screen, maintain the previous state
        is_visible
    }
}

// Command handler for sketchybar
struct SketchybarCommands {}

impl SketchybarCommands {
    const fn new() -> Self {
        Self {}
    }

    fn trigger(&self, is_visible: bool) {
        let menubar_arg = format!("MENUBAR={is_visible}");

        // Use spawn and ignore output for faster execution
        // We don't need to wait for command completion
        if let Err(e) = Command::new("sketchybar-top")
            .arg("--trigger")
            .arg("menubar_visibility_changed")
            .arg(&menubar_arg)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
        {
            eprintln!("Failed to trigger menubar_visibility_changed: {e}");
        }
    }
}

fn main() {
    println!("Starting MenuBar Watcher...");

    // Initialize the command cache
    let commands = SketchybarCommands::new();
    let mut last_state = is_menu_bar_visible(false);

    // Notify initial state
    commands.trigger(last_state);

    // Define sleep durations
    const ACTIVE_SLEEP: Duration = Duration::from_millis(16); // ~60fps for active state changes
    const IDLE_SLEEP: Duration = Duration::from_millis(200); // Maximum sleep during idle
    const NORMAL_SLEEP: Duration = Duration::from_millis(50); // Default sleep

    let mut sleep_duration = NORMAL_SLEEP;
    let mut unchanged_count = 0;

    // Main monitoring loop
    loop {
        // Get current state - use last state as hint
        let current = is_menu_bar_visible(last_state);

        if current != last_state {
            // State changed - use faster refresh rate
            if unchanged_count > 0 {
                println!("MenuBar visibility changed: {last_state} -> {current}");
            }

            commands.trigger(current);
            last_state = current;
            sleep_duration = ACTIVE_SLEEP;
            unchanged_count = 0;
        } else {
            // State unchanged - gradually increase sleep time for efficiency
            unchanged_count += 1;

            if unchanged_count == 10 {
                // After brief stability, use normal rate
                sleep_duration = NORMAL_SLEEP;
            } else if unchanged_count == 100 {
                // After longer stability, use idle rate
                sleep_duration = IDLE_SLEEP;
            }
        }

        thread::sleep(sleep_duration);
    }
}
