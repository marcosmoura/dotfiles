use ansi_term::Style;
use unicode_width::UnicodeWidthStr;

use zellij_tile::prelude::*;

use crate::color::Color;

pub struct View {
    pub blocks: Vec<Block>,
    pub len: usize,
}

#[derive(Default, Clone, Debug)]
pub struct Block {
    pub body: String,
    pub len: usize,
    pub tab_index: Option<usize>,
}

pub struct Bg;

impl Bg {
    pub fn render(cols: usize, palette: Palette) -> Block {
        let text = format!("{: <1$}", "", cols);
        let body = Style::new().fg(Color::to_ansi(palette.fg)).paint(text);

        Block {
            body: body.to_string(),
            len: cols,
            tab_index: None,
        }
    }
}

pub struct Spacer {
    pub left: Option<Block>,
    pub right: Option<Block>,
}

impl Spacer {
    pub fn render(
        total_len: usize,
        (left_len, mid_len, right_len): (usize, usize, usize),
        palette: Palette,
    ) -> Self {
        let room = total_len - mid_len;
        let (clean_left, clean_right) = Self::center(room);

        if clean_left > left_len && clean_right > right_len {
            let left = clean_left - left_len;
            let right = clean_right - right_len;
            Self {
                left: Some(Bg::render(left, palette)),
                right: Some(Bg::render(right, palette)),
            }
        } else if clean_left < left_len && clean_right - left_len - clean_left > right_len {
            let diff = left_len - clean_left;
            let right = clean_right - diff - right_len;

            Self {
                left: None,
                right: Some(Bg::render(right, palette)),
            }
        } else if clean_right < right_len && clean_left - right_len - clean_right > left_len {
            let diff = right_len - clean_right;
            let left = clean_left - diff - left_len;

            Self {
                left: Some(Bg::render(left, palette)),
                right: None,
            }
        } else {
            // We ran out of space
            Self {
                left: None,
                right: None,
            }
        }
    }

    fn center(room: usize) -> (usize, usize) {
        let quot = room / 2;
        let rem = room % 2;
        (quot, quot + rem)
    }
}

pub struct Error;

impl Error {
    pub fn render(message: &str, palette: Palette) -> Block {
        let text = message;
        let len = text.width();
        let body = Style::new()
            .fg(Color::to_ansi(palette.white))
            .on(Color::to_ansi(palette.red))
            .bold()
            .paint(text);

        Block {
            body: body.to_string(),
            len,
            tab_index: None,
        }
    }
}
