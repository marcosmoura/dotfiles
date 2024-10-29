local lVer = _VERSION:match("Lua (.+)$")
local luarocks = tostring(hs.execute("which luarocks")):gsub("\n", "")

if #luarocks > 0 then
  local lr_path = tostring(hs.execute(luarocks .. " --lua-version " .. lVer .. " path --lr-path")):gsub("\n", "")
  local lr_cpath = tostring(hs.execute(luarocks .. " --lua-version " .. lVer .. " path --lr-cpath")):gsub("\n", "")

  package.path = package.path .. ";" .. lr_path
  package.cpath = package.cpath .. ";" .. lr_cpath
end
