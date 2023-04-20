print_start "Building packages"

pushd packages/phoenix > /dev/null
yarn install
yarn build
popd > /dev/null

print_success "All packages were built! \n"
