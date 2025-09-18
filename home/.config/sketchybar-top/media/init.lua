local glass = require("glass")
local sketchybar = require("sketchybar")

local right_padding = sketchybar.add("item", "media.padding.right", {
  position = "center",
  drawing = false,
  display = 1,
  label = {
    padding_right = 1,
  },
})

local artwork_size = 30
local media_artwork = sketchybar.add("item", "media.artwork", {
  width = artwork_size,
  position = "center",
  display = 1,
  drawing = false,
  background = {
    drawing = true,
    height = artwork_size,
  },
  update_freq = 0,
  padding_right = 8,
})

local media_music_name = sketchybar.add("item", "media.music.name", {
  position = "center",
  drawing = false,
  display = 1,
  padding_left = 12,
  padding_right = 12,
  updates = true,
})

local left_padding = sketchybar.add("item", "media.padding.left", {
  position = "center",
  drawing = false,
  display = 1,
  label = {
    padding_left = 1,
  },
})

media_music_name:subscribe("os_media_changed", function(env)
  local payload = env.MEDIA

  if not payload then
    return
  end

  local artist = payload["artist"]
  local title = payload["title"]
  local artwork = payload["artworkData"]

  if not artist or not title or not artwork then
    local disable_drawing = {
      drawing = false,
    }

    glass.animate_item(left_padding, disable_drawing)
    glass.animate_item(right_padding, disable_drawing)
    glass.animate_item(media_music_name, disable_drawing)
    glass.animate_item(media_artwork, disable_drawing)
    return
  end

  local label = artist .. " - " .. title

  glass.animate_item(left_padding, {
    drawing = true,
  })

  glass.animate_item(right_padding, {
    drawing = true,
  })

  glass.animate_item(media_music_name, {
    drawing = true,
    label = {
      string = label,
    },
  })

  glass.animate_item(media_artwork, {
    drawing = true,
    background = {
      image = {
        string = artwork,
      },
    },
  })
end)

glass.create_background("media")
