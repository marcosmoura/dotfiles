import extend from 'just-extend'
import split from 'just-split'
import Queue from 'p-queue'

import { alert } from '@/components/alert'
import { gapSize, maxGridCells, keybindings, blacklistedWindows } from '@/config'
import { animateToFrame } from '@/utils/animate'
import { addEventListener } from '@/utils/event'
import { Frame, FramePosition, getFrameSizeByPosition } from '@/utils/frame'
import { onKeyPress } from '@/utils/key'
import { clearObject } from '@/utils/object'

import { setWindowCentered, setWindowMaximized, setWindowToPosition } from './windows'

export type TilingLayout = {
  mode: 'column' | 'row' | 'maximized' | 'centered' | 'grid' | 'floating'
  frame?: Frame
  position?: FramePosition
  maxGridCells?: 2 | 3 | 4 | 5
  maxWidth?: number
}
export type AppLayout = {
  space?: number
  tiling?: TilingLayout
}

const defaultOptions: AppLayout = {
  space: 0,
  tiling: {
    mode: 'grid',
    position: 'full',
    maxGridCells,
  },
}
const ruleCache: { [rule: string]: AppLayout } = {}
const appCache: { [appName: string]: AppLayout } = {}
const tilingQueue = new Queue({ concurrency: 1, autoStart: true })

function clearTilingCache() {
  clearObject(ruleCache)
  clearObject(appCache)
  tilingQueue.clear()
}

function setAppToColumns(app: App, tiling: TilingLayout) {
  const windows = app.windows({ visible: true })

  if (windows.length) {
    const numOfWindows = windows.length
    const appScreen = windows[0].screen()
    const screenFrame = getFrameSizeByPosition(appScreen, tiling.position)

    windows.forEach((window, index) => {
      const width = (screenFrame.width - gapSize * (numOfWindows - 1)) / numOfWindows
      const height = screenFrame.height
      const x = screenFrame.x + (width + gapSize) * index
      const y = screenFrame.y

      animateToFrame(window, { width, height, x, y })
    })
  }
}

function setAppToRows(app: App, tiling: TilingLayout) {
  const windows = app.windows({ visible: true })

  if (windows.length) {
    const numOfWindows = windows.length
    const appScreen = windows[0].screen()
    const screenFrame = getFrameSizeByPosition(appScreen, tiling.position)

    windows.forEach((window, index) => {
      const width = screenFrame.width
      const height = (screenFrame.height - gapSize * (numOfWindows - 1)) / numOfWindows
      const x = screenFrame.x
      const y = screenFrame.y + (height + gapSize) * index

      animateToFrame(window, { width, height, x, y })
    })
  }
}

function setAppMaximized(app: App, tiling: TilingLayout) {
  const windows = app.windows({ visible: true })

  if (windows.length) {
    const screenFrame = getFrameSizeByPosition(windows[0].screen(), tiling.position)

    windows.forEach((window) => setWindowMaximized(window, screenFrame))
  }
}

function setAppCentered(app: App, tiling: TilingLayout) {
  const windows = app.windows({ visible: true })

  if (windows.length) {
    const screenFrame = getFrameSizeByPosition(windows[0].screen(), tiling.position)

    windows.forEach((window) => setWindowCentered(window, screenFrame))
  }
}

function setAppFloating(app: App, tiling: TilingLayout) {
  const windows = app.windows({ visible: true })

  if (windows.length) {
    if (tiling.frame) {
      windows.forEach((window) => setWindowToPosition(null, window, tiling.frame))
    } else {
      setAppCentered(app, tiling)
    }
  }
}

function setAppToGrid(app: App, { position, maxGridCells }: TilingLayout) {
  const windows = app.windows({ visible: true })

  if (windows.length) {
    const appScreen = windows[0].screen()
    const screenFrame = getFrameSizeByPosition(appScreen, position)
    const gridDimension = windows.length > Math.round(maxGridCells * 1.4) ? maxGridCells : 2
    const grid = split(windows, gridDimension)
    const rows = grid.length

    grid.forEach((row: Window[], rowIndex: number) => {
      const columns = row.length

      row.forEach((window: Window, columnIndex: number) => {
        const width = (screenFrame.width - gapSize * (columns - 1)) / columns
        const height = (screenFrame.height - gapSize * (rows - 1)) / rows
        const x = screenFrame.x + (width + gapSize) * columnIndex
        const y = screenFrame.y + (height + gapSize) * rowIndex

        animateToFrame(window, { width, height, x, y })
      })
    })
  }
}

function isAppBlacklisted(appName: string) {
  return blacklistedWindows.map((name) => name.toLowerCase()).includes(appName.toLowerCase())
}

