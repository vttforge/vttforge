---
'@vttforge/core': minor
---

The base factories now report what they add.

Every `Base*` factory returned `any`, which gave up on two things at once: a subclass could not write `override` on a member it really was overriding, and a call to a method that does not exist passed silently. Both happened while porting a real module onto the SDK — the second one shipped a broken call into a release.

They now return the members they contribute, with the rest of the Foundry surface reachable through an index signature. A property the SDK knows about carries its real type; anything else behaves as before.

This will surface `override` errors in subclasses that were previously allowed to omit the keyword. That is the point: TypeScript can see the member now.

The index signature is what `@vttforge/types` replaces when it lands.
