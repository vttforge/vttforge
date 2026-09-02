---
'@vttforge/core': minor
---

Replace the index signature on the base classes with the Foundry members they stand on.

The base factories returned an instance typed `Added & { [member: string]: any }`. The index signature was meant as a middle ground — our half typed, Foundry's half reachable. Measured against two real consumers, it turned out to be the worse of the two failures.

It made every property access legal:

```ts
const viewer = new PdfViewer();
viewer.goToPage(3);      // no such method — accepted
viewer.tpyoDeVerdade();  // not even a real name — accepted
```

A module shipped a release calling `url` and `goToPage` on a viewer that had neither, and nothing reported it.

And it did not buy the thing it looked like it bought. An index signature is not a declaration, so `override` on a Foundry member was rejected anyway — `error TS4113`. It permitted what should have failed and forbade what should have worked.

`ApplicationV2Members` and `DocumentSheetV2Members` now describe the Foundry surface these bases rely on: `element`, `title`, `rendered`, `options`, `render`, `close`, `_prepareContext`, `_onRender`, `_onFirstRender`, plus `document` and `isEditable` for sheets. It is not the whole ApplicationV2 API and does not claim to be.

**This will surface errors in existing code, and that is the point.** Two shapes:

- **A member you call that nobody declared.** Either a typo, or a Foundry member outside the set above. The second needs a cast — one line, written on purpose, instead of an index signature writing it for you on every line.
- **`this.document` is `unknown`.** Which document a sheet is for is yours to know. A getter says it once:

  ```ts
  get actor(): MyActor {
    return this.document as MyActor;
  }
  ```

`UntypedFoundryMembers` is gone. Nothing exported it usefully — it only ever widened.

`BaseTypeDataModel()` with no schema now gives the hooks and nothing invented. Pass your schema function to get the fields typed too, which is what the example system does.
