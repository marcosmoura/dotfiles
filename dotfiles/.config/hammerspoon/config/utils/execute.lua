local function execute(command_path, args, opts)
  local arguments = args or ""
  local options = opts or {}

  if type(args) == "string" then
    arguments = args
  end

  if type(args) == "table" then
    arguments = table.concat(args, " ")
  end

  local command = command_path .. " " .. arguments
  local output, status = hs.execute(command)

  if options.json then
    return hs.json.decode(output or {}) or {}, status
  end

  return output or "", status
end

return execute
