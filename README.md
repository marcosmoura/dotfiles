# Dotfiles (Work)

Work machine dotfiles — limited scope setup with zsh and Node.js only.

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
│   └── node-globals.txt    # Node.js global packages
├── installation/
│   ├── core/               # Always runs (in order)
│   │   ├── preinstall.sh   # Sudo auth, Xcode CLI tools
│   │   ├── brew.sh         # Homebrew + brew bundle
│   │   ├── symlinks.sh     # Symlinks + stale link cleanup
│   │   ├── macos.sh        # macOS system defaults
│   │   └── postinstall.sh  # Cleanup + summary
│   ├── modules/            # Opt-in, runnable after core
│   │   ├── zsh.sh          # Shell setup + sheldon plugins
│   │   └── node.sh         # Node.js global packages via pnpm
│   └── lib/
│       └── utils.sh        # Shared utilities (logging, retry, etc.)
├── home/                   # Symlinked to ~/
│   ├── .zprofile           # Login shell: PATH, env vars
│   ├── .zshrc              # Interactive shell: plugins, prompt
│   └── .config/            # XDG configs (git, zsh, etc.)
└── static/                 # Assets (keyboard layouts)
```

## Usage

```bash
# Full installation (core + all modules)
./install.sh --all

# Core only (brew, symlinks, macOS settings)
./install.sh --core

# Specific modules (zsh, node)
./install.sh --module node

# Dry run (symlinks go to .cache/ for inspection)
./install.sh --dry-run
```

> Note: the installer replaces an existing `~/.config` directory with the repo symlink. Set `DOTFILES_SYMLINK_BACKUP=1` if you want the existing directory renamed instead of removed.

## Branch Strategy

This repository uses **separate branches per machine**:

- **`personal`** — Full personal development setup
- **`work`** — Work machine (limited scope: zsh and node only)

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
