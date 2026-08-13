# Cuts the run-and-gun arcade cabinet's terrain tiles and scenery props out of
# the two tilesheets in public/assets/packs/vacaroxa--generic-run-n-gun-pack--v.1.0/
# (Assets_area_1 = subway interior, Assets_area_2 = outdoor ruins) into
# individually addressable PNGs under .../runngun/processed/.
#
# Why this exists at all: the sprite sheets in that pack (player, the 3 enemies,
# the explosion) are already uniform grids, so RunAndGunScene.js loads those
# directly as Phaser spritesheets - no processing needed and none done here.
# The two TILESETS are the opposite: irregular atlases of 9-slice terrain
# blocks, furniture and signage at arbitrary offsets, with the block interiors
# left as flat black. Slicing them at load time would mean hard-coding a pile
# of pixel offsets into the scene; cutting them once here keeps the scene
# reading `runngun_crate` instead of `(6,11)-(8,13) of tiles_out.png`.
#
# Terrain approach (see RunAndGunScene.js's paintSolid): rather than reproduce
# the packs' full 9-slice corner/edge sets, every solid in this game is drawn
# as a repeated FILL tile with a single distinct CAP tile along its top row.
# That's the same fill+cap treatment production/extract_prison_assets.py's
# rooms use, it reads correctly at any platform width, and it sidesteps the
# corner-piece bookkeeping a true 9-slice would need for a game whose level
# geometry is all plain rectangles anyway.
#
# Run: python production/process_run_n_gun.py
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACK = os.path.join(ROOT, 'public/assets/packs/vacaroxa--generic-run-n-gun-pack--v.1.0')
OUT_DIR = os.path.join(ROOT, 'public/assets/packs/runngun/processed')

TILE = 16

SUBWAY_TILES = 'Assets_area_1/Tileset/Subway_tiles.png'
OUT_TILES = 'Assets_area_2/tileset/tiles_out.png'

# (name, source, col, row, cols_wide, rows_tall, trim)
#
# Coordinates are in 16px tile units, measured against a grid overlaid on each
# sheet. `trim` crops transparent margin off the result - on for props (their
# art rarely fills its cells exactly, and a sprite padded with dead space sits
# visibly off its own footprint in game) and off for terrain tiles, which MUST
# stay exactly 16x16 or they won't line up when repeated.
CUTS = [
    # --- terrain: subway (level 1) -------------------------------------
    # Dark brick from the tunnel's lower wall. Uniform across its whole
    # region, so it repeats without a visible seam.
    ('sub_fill', SUBWAY_TILES, 12, 21, 1, 1, False),
    # Metal walkway slab - the surface the player actually stands on.
    ('sub_cap', SUBWAY_TILES, 5, 14, 1, 1, False),

    # --- terrain: outdoor ruins (level 2) -------------------------------
    ('out_fill', OUT_TILES, 3, 16, 1, 1, False),
    # Yellow/black hazard stripe. Deliberately the brightest thing in the
    # outdoor palette: level 2's backdrop is a busy orange sky over olive
    # brick, and a low-contrast cap made platform edges genuinely hard to
    # judge mid-jump.
    ('out_cap', OUT_TILES, 6, 4, 1, 1, False),

    # --- scenery props: outdoor ------------------------------------------
    ('crate', OUT_TILES, 7, 11, 2, 2, True),
    ('cone', OUT_TILES, 9, 11, 1, 2, True),
    ('road_sign', OUT_TILES, 10, 11, 2, 3, True),
    ('street_lamp', OUT_TILES, 11, 3, 2, 5, True),
    ('bush', OUT_TILES, 4, 2, 4, 3, True),

    # --- scenery props: subway -------------------------------------------
    ('barrel', SUBWAY_TILES, 5, 10, 1, 1, True),
    ('pipe', SUBWAY_TILES, 5, 8, 2, 1, True),
    ('vending', SUBWAY_TILES, 5, 11, 2, 3, True),
    ('screen', SUBWAY_TILES, 7, 11, 5, 3, True),
    ('poster', SUBWAY_TILES, 12, 7, 2, 3, True),
    ('door', SUBWAY_TILES, 10, 7, 2, 3, True),
    ('station_sign', SUBWAY_TILES, 14, 1, 2, 2, True),
]

# Terrain tiles must stay exactly 16x16 or they won't line up when repeated.
# Only the FILL tiles additionally have to be fully opaque: paintSolid draws
# fill across the whole solid first and then overlays the cap on the top row,
# so a cap's transparent pixels composite over fill (which is what lets
# out_cap's hazard stripe keep its shaped underside) while a hole in a fill
# tile would show the parallax backdrop straight through the floor.
FILL_TILES = ('sub_fill', 'out_fill')
CAP_TILES = ('sub_cap', 'out_cap')


def cut(sheet, col, row, w, h, trim):
    box = (col * TILE, row * TILE, (col + w) * TILE, (row + h) * TILE)
    img = sheet.crop(box)
    if trim:
        bbox = img.getbbox()
        if bbox:
            img = img.crop(bbox)
    return img


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    sheets = {}
    for name, src, col, row, w, h, trim in CUTS:
        if src not in sheets:
            sheets[src] = Image.open(os.path.join(PACK, src)).convert('RGBA')
        img = cut(sheets[src], col, row, w, h, trim)
        out_path = os.path.join(OUT_DIR, f'{name}.png')
        img.save(out_path)
        print(f'{name:14s} <- {os.path.basename(src)} ({col},{row}) {w}x{h} tiles -> {img.size}')

    # A mis-measured tile coordinate is easy to make and, in the running game,
    # shows up only as a subtly wrong-looking floor - much cheaper to catch it
    # here as a hard failure.
    for name in FILL_TILES + CAP_TILES:
        img = Image.open(os.path.join(OUT_DIR, f'{name}.png'))
        assert img.size == (TILE, TILE), f'{name} is {img.size}, must be {TILE}x{TILE}'
    for name in FILL_TILES:
        img = Image.open(os.path.join(OUT_DIR, f'{name}.png'))
        lo = img.getchannel('A').getextrema()[0]
        assert lo == 255, f'{name} has transparent pixels (min alpha {lo}) - floors would show holes'
    print(f'\nWrote {len(CUTS)} files to {OUT_DIR}')


if __name__ == '__main__':
    main()
