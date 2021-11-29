import { alert } from '@/components/alert'
import { onKeyPress } from '@/utils/key'

function capsLock() {
  let capsAlert: Modal
  let pressed = false

  function getMessage() {
    if (pressed) {
      return 'On'
    }

    return 'Off'
  }

  onKeyPress('capslock', [], () => {
    if (capsAlert) {
      capsAlert.text = getMessage()
      capsAlert.show()
    } else {
      capsAlert = alert(getMessage())
    }

    pressed = !pressed
  })
}

export default capsLock
