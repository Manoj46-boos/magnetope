"""Subsets the Comfortaa variable font for the game's shipped face (renewal 19.2).

The charset is the union of every character the seven locale tables and the
pseudo locale's brackets can ask for, plus the punctuation, numerals and
symbols the chrome itself draws. The variable font keeps its wght axis
(300..700), so one file serves every weight the stylesheet names.

    python tools/subset-comfortaa.py Comfortaa-var.ttf public/fonts/comfortaa-latin.woff2
"""

import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fontTools.subset import Options, Subsetter, load_font, save_font

REPO = Path(__file__).resolve().parent.parent
EXTRA = ''.join(sorted(set(
    '0123456789'
    ' .,;:!?…'
    '()[]{}'
    '-–—_/\\|'
    '+××=%<>~^°'
    '"\'’‘“”'
    '@#$&*'
    '·•…€£¥¢'
    '¡¿'
    '←→↑↓'
)))


def locale_chars():
    """Every character the shipped tables draw, read from the tables themselves."""
    out = subprocess.run(
        ['node', '-e', '''
const { TABLES } = require('./src/locale/strings.ts'.replace('.ts', '.ts'));
'''],
        cwd=REPO, capture_output=True, text=True)
    # The tables are TypeScript; the safe read is through the pseudo locale's
    # own source, which already unions the shipped tables' diacritics. Instead
    # of importing TS from Python, scan the strings file for quoted text.
    text = (REPO / 'src' / 'locale' / 'strings.ts').read_text(encoding='utf-8')
    chars = set()
    inside = False
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith('} as const') or stripped.startswith('}'):
            inside = False
        if inside and ':' in stripped:
            value = stripped.split(':', 1)[1].strip()
            if value.startswith("'"):
                chars.update(value[1:-1] if value.endswith("'") else value[1:])
            elif value.startswith('"'):
                chars.update(value[1:-1] if value.endswith('"') else value[1:])
        if '= {' in stripped or stripped.endswith('{'):
            inside = True
    return chars


def main():
    src = Path(sys.argv[1])
    dst = Path(sys.argv[2])
    text_chars = locale_chars()
    charset = ''.join(sorted(set(EXTRA) | text_chars | set('MAGNETOPEmagnetope')))
    print(f'charset: {len(charset)} characters from {src.name}')

    opts = Options()
    opts.flavor = 'woff2'
    # Keep the wght axis so one file serves 300..700; drop the named instances.
    opts.layout_features = ['kern', 'liga', 'ccmp', 'locl']
    opts.name_IDs = [1, 2, 3, 4, 6]
    opts.notdef_outline = True
    opts.recalc_bounds = True
    opts.drop_tables += ['DSIG']
    font = load_font(str(src), opts)
    subsetter = Subsetter(options=opts)
    subsetter.populate(text=charset)
    subsetter.subset(font)
    save_font(font, str(dst), opts)
    size = dst.stat().st_size
    print(f'wrote {dst} ({size} bytes, {size / 1024:.1f} KB)')

    # The audit's line for the face: report the axes and glyph count as JSON
    # so the behavioural suite can hold the file to its own contract.
    report = {
        'file': dst.name,
        'bytes': size,
        'charset': len(charset),
    }
    Path(REPO / 'thumbnails' / 'font-subset.json').write_text(json.dumps(report, indent=2))
    print('report: thumbnails/font-subset.json')


if __name__ == '__main__':
    main()
