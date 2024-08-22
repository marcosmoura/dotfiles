local wezterm = require("wezterm")
local mux = wezterm.mux
local config = {}

if wezterm.config_builder then
  config = wezterm.config_builder()
end

--
-- [[ FONT CONFIGURATION ]]
--
config.font = wezterm.font_with_fallback({
  {
    family = "Maple Mono",
    weight = 500,
  },
  {
    family = "Symbols Nerd Font Mono",
    scale = 0.8,
  },
  {
    family = "Apple Color Emoji",
  },
})
config.font_size = 17.1
config.line_height = 1.3
config.bold_brightens_ansi_colors = "BrightOnly"
config.allow_square_glyphs_to_overflow_width = "Always"
config.use_cap_height_to_scale_fallback_fonts = true
config.custom_block_glyphs = true

--
-- [[ STYLE CONFIGURATION ]]
--
config.color_scheme = "Catppuccin Mocha"
config.default_cursor_style = "BlinkingBar"
config.cursor_thickness = "1.5"
config.cursor_blink_rate = 400
config.command_palette_bg_color = "#000"
config.command_palette_fg_color = "#efefeb"
config.command_palette_font_size = 19
config.allow_square_glyphs_to_overflow_width = "Always"

--
-- [[ WINDOW AND PANES CONFIGURATION ]]
--
config.window_padding = {
  left = 24,
  right = 24,
  top = 8,
  bottom = 8,
}
config.window_frame = {
  border_left_width = 0,
  border_right_width = 0,
  border_bottom_height = 0,
  border_top_height = 0,
}
config.window_decorations = "RESIZE"
config.window_background_opacity = 0.9
config.macos_window_background_blur = 25
config.window_close_confirmation = "NeverPrompt"
config.inactive_pane_hsb = {
  brightness = 0.25,
}

--
-- [[ DEFAULT APP CONFIGURATION ]]
--
config.max_fps = 144
config.animation_fps = 144
config.front_end = "WebGpu"
config.webgpu_power_preference = "HighPerformance"
config.enable_kitty_keyboard = false
config.scrollback_lines = 9999
config.hide_tab_bar_if_only_one_tab = true
config.tab_bar_at_bottom = true

--
-- [[ KEY BINDINGS ]]
--
config.keys = {
  {
    key = "P",
    mods = "CMD|SHIFT",
    action = wezterm.action.ActivateCommandPalette,
  },

  {
    key = "P",
    mods = "CTRL|SHIFT",
    action = wezterm.action.DisableDefaultAssignment,
  },

  {
    key = "d",
    mods = "CMD",
    action = wezterm.action.SplitVertical,
  },

  {
    key = "d",
    mods = "CMD|SHIFT",
    action = wezterm.action.SplitHorizontal,
  },

  {
    key = "w",
    mods = "CMD",
    action = wezterm.action.CloseCurrentPane({ confirm = false }),
  },
}

--
-- [[ EVENTS CONFIGURATION ]]
--
config.default_cwd = "~/Projects"

wezterm.on("gui-startup", function(cmd)
  local args = {}
  if cmd then
    args = cmd.args
  end

  local project_dir = wezterm.home_dir .. "/Projects/fluent/fluentui"

  mux.spawn_window({
    cwd = project_dir,
    args = args,
  })

  local _, second_panel = mux.spawn_window({
    cwd = project_dir,
    args = args,
  })

  wezterm.time.call_after(1, function()
    second_panel:send_text("clear\n")
  end)
end)

return config
