/** Small text helpers shared by the runtime modules. Internal. */

/** Translate through `game.i18n` when it is there; the text itself otherwise. */
export function localize(text: string): string {
  const game = (globalThis as Record<string, unknown>).game as
    | { i18n?: { localize?: (key: string) => string } }
    | undefined;
  return game?.i18n?.localize?.(text) ?? text;
}

/** Escape the five characters that matter inside HTML text and attributes. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}
