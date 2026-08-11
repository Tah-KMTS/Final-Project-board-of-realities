"""Build the prison interior's art from public/assets/packs/prison/.

Two different sources, for two different reasons:

1. TEXTURES (floors, wall faces, cell bars) are cropped out of the pack's own
   reference.webp. The pack ships its materials only as individually-framed
   1920x1080 hero renders - one blown-up object per file, no shared grid - so
   there is no tileable swatch to lift from them. The reference screenshot
   shows every material actually laid as floor/wall at a consistent scale, so
   a clean patch out of it is unambiguous. This is the same call made for the
   home interiors (see extract_reference_floors.py's header), and for the same
   reason: a swatch guessed off a contact sheet turned out to be a wall sample
   used as a floor, which tiled into obvious mortar bands.

2. PROPS (bunk bed, warden's desk, banner, ...) come straight from those hero
   renders, background-removed with the shared salvage pipeline. They're clean
   single subjects on white, which is exactly what that pipeline is for.

The reference's own grid was measured at 30x20 tiles over its content bbox
(x 50..1487, y 40..983) - confirmed by the guard sprites landing exactly one
tile wide and 1.5 tall, which matches the game's own character-to-TILE_SIZE
ratio. REF_X0/REF_Y0/REF_TW/REF_TH below are that mapping, so every region
here is expressed in reference TILE coordinates rather than raw pixels.

Run: python production/extract_prison_assets.py
Writes public/assets/packs/prison/processed/ plus _prison_textures.png, a
labelled montage of every extracted texture for eyeball verification.
"""
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from process_house_facades import ROOT, process  # noqa: E402

SRC = os.path.join(ROOT, 'public/assets/packs/prison')
OUT = os.path.join(SRC, 'processed')
REF = os.path.join(SRC, 'reference.webp')

TILE = 40  # the game's TILE_SIZE

# reference content bbox -> 30x20 tile grid
REF_X0, REF_Y0 = 50, 40
REF_TW, REF_TH = 1437 / 30, 943 / 20  # ~47.9 x ~47.15 px per tile


def px(col, row):
    return REF_X0 + col * REF_TW, REF_Y0 + row * REF_TH


# Tileable materials, taken from the pack's own hero renders rather than the
# reference screenshot.
#
# The first pass cropped these out of reference.webp and the verification
# montage immediately showed why that's wrong: every patch of laid floor in
# that picture has something standing on it. 'floor_straw' came back with a
# goblin in the corner, 'floor_carpet' caught the desk's edge, 'floor_hall'
# picked up two guard helmets. The hero renders are each a single material
# framed alone on white, so they're the same material with nothing on top.
#
# Each is cropped to content, reduced to its centre square (several renders
# are tall or wide framings of a square material), then resized to
# tiles*TILE. Only the barred cell front still comes from the reference -
# there is no standalone render of it, and the reference's own bars sit over
# clean straw with their rails intact.
#
# A render frames ONE object, so it carries that object's own outline: the
# straw mat has a white fringe, the rug has a dark selvedge down both sides,
# the flagstone render is a single bordered slab. Tiled as-is, that outline
# repeats into a grid of seams - the same failure the home floors hit. So each
# render-sourced material is inset past its own border before being squared,
# leaving only interior material.
#
# name -> (source render, tiles across, inset fraction)
MATERIALS_RENDER = {
    'floor_straw': ('128', 2, 0.12),    # loose straw - cell floors
    'floor_carpet': ('130', 2, 0.22),   # deep red rug - warden's office
    'floor_stone': ('121', 2, 0.15),    # pale stone - service corridor
}

