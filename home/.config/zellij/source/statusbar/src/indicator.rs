use ansi_term::Style;
use unicode_width::UnicodeWidthStr;

use zellij_tile::prelude::*;

use crate::{
    color::Color,
    view::{Block, View},
};

pub struct Indicator;

impl Indicator {
    pub fn render(mode: InputMode, palette: Palette) -> View {
        let mut blocks = vec![];
        let mut total_len = 0;
        let mode_color = Color::mode(mode, palette);

        // mode
        {
            let text = {
                let mode_str = format!("{:?}", mode).to_uppercase();
                let icon = match mode {
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
                    _ => " ".to_string(),
                };

                format!(" {} {} ", icon, mode_str)
            };
            let len = text.width();
            let body = Style::new()
                .fg(Color::to_ansi(mode_color))
                .bold()
                .paint(text);

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
