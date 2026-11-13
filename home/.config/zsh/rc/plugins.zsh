# Plugins, and the half of this config that loads after the first prompt.
#
# ~/.config/sheldon/plugins.toml lists both, in load order. `sheldon source`
# turns that list into zsh code. It takes a fork of about 15 ms, so the code is
# kept in a file and rebuilt only when the list or sheldon's lock file changes.

# Settings the plugins read when they load
ZSH_AUTOSUGGEST_HIGHLIGHT_STYLE='fg=#888'
YSU_MODE=ALL

_plugins=$ZSH_CACHE/plugins.zsh
_plugins_list=${XDG_CONFIG_HOME:-$HOME/.config}/sheldon/plugins.toml
_plugins_lock=${XDG_DATA_HOME:-$HOME/.local/share}/sheldon/plugins.lock

if [[ ! -s $_plugins || $_plugins_list -nt $_plugins || $_plugins_lock -nt $_plugins ]]; then
  (($+commands[sheldon])) && sheldon source >|$_plugins.$$ && mv -f $_plugins.$$ $_plugins && zcompile $_plugins
fi

# Sourced here and not inside a function, so that what the plugins declare at
# their top level stays global.
[[ -s $_plugins ]] && source $_plugins
unset _plugins _plugins_list _plugins_lock
