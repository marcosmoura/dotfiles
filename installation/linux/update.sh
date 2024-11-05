print_progress "Updating packages"

yay -Y --gendb
yay -Syyuu --noconfirm
