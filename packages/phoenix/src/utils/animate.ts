import { animate, cubicBezier, KeyframeOptions } from 'popmotion'

import { hasAnimation, animationDuration } from '@/config'

const defaultAnimationOptions = {
  duration: animationDuration,
  ease: cubicBezier(0.4, 0, 0.2, 1),
}
const animateToFrame = (
  window: Window,
  frame: Rectangle,
  { duration, ease }: Partial<KeyframeOptions<Rectangle>> = defaultAnimationOptions,
) => {
  if (hasAnimation) {
    animate({
      from: window.frame(),
      to: frame,
      duration: (duration || defaultAnimationOptions.duration) * 1000,
      ease: ease || defaultAnimationOptions.ease,
      onUpdate: (newFrame: Rectangle) => window.setFrame(newFrame),
    })
  } else {
    window.setFrame(frame)
  }
}

export { animateToFrame }
