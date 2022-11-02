import IconReload from './assets/icon-reload.png'
import { alert } from './components/alert'
import reload from './modules/reload'
import slowQuit from './modules/slowquit'
import tiling, { addTilingRule, AppLayout, clearTilingCache } from './modules/tiling'
import { addEventListener } from './utils/event'

Phoenix.set({ openAtLogin: true })

reload()
slowQuit()
tiling()

const centeredLayout: AppLayout = {
  tiling: {
    mode: 'centered',
  },
}

function setupTilingLayout() {
  clearTilingCache()

  addTilingRule('(Copy|Bin|About This Mac|Info)', centeredLayout)
  addTilingRule('Activity Monitor', centeredLayout)
  addTilingRule('Calculator', centeredLayout)
  addTilingRule('Contexts', centeredLayout)
  addTilingRule('IINA', centeredLayout)
  addTilingRule('Opening', centeredLayout)
  addTilingRule('Preferences', centeredLayout)
  addTilingRule('Settings', centeredLayout)
  addTilingRule('Preview', centeredLayout)
  addTilingRule('Steam', centeredLayout)
  addTilingRule('System Settings', centeredLayout)
  addTilingRule('Tone Room', centeredLayout)
  addTilingRule('VLC', centeredLayout)
}

setupTilingLayout()
addEventListener('screensDidChange', setupTilingLayout)
addEventListener('appDidLaunch', setupTilingLayout)

alert('Phoenix reloaded!', IconReload)
