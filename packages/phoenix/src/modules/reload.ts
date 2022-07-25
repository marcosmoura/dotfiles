import { keybindings } from '@/config'
import { onKeyPress } from '@/utils/key'

function reload() {
  onKeyPress(...keybindings.reloadConfig, () => Phoenix.reload())
}

export default reload