# Materials where how it looks LAID matters more than the object render:
# the hall's flagstone is irregular and hand-placed in the reference (the
# single-slab render tiles into an obvious regular grid), and 103.png turned
# out to be a wall drawn in perspective - dark top, cobbled base - which
# cannot tile as a flat face at all. Patches below are hand-picked off
# prop-free areas of the reference. (col, row, tiles_w, tiles_h)
# Every one of these had to be re-picked once after seeing it tiled: the first
# floor_hall caught the shadow of a cell upright (which repeated into a row of
# dark posts) and the first wall_cell clipped the bunk bed's frame. Both are
# now taken from spans verified empty across their full 2x2.
MATERIALS_REF = {
    'floor_hall': (7.75, 17.0, 2, 2),    # open floor at the guards' feet, front of hall
    # Both re-cropped from patches scored for low per-COLUMN brightness
    # variance, not just low overall variance: the previous wall_cell had a
    # bright vertical stripe baked into it, which tiled into regular banding
    # and read as the wall being two different colours.
    'wall_cell': (5.8, 0.7, 2, 2),       # cell A back wall, clear of sconce and bunk
    'wall_outer': (27.0, 12.6, 2, 1),    # boundary wall, right of the door
    # The partitions BETWEEN cells are a distinctly lighter stone than either
    # the cell backs or the outer wall - measured [92,111,134] against
    # [~72,83,106] for both of those. Rendering them with the outer-wall
    # material made every divider disappear and the whole cell block read as
    # one undivided slab, which is the single biggest thing that stopped the
    # first passes looking like the reference.
    # 2 tiles tall, not 0.9: a partition is a lit pillar with dark edges and a
    # bright core, and a near-square crop of one caught too little of that
    # shading to survive tiling.
    'wall_divider': (11.9, 1.8, 0.9, 2),
    # The prison's front gate: a dark portcullis opening in the bottom wall,
    # spiked teeth along its head. The reference has no wall across this span
    # at all - it is how you are brought in.
    'wall_gate': (8.0, 19.0, 1, 1),
}

# The barred cell fronts, tiled on X across a cell opening. Kept from the
# reference (col, row, tiles_w, tiles_h) - it's the one thing with no
# standalone render, and the reference shows it complete with top rail,
# uprights and bottom rail.
# Cut to exactly the height of one cell front (4 tiles), because the renderer
# tiles it on X only and never on Y: bars are a vertical profile - top rail,
# uprights, bottom rail - and repeating that vertically produces a ladder of
# rails instead of a cell front. Matching the texture height to the band
# height means the phase can never drift.
BARS = {
    'bars_front': (13.1, 7.9, 2, 4),
}

# The cell front as a TRANSPARENT GRID - posts and rails only, hay keyed out.
#
# bars_front above bakes the hay and the wooden furniture standing behind the
# bars into the texture. Tiling that across a 5-tile cell front repeats them,
# which is why one cell showed four identical chairs instead of two and the
# hay came out in chunks instead of one continuous floor. Drawing the straw
# as real floor and laying an alpha grid over it fixes both at once.
#
# Cropped to exactly one post period (measured 82 ref-px by autocorrelation,
# confirmed against posts at x=1010 and x=1092) so it repeats seamlessly. The
# key keeps blue >= red, which holds for the navy posts and their pale
# highlights and rejects the tan hay, brown wood and grey floor behind them.
# (x0 in ref px, y0 in ref px, width in ref px, height in tiles)
BARS_GRID = {
    'bars_grid': (1010, 413, 82, 4),
}

# Wall EDGE bands, tiled on X only and drawn at a fixed pixel height.
#
# A wall in this reference is a 3D block, not a flat pattern: measured down
# the office wall block (cols 27-29), it goes bright cap [127,131,146] for
# ~10px, then dark brick face [~76,88,111] with a course line every ~31px,
# then a hard shadow line [32,35,51], then a pale footing rising to
# [114,100,103] before the floor takes over at [146,126,124].
#
# The first implementation tiled ONE square texture in both axes for every
# wall tile, which throws away the cap and the footing entirely - that is why
# the walls "looked nothing like the reference". These two bands are drawn
# once per wall RUN (top and bottom), with the face filling between them.
#
# name -> (start col, start y in reference px, tiles wide, height in ref px)
# Two different caps, because the reference uses two.
#
# An INTERIOR wall (between rooms) is capped with a bright coping strip plus
# the shadow seam beneath it - measured y554..574 below the warden's office.
# A wall whose top faces the OUTER VOID additionally carries a brown parapet
# above that coping - measured y40..82 along the top boundary. Capping
# everything with the interior band loses the building's outer silhouette;
# capping everything with the parapet puts a roof edge on internal partitions.
#
# The room's SOUTH boundary is the same exterior band mirrored (measured: its
# brown sits at the bottom against the void, coping at the top against the
# floor - an exact vertical flip), so it's generated rather than re-cropped.
#
# name -> (start col, start y in reference px, tiles wide, height in ref px)
WALL_BANDS = {
    # coping + seam. An earlier 10px crop took only the bright coping and
    # left the shadow out, so walls met the floor with no separation.
    'wall_cap': (27.0, 554, 2, 20),
    # parapet + coping + seam, for edges facing outside
    'wall_cap_ext': (5.0, 40, 5, 42),
    # seam + two-tone baseboard + contact shadow, where a wall meets floor
    'wall_base': (27.0, 781, 2, 44),
}

