#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# macOS Configuration Script
# Applies macOS system defaults
# =============================================================================

# Source utils if not already loaded
if ! command -v log_step &>/dev/null; then
  # shellcheck source=/dev/null
  source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../lib" && pwd)/utils.sh"
fi

log_step "Configuring macOS settings..."

# Environment variables supported:
#   DOTFILES_TIMEZONE                 Override timezone (default Europe/Prague)
#   DOTFILES_ENABLE_LEGACY_DEBUG=1    Enable legacy debug / dashboard settings

# Skip entirely in dry-run mode — defaults write has no undo
dry_run_guard "macOS settings" "Would apply macOS system defaults (not reversible)" && { return 0 2>/dev/null || exit 0; }

# Capture macOS version early for conditional tweaks
MACOS_VERSION="$(sw_vers -productVersion 2>/dev/null | awk -F '.' '{print $1"."$2}')"

# Close any open System Settings/Preferences panes, to prevent them from overriding
# settings we're about to change (System Preferences renamed to System Settings in macOS Ventura)
osascript -e 'tell application "System Settings" to quit' 2>/dev/null || osascript -e 'tell application "System Preferences" to quit' 2>/dev/null || true

###############################################################################
# General UI/UX
###############################################################################

# Mute the startup chime.
# Apple Silicon (all Macs supported by Tahoe 26) uses StartupMute; the legacy
# Intel key (SystemAudioVolume) is ignored on AS hardware.
sudo nvram StartupMute=%01 2>/dev/null || log_info "Skipping StartupMute (not supported)"

# Finder: show hidden files by default
defaults write com.apple.finder AppleShowAllFiles -bool true

# Make Dock icons of hidden applications translucent
defaults write com.apple.dock showhidden -bool true

# Don't show recent applications in Dock
defaults write com.apple.dock show-recents -bool false

# Set sidebar icon size to small
defaults write NSGlobalDomain NSTableViewDefaultSizeMode -int 1

# Always show scrollbars
defaults write NSGlobalDomain AppleShowScrollBars -string "Always"

# Expand save panel by default
defaults write NSGlobalDomain NSNavPanelExpandedStateForSaveMode -bool true
defaults write NSGlobalDomain NSNavPanelExpandedStateForSaveMode2 -bool true

# Expand print panel by default
defaults write NSGlobalDomain PMPrintingExpandedStateForPrint -bool true
defaults write NSGlobalDomain PMPrintingExpandedStateForPrint2 -bool true

# Save to disk (not to iCloud) by default
defaults write NSGlobalDomain NSDocumentSaveNewDocumentsToCloud -bool false

# Automatically quit printer app once the print jobs complete
defaults write com.apple.print.PrintingPrefs "Quit When Finished" -bool true

# Remove duplicates in the "Open With" menu (also see `lscleanup` alias)
# NOTE: This rebuilds the Launch Services database and can take 30-60s.
# Set DOTFILES_REBUILD_LSDB=1 to run it (skipped by default).
if [[ "${DOTFILES_REBUILD_LSDB:-0}" == "1" ]]; then
  /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -r -domain local -domain system -domain user
fi

# Display ASCII control characters using caret notation in standard text views
# Try e.g. `cd /tmp; unidecode "\x{0000}" > cc.txt; open -e cc.txt`
defaults write NSGlobalDomain NSTextShowsControlCharacters -bool true

# Disable Resume system-wide
defaults write com.apple.systempreferences NSQuitAlwaysKeepsWindows -bool false

# Reveal IP address, hostname, OS version, etc. when clicking the clock
# in the login window
sudo defaults write /Library/Preferences/com.apple.loginwindow AdminHostInfo HostName

# Disable automatic capitalization as it's annoying when typing code
defaults write NSGlobalDomain NSAutomaticCapitalizationEnabled -bool false

# Disable smart dashes as they're annoying when typing code
defaults write NSGlobalDomain NSAutomaticDashSubstitutionEnabled -bool false

# Disable automatic period substitution as it's annoying when typing code
defaults write NSGlobalDomain NSAutomaticPeriodSubstitutionEnabled -bool false

# Disable smart quotes as they're annoying when typing code
defaults write NSGlobalDomain NSAutomaticQuoteSubstitutionEnabled -bool false

# Disable auto-correct
defaults write NSGlobalDomain NSAutomaticSpellingCorrectionEnabled -bool false

# Disable icons in menu items (new default in macOS Tahoe 26 — adds visual clutter).
# Quit and relaunch individual apps for the change to take effect per-app.
defaults write -g NSMenuEnableActionImages -bool false

