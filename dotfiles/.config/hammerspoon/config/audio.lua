local module = {}

local onAudioChange = function()
  local current = hs.audiodevice.defaultOutputDevice()
  local airpods = hs.audiodevice.findOutputByUID("2C-32-6A-F0-42-7B:output")
  local speakers = hs.audiodevice.findInputByUID("ProxyAudioDevice_UID")
  local audioInterface = hs.audiodevice.findInputByUID("ARTURIA MiniFuse 2")
  local macbookPro = hs.audiodevice.findDeviceByUID("BuiltInSpeakerDevice")
  local targetDevice = airpods or (audioInterface and speakers or macbookPro) or current

  if not targetDevice or current and current:name() == targetDevice:name() then
    return
  end

  targetDevice:setDefaultOutputDevice()
  targetDevice:setDefaultEffectDevice()
  print("Default output device set to " .. targetDevice:name())
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