# name -> source band to mirror vertically
WALL_BANDS_FLIPPED = {
    'wall_cap_ext_s': 'wall_cap_ext',
}

# Materials derived from another material rather than cropped.
#
# The cells' bare floor is the same stone as the hall, just in shadow, and
# there is nowhere in the reference to crop it from: every cell has a bed or
# a stool standing on it, and the widest clear span is one tile. Cropping it
# anyway is exactly how a stool and a bed ended up baked into the floor
# texture and then tiled across both cells. Scaling the hall's own flagstone
# by the measured shadow ratio (cell floor averages [94,83,91] against the
# hall's [146,126,124]) gets the same material with nothing standing on it.
# name -> (source material, per-channel multiplier)
# Multiplier is the measured ratio between the reference's cell floor
# (median [72,75,92] over the empty strips in cells B and C) and its hall
# floor ([148,129,124]). It is NOT a uniform dim: the cells read markedly
# BLUER as well as darker, and an even multiplier left them a warm grey that
# was visibly wrong beside the reference.
MATERIALS_DERIVED = {
    'floor_cell': ('floor_hall', (0.49, 0.58, 0.74)),
    # The baseboard is cropped where a wall meets the HALL's warm flagstone,
    # so inside a cell it laid a light tan band across dark blue-grey floor.
    # Same shadow ratio as the cell floor keeps the moulding but in the cells'
    # own tone.
    'wall_base_cell': ('wall_base', (0.49, 0.58, 0.74)),
}

# Props that only exist inside the reference, never as a standalone render.
# The prison's own wooden door is set into the wall below the warden's office
# and is what the escape corridor is entered through, so it has to look like
# the reference's door rather than a generic one.
# Cropped to include the door's FRAME and the stone sill beneath it, not just
# the planks. The reference's door is recessed into the wall - dark frame
# around it, stone step at its foot - and a bare-planks crop pasted onto a
# flat wall reads as a rectangle stuck on the surface rather than an opening.
PROPS_REF = {
    'wood_door': (24.85, 12.8, 2.4, 3.3),
}

# Props cut from the reference that sit ON a wall, so the wall behind them has
# to be keyed out instead of cropped along with them.
#
# The cell wall fixtures are dark iron SCONCES - an unlit bracket - not the
# lit flaming torch the pack ships as 115.png. Using the torch put a burning
# flame in every cell, nothing like the reference's dim cell block. The
# bracket is far darker than the wall face behind it ([76,88,111], sum 275),
# so a luminance key separates the two cleanly.
# name -> (col, row, tiles_w, tiles_h, keep pixels with RGB sum below this)
PROPS_REF_KEYED = {
    'sconce': (14.55, 2.15, 0.75, 1.7, 210),
}

# hero render -> processed name. Straight background removal + crop.
PROPS = {
    '131': 'bunk_bed',
    '134': 'bed',
    '135': 'warden_desk',
    '136': 'banner',
    '132': 'bookshelf',
    '137': 'stool',
    '139': 'bench_long',
    '140': 'table_with_stools',
    '113': 'barrel',
    '111': 'pot',
    '110': 'crates',
    '112': 'chest',
    '108': 'ladder',
    '115': 'torch',
    '133': 'post',
    '138': 'sack',
    '109': 'brazier',
}


def crop_tiles(im, col, row, tw, th):
    x0, y0 = px(col, row)
    x1, y1 = px(col + tw, row + th)
    return im.crop((round(x0), round(y0), round(x1), round(y1)))


