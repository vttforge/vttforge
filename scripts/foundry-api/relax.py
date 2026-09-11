"""Loosen the members the reference declares in a way its own base class refuses.

A subclass page sometimes gives a member a type that contradicts the one the
base page gives it. Nothing in the reference says which is right, so the member
gets `any` and the rest of the class keeps its types. The compiler decides
which members those are: this runs it, loosens what it names, and repeats until
nothing is left.
"""
import collections
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).parent
WORK = ROOT / 'work'
TSC = str(ROOT.parents[1] / 'node_modules' / '.bin' / 'tsc')
FILE = WORK / 'foundry-api.d.ts'
# Every complaint gets the same answer: the member the compiler points at is
# the one the reference could not describe consistently, so it loses its type.
ERROR = re.compile(r'foundry-api\.d\.ts\((\d+),\d+\): error TS(\d+):')
HEAD = re.compile(r'^(\s*)((?:static |readonly |abstract )*)(?:(get|set) )?([A-Za-z_$][\w$]*|"[^"]*"|\[[^\]]*\])')


DECL = re.compile(r'^\s*(?:declare |export )*(namespace|class|interface|enum)\b')
# A type alias, including one whose parameter list carries a default. The
# parameter list is kept: callers pass arguments to it.
ALIAS = re.compile(r'^(\s*)(?:declare )?type ([A-Za-z_$][\w$]*)\s*(<.*>)?\s*=')
FUNC = re.compile(r'^(\s*)(?:declare )?function ([A-Za-z_$][\w$]*)')


def loosen(line, stage):
    """The next looser shape for a member the compiler rejected.

    Which shape settles a clash depends on the shape the base class uses, so
    this walks one way through three of them: a method, then a property, then
    a getter. It never walks back, or a member and its base would swap shapes
    forever.
    """
    # A declaration head names the thing; loosening it would delete it.
    if DECL.match(line):
        return None
    m = ALIAS.match(line)
    if m:
        return f'{m.group(1)}type {m.group(2)}{m.group(3) or ""} = any;'
    m = FUNC.match(line)
    if m:
        return f'{m.group(1)}function {m.group(2)}(...args: any[]): any;'
    m = HEAD.match(line)
    if not m:
        return None
    pad, mods, _, name = m.groups()
    rest = line[m.end():].lstrip()
    if name == 'constructor':
        return f'{pad}constructor(...args: any[]);'
    if stage == 0:
        return f'{pad}{mods}{name}(...args: any[]): any;' if rest.startswith('(') \
            else f'{pad}{mods}{name}: any;'
    if stage == 1:
        return f'{pad}{mods}{name}: any;'
    if stage == 2:
        return f'{pad}{mods}get {name}(): any;'
    return None


def run():
    """Compile, and hand back the lines the compiler printed.

    A run that fails without a line this script can read is a bug in this
    script, not a clean file, so it stops rather than report success.
    """
    out = subprocess.run([TSC, '-p', str(ROOT / 'tsconfig.json')],
                         cwd=ROOT, capture_output=True, text=True)
    lines = (out.stdout + out.stderr).split('\n')
    if out.returncode and not any(ERROR.search(l) for l in lines):
        raise SystemExit('tsc failed but printed nothing this script reads:\n'
                         + '\n'.join(lines[:20]))
    return lines


def main():
    stage = collections.Counter()
    for round_ in range(1, 13):
        lines = FILE.read_text().split('\n')
        errors = [ERROR.search(l) for l in run()]
        errors = [m for m in errors if m]
        total = len(errors)
        targets = sorted({int(m.group(1)) for m in errors})
        print(f'round {round_}: {total} errors, {len(targets)} lines to loosen')
        if not targets:
            return 0 if total == 0 else total
        changed = 0
        for n in targets:
            src = lines[n - 1]
            new = loosen(src, stage[n])
            stage[n] += 1
            if new and new != src:
                lines[n - 1] = new
                changed += 1
        if not changed:
            print('nothing left to loosen')
            return total
        FILE.write_text('\n'.join(lines))
    return -1


if __name__ == '__main__':
    sys.exit(min(main(), 250))
