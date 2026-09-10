# Keywords

A keyword is a rules term: an id, a label and a description. Register the list once, on `registerSystem` or `registerModule`, and two things follow.

```ts
registerSystem({
  id: SYSTEM_ID,
  keywords: [
    {
      id: 'reach',
      label: 'MY_SYSTEM.Keyword.reach.label',
      description: 'MY_SYSTEM.Keyword.reach.description',
      category: 'MY_SYSTEM.Keyword.category.combat',
    },
    { id: 'stowed', label: 'Stowed', description: 'Packed away. Drawing it takes an action.' },
  ],
});
```

Labels, descriptions and categories may be localization keys or plain text. They are translated when used, after `i18nInit`.

## In rich text

`@Keyword[reach]` in any rich text field (chat, journals, item descriptions) becomes the label, with the description as its tooltip:

```html
<span class="vttf-keyword" data-vttforge-keyword="reach" data-tooltip="Attacks from 2 m away.">Reach</span>
```

`@Keyword[reach]{long reach}` shows the text in braces instead of the label. `@vttforge/styles` underlines the span; the tooltip is Foundry's own.

An id the package does not know is left as written. Two packages can each register keywords, and `@Keyword[...]` resolves against whichever one knows the id. The enricher is registered as `<package id>.keyword`, next to your own `enrichers`.

## The journal

On `ready`, the GM's client creates a journal entry named "<package title> keywords" with one page: a list per category, uncategorised terms first, each list sorted by label. On the next `ready` the page is rewritten only when the list changed. Players' clients do nothing.

The journal is found by a flag under your package's scope, not by name, so the GM can rename or move it. Deleting it brings it back on the next `ready`.

```ts
registerSystem({
  id: SYSTEM_ID,
  keywords,
  keywordsJournal: 'Glossary', // the name
});

registerModule({
  id: MODULE_ID,
  keywords,
  keywordsJournal: false, // enricher only, no journal
});
```

## Rules

An id is one segment of letters, digits and hyphens, the part that goes inside `@Keyword[...]`. A repeated id within the package, or a keyword without a string label and description, is refused when you register: [VTTF-0009](../errors/VTTF-0009).

`keywordJournalContent(keywords)` returns the page HTML and `syncKeywordJournal(packageId, keywords, name?)` writes it, for a package that wants either outside the registration.
