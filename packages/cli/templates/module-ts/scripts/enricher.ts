/**
 * `@Note[id]` — a link to a note from any enriched text field.
 *
 * Declared as data and handed to `registerModule({ enrichers })`, which
 * registers it as `{{ID}}.note`. The pattern carries the `g` flag because
 * enrichment runs it through `matchAll`, and `onRender` binds the click
 * where the markup is declared rather than in a separate hook.
 */
import type { EnricherRegistration } from '@vttforge/core';
import { NOTE_TYPE } from './constants.js';

interface NoteLike {
  readonly name: string;
  readonly type: string;
  readonly sheet: { render(force?: boolean): unknown };
}

function findNote(id: string): NoteLike | undefined {
  const item = game.items.get(id) as NoteLike | undefined;
  return item?.type === NOTE_TYPE ? item : undefined;
}

export const noteEnricher: EnricherRegistration = {
  id: 'note',
  pattern: /@Note\[([^\]]+)\]/g,

  enricher(match) {
    const id = match[1];
    const note = id === undefined ? undefined : findNote(id);
    // Leave the text alone when the note is gone: a dead link is worse than
    // the raw reference, which at least says what was meant.
    if (note === undefined) return null;

    const link = document.createElement('a');
    link.className = '{{ID}}-note-link';
    link.dataset.noteId = id;
    link.draggable = false;
    link.append(Object.assign(document.createElement('i'), { className: 'fa-solid fa-note-sticky' }));
    link.append(note.name);
    return link;
  },

  onRender(element) {
    for (const link of element.querySelectorAll<HTMLElement>('a.{{ID}}-note-link')) {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        const { noteId } = link.dataset;
        if (noteId) findNote(noteId)?.sheet.render(true);
      });
    }
  },
};
