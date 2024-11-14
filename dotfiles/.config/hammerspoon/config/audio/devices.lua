local memoize = require("config.utils.memoize")

local module = {}

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

local getTargetOutputDevice = memoize(function(devices)
  local airpods = findDeviceByName(devices, "airpods")
  local teamsAudio = findDeviceByName(devices, "microsoft teams audio")
  local speakers = findDeviceByName(devices, "external speakers")
  local audioInterface = findDeviceByName(devices, "minifuse")
  local macbookPro = findDeviceByName(devices, "MacBook Pro")

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

  return nil
end)

local normalizeBalance = function(balance)
  return string.format("%.4f", balance)
end

local setSpeakersBalance = memoize(function(devices)
  local speakers = findDeviceByName(devices, "external speakers")

  if not speakers then
    return
  end

  local targetAudioBalance = 0.4625

  if normalizeBalance(speakers:balance()) == normalizeBalance(targetAudioBalance) then
    return
  end

  print(string.format("Setting %s balance to %s", speakers:name(), targetAudioBalance))

  speakers:setBalance(targetAudioBalance)
end)

local handleOutputDeviceChange = function()
  local current = hs.audiodevice.defaultOutputDevice()
  local outputDevices = hs.audiodevice.allOutputDevices()
  local targetDevice = getTargetOutputDevice(outputDevices) or current

  if not targetDevice or current and current:name() == targetDevice:name() then
    return
  end

  setSpeakersBalance(outputDevices)

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
  local targetDevice = externalMic or airpods or macbookPro or current

  if not targetDevice or current and current:name() == targetDevice:name() then
    return
  end

  targetDevice:setDefaultInputDevice()
  print("Default input device set to " .. targetDevice:name())
end

local onAudioDeviceChange = function()
  handleOutputDeviceChange()
  handleInputDeviceChange()
end

module.start = function()
  hs.caffeinate.watcher.new(onAudioDeviceChange):start()
  hs.usb.watcher.new(onAudioDeviceChange):start()
  hs.screen.watcher.newWithActiveScreen(onAudioDeviceChange):start()
  hs.audiodevice.watcher.setCallback(function()
    onAudioDeviceChange()
  end)
  hs.audiodevice.watcher.start()

  onAudioDeviceChange()
end

return module
