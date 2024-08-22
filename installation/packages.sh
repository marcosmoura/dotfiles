print_start "Building packages"

pushd packages/phoenix >/dev/null
pnpm i
pnpm run build
popd >/dev/null

print_success "All packages were built! \n"
