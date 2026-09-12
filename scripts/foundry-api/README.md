# The generated Foundry API declarations

`packages/types/foundry-api.d.ts` is built from Foundry's published API
reference at <https://foundryvtt.com/api>. Do not edit it. Run `./run.sh` to
rebuild it from a newer reference.

## What the steps do

| Step | What it reads | What it writes |
| --- | --- | --- |
| `index.py` | the reference's search index | `work/rows.json`, `work/pages.txt` |
| `fetch.sh` | every page in `pages.txt` | `work/api/` |
| `generate.py` | those pages | `work/surface.json` |
| `emit.py` | the surface | `work/foundry-api.d.ts` |
| `relax.py` | the compiler's own complaints | the same file, loosened |

Signatures only. The prose in the reference is not read and not reproduced.

## How a name resolves

Every type a signature mentions is a link, and the link's target file is named
after the fully qualified name. So the reference resolves its own references,
and nothing here guesses which namespace a bare name belongs to.

## What the reference leaves out

The reference does not document API that Foundry deprecates, so a name that
exists at runtime and not in this file is usually one of those, and the
reference documents its replacement instead. Reach for the replacement rather
than declaring the old name by hand.

Every page the index lists of a kind this can declare does get declared: 1,848
of 1,848. `generate.py` prints the count, and a page that names a class without
describing a member still contributes the name and its base class.

## The two inputs that are not the reference

`missing.txt` lists names the reference writes without a link and never
declares. They become `unknown`. The list came from the compiler: emit, compile,
collect every "cannot find name", add it here.

`relax.py` handles the other side. A subclass page sometimes gives a member a
type that contradicts the base page, and nothing in the reference says which is
right. The compiler names those members and they lose their type. About six
percent of members end up this way; the rest keep what the reference says.
