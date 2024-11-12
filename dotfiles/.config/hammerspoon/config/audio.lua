local module = {}

local function findDeviceByName(devices, name)
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
end

local getTargetOutputDevice = function(current)
  local outputDevices = hs.audiodevice.allOutputDevices()

  local airpods = findDeviceByName(outputDevices, "airpods")
  local teamsAudio = findDeviceByName(outputDevices, "microsoft teams audio")
  local speakers = findDeviceByName(outputDevices, "external speakers")
  local audioInterface = findDeviceByName(outputDevices, "minifuse")
  local macbookPro = findDeviceByName(outputDevices, "MacBook Pro")

  if airpods then
    return airpods
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
end

local handleOutputDeviceChange = function()
  local current = hs.audiodevice.defaultOutputDevice()
  local targetDevice = getTargetOutputDevice(current)

  if not targetDevice or current and current:name() == targetDevice:name() then
    return
  end

  targetDevice:setDefaultOutputDevice()
  targetDevice:setDefaultEffectDevice()
  print("Default output device set to " .. targetDevice:name())
end

local handleInputDeviceChange = function()
  local inputDevices = hs.audiodevice.allInputDevices()

  local current = hs.audiodevice.defaultInputDevice()
  local airpods = findDeviceByName(inputDevices, "airpods")
  local externalMic = findDeviceByName(inputDevices, "at2020usb")
  local macbookPro = findDeviceByName(inputDevices, "MacBook Pro")
  local targetDevice = externalMic or airpods or macbookPro

  if not targetDevice or current and current:name() == targetDevice:name() then
    return
  end

  targetDevice:setDefaultInputDevice()
  print("Default input device set to " .. targetDevice:name())
end

local onAudioChange = function()
  handleOutputDeviceChange()
  handleInputDeviceChange()
end

module.start = function()
  hs.caffeinate.watcher.new(onAudioChange):start()
  hs.usb.watcher.new(onAudioChange):start()
  hs.screen.watcher.newWithActiveScreen(onAudioChange):start()
  hs.audiodevice.watcher.setCallback(onAudioChange)
  hs.audiodevice.watcher.start()

  onAudioChange()
end

return module
