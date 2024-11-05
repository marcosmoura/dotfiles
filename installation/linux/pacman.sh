print_progress "Setting up pacman"

sudo pacman-key --init
sudo pacman-key --populate
sudo pacman -S --needed git base-devel --noconfirm
sudo pacman -Sy archlinux-keyring --noconfirm
