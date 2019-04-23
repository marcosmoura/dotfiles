local alert = require 'hs.alert'
local application = require 'hs.application'
local timer = require 'hs.timer'
local hotkey = require 'hs.hotkey'
local delay = 0.3
local killedIt = false

function pressedQ ()
  killedIt = false
  alert.show('⌘Q', { fadeInDuration = 0 }, 1)
  timer.usleep(1000000 * delay)
end

function repeatQ ()
  if killedIt then
    return
  end

  application.frontmostApplication():kill()
  killedIt = true
  alert.closeAll()
end

return function ()
  hotkey.bind('cmd', 'Q', pressedQ, nil, repeatQ)
end
