local glass = require("glass")
local inspect = require("inspect")
local sketchybar = require("sketchybar")

local apps = {
  ["Finder"] = {
    icon = "",
  },
  ["Ghostty"] = {
    icon = "",
  },
  ["Code"] = {
    label = "Visual Studio Code",
    icon = "",
  },
  ["Microsoft Edge"] = {
    label = "Microsoft Edge",
    icon = "󰇩",
  },
  ["Spotify"] = {
    icon = "󰓇",
  },
  ["Figma"] = {
    icon = "",
  },
  ["Teams"] = {
    icon = "󰊻",
  },
  ["Outlook"] = {
    icon = "󰴢",
  },
  ["Reminders"] = {
    icon = "",
  },
  ["Proton Pass"] = {
    label = "Proton Pass",
    icon = "",
  },
  ["Whatsapp"] = {
    icon = "",
  },
  ["Azure VPN"] = {
    label = "Azure VPN",
    icon = "󰖂",
  },
  ["Proton VPN"] = {
    icon = "󰖂",
  },
  ["System Settings"] = {
    icon = "",
  },
  ["Activity Monitor"] = {
    icon = "",
  },
}

local spaces = { "", "", "󰇩", "󰓇", "", "󰊻", "", "", "󰴢", "" }
local space_items = {}
local total_spaces = #spaces

local query_space = function(callback)
  sketchybar.exec("yabai -m query --spaces --space", function(space)
    if not space then
      return
    end

    callback(space.index)
  end)
end

local set_front_app = function(env, space_id)
  if not (env and env.INFO and space_id) then
    return
  end

  local current_space = space_items[space_id]
  local icon = spaces[space_id] or tostring(space_id)
  local label = env.INFO

  for app_name, app_info in pairs(apps) do
    if string.find(string.lower(env.INFO), string.lower(app_name)) then
      icon = app_info.icon or icon
      label = app_info.label or label
      break
    end
  end

  glass.animate_item(current_space.item, {
    icon = {
      string = icon,
    },
    label = {
      drawing = true,
      string = label,
    },
  })
end

local inactivate_space = function()
  for _, space in pairs(space_items) do
    space.reset()
    glass.animate_item(space.item, {
      label = {
        drawing = false,
      },
    })
  end
end

local set_active_space = function(space_id)
  local current_space = space_items[space_id]

  if not current_space then
    return
  end

  current_space.set_active()
end

local on_front_app_changed = function(env)
  if not env or not env.INFO then
    return
  end

  -- Wait a bit for the space change to be effective.
  -- Without this, the query might return the previous space.
  sketchybar.exec("sleep 0.35", function()
    inactivate_space()

    query_space(function(space_id)
      set_active_space(space_id)
      set_front_app(env, space_id)
    end)
  end)
end

sketchybar.add("item", "space.padding.left", {
  position = "left",
  label = {
    padding_left = 1,
  },
})

for i = 1, total_spaces do
  local space_icon = spaces[i] or tostring(i)

  local space, set_active, reset = glass.create_hoverable_item("space." .. i, {
    display = 1,
    position = "left",
    space = i,
    label = {
      drawing = false,
      padding_right = 12,
      color = 0xFFFFFFFF,
    },
    icon = {
      string = space_icon,
      padding_left = 12,
      padding_right = 12,
      color = 0xFFFFFFFF,
      font = {
        size = 18,
        family = "Maple Mono NF",
      },
    },
    padding_right = 1,
    padding_left = 1,
  }, "space")

  space:subscribe("mouse.clicked", function(env)
    -- Focus space using AppleScript to send Control+Number keypress.
    -- This is a workaround since yabai does not support focusing spaces (with SIP enabled).
    local number_keycodes = { 18, 19, 20, 21, 23, 22, 26, 28, 25 }
    local sid = tonumber(env.SID) or 1
    local keycode = number_keycodes[sid] or number_keycodes[1]
    local script = "osascript -e 'tell application \"System Events\" to key code %d using control down'"
    local cmd = string.format(script, keycode)

    sketchybar.exec(cmd)
  end)

  table.insert(space_items, {
    item = space,
    set_active = set_active,
    reset = reset,
  })
end

sketchybar.add("item", "space.padding.right", {
  position = "left",
  label = {
    padding_right = 1,
  },
})

local space_watcher = sketchybar.add("item", "space_watcher", {
  drawing = false,
})

space_watcher:subscribe("front_app_switched", on_front_app_changed)

glass.create_background("space")
