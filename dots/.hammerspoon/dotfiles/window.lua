return function ()
  local customBindings = {
    center = {
      {{'cmd', 'option'}, 'down'}
    },
    fullscreen = {
      {{'cmd', 'option'}, 'up'}
    }
  }

  Lunette = hs.loadSpoon('Lunette')
  Lunette:bindHotkeys(customBindings)
end
