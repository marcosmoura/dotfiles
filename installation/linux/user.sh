print_progress "Setting up users"

user=marcosmoura

if ! grep -q "^$user" /etc/passwd; then
  passwd
  echo "%wheel ALL=(ALL) ALL" >/etc/sudoers.d/wheel
  useradd -m -G wheel -s /bin/bash $user
  passwd $user
fi
