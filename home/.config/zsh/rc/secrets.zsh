# API keys from ~/.secrets. Each file holds one value: no `export`, no quotes.

_load-secret() {
  [[ -r $2 ]] && export $1="$(<$2)"
}

_load-secret CONTEXT7_API_KEY ~/.secrets/context7-key
_load-secret GH_PAT ~/.secrets/gh-pat-key

unfunction _load-secret
