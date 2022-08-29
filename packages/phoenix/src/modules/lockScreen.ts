import { keybindings } from '@/config'

import { onKeyPress } from '@/utils/key'

function lockScreen() {
  onKeyPress(...keybindings.lockScreen, () => {
    const osascriptArguments = [
      '-e',
      'tell application "System Events" to keystroke "q" using {control down, command down}',
    ]

    Task.run('/usr/bin/osascript', osascriptArguments)
  })
}

export default lockScreen
