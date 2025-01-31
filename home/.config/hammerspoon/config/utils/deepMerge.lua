--- Deep merge two tables
--- @param t1 table
--- @param t2 table
--- @return table
local function deepMerge(t1, t2)
  local t = hs.fnutils.copy(t1) or {}

  for k, v in pairs(t2) do
    if type(v) == "table" and type(t[k] or false) == "table" then
      t[k] = deepMerge(t[k], v)
    else
      t[k] = v
    end
  end

  return t
end

return deepMerge
