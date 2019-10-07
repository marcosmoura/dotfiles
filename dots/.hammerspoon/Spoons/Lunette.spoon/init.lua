local obj = {}
obj.__index = obj

-- Metadata
obj.name = "Lunette"
obj.version = "0.4"
obj.author = "Scott Hudson <scott.w.hudson@gmail.com>"
obj.license = "MIT"
obj.homepage = "https://github.com/scottwhudson/Lunette"

-- disable animation
hs.window.animationDuration = 0

-- Internal function used to find our location, so we know where to load files from
local function script_path()
  local str = debug.getinfo(2, "S").source:sub(2)
  return str:match("(.*/)")
end
obj.spoonPath = script_path()

obj.Command = dofile(obj.spoonPath.."/command.lua")
obj.history = dofile(obj.spoonPath.."/history.lua"):init()

obj.DefaultMapping = {
  leftHalf = {
    {{"cmd", "alt"}, "left"},
  },
  rightHalf = {
    {{"cmd", "alt"}, "right"},
  },
  topHalf = {
    {{"cmd", "alt", "shift"}, "up"},
  },
  bottomHalf = {
    {{"cmd", "alt", "shift"}, "down"},
  },
  topLeft = {
    {{"ctrl", "cmd"}, "left"},
  },
  topRight = {
    {{"ctrl", "cmd"}, "right"},
  },
  bottomLeft = {
    {{"ctrl", "cmd", "shift"}, "left"},
  },
  bottomRight = {
    {{"ctrl", "cmd", "shift"}, "right"},
  },
  fullScreen = {
    {{"cmd", "alt"}, "up"},
  },
  center = {
    {{"cmd", "alt"}, "down"},
  },
  nextThird = {
    {{"ctrl", "alt"}, "right"},
  },
  prevThird = {
    {{"ctrl", "alt"}, "left"},
  },
  enlarge = {
    {{"ctrl", "alt", "shift"}, "right"},
  },
  shrink = {
    {{"ctrl", "alt", "shift"}, "left"},
  },
  undo = {
    {{"alt", "cmd"}, "Z"},
  },
  redo = {
    {{"alt", "cmd", "shift"}, "Z"},
  },
  nextDisplay = {
    {{"ctrl", "alt", "cmd"}, "right"},
  },
  prevDisplay = {
    {{"ctrl", "alt", "cmd"}, "left"},
  }
}

function obj:bindHotkeys(userBindings)
  print("Lunette: Binding Hotkeys")

  local userBindings = userBindings or {}
  local bindings = self.DefaultMapping

  for command, mappings in pairs(userBindings) do
    bindings[command] = mappings
  end

  for command, mappings in pairs(bindings) do
    if mappings then
      for i, binding in ipairs(mappings) do
        hs.hotkey.bind(binding[1], binding[2], function()
          self:exec(command)
        end)
      end
    end
  end
end

function obj:exec(commandName)
  local window = hs.window.focusedWindow()
  local windowFrame = window:frame()
  local screen = window:screen()
  local screenFrame = screen:frame()
  local currentFrame = window:frame()
  local newFrame

  if commandName == "undo" then
    newFrame = self.history:retrievePrevState()
  elseif commandName == "redo" then
    newFrame = self.history:retrieveNextState()
  else
    print("Lunette: " .. commandName)
    print(self.Command[commandName])
    newFrame = self.Command[commandName](windowFrame, screenFrame)
    self.history:push(currentFrame, newFrame)
  end

  window:setFrame(newFrame)
end

return obj
