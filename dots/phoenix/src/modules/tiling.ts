import extend from 'just-extend'
import split from 'just-split'
import Queue from 'p-queue'

import { gapSize, margin, maxGridCells, keybindings, blacklistedWindows } from '@/config'
import { animateToFrame } from '@/utils/animate'
import { addEventListener } from '@/utils/event'
import { onKeyPress } from '@/utils/key'

export type TilingLayout = {
  mode: 'column' | 'row' | 'maximized' | 'centered' | 'grid'
  frame?: 'top' | 'right' | 'bottom' | 'left' | 'full'
  maxGridCells?: 2 | 3 | 4 | 5
}
export type AppLayout = {
  space?: number
  tiling?: TilingLayout
}

const defaultOptions: AppLayout = {
  space: 0,
  tiling: {
    mode: 'grid',
    frame: 'full',
    maxGridCells,
  },
}
const ruleCache: { [rule: string]: AppLayout } = {}
const appCache: { [appName: string]: AppLayout } = {}
const tilingQueue = new Queue({ concurrency: 1, autoStart: true })

function getFrameSize(screen: Screen, frame: TilingLayout['frame']): Rectangle {
  const mainFrame = screen.flippedVisibleFrame()
  let width = 0
  let height = 0
  let x = 0
  let y = 0

  if (['right', 'left'].includes(frame)) {
    width = mainFrame.width / 2 - gapSize - margin
    height = mainFrame.height - gapSize * 2
    y = mainFrame.y + gapSize

    if (frame === 'right') {
      x = mainFrame.x + width + gapSize * 2
    } else {
      x = mainFrame.x + gapSize
    }
  } else if (['top', 'bottom'].includes(frame)) {
    width = mainFrame.width - gapSize * 2
    height = mainFrame.height / 2 - gapSize - margin
    x = mainFrame.x + gapSize

    if (frame === 'top') {
      y = mainFrame.y + gapSize
    } else {
      y = mainFrame.y + height + gapSize * 2
    }
  } else {
    width = mainFrame.width - gapSize * 2
    height = mainFrame.height - gapSize * 2
    x = mainFrame.x + gapSize
    y = mainFrame.y + gapSize
  }

  return { width, height, x, y }
}

function setAppToColumns(app: App, tiling: TilingLayout) {
  const windows = app.windows({ visible: true })

  if (windows.length) {
    const numOfWindows = windows.length
    const appScreen = windows[0].screen()
    const screenFrame = getFrameSize(appScreen, tiling.frame)

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
    const screenFrame = getFrameSize(appScreen, tiling.frame)

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
    const appScreen = windows[0].screen()
    const screenFrame = getFrameSize(appScreen, tiling.frame)

    windows.forEach((window) => animateToFrame(window, screenFrame))
  }
}

function setAppCentered(app: App, tiling: TilingLayout) {
  const windows = app.windows({ visible: true })

  if (windows.length) {
    const appScreen = windows[0].screen()
    const screenFrame = getFrameSize(appScreen, tiling.frame)
    let targetWidth = 1440
    let targetHeight = 900

    windows.forEach((window) => {
      const windowFrame = window.frame()
      const isWindowSmaller = windowFrame.width < targetWidth && windowFrame.height < targetHeight
      const width = isWindowSmaller ? windowFrame.width : targetWidth
      const height = isWindowSmaller ? windowFrame.height : targetHeight
      const x = screenFrame.x + screenFrame.width / 2 - width / 2
      const y = screenFrame.y + screenFrame.height / 2 - height / 2

      animateToFrame(window, { width, height, x, y })
    })
  }
}

function setAppToGrid(app: App, { frame, maxGridCells }: TilingLayout) {
  const windows = app.windows({ visible: true })

  if (windows.length) {
    const appScreen = windows[0].screen()
    const screenFrame = getFrameSize(appScreen, frame)
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

function applyLayoutToApp(
  app: App,
  space: number = defaultOptions.space,
  tiling: TilingLayout = defaultOptions.tiling,
  shouldFocus: boolean = false,
) {
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

  if (shouldFocus) {
    targetSpace.removeWindows(app.windows())
    app.focus()
    targetSpace.addWindows(app.windows())
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
            }, 100)
          }),
      )
    })
  }
}

function redoAppLayout(app: App) {
  const appName = app.name()

  if (isAppBlacklisted(appName)) {
    return
  }

  const options = appCache[appName]

  if (options) {
    applyLayoutToApp(app, options.space, options.tiling)
  } else {
    Object.entries(ruleCache).forEach(([cachedRule, options]) => {
      if (appName.match(cachedRule)) {
        applyLayoutToApp(app, options.space, options.tiling)
      }
    })
  }
}

function redoSpaceLayout() {
  Space.active()
    .windows()
    .forEach((window) => redoAppLayout(window.app()))
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
  // ['appDidLaunch', 'appDidTerminate', 'appDidShow', 'appDidHide','appDidActivate', ],
  // ['windowDidUnminimize', 'windowDidMinimize', 'windowDidOpen', 'windowDidClose'],

  addEventListener(['appDidLaunch', 'appDidTerminate'], redoAppLayout)
  addEventListener(['windowDidUnminimize', 'windowDidMinimize'], redoSpaceLayout)
  addEventListener('spaceDidChange', redoSpaceLayout)
  addEventListener('screensDidChange', redoSpaceLayout)

  onKeyPress(...keybindings.reloadSpace, redoSpaceLayout)
  onKeyPress(...keybindings.toggleMaximized, toggleWindowLayout({ mode: 'maximized' }))
  onKeyPress(...keybindings.toggleGrid, toggleWindowLayout({ mode: 'grid' }))
  onKeyPress(...keybindings.toggleColumn, toggleWindowLayout({ mode: 'column' }))
  onKeyPress(...keybindings.toggleRow, toggleWindowLayout({ mode: 'row' }))
}

export { addTilingRule }

export default setupTiling
