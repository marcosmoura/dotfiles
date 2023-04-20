local wezterm = require 'wezterm'
local mux = wezterm.mux
local config = {}


--
-- [[ FONT CONFIGURATION ]]
--
config.font = wezterm.font_with_fallback {
  {
    family = 'JetBrains Mono',
    weight = 'Bold',
  },
  {
    family = 'JetBrainsMonoNL Nerd Font Mono',
    weight = 'Bold',
    scale = 1.2,
    stretch = 'Expanded',
  },
}
config.font_size = 17
config.line_height = 1.2
config.bold_brightens_ansi_colors = 'BrightOnly'
config.allow_square_glyphs_to_overflow_width = 'Always'
config.use_cap_height_to_scale_fallback_fonts = true
config.custom_block_glyphs = true


--
-- [[ STYLE CONFIGURATION ]]
--
config.color_scheme = 'Snazzy (base16)'
config.colors = {
  foreground = '#EFEFEB',
  background = '#000',
  cursor_bg = '#57C7FF',
  cursor_fg = '#000',
  cursor_border = '#57C7FF',
  selection_fg = '#000',
  selection_bg = '#FFFACD',
  scrollbar_thumb = '#57C7FF',
  split = '#57C7FF',
  ansi = {
    '#000',
    '#FF5C57',
    '#5AF78E',
    '#F3F99D',
    '#57C7FF',
    '#FF6AC1',
    '#9AEDFE',
    '#F1F1F0',
  },
  brights = {
    '#686868',
    '#FF5C57',
    '#5AF78E',
    '#F3F99D',
    '#57C7FF',
    '#FF6AC1',
    '#9AEDFE',
    '#EFEFEB',
  }
}
config.default_cursor_style = 'BlinkingBar'
config.cursor_thickness = '1.5'
config.cursor_blink_rate = 400
config.command_palette_bg_color = "#000"
config.command_palette_fg_color = "#EFEFEB"
config.command_palette_font_size = 19
config.allow_square_glyphs_to_overflow_width = "Always"


--
-- [[ WINDOW CONFIGURATION ]]
--
config.window_padding = {
  left = '24px',
  right = '24px',
  top = '8px',
  bottom = '8px',
}
config.window_frame = {
  border_left_width = 0,
  border_right_width = 0,
  border_bottom_height = 0,
  border_top_height = 0,
}
config.window_decorations = "RESIZE"
config.window_background_opacity = 0.85
config.macos_window_background_blur = 20
config.window_close_confirmation = 'NeverPrompt'


--
-- [[ DEFAULT APP CONFIGURATION ]]
--
config.max_fps = 144
config.animation_fps = 144
config.front_end = 'WebGpu'
config.webgpu_power_preference = "HighPerformance"
config.enable_kitty_keyboard = false
config.scrollback_lines = 9999
config.hide_tab_bar_if_only_one_tab = true
config.tab_bar_at_bottom = true


--
-- [[ KEY BINDINGS ]]
--
config.send_composed_key_when_left_alt_is_pressed = false
config.send_composed_key_when_right_alt_is_pressed = true
config.keys = {
  {
    key = 'P',
    mods = 'CMD|SHIFT',
    action = wezterm.action.ActivateCommandPalette,
  },

  {
    key = 'd',
    mods = 'CMD',
    action = wezterm.action.SplitVertical,
  },

  {
    key = 'd',
    mods = 'CMD|SHIFT',
    action = wezterm.action.SplitHorizontal,
  },

  {
    key = 'w',
    mods = 'CMD',
    action = wezterm.action.CloseCurrentPane { confirm = false },
  },
}


--
-- [[ STARTUP CONFIGURATION ]]
--
config.default_cwd = "~/Projects"

wezterm.on('gui-startup', function(cmd)
  local args = {}
  if cmd then
    args = cmd.args
  end

  local project_dir = wezterm.home_dir .. '/Projects/fluent/fluentui'

  local tab, first_panel, window = mux.spawn_window {
    cwd = project_dir,
    args = args,
  }

  first_panel:send_text 'systeminfo\n'

  mux.spawn_window {
    cwd = project_dir,
    args = args,
  }
end)

return config
