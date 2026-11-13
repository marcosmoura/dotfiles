// A table in a reply, drawn as a grid of plain rows of text. It is a surface module because only
// here is the width it has to fit known (`surface.columns`): the columns are narrowed to that width
// and each cell wrapped by hand, so every rule is a character in its row and nothing is laid over
// anything. A surface module stands alone, so the cells come already split into lettered stretches.
import type { ClientModule } from 'claude-code';

type Span = { text: string; isBold?: true; isCode?: true };
type Align = 'left' | 'center' | 'right';
type Props = { head: Span[][]; rows: Span[][][]; align: Align[]; rule: string; code: string };
type Seg = { text: string; tone: 'rule' | 'plain' | 'bold' | 'code' };

/**
 * The cells a character takes: two for East Asian wide ones and emoji, none for a mark that joins
 * the one before it, one for any other.
 */
const cellsOf = (ch: string) => {
  const c = ch.codePointAt(0) ?? 0;
  if ((c >= 0x300 && c <= 0x36f) || c === 0x200d || (c >= 0xfe00 && c <= 0xfe0f)) return 0;
  const isWide =
    (c >= 0x1100 && c <= 0x115f) ||
    (c >= 0x2e80 && c <= 0xa4cf) ||
    (c >= 0xac00 && c <= 0xd7a3) ||
    (c >= 0xf900 && c <= 0xfaff) ||
    (c >= 0xfe30 && c <= 0xfe4f) ||
    (c >= 0xff00 && c <= 0xff60) ||
    (c >= 0xffe0 && c <= 0xffe6) ||
    c === 0x2705 ||
    c === 0x274c ||
    c >= 0x1f300;
  return isWide ? 2 : 1;
};
const widthOf = (text: string) => [...text].reduce((n, ch) => n + cellsOf(ch), 0);
/** A column is not narrowed past this, unless it was narrower to begin with. */
const NARROWEST = 8;

/** A cell's stretches as lines no wider than `width`: broken at spaces, a longer word cut. */
const wrap = (cell: readonly Span[], width: number, isHead: boolean): Seg[][] => {
  const lines: Seg[][] = [[]];
  let used = 0;
  const put = (text: string, tone: Seg['tone']) => {
    const line = lines[lines.length - 1] ?? [];
    const last = line[line.length - 1];
    if (last !== undefined && last.tone === tone) last.text += text;
    else line.push({ text, tone });
    used += widthOf(text);
  };
  for (const span of cell) {
    const tone = span.isCode ? 'code' : span.isBold || isHead ? 'bold' : 'plain';
    for (const word of span.text.split(/(\s+)/)) {
      if (word === '') continue;
      if (/^\s+$/.test(word)) {
        if (used > 0 && used < width) put(' ', tone);
        continue;
      }
      let rest = [...word];
      while (rest.length > 0) {
        if (used > 0 && used + widthOf(rest.join('')) > width) {
          const line = lines[lines.length - 1] ?? [];
          const last = line[line.length - 1];
          if (last !== undefined) last.text = last.text.replace(/\s+$/, '');
          lines.push([]);
          used = 0;
        }
        // As many characters as fit the cells left, and one at least, so a wide one still goes in.
        let fit = 0;
        for (let cells = 0; fit < rest.length; fit += 1) {
          cells += cellsOf(rest[fit] ?? '');
          if (cells > width - used && fit > 0) break;
        }
        put(rest.slice(0, fit).join(''), tone);
        rest = rest.slice(fit);
      }
    }
  }
  return lines;
};

/** The table as rows of lettered stretches, fitted to `columns` cells across. */
export const layout = (props: Props, columns: number): Seg[][] => {
  const count = props.head.length;
  const all = [props.head, ...props.rows];
  const natural = props.head.map((_, c) =>
    Math.max(1, ...all.map((row) => widthOf((row[c] ?? []).map((s) => s.text).join('')))),
  );
  // Each column has a space either side of it and a rule before it, and the grid one rule more.
  const room = columns - (count * 3 + 1);
  const widths = [...natural];
  // The widest column gives way a cell at a time, until the grid fits or none can give more.
  for (let over = widths.reduce((a, b) => a + b, 0) - room; over > 0; over -= 1) {
    const widest = widths.reduce((at, w, c) => (w > (widths[at] ?? 0) ? c : at), 0);
    if ((widths[widest] ?? 0) <= Math.min(NARROWEST, natural[widest] ?? 1)) break;
    widths[widest] = (widths[widest] ?? 1) - 1;
  }
  const rule = (left: string, mid: string, right: string): Seg[] => [
    {
      text: widths.map((w, c) => (c === 0 ? left : mid) + '─'.repeat(w + 2)).join('') + right,
      tone: 'rule',
    },
  ];
  const lines: Seg[][] = [rule('┌', '┬', '┐')];
  all.forEach((row, r) => {
    if (r > 0) lines.push(rule('├', '┼', '┤'));
    const cells = widths.map((w, c) => wrap(row[c] ?? [], w, r === 0));
    const tall = Math.max(1, ...cells.map((cell) => cell.length));
    for (let l = 0; l < tall; l += 1) {
      const line: Seg[] = [];
      widths.forEach((w, c) => {
        const segs = cells[c]?.[l] ?? [];
        const free = Math.max(0, w - segs.reduce((n, s) => n + widthOf(s.text), 0));
        const align = props.align[c] ?? 'left';
        const before = align === 'right' ? free : align === 'center' ? Math.floor(free / 2) : 0;
        line.push(
          { text: '│', tone: 'rule' },
          { text: ' '.repeat(before + 1), tone: 'plain' },
          ...segs,
        );
        line.push({ text: ' '.repeat(free - before + 1), tone: 'plain' });
      });
      line.push({ text: '│', tone: 'rule' });
      lines.push(line);
    }
  });
  lines.push(rule('└', '┴', '┘'));
  return lines;
};

const Grid: ClientModule<Props> = (props, surface) => {
  const { Box, Text } = surface.elements;
  // Before the first layout there is no width to fit: the grid is drawn at its natural one.
  const lines = layout(props, surface.columns > 0 ? surface.columns : 10_000);
  return (
    <Box flexDirection="column">
      {lines.map((line) => (
        <Text wrap="truncate-end">
          {line.map((seg) =>
            seg.tone === 'rule' ? (
              <Text color={props.rule}>{seg.text}</Text>
            ) : seg.tone === 'code' ? (
              <Text color={props.code}>{seg.text}</Text>
            ) : seg.tone === 'bold' ? (
              <Text bold>{seg.text}</Text>
            ) : (
              seg.text
            ),
          )}
        </Text>
      ))}
    </Box>
  );
};

export default Grid;
