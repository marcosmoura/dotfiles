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

local handleOutputDeviceChange = function()
  local allDevices = hs.audiodevice.allOutputDevices()

  local current = hs.audiodevice.defaultOutputDevice()
  local airpods = findDeviceByName(allDevices, "airpods")
  local speakers = findDeviceByName(allDevices, "external speakers")
  local audioInterface = findDeviceByName(allDevices, "minifuse")
  local macbookPro = findDeviceByName(allDevices, "MacBook Pro")
  local targetDevice = airpods or (audioInterface and speakers or macbookPro) or current

  if not targetDevice or current and current:name() == targetDevice:name() then
    return
  end

  targetDevice:setDefaultOutputDevice()
  targetDevice:setDefaultEffectDevice()
  print("Default output device set to " .. targetDevice:name())
end

local handleInputDeviceChange = function()
  local allDevices = hs.audiodevice.allInputDevices()

  local current = hs.audiodevice.defaultInputDevice()
  local airpods = findDeviceByName(allDevices, "airpods")
  local externalMic = findDeviceByName(allDevices, "at2020usb")
  local macbookPro = findDeviceByName(allDevices, "MacBook Pro")
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
