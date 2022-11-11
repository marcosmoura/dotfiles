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
  addTilingRule('(Settings|Preferences)', centeredLayout)
  addTilingRule('Activity Monitor', centeredLayout)
  addTilingRule('AdGuard', centeredLayout)
  addTilingRule('App Store', centeredLayout)
  addTilingRule('Calculator', centeredLayout)
  addTilingRule('Console', centeredLayout)
  addTilingRule('Contexts', centeredLayout)
  addTilingRule('Dictionary', centeredLayout)
  addTilingRule('Displaperture', centeredLayout)
  addTilingRule('Exports', centeredLayout)
  addTilingRule('IINA', centeredLayout)
  addTilingRule('Inna', centeredLayout)
  addTilingRule('Kap', centeredLayout)
  addTilingRule('Opening', centeredLayout)
  addTilingRule('Preferences', centeredLayout)
  addTilingRule('Preview', centeredLayout)
  addTilingRule('Settings', centeredLayout)
  addTilingRule('Software Update', centeredLayout)
  addTilingRule('Stats', centeredLayout)
  addTilingRule('Steam', centeredLayout)
  addTilingRule('System Information', centeredLayout)
  addTilingRule('Tone Room', centeredLayout)
  addTilingRule('VLC', centeredLayout)
  addTilingRule('VoiceOver Utility', centeredLayout)
}

setupTilingLayout()
addEventListener('screensDidChange', setupTilingLayout)
addEventListener('appDidLaunch', setupTilingLayout)

alert('Phoenix reloaded!', IconReload)
