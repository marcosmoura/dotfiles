local function execute(commandPath, args, opts)
  local arguments = args or ""
  local options = opts or {}

  if type(args) == "string" then
    arguments = args
  end

  if type(args) == "table" then
    arguments = table.concat(args, " ")
  end

  local command = commandPath .. " " .. arguments
  local output, status = hs.execute(command)

  if not status then
    print("Error executing command: " .. command)
    print(output)

    if options.json then
      return {}, status
    end

    return "", status
  end

  if options.json then
    return hs.json.decode(output or {}) or {}, status
  end

  return output or "", status
end

return execute
