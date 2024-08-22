import IconReload from './assets/icon-reload.png'
import { alert } from './components/alert'
import reload from './modules/reload'
import slowQuit from './modules/slowquit'
import tiling from './modules/tiling'

Phoenix.set({ openAtLogin: true })

reload()
slowQuit()
tiling()

alert('Phoenix reloaded!', IconReload)
