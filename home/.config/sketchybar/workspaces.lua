local names = {
  "terminal",
  "coding",
  "browser",
  "design",
  "communication",
  "files",
  "tasks",
}

local order = {}
for index, name in ipairs(names) do
  order[name] = index
end

return {
  names = names,
  order = order,
}