def clear_enclosed_white(path, thresh=246):
    """Erase pure-white pixels the border flood-fill could not reach.

    process()'s background removal floods inward from the edges, so white that
    is fully ENCLOSED by the subject survives it. On the bunk bed that left the
    gaps between the three tiers as solid white bands (7.6% of the sprite), and
    on the ladder the gaps between its rungs (15.1%) - both read in-game as the
    prop having holes punched through it.

    Keyed at 246+ on every channel, which takes the background white but keeps
    the beds' cream pillows and bedding (~200-230).
    """
    import numpy as np
    im = Image.open(path).convert('RGBA')
    a = np.array(im)
    white = (a[:, :, 0] >= thresh) & (a[:, :, 1] >= thresh) & (a[:, :, 2] >= thresh)
    hit = int((white & (a[:, :, 3] > 0)).sum())
    if hit:
        a[:, :, 3][white] = 0
        Image.fromarray(a, 'RGBA').save(path)
    return hit


def centre_square(im, inset=0.0):
    """Crop a hero render to its subject, inset past its own outline, then to
    the largest centred square (a material only tiles if it's square)."""
    import numpy as np
    a = np.asarray(im.convert('RGB')).astype(int)
    m = a.sum(axis=2) < 735
    xs, ys = np.where(m.any(axis=0))[0], np.where(m.any(axis=1))[0]
    im = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    if inset:
        dx, dy = round(im.width * inset), round(im.height * inset)
        im = im.crop((dx, dy, im.width - dx, im.height - dy))
    s = min(im.size)
    left, top = (im.width - s) // 2, (im.height - s) // 2
    return im.crop((left, top, left + s, top + s))


