# Downscales the `racing` pack into the sprite set the Redline Rally arcade
# cabinet actually loads, under .../racing/processed/.
#
# Why this exists: the pack is vector-derived and enormous - cars are 565x1146,
# the decor building is 685x1000, the racing-light gantry is 1900px wide. A
# 480x360 arcade viewport needs none of that, and shipping it would mean the
# browser decoding ~40MB of PNG to draw sprites 60px tall.
#
# Three things here are less obvious than plain resizing:
#
# 1. SEAMLESS FILLS. The road/grass/soil/water fills are tiled with
#    createPattern, so they must stay seamless after downscaling. A naive
#    resize breaks that: the resampling kernel reads past the bitmap edge and
#    the wrap-around seam stops matching. tile_downscale() sidesteps it by
#    tiling the source 3x3, resizing that, and cutting the centre cell out -
#    every edge pixel then had real neighbours on both sides. assert_seamless()
#    re-checks the result rather than trusting the technique.
#
# 2. THE 5 CAR FRAMES ARE DAMAGE, NOT STEERING. "Main_Positions" reads like
#    steering angles, and they are not - measured, not assumed: across all
#    three cars the silhouette barely moves between frames (3-8%, and that
#    little is debris breaking the outline) while colour delta inside the body
#    ramps monotonically 2 -> 5 -> 10 -> 17. That is a pristine-to-wrecked
#    ramp, which is also why the pack ships an HP_Bar and an Armor_Bar. So the
#    engine picks the frame by remaining HP and gets heading from free canvas
#    rotation - better than 5 fixed angles would have been, since a top-down
#    car needs continuous 360-degree heading anyway.
#
#    They still share ONE union bounding box rather than being trimmed
#    individually, so taking damage repaints the car without shifting it -
#    the same alignment rule production/process_revolver.py documents for the
#    revolver's click/fire pair.
#
# 3. A FOURTH CAR. The race is the player plus 3 rivals, but the pack only
#    ships 3 car bodies. The 4th is Car_1 hue-rotated in HSV (value and
#    saturation untouched, so the shading, windows and tyres survive) rather
#    than a flat recolour, which would flatten it against the other three.
#
# Run from the repo root:  python production/process_racing.py
import colorsys
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACK = os.path.join(ROOT, "public/assets/packs/racing/PNG")
OUT_DIR = os.path.join(ROOT, "public/assets/packs/racing/processed")

FILL = 256      # seamless tiling fills (road surfaces, ground)
CAR_W = 64      # per-frame width of a car damage strip
CAR_FRAMES = 5  # damage states, pristine -> wrecked (see note 2)


def longpath(path):
    return "\\\\?\\" + os.path.abspath(path)


def load(*parts):
    return Image.open(longpath(os.path.join(PACK, *parts))).convert("RGBA")


def save(im, name):
    im.save(longpath(os.path.join(OUT_DIR, name)))
    print(f"  {name:<24} {im.width}x{im.height}")


def fit(im, w=None, h=None):
    """Resize preserving aspect, driven by whichever of w/h is given."""
    if w is None:
        w = max(1, round(im.width * h / im.height))
    if h is None:
        h = max(1, round(im.height * w / im.width))
    return im.resize((w, h), Image.LANCZOS)


def tile_downscale(im, size):
    """Downscale a seamless texture without breaking the seam (see note 1)."""
    w, h = im.size
    big = Image.new("RGBA", (w * 3, h * 3))
    for cx in range(3):
        for cy in range(3):
            big.paste(im, (cx * w, cy * h))
    big = big.resize((size * 3, size * 3), Image.LANCZOS)
    return big.crop((size, size, size * 2, size * 2))


