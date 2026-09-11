"""Turn the extracted surface into one TypeScript declaration file.

Every name sits in the namespace the reference puts it in, so a package writes
`foundry.utils.mergeObject` and `foundry.abstract.Document` the way the
reference spells them. A reference the file never declares becomes `unknown`.
"""
import collections
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).parent
WORK = ROOT / 'work'
MARK = '\x00'
LINKED = re.compile(r'\x00([^\x00]+)\x00')

RESERVED = {'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
            'default', 'delete', 'do', 'else', 'enum', 'export', 'extends',
            'false', 'finally', 'for', 'function', 'if', 'import', 'in',
            'instanceof', 'new', 'null', 'return', 'super', 'switch', 'this',
            'throw', 'true', 'try', 'typeof', 'var', 'void', 'while', 'with'}

DECLARATION = re.compile(r'^(interface|class|type|function|const|let|var|enum|namespace)\s')
# A few pages render an unparsed doc block into the signature. There is no
# usable type in one of those, so the member is dropped.
LEAKED_DOC = re.compile(r'@(param|returns?|type|typedef)\b|\*\s*@')
IDENT = re.compile(r'^[A-Za-z_$][\w$]*$')


def strip_initializer(s):
    """Cut a property's default value.

    Depth-aware: a `=` inside brackets belongs to an arrow type, a parameter
    default or a generic parameter default, none of which are initializers.
    """
    depth = 0
    for i, ch in enumerate(s):
        if ch in '([{<':
            depth += 1
        elif ch in ')]}':
            depth -= 1
        elif ch == '>' and not (i and s[i - 1] in '=<-'):
            depth -= 1
        elif ch == '=' and depth == 0:
            if i + 1 < len(s) and s[i + 1] == '>':
                continue
            if i and s[i - 1] in '=!<>':
                continue
            return s[:i].rstrip()
    return s


def balanced(sig):
    """Whether every bracket the signature opens it also closes."""
    depth = angle = 0
    for i, ch in enumerate(sig):
        if ch in '([{':
            depth += 1
        elif ch in ')]}':
            depth -= 1
        elif ch == '<':
            angle += 1
        elif ch == '>' and not (i and sig[i - 1] in '=<-'):
            angle -= 1
    return depth == 0 and angle == 0


def join_split(sigs):
    """Rejoin a signature the reference split across two markup blocks."""
    out, carry = [], ''
    for sig in sigs:
        if carry:
            head = re.match(r'^([A-Za-z_$][\w$]*)', carry)
            cont = sig[len(head.group(1)):] if head and sig.startswith(head.group(1)) else sig
            candidate = f'{carry}>{cont}' if head and sig.startswith(head.group(1)) \
                else f'{carry} {cont}'
        else:
            candidate = sig
        if balanced(candidate):
            out.append(candidate)
            carry = ''
        else:
            carry = candidate
    return [s for s in out if balanced(s)]


def as_constructor(s):
    """Rewrite `new Name<...>(params): Name` as `constructor(params)`.

    The class head already carries the type parameters and the return type is
    the class itself, so the parameter list is the whole of it.
    """
    angle = 0
    for i, ch in enumerate(s):
        if ch == '<':
            angle += 1
        elif ch == '>' and not (i and s[i - 1] in '=<-'):
            angle -= 1
        elif ch == '(' and angle == 0:
            depth = 0
            for j in range(i, len(s)):
                if s[j] == '(':
                    depth += 1
                elif s[j] == ')':
                    depth -= 1
                    if depth == 0:
                        return f'constructor{s[i:j + 1]}'
            break
    return s


def member_line(sig, name):
    """One signature as a line in a declaration body.

    A declaration file carries no values, so an initializer goes, and so does a
    getter's `this` parameter: neither is legal here.
    """
    s = sig.strip().rstrip(';')
    if s.startswith('new '):
        s = as_constructor(s)
    s = re.sub(r'^(?:new )?constructor', 'constructor', s)
    s = s.replace('extends class', 'extends abstract new (...args: any[]) => any')
    s = strip_initializer(s)
    s = re.sub(r'^(get \w+)\([^)]*\)', r'\1()', s)
    if s.startswith('set '):
        s = re.sub(r'\)\s*:\s*.*$', ')', s)
    if s.startswith('get ') and ':' not in s:
        s += ': unknown'
    return s + ';'


TRAILING = re.compile(r',\s*(?=[>)\]}])')


