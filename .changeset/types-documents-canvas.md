---
"@vttforge/types": minor
"@vttforge/core": minor
---

Type dice, chat, combat, scenes, tokens, the canvas and the ApplicationV2
render surface.

**What breaks.** `_prepareContext`, `_onRender` and `_getHeaderControls` on the
sheet bases carry real types now. An override that declared `options: unknown`
stops compiling at the `super` call, because `unknown` cannot be passed to a
typed parameter. Name the type instead:

```diff
-  override async _prepareContext(options: unknown): Promise<Record<string, unknown>> {
+  override async _prepareContext(
+    options: ApplicationRenderOptions,
+  ): Promise<ApplicationRenderContext> {
```

Both types come from `@vttforge/core`. `postRoll` returns a `ChatMessageLike`
rather than `unknown`.

New in `@vttforge/types`:

- `RollLike`, `RollConstructor`, `DieTermLike`, `DiceTermResult`. `total` is
  `number | undefined`, because a roll has none before `evaluate()` resolves.
  `toMessage` takes `messageMode`; `rollMode` is there and tagged deprecated,
  which is what Foundry did in v14.
- `ChatMessageLike`, `ChatSpeakerData`, `ChatMessageConstructor`.
- `CombatLike`, `CombatantLike`, `CombatHistoryData`.
  `getCombatantsByActor` and `getCombatantsByToken` return arrays, as they do
  since v14.
- `SceneLike`, `LevelLike`, `TokenDocumentLike`, `TokenObjectLike`, `CanvasApi`.
  A scene's background lives on a Level in v14, and the types say so. A token
  carries `level` and `depth`.
- `JournalEntryLike`, `MacroLike`, `FolderLikeDocument`.
- The render surface: `ApplicationConfiguration`, `ApplicationRenderOptions`,
  `ApplicationRenderContext`, `ApplicationPosition`, `ApplicationTab`,
  `ApplicationTabsConfiguration`, `HandlebarsTemplatePart`,
  `ApplicationHeaderControlsEntry`, `ApplicationClickAction`.

`game.messages`, `game.scenes`, `game.combats`, `game.combat`, `game.journal`,
`game.macros` and `game.folders` now hand back the document they hold.

`unknown` left on the public surface of `@vttforge/core`: 7, down from 37. Each
one is a generic of ours, not a Foundry type: a field's `initial` and
`validate`, the `FieldInstance` brand, the `OnHook` target, and the socket
payload the consumer defines.
