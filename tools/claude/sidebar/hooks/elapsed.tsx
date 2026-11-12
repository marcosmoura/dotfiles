// A running clock, ticking on the surface's own frame clock so the pane is not redrawn every second.
// `since`, `now` and `endAt` come from the hooks module's $.clock; between redraws it counts its own ticks.
import type { ClientModule } from 'claude-code'

type Props = { since: number; now: number; endAt: number | null; color: string }
type Ref = { base: number; ticks: number; readAt: number; isRunning: boolean }
type State = { ref: Ref }

// The same clock as core.ts draws: a surface module stands alone.
const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const mm = String(Math.floor((s % 3600) / 60))
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${mm.padStart(2, '0')}:${ss}` : `${mm}:${ss}`
}

const Elapsed: ClientModule<Props, State> = (props, surface) => {
  const { Text } = surface.elements
  const ref = surface.state?.ref ?? { base: 0, ticks: 0, readAt: -1, isRunning: true }
  if (props.now !== ref.readAt) {
    // A fresh reading from the hooks module: count on from it.
    ref.readAt = props.now
    ref.base = (props.endAt ?? props.now) - props.since
    ref.ticks = 0
  }
  ref.isRunning = props.endAt === null
  if (surface.state === undefined) {
    surface.setState({ ref })
    surface.every(1000, () => {
      if (!ref.isRunning) return
      ref.ticks += 1
      surface.setState({ ref })
    })
  }
  return <Text color={props.color}>{fmt(ref.base + ref.ticks * 1000)}</Text>
}

export default Elapsed
