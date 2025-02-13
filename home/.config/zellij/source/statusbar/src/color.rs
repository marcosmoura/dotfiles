use zellij_tile::prelude::{InputMode, Palette, PaletteColor};

pub const DARKER_GRAY: PaletteColor = PaletteColor::Rgb((49, 50, 68));

pub struct ModeColor {
    pub fg: PaletteColor,
    pub bg: PaletteColor,
}

impl ModeColor {
    pub fn new(mode: InputMode, palette: Palette) -> Self {
        let fg = match mode {
            InputMode::Locked => palette.green,
            InputMode::Normal => palette.blue,
            InputMode::Tmux => palette.magenta,
            _ => palette.orange,
        };

        let bg = palette.bg;

        Self { fg, bg }
    }
}
