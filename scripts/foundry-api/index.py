"""Fetch the reference's search index and list every page it points at.

The index is the reference's own table of contents: one row per documented
name, carrying the name, its kind and the page that describes it.
"""
import base64
import json
import pathlib
import re
import urllib.request
import zlib

ROOT = pathlib.Path(__file__).parent
WORK = ROOT / 'work'
BASE = 'https://foundryvtt.com/api'


def main():
    WORK.mkdir(exist_ok=True)
    raw = urllib.request.urlopen(f'{BASE}/assets/search.js', timeout=60).read().decode()
    payload = re.search(r'"(.*)"', raw, re.S).group(1)
    data = json.loads(zlib.decompress(base64.b64decode(payload), 47))
    rows = data['rows']
    (WORK / 'rows.json').write_text(json.dumps(rows))
    pages = sorted({r['url'].split('#')[0] for r in rows})
    (WORK / 'pages.txt').write_text('\n'.join(f'{BASE}/{p}' for p in pages) + '\n')
    print('rows', len(rows), 'pages', len(pages))


if __name__ == '__main__':
    main()
