import IconReload from './assets/icon-reload.png'
import { alert } from './components/alert'
import capsLock from './modules/capsLock'
import reload from './modules/reload'
import screen from './modules/screen'
import slowQuit from './modules/slowquit'
import tiling, { addTilingRule, AppLayout } from './modules/tiling'
import window from './modules/windows'

Phoenix.set({
  // daemon: true,
  openAtLogin: true,
})

capsLock()
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

addTilingRule('Code', {
  space: 1,
  tiling: {
    mode: 'grid',
    maxGridCells: 4,
  },
})

addTilingRule('Chrome', {
  space: 2,
  tiling: {
    mode: 'column',
  },
})

addTilingRule('Spotify', {
  space: 3,
  tiling: {
    mode: 'maximized',
  },
})

addTilingRule('WhatsApp', {
  ...centeredLayout,
  space: 4,
})

addTilingRule('Discord', {
  ...centeredLayout,
  space: 5,
})

addTilingRule('Finder', {
  space: 6,
  tiling: {
    mode: 'row',
    frame: 'left',
  },
})
addTilingRule('Calendar', {
  space: 6,
  tiling: {
    mode: 'maximized',
    frame: 'right',
  },
})

addTilingRule('Figma', {
  space: 7,
  tiling: {
    mode: 'column',
  },
})

addTilingRule('iTerm', {
  space: 9,
  tiling: {
    mode: 'row',
  },
})

addTilingRule('Bitwarden', {
  space: 10,
  tiling: {
    mode: 'row',
    frame: 'top',
  },
})
addTilingRule('Notion', {
  space: 10,
  tiling: {
    mode: 'row',
    frame: 'bottom',
  },
})

addTilingRule('(Copy|Bin|About This Mac|Info)', centeredLayout)
addTilingRule('Calculator', centeredLayout)
addTilingRule('Contexts', centeredLayout)
addTilingRule('IINA', centeredLayout)
addTilingRule('Numi', centeredLayout)
addTilingRule('Opening', centeredLayout)
addTilingRule('Preferences', centeredLayout)
addTilingRule('Preview', centeredLayout)
addTilingRule('Steam', centeredLayout)
addTilingRule('System Preferences', centeredLayout)
addTilingRule('Tone Room', centeredLayout)

alert('Phoenix reloaded!', IconReload)
