local Promise = require("jls.lang.Promise")
local json = require("jls.util.json")

local function run(executable, args, opts)
  local options = opts or {
    type = "string",
  }
  local task_output = ""
  local task_error = ""

  local promise = Promise:new(function(resolve, reject)
    local arguments = {}

    if type(args) == "table" then
      arguments = args
    end

    if type(args) == "string" then
      arguments = hs.fnutils.split(args, " ")
    end

    local task = hs.task.new(executable, nil, function(_, stdout, stderr)
      if stdout ~= nil then
        task_output = task_output .. stdout
      end

      if stderr ~= nil then
        task_error = task_error .. stderr
      end

      return true
    end, arguments)

    task:setCallback(function()
      if task_error ~= "" then
        resolve(task_error)
      end

      if options.type == "json" then
        task_output = json.decode(task_output)
      end

      resolve(task_output)
    end)

    task:start()
  end)

  promise:catch(function(error)
    print(error)
  end)

  return promise
end

local promise_with_pcall = function(fn)
  return Promise.async(function(await)
    local new_await = function(promise)
      local success, result = pcall(function()
        return await(promise)
      end)

      local error_messages = {
        "can not ",
        "cannot ",
        "could not ",
        "does not",
        "ignoring request",
        "is a reserved keyword",
        "is already",
        "is not ",
        "unknown ",
        "was not ",
      }

      local result_string = json.stringify(result)
      for _, message in ipairs(error_messages) do
        local lower_result = string.lower(result_string)

        if string.find(lower_result, message) ~= nil then
          return "", result
        end
      end

      if success == true then
        return result, ""
      end

      return "", result
    end

    return fn(new_await)
  end)
end

local to_async = function(fn)
  return function()
    return promise_with_pcall(fn)
  end
end

return {
  run = run,
  to_async = to_async,
  async = promise_with_pcall,
}
