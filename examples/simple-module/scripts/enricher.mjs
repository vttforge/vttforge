/**
 * `@Note[id]` — a link to a note from any enriched text field.
 *
 * Declared as data and handed to `registerModule({ enrichers })`, which
 * registers it as `vttforge-example-module.note`. The pattern carries the `g` flag because
 * enrichment runs it through `matchAll`, and `onRender` binds the click
 * where the markup is declared rather than in a separate hook.
 */
import { NOTE_TYPE } from './constants.mjs';

/**
 * @param {string} id
 * @returns {any}
 */
function findNote(id) {
  const item = game.items.get(id);
  return item?.type === NOTE_TYPE ? item : undefined;
}

/** @type {import('@vttforge/core').EnricherRegistration} */
export const noteEnricher = {
  id: 'note',
  pattern: /@Note\[([^\]]+)\]/g,

  /** @param {RegExpMatchArray} match */
  enricher(match) {
    const id = match[1];
    const note = id === undefined ? undefined : findNote(id);
    // Leave the text alone when the note is gone: a dead link is worse than
    // the raw reference, which at least says what was meant.
    if (note === undefined) return null;

    const link = document.createElement('a');
    link.className = 'vttforge-example-module-note-link';
    link.dataset.noteId = id;
    link.draggable = false;
    const icon = document.createElement('i');
    icon.className = 'fa-solid fa-note-sticky';
    link.append(icon, note.name);
    return link;
  },

  /** @param {HTMLElement} element */
  onRender(element) {
    const links = /** @type {NodeListOf<HTMLElement>} */ (
      element.querySelectorAll('a.vttforge-example-module-note-link')
    );
    for (const link of links) {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        const { noteId } = link.dataset;
        if (noteId) findNote(noteId)?.sheet.render(true);
      });
    }
  },
};
