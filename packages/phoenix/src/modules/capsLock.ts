import { onKeyPress } from '@/utils/key'
import { alert } from '@/components/alert'

function getAlertMessage(pressed: boolean) {
  const prefix = 'Caps'

  if (pressed) {
    return `${prefix} On`
  }

  return `${prefix} Off`
}

function capsLock() {
  let capsAlert: Modal
  let pressed = false

  onKeyPress('capslock', [], () => {
    pressed = !pressed

    if (capsAlert) {
      capsAlert.text = getAlertMessage(pressed)
      capsAlert.show()
    } else {
      capsAlert = alert(getAlertMessage(pressed))
    }
  })
}

export default capsLock