###############################################################################
# SSD-specific tweaks
###############################################################################

# Change hibernation mode and delete last image
# Check current setting using `pmset -g | grep hibernatemode`
# OS X hibernation has three modes:
#   0 = suspend to RAM only (default on desktops)
#   1 = suspend to disk only
#   3 = suspend to disk + RAM (default on laptops)
# If you suspend/resume often and you prefer not to wait, set it to `0`.
# The risk is that if you hibernate and run out of battery, or the RAM glitches,
# you might lose unsaved changes. Having the RAM backed up to disk means that you
# will always be able to resume.

sudo pmset -a hibernatemode 0 || log_info "Skipping hibernatemode (not supported)"

###############################################################################
# Trackpad, mouse, keyboard, Bluetooth accessories, and input
###############################################################################

# Enable full keyboard access for all controls
# (e.g. enable Tab in modal dialogs)
defaults write NSGlobalDomain AppleKeyboardUIMode -int 3

# Disable press-and-hold for keys in favor of key repeat
defaults write -g ApplePressAndHoldEnabled -bool false

# Set a faster keyboard repeat rate
defaults write NSGlobalDomain KeyRepeat -int 1
defaults write NSGlobalDomain InitialKeyRepeat -int 10

# Set the timezone (overridable). See `systemsetup -listtimezones` for values.
# systemsetup was deprecated in Ventura and may fail silently on Apple Silicon /
# Tahoe 26. We try it first and fall back to a direct /etc/localtime symlink.
TIMEZONE="${DOTFILES_TIMEZONE:-Europe/Prague}"
_set_timezone_fallback() {
  sudo ln -sf "/usr/share/zoneinfo/$TIMEZONE" /etc/localtime 2>/dev/null ||
    log_info "Could not set timezone to $TIMEZONE"
}
if [ -n "$TIMEZONE" ]; then
  if command -v systemsetup >/dev/null 2>&1; then
    CURRENT_TZ=$(sudo systemsetup -gettimezone 2>/dev/null | awk -F': ' '{print $2}')
    if [ "$CURRENT_TZ" != "$TIMEZONE" ]; then
      sudo systemsetup -settimezone "$TIMEZONE" >/dev/null 2>&1 ||
        {
          log_info "systemsetup failed; falling back to /etc/localtime symlink"
          _set_timezone_fallback
        }
    fi
  else
    # systemsetup unavailable (removed in a future macOS) – use symlink directly.
    _set_timezone_fallback
  fi
fi

# Disable text replacement
defaults write -g WebAutomaticTextReplacementEnabled -bool false

###############################################################################
# Screen
###############################################################################

# Require password immediately after sleep or screen saver begins
defaults write com.apple.screensaver askForPassword -int 1
defaults write com.apple.screensaver askForPasswordDelay -int 0

# Save screenshots in PNG format (other options: BMP, GIF, JPG, PDF, TIFF)
defaults write com.apple.screencapture type -string "png"

# Disable shadow in screenshots
defaults write com.apple.screencapture disable-shadow -bool true

###############################################################################
# Finder
###############################################################################

# Finder: allow quitting via ⌘ + Q; doing so will also hide desktop icons
defaults write com.apple.finder QuitMenuItem -bool true

# Show icons for hard drives, servers, and removable media on the desktop
defaults write com.apple.finder ShowExternalHardDrivesOnDesktop -bool true
defaults write com.apple.finder ShowHardDrivesOnDesktop -bool false
defaults write com.apple.finder ShowMountedServersOnDesktop -bool true
defaults write com.apple.finder ShowRemovableMediaOnDesktop -bool true

# Finder: show all filename extensions
defaults write NSGlobalDomain AppleShowAllExtensions -bool true

# Finder: hide path bar
defaults write com.apple.finder ShowPathbar -bool false

# Display full POSIX path as Finder window title
defaults write com.apple.finder _FXShowPosixPathInTitle -bool true

# Keep folders on top when sorting by name
defaults write com.apple.finder _FXSortFoldersFirst -bool true

# When performing a search, search the current folder by default
defaults write com.apple.finder FXDefaultSearchScope -string "SCcf"

# Disable the warning when changing a file extension
defaults write com.apple.finder FXEnableExtensionChangeWarning -bool false

# Enable spring loading for directories
defaults write NSGlobalDomain com.apple.springing.enabled -bool true

# Remove the spring loading delay for directories
defaults write NSGlobalDomain com.apple.springing.delay -float 0

