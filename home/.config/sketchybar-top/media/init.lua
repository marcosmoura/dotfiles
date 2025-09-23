local glass = require("glass")
local inspect = require("inspect")
local sketchybar = require("sketchybar")

local artwork_size = 30
local players = {
  music = {
    icon = "",
    execute = "open -a Music"
  },
  spotify = {
    icon = "󰓇",
    execute = "open -a Spotify"
  },
  edge = {
    icon = "󰇩",
    execute = "open -a Microsoft Edge Dev"
  },
}

local function create_label(is_playing, artist, title)
  local max_length = 70
  local separator = " - "
  local prefix = is_playing and "" or "Paused: "

  -- Account for prefix and separator in available length
  local available_length = max_length - #separator

  -- Calculate max lengths for artist and title based on 40/60 ratio
  local max_artist_length = math.floor(available_length * 0.4)
  local max_title_length = available_length - max_artist_length

  -- Function to truncate text with ellipsis
  local function truncate(text, max_len)
    if #text <= max_len then
      return text
    else
      return text:sub(1, max_len - 3) .. "..."
    end
  end

  -- Truncate artist and title if needed
  local truncated_artist = truncate(artist, max_artist_length)
  local truncated_title = truncate(title, max_title_length)

  -- Construct the final label
  return prefix .. truncated_artist .. separator .. truncated_title
end

local get_player_name = function(media_app)
  if not media_app then
    return "unknown"
  end

  local app_lower = media_app:lower()
  for key, _ in pairs(players) do
    if string.find(app_lower, key) then
      return key
    end
  end

  return "unknown"
end

local get_player_icon = function(media_app)
  local player_name = get_player_name(media_app)
  local player_icon = ""

  if player_name ~= "unknown" then
    player_icon = players[player_name].icon .. "  "
  end

  return player_icon
end

local media_app = nil

local right_padding = sketchybar.add("item", "media.padding.right", {
  position = "center",
  drawing = false,
  display = 1,
  label = {
    padding_right = 1,
  },
})

local media_music_name = glass.create_hoverable_item("media.music.name", {
  position = "center",
  drawing = false,
  display = 1,
  background = {
    drawing = true,
    height = artwork_size,
  },
  icon = {
    padding_left = artwork_size + 8,
    padding_right = 8,
    font = {
      size = 18,
      family = "Maple Mono NF",
    },
  },
  label = {
    padding_right = 12,
  },
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

media_music_name:subscribe("mouse.clicked", function()
  if not media_app then
    return
  end

  local player_name = get_player_name(media_app)
  if player_name == "unknown" then
    return
  end

  local execute_cmd = players[player_name].execute

  if execute_cmd and #execute_cmd > 0 then
    os.execute(execute_cmd)
  end
end)

media_music_name:subscribe("os_media_changed", function(env)
  local payload = env.MEDIA

  if not payload then
    return
  end

  local artist = payload["artist"]
  local title = payload["title"]
  local artwork = payload["artworkPath"]
  local is_playing = payload["playing"]

  if not artist or not title or not artwork then
    local disable_drawing = {
      drawing = false,
    }

    glass.animate_item(left_padding, disable_drawing)
    glass.animate_item(right_padding, disable_drawing)
    glass.animate_item(media_music_name, disable_drawing)
    return
  end

  media_app = payload["bundleIdentifier"] or media_app

  local label = create_label(is_playing, artist, title)

  glass.animate_item(left_padding, {
    drawing = true,
  })

  glass.animate_item(right_padding, {
    drawing = true,
  })

  glass.animate_item(media_music_name, {
    drawing = true,
    icon = {
      string = get_player_icon(media_app),
    },
    label = {
      string = label,
    },
    background = {
      image = {
        string = artwork,
      },
    },
  })
end)

-- Get media data once on load
sketchybar.exec("$HOME/.config/sketchybar/apps/bin/release/media-watcher --get")

glass.create_background("media")
