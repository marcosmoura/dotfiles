return {
  {
    "folke/snacks.nvim",
    opts = {
      dashboard = {
        width = 80,
        sections = {
          {
            section = "terminal",
            cmd = "lolcat --seed 85 ~/.config/nvim/static/neovim.cat",
            align = "center",
            hl = "header",
            padding = 0,
          },

          function()
            local directory = vim.fn.expand("%:p:h")

            return {
              text = {
                {
                  " ",
                  hl = "SnacksDashboardIcon",
                },
                {
                  " Current directory: ",
                  hl = "SnacksDashboardHeader",
                },
                {
                  directory,
                  hl = "SnacksDashboardKey",
                },
              },
              padding = { 1, 0 },
              height = 1,
              align = "center",
            }
          end,

          {
            section = "projects",
            title = "Sessions",
            icon = " ",
            indent = 3,
            padding = { 1, 0 },
          },

          function()
            local in_git = Snacks.git.get_root() ~= nil

            return {
              {
                section = "terminal",
                title = "Pull Request Review Needed",
                icon = " ",
                cmd = [[
echo "";
gh pr list -L 5 --search 'user-review-requested:@me' \
--json author,title,updatedAt \
--template '
  {{- if not . -}}
    No pull request review needed.
  {{- else -}}
    {{- tablerow ("Author" | color "yellow+u") ("Title" | color "yellow+u") ("Updated at" | color "yellow+u") (" ") -}}
    {{ range . }}
      {{- tablerow (.author.name | color "79") (.title) (timeago .updatedAt | color "243") (" ") -}}
    {{ end }}
  {{- end -}}
'
                ]],
                key = "p",
                action = function()
                  vim.fn.jobstart(
                    "gh pr list --search 'is:open draft:false user-review-requested:@me' --web",
                    { detach = true }
                  )
                end,
                enabled = in_git,
                padding = { 1, 1 },
                indent = 3,
                height = 7,
              },
            }
          end,

          {
            section = "keys",
            title = "Keymaps",
            icon = " ",
            indent = 3,
            padding = 1,
          },
          {
            section = "startup",
          },
        },
      },
    },
  },
}
