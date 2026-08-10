"""Render each home-interior style exactly the way buildHomeInteriorZone
does, side by side with the reference screenshot it's measured from.

The room definitions are parsed out of OverworldScene.js itself rather than
duplicated here, so this can't quietly drift from what the game actually
draws - if the comparison looks right, the game looks right.

Run: python production/compare_home_rooms.py   (writes _compare_<style>.png)
"""
import json
import os
import re

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCENE = os.path.join(ROOT, 'src/game/scenes/OverworldScene.js')
PROC = os.path.join(ROOT, 'public/assets/packs/Pixel_16_interiors_v2_free/processed')
REF = os.path.join(ROOT, 'public/assets/packs/Pixel_16_interiors_v2_free/reference')
TILE = 40

REF_FILE = {
    'cottage': 'image-1786287245591.png',
    'tavern': 'image-1786287249513.webp',
    'palace': 'image-1786287253857.webp',
    'hideout': 'image-1786287257746.webp',
}


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
    body = re.sub(r'//[^\n]*', '', body)               # strip comments
    body = re.sub(r'\bnull\b', 'null', body)
    body = re.sub(r'(\w+):', r'"\1":', body)           # quote keys
    body = body.replace("'", '"')
    body = re.sub(r'0x([0-9a-fA-F]+)', lambda m: str(int(m.group(1), 16)), body)
    body = re.sub(r',(\s*[}\]])', r'\1', body)         # trailing commas
    return json.loads(body)


def load_files_map(src):
    start = src.index('const HOME_FURNITURE_FILES = {')
    end = src.index('}', src.index('readingDeskB', start))
    body = src[start:end]
    return dict(re.findall(r'(\w+):\s*\'([\w./]+\.png)\'', body))


def mask_at(d, c, r):
    if c < 0 or r < 0 or c >= d['cols'] or r >= d['rows']:
        return False
    if not d.get('mask'):
        return True
    return d['mask'][r][c] == '#'


def is_wall(d, c, r):
    if not mask_at(d, c, r):
        return False
    if r < d.get('wallBandRows', 1):
        return True
    return not all([mask_at(d, c - 1, r), mask_at(d, c + 1, r),
                    mask_at(d, c, r - 1), mask_at(d, c, r + 1)])


def render(style, d, files):
    W, H = d['cols'] * TILE, d['rows'] * TILE
    img = Image.new('RGBA', (W, H), (24, 24, 28, 255))

    def tex(key):
        f = files.get(key) if key else None
        return Image.open(os.path.join(PROC, f)).convert('RGBA') if f else None

    floor = tex(d['floorTex'])
    strip = tex(d.get('wallStrip'))
    edge = tex(d.get('wallEdge'))
    wall = tuple(int(d['wallColor']).to_bytes(3, 'big')) + (255,)
    band = d.get('wallBandRows', 1)

    def world_tiled(t, box):
        """Same continuous, world-origin-aligned tiling the game gets from
        tileSprite + tilePositionX/Y."""
        tw, th = t.size
        cell = Image.new('RGBA', (TILE, TILE))
        for ox in range(-(box[0] % tw), TILE, tw):
            for oy in range(-(box[1] % th), TILE, th):
                cell.paste(t, (ox, oy))
        return cell

    for r in range(d['rows']):
        for c in range(d['cols']):
            if not mask_at(d, c, r):
                continue
            box = (c * TILE, r * TILE)
            if is_wall(d, c, r):
                img.paste(Image.new('RGBA', (TILE, TILE), wall), box)
                if edge and r >= band:
                    img.paste(edge.resize((TILE, TILE), Image.NEAREST), box)
            elif floor:
                img.paste(world_tiled(floor, box), box)

    # Back-wall profile strip: full band height, repeating on X only, over
    # every column whose whole band is inside the mask (mirrors the game).
    if strip:
        for c in range(d['cols']):
            if not all(mask_at(d, c, r) for r in range(band)):
                continue
            x = c * TILE
            for ox in range(-(x % strip.width), TILE, strip.width):
                img.alpha_composite(strip, (x + ox, 0)) if 0 <= x + ox else None

    # exit door, on the wall tile below the bottom-centre floor tile
    dcol = drow = None
    mid = d['cols'] // 2
    for r in range(d['rows'] - 1, -1, -1):
        for dd in range(d['cols'] + 1):
            for c in (mid - dd, mid + dd):
                if 0 <= c < d['cols'] and mask_at(d, c, r) and not is_wall(d, c, r):
                    dcol, drow = c, r
                    break
            if dcol is not None:
                break
        if dcol is not None:
            break
    if dcol is not None and files.get('woodDoor'):
        dr = Image.open(os.path.join(PROC, files['woodDoor'])).convert('RGBA')
        dw = round(TILE * 1.1)
        dh = round(dr.height * (dw / dr.width))
        dr = dr.resize((dw, dh), Image.NEAREST)
        img.alpha_composite(dr, (round((dcol + 0.5) * TILE - dw / 2), (drow + 2) * TILE - dh))

    for p in d['props']:
        f = files.get(p['id'])
        if not f:
            print(f'  !! {style}: no texture for {p["id"]}')
            continue
        sprite = Image.open(os.path.join(PROC, f)).convert('RGBA')
        sw = max(1, round(p['tileWidth'] * TILE))
        sh = max(1, round(sprite.height * (sw / sprite.width)))
        sprite = sprite.resize((sw, sh), Image.NEAREST)
        x = round((p['col'] + 0.5) * TILE - sw / 2)
        y = round((p['row'] + 1) * TILE - sh)
        img.alpha_composite(sprite, (max(0, x), max(0, y)) if x >= 0 and y >= 0 else (x, y))
    return img


def main():
    src = open(SCENE, encoding='utf-8').read()
    styles = js_object(src, 'HOME_ROOM_STYLES')
    files = load_files_map(src)
    for style, d in styles.items():
        mine = render(style, d, files)
        ref = Image.open(os.path.join(REF, REF_FILE[style])).convert('RGBA')
        h = 620
        mine = mine.resize((round(mine.width * h / mine.height), h), Image.NEAREST)
        ref = ref.resize((round(ref.width * h / ref.height), h), Image.LANCZOS)
        out = Image.new('RGB', (mine.width + ref.width + 24, h), (15, 15, 18))
        out.paste(ref.convert('RGB'), (0, 0))
        out.paste(mine.convert('RGB'), (ref.width + 24, 0))
        out.save(os.path.join(ROOT, f'_compare_{style}.png'))
        print(f'{style}: room {d["cols"]}x{d["rows"]} -> _compare_{style}.png')


if __name__ == '__main__':
    main()
