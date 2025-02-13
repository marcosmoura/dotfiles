use chrono::Utc;
use chrono_tz::Europe::Prague as CurrentTimezone;

use zellij_tile::prelude::*;
use zellij_tile_utils::style;

use crate::{
    color::ModeColor,
    view::{Block, View},
};

pub struct Session;

impl Session {
    pub fn render(name: Option<&str>, mode: InputMode, palette: Palette) -> View {
        use unicode_width::UnicodeWidthStr;

        let mut blocks = vec![];
        let mut total_len = 0;

        let ModeColor {
            fg: mode_fg,
            bg: mode_bg,
        } = ModeColor::new(mode, palette);

        // date
        {
            let icon: String = "󱑍 ".to_string();
            let text = format!(" {} {} ", icon, DateTime::render());
            let len = text.width();
            let body = style!(palette.white, palette.bg).paint(text);

            total_len += len;
            blocks.push(Block {
                body: body.to_string(),
                len,
                tab_index: None,
            });
        }

        // session name
        {
            if let Some(name) = name {
                let icon: String = " ".to_string();
                let text = format!(" {} {} ", icon, name.to_uppercase());
                let len = text.width();
                let body = style!(mode_fg, mode_bg).bold().paint(text);

                total_len += len;
                blocks.push(Block {
                    body: body.to_string(),
                    len,
                    tab_index: None,
                })
            }
        }

        View {
            blocks,
            len: total_len,
        }
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
