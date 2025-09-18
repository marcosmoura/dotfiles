#![allow(deprecated)]

use cocoa::appkit::{NSEvent, NSScreen};
use cocoa::base::{id, nil};
use cocoa::foundation::NSAutoreleasePool;
use std::{process::Command, thread, time::Duration};

fn is_menu_bar_visible() -> bool {
    unsafe {
        let screen: id = NSScreen::mainScreen(nil);
        if screen == nil {
            return false;
        }

        let visible_frame: cocoa::foundation::NSRect = cocoa::appkit::NSView::frame(screen);
        let full_frame: cocoa::foundation::NSRect = cocoa::appkit::NSWindow::frame(screen);

        if visible_frame.origin.y + visible_frame.size.height
            < full_frame.origin.y + full_frame.size.height
        {
            return true;
        }

        // If auto-hide, check mouse location near top
        let mouse_loc = NSEvent::mouseLocation(nil);
        let main_frame = cocoa::appkit::NSWindow::frame(screen);
        let relative_y = mouse_loc.y;
        relative_y >= (main_frame.size.height - 3.0)
    }
}

fn trigger_sketchybar_event(is_visible: bool) {
    let event_name = if is_visible {
        "menubar_is_visible"
    } else {
        "menubar_is_hidden"
    };
    let command = format!("sketchybar-top --trigger {}", event_name);
    let output = Command::new("/bin/sh").arg("-c").arg(&command).output();

    match output {
        Ok(o) => {
            if !o.status.success() {
                eprintln!("Command failed: {}", command);
            }
        }
        Err(e) => eprintln!("Failed to run command: {}", e),
    }
}

fn main() {
    unsafe {
        let _pool = NSAutoreleasePool::new(nil);
        println!("Starting MenuBar Watcher...");

        let mut last_state = is_menu_bar_visible();

        loop {
            let current = is_menu_bar_visible();
            if current != last_state {
                println!("MenuBar visibility changed: {} -> {}", last_state, current);
                trigger_sketchybar_event(current);
                last_state = current;
            }
            thread::sleep(Duration::from_millis(50));
        }
    }
}
