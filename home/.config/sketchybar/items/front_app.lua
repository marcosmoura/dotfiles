local sbar = require("sketchybar")
local icons = require("icons")

local function normalize_app_name(name)
  local normalized = (name or ""):gsub("^%s+", ""):gsub("%s+$", "")
  if normalized:match("WhatsApp") then
    return "WhatsApp"
  end

  return normalized
end

local function get_app_icon(app_name)
  local normalized_name = normalize_app_name(app_name)
  return icons.app[normalized_name] or icons.fallback.default
end

local front_app = sbar.add("item", "front_app", {
  position = "left",
  padding_left = 3,
  icon = {
    string = icons.fallback.default,
    padding_left = 8,
    padding_right = 6,
    width = 28,
    align = "center",
  },
  label = {
    string = "...",
    padding_left = 2,
    padding_right = 10,
    max_chars = 30,
  },
})

front_app:subscribe("front_app_switched", function(env)
  local app_name = env.INFO or ""
  local display_name = app_name ~= "" and app_name or "..."

  front_app:set({
    icon = {
      string = get_app_icon(app_name),
    },
    label = { string = display_name },
  })
end)
