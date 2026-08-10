"""Crop the real floor textures straight out of the pack's own reference
screenshots (public/assets/packs/Pixel_16_interiors_v2_free/reference/), so
each home-interior style's floor is literally the floor from the picture it's
modeled on rather than an approximation.

Why crop the reference instead of using a pack tile: the pack ships its floor
materials only as small swatches embedded in multi-item contact sheets, and
the first attempt at slicing one (items.png's stone square) actually grabbed a
WALL sample - stone face plus a light baseboard strip - which then tiled
across the floor as obvious horizontal mortar bands (reported: "the flooring
is incorrect"). The reference screenshots show the same materials laid as real
floor, so a clean patch out of one is unambiguous.

Each REGIONS entry is a hand-picked rectangle of pure, prop-free floor. The
script then finds that patch's own repeating period by autocorrelation and
emits exactly one period as a seamlessly-tileable PNG.

Run: python production/extract_reference_floors.py
"""
import os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(ROOT, 'public/assets/packs/Pixel_16_interiors_v2_free/reference')
OUT = os.path.join(ROOT, 'public/assets/packs/Pixel_16_interiors_v2_free/processed')

# style -> (reference file, top-left of a clean prop-free floor patch, tile
# size). The tile sizes are this material's real repeat period in that
# screenshot, measured by shift-and-compare autocorrelation over a larger
# clean patch (wood 99x50 = two brick columns x two offset rows, slab 76x76,
# checker 59x59 = one full two-diamond cycle, cobble 72x72); cropping exactly
# one period is what makes the result tile seamlessly.

# Output name is the style's own floorTex (OverworldScene.js's
# HOME_ROOM_STYLES), so this overwrites in place.
# ref_px_per_tile is that reference's measured scale, printed by
# production/analyze_reference_rooms.py - dividing the period by it gives how
# many TILES one repeat covers in the source picture, which is what the final
# resize reproduces at the game's own TILE_SIZE. Without that step the floor
# tiles at the wrong density (the pattern reads too big or too small against
# the furniture even when the crop itself is correct).
GAME_TILE_SIZE = 40
REGIONS = {
    # bedroom reference - warm red-brown plank/brick floor
    'floor_cottage': ('image-1786287245591.png', (384, 575), (99, 50), 51.5),
    # stone cottage reference - pale tan stone slab floor
    'floor_tavern': ('image-1786287249513.webp', (1180, 700), (76, 76), 70.2),
    # palace reference - blue/white diamond checker.
    # +10,+10 off the obvious starting corner: the patch at (400,410) catches
    # a row of the diamonds' dark shadow edge, which tiles into visible black
    # specks; this origin lands on clean diamond centres instead.
    'floor_palace': ('image-1786287253857.webp', (410, 420), (59, 59), 80.0),
    # wizard study reference - blue-grey scalloped cobble
    'floor_hideout': ('image-1786287257746.webp', (490, 800), (72, 72), 69.5),
}

# Vertical wall PROFILE slices, tiled horizontally only.
# A wall in these references is never a flat band: it's a cap/cornice strip,
# then the wall face, then a trim or skirting where it meets the floor.
# Tiling a small square texture in both axes throws all of that away and is
# what still read as "the walls aren't quite right" - so each entry crops one
# clean full-height column of that wall (top of the room down to the floor
# line) and the renderer stretches it across the band, repeating on X only.
# band_rows is how many game tiles tall that wall is, so the output is exactly
# band_rows*TILE high and never needs vertical scaling at draw time.
WALL_STRIPS = {
    # cream vertically-striped wallpaper under a dark wood frame
    'wallstrip_cottage': ('image-1786287245591.png', (390, 87), (35, 373), 51.5, 7),
    # cream cap + brown trim over blue-grey stone
    'wallstrip_tavern': ('image-1786287249513.webp', (500, 90), (40, 192), 70.2, 3),
    # cream cornice over terracotta panel
    'wallstrip_palace': ('image-1786287253857.webp', (1150, 112), (40, 140), 80.0, 2),
    # thin dark navy band with its ice-blue trim line
    'wallstrip_hideout': ('image-1786287257746.webp', (1060, 46), (40, 70), 69.5, 1),
}


# The side and bottom walls. The top band gets a full vertical profile
# (WALL_STRIPS above), but the left/right/bottom edges are only one tile
# thick, so they just need the wall MATERIAL rather than a profile - without
# them those edges rendered as a flat colour block and read as "the wall is
# missing". Each crop is a clean piece of that reference's own outer wall,
# squashed to exactly one tile.
WALL_EDGES = {
    'walledge_cottage': ('image-1786287245591.png', (65, 300), (35, 50)),
    'walledge_tavern': ('image-1786287249513.webp', (145, 500), (40, 50)),
    'walledge_palace': ('image-1786287253857.webp', (50, 300), (40, 50)),
    'walledge_hideout': ('image-1786287257746.webp', (205, 500), (45, 50)),
}


def extract_edge(name, ref_file, origin, size):
    im = Image.open(os.path.join(REF, ref_file)).convert('RGB')
    x, y = origin
    w, h = size
    edge = im.crop((x, y, x + w, y + h)).resize((GAME_TILE_SIZE, GAME_TILE_SIZE), Image.NEAREST)
    os.makedirs(OUT, exist_ok=True)
    edge.save(os.path.join(OUT, f'{name}.png'))
    print(f'{name}: {ref_file} @{origin} {w}x{h}px -> {GAME_TILE_SIZE}x{GAME_TILE_SIZE}')


def extract_strip(name, ref_file, origin, size, ref_px_per_tile, band_rows):
    im = Image.open(os.path.join(REF, ref_file)).convert('RGB')
    x, y = origin
    w, h = size
    strip = im.crop((x, y, x + w, y + h))
    out_w = max(1, round(w / ref_px_per_tile * GAME_TILE_SIZE))
    out_h = band_rows * GAME_TILE_SIZE
    strip = strip.resize((out_w, out_h), Image.NEAREST)
    os.makedirs(OUT, exist_ok=True)
    strip.save(os.path.join(OUT, f'{name}.png'))
    print(f'{name}: {ref_file} @{origin} {w}x{h}px -> {out_w}x{out_h} ({band_rows} rows)')


def extract(name, ref_file, origin, size, ref_px_per_tile):
    im = Image.open(os.path.join(REF, ref_file)).convert('RGB')
    x, y = origin
    w, h = size
    tile = im.crop((x, y, x + w, y + h))
    tiles_w = w / ref_px_per_tile
    tiles_h = h / ref_px_per_tile
    out_w = max(1, round(tiles_w * GAME_TILE_SIZE))
    out_h = max(1, round(tiles_h * GAME_TILE_SIZE))
    tile = tile.resize((out_w, out_h), Image.NEAREST)
    os.makedirs(OUT, exist_ok=True)
    tile.save(os.path.join(OUT, f'{name}.png'))
    print(f'{name}: {ref_file} @{origin} {w}x{h}px = {tiles_w:.2f}x{tiles_h:.2f} tiles -> {out_w}x{out_h}')


if __name__ == '__main__':
    for name, (ref_file, origin, size, scale) in REGIONS.items():
        extract(name, ref_file, origin, size, scale)
    for name, (ref_file, origin, size, scale, rows) in WALL_STRIPS.items():
        extract_strip(name, ref_file, origin, size, scale, rows)
    for name, (ref_file, origin, size) in WALL_EDGES.items():
        extract_edge(name, ref_file, origin, size)
