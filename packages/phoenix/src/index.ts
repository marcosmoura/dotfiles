import IconReload from './assets/icon-reload.png'
import { alert } from './components/alert'
import capsLock from './modules/capsLock'
import lockScreen from './modules/lockScreen'
import reload from './modules/reload'
import screen from './modules/screen'
import slowQuit from './modules/slowquit'
import tiling, { addTilingRule, AppLayout, clearTilingCache } from './modules/tiling'
import window from './modules/windows'
import { addEventListener } from './utils/event'

Phoenix.set({ openAtLogin: true })

capsLock()
lockScreen()
reload()
screen()
slowQuit()
tiling()
window()

const centeredLayout: AppLayout = {
  tiling: {
    mode: 'centered',
  },
}

function setupTilingLayout() {
  clearTilingCache()

  addTilingRule('WhatsApp', {
    ...centeredLayout,
    space: 4,
  })

  addTilingRule('Discord', {
    ...centeredLayout,
    space: 4,
  })

  addTilingRule('(Copy|Bin|About This Mac|Info)', centeredLayout)
  addTilingRule('Activity Monitor', centeredLayout)
  addTilingRule('Calculator', centeredLayout)
  addTilingRule('Contexts', centeredLayout)
  addTilingRule('IINA', centeredLayout)
  addTilingRule('Opening', centeredLayout)
  addTilingRule('Preferences', centeredLayout)
  addTilingRule('Preview', centeredLayout)
  addTilingRule('Steam', centeredLayout)
  addTilingRule('System Preferences', centeredLayout)
  addTilingRule('Tone Room', centeredLayout)
  addTilingRule('VLC', centeredLayout)
}

setupTilingLayout()
addEventListener('screensDidChange', setupTilingLayout)

alert('Phoenix reloaded!', IconReload)
