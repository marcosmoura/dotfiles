# Dotfiles (Work)

Work machine dotfiles — a reduced but still full-featured setup with zsh, Neovim, and managed language runtimes.

## Quick Start

```bash
# Clone for work machine
git clone -b work git@github.com:marcosmoura/dotfiles.git ./dotfiles

# Run full installation
cd ./dotfiles
./install.sh --all
```

## Architecture

```text
dotfiles/
├── install.sh              # Entry point (--all, --core, --module, --dry-run)
├── packages/               # Declarative package lists
│   ├── Brewfile            # Declarative Homebrew packages (brew bundle)
│   ├── node-globals.txt    # Node.js global packages
│   ├── luarocks.txt        # Lua packages installed via luarocks
│   ├── gems.txt            # Ruby gems
│   └── cargo-binaries.txt  # Rust cargo-installed binaries
├── installation/
│   ├── core/               # Always runs (in order)
│   │   ├── preinstall.sh   # Sudo auth, Xcode CLI tools
│   │   ├── brew.sh         # Homebrew + brew bundle
│   │   ├── symlinks.sh     # Symlinks + stale link cleanup
│   │   ├── macos.sh        # macOS system defaults
│   │   └── postinstall.sh  # Cleanup + summary
│   ├── modules/            # Opt-in, runnable after core
│   │   ├── zsh.sh          # Shell setup
│   │   ├── node.sh         # Node.js, Bun, pnpm, globals via mise
│   │   ├── lua.sh          # Lua packages via luarocks
│   │   ├── python.sh       # Python + shared virtualenv via uv
│   │   ├── ruby.sh         # Ruby + gems via mise
│   │   └── rust.sh         # Rust toolchain + cargo binaries
│   └── lib/
│       └── utils.sh        # Shared utilities (logging, retry, etc.)
├── home/                   # Symlinked to ~/
│   ├── .zprofile           # Login shell: PATH, env vars
│   ├── .zshrc              # Interactive shell: plugins, prompt
│   └── .config/            # XDG configs (git, nvim, zsh, bat, mise, etc.)
└── static/                 # Assets (keyboard layouts)
```

## Usage

```bash
# Full installation (core + all modules)
./install.sh --all

# Core only (brew, symlinks, macOS settings)
./install.sh --core

# Specific modules
./install.sh --module node rust

# Dry run (symlinks go to .cache/ for inspection)
./install.sh --dry-run
```

> Note: the installer replaces an existing `~/.config` directory with the repo symlink. Set `DOTFILES_SYMLINK_BACKUP=1` if you want the existing directory renamed instead of removed.

## Branch Strategy

This repository uses **separate branches per machine**:

- **`personal`** — Full personal development setup
- **`work`** — Work machine (reduced scope, but still includes Neovim and managed runtimes)

Each machine clones its own branch directly:

```bash
git clone -b <branch> git@github.com:marcosmoura/dotfiles.git ~/Projects/dotfiles
```

> **Note:** Git worktrees (`.worktrees/`) are for development only — not for deployment.
> To develop across branches simultaneously, use worktrees locally.

## Secrets

Secrets are stored outside the repository in `~/.secrets/`.
The install script creates this directory. Populate it manually after installation.

## Git Identity

On first install, `install.sh` prompts for your Git name and email,
creating `~/.config/git/identity` (not tracked by git).
On subsequent installs, the existing identity is preserved.
