"""Crop the Colt 45 revolver animation strips out of the `guns` pack for
RussianRoulette.jsx.

Three clips are pulled, and the pairing is the whole point of the feature:

  load  ([RELOAD WITH BULLETS], 29f) - the dealer drops one round in the cylinder
  click ([SHOOT],               10f) - the full hammer cycle with NO muzzle flash
  fire  ([SHOOT WITH MUZZLE...],10f) - the SAME hammer cycle, flash on frame 5

Because `click` and `fire` are frame-identical up to the flash, the player
genuinely cannot tell which one is playing until frame 5 lands - which is
exactly the "pull it and find out" beat the game wants. That only holds if the
two strips stay pixel-aligned, so every frame of every clip is cropped to ONE
shared union bounding box (computed across all three sheets) rather than each
sheet being trimmed to its own content. Trimming per-sheet would shift the gun
between clips and leak the outcome before the hammer even falls.

The union box is deliberately generous: it has to contain the muzzle flash
(which juts right, past the barrel) and the loading round (which sits above the
frame), so the gun itself does not fill it. That is intended - it is the price
of a stable anchor point.

Windows note: the pack ships the revolver folder nested inside the MP5A3
folder - a packaging slip in the upstream pack, not something we introduced -
which pushes the full path past the 260-char MAX_PATH limit. Every open goes
through longpath() to get the \\\\?\\ extended-length prefix.

The source pack (public/assets/packs/guns/) is gitignored, same as every other
raw art drop - only the three cropped strips this writes are committed. A fresh
clone therefore cannot re-run this without the pack being dropped back in
place; that is the existing convention here, not an oversight.

Run from the repo root:  python production/process_revolver.py
"""
import os

from PIL import Image

FRAME_W, FRAME_H = 64, 32

SRC_ROOT = os.path.join(
    "public", "assets", "packs", "guns", "02 - Sprite sheets",
    "Submachine - MP5A3 [80x48]", "Revolver - Colt 45 [64x32]",
)
OUT_DIR = os.path.join("public", "assets", "packs", "russian-roulette")

# name -> (source filename, expected frame count). The counts are asserted, not
# inferred, so a pack update that re-times an animation fails loudly here
# instead of silently desyncing REVEAL_FRAME in the JSX.
CLIPS = {
    "load": ("[RELOAD WITH BULLETS] Revolver - Colt 45.png", 29),
    "click": ("[SHOOT] Revolver - Colt 45.png", 10),
    "fire": ("[SHOOT WITH MUZZLE FLASH] Revolver - Colt 45.png", 10),
}

# The frame the flash appears on in `fire`. Asserted below by checking that
# `fire` and `click` are identical before it and differ on it - if the pack
# ever re-times the animation, that assert fires and this constant (and its
# twin in RussianRoulette.jsx) needs updating together.
REVEAL_FRAME = 5


def longpath(path):
    """Absolute path with the Windows extended-length prefix (see module docstring)."""
    return "\\\\?\\" + os.path.abspath(path)


def load_frames(filename, expected):
    sheet = Image.open(longpath(os.path.join(SRC_ROOT, filename))).convert("RGBA")
    assert sheet.height == FRAME_H, f"{filename}: height {sheet.height} != {FRAME_H}"
    assert sheet.width % FRAME_W == 0, f"{filename}: width {sheet.width} not a multiple of {FRAME_W}"
    count = sheet.width // FRAME_W
    assert count == expected, f"{filename}: {count} frames, expected {expected}"
    return [
        sheet.crop((i * FRAME_W, 0, (i + 1) * FRAME_W, FRAME_H))
        for i in range(count)
    ]


def union_bbox(frame_lists):
    """Smallest box containing the opaque pixels of every frame of every clip."""
    box = None
    for frames in frame_lists:
        for frame in frames:
            bbox = frame.getbbox()  # alpha-aware: ignores fully transparent edges
            if bbox is None:
                continue
            box = bbox if box is None else (
                min(box[0], bbox[0]), min(box[1], bbox[1]),
                max(box[2], bbox[2]), max(box[3], bbox[3]),
            )
    assert box is not None, "every frame was fully transparent"
    return box


def main():
    clips = {name: load_frames(fn, n) for name, (fn, n) in CLIPS.items()}

    # The click/fire contract this whole feature rests on: same animation up to
    # the flash. Verified against the actual pixels rather than trusted.
    click, fire = clips["click"], clips["fire"]
    for i in range(REVEAL_FRAME):
        assert click[i].tobytes() == fire[i].tobytes(), (
            f"click and fire diverge at frame {i}, before the reveal frame "
            f"{REVEAL_FRAME} - the player could tell them apart early"
        )
    assert click[REVEAL_FRAME].tobytes() != fire[REVEAL_FRAME].tobytes(), (
        f"click and fire are identical ON the reveal frame {REVEAL_FRAME} - "
        "there is no visible flash to read the outcome from"
    )

    box = union_bbox(clips.values())
    w, h = box[2] - box[0], box[3] - box[1]

    os.makedirs(OUT_DIR, exist_ok=True)
    for name, frames in clips.items():
        strip = Image.new("RGBA", (w * len(frames), h), (0, 0, 0, 0))
        for i, frame in enumerate(frames):
            strip.paste(frame.crop(box), (i * w, 0))
        dest = os.path.join(OUT_DIR, f"revolver_{name}.png")
        strip.save(longpath(dest))
        print(f"  revolver_{name}.png  {len(frames):>2} frames  {strip.width}x{strip.height}")

    print(f"\nunion bbox {box} -> frame {w}x{h}")
    print("JSX constants:")
    print(f"  const FRAME_W = {w}")
    print(f"  const FRAME_H = {h}")
    print(f"  const REVEAL_FRAME = {REVEAL_FRAME}")
    for name, frames in clips.items():
        print(f"  {name}: {len(frames)} frames")


if __name__ == "__main__":
    main()