def assert_seamless(im, name):
    """Wrap-around seam must be no worse than ordinary interior variation."""
    px, w, h = im.load(), im.width, im.height

    def cols(x):
        return [c for y in range(h) for c in px[x, y][:3]]

    def rows(y):
        return [c for x in range(w) for c in px[x, y][:3]]

    def diff(a, b):
        return sum(abs(p - q) for p, q in zip(a, b)) / max(1, len(a))

    seam_h, seam_v = diff(cols(w - 1), cols(0)), diff(rows(h - 1), rows(0))
    inner_h = max(diff(cols(x), cols(x + 1)) for x in range(0, w - 1, 29))
    inner_v = max(diff(rows(y), rows(y + 1)) for y in range(0, h - 1, 29))
    assert seam_h <= inner_h * 2.5, f"{name}: horizontal seam {seam_h:.2f} vs interior {inner_h:.2f}"
    assert seam_v <= inner_v * 2.5, f"{name}: vertical seam {seam_v:.2f} vs interior {inner_v:.2f}"


def union_bbox(frames):
    box = None
    for fr in frames:
        b = fr.getbbox()
        if b is None:
            continue
        box = b if box is None else (
            min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3])
        )
    assert box is not None, "all car frames were transparent"
    return box


def hue_rotate(im, turns):
    """Shift hue, keeping saturation/value so the shading and glass survive."""
    out = im.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            # Leave near-greys (body glass, tyres, chrome) alone - rotating
            # them just tints the whole car a flat colour.
            if s < 0.18:
                continue
            r, g, b = colorsys.hsv_to_rgb((h + turns) % 1.0, s, v)
            px[x, y] = (round(r * 255), round(g * 255), round(b * 255), a)
    return out


def car_strip(frames, name):
    """5 damage frames -> one horizontal strip on a shared bbox (note 2)."""
    assert len(frames) == CAR_FRAMES, f"{name}: {len(frames)} frames, expected {CAR_FRAMES}"
    box = union_bbox(frames)
    cropped = [f.crop(box) for f in frames]
    fh = max(1, round(cropped[0].height * CAR_W / cropped[0].width))
    scaled = [f.resize((CAR_W, fh), Image.LANCZOS) for f in cropped]
    strip = Image.new("RGBA", (CAR_W * CAR_FRAMES, fh), (0, 0, 0, 0))
    for i, f in enumerate(scaled):
        strip.paste(f, (i * CAR_W, 0))
    return strip, fh


