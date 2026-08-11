import os
import sys
import numpy as np
from PIL import Image
from collections import deque

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from process_house_facades import border_flood_remove_bg, unmix_and_erode

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def connected_components(alpha, min_area=200):
    h, w = alpha.shape
    visited = np.zeros((h, w), dtype=bool)
    mask = alpha > 10
    boxes = []
    for y in range(h):
        for x in range(w):
            if mask[y, x] and not visited[y, x]:
                q = deque([(x, y)])
                visited[y, x] = True
                minx, maxx, miny, maxy = x, x, y, y
                area = 0
                while q:
                    cx, cy = q.popleft()
                    area += 1
                    minx, maxx = min(minx, cx), max(maxx, cx)
                    miny, maxy = min(miny, cy), max(maxy, cy)
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < w and 0 <= ny < h and mask[ny, nx] and not visited[ny, nx]:
                            visited[ny, nx] = True
                            q.append((nx, ny))
                if area >= min_area:
                    boxes.append((minx, miny, maxx, maxy, area))
    return boxes


def slice_sheet(path, out_dir, min_area=200, pad=3):
    img = Image.open(path).convert('RGBA')
    nobg, removed_mask = border_flood_remove_bg(img)
    clean = unmix_and_erode(nobg, removed_mask)
    arr = np.array(clean)
    alpha = arr[:, :, 3]
    boxes = connected_components(alpha, min_area=min_area)
    os.makedirs(out_dir, exist_ok=True)
    w, h = clean.size
    results = []
    for i, (x0, y0, x1, y1, area) in enumerate(sorted(boxes, key=lambda b: (b[1] // 50, b[0]))):
        cx0, cy0 = max(0, x0 - pad), max(0, y0 - pad)
        cx1, cy1 = min(w, x1 + pad + 1), min(h, y1 + pad + 1)
        crop = clean.crop((cx0, cy0, cx1, cy1))
        fname = f'{i:03d}_{cx1-cx0}x{cy1-cy0}.png'
        crop.save(os.path.join(out_dir, fname))
        results.append(fname)
    print(f'{path}: {len(results)} components -> {out_dir}')
    return results


if __name__ == '__main__':
    base = os.path.join(ROOT, 'public/assets/packs/Pixel_16_interiors_v2_free')
    slice_sheet(os.path.join(base, 'items.png'), os.path.join(base, '_sliced_items'))
    slice_sheet(os.path.join(base, 'walls and stair.png'), os.path.join(base, '_sliced_walls'))
