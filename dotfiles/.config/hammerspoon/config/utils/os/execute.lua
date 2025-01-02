--- Parse arguments and return a string
--- @param args string[]|string
--- @return string
local getArgsAsString = function(args)
  local arguments = ""

  if type(args) == "string" then
    arguments = args
  end

  if type(args) == "table" then
    arguments = table.concat(args, " ")
  end

  return arguments
end

--- Parse output and return a table
--- @param output string
--- @param options table
local parseOutput = function(output, options)
  if (options.json or options.format == "json") and output ~= "" then
    return hs.json.decode(output or {}) or {}
  end

  if options.format == "string" then
    return string.gsub(output, "^%s*(.-)%s*$", "%1")
  end

  return output
end

--- @class ExecuteOptions
--- @field silent? boolean
--- @field json? boolean
--- @field format? "json"|"string"

---@alias ExecuteOutput table|string
---@alias ExecuteResult boolean
---@alias ExecuteArgs string[]|string

--- Execute a command
--- @param commandPath string
--- @param args ExecuteArgs
--- @param opts? ExecuteOptions
--- @return ExecuteOutput, ExecuteResult
local function execute(commandPath, args, opts)
  local arguments = getArgsAsString(args)
  local options = opts or {}

  local command = commandPath .. " " .. arguments
  local stdOut, status = hs.execute(command)
  local output = parseOutput(stdOut or "", options)

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
