import os
import sys
from PIL import Image
import numpy as np
from collections import deque

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def list_dir(rel):
    p = os.path.join(ROOT, rel)
    return [os.path.join(p, f) for f in sorted(os.listdir(p)) if f.lower().endswith('.png')]

WHITE_THRESH = 235  # a pixel counts as "background-ish" if all channels >= this

def border_flood_remove_bg(img):
    """Flood-fill from the 4 border edges only, removing near-white background,
    leaving any enclosed white pockets (architecture, paper walls, etc) untouched -
    same conservative approach used for Ince's white-clothing portrait fix."""
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
    """Un-matte partial-alpha edge pixels against the known white background
    (prevents color-fringe halos), then erode the alpha edge by erode_px."""
    arr = np.array(img).astype(np.float64)
    h, w = arr.shape[:2]
    rgb = arr[:, :, :3]
    alpha = arr[:, :, 3]

    # Find edge pixels: kept (alpha=255) but adjacent to a removed pixel.
    removed = removed_mask
    kept = ~removed
    # dilate 'removed' by 1 to find border band on the kept side
    pad = np.pad(removed, 1, mode='constant', constant_values=False)
    neighbor_removed = (
        pad[0:h, 1:w+1] | pad[2:h+2, 1:w+1] | pad[1:h+1, 0:w] | pad[1:h+1, 2:w+2]
    )
    edge_band = kept & neighbor_removed

    bg = np.array(bg_rgb, dtype=np.float64)
    ys, xs = np.where(edge_band)
    for y, x in zip(ys, xs):
        px = rgb[y, x]
        # Estimate true alpha assuming px = a*fg + (1-a)*bg, fg unknown but
        # assume fg is saturated relative to bg along the most-different channel.
        diff = bg - px
        maxdiff = np.max(np.abs(diff))
        if maxdiff < 4:
            # essentially background color leaking through - drop it
            alpha[y, x] = 0
            continue
        # Un-mix: push color away from bg proportionally, keep alpha as is
        # unless pixel is very close to bg (partial edge), then reduce alpha.
        closeness = 1.0 - (maxdiff / 255.0)
        if closeness > 0.55:
            alpha[y, x] = alpha[y, x] * (1.0 - closeness)
        # Remove residual bg tint
        a = max(alpha[y, x] / 255.0, 0.15)
        fg = (px - (1 - a) * bg) / a
        rgb[y, x] = np.clip(fg, 0, 255)

    arr[:, :, :3] = rgb
    arr[:, :, 3] = alpha
    out = Image.fromarray(arr.astype(np.uint8), 'RGBA')

    # Erode alpha edge by erode_px (shrink opaque region by 1px to kill
    # remaining thin fringe) - plain numpy 4-neighbor erosion, no scipy dep.
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


def process(path, out_path, crop_box=None):
    img = Image.open(path).convert('RGBA')
    if crop_box:
        img = img.crop(crop_box)
    nobg, removed_mask = border_flood_remove_bg(img)
    clean = unmix_and_erode(nobg, removed_mask)
    final = crop_to_content(clean)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    final.save(out_path)
    print(f"{path} ({img.size}) -> {out_path} ({final.size})")
    return final.size


if __name__ == '__main__':
    lisa_files = list_dir('public/assets/packs/lisa house')
    ince_files = list_dir('public/assets/packs/ince house')

    manor_path = lisa_files[0]   # "(1).png" - the manor building
    garden_path = lisa_files[1]  # plain name - garden decor sheet
    ince_house_path = ince_files[0]

    process(manor_path, os.path.join(ROOT, 'public/assets/buildings/home_lisa.png'))
    process(ince_house_path, os.path.join(ROOT, 'public/assets/buildings/home_ince.png'))
    process(garden_path, os.path.join(ROOT, 'public/assets/packs/lisa house/processed/garden_sheet.png'))
