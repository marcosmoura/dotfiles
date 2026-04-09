# Load secrets from ~/.secrets/ directory
# Each file contains a single value (no export, no quotes)

_load_secret() {
  local var_name="$1" file_path="$2"
  if [[ -r "$file_path" ]]; then
    export "$var_name"="$(<$file_path)"
  fi
}

_load_secret CONTEXT7_API_KEY ~/.secrets/context7-key
_load_secret GH_PAT ~/.secrets/gh-pat-key

unfunction _load_secret
