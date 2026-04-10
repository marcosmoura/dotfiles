local sbar = require("sketchybar")
local colors = require("colors")
local settings = require("settings")
local hover = require("helpers.hover")

local spaces = {}
local rendered_workspaces = {}
local focused_workspace = nil
local hovered_workspaces = {}
local refresh_spaces = nil
local refresh_retry_pending = false
local refresh_retry_token = 0

local function get_space_background(workspace_name)
  local is_focused = focused_workspace == workspace_name
  local is_hovered = hovered_workspaces[workspace_name] == true

  if is_hovered then
    return is_focused and colors.surface2 or colors.surface0
  end

  return is_focused and colors.surface1 or colors.crust
end

local function sync_space_background(space, workspace_name)
  space:set({
    background = { color = get_space_background(workspace_name) },
  })
end

local function sync_all_space_backgrounds()
  sbar.animate("tanh", 15, function()
    for _, workspace_name in ipairs(rendered_workspaces) do
      local space = spaces[workspace_name]
      if space ~= nil then
        sync_space_background(space, workspace_name)
      end
    end
  end)
end

local function set_focused_workspace(workspace_name)
  if workspace_name == nil or workspace_name == "" then
    return
  end

  focused_workspace = workspace_name
  sync_all_space_backgrounds()
end

local function compare_workspaces(left, right)
  local workspace_order = settings.workspace_order or {}
  local left_priority = workspace_order[left] or math.huge
  local right_priority = workspace_order[right] or math.huge

  if left_priority ~= right_priority then
    return left_priority < right_priority
  end

  return left < right
end

local function normalize_workspaces(result)
  local workspace_names = {}
  local seen = {}

  if type(result) ~= "string" then
    return workspace_names
  end

  for workspace_name in result:gmatch("[^\r\n]+") do
    if workspace_name ~= "" and not seen[workspace_name] then
      seen[workspace_name] = true
      workspace_names[#workspace_names + 1] = workspace_name
    end
  end

  table.sort(workspace_names, compare_workspaces)

  return workspace_names
end

local function has_same_workspaces(workspace_names)
  if #rendered_workspaces ~= #workspace_names then
    return false
  end

  for i, workspace_name in ipairs(workspace_names) do
    if rendered_workspaces[i] ~= workspace_name then
      return false
    end
  end

  return true
end

local function clear_spaces()
  if #rendered_workspaces > 0 then
    sbar.remove("spaces_bracket")
  end

  for _, workspace_name in ipairs(rendered_workspaces) do
    sbar.remove("space." .. workspace_name)
    spaces[workspace_name] = nil
    hovered_workspaces[workspace_name] = nil
  end

  rendered_workspaces = {}
end

local function add_space_item(workspace_name, index, total)
  local space = sbar.add("item", "space." .. workspace_name, {
    position = "left",
    padding_right = index == total and 1 or 0,
    padding_left = 1,
    background = {
      height = settings.item.height - 2,
    },
    icon = {
      string = settings.workspace_icons[workspace_name] or "?",
      color = colors.text,
      width = 38,
      align = 'center'
    },
    label = { drawing = false },
  })

  hover.subscribe(space, {
    enter = function()
      hovered_workspaces[workspace_name] = true
      sync_space_background(space, workspace_name)
    end,
    exit = function()
      hovered_workspaces[workspace_name] = false
      sync_space_background(space, workspace_name)
    end,
  })

  space:subscribe("mouse.clicked", function()
    sbar.exec(string.format("aerospace workspace %q", workspace_name))
  end)

  sync_space_background(space, workspace_name)
  spaces[workspace_name] = space
end

local function rebuild_spaces(workspace_names)
  clear_spaces()
  rendered_workspaces = workspace_names

  local space_names = {}

  for i, workspace_name in ipairs(rendered_workspaces) do
    add_space_item(workspace_name, i, #rendered_workspaces)
    table.insert(space_names, "space." .. workspace_name)
  end

  sbar.add("bracket", "spaces_bracket", space_names, {
    background = {
      color = colors.crust,
      corner_radius = settings.item.corner_radius,
      height = settings.bar.height,
      padding_left = 0,
      padding_right = 0
    },
  })

  sbar.exec("sketchybar --move front_app after spaces_bracket")
end

local function cancel_refresh_retry()
  refresh_retry_token = refresh_retry_token + 1
  refresh_retry_pending = false
end

local function schedule_refresh_retry()
  if refresh_retry_pending then
    return
  end

  refresh_retry_pending = true
  refresh_retry_token = refresh_retry_token + 1
  local retry_token = refresh_retry_token

  sbar.exec("sleep 2", function()
    if retry_token ~= refresh_retry_token then
      return
    end

    refresh_retry_pending = false
    refresh_spaces()
  end)
end

local function refresh_focused_workspace()
  sbar.exec("aerospace list-workspaces --focused", function(result)
    if type(result) ~= "string" then
      return
    end

    local workspace_name = result:match("^%s*(.-)%s*$")
    if workspace_name ~= nil and workspace_name ~= "" then
      set_focused_workspace(workspace_name)
    end
  end)
end

refresh_spaces = function(next_focused_workspace)
  sbar.exec("$CONFIG_DIR/scripts/workspaces.sh", function(result)
    local workspace_names = normalize_workspaces(result)
    if #workspace_names == 0 then
      schedule_refresh_retry()
      return
    end

    cancel_refresh_retry()

    if not has_same_workspaces(workspace_names) then
      rebuild_spaces(workspace_names)
    end

    if next_focused_workspace ~= nil and next_focused_workspace ~= "" then
      if spaces[next_focused_workspace] ~= nil then
        set_focused_workspace(next_focused_workspace)
        return
      end
    elseif focused_workspace ~= nil and spaces[focused_workspace] ~= nil then
      return
    end

    refresh_focused_workspace()
  end)
end

local spaces_observer = sbar.add("item", "spaces.observer", {
  drawing = false,
  updates = true,
})

spaces_observer:subscribe("aerospace_workspace_change", function(env)
  local next_focused_workspace = env.FOCUSED_WORKSPACE
  if next_focused_workspace ~= nil and next_focused_workspace ~= "" then
    focused_workspace = next_focused_workspace
    sync_all_space_backgrounds()
  end

  refresh_spaces(next_focused_workspace)
end)

spaces_observer:subscribe("forced", function()
  refresh_spaces()
end)

spaces_observer:subscribe("system_woke", function()
  refresh_spaces()
end)

refresh_spaces()
