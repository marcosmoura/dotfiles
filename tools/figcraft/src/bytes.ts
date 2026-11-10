/** UTF-8 byte length; the proxy's documented caps are byte budgets. */
export function byteLength(text: string): number {
  return Buffer.byteLength(text, 'utf8');
}

/** Truncates text to at most maxBytes UTF-8 bytes without splitting a code point. */
export function truncateToBytes(text: string, maxBytes: number): string {
  if (maxBytes <= 0) {
    return '';
  }

  const bytes = Buffer.from(text, 'utf8');

  if (bytes.length <= maxBytes) {
    return text;
  }

  let end = maxBytes;

  while (end > 0 && ((bytes[end] ?? 0) & 0xc0) === 0x80) {
    end -= 1;
  }

  return bytes.subarray(0, end).toString('utf8');
}
