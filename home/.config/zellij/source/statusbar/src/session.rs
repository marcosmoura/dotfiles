use ansi_term::Style;
use chrono::Utc;
use chrono_tz::Europe::Prague as CurrentTimezone;

use zellij_tile::prelude::*;

use crate::{
    color::Color,
    view::{Block, View},
};

pub struct Session;

impl Session {
    pub fn render(name: Option<&str>, mode: InputMode, palette: Palette) -> View {
        use unicode_width::UnicodeWidthStr;

        let mut blocks = vec![];
        let mut len = 0;

        if let Some(name) = name {
            let mode_color = Color::mode(mode, palette);
            let icon: String = " ".to_string();
            let text = format!(" {} {}  ", icon, name.to_uppercase());
            let body = Style::new()
                .fg(Color::to_ansi(mode_color))
                .paint(text.clone());

            len = text.width();

            blocks.push(Block {
                body: body.to_string(),
                len,
                tab_index: None,
            })
        }

        View { blocks, len }
    }
}

pub struct DateTime;

impl DateTime {
    pub fn render() -> String {
        let now = Utc::now().with_timezone(&CurrentTimezone);
        let datetime = now.format("%a %b %d - %H:%M").to_string();

        datetime
    }
}