def frame_strip(folder, prefix, count, width, name):
    """An effect animation folder -> one horizontal strip, shared bbox."""
    frames = [load(folder, f"{prefix}_{i:03d}.png") for i in range(count)]
    box = union_bbox(frames)
    cropped = [f.crop(box) for f in frames]
    fh = max(1, round(cropped[0].height * width / cropped[0].width))
    scaled = [f.resize((width, fh), Image.LANCZOS) for f in cropped]
    strip = Image.new("RGBA", (width * count, fh), (0, 0, 0, 0))
    for i, f in enumerate(scaled):
        strip.paste(f, (i * width, 0))
    print(f"  {name:<24} {strip.width}x{strip.height}  ({count} frames of {width}x{fh})")
    strip.save(longpath(os.path.join(OUT_DIR, name)))
    return count, width, fh


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    manifest = {}

    print("seamless fills:")
    for out_name, parts in (
        ("road_tarmac.png", ("Road_01", "Road_01_Tile_05", "Road_01_Tile_05.png")),
        ("road_dirt.png", ("Road_02", "Road_02_Tile_05", "Road_02_Tile_05.png")),
        ("ground_grass.png", ("Background_Tiles", "Grass_Tile.png")),
        ("ground_soil.png", ("Background_Tiles", "Soil_Tile.png")),
        ("ground_water.png", ("Background_Tiles", "Water_Tile.png")),
    ):
        im = tile_downscale(load(*parts), FILL)
        assert_seamless(im, out_name)
        save(im, out_name)

    print("kerbs:")
    for out_name, road in (("kerb_tarmac.png", "Road_01"), ("kerb_dirt.png", "Road_02")):
        # The barrier strip that edges a straight; 512 wide in the source, so
        # it repeats along the track edge at the same 256 pitch as the road.
        im = load(road, f"{road}_Tile_03", "Layers", "Road_Side_01.png")
        save(fit(im, w=FILL), out_name)

    print("cars:")
    car_sizes = {}
    for n in (1, 2, 3):
        frames = [load(f"Car_{n}_Main_Positions", f"Car_{n}_0{i}.png") for i in range(1, 6)]
        strip, fh = car_strip(frames, f"car_{n}")
        save(strip, f"car_{n}.png")
        car_sizes[f"car_{n}"] = fh
    # 4th body: Car_1 rotated red -> teal (see note 3).
    frames = [hue_rotate(load("Car_1_Main_Positions", f"Car_1_0{i}.png"), 0.47)
              for i in range(1, 6)]
    strip, fh = car_strip(frames, "car_4")
    save(strip, "car_4.png")
    car_sizes["car_4"] = fh
    manifest["cars"] = car_sizes

    print("props and pickups:")
    for out_name, parts, w in (
        ("barrel.png", ("Game_Props_Items", "Barrel_01.png"), 46),
        ("oil.png", ("Game_Props_Items", "Oil.png"), 92),
        ("jump_pad.png", ("Game_Props_Items", "Jumping_Pad_02.png"), 74),
        ("pickup_hp.png", ("Game_Bonus_Items", "HP_Bonus.png"), 42),
    ):
        save(fit(load(*parts), w=w), out_name)
    # No nitro pickup art in the pack - the brightest Nitro_ON flame frame
    # reads unambiguously as "boost" and keeps the pickup on-palette rather
    # than inventing an icon that would not match anything else on the track.
    save(fit(load("Car_Effects", "Nitro_ON", "Nitro_ON_006.png"), h=42), "pickup_nitro.png")

    print("decor:")
    for out_name, parts, w in (
        ("tree.png", ("Decor", "Tree.png"), 96),
        ("bush.png", ("Decor", "Bush.png"), 78),
        ("rock.png", ("Decor", "Rock.png"), 82),
        ("building.png", ("Decor", "Decor_Building.png"), 108),
        ("pavilion.png", ("Decor", "Pavilion.png"), 150),
        ("start_banner.png", ("Decor", "Start.png"), 300),
        ("finish_banner.png", ("Decor", "Finish.png"), 300),
        ("racing_lights.png", ("Decor", "Racing_Lights.png"), 320),
    ):
        save(fit(load(*parts), w=w), out_name)

    print("effects:")
    manifest["nitro"] = frame_strip("Car_Effects/Nitro", "Nitro", 10, 22, "fx_nitro.png")
    manifest["smoke"] = frame_strip("Car_Effects/Smoke", "Smoke", 6, 54, "fx_smoke.png")
    save(fit(load("Car_Effects", "Tire_Tracks", "Tire_Track_01.png"), w=16), "fx_tire.png")

    # The Game Center cabinet's little screen (OverworldScene.js's
    # REDLINE_PREVIEW_KEY). Emitted here rather than pointed at the source
    # pack directly so that EVERY file loaded at runtime lives under
    # processed/ and the 670MB source pack can stay gitignored like the
    # others. Drawn at 20x16, so 128px is already generous.
    print("cabinet preview:")
    save(fit(load("..", "Racing_Kit_Icon", "Racing_Kit_512x512_01.png"), w=128),
         "cabinet_preview.png")

    print("result-screen ui:")
    for out_name, parts, w in (
        ("ui_window.png", ("You_Win", "Window.png"), 300),
        ("ui_table.png", ("You_Win", "Table.png"), 240),
        ("ui_star_gold.png", ("You_Win", "Star_Gold.png"), 46),
        ("ui_star_silver.png", ("You_Win", "Star_Silver.png"), 46),
        ("ui_star_bg.png", ("You_Win", "Star_BG.png"), 46),
        ("ui_header_win.png", ("You_Win", "Header.png"), 240),
        ("ui_header_lose.png", ("You_Lose", "Header.png"), 240),
    ):
        save(fit(load(*parts), w=w), out_name)

    print("\nJS constants:")
    for name, fh in manifest["cars"].items():
        print(f"  {name}: {CAR_FRAMES} frames of {CAR_W}x{fh}")
    for key in ("nitro", "smoke"):
        n, w, h = manifest[key]
        print(f"  fx_{key}: {n} frames of {w}x{h}")
    print(f"  FILL tiles: {FILL}x{FILL}")


if __name__ == "__main__":
    main()
