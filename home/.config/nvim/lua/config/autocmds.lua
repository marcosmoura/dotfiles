local function augroup(name)
  return vim.api.nvim_create_augroup("custom_" .. name, { clear = true })
end

local function close_minifiles()
  require("mini.files").close()
end

--- Perform an action when the last buffer is deleted
--- @param callback function
local function on_last_buffer_deleted(callback)
  return function(event)
    local name = vim.api.nvim_buf_get_name(event.buf or 0)
    local filetype = vim.api.nvim_get_option_value("filetype", { buf = event.buf or 0 })
    local show_dashboard = not name and not filetype

    if show_dashboard then
      callback()
    end
  end
end

-- Open dashboard after last buffer is deleted
vim.api.nvim_create_autocmd("User", {
  group = augroup("snacks_dashboard"),
  pattern = "BDeletePost",
  callback = on_last_buffer_deleted(function()
    close_minifiles()
    require("snacks").dashboard.open()
    require("snacks").dashboard.update()
  end),
})

-- Reload dashboard on session load
vim.api.nvim_create_autocmd("User", {
  group = augroup("snacks_dashboard"),
  pattern = "PersistenceLoadPost",
  callback = on_last_buffer_deleted(function()
    close_minifiles()
    require("snacks").dashboard.update()
  end),
})
