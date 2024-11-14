local module = {}

module.start = function()
  local logLevel = DEBUG and "info" or "error"

  hs.window.animationDuration = 0
  hs.grid.setMargins({ 20, 20 })

  hs.allowAppleScript(true)
  hs.autoLaunch(true)
  hs.automaticallyCheckForUpdates(true)
  hs.consoleOnTop(true)
  hs.dockIcon(false)
  hs.menuIcon(true)
  hs.uploadCrashData(false)

  hs.hotkey.setLogLevel(logLevel)
  hs.logger.defaultLogLevel = logLevel
end

return module
