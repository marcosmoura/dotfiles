print_start "Installing Go packages"

go install github.com/mattn/efm-langserver@latest
go install mvdan.cc/sh/v3/cmd/shfmt@latest

print_success "Go installed! \n"
