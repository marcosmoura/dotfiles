local getArgsAsString = function(args)
  local arguments = args or ""

  if type(args) == "string" then
    arguments = args
  end

  if type(args) == "table" then
    arguments = table.concat(args, " ")
  end

  return arguments
end

local parseOutput = function(output, toJson)
  if toJson and output ~= "" then
    return hs.json.decode(output or {}) or {}
  end

  return output
end

local function execute(commandPath, args, opts)
  local arguments = getArgsAsString(args)
  local options = opts or {}

  local command = commandPath .. " " .. arguments
  local stdOut, status = hs.execute(command)
  local output = parseOutput(stdOut, options.json)

  if not status then
    if not options.silent then
      print("Error executing command:")
      print(command)
      Print(stdOut)
    end

    return output, false
  end

  return output, true
end

return execute
