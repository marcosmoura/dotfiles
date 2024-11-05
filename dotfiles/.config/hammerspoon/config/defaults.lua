local module = {}

module.start = function()
  hs.window.animationDuration = 0
  hs.grid.setMargins({ 16, 16 })

  hs.allowAppleScript(true)
  hs.autoLaunch(true)
  hs.automaticallyCheckForUpdates(true)
  hs.consoleOnTop(true)
  hs.dockIcon(false)
  hs.menuIcon(true)
  hs.uploadCrashData(false)

  hs.hotkey.setLogLevel(DEBUG and "info" or "error")
  hs.logger.defaultLogLevel = DEBUG and "info" or "error"
  hs.ipc.cliUninstall()
  hs.ipc.cliInstall()
end

return module
