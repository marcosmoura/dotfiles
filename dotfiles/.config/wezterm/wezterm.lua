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
    family = "JetBrains Mono",
    weight = "Medium",
  },
  {
    family = "JetBrainsMonoNL Nerd Font Mono",
    weight = "Medium",
    scale = 1.4,
    stretch = "Expanded",
  },
  {
    family = "Apple Color Emoji",
    weight = "Medium",
  },
})
config.font_size = 17
config.line_height = 1.2
config.bold_brightens_ansi_colors = "BrightOnly"
config.allow_square_glyphs_to_overflow_width = "Always"
config.use_cap_height_to_scale_fallback_fonts = true
config.custom_block_glyphs = true

--
-- [[ STYLE CONFIGURATION ]]
--

local custom = wezterm.color.get_builtin_schemes()["Catppuccin Mocha"]

custom.background = "#11111b"
custom.tab_bar.background = "#040404"
custom.tab_bar.inactive_tab.bg_color = "#0f0f0f"
custom.tab_bar.new_tab.bg_color = "#080808"

config.color_schemes = {
  ["OLEDppuccin"] = custom,
}
config.color_scheme = "OLEDppuccin"
config.default_cursor_style = "BlinkingBar"
config.cursor_thickness = "1.5"
config.cursor_blink_rate = 400
config.command_palette_bg_color = "#000"
config.command_palette_fg_color = "#efefeb"
config.command_palette_font_size = 19
config.allow_square_glyphs_to_overflow_width = "Always"

--
-- [[ WINDOW CONFIGURATION ]]
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
config.macos_window_background_blur = 20
config.window_close_confirmation = "NeverPrompt"

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
config.send_composed_key_when_left_alt_is_pressed = false
config.send_composed_key_when_right_alt_is_pressed = true
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
-- [[ STARTUP CONFIGURATION ]]
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
