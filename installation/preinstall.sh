print_text "🔑 Authenticating"
sudo -v

# Keep-alive: update existing `sudo` time stamp until `.osx` has finished
print_text ""
while true; do sudo -n true; sleep 60; kill -0 "$$" || exit; done 2>/dev/null &
