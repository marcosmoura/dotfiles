import { keybindings } from '@/config'

import {
  FramePosition,
  getFrameSizeByPosition,
  getFrameWithGaps,
  getScreenFrame,
} from '@/utils/frame'
import { onKeyPress } from '@/utils/key'

function getDefaults(window?: Window, frame?: Rectangle) {
  return {
    window: window || Window.focused(),
    frame: frame || getFrameWithGaps(getScreenFrame()),
  }
}

function setWindowToPosition(position?: FramePosition, win?: Window, frame?: Rectangle) {
  const { window } = getDefaults(win)
  const screenFrame = frame || getFrameSizeByPosition(window.screen(), position)

  window.setFrame(screenFrame)
}

function setWindowToTop(window?: Window) {
  setWindowToPosition('top', window)
}

function setWindowToRight(window?: Window) {
  setWindowToPosition('right', window)
}

function setWindowToBottom(window?: Window) {
  setWindowToPosition('bottom', window)
}

function setWindowToLeft(window?: Window) {
  setWindowToPosition('left', window)
}

function setWindowMaximized(window?: Window, frame?: Rectangle) {
  setWindowToPosition('full', window, frame)
}

function setWindowCentered(win?: Window, screenFrame?: Rectangle) {
  const { window, frame } = getDefaults(win, screenFrame)
  const targetWidth = 1920
  const targetHeight = 1080
  const windowFrame = window.frame()
  const isWindowSmaller = windowFrame.width < targetWidth && windowFrame.height < targetHeight
  const width = isWindowSmaller ? windowFrame.width : targetWidth
  const height = isWindowSmaller ? windowFrame.height : targetHeight
  const x = frame.x + frame.width / 2 - width / 2
  const y = frame.y + frame.height / 2 - height / 2

  window.setFrame({ width, height, x, y })
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
export { setWindowCentered, setWindowMaximized, setWindowToPosition }
