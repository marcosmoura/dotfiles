local sbar = require("sketchybar")
local colors = require("colors")
local settings = require("settings")
local hover = require("helpers.hover")

local cover_size = settings.item.height - 2

local media_cover = sbar.add("item", "media.cover", {
  position = "center",
  width = cover_size,
  icon = { drawing = false },
  label = { drawing = false },
  updates = true,
  background = {
    height = cover_size,
    color = colors.transparent,
    image = {
      string = "",
      scale = 1,
    },
  },
  drawing = false,
  padding_left = 1,
  padding_right = 0,
})

local media = sbar.add("item", "media", {
  position = "center",
  background = { drawing = false },
  updates = true,
  icon = {
    string = settings.media_icons.default,
    color = colors.mauve,
  },
  label = {
    string = "",
    max_chars = 40,
  },
  drawing = false,
  update_freq = 1,
})

local media_bracket = sbar.add("bracket", "media.bracket", {
  media_cover.name,
  media.name,
}, {
  background = {
    color = colors.crust,
    corner_radius = settings.item.corner_radius,
    height = settings.item.height,
  },
  drawing = false,
})

local current_app = ""

local function hide_media()
  current_app = ""
  media_bracket:set({ background = { color = colors.crust } })
  media_bracket:set({ drawing = false })
  media_cover:set({ drawing = false })
  media:set({ drawing = false })
end

local function open_current_app()
  if current_app ~= "" then
    sbar.exec(string.format("open -a %q", current_app))
  end
end

local function update_media()
  sbar.exec("$CONFIG_DIR/scripts/media.sh", function(result)
    if type(result) ~= "table" then
      hide_media()
      return
    end

    if result.title and result.title ~= "" then
      local app = result.app or ""
      local app_lower = app:lower()
      local icon = settings.media_icons[app_lower] or settings.media_icons.default
      local is_playing = result.playing == true

      local display = result.title
      if result.artist and result.artist ~= "" then
        display = display .. " - " .. result.artist
      end
      if not is_playing then
        display = "Paused: " .. display
      end

      current_app = app

      local artwork = result.artwork or ""
      local artwork_size = tonumber(result.artwork_size) or cover_size
      local artwork_scale = cover_size / math.max(artwork_size, cover_size)

      media_bracket:set({ drawing = true })
      media_cover:set({
        drawing = artwork ~= "",
        background = {
          image = {
            corner_radius = settings.item.corner_radius - 2,
            string = artwork,
            scale = artwork_scale,
          },
        },
      })
      media:set({
        drawing = true,
        icon = {
          string = icon,
          color = is_playing and colors.mauve or colors.overlay0,
        },
        label = { string = display },
      })
    else
      hide_media()
    end
  end)
end

media:subscribe("routine", update_media)
media:subscribe("forced", update_media)
media_cover:subscribe("routine", update_media)
media_cover:subscribe("forced", update_media)

-- Delay the exit slightly so moving between cover art and label keeps the group highlighted.
hover.group_background({ media_cover, media }, media_bracket, {
  exit_delay_s = 0.05,
})

media:subscribe("mouse.clicked", open_current_app)
media_cover:subscribe("mouse.clicked", open_current_app)

update_media()