def collapse_unknown(s):
    """Drop what trails a name that resolved to nothing.

    `unknown` takes no type arguments and has no members, so a leftover
    `<...>` or `.member` after it has to go with it.
    """
    out, i = [], 0
    while True:
        j = s.find('unknown', i)
        if j < 0:
            out.append(s[i:])
            return ''.join(out)
        if j and (s[j - 1].isalnum() or s[j - 1] in '_$.'):
            out.append(s[i:j + 7])
            i = j + 7
            continue
        out.append(s[i:j + 7])
        k = j + 7
        while k < len(s):
            if s[k] == '<':
                depth = 0
                while k < len(s):
                    if s[k] == '<':
                        depth += 1
                    elif s[k] == '>':
                        depth -= 1
                        if depth == 0:
                            k += 1
                            break
                    k += 1
                continue
            if s[k] == '.' and k + 1 < len(s) and (s[k + 1].isalpha() or s[k + 1] == '_'):
                k += 1
                while k < len(s) and (s[k].isalnum() or s[k] in '_$'):
                    k += 1
                continue
            break
        i = k


def tidy(sig):
    """Fixes for how the reference renders a signature, not for what it says.

    A trailing comma before a closing bracket is a rendering artifact. `typeof`
    in front of a name that resolved to `unknown` has nothing left to read.
    """
    out = TRAILING.sub('', sig)
    out = re.sub(r'\btypeof unknown\b', 'unknown', out)
    return collapse_unknown(out)


def resolve(sig, declared):
    """Keep a linked name the file declares; replace any other with `unknown`.

    A name with no link is a generic parameter or a type TypeScript already
    has, and is left as it stands.
    """
    return LINKED.sub(lambda m: m.group(1) if m.group(1) in declared else 'unknown', sig)


TYPE_POSITION = re.compile(r'(?<=[:<|&,([=>\s])([A-Za-z_$][\w$]*)(?![\w$]*\s*[:(])')


def erase(sig, missing, byname):
    """Settle a name the reference wrote without a link.

    Some of those name something the reference does publish under a namespace,
    and the namespace is recoverable when only one entity carries that name.
    The rest name types the reference never publishes, so they become
    `unknown`. Only a name in type position is touched: a member or a
    parameter may share a spelling with a type.
    """
    if not missing:
        return sig

    def sub(m):
        name = m.group(1)
        if name not in missing:
            return name
        full = byname.get(name)
        return full if full else 'unknown'

    return TYPE_POSITION.sub(sub, sig)


def addressable(qname):
    return all(IDENT.match(s) and s not in RESERVED for s in qname.split('.'))


BINDER = re.compile(r'\b([A-Za-z_$][\w$]*)\s+extends\b')


def binders(sig):
    """The type parameters a signature declares.

    A parameter is spelled out rather than linked, so nothing else marks it as
    a name that already has a meaning here.
    """
    names = set(BINDER.findall(sig))
    # Only a list that opens the declaration binds names; anywhere else a
    # `<...>` is passing type arguments, not declaring parameters.
    m = re.match(r'^(?:new [\w.$]+|[A-Za-z_$][\w$]*)\s*<([^<>]*)>', sig)
    if m:
        for part in m.group(1).split(','):
            part = part.strip().split(' ')[0]
            if re.match(r'^[A-Z][\w$]*$', part):
                names.add(part)
    return names


def params(e):
    """The type parameter list, each one defaulted.

    A default lets a caller write the bare name, which the reference itself
    does in plenty of signatures.
    """
    if not e['params']:
        return ''
    return '<' + ', '.join(f'{p} = any' for p in e['params']) + '>'


