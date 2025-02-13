mod color;
mod frames;
mod indicator;
mod session;
mod tabs;
mod view;

use std::{
    cmp::{max, min},
    collections::BTreeMap,
};

use session::DateTime;
use view::Error;
use zellij_tile::prelude::*;

use crate::{
    frames::Frames,
    indicator::Indicator,
    session::Session,
    tabs::Tabs,
    view::{Bg, Spacer},
};

#[derive(Default)]
struct State {
    tabs: Vec<TabInfo>,
    active_tab_idx: usize,
    mode_info: ModeInfo,
    panes: PaneManifest,
    mouse_click_pos: usize,
    should_change_tab: bool,
    datetime: String,
}

register_plugin!(State);

impl ZellijPlugin for State {
    fn load(&mut self, configuration: BTreeMap<String, String>) {
        eprintln!("Loaded with configuration: {:#?}", configuration);

        request_permission(&[
            PermissionType::ReadApplicationState,
            PermissionType::ChangeApplicationState,
        ]);

        set_selectable(true); // selectable b/c we need a user input to grant the permissions
        set_timeout(1.0);

        subscribe(&[
            EventType::ModeUpdate,
            EventType::Mouse,
            EventType::PaneUpdate,
            EventType::PermissionRequestResult,
            EventType::SessionUpdate,
            EventType::TabUpdate,
            EventType::Timer,
        ]);
    }

    fn update(&mut self, event: Event) -> bool {
        let mut should_render = false;

        match event {
            Event::PermissionRequestResult(status) => match status {
                PermissionStatus::Granted => {
                    set_selectable(false);
                }
                PermissionStatus::Denied => {
                    eprintln!("Permission denied.");
                }
            },
            Event::ModeUpdate(mode_info) => {
                should_render = self.mode_info != mode_info;
                self.mode_info = mode_info;
            }
            Event::PaneUpdate(panes) => {
                self.panes = panes;
                Frames::hide_frames_conditionally(
                    &self.panes,
                    &self.tabs,
                    &self.mode_info,
                    get_plugin_ids(),
                );
            }
            Event::SessionUpdate(session_info, _) => {
                let current_session = session_info.iter().find(|s| s.is_current_session);

                self.panes = current_session.unwrap().panes.clone();
                self.tabs = current_session.unwrap().tabs.clone();

                Frames::hide_frames_conditionally(
                    &self.panes,
                    &self.tabs,
                    &self.mode_info,
                    get_plugin_ids(),
                );
            }
            Event::TabUpdate(tabs) => {
                if let Some(active_tab_index) = tabs.iter().position(|t| t.active) {
                    // tabs are indexed starting from 1 so we need to add 1
                    let active_tab_idx = active_tab_index + 1;

                    should_render = self.active_tab_idx != active_tab_idx || self.tabs != tabs;
                    self.active_tab_idx = active_tab_idx;
                    self.tabs = tabs;
                } else {
                    eprintln!("Could not find active tab.");
                }
            }
            Event::Mouse(event) => match event {
                Mouse::LeftClick(_, col) => {
                    if self.mouse_click_pos != col {
                        should_render = true;
                        self.should_change_tab = true;
                    }
                    self.mouse_click_pos = col;
                }
                Mouse::ScrollUp(_) => {
                    should_render = true;
                    switch_tab_to(min(self.active_tab_idx + 1, self.tabs.len()) as u32);
                }
                Mouse::ScrollDown(_) => {
                    should_render = true;
                    switch_tab_to(max(self.active_tab_idx.saturating_sub(1), 1) as u32);
                }
                _ => {}
            },
            Event::Timer(_) => {
                let datetime = DateTime::render();
                should_render = datetime != self.datetime;
                self.datetime = datetime;

                set_timeout(1.0);
            }
            _ => {
                eprintln!("Unexpected event: {:?}", event);
            }
        };

        should_render
    }

    fn render(&mut self, _rows: usize, cols: usize) {
        if self.tabs.is_empty() {
            return;
        }

        let session_name = &self.mode_info.session_name;
        let mode = self.mode_info.mode;
        let palette = self.mode_info.style.colors;

        let mut indicator = Indicator::render(mode, palette);
        let tabs = Tabs::render(&self.tabs, mode, palette);
        let mut session = Session::render(session_name.as_deref(), mode, palette);
        let pad = Bg::render(2, palette);

        let mut blocks = Vec::with_capacity(cols);
        let occupied = indicator.len + tabs.len + session.len + (pad.len * 2);

        blocks.append(&mut indicator.blocks);
        blocks.push(pad.clone());

        let (mut mid, spacer) = if occupied > cols {
            let error = Error::render(
                "WHOA, YOU LIKE TABS DON'T YOU. IT'S TIME TO HANDLE IT.",
                palette,
            );

            let parts_len = (indicator.len + pad.len, error.len, session.len + pad.len);

            let spacer = Spacer::render(cols, parts_len, palette);

            (vec![error], spacer)
        } else {
            let parts_len = (indicator.len + pad.len, tabs.len, session.len + pad.len);

            let spacer = Spacer::render(cols, parts_len, palette);

            (tabs.blocks, spacer)
        };

        match spacer {
            Spacer {
                left: Some(left),
                right: Some(right),
            } => {
                blocks.push(left);
                blocks.append(&mut mid);
                blocks.push(right);
            }
            Spacer {
                left: Some(left),
                right: None,
            } => {
                blocks.push(left);
                blocks.append(&mut mid);
            }
            Spacer {
                left: None,
                right: Some(right),
            } => {
                blocks.append(&mut mid);
                blocks.push(right);
            }
            Spacer {
                left: None,
                right: None,
            } => {
                // come what may
                blocks.append(&mut mid);
            }
        }

        blocks.push(pad);
        blocks.append(&mut session.blocks);

        let mut bar = String::new();
        let mut cursor = 0;

        for block in blocks {
            bar = format!("{}{}", bar, block.body);

            if let Some(idx) = block.tab_index {
                if self.should_change_tab
                    && self.mouse_click_pos >= cursor
                    && self.mouse_click_pos < cursor + block.len
                {
                    // Tabs are indexed starting from 1, therefore we need add 1 to idx
                    let tab_index = idx + 1;
                    switch_tab_to(tab_index as u32);
                }
            }

            cursor += block.len;
        }

        let bg = match palette.theme_hue {
            ThemeHue::Dark => palette.black,
            ThemeHue::Light => palette.white,
        };

        match bg {
            PaletteColor::Rgb((r, g, b)) => {
                print!("{}\u{1b}[48;2;{};{};{}m\u{1b}[0K", bar, r, g, b);
            }
            PaletteColor::EightBit(color) => {
                print!("{}\u{1b}[48;5;{}m\u{1b}[0K", bar, color);
            }
        }

        self.should_change_tab = false;
    }
}
