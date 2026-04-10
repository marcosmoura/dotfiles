local sbar = require("sketchybar")
local colors = require("colors")
local settings = require("settings")

local hover = {}
local popup_animation = settings.popup.animation or {}
local popup_curve = popup_animation.curve or "tanh"
local popup_duration = popup_animation.duration or 15
local popup_target_y_offset = settings.popup.y_offset or 0
local popup_travel = popup_animation.travel or 6
local popup_hidden_y_offset = popup_animation.hidden_y_offset
local popup_hide_delay_s = popup_animation.hide_delay_s
local popup_exit_delay_s = popup_animation.exit_delay_s or 0.12

if popup_hidden_y_offset == nil then
  popup_hidden_y_offset = popup_target_y_offset - popup_travel
end

if popup_hide_delay_s == nil then
  popup_hide_delay_s = (popup_duration + 1) / 60
end

local function animate(callback)
  sbar.animate("tanh", 15, callback)
end

local function animate_popup(callback)
  sbar.animate(popup_curve, popup_duration, callback)
end

local function normalize_color(color)
  if type(color) == "number" then
    return color
  end

  if type(color) ~= "string" then
    return nil
  end

  return tonumber(color)
end

local function with_alpha(color, alpha)
  local normalized = normalize_color(color)
  if normalized == nil then
    return nil
  end

  local base_alpha = math.floor(normalized / 0x1000000) % 0x100
  local rgb = normalized % 0x1000000
  local scaled_alpha = math.floor((base_alpha * alpha / 0xff) + 0.5)
  return scaled_alpha * 0x1000000 + rgb
end

local function popup_style(y_offset, alpha)
  return {
    drawing = true,
    y_offset = y_offset,
    background = {
      color = with_alpha(colors.crust, alpha),
      border_color = with_alpha(colors.surface0, alpha),
    },
  }
end

local function snapshot_popup_item_state(popup_item)
  local query = popup_item:query()
  return {
    item = popup_item,
    icon_color = query.icon ~= nil and query.icon.color or nil,
    label_color = query.label ~= nil and query.label.color or nil,
    background_color = query.background ~= nil and query.background.color or nil,
    background_border_color = query.background ~= nil and query.background.border_color or nil,
  }
end

