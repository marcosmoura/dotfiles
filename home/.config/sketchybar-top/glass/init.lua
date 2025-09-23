local sketchybar = require("sketchybar")

local palette = {
  background = 0x50000000,
  background_hover = 0x45FFFFFF,

  base_shadow = 0x25FFFFFF,
  base_shadow_hover = 0x70000000,

  highlight_shadow = 0x18FFFFFF,
  highlight_shadow_hover = 0x80FFFFFF,

  border = 0x16FFFFFF,
  border_hover = 0xeeFFFFFF,

  transparent = 0x00000000,
}

local default_config = {
  background_height = 32,
  item_height = 28,
}

-- Generate a simple unique identifier
local function generate_id()
  local template = "xxxxxxxx"

  return string.gsub(template, "x", function()
    return string.format("%x", math.random(0, 15))
  end)
end

local function create_background(id)
  local first_layer_id = "glass-layer-" .. generate_id()
  local second_layer_id = "glass-layer-" .. generate_id()

  local layer1 = sketchybar.add("bracket", first_layer_id, { "/" .. id .. ".*/" }, {
    drawing = true,
    background = {
      color = palette.background,
      height = default_config.background_height,
      corner_radius = default_config.background_height,
      shadow = {
        drawing = true,
        color = palette.base_shadow,
        angle = 45,
        distance = 1,
      },
    },
  })
  local layer2 = sketchybar.add("bracket", second_layer_id, { first_layer_id }, {
    drawing = true,
    background = {
      color = palette.background,
      height = default_config.background_height,
      corner_radius = default_config.background_height,
      border_width = 1,
      border_color = palette.border,
      shadow = {
        drawing = true,
        color = palette.highlight_shadow,
        angle = 225,
        distance = 1,
      },
    },
  })

  return layer1, layer2
end

local animate_item = function(item, props)
  sketchybar.animate("tanh", 6, function()
    item:set(props)
  end)
end

local create_hoverable_item = function(id, config, type)
  local item = sketchybar.add(type or "item", id, config)
  local is_active = false

  item:set({
    background = {
      color = palette.transparent,
      height = default_config.item_height,
      corner_radius = default_config.item_height,
      shadow = {
        drawing = true,
        color = palette.transparent,
        angle = 45,
        distance = 1,
      },
    },
  })

  local background = sketchybar.add("bracket", "glass-layer-" .. generate_id(), { id }, {
    drawing = true,
    background = {
      color = palette.transparent,
      height = default_config.item_height,
      corner_radius = default_config.item_height,
      border_width = 1,
      border_color = palette.transparent,
      shadow = {
        drawing = true,
        color = palette.transparent,
        angle = 225,
        distance = 1,
      },
    },
  })

  local set_default_styles = function()
    animate_item(item, {
      background = {
        color = palette.transparent,
        shadow = {
          color = palette.transparent,
        },
      },
    })
    animate_item(background, {
      background = {
        color = palette.transparent,
        border_color = palette.transparent,
        shadow = {
          color = palette.transparent,
        },
      },
    })
  end

  local set_active_styles = function()
    animate_item(item, {
      background = {
        color = palette.background_hover,
        shadow = {
          color = palette.base_shadow_hover,
        },
      },
    })
    animate_item(background, {
      background = {
        color = palette.background_hover,
        border_color = palette.border_hover,
        shadow = {
          color = palette.highlight_shadow_hover,
        },
      },
    })
  end

  local set_active = function()
    is_active = true
    set_active_styles()
  end

  local reset = function()
    is_active = false
    set_default_styles()
  end

  item:subscribe("mouse.entered", function()
    if not is_active then
      set_active_styles()
    end
  end)

  item:subscribe("mouse.exited", function()
    if not is_active then
      set_default_styles()
    end
  end)

  return item, set_active, reset
end

sketchybar.default({
  icon = {
    font = {
      family = "SF Pro",
      style = "Medium",
      size = 13,
    },
    color = 0xffffffff,
  },
  label = {
    font = {
      family = "SF Pro",
      style = "Medium",
      size = 13,
    },
    color = 0xffffffff,
  },
})

return {
  create_background = create_background,
  create_hoverable_item = create_hoverable_item,
  animate_item = animate_item,
}
