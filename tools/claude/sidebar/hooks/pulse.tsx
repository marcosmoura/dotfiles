// What moves while something runs, ticking on the surface's own frame clock so nothing else is
// redrawn for it: a block that runs back and forth along a track while a turn is working, or a
// turning dot beside a tool call that has not answered yet.
import type { ClientModule } from 'claude-code';

type Props = { kind: 'bar' | 'dots'; color: string };
type Ref = { tick: number };
type State = { ref: Ref };

const DOTS = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
/** The track's cells, and those of the block that runs along it. */
const CELLS = 8;
const RUN = 3;

const Pulse: ClientModule<Props, State> = (props, surface) => {
  const { Text } = surface.elements;
  const ref = surface.state?.ref ?? { tick: 0 };
  if (surface.state === undefined) {
    surface.setState({ ref });
    surface.every(props.kind === 'bar' ? 90 : 80, () => {
      ref.tick += 1;
      surface.setState({ ref });
    });
  }
  if (props.kind === 'dots') return <Text color={props.color}>{DOTS[ref.tick % DOTS.length]}</Text>;
  const span = CELLS - RUN;
  const phase = ref.tick % (span * 2);
  const at = phase <= span ? phase : span * 2 - phase;
  return (
    <Text color={props.color}>{'⬝'.repeat(at) + '■'.repeat(RUN) + '⬝'.repeat(span - at)}</Text>
  );
};

export default Pulse;
