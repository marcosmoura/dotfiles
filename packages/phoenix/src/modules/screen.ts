import { cubicBezier } from 'popmotion'

import { animationDuration, keybindings } from '@/config'
import { animateToFrame } from '@/utils/animate'
import { onKeyPress } from '@/utils/key'

function moveToScreen(window: Window, screen: Screen) {
  const windowFrame = window.frame()
  const currentScreenFrame = window.screen().flippedVisibleFrame()
  const targetScreenFrame = screen.flippedVisibleFrame()

  const widthRatio = targetScreenFrame.width / currentScreenFrame.width
  const heightRatio = targetScreenFrame.height / currentScreenFrame.height

  animateToFrame(
    window,
    {
      width: windowFrame.width * widthRatio,
      height: windowFrame.height * heightRatio,
      x: (windowFrame.x - currentScreenFrame.x) * widthRatio + targetScreenFrame.x,
      y: (windowFrame.y - currentScreenFrame.y) * heightRatio + targetScreenFrame.y,
    },
    {
      duration: animationDuration * 1.25,
      ease: cubicBezier(0.0, 0.0, 0.2, 1),
    },
  )
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