# Avoid creating .DS_Store files on network or USB volumes
defaults write com.apple.desktopservices DSDontWriteNetworkStores -bool true
defaults write com.apple.desktopservices DSDontWriteUSBStores -bool true

# Disable disk image verification.
# NOTE: These keys may be silently ignored on macOS Tahoe 26+ due to
# Gatekeeper / SIP security hardening. They write without error but the
# verification bypass is not guaranteed.
defaults write com.apple.frameworks.diskimages skip-verify -bool true
defaults write com.apple.frameworks.diskimages skip-verify-locked -bool true
defaults write com.apple.frameworks.diskimages skip-verify-remote -bool true

# Automatically open a new Finder window when a volume is mounted
defaults write com.apple.frameworks.diskimages auto-open-ro-root -bool true
defaults write com.apple.frameworks.diskimages auto-open-rw-root -bool true
defaults write com.apple.finder OpenWindowForNewRemovableDisk -bool true

# Show item info near icons on the desktop and in other icon views
/usr/libexec/PlistBuddy -c "Set :DesktopViewSettings:IconViewSettings:showItemInfo true" ~/Library/Preferences/com.apple.finder.plist 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Set :FK_StandardViewSettings:IconViewSettings:showItemInfo true" ~/Library/Preferences/com.apple.finder.plist 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Set :StandardViewSettings:IconViewSettings:showItemInfo true" ~/Library/Preferences/com.apple.finder.plist 2>/dev/null || true

# Show item info to the right of the icons on the desktop
/usr/libexec/PlistBuddy -c "Set DesktopViewSettings:IconViewSettings:labelOnBottom false" ~/Library/Preferences/com.apple.finder.plist 2>/dev/null || true

# Enable snap-to-grid for icons on the desktop and in other icon views
/usr/libexec/PlistBuddy -c "Set :DesktopViewSettings:IconViewSettings:arrangeBy grid" ~/Library/Preferences/com.apple.finder.plist 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Set :FK_StandardViewSettings:IconViewSettings:arrangeBy grid" ~/Library/Preferences/com.apple.finder.plist 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Set :StandardViewSettings:IconViewSettings:arrangeBy grid" ~/Library/Preferences/com.apple.finder.plist 2>/dev/null || true

# Increase grid spacing for icons on the desktop and in other icon views
/usr/libexec/PlistBuddy -c "Set :DesktopViewSettings:IconViewSettings:gridSpacing 72" ~/Library/Preferences/com.apple.finder.plist 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Set :FK_StandardViewSettings:IconViewSettings:gridSpacing 72" ~/Library/Preferences/com.apple.finder.plist 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Set :StandardViewSettings:IconViewSettings:gridSpacing 72" ~/Library/Preferences/com.apple.finder.plist 2>/dev/null || true

# Increase the size of icons on the desktop and in other icon views
/usr/libexec/PlistBuddy -c "Set :DesktopViewSettings:IconViewSettings:iconSize 56" ~/Library/Preferences/com.apple.finder.plist 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Set :FK_StandardViewSettings:IconViewSettings:iconSize 56" ~/Library/Preferences/com.apple.finder.plist 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Set :StandardViewSettings:IconViewSettings:iconSize 56" ~/Library/Preferences/com.apple.finder.plist 2>/dev/null || true

# Use list view in all Finder windows by default
# Four-letter codes for the other view modes: `icnv`, `clmv`, `Flwv`
defaults write com.apple.finder FXPreferredViewStyle -string "Nlsv"

# Disable the warning before emptying the Trash
defaults write com.apple.finder WarnOnEmptyTrash -bool false

# Show the ~/Library folder
chflags nohidden ~/Library || true

# Expand the following File Info panes:
# "General", "Open with", and "Sharing & Permissions"
defaults write com.apple.finder FXInfoPanesExpanded -dict \
  General -bool true \
  OpenWith -bool true \
  Privileges -bool true

# When opening a folder on the desktop there's an animation that conflicts with tiling window managers.
defaults write com.apple.finder DisableAllAnimations -bool true
defaults write -g NSAutomaticWindowAnimationsEnabled -bool false

###############################################################################
# Dock, Dashboard, and hot corners
###############################################################################

# Enable highlight hover effect for the grid view of a stack (Dock)
defaults write com.apple.dock mouse-over-hilite-stack -bool true

# Set the icon size of Dock items to 38 pixels
defaults write com.apple.dock tilesize -int 38

# Change minimize/maximize window effect
defaults write com.apple.dock mineffect -string "scale"

# Minimize windows into their application's icon
defaults write com.apple.dock minimize-to-application -bool true

