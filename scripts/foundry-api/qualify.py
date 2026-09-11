"""Rewrite typedoc's type links into fully qualified names.

Every type reference on a page is an anchor whose target file is named after the
fully qualified name of what it points at. That link is the resolution: read it
instead of guessing which namespace a bare name belongs to.
"""
import html as _html
import re

TAG = re.compile(r'<[^>]+>')
WS = re.compile(r'\s+')
ANCHOR = re.compile(r'<a href="([^"#]+?\.html)"[^>]*>([\s\S]*?)</a>')
MARK = '\x00'
PAIR = re.compile(r'\x00([\w.$]+)\x00(?:<[^>]*>|\s)*\.(?:<[^>]*>|\s)*\x00([\w.$]+)\x00')


def qname(href: str) -> str:
    """The qualified name a link points at: the file's own name."""
    base = href.rsplit('/', 1)[-1]
    return base[:-5] if base.endswith('.html') else base


def qualify(fragment: str) -> str:
    """Replace each type link with the name it resolves to."""

    def sub(m):
        name = WS.sub(' ', _html.unescape(TAG.sub('', m.group(2)))).strip()
        if not name:
            return ''
        return f'{MARK}{qname(m.group(1))}{MARK}'

    out = ANCHOR.sub(sub, fragment)
    # `abstract.DatabaseBackend` arrives as two links joined by a dot. Both are
    # already qualified, so the second one alone says everything.
    while True:
        new = PAIR.sub(lambda m: f'{MARK}{m.group(2)}{MARK}'
                       if m.group(2).startswith(m.group(1) + '.') else m.group(0), out)
        if new == out:
            break
        out = new
    return out


def marked(fragment: str) -> str:
    """A signature as plain text, each resolved name wrapped in markers.

    The markers say which names came from a link. A name without them is a
    generic parameter or a type TypeScript already has, and is left alone.
    """
    return WS.sub(' ', _html.unescape(TAG.sub('', qualify(fragment)))).strip()


def text(fragment: str) -> str:
    """A signature as plain text, with every linked name fully qualified."""
    return marked(fragment).replace(MARK, '')
