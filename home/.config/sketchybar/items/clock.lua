local sbar = require("sketchybar")
local colors = require("colors")
local settings = require("settings")
local hover = require("helpers.hover")

local popup_font_size = settings.popup.font_size
local weekday_names = { "Su", "Mo", "Tu", "We", "Th", "Fr", "Sa" }
local calendar_left_padding = 12
local calendar_width = 270
local figure_space = " "
local combining_low_line = "\204\178"

local clock = sbar.add("item", "clock", {
  position = "right",
  icon = {
    string = "󰥔",
  },
  padding_right = 0,
  background = {
    padding_right = 0
  },
  label = {
    string = "--- --- -- --:--:--",
  },
  update_freq = 1,
  popup = {
    drawing = false,
    background = {
      padding_left = 10
    }
  },
})

-- Calendar popup header (month + year)
local calendar_header = sbar.add("item", "clock.popup.header", {
  position = "popup.clock",
  icon = { drawing = false },
  background = { drawing = false },
  label = {
    string = "...",
    color = colors.mauve,
    font = { family = settings.font.text, style = "Bold", size = popup_font_size * 1.2 },
    width = calendar_width,
    align = "center",
    padding_left = 0,
    padding_right = 0,
  },
  padding_left = calendar_left_padding,
  padding_right = calendar_left_padding,
})

local calendar_weekdays = sbar.add("item", "clock.popup.weekdays", {
  position = "popup.clock",
  icon = { drawing = false },
  background = { drawing = false },
  label = {
    string = "",
    color = colors.surface1,
    font = { family = settings.font.text, style = "Bold", size = popup_font_size },
    width = calendar_width,
    align = "left",
    padding_left = 0,
    padding_right = 0,
  },
  padding_left = calendar_left_padding,
  padding_right = calendar_left_padding,
})

-- Calendar week rows (up to 6 weeks in a month)
local calendar_rows = {}
for row = 1, 6 do
  calendar_rows[row] = sbar.add("item", "clock.popup.row" .. row, {
    position = "popup.clock",
    icon = { drawing = false },
    background = { drawing = false },
    label = {
      string = "",
      color = colors.subtext0,
      font = { family = settings.font.text, style = "Medium", size = popup_font_size },
      width = calendar_width,
      align = "left",
      padding_left = 0,
      padding_right = 0,
    },
    padding_left = calendar_left_padding,
    padding_right = calendar_left_padding,
  })
end

local popup_items = {
  calendar_header,
  calendar_weekdays,
}

for _, row in ipairs(calendar_rows) do
  popup_items[#popup_items + 1] = row
end

local month_names = {
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
}

local function format_weekday_row()
  local cells = {}
  for index, name in ipairs(weekday_names) do
    cells[index] = string.format("%-2s", name)
  end

  return table.concat(cells, "   ")
end

local function format_day_cell(day, is_today)
  if not day then
    return figure_space .. figure_space
  end

  local cell = string.format("%2d", day):gsub(" ", figure_space)
  if not is_today then
    return cell
  end

  return cell:gsub("%d", function(digit)
    return digit .. combining_low_line
  end)
end

local function build_calendar()
  local now = os.date("*t")
  local year = now.year
  local month = now.month
  local today = now.day

  calendar_header:set({
    label = { string = month_names[month] .. " " .. year },
  })
  calendar_weekdays:set({
    label = { string = format_weekday_row() },
  })

  -- First weekday of the month (1=Sunday .. 7=Saturday)
  local first_wday = os.date("*t", os.time({ year = year, month = month, day = 1 })).wday

  -- Total days in month: day 0 of next month = last day of current month
  local last_day = os.date("*t", os.time({ year = year, month = month + 1, day = 0 })).day

  local rows = {}
  local day = 1

  for row = 1, 6 do
    local cells = {}
    for col = 1, 7 do
      local cell_day = nil
      local day_index = (row - 1) * 7 + col
      if day_index >= first_wday and day <= last_day then
        cell_day = day
        day = day + 1
      end
      cells[#cells + 1] = format_day_cell(cell_day, cell_day == today)
    end

    rows[row] = table.concat(cells, "   ")
  end

  for i = 1, 6 do
    if rows[i] and rows[i]:match("%d") then
      calendar_rows[i]:set({ label = { string = rows[i] }, drawing = true })
    else
      calendar_rows[i]:set({ drawing = false })
    end
  end
end

-- nf-md-clock_time_{hour}_outline icons (12-hour, index 1=one .. 12=twelve)
local clock_icons = {
  "󱑋", "󱑌", "󱑍", "󱑎", "󱑏", "󱑐",
  "󱑑", "󱑒", "󱑓", "󱑔", "󱑕", "󱑖",
}

local function update_clock()
  local now = os.date("*t")
  local time = os.date("%a %b %d %H:%M:%S")
  local hour12 = now.hour % 12
  if hour12 == 0 then
    hour12 = 12
  end
  clock:set({
    icon = { string = clock_icons[hour12] },
    label = { string = time },
  })

  if clock:query().popup.drawing == "on" then
    build_calendar()
  end
end

hover.item(clock, {
  popup = true,
  before_toggle = build_calendar,
  popup_items = popup_items,
})

clock:subscribe("routine", update_clock)
clock:subscribe("forced", update_clock)

update_clock()
