---
'@vttforge/types': minor
'@vttforge/core': patch
---

`FoundryNamespace` types the `foundry` global, so a project stops writing its
own.

Until now every consumer hand-wrote an interface for it. The scaffolded
templates ship one, and so did every project built on this SDK, each covering
the members that project happened to use and each drifting from the others.
Delete yours and import this instead:

```ts
import type { FoundryNamespace } from '@vttforge/types';

declare global {
  // `var`, not `const`: two blocks naming one global only merge as `var`.
  var foundry: FoundryNamespace;
}
```

It follows the same rule as the rest of the package: every member is one a real
consumer reached for, not one that exists in Foundry. `foundry.utils` is the
documented utility surface plus `saveDataToFile` and `readTextFromFile`.
`applications.api` names `ApplicationV2`, `DocumentSheetV2`, `DialogV2` and
`HandlebarsApplicationMixin`, with the three dialog helpers typed apart because
they return different things. The class namespaces spell out the names real
consumers use and leave the rest reachable as `AnyClass | undefined`.

The point is the misspelling. `foundry.data.feilds.StringField` stops
compiling, and a wrong namespace path is the mistake that survives review and
fails in front of a player.

`PackageHandle` also gains `url` and `manifest`, both optional, both read off
the manifest. They are what an update checker needs to find a package's release
feed, and reading them used to mean a cast.

Nothing existing changes. Every addition is new, and `@vttforge/core`
re-exports them like the rest.
