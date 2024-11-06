local function memoize(fn)
  local cache = {}

  return function(...)
    local args = { ... }
    local keyParts = {}

    for i, v in ipairs(args) do
      keyParts[i] = tostring(v)
    end

    local key = table.concat(keyParts, ",")

    if not cache[key] then
      cache[key] = fn(...)
    end

    return cache[key]
  end
end

return memoize
