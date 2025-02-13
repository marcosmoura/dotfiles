use ansi_term::Color as AnsiColor;
use zellij_tile::prelude::{InputMode, Palette, PaletteColor};

pub struct Color;

impl Color {
    pub fn mode(mode: InputMode, palette: Palette) -> PaletteColor {
        match mode {
            InputMode::Locked => palette.green,
            InputMode::Normal => palette.blue,
            InputMode::Tmux => palette.magenta,
            _ => palette.orange,
        }
    }

    pub fn to_ansi(color: PaletteColor) -> AnsiColor {
        match color {
            PaletteColor::Rgb((r, g, b)) => AnsiColor::RGB(r, g, b),
            PaletteColor::EightBit(color) => AnsiColor::Fixed(color),
        }
    }
}
