--- @class ExecuteOptions
--- @field silent? boolean
--- @field json? boolean
--- @field format? "json"|"string"
--- @field userenv? boolean

---@alias ExecuteOutput table|string
---@alias ExecuteResult boolean
---@alias ExecuteArgs string[]|string

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
--- @param options ExecuteOptions
--- @return ExecuteOutput
local parseOutput = function(output, options)
  if (options.json or options.format == "json") and output ~= "" then
    return hs.json.decode(output or {}) or {}
  end

  if options.format == "string" then
    return string.gsub(output, "^%s*(.-)%s*$", "%1") or ""
  end

  return output
end

--- Get default options
--- @param opts? ExecuteOptions
local getDefaultOptions = function(opts)
  local options = opts or {}

  options.silent = options.silent or false
  options.json = options.json or false
  options.format = options.format or "string"
  options.userenv = options.userenv or false

  return options
end

--- Execute a command
--- @param commandPath string
--- @param args ExecuteArgs
--- @param opts? ExecuteOptions
--- @return ExecuteOutput, ExecuteResult
local function execute(commandPath, args, opts)
  local arguments = getArgsAsString(args)
  local options = getDefaultOptions(opts)

  local command = commandPath .. " " .. arguments
  local stdOut, status = hs.execute(command, options.userenv)
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
