---
'@vttforge/core': minor
---

`BaseApplication` — a plain `ApplicationV2` window without the two traps.

The document sheets already had a baseline. Everything else a package puts on screen — a config dialog, a picker, a reader — is a bare `ApplicationV2`, and writing one by hand means meeting both of these:

- **`_replaceHTML` is easy to forget.** ApplicationV2 splits rendering in two, and implementing only `_renderHTML` leaves the class silently unrenderable. Foundry reports it at the moment something tries to open the window, as an error about abstract methods. Nearly every implementation of the second half is the same line, so this ships it.
- **A missing `_renderHTML` fails late.** This checks at construction and names the class, so it fails where the class is used rather than deep inside a render.

Both were met while porting a real module onto the SDK.
