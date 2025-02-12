use unicode_width::UnicodeWidthStr;

use zellij_tile::prelude::*;
use zellij_tile_utils::style;

use crate::{
    color::ModeColor,
    view::{Block, View},
};

pub struct Session;

impl Session {
    pub fn render(name: Option<&str>, mode: InputMode, palette: Palette) -> View {
        let mut blocks = vec![];
        let mut total_len = 0;
        let ModeColor { fg, bg } = ModeColor::new(mode, palette);

        // name
        if let Some(name) = name {
            let text = format!(" {}", name.to_uppercase());
            let len = text.width();
            let body = style!(fg, bg).bold().paint(text);

            total_len += len;
            blocks.push(Block {
                body: body.to_string(),
                len,
                tab_index: None,
            })
        }

        // mode
        {
            let text = {
                let sym = match mode {
                    InputMode::Locked => " ".to_string(),
                    InputMode::Normal => " ".to_string(),
                    InputMode::Pane => " ".to_string(),
                    InputMode::Resize => "󰩨 ".to_string(),
                    InputMode::Search => " ".to_string(),
                    InputMode::Session => " ".to_string(),
                    InputMode::Tab => "󰓩 ".to_string(),
                    InputMode::Tmux => " ".to_string(),
                    InputMode::RenamePane => "󰑕 ".to_string(),
                    InputMode::RenameTab => "󰑕 ".to_string(),
                    _ => format!("{:?}", mode).to_uppercase(),
                };

                format!(" {} ", sym)
            };
            let len = text.width();
            let body = style!(fg, bg).bold().paint(text);

            total_len += len;
            blocks.push(Block {
                body: body.to_string(),
                len,
                tab_index: None,
            })
        }

        View {
            blocks,
            len: total_len,
        }
    }
}
