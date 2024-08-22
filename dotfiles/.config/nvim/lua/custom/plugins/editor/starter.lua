return {
  "echasnovski/mini.starter",
  version = false,
  event = "VimEnter",
  config = function()
    local starter = require("mini.starter")
    local lazy = require("lazy")

    local greeting = function()
      local hour = tonumber(vim.fn.strftime("%H"))
      local part_id = math.floor((hour + 4) / 8) + 1
      local day_part = ({ "evening", "morning", "afternoon", "evening" })[part_id]

      return ("Good %s, %s"):format(day_part, "Marcos")
    end

    local get_header = (function()
      local timer = vim.loop.new_timer()

      local get_date = function()
        return os.date("%A %d/%m/%y %X")
      end

      local date = get_date()

      timer:start(
        0,
        1000,
        vim.schedule_wrap(function()
          if vim.api.nvim_buf_get_option(0, "filetype") ~= "starter" then
            timer:stop()
            return
          end

          date = get_date()
          starter.refresh()
        end)
      )

      return function()
        return greeting() .. " - " .. date
      end
    end)()

    local new_section = function(name, action, section)
      return { name = name, action = action, section = section }
    end

    -- close Lazy and re-open when starter is ready
    if vim.o.filetype == "lazy" then
      vim.cmd.close()
      vim.api.nvim_create_autocmd("User", {
        pattern = "MiniStarterOpened",
        callback = function()
          lazy.show()
        end,
      })
    end

    starter.setup({
      evaluate_single = true,
      items = {
        starter.sections.sessions(5, true),
        new_section("Find file", "FzfLua files", "Fzf"),
        new_section("Recent files", "FzfLua oldfiles", "Fzf"),
        new_section("Grep text", "FzfLua live_grep", "Fzf"),
        new_section("Lazy", "Lazy", "Built-in"),
        new_section("Mason", "Mason", "Built-in"),
        new_section("New file", "ene | startinsert", "Built-in"),
        new_section("Quit", "qa", "Built-in"),
      },
      header = get_header,
      footer = "",
      content_hooks = {
        starter.gen_hook.adding_bullet(),
        starter.gen_hook.aligning("center", "center"),
        starter.gen_hook.indexing("all", { "Builtin actions" }),
      },
    })

    vim.api.nvim_create_autocmd("User", {
      pattern = "LazyVimStarted",
      callback = function()
        if vim.api.nvim_buf_get_option(0, "filetype") ~= "starter" then
          return
        end

        local stats = lazy.stats()
        local ms = (math.floor(stats.startuptime + 0.5))

        starter.config.footer = "⚡ Neovim loaded " .. stats.count .. " plugins in " .. ms .. "ms"
        starter.refresh()
      end,
    })
  end,
}
