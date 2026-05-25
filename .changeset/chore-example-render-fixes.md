---
"@vttforge-examples/simple-system": patch
---

Make `examples/simple-system` actually render inside Foundry v13:

- **Bundle the entry with tsdown** (`dist/main.mjs`). Browsers can't resolve
  bare specifiers like `@vttforge/core`, and Foundry serves system files as
  static assets — so the entry point has to be self-contained. This is what
  `@vttforge/vite-plugin` will own in v0.2; we pre-empt it locally.
- `system.json` now points to `dist/main.mjs`.
- **Template/CSS fixes** discovered while testing the SDK against a live
  Foundry runtime:
  - Templates iterate `tabs` directly (ApplicationV2's single-group
    `_prepareTabs` output is keyed by tab id; nested `tabs.<group>.<tabId>`
    is only for multi-group sheets).
  - Tab nav uses `<button type="button">`; `<a>` without `href` doesn't
    trigger ApplicationV2's pointer-event delegation.
  - Each sheet ships its own `tab` action handler that toggles the `.active`
    class on the matching nav button and content section. (The SDK should
    hoist this; tracked as a follow-up.)
  - Opaque sheet background — without it Foundry's default leaves the
    canvas bleeding through.
- **Compose**: drop the `user:` override and pin `user: "0:0"` so felddy can
  chown the named volume on first boot; the previous override blocked the
  install with `EACCES: permission denied`. `.env.example` updated to
  match — no more UID/GID knobs needed.
- **Temporary `_prepareContext` workaround** in both sheets unwraps the
  single-group `context.tabs.primary` that `BaseActorSheet._prepareContext`
  adds today. The SDK fix removes the need for this — a follow-up PR makes
  the auto-wrap fire only for multi-group sheets.

No `@vttforge/core` change.
