"""Render the prison rooms exactly the way buildPrisonZone does, side by side
with the reference screenshot the holding cell is measured from.

PRISON_ROOMS is parsed out of OverworldScene.js rather than duplicated here,
so this can't quietly drift from what the game actually draws - if the
comparison looks right, the room looks right. Same approach as
compare_home_rooms.py.

Run: python production/compare_prison_rooms.py
Writes _compare_jailCell.png and _compare_jailMaze.png.
"""
import json
import os
import re

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCENE = os.path.join(ROOT, 'src/game/scenes/OverworldScene.js')
PROC = os.path.join(ROOT, 'public/assets/packs/prison/processed')
REF = os.path.join(ROOT, 'public/assets/packs/prison/reference.webp')
TILE = 40


def js_object(src, name):
    """Slice out `const <name> = { ... }` and coerce it to JSON."""
    start = src.index(f'const {name} = {{') + len(f'const {name} = ')
    depth = 0
    for i in range(start, len(src)):
        if src[i] == '{':
            depth += 1
        elif src[i] == '}':
            depth -= 1
            if depth == 0:
                body = src[start:i + 1]
                break
    body = re.sub(r'//[^\n]*', '', body)          # strip comments
    body = re.sub(r"'([^']*)'", r'"\1"', body)    # single -> double quoted
    body = re.sub(r'(\b\w+):', r'"\1":', body)    # quote keys
    body = re.sub(r',(\s*[}\]])', r'\1', body)    # trailing commas
    return json.loads(body)


def load_files_map(src):
    start = src.index('const PRISON_FILES = {')
    end = src.index('}', start)
    return dict(re.findall(r'(\w+):\s*\'([\w./]+\.png)\'', src[start:end]))


def tex(files, tex_id, cache={}):
    if tex_id not in cache:
        cache[tex_id] = Image.open(os.path.join(PROC, files[tex_id])).convert('RGBA')
    return cache[tex_id]


def render(def_, tile_tex, files):
    cols, rows = def_['cols'], def_['rows']
    img = Image.new('RGBA', (cols * TILE, rows * TILE), (18, 16, 18, 255))

    # floors + walls, world-origin-aligned so a material stays continuous
    # across a run (same as the game's tileSprite + tilePositionX/Y)
    at = lambda c, r: (def_['mask'][r][c]
                       if 0 <= c < cols and 0 <= r < rows else '.')

    for r in range(rows):
        for c in range(cols):
            ch = def_['mask'][r][c]
            if ch == '.' or ch == 'B' or ch not in tile_tex:
                continue
            t = tex(files, tile_tex[ch])
            cell = Image.new('RGBA', (TILE, TILE))
            ox, oy = (c * TILE) % t.width, (r * TILE) % t.height
            for dx in range(-ox, TILE, t.width):
                for dy in range(-oy, TILE, t.height):
                    cell.paste(t, (dx, dy))
            img.paste(cell, (c * TILE, r * TILE))

    # wall edges: bright cap on any wall tile with a non-wall above, pale
    # footing on any with a non-wall below (mirrors the two passes in
    # buildPrisonZone). A wall is a 3D block, not a flat pattern.
    WALLCH = set('#PD')

    def band_for(c, r, edge):
        """Exterior edges (facing the void) carry the brown parapet; interior
        ones get coping, or the baseboard where they meet floor."""
        if at(c, r) not in WALLCH:
            return None
        if at(c, r - 1 if edge == 'top' else r + 1) in WALLCH:
            return None
        if edge == 'top':
            return 'wallCapExt' if at(c, r - 1) == '.' else 'wallCap'
        if at(c, r + 1) == '.':
            return 'wallCapExtS'
        # cells take a shadow-toned baseboard; the default is cropped warm
        return 'wallBaseCell' if at(c, r + 1) in 'sd' else 'wallBase'

    for edge in ('top', 'bottom'):
        for r in range(rows):
            c = 0
            while c < cols:
                tid = band_for(c, r, edge)
                if not tid:
                    c += 1
                    continue
                end = c
                while end + 1 < cols and band_for(end + 1, r, edge) == tid:
                    end += 1
                band = tex(files, tid)
                w = (end - c + 1) * TILE
                strip = Image.new('RGBA', (w, band.height))
                for dx in range(-((c * TILE) % band.width), w, band.width):
                    strip.paste(band, (dx, 0))
                y = r * TILE if edge == 'top' else (r + 1) * TILE - band.height
                img.alpha_composite(strip, (c * TILE, y))
                c = end + 1

    # cell fronts: straw laid as real floor, then the bars over it as a keyed
    # grid (mirrors paintPrisonBars). One baked bars+hay texture repeats
    # whatever stands behind the bars every tile or two.
    bars = tex(files, 'barsGrid')
    straw = tex(files, 'floorStraw')
    for r in range(rows):
        c = 0
        while c < cols:
            if not (at(c, r) == 'B' and at(c, r - 1) != 'B'):
                c += 1
                continue
            end = c
            while end + 1 < cols and at(end + 1, r) == 'B' and at(end + 1, r - 1) != 'B':
                end += 1
            band = 1
            while at(c, r + band) == 'B':
                band += 1
            w, h = (end - c + 1) * TILE, band * TILE
            strip = Image.new('RGBA', (w, h))
            for dy in range(-((r * TILE) % straw.height), h, straw.height):
                for dx in range(-((c * TILE) % straw.width), w, straw.width):
                    strip.paste(straw, (dx, dy))
            for dx in range(-((c * TILE) % bars.width), w, bars.width):
                strip.alpha_composite(bars, (dx, 0))
            img.paste(strip, (c * TILE, r * TILE))
            c = end + 1

    # props, painted back-to-front so nearer pieces overlap farther ones
    for p in sorted(def_['props'], key=lambda p: p['row']):
        f = files.get(p['id'])
        if not f:
            print(f'  !! no texture for {p["id"]}')
            continue
        s = Image.open(os.path.join(PROC, f)).convert('RGBA')
        w = max(1, round(p['tileWidth'] * TILE))
        h = max(1, round(s.height * (w / s.width)))
        s = s.resize((w, h), Image.LANCZOS)
        img.alpha_composite(s, (round((p['col'] + 0.5) * TILE - w / 2),
                                round((p['row'] + 1) * TILE - h)))
    return img


def main():
    src = open(SCENE, encoding='utf-8').read()
    rooms = js_object(src, 'PRISON_ROOMS')
    tile_tex = js_object(src, 'PRISON_TILE_TEX')
    files = load_files_map(src)

    for name, def_ in rooms.items():
        mine = render(def_, tile_tex, files)
        out_path = os.path.join(ROOT, f'_compare_{name}.png')
        if name == 'jailCell':
            ref = Image.open(REF).convert('RGBA').crop((50, 40, 1487, 983))
            h = 700
            mine = mine.resize((round(mine.width * h / mine.height), h), Image.NEAREST)
            ref = ref.resize((round(ref.width * h / ref.height), h), Image.LANCZOS)
            out = Image.new('RGB', (mine.width + ref.width + 24, h), (15, 15, 18))
            out.paste(ref.convert('RGB'), (0, 0))
            out.paste(mine.convert('RGB'), (ref.width + 24, 0))
            out.save(out_path)
        else:
            mine.convert('RGB').resize((mine.width * 2, mine.height * 2), Image.NEAREST).save(out_path)
        print(f'{name}: {def_["cols"]}x{def_["rows"]} -> _compare_{name}.png')


if __name__ == '__main__':
    main()
