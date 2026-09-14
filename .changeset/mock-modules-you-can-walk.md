---
'@vttforge/testing': minor
---

`game.modules` in the mock answers the rest of a collection: `values`, `keys`,
`entries`, `filter`, `find`, `map`, `forEach`, `some`, `every`, `contents` and
iteration. It answered `get`, `has` and `size`, which is enough for a package
reading its own handle and nothing for one that walks the list. An update
checker or a report is exactly the second kind, and had to hand-build a
collection to be tested at all.

A new `modules` option says which modules the world has:

```ts
withMockFoundry({
  modules: [{ id: 'other-module', version: '1.2.0', url: 'https://github.com/o/r' }],
});
```

`get` still invents a handle for any id the code under test names, so nothing
that worked before changes. A handle named by id alone gets a title equal to
its id and version `1.0.0`.