def main():
    os.makedirs(OUT, exist_ok=True)
    ref = Image.open(REF).convert('RGB')
    shots = []

    for name, (src, tiles, inset) in MATERIALS_RENDER.items():
        im = Image.open(os.path.join(SRC, f'{src}.png'))
        out = centre_square(im, inset).resize((tiles * TILE, tiles * TILE), Image.LANCZOS)
        out.convert('RGB').save(os.path.join(OUT, f'{name}.png'))
        shots.append((name, out, tiles, tiles))
        print(f'{name}: {src}.png inset {inset} -> {out.size}')

    for name, (col, row, tw, th) in {**MATERIALS_REF, **BARS, **PROPS_REF}.items():
        patch = crop_tiles(ref, col, row, tw, th)
        if name in PROPS_REF:
            # A prop keeps its true proportions - it is placed by tileWidth,
            # not snapped to the grid. Rounding one to whole tiles squashes it.
            ow, oh = round(tw * TILE), round(th * TILE)
        else:
            # A tiling material must land on the grid, so a region cropped
            # slightly under a whole tile to dodge a prop (wall_cell stops
            # short of the bunk bed) is snapped up to whole tiles.
            ow, oh = round(tw) * TILE, round(th) * TILE
        out = patch.resize((ow, oh), Image.LANCZOS)
        out.convert('RGB').save(os.path.join(OUT, f'{name}.png'))
        shots.append((name, out, round(tw), round(th)))
        print(f'{name}: ref tile ({col},{row}) {tw}x{th} -> {out.size}')

    for name, (px0, py0, wpx, tiles_h) in BARS_GRID.items():
        import numpy as np
        patch = ref.crop((px0, py0, px0 + wpx, py0 + round(tiles_h * REF_TH))).convert('RGB')
        arr = np.asarray(patch).astype(int)
        keep = arr[:, :, 2] >= arr[:, :, 0]      # navy/steel in, hay/wood/floor out
        rgba = np.dstack([np.asarray(patch), (keep * 255).astype('uint8')])
        out = Image.fromarray(rgba, 'RGBA').resize(
            (round(wpx * TILE / REF_TW), tiles_h * TILE), Image.NEAREST)
        out.save(os.path.join(OUT, f'{name}.png'))
        print(f'{name}: ref px ({px0},{py0}) {wpx}x{tiles_h}t keyed -> {out.size}')

    for name, (col, row, tw, th, thresh) in PROPS_REF_KEYED.items():
        import numpy as np
        patch = crop_tiles(ref, col, row, tw, th).convert('RGB')
        arr = np.asarray(patch).astype(int)
        alpha = ((arr.sum(axis=2) < thresh) * 255).astype('uint8')
        rgba = np.dstack([np.asarray(patch), alpha])
        out = Image.fromarray(rgba, 'RGBA').resize(
            (round(tw * TILE), round(th * TILE)), Image.LANCZOS)
        out.save(os.path.join(OUT, f'{name}.png'))
        print(f'{name}: ref tile ({col},{row}) keyed <{thresh} -> {out.size}')

    for name, (col, y, tiles, hpx) in WALL_BANDS.items():
        x0 = round(REF_X0 + col * REF_TW)
        x1 = round(REF_X0 + (col + tiles) * REF_TW)
        band = ref.crop((x0, y, x1, y + hpx))
        out_h = max(1, round(hpx * TILE / REF_TH))
        out = band.resize((tiles * TILE, out_h), Image.LANCZOS)
        out.save(os.path.join(OUT, f'{name}.png'))
        shots.append((name, out, tiles, 1))
        print(f'{name}: ref ({col},{y}) {hpx}px tall -> {out.size}')

    for name, src in WALL_BANDS_FLIPPED.items():
        base = Image.open(os.path.join(OUT, f'{src}.png'))
        out = base.transpose(Image.FLIP_TOP_BOTTOM)
        out.save(os.path.join(OUT, f'{name}.png'))
        shots.append((name, out, 2, 1))
        print(f'{name}: {src} flipped -> {out.size}')

    for name, (src, mult) in MATERIALS_DERIVED.items():
        base = Image.open(os.path.join(OUT, f'{src}.png')).convert('RGB')
        out = Image.merge('RGB', [
            ch.point(lambda v, m=m: min(255, round(v * m)))
            for ch, m in zip(base.split(), mult)
        ])
        out.save(os.path.join(OUT, f'{name}.png'))
        shots.append((name, out, 2, 2))
        print(f'{name}: {src} x{mult} -> {out.size}')

    # Verification montage. Each material is shown REPEATED 3x3, not as a
    # single swatch: a swatch always looks fine, and the only failure that
    # matters is what appears when it tiles - a border that turns into a grid
    # of seams, or a fringe that turns into a lattice. Judge these tiled.
    from PIL import ImageDraw
    Z, N = 3, 3
    pad, lab = 12, 18
    tiled = []
    for name, img, tw, th in shots:
        rgb = img.convert('RGB')
        rep = Image.new('RGB', (rgb.width * N, rgb.height * N))
        for ty in range(N):
            for tx in range(N):
                rep.paste(rgb, (tx * rgb.width, ty * rgb.height))
        tiled.append((name, rep.resize((rep.width * Z, rep.height * Z), Image.NEAREST), tw, th))
    cw = max(t[1].width for t in tiled) + pad * 2
    ch = max(t[1].height for t in tiled) + pad * 2 + lab
    cols = 4
    rows = (len(tiled) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * cw, rows * ch), (30, 30, 34))
    d = ImageDraw.Draw(sheet)
    for i, (name, img, tw, th) in enumerate(tiled):
        x, y = (i % cols) * cw, (i // cols) * ch
        d.text((x + pad, y + 4), f'{name} {tw}x{th}t (x{N})', fill=(255, 220, 90))
        sheet.paste(img, (x + pad, y + lab + pad // 2))
    sheet.save(os.path.join(ROOT, '_prison_textures.png'))
    print('montage -> _prison_textures.png')

    # Re-cutting all 19 hero renders costs well over a minute (border flood
    # fill on 1920x1080 each), and texture tuning is the part that actually
    # gets iterated. --textures-only skips them.
    if '--textures-only' in sys.argv:
        print('skipping props (--textures-only)')
        return

    for src, name in PROPS.items():
        if name is None:
            continue
        path = os.path.join(SRC, f'{src}.png')
        if not os.path.exists(path):
            print(f'  !! missing {src}.png')
            continue
        out_path = os.path.join(OUT, f'{name}.png')
        process(path, out_path)
        n = clear_enclosed_white(out_path)
        print(f'{name} <- {src}.png' + (f'  (+{n}px enclosed white cleared)' if n else ''))


if __name__ == '__main__':
    main()
