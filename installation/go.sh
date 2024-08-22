print_start "Installing Go"

if ! brew ls --versions go >/dev/null; then
  brew install go
fi

print_progress "Installing go packages"

go install github.com/mattn/efm-langserver@latest
go install mvdan.cc/sh/v3/cmd/shfmt@latest

print_success "Go installed! \n"
