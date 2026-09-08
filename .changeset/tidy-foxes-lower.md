---
'@vttforge/vite-plugin': minor
---

Lower TC39 decorators in the build, so `@ActorDataModel` and friends work in the bundle Foundry loads.

Vite 8 replaced esbuild with Oxc, and Oxc does not yet lower Stage 3 decorators. A system that applied one and ran `vttforge build` shipped the `@` untransformed and failed to load in every browser, with no error at build time. The plugin now runs Babel's decorator plugin ahead of Oxc, the workaround the Vite 8 migration guide gives, filtered to files that contain an `@`. A project that never uses a decorator pays nothing.

**One type changed.** `vttforge()` now returns `Plugin[]` rather than `Plugin`: the decorator lowering, then the plugin proper. `plugins: [vttforge({ id })]` keeps working unchanged because Vite flattens nested plugin arrays. Only code that annotated the result as `Plugin` needs to widen it.
