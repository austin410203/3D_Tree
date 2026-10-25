"""Draws the 四季之樹 icon (blossom tree on a pink field) and writes the PWA icons
plus the Android launcher icons and splash images.

    python scripts/make_icons.py            # from the repo root
"""
import math
import os
import random

from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
S = 1024
BG = (247, 220, 232)


def gradient(size):
    img = Image.new('RGBA', (size, size))
    d = ImageDraw.Draw(img)
    for y in range(size):
        t = y / size
        d.line([(0, y), (size, y)], fill=(int(250 - 10 * t), int(226 - 14 * t), int(238 - 6 * t), 255))
    return img


def tree(scale, background=True):
    """scale < 1 shrinks the tree toward the centre (maskable / adaptive safe zone)."""
    random.seed(4)
    img = gradient(S) if background else Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy = S / 2, S / 2 + 40 * scale

    def P(x, y):
        return (cx + (x - S / 2) * scale, cy + (y - S / 2) * scale)

    x0, y0 = P(250, 760); x1, y1 = P(774, 850)
    d.ellipse([x0, y0, x1, y1], fill=(120, 196, 140, 255))
    tc = (126, 144, 186, 255)
    w = 46 * scale
    d.line([P(512, 800), P(512, 560)], fill=tc, width=int(w))
    d.line([P(512, 600), P(430, 470)], fill=tc, width=int(w * 0.7))
    d.line([P(512, 590), P(600, 460)], fill=tc, width=int(w * 0.7))
    blobs = [(380, 420, 150), (520, 360, 170), (650, 430, 145), (450, 500, 120), (590, 510, 120)]
    cols = [(196, 79, 124, 255), (236, 141, 176, 255), (255, 212, 227, 255)]
    for _ in range(2600):
        bx, by, br = random.choice(blobs)
        a = random.random() * math.tau
        r = br * math.sqrt(random.random())
        x, y = bx + math.cos(a) * r, by + math.sin(a) * r
        lit = (x - 380) / 400 - (y - 360) / 500 + random.uniform(-0.35, 0.35)
        c = cols[0] if lit < 0.05 else cols[1] if lit < 0.55 else cols[2]
        rr = random.uniform(10, 17)
        X, Y = P(x, y)
        d.ellipse([X - rr * scale, Y - rr * scale, X + rr * scale, Y + rr * scale], fill=c)
    return img


def save(img, path, size):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.resize((size, size), Image.LANCZOS).save(path, optimize=True)


def round_mask(img):
    m = Image.new('L', img.size, 0)
    ImageDraw.Draw(m).ellipse([0, 0, img.size[0] - 1, img.size[1] - 1], fill=255)
    out = Image.new('RGBA', img.size, (0, 0, 0, 0))
    out.paste(img, (0, 0), m)
    return out


def main():
    full, safe = tree(1.0), tree(0.78)
    icons = os.path.join(ROOT, 'icons')
    save(full.convert('RGB'), os.path.join(icons, 'icon-192.png'), 192)
    save(full.convert('RGB'), os.path.join(icons, 'icon-512.png'), 512)
    save(full.convert('RGB'), os.path.join(icons, 'apple-touch-icon.png'), 180)
    save(safe.convert('RGB'), os.path.join(icons, 'icon-maskable-512.png'), 512)

    res = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')
    if not os.path.isdir(res):
        return
    legacy = tree(0.9)
    fg = tree(0.6, background=False)  # adaptive foreground: art inside the 66/108 safe zone
    for dpi, n in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
        d = os.path.join(res, f'mipmap-{dpi}')
        save(legacy, os.path.join(d, 'ic_launcher.png'), n)
        save(round_mask(legacy), os.path.join(d, 'ic_launcher_round.png'), n)
        save(fg, os.path.join(d, 'ic_launcher_foreground.png'), n * 108 // 48)

    # splash: plain field with a small tree in the middle, same sizes as the template
    small = tree(1.0, background=False)
    for folder in os.listdir(res):
        p = os.path.join(res, folder, 'splash.png')
        if not os.path.exists(p):
            continue
        w, h = Image.open(p).size
        img = Image.new('RGB', (w, h), BG)
        k = int(min(w, h) * 0.42)
        t = small.resize((k, k), Image.LANCZOS)
        img.paste(t, ((w - k) // 2, (h - k) // 2), t)
        img.save(p, optimize=True)

    bgxml = os.path.join(res, 'values', 'ic_launcher_background.xml')
    with open(bgxml, 'w', encoding='utf-8') as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
                '    <color name="ic_launcher_background">#F7DCE8</color>\n</resources>\n')
    print('icons + android res written')


if __name__ == '__main__':
    main()
