"""Derive a tile-level floor plan + furniture placement from each reference.

The home interiors kept reading as "a mess" because they were hand-eyeballed
into one plain 12x9 rectangle while the references are irregular, multi-alcove
floor plans at a totally different aspect ratio. This measures each reference
instead of guessing:

  1. Segment the room out of the flat dark backdrop (non-background mask),
     fill it, and downsample to a tile grid -> the room's real SHAPE.
  2. Report the same grid as ASCII so the layout can be read at a glance and
     pasted into OverworldScene.js as a row-string mask.

Scale is chosen per reference so the room lands near the target tile count -
the references are rendered at different pixel scales, so a single global
px-per-tile would give one room 9 tiles and another 30.

Run: python production/analyze_reference_rooms.py
"""
import os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(ROOT, 'public/assets/packs/Pixel_16_interiors_v2_free/reference')

# (style, reference file, target grid cols) - rows follow from the room's own
# aspect so tiles stay square.
ROOMS = [
    ('hideout', 'image-1786287257746.webp', 16),
    ('palace', 'image-1786287253857.webp', 18),
    ('tavern', 'image-1786287249513.webp', 18),
    ('cottage', 'image-1786287245591.png', 13),
]


def room_mask(img):
    """True where the image is room (not the flat dark backdrop)."""
    a = np.asarray(img.convert('RGB')).astype(int)
    bg = a[2, 2]  # corner is always backdrop in these renders
    return np.abs(a - bg).sum(axis=2) > 45


def fill_rows_cols(mask):
    """Fill interior holes (furniture/shadow) by spanning each row and column
    between its first and last room pixel, then AND the two - keeps concave
    notches at the room's corners while filling furniture holes inside it."""
    h, w = mask.shape
    rowfill = np.zeros_like(mask)
    for y in range(h):
        xs = np.where(mask[y])[0]
        if len(xs):
            rowfill[y, xs.min():xs.max() + 1] = True
    colfill = np.zeros_like(mask)
    for x in range(w):
        ys = np.where(mask[:, x])[0]
        if len(ys):
            colfill[ys.min():ys.max() + 1, x] = True
    return rowfill & colfill


def to_grid(mask, cols):
    ys, xs = np.where(mask)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    w, h = x1 - x0 + 1, y1 - y0 + 1
    tile = w / cols
    rows = max(1, round(h / tile))
    grid = []
    for r in range(rows):
        line = ''
        for c in range(cols):
            cx0 = int(x0 + c * tile)
            cx1 = int(x0 + (c + 1) * tile)
            cy0 = int(y0 + r * (h / rows))
            cy1 = int(y0 + (r + 1) * (h / rows))
            cell = mask[cy0:cy1, cx0:cx1]
            line += '#' if cell.mean() > 0.55 else '.'
        grid.append(line)
    return grid, tile, (x0, y0, x1, y1)


if __name__ == '__main__':
    for style, fname, cols in ROOMS:
        img = Image.open(os.path.join(REF, fname))
        m = fill_rows_cols(room_mask(img))
        grid, tile, box = to_grid(m, cols)
        print(f'=== {style} ({fname})  px/tile={tile:.1f}  box={box}')
        print(f'    grid {cols} x {len(grid)}')
        for line in grid:
            print('    ' + line)
        print()
