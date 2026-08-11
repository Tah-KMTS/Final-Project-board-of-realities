# Crops 3 new Ince VN portraits (amused/playful/laughing) out of
# public/assets/packs/Ince/pic 2.png, pic 3.png, pic 4.png - candid two-person
# photos where Ince is the black-haired, glasses-wearing figure; the other
# person in each frame is a friend, not part of the roster, and is discarded
# by the crop_box below before background removal ever runs.
#
# Same border-flood-fill + un-matte + erode + tight-crop pipeline as the
# original 4 portraits (see the "Ince's white-clothing portrait fix" this was
# built for, and production/process_house_facades.py which reuses it too) -
# copied here rather than imported so this stays a single rebuildable script,
# per this project's convention (see process_house_facades.py's own header).
#
# Run: python production/process_ince_new_portraits.py
import os
from PIL import Image
import numpy as np
from collections import deque

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# 235 (process_house_facades.py's value) let the border flood-fill leak
# through bright highlight streaks on ince_laughing's all-white shirt,
# following them like a river into the garment and leaving a traced-outline
# artifact behind. 248 is strict enough that it stops leaking into fabric
# while still catching this pack's actual (near-pure-white, ~250+) backdrop.
WHITE_THRESH = 248

def border_flood_remove_bg(img):
    arr = np.array(img.convert('RGBA')).astype(np.uint8)
    h, w = arr.shape[:2]
    rgb = arr[:, :, :3].astype(np.int16)
    is_bgish = np.all(rgb >= WHITE_THRESH, axis=2)

    visited = np.zeros((h, w), dtype=bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if is_bgish[y, x] and not visited[y, x]:
                visited[y, x] = True
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if is_bgish[y, x] and not visited[y, x]:
                visited[y, x] = True
                q.append((x, y))

    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not visited[ny, nx] and is_bgish[ny, nx]:
                visited[ny, nx] = True
                q.append((nx, ny))

    alpha = arr[:, :, 3].copy()
    alpha[visited] = 0
    arr[:, :, 3] = alpha
    return Image.fromarray(arr, 'RGBA'), visited


def unmix_and_erode(img, removed_mask, bg_rgb=(255, 255, 255), erode_px=1):
    arr = np.array(img).astype(np.float64)
    h, w = arr.shape[:2]
    rgb = arr[:, :, :3]
    alpha = arr[:, :, 3]

    removed = removed_mask
    kept = ~removed
    pad = np.pad(removed, 1, mode='constant', constant_values=False)
    neighbor_removed = (
        pad[0:h, 1:w+1] | pad[2:h+2, 1:w+1] | pad[1:h+1, 0:w] | pad[1:h+1, 2:w+2]
    )
    edge_band = kept & neighbor_removed

    bg = np.array(bg_rgb, dtype=np.float64)
    ys, xs = np.where(edge_band)
    for y, x in zip(ys, xs):
        px = rgb[y, x]
        diff = bg - px
        maxdiff = np.max(np.abs(diff))
        if maxdiff < 4:
            alpha[y, x] = 0
            continue
        closeness = 1.0 - (maxdiff / 255.0)
        if closeness > 0.55:
            alpha[y, x] = alpha[y, x] * (1.0 - closeness)
        a = max(alpha[y, x] / 255.0, 0.15)
        fg = (px - (1 - a) * bg) / a
        rgb[y, x] = np.clip(fg, 0, 255)

    arr[:, :, :3] = rgb
    arr[:, :, 3] = alpha
    out = Image.fromarray(arr.astype(np.uint8), 'RGBA')

    a = np.array(out)[:, :, 3]
    opaque = a > 10
    eroded = opaque
    for _ in range(erode_px):
        h2, w2 = eroded.shape
        pad = np.pad(eroded, 1, mode='constant', constant_values=False)
        eroded = (
            pad[1:h2+1, 1:w2+1] & pad[0:h2, 1:w2+1] & pad[2:h2+2, 1:w2+1]
            & pad[1:h2+1, 0:w2] & pad[1:h2+1, 2:w2+2]
        )
    a2 = np.array(out)
    a2[:, :, 3] = np.where(eroded, a2[:, :, 3], 0)
    return Image.fromarray(a2, 'RGBA')


def crop_to_content(img, pad=4):
    arr = np.array(img)
    alpha = arr[:, :, 3]
    ys, xs = np.where(alpha > 10)
    if len(ys) == 0:
        return img
    y0, y1 = max(0, ys.min() - pad), min(arr.shape[0], ys.max() + pad + 1)
    x0, x1 = max(0, xs.min() - pad), min(arr.shape[1], xs.max() + pad + 1)
    return img.crop((x0, y0, x1, y1))


def process(path, out_path, crop_box):
    img = Image.open(path).convert('RGBA').crop(crop_box)
    nobg, removed_mask = border_flood_remove_bg(img)
    clean = unmix_and_erode(nobg, removed_mask)
    final = crop_to_content(clean)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    final.save(out_path)
    print(f"{path} {crop_box} -> {out_path} ({final.size})")


if __name__ == '__main__':
    src = os.path.join(ROOT, 'public/assets/packs/Ince')
    dst = os.path.join(ROOT, 'public/assets/packs/Ince/portraits')

    # Crop boxes isolate Ince (glasses, black hair) and exclude the friend
    # standing beside her in each source photo - measured against a 100px
    # grid overlaid on each 1920x1080 original.
    process(os.path.join(src, 'pic 2.png'), os.path.join(dst, 'ince_amused.png'), (500, 0, 955, 1080))
    process(os.path.join(src, 'pic 3.png'), os.path.join(dst, 'ince_playful.png'), (1030, 0, 1680, 1080))
    # y capped well above the wooden bench/coffee cups at the bottom of the
    # frame (not white, so the border flood-fill can't drop them) and the
    # white shirt's lower folds (their near-background color destabilized
    # unmix_and_erode's edge-alpha estimate into a visible blue fringe) -
    # bust-level crop, matching every other portrait's framing anyway.
    process(os.path.join(src, 'pic 4.png'), os.path.join(dst, 'ince_laughing.png'), (970, 0, 1800, 650))
