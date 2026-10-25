"""Cuts a Gemini icon sheet (a grid of icons on white) into transparent PNGs.

    python scripts/cut_icons.py art/ui_icons_src.jpg
    python scripts/cut_icons.py art/scene_icons2_src.jpg 3 2 scene-rain,scene-snow,scene-camp,scene-whale,scene-overlook,scene-lighthouse
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
NAMES = ['sound', 'breath', 'scene', 'sleep', 'stats',
         'scene-tree', 'scene-sea', 'scene-lotus', 'scene-candle', 'scene-aurora']
OUT = 160  # px, shown at ~24-30 css px so this covers 3x screens


def bands(profile, n):
    """Split a 1-D occupancy profile into n runs separated by the widest empty gaps."""
    occ = profile > 0
    runs, start = [], None
    for i, v in enumerate(occ):
        if v and start is None:
            start = i
        if not v and start is not None:
            runs.append([start, i]); start = None
    if start is not None:
        runs.append([start, len(occ)])
    # merge the runs separated by the smallest gaps until n remain
    while len(runs) > n:
        gaps = [runs[i + 1][0] - runs[i][1] for i in range(len(runs) - 1)]
        i = int(np.argmin(gaps))
        runs[i] = [runs[i][0], runs[i + 1][1]]
        del runs[i + 1]
    return runs


def main(src, ncols=5, nrows=2, names=NAMES):
    im = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
    d = 255 - im.min(axis=2)                  # distance from white
    mask = ndimage.binary_opening(d > 18, iterations=2)
    rows = bands(mask.sum(axis=1), nrows)
    out_dir = os.path.join(ROOT, 'icons', 'ui')
    os.makedirs(out_dir, exist_ok=True)
    k = 0
    for r0, r1 in rows:
        cols = bands(mask[r0:r1].sum(axis=0), ncols)
        for c0, c1 in cols:
            sub = mask[r0:r1, c0:c1]
            ys, xs = np.nonzero(sub)
            y0, y1, x0, x1 = r0 + ys.min(), r0 + ys.max() + 1, c0 + xs.min(), c0 + xs.max() + 1
            crop = im[y0:y1, x0:x1]
            dist = 255 - crop.min(axis=2)
            a = np.clip((dist - 6) / 34, 0, 1)
            # only white connected to the outside is background; white inside the icon stays opaque
            pad = np.pad(dist < 40, 1, constant_values=True)
            lab, _ = ndimage.label(pad)
            outside = (lab == lab[0, 0])[1:-1, 1:-1]
            a = np.where(outside, a, 1.0)
            a = np.maximum(a, ndimage.gaussian_filter(np.where(outside, 0.0, 1.0), 0.7) * (dist >= 6))
            # un-blend the white background from the soft edge pixels
            safe = np.maximum(a, 1e-3)[..., None]
            rgb = np.clip((crop - 255 * (1 - safe)) / safe, 0, 255)
            rgba = np.dstack([rgb, a * 255]).astype(np.uint8)
            h, w = rgba.shape[:2]
            side = int(max(h, w) * 1.08)
            canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
            canvas.paste(Image.fromarray(rgba, 'RGBA'), ((side - w) // 2, (side - h) // 2))
            canvas.resize((OUT, OUT), Image.LANCZOS).save(os.path.join(out_dir, names[k] + '.png'), optimize=True)
            print(names[k], (x0, y0, x1, y1))
            k += 1


if __name__ == '__main__':
    if len(sys.argv) > 2:
        main(sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4].split(','))
    else:
        main(sys.argv[1])
