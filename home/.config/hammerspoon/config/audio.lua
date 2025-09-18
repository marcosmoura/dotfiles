local memoize = require("config.utils.memoize")

local module = {}

--- Find a device by name
--- @param devices hs.audiodevice[]
--- @param name string
--- @return hs.audiodevice|nil
local findDeviceByName = memoize(function(devices, name)
  if not (devices or name) then
    return
  end

  local lowerName = string.lower(name)

  return hs.fnutils.find(devices, function(device)
    local deviceName = device:name()

    if not deviceName then
      return false
    end

    local lowerDeviceName = string.lower(deviceName)

    return string.find(lowerDeviceName, lowerName)
  end)
end)

--- Get the target output device
--- @param current hs.audiodevice
--- @param devices hs.audiodevice[]
--- @return hs.audiodevice
local getTargetOutputDevice = memoize(function(current, devices)
  local airpods = findDeviceByName(devices, "airpods")
  local teamsAudio = findDeviceByName(devices, "microsoft teams audio")
  local speakers = findDeviceByName(devices, "external speakers")
  local airplay = findDeviceByName(devices, "airplay")
  local audioInterface = findDeviceByName(devices, "minifuse")
  local macbookPro = findDeviceByName(devices, "MacBook Pro")

  if airpods then
    return airpods
  end

  if current == airplay then
    return current
  end

  if audioInterface then
    if teamsAudio and teamsAudio:inUse() then
      return teamsAudio
    end

    if speakers then
      return speakers
    end

    return macbookPro
  end

  return current
end)

--- Handle the output device change
local handleOutputDeviceChange = function()
  local current = hs.audiodevice.defaultOutputDevice()
  local outputDevices = hs.audiodevice.allOutputDevices()
  local targetDevice = getTargetOutputDevice(current, outputDevices)

  if current and current:name() == targetDevice:name() then
    return
  end

  targetDevice:setDefaultOutputDevice()
  targetDevice:setDefaultEffectDevice()
  print("Default output device set to " .. targetDevice:name())
end

--- Handle the input device change
local handleInputDeviceChange = function()
  local inputDevices = hs.audiodevice.allInputDevices()

  local current = hs.audiodevice.defaultInputDevice()
  local airpods = findDeviceByName(inputDevices, "airpods")
  local externalMic = findDeviceByName(inputDevices, "at2020usb")
  local macbookPro = findDeviceByName(inputDevices, "MacBook Pro")
  local targetDevice = externalMic or airpods or macbookPro or current

  if not targetDevice or current and current:name() == targetDevice:name() then
    return
  end

  targetDevice:setDefaultInputDevice()
  print("Default input device set to " .. targetDevice:name())
end

--- Handle the audio device change
local onAudioDeviceChange = function()
  handleOutputDeviceChange()
  handleInputDeviceChange()
end

module.start = function()
  hs.caffeinate.watcher.new(onAudioDeviceChange):start()
  hs.usb.watcher.new(onAudioDeviceChange):start()
  hs.screen.watcher.newWithActiveScreen(onAudioDeviceChange):start()
  hs.audiodevice.watcher.setCallback(onAudioDeviceChange)
  hs.audiodevice.watcher.start()

  onAudioDeviceChange()
end

return module