# Enable spring loading for all Dock items
defaults write com.apple.dock enable-spring-load-actions-on-all-items -bool true

# Show indicator lights for open applications in the Dock
defaults write com.apple.dock show-process-indicators -bool true

# Wipe all (default) app icons from the Dock
# This is only really useful when setting up a new Mac, or if you don't use
# the Dock to launch apps.
defaults write com.apple.dock persistent-apps -array ""

# Don't animate opening applications from the Dock
defaults write com.apple.dock launchanim -bool false

# Speed up Mission Control animations
defaults write com.apple.dock expose-animation-duration -float 0.1

# Group windows by application in Mission Control
# (i.e. use the old Exposé behavior instead)
defaults write com.apple.dock expose-group-by-app -bool true

# Don't automatically rearrange Spaces based on most recent use
defaults write com.apple.dock mru-spaces -bool false

# Monitors don't have separate spaces.
# NOTE: The spans-displays key was only confirmed functional through macOS Ventura.
# In Tahoe 26 the Spaces architecture changed; verify manually in
# System Settings › Desktop & Dock › "Displays have separate Spaces".
defaults write com.apple.spaces spans-displays -bool true

# Remove the auto-hiding Dock delay
defaults write com.apple.dock autohide-delay -float 0

# Drag windows anywhere
defaults write -g NSWindowShouldDragOnGesture -bool true

# Automatically hide and show the Dock
defaults write com.apple.dock autohide -bool false

###############################################################################
# Terminal
###############################################################################

# Only use UTF-8 in Terminal.app
defaults write com.apple.terminal StringEncodings -array 4

###############################################################################
# Time Machine
###############################################################################

# Prevent Time Machine from prompting to use new hard drives as backup volume
defaults write com.apple.TimeMachine DoNotOfferNewDisksForBackup -bool true

###############################################################################
# Activity Monitor
###############################################################################

# Show the main window when launching Activity Monitor
defaults write com.apple.ActivityMonitor OpenMainWindow -bool true

# Visualize CPU usage in the Activity Monitor Dock icon
defaults write com.apple.ActivityMonitor IconType -int 5

# Show all processes in Activity Monitor
defaults write com.apple.ActivityMonitor ShowCategory -int 0

# Sort Activity Monitor results by CPU usage
defaults write com.apple.ActivityMonitor SortColumn -string "CPUUsage"
defaults write com.apple.ActivityMonitor SortDirection -int 0

###############################################################################
# Address Book, Dashboard, iCal, TextEdit, and Disk Utility
###############################################################################

if [ "${DOTFILES_ENABLE_LEGACY_DEBUG:-0}" = "1" ]; then
  # Enable the debug menu in Address Book (legacy)
  defaults write com.apple.addressbook ABShowDebugMenu -bool true
  # Enable Dashboard dev mode only on versions where Dashboard existed (<10.15)
  if [ -n "$MACOS_VERSION" ] && printf '%s\n10.15\n' "$MACOS_VERSION" | sort -V | head -1 | grep -qv 10.15; then
    defaults write com.apple.dashboard devmode -bool true
  fi
  # Enable the debug menu in iCal (very old macOS versions)
  defaults write com.apple.iCal IncludeDebugMenu -bool true
fi

# Use plain text mode for new TextEdit documents
defaults write com.apple.TextEdit RichText -int 0
# Open and save files as UTF-8 in TextEdit
defaults write com.apple.TextEdit PlainTextEncoding -int 4
defaults write com.apple.TextEdit PlainTextEncodingForWrite -int 4

###############################################################################
# Mac App Store
###############################################################################

# NOTE: WebKitDeveloperExtras and ShowDebugMenu no longer work in the rebuilt
# Mac App Store shipped with macOS Tahoe 26. Both keys are silently ignored.

###############################################################################
# Messages
###############################################################################

# NOTE: com.apple.messageshelper.MessageController no longer exists in
# macOS Tahoe 26 — Messages was architecturally rewritten and the
# SOInputLineSettings domain is not read. Configure emoji substitution,
# smart quotes, and spell-check manually in Messages › Settings if needed.

###############################################################################
# Kill affected applications
###############################################################################

for app in "Activity Monitor" "Address Book" "Calendar" "Contacts" "cfprefsd" \
  "Dock" "Finder" "Mail" "Messages" "Safari" "SystemUIServer" \
  "Transmission" "iCal"; do
  killall "${app}" >/dev/null 2>&1 || true
done

log_success "macOS configured!"
summary_success "macOS configured"
