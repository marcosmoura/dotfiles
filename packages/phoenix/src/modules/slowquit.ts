import { onKeyPress } from '@/utils/key'
import { alert } from '@/components/alert'

const blacklist = new Set(['Finder'])

function slowQuit() {
  let quitAlert: Modal
  let pressed = 0
  let killed = false
  let timeout: NodeJS.Timeout

  function createEvent() {
    pressed = 0
    killed = false
    clearTimeout(timeout)
    onKeyPress('q', 'cmd', () => {
      const app = App.focused()

      if (!app || blacklist.has(app.name())) {
        return
      }

      if (quitAlert) {
        quitAlert.close()
      }

      if (!killed) {
        quitAlert = alert('⌘Q', null)
      }

      clearTimeout(timeout)

      if (pressed < 15) {
        pressed++
        timeout = setTimeout(() => {
          pressed = 0
        }, 50)
      } else {
        if (!killed) {
          killed = App.focused().terminate()
        }

        timeout = setTimeout(() => createEvent(), 50)
      }
    })
  }

  createEvent()
}

export default slowQuit
