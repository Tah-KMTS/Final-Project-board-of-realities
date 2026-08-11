import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from process_house_facades import process, ROOT

SRC = os.path.join(ROOT, 'public/assets/packs/Pixel_16_interiors_v2_free')
OUT = os.path.join(ROOT, 'public/assets/packs/Pixel_16_interiors_v2_free/processed')

# Standalone single-subject renders only (no multi-item contact sheets - see
# production/backlog.md-style reasoning: 73.png/85.png/items.png/
# tiles_and_items.png/walls_and_stair.png hold several props each and would
# need connected-component slicing; the 4 home-interior styles below turned
# out fully buildable from just the already-single-subject files, so that
# slicing pass was skipped entirely).
FILES = [
    'bed.png',
    'shelf with book.png',
    'shelf with books.png',
    'table and chair.png',
    'big table and chair.png',
    'table with food.png',
    'table with books.png',
    'carpet.png',
    'orb.png',
    'circle.png',
    'book.png',
    'wall.png',
]

if __name__ == '__main__':
    for name in FILES:
        src = os.path.join(SRC, name)
        dest = os.path.join(OUT, name.replace(' ', '_'))
        process(src, dest)
