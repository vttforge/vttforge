/**
 * Blank out the comments in a source file, so a pattern that names a call
 * or a key does not match the prose around it.
 *
 * Every character inside a `//` or `/* *\/` comment becomes `\0`, except the
 * newlines, so offsets and line numbers in the result line up with the
 * original. Strings and template literals are walked so a `//` inside a URL
 * does not start a comment, and a regex literal is walked so `/\/\//` does
 * not either. `\0` never appears in real source, which is what makes it a
 * safe marker: `masked[i] === '\0'` says "this index is a comment".
 */
export const MASK = '\0';

export function maskComments(source: string): string {
  const out = source.split('');
  let quote: string | null = null;
  let lastCode = '';
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i] ?? '';
    const next = source[i + 1] ?? '';
    if (quote !== null) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      lastCode = ch;
      continue;
    }
    if (ch === '/' && next === '/') {
      const end = source.indexOf('\n', i);
      const stop = end === -1 ? source.length : end;
      for (let j = i; j < stop; j += 1) out[j] = MASK;
      i = stop - 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      const close = source.indexOf('*/', i + 2);
      const stop = close === -1 ? source.length : close + 2;
      for (let j = i; j < stop; j += 1) if (source[j] !== '\n') out[j] = MASK;
      i = stop - 1;
      continue;
    }
    if (ch === '/' && startsRegex(lastCode)) {
      // Walk to the closing slash, honouring escapes and character classes.
      let inClass = false;
      let j = i + 1;
      for (; j < source.length; j += 1) {
        const c = source[j] ?? '';
        if (c === '\\') j += 1;
        else if (c === '\n') break;
        else if (inClass) inClass = c !== ']';
        else if (c === '[') inClass = true;
        else if (c === '/') break;
      }
      i = j;
      lastCode = '/';
      continue;
    }
    if (!/\s/.test(ch)) lastCode = ch;
  }
  return out.join('');
}

/** After one of these a `/` opens a regex literal, not a division. */
function startsRegex(lastCode: string): boolean {
  return lastCode === '' || '(,=:[!&|?{};+-*%<>~^'.includes(lastCode);
}
