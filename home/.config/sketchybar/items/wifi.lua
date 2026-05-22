local sbar = require("sketchybar")
local colors = require("colors")
local icons = require("icons")
local hover = require("helpers.hover")
local popup = require("helpers.popup")

local popup_width = 400

local wifi = sbar.add("item", "wifi", {
  position = "right",
  icon = {
    string = icons.status.wifi,
    color = colors.overlay1,
  },
  label = {
    string = "Wi-Fi",
  },
  update_freq = 15,
  popup = {
    drawing = false,
  },
})

local popup_row_specs = {
  {
    key = "status",
    icon = icons.status.wifi_connected,
    icon_color = colors.blue,
    label = "Status: ...",
  },
  {
    key = "interface",
    icon = icons.wifi_popup.interface,
    icon_color = colors.lavender,
    label = "Interface: ...",
  },
  {
    key = "address",
    icon = icons.wifi_popup.address,
    icon_color = colors.green,
    label = "IP: ...",
  },
  {
    key = "router",
    icon = icons.wifi_popup.router,
    icon_color = colors.peach,
    label = "Router: ...",
  },
  {
    key = "dns",
    icon = icons.wifi_popup.dns,
    icon_color = colors.sky,
    label = "DNS: ...",
  },
  {
    key = "security",
    icon = icons.wifi_popup.security,
    icon_color = colors.yellow,
    label = "Security: ...",
  },
  {
    key = "network",
    icon = icons.wifi_popup.network,
    icon_color = colors.teal,
    label = "BSSID: ...",
  },
}
local popup_items = {}
local popup_rows = {}

for _, row in ipairs(popup_row_specs) do
  local item = popup.create_row("wifi.popup." .. row.key, "wifi", {
    width = popup_width,
    icon = row.icon,
    icon_color = row.icon_color,
    label = row.label,
  })
  popup_items[#popup_items + 1] = item
  popup_rows[row.key] = item
end

local function wifi_state(result)
  local status = result and result.status or "unavailable"
  local ssid = result and result.ssid or ""

  if status == "connected" and ssid ~= "" then
    return { icon = icons.status.wifi_connected, color = colors.blue, label = ssid, detail = "Connected to " .. ssid }
  elseif status == "off" then
    return { icon = icons.status.wifi_off, color = colors.overlay0, label = "Wi-Fi Off" }
  elseif status == "disconnected" then
    return { icon = icons.status.wifi_disconnected, color = colors.yellow, label = "Disconnected" }
  end

  return { icon = icons.status.wifi_disconnected, color = colors.red, label = "Unavailable" }
end

local function value_or_dash(value)
  if value == nil or value == "" then
    return "--"
  end

  return value
end

local function update_detail(data)
  if type(data) ~= "table" then
    return
  end

  local state = wifi_state(data)
  popup_rows.status:set({
    icon = { string = state.icon, color = state.color },
    label = { string = "Status: " .. (state.detail or state.label) },
  })
  popup_rows.interface:set({
    label = { string = "Interface: " .. value_or_dash(data.device) },
  })
  popup_rows.address:set({
    label = { string = "IP: " .. value_or_dash(data.ipv4) .. " / " .. value_or_dash(data.subnet) },
  })
  popup_rows.router:set({
    label = { string = "Router: " .. value_or_dash(data.router) },
  })
  popup_rows.dns:set({
    label = { string = "DNS: " .. value_or_dash(data.dns) },
  })
  popup_rows.security:set({
    label = {
      string = "Security: " .. value_or_dash(data.security) .. "  Ch: " .. value_or_dash(data.channel),
    },
  })
  popup_rows.network:set({
    label = { string = "BSSID: " .. value_or_dash(data.bssid) },
  })
end

local function update_wifi()
  sbar.exec("bash $CONFIG_DIR/scripts/wifi.sh", function(result)
    if type(result) ~= "table" then
      return
    end

    local state = wifi_state(result)

    sbar.animate("tanh", 15, function()
      wifi:set({
        icon = { string = state.icon, color = state.color },
        label = { string = state.label },
      })
    end)

    update_detail(result)
  end)
end

hover.item(wifi, {
  popup = true,
  before_toggle = update_wifi,
  popup_items = popup_items,
})

wifi:subscribe("routine", update_wifi)
wifi:subscribe("forced", update_wifi)
wifi:subscribe("wifi_change", update_wifi)
wifi:subscribe("system_woke", update_wifi)

update_wifi()
