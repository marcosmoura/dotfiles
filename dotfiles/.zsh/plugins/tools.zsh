#!/usr/bin/env zsh

# Microsoft Defender
alias killMicrosoftDefender="launchctl unload /Library/LaunchAgents/com.microsoft.wdav.tray.plist"
alias loadMicrosoftDefender="launchctl load /Library/LaunchAgents/com.microsoft.wdav.tray.plist"

# Lock computer
alias afk='open -a /System/Library/CoreServices/ScreenSaverEngine.app'

# Start NZXT Kraken
kraken () {
  liquidctl initialize all;
  liquidctl --match "Kraken" set pump speed 20 40 40 70 50 80 60 100
  liquidctl --match "Smart Device" set fan1 speed 70
  liquidctl --match "Smart Device" set fan2 speed 70
  liquidctl --match "Smart Device" set fan3 speed 70
}

# Create a .tar.gz archive, using `zopfli`, `pigz` or `gzip` for compression
function targz() {
  local tmpFile="${@%/}.tar";
  tar -cvf "${tmpFile}" --exclude=".DS_Store" "${@}" || return 1;

  size=$(
    stat -f"%z" "${tmpFile}" 2> /dev/null; # OS X `stat`
    stat -c"%s" "${tmpFile}" 2> /dev/null # GNU `stat`
  );

  local cmd="";
  if (( size < 52428800 )) && hash zopfli 2> /dev/null; then
    # the .tar file is smaller than 50 MB and Zopfli is available; use it
    cmd="zopfli";
  else
    if hash pigz 2> /dev/null; then
      cmd="pigz";
    else
      cmd="gzip";
    fi;
  fi;

  echo "Compressing .tar using \`${cmd}\`…";
  "${cmd}" -v "${tmpFile}" || return 1;
  [ -f "${tmpFile}" ] && rm "${tmpFile}";
  echo "${tmpFile}.gz created successfully.";
}
