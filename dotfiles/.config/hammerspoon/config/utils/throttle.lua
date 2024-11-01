local throttle = function(fn, timeout)
  local timer = nil
  local last = 0

  return function(...)
    local args = { ... }
    local now = hs.timer.secondsSinceEpoch()

    if now - last < timeout then
      if timer then
        timer:stop()
        timer = nil
      end

      timer = hs.timer.doAfter(timeout, function()
        fn(table.unpack(args))
        timer = nil
        last = hs.timer.secondsSinceEpoch() or 0
      end)
    else
      fn(table.unpack(args))
      last = hs.timer.secondsSinceEpoch() or 0
    end
  end
end

return throttle