function getMatchedApp(appName: string) {
  const runningApps = App.all()
  const matchedApps = runningApps.filter((app) => {
    const name = app.name()

    return name.match(appName) && !isAppBlacklisted(name)
  })

  return matchedApps
}

function addAppToSpace(app: App, space: number) {
  const allSpaces = Space.all()
  let targetSpace = null

  if (space === 0) {
    const currentSpace = Space.active()

    if (currentSpace) {
      targetSpace = currentSpace
    } else {
      targetSpace = app.mainWindow().spaces()[0] || allSpaces[0]
    }
  } else {
    targetSpace = allSpaces[space - 1]
  }

  if (targetSpace) {
    targetSpace.removeWindows(app.windows())
    app.focus()
    targetSpace.addWindows(app.windows())
  }
}

function applyLayoutToApp(
  app: App,
  space: number = defaultOptions.space,
  tiling: TilingLayout = defaultOptions.tiling,
  shouldFocus: boolean = false,
) {
  if (process.env.NODE_ENV === 'production' && shouldFocus) {
    addAppToSpace(app, space)
  }

  appCache[app.name()] = { space, tiling }

  switch (tiling.mode) {
    case 'column':
      setAppToColumns(app, tiling)
      break

    case 'row':
      setAppToRows(app, tiling)
      break

    case 'maximized':
      setAppMaximized(app, tiling)
      break

    case 'centered':
      setAppCentered(app, tiling)
      break

    case 'grid':
      setAppToGrid(app, tiling)
      break

    case 'floating':
      setAppFloating(app, tiling)
      break

    default:
      break
  }
}

function addTilingRule(query: string, opts: AppLayout = defaultOptions) {
  const options = extend(true, {}, defaultOptions, opts) as AppLayout
  const apps = getMatchedApp(query)

  ruleCache[query] = options

  if (apps.length) {
    apps.forEach((app) => {
      tilingQueue.add(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              applyLayoutToApp(app, options.space, options.tiling, true)
              resolve(true)
            }, 25)
          }),
      )
    })
  }
}

function redoAppLayout(app: App, forceFocus: boolean = false) {
  const appName = app.name()

  if (isAppBlacklisted(appName)) {
    return
  }

  const options = appCache[appName]

  if (options) {
    applyLayoutToApp(app, options.space, options.tiling, forceFocus)
  } else {
    Object.entries(ruleCache).forEach(([cachedRule, options]) => {
      if (appName.match(cachedRule)) {
        applyLayoutToApp(app, options.space, options.tiling, forceFocus)
      }
    })
  }
}

function redoSpaceLayout() {
  Space.active()
    .windows()
    .forEach((window) => redoAppLayout(window.app()))
}

function redoAllLayouts() {
  alert('Reloading layouts')

  const apps = {}

  Space.all().forEach((space) => {
    tilingQueue.add(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            const windows = space.windows()

            windows
              .filter((window) => apps[window.app().name()])
              .forEach((window) => redoAppLayout(window.app(), true))

            resolve(true)
          }, 25)
        }),
    )
  })
}

function toggleWindowLayout(options: TilingLayout) {
  return () => {
    const app = App.focused()
    const appName = app.name()
    const cachedRule = appCache[appName]
    let space = 0
    let tilingOptions: TilingLayout = defaultOptions.tiling

    if (cachedRule) {
      space = cachedRule.space
      tilingOptions = cachedRule.tiling
    } else {
      space = 0
      tilingOptions = defaultOptions.tiling
    }

    applyLayoutToApp(app, space, extend(true, {}, tilingOptions, options) as TilingLayout)
  }
}

function setupTiling() {
  addEventListener(
    ['appDidLaunch', 'appDidTerminate', 'appDidShow', 'appDidHide', 'appDidActivate'],
    (app) => redoAppLayout(app),
  )
  addEventListener(
    ['windowDidUnminimize', 'windowDidMinimize', 'windowDidOpen', 'windowDidClose'],
    redoSpaceLayout,
  )
  addEventListener('spaceDidChange', redoSpaceLayout)
  addEventListener('screensDidChange', redoSpaceLayout)

  onKeyPress(...keybindings.reloadSpace, redoSpaceLayout)
  onKeyPress(...keybindings.reloadLayout, redoAllLayouts)
  onKeyPress(...keybindings.toggleMaximized, toggleWindowLayout({ mode: 'maximized' }))
  onKeyPress(...keybindings.toggleGrid, toggleWindowLayout({ mode: 'grid' }))
  onKeyPress(...keybindings.toggleColumn, toggleWindowLayout({ mode: 'column' }))
  onKeyPress(...keybindings.toggleRow, toggleWindowLayout({ mode: 'row' }))
}

export { addTilingRule, clearTilingCache, toggleWindowLayout }

export default setupTiling
