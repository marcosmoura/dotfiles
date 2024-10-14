local module = {}

local on_audio_change = function()
  local audio_interface = hs.audiodevice.findOutputByName("MiniFuse")
  local airpods = hs.audiodevice.findOutputByName("AirPods")
  local dedicated_speakers = hs.audiodevice.findOutputByName("Speakers")
  local integrated_speakers = hs.audiodevice.findOutputByName("MacBook Pro Speakers")
  local current = hs.audiodevice.defaultOutputDevice()
  local target = hs.audiodevice.defaultOutputDevice()

  if airpods then
    target = airpods
  elseif audio_interface and dedicated_speakers then
    target = dedicated_speakers
  elseif integrated_speakers then
    target = integrated_speakers
  end

  if current and target and current:name() ~= target:name() then
    target:setDefaultOutputDevice()
    target:setDefaultEffectDevice()

    print("Default output device set to " .. target:name())
  end
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
