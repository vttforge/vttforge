---
"@vttforge/types": minor
---

`TokenObjectLike` now extends a new `PlaceableObjectLike`, which adds a required `id`. A hand-written stub that stood in for a token has to grow that field.

Twelve hook names are gone, because Foundry never calls them: `drawObject`, `refreshObject`, `destroyObject`, `controlObject`, `hoverObject`, `drawLayer`, `tearDownLayer`, `activateLayer`, `deactivateLayer`, `pastePlaceableObject`, `getDocumentContextOptions` and `getPlaceableContextOptions`. Each names a family in Foundry's hook documentation. What fires is the name built from the document or the layer, so a listener bound to one of the twelve never ran. Bind to the real name instead: `drawToken`, `controlTile`, `drawTokenLayer`.

`preRenderApplication` is now `preRenderApplicationV2`. Foundry dispatches that hook for every class in the chain, and the name that reaches the base carries the suffix.

In their place, the real names are typed. `draw`, `refresh`, `destroy`, `control`, `hover` and `paste` take a placeable document name, and `draw`, `tearDown`, `activate` and `deactivate` take a layer name. A token hook hands you a `TokenObjectLike`, the rest hand you a `PlaceableObjectLike`, and `activate` exists only for the layers that take tools.

Three audio hooks join them: `globalPlaylistVolumeChanged`, `globalAmbientVolumeChanged` and `globalInterfaceVolumeChanged`, one per channel, each carrying the new volume clamped to 0 through 1. `globalVolumeChanged` stays, and its type now says Foundry declares it and nothing fires it.

New exported types: `PlaceableObjectLike`, `PlaceableDocumentName`, `PlaceableObjectMap`, `PlaceableHooks`, `CanvasLayerName`, `InteractionLayerName`, `CanvasLayerLike` and `CanvasLayerHooks`.