local function snapshot_popup_items(popup_items)
  local states = {}

  for _, popup_item in ipairs(popup_items or {}) do
    states[#states + 1] = snapshot_popup_item_state(popup_item)
  end

  return states
end

local function set_popup_item_alpha(state, alpha)
  local properties = {}

  if state.icon_color ~= nil then
    properties.icon = {
      color = with_alpha(state.icon_color, alpha),
    }
  end

  if state.label_color ~= nil then
    properties.label = {
      color = with_alpha(state.label_color, alpha),
    }
  end

  if state.background_color ~= nil or state.background_border_color ~= nil then
    properties.background = {}

    if state.background_color ~= nil then
      properties.background.color = with_alpha(state.background_color, alpha)
    end

    if state.background_border_color ~= nil then
      properties.background.border_color = with_alpha(state.background_border_color, alpha)
    end
  end

  if next(properties) ~= nil then
    state.item:set(properties)
  end
end

local function set_popup_items_alpha(states, alpha)
  for _, state in ipairs(states or {}) do
    set_popup_item_alpha(state, alpha)
  end
end

function hover.subscribe(item, handlers)
  item:subscribe("mouse.entered", function(env)
    if handlers.enter == nil then
      return
    end

    animate(function()
      handlers.enter(env)
    end)
  end)

  item:subscribe("mouse.exited", function(env)
    if handlers.exit == nil then
      return
    end

    animate(function()
      handlers.exit(env)
    end)
  end)
end

local function set_background(item, color)
  item:set({
    background = {
      color = color,
      border_color = colors.crust,
      border_width = 1
    }
  })
end

local function resolve_colors(options)
  local normal_color = options.normal_color or colors.crust
  local hover_color = options.hover_color or colors.surface0
  return normal_color, hover_color
end

local function create_background_controller(item, options)
  options = options or {}
  local target = options.target or item
  local normal_color, hover_color = resolve_colors(options)
  local hovered = false
  local pinned = false

  local function apply()
    set_background(target, (hovered or pinned) and hover_color or normal_color)
  end

  return {
    enter = function()
      hovered = true
      apply()
    end,
    exit = function()
      hovered = false
      apply()
    end,
    set_pinned = function(active)
      pinned = active
      animate(apply)
    end,
  }
end

function hover.background(item, options)
  local controller = create_background_controller(item, options)

  hover.subscribe(item, {
    enter = controller.enter,
    exit = controller.exit,
  })

  return controller
end

function hover.group(items, handlers)
  local active = 0
  local exit_token = 0

  local function on_enter(env)
    active = active + 1
    exit_token = exit_token + 1

    if active > 1 or handlers.enter == nil then
      return
    end

    animate(function()
      handlers.enter(env)
    end)
  end

  local function run_exit(env, token)
    if token ~= exit_token or active > 0 or handlers.exit == nil then
      return
    end

    animate(function()
      handlers.exit(env)
    end)
  end

  local function on_exit(env)
    active = math.max(0, active - 1)
    if active > 0 or handlers.exit == nil then
      return
    end

    exit_token = exit_token + 1
    local token = exit_token
    local delay = handlers.exit_delay_s or 0
    if delay <= 0 then
      run_exit(env, token)
      return
    end

    sbar.exec(string.format("sleep %.2f", delay), function()
      run_exit(env, token)
    end)
  end

  for _, item in ipairs(items) do
    item:subscribe("mouse.entered", on_enter)
    item:subscribe("mouse.exited", on_exit)
  end
end

function hover.group_background(items, target, options)
  options = options or {}
  local controller = create_background_controller(target, options)

  hover.group(items, {
    enter = controller.enter,
    exit = controller.exit,
    exit_delay_s = options.exit_delay_s,
  })

  return controller
end

local function subscribe_popup_dismiss(item, popup_items, options, dismiss)
  local tracked_items = { item }
  local active = 0
  local close_token = 0
  local delay = options.popup_exit_delay_s or popup_exit_delay_s

  for _, popup_item in ipairs(popup_items or {}) do
    tracked_items[#tracked_items + 1] = popup_item
  end

  local function on_enter()
    active = active + 1
    close_token = close_token + 1
  end

  local function run_close(token)
    if token ~= close_token or active > 0 then
      return
    end

    dismiss()
  end

  local function on_exit()
    active = math.max(0, active - 1)
    if active > 0 then
      return
    end

    close_token = close_token + 1
    local token = close_token
    if delay <= 0 then
      run_close(token)
      return
    end

    sbar.exec(string.format("sleep %.2f", delay), function()
      run_close(token)
    end)
  end

  for _, tracked_item in ipairs(tracked_items) do
    tracked_item:subscribe("mouse.entered.global", on_enter)
    tracked_item:subscribe("mouse.exited.global", on_exit)
  end
end

function hover.item(item, options)
  options = options or {}
  local controller = hover.background(item, options)
  local popup_state = "closed"
  local popup_token = 0
  local popup_item_states = {}

  if options.popup ~= true then
    return
  end

  local function open_popup(env)
    if popup_state == "open" or popup_state == "opening" then
      return
    end

    popup_token = popup_token + 1
    local token = popup_token

    if options.before_toggle ~= nil then
      options.before_toggle(env)
    end

    popup_item_states = snapshot_popup_items(options.popup_items)
    popup_state = "opening"
    set_popup_items_alpha(popup_item_states, 0x00)
    item:set({ popup = popup_style(popup_hidden_y_offset, 0x00) })
    animate_popup(function()
      if token ~= popup_token then
        return
      end

      set_popup_items_alpha(popup_item_states, 0xff)
      item:set({ popup = popup_style(popup_target_y_offset, 0xff) })
    end)
    popup_state = "open"
    controller.set_pinned(true)
  end

  local function close_popup()
    if popup_state == "closed" or popup_state == "closing" then
      return
    end

    popup_token = popup_token + 1
    local token = popup_token
    popup_state = "closing"
    controller.set_pinned(false)

    animate_popup(function()
      if token ~= popup_token then
        return
      end

      set_popup_items_alpha(popup_item_states, 0x00)
      item:set({ popup = popup_style(popup_hidden_y_offset, 0x00) })
    end)

    sbar.exec(string.format("sleep %.2f", popup_hide_delay_s), function()
      if token ~= popup_token or popup_state ~= "closing" then
        return
      end

      item:set({ popup = { drawing = false } })
      set_popup_items_alpha(popup_item_states, 0xff)
      popup_state = "closed"
    end)
  end

  item:subscribe("mouse.clicked", function(env)
    local opening = popup_state == "closed" or popup_state == "closing"
    if opening then
      open_popup(env)
      return
    end

    close_popup()
  end)

  subscribe_popup_dismiss(item, options.popup_items, options, function()
    close_popup()
  end)
end

return hover
