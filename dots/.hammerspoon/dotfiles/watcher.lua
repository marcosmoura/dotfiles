return function ()
  ReloadConfiguration = hs.loadSpoon('ReloadConfiguration')
  ReloadConfiguration:bindHotkeys({
    reloadConfiguration = {{'cmd', 'alt', 'ctrl'}, 'R'}
  })
  ReloadConfiguration:start()
end
