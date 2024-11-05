local debounce = function(fn, timeout)
  local timer = nil

  return function(...)
    local args = { ... }

    if timer then
      timer:stop()
      timer = nil
    end

    timer = hs.timer.doAfter(timeout, function()
      fn(table.unpack(args))
      timer = nil
    end)
  end
end

return debounce
