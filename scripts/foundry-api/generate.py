"""Build the Foundry API surface from its published reference at foundryvtt.com/api.

Reads the reference's search index for the list of names, then one page per
name for that name's signatures. Every type a signature mentions is a link on
the page, and the link's target file is named after the fully qualified name,
so the reference resolves its own references. Signatures only: the prose in the
reference is not read and not reproduced.
"""
import collections
import json
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import qualify as Q

ROOT = pathlib.Path(__file__).parent
WORK = ROOT / 'work'
API = WORK / 'api'

KIND = {128: 'class', 256: 'interface', 64: 'function', 2097152: 'type',
        4194304: 'type', 32: 'variable', 4: 'namespace', 2: 'module', 8: 'enum'}

SIGNATURE = re.compile(
    r'<(?:div|li|h4)[^>]*class="[^"]*tsd-signature[^"]*"[^>]*>([\s\S]*?)</(?:div|li|h4)>')
TITLE = re.compile(r'<h1[^>]*>([\s\S]*?)</h1>')
HIERARCHY = re.compile(r'<ul class="tsd-hierarchy">([\s\S]*?)</section>')
BASE = re.compile(r'<a href="([^"#]+?\.html)"[^>]*class="[^"]*tsd-kind-(?:class|interface)[^"]*"')


def members(page):
    seen, out = set(), []
    for m in SIGNATURE.finditer(page):
        sig = Q.marked(m.group(1))
        if sig and sig not in seen:
            seen.add(sig)
            out.append(sig)
    return out


def typeparams(page):
    """The type parameter names, from the page heading.

    The heading spells the declaration the way a caller writes it, so
    `Collection<K, V>` says the class takes two.
    """
    m = TITLE.search(page)
    if not m:
        return []
    head = Q.text(m.group(1))
    m = re.search(r'<(.+)>', head)
    if not m:
        return []
    return [p.strip() for p in m.group(1).split(',') if re.match(r'^\s*[A-Za-z_$][\w$]*\s*$', p)]


def extends(page):
    """The ancestors, from the hierarchy panel.

    The panel lists ancestors, then the page's own name, then everything that
    derives from it. Only the part above the page's own name is a base class.
    """
    m = HIERARCHY.search(page)
    if not m:
        return []
    above = m.group(1).split('tsd-hierarchy-target')[0]
    return [Q.qname(h) for h in BASE.findall(above)]


def main():
    rows = json.loads((WORK / 'rows.json').read_text())
    out, stats = [], collections.Counter()
    seen = set()
    for r in rows:
        url = r['url']
        if '#' in url:
            continue
        kind = KIND.get(r['kind'])
        if kind in (None, 'namespace', 'module'):
            continue
        name = Q.qname(url)
        if name in seen:
            continue
        path = API / url.replace('/', '_')
        if not path.exists():
            stats['missing'] += 1
            continue
        seen.add(name)
        page = path.read_text(encoding='utf-8', errors='ignore')
        sigs = members(page)
        # A class the reference names without describing a member still
        # belongs here: the name and the base class are what it has to give.
        if not sigs:
            stats['no members'] += 1
        out.append({'qname': name, 'kind': kind, 'params': typeparams(page),
                    'extends': extends(page), 'signatures': sigs})
        stats[kind] += 1
    (WORK / 'surface.json').write_text(json.dumps(out, indent=1))
    print(dict(stats), 'entities', len(out))


if __name__ == '__main__':
    main()
