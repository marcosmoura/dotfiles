use ansi_term::Style;

use zellij_tile::prelude::*;

use crate::{
    color::Color,
    view::{Block, View},
};

pub struct Tabs;

impl Tabs {
    pub fn render(tabs: &[TabInfo], mode: InputMode, palette: Palette) -> View {
        let mut blocks: Vec<Block> = Vec::with_capacity(tabs.len());
        let mut total_len = 0;

        for tab in tabs {
            let block = Tab::render(tab, mode, palette);

            total_len += block.len;
            blocks.push(block);
        }

        View {
            blocks,
            len: total_len,
        }
    }
}

pub struct Tab;

impl Tab {
    pub fn render(tab: &TabInfo, mode: InputMode, palette: Palette) -> Block {
        let mut text = tab.name.clone();

        if tab.active && mode == InputMode::RenameTab && text.is_empty() {
            text = String::from("Enter name...");
        }

        if tab.is_sync_panes_active {
            text.push_str("  ");
        }

        text = format!(" {} ", text.to_uppercase());

        let body = if tab.active {
            Style::new()
                .fg(Color::to_ansi(palette.green))
                .bold()
                .paint(text)
        } else {
            Style::new().fg(Color::to_ansi(palette.fg)).paint(text)
        };
        let len = body.len();

        Block {
            body: body.to_string(),
            len,
            tab_index: Some(tab.position),
        }
    }
}
