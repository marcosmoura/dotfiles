local alert = require 'hs.alert'

return function ()
  alert.show(os.date('%A %b %d'), 3)
end
