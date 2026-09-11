---
'@vttforge/cli': minor
---

A call that used to succeed now exits 1. `vttforge init` refuses a flag it
does not know and a value it does not accept, instead of carrying on. A script
or a CI job passing either one starts failing on upgrade, which is the point:
it was not doing what it asked for.

Two ways to lose. An unknown flag was collected and ignored, so
`vttforge init app --template module-ts` exited 0 and scaffolded a system: the
flag does not exist, and nothing said so. A known flag with an unrecognised
value fell back to the default, so `--type modul` also produced a system, with
`system.json` and every system template file in it. Both surface much later,
usually in Foundry.

`--type` and `--lang` now list what they take, in the error and in `--help`.
An unknown flag names itself and the command's real flags. Both exit 1 and
write nothing. Every command carries the unknown-flag check, not only `init`.

`vttforge migrate` had the same fallback on `--style` and `--lang`, where a
typo wrote the wrong kind of file. Both are checked now too.

`create-vttforge` does the same. It used to skip unknown flags on purpose, to
keep the create flow from crashing; the cost was a scaffold that silently
ignored what was asked for.

The project templates pin `@vttforge/cli` by minor, so they move to the
release that carries this.
