local module = {}

local on_audio_change = function()
  local current = hs.audiodevice.defaultOutputDevice()
  local airpods = hs.audiodevice.findOutputByUID("2C-32-6A-F0-42-7B:output")
  local speakers = hs.audiodevice.findInputByUID("ProxyAudioDevice_UID")
  local audio_interface = hs.audiodevice.findInputByUID("ARTURIA MiniFuse 2")
  local macbook_pro = hs.audiodevice.findDeviceByUID("BuiltInSpeakerDevice")
  local target_device = airpods or (audio_interface and speakers or macbook_pro) or current

  if not target_device or current and current:name() == target_device:name() then
    return
  end

  target_device:setDefaultOutputDevice()
  target_device:setDefaultEffectDevice()
  print("Default output device set to " .. target_device:name())
end

module.start = function()
  hs.caffeinate.watcher.new(on_audio_change):start()
  hs.usb.watcher.new(on_audio_change):start()
  hs.screen.watcher.newWithActiveScreen(on_audio_change):start()
  hs.audiodevice.watcher.setCallback(on_audio_change)
  hs.audiodevice.watcher.start()

  on_audio_change()
end

return module
