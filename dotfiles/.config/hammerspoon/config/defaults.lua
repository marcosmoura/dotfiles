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

  require("hs.ipc")

  hs.ipc.cliSaveHistory(true)
  hs.ipc.cliSaveHistorySize(99999)

  if not hs.ipc.cliStatus() then
    hs.ipc.cliInstall()
  end
end

return module
