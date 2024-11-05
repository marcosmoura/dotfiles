local lVer = _VERSION:match("Lua (.+)$")
local luarocks = tostring(hs.execute("which luarocks")):gsub("\n", "")

if #luarocks > 0 then
  local lrPath = tostring(hs.execute(luarocks .. " --lua-version " .. lVer .. " path --lr-path")):gsub("\n", "")
  local lrCpath = tostring(hs.execute(luarocks .. " --lua-version " .. lVer .. " path --lr-cpath")):gsub("\n", "")

  package.path = package.path .. ";" .. lrPath
  package.cpath = package.cpath .. ";" .. lrCpath
end

Print = function(...)
  hs.printf(hs.inspect(...))
end
