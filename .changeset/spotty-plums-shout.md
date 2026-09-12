---
"@vttforge/types": minor
---

`Hooks.call` and `Hooks.callAll` now check the arguments of three audio hooks that used to fall through to the open `string` overload. A call that passes anything but one number to `globalPlaylistVolumeChanged`, `globalAmbientVolumeChanged` or `globalInterfaceVolumeChanged` stops compiling.

The three are what Foundry fires when a volume changes, one per channel: music, ambient and interface. Each carries the new volume, clamped to 0 through 1. `Hooks.on` and `Hooks.once` now infer that argument instead of handing you `unknown`.

`globalVolumeChanged` stays. Foundry declares it and nothing fires it, which the type now says.
