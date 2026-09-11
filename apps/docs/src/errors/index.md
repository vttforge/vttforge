# Error codes

Every error this SDK throws carries a `VTTF-NNNN` code and a link to its page.

```ts
try {
  registerSystem(config);
} catch (err) {
  if (err instanceof VttfError) {
    console.error(err.code, err.docsUrl);
  }
}
```

Codes are append-only and stable across majors. A code never changes meaning,
and a retired one is not reused.

These pages are generated from the registry in `@vttforge/core`, so a new code
appears here by existing rather than by someone remembering to write it.
