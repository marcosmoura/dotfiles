import { modalDuration } from '@/config'

import IconWindow from '@/assets/icon-window.png'

type Falsy = false | 0 | '' | null | undefined

function createAlert(text: string, icon: string | Falsy = IconWindow) {
  const modal = new Modal()

  modal.animationDuration = 0
  modal.duration = modalDuration
  modal.text = text
  modal.weight = 24

  if (icon) {
    modal.icon = Image.fromFile(icon)
  }

  return modal
}

export function alert(text: string, icon?: string): Modal {
  const alert = createAlert(text, icon)
  const { height, width } = alert.frame()
  const frame = Screen.main().visibleFrame()

  alert.origin = {
    x: frame.x + frame.width / 2 - width / 2,
    y: frame.y + frame.height / 2 - height / 2,
  }

  alert.show()

  return alert
}
