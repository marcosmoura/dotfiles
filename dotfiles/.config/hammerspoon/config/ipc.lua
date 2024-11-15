require("hs.ipc")

local module = {}

module.start = function()
  hs.ipc.cliSaveHistory(true)
  hs.ipc.cliSaveHistorySize(99999)

  if not hs.ipc.cliStatus() then
    hs.ipc.cliInstall()
  end
end

return module
