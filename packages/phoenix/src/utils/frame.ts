import { gapSize, margin } from '@/config'

type FramePosition = 'top' | 'right' | 'bottom' | 'left' | 'full'
type Frame = Rectangle

function getScreenFrame(screen: Screen = Window.focused().screen()): Rectangle {
  return screen.flippedVisibleFrame()
}

function getFrameWithGaps(frame: Rectangle): Rectangle {
  return {
    width: frame.width - gapSize * 2,
    height: frame.height - gapSize * 2,
    x: frame.x + gapSize,
    y: frame.y + gapSize,
  }
}

function getFrameSizeByPosition(screen: Screen, position: FramePosition): Rectangle {
  const frame = getFrameWithGaps(getScreenFrame(screen))
  let { width, height, x, y } = frame

  if (['right', 'left'].includes(position)) {
    width = width / 2 - margin

    if (position === 'right') {
      x = x + width + gapSize
    }
  } else if (['top', 'bottom'].includes(position)) {
    height = height / 2 - margin

    if (position === 'bottom') {
      y = y + height + gapSize
    }
  }

  return { width, height, x, y }
}

export { getFrameSizeByPosition, getScreenFrame, getFrameWithGaps, FramePosition, Frame }
