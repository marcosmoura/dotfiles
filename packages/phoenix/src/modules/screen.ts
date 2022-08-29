import { keybindings } from '@/config'

import { onKeyPress } from '@/utils/key'

function moveToScreen(window: Window, screen: Screen) {
  const windowFrame = window.frame()
  const currentScreenFrame = window.screen().flippedVisibleFrame()
  const targetScreenFrame = screen.flippedVisibleFrame()

  const widthRatio = targetScreenFrame.width / currentScreenFrame.width
  const heightRatio = targetScreenFrame.height / currentScreenFrame.height

  window.setFrame({
    width: windowFrame.width * widthRatio,
    height: windowFrame.height * heightRatio,
    x: (windowFrame.x - currentScreenFrame.x) * widthRatio + targetScreenFrame.x,
    y: (windowFrame.y - currentScreenFrame.y) * heightRatio + targetScreenFrame.y,
  })
}

function moveToPreviousScreen(window = Window.focused()) {
  const previousScreen = window.screen().next()

  moveToScreen(window, previousScreen)
}

function moveToNextScreen(window = Window.focused()) {
  const nextScreen = window.screen().previous()

  moveToScreen(window, nextScreen)
}

function setupScreenShortcuts() {
  onKeyPress(...keybindings.moveWindowToNextScreen, () => moveToNextScreen())
  onKeyPress(...keybindings.moveWindowToPreviousScreen, () => moveToPreviousScreen())
}

export default setupScreenShortcuts