def emit_entity(e, declared, classes, missing, byname, indent):
    pad = ' ' * indent
    name = e['qname'].rsplit('.', 1)[-1]
    safe = set(e['params'])
    for sig in e['signatures']:
        safe |= binders(sig)
    sigs = [tidy(erase(resolve(s, declared), missing - safe, byname))
            for s in e['signatures'] if not LEAKED_DOC.search(s)]
    # A page repeats the whole declaration alongside its members. Only the
    # members belong in the body.
    body_sigs = [s for s in sigs if not DECLARATION.match(s)]
    if e['kind'] in ('type', 'function', 'enum') or not body_sigs:
        body_sigs = body_sigs or sigs

    if e['kind'] == 'function':
        out = []
        for s in join_split(sigs):
            line = re.sub(r'^function\s+', '', member_line(s, name))
            out.append(f'{pad}function {line}')
        return '\n'.join(out) or f'{pad}function {name}(...args: any[]): any;'

    if e['kind'] == 'type':
        first = (sigs[0] if sigs else '').rstrip(';')
        first = re.sub(r'^type\s+', '', first)
        first = re.sub(r'^' + re.escape(name) + r'(<[^=]*>)?\s*[:=]?\s*', '', first)
        return f'{pad}type {name}{params(e)} = {first or "unknown"};'

    if e['kind'] == 'variable':
        first = (sigs[0] if sigs else '').rstrip(';')
        first = re.sub(r'^(?:const|let|var)\s+', '', first)
        first = strip_initializer(first)
        m = re.match(r'^' + re.escape(name) + r'\s*:\s*(.+)$', first)
        return f'{pad}const {name}: {m.group(1) if m else "unknown"};'

    if e['kind'] == 'class':
        chain = [c for c in e['extends'] if c != e['qname'] and c in classes]
        base = f' extends {chain[-1]}' if chain else ''
        head = f'{pad}class {name}{params(e)}{base} {{'
    elif e['kind'] == 'enum':
        head = f'{pad}enum {name} {{'
    else:
        head = f'{pad}interface {name}{params(e)} {{'

    lines, taken = [], set()
    for sig in join_split(body_sigs):
        line = member_line(sig, name)
        key = re.match(r'^(?:get |set |static |readonly )*([A-Za-z_$"\[][\w$"\]]*)', line)
        key = key.group(1) if key else line
        # The reference lists a member once per overload set it belongs to.
        if key != 'constructor' and key in taken:
            continue
        taken.add(key)
        lines.append(line)
    if e['kind'] == 'enum':
        return f'{pad}enum {name} {{}}'
    return '\n'.join([head] + [f'{pad}  {b}' for b in lines] + [pad + '}'])


def tree_insert(tree, segs, entity):
    node = tree
    for s in segs:
        node = node.setdefault(s, {'_ns': {}, '_items': []})['_ns']
    return node


def main():
    missing = set()
    path = ROOT / 'missing.txt'
    if path.exists():
        missing = {n.strip() for n in path.read_text().split('\n') if n.strip()}
    surface = json.loads((WORK / 'surface.json').read_text())
    surface = [e for e in surface if addressable(e['qname'])]
    declared = {e['qname'] for e in surface}
    classes = {e['qname'] for e in surface if e['kind'] == 'class'}
    # A bare name is addressable when exactly one entity carries it.
    counts = collections.Counter(q.rsplit('.', 1)[-1] for q in declared)
    byname = {q.rsplit('.', 1)[-1]: q for q in declared
              if counts[q.rsplit('.', 1)[-1]] == 1}

    tree = {}
    root_items = []
    for e in surface:
        segs = e['qname'].split('.')[:-1]
        if not segs:
            root_items.append(e)
            continue
        node, cur = tree, None
        for s in segs:
            cur = node.setdefault(s, {'ns': {}, 'items': []})
            node = cur['ns']
        cur['items'].append(e)

    def render(node, depth, top):
        out = []
        for key in sorted(node):
            entry = node[key]
            pad = '  ' * depth
            word = 'declare namespace' if top else 'namespace'
            out.append(f'{pad}{word} {key} {{')
            for e in entry['items']:
                out.append(emit_entity(e, declared, classes, missing, byname, (depth + 1) * 2))
            out.append(render(entry['ns'], depth + 1, False))
            out.append(f'{pad}}}')
        return '\n'.join(x for x in out if x)

    parts = ['''/**
 * The Foundry VTT API, declared for TypeScript.
 *
 * Generated from Foundry's published API reference at foundryvtt.com/api.
 * Signatures only: the reference's prose is not read and not reproduced here.
 *
 * Do not edit. Run the generator against a newer reference instead.
 */

/* biome-ignore-all lint: generated */''']
    for e in root_items:
        parts.append('declare ' + emit_entity(e, declared, classes, missing, byname, 0).lstrip())
    parts.append(render(tree, 0, True))

    out = '\n\n'.join(parts) + '\n'
    (WORK / 'foundry-api.d.ts').write_text(out)
    print('bytes', len(out), 'entities', len(surface))


if __name__ == '__main__':
    main()
