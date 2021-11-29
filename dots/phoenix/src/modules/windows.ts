import { gapSize, margin, keybindings } from '@/config'
import { animateToFrame } from '@/utils/animate'
import { onKeyPress } from '@/utils/key'

function setWindowToTop(window: Window = Window.focused()) {
  const screenFrame = window.screen().flippedVisibleFrame()
  const width = screenFrame.width - gapSize * 2
  const height = screenFrame.height / 2 - gapSize - margin

  animateToFrame(window, {
    width,
    height,
    x: screenFrame.x + gapSize,
    y: screenFrame.y + gapSize,
  })
}

function setWindowToRight(window: Window = Window.focused()) {
  const screenFrame = window.screen().flippedVisibleFrame()
  const width = screenFrame.width / 2 - gapSize - margin
  const height = screenFrame.height - gapSize * 2

  animateToFrame(window, {
    width,
    height,
    x: screenFrame.x + width + gapSize * 2,
    y: screenFrame.y + gapSize,
  })
}

function setWindowToBottom(window: Window = Window.focused()) {
  const screenFrame = window.screen().flippedVisibleFrame()
  const width = screenFrame.width - gapSize * 2
  const height = screenFrame.height / 2 - gapSize - margin

  animateToFrame(window, {
    width,
    height,
    x: screenFrame.x + gapSize,
    y: screenFrame.y + screenFrame.height / 2 + margin,
  })
}

function setWindowToLeft(window: Window = Window.focused()) {
  const screenFrame = window.screen().flippedVisibleFrame()
  const width = screenFrame.width / 2 - gapSize - margin
  const height = screenFrame.height - gapSize * 2

  animateToFrame(window, {
    width,
    height,
    x: screenFrame.x + gapSize,
    y: screenFrame.y + gapSize,
  })
}

function setWindowMaximized(window: Window = Window.focused()) {
  const screenFrame = window.screen().flippedVisibleFrame()
  const width = screenFrame.width - gapSize * 2
  const height = screenFrame.height - gapSize * 2

  animateToFrame(window, {
    width,
    height,
    x: screenFrame.x + gapSize,
    y: screenFrame.y + gapSize,
  })
}

function setWindowCentered(window: Window = Window.focused()) {
  const screenFrame = window.screen().flippedVisibleFrame()
  const windowFrame = window.frame()
  let width = 1440
  let height = 900

  if (windowFrame.width < width && windowFrame.width < height) {
    width = windowFrame.width
    height = windowFrame.height
  }

  animateToFrame(window, {
    width,
    height,
    x: screenFrame.x + screenFrame.width / 2 - width / 2,
    y: screenFrame.y + screenFrame.height / 2 - height / 2,
  })
}

function setupScreenShortcuts() {
  onKeyPress(...keybindings.maximize, () => setWindowMaximized())
  onKeyPress(...keybindings.centralize, () => setWindowCentered())
  onKeyPress(...keybindings.alignToTop, () => setWindowToTop())
  onKeyPress(...keybindings.alignToBottom, () => setWindowToBottom())
  onKeyPress(...keybindings.alignToRight, () => setWindowToRight())
  onKeyPress(...keybindings.alignToLeft, () => setWindowToLeft())
}

export default setupScreenShortcuts
