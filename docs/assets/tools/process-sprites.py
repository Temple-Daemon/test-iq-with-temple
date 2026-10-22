#!/usr/bin/env python3
"""Memory Rush sprite pipeline: chroma-key generated art into transparent PNGs.

Stages (learned the hard way, see git history):
1. key     — pure magenta pixels -> alpha 0
2. bleed   — opaque RGB spread into transparent pixels so the LANCZOS
             resize cannot blend magenta RGB back into the edges
3. resize  — LANCZOS to target size
4. erode   — 2px alpha erosion removes the blended AA fringe ring
5. despill — global clamp of magenta-cast RGB (r AND b above g), AFTER erosion
6. verify  — count visibly-purple edge pixels; must be 0

Usage: python3 process-sprites.py <src.png> <dst.png> <max_side_px>
"""
import os
import sys

from PIL import Image

def key_magenta(px, w, h):
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            if r > 150 and b > 150 and g < 110 and abs(r - b) < 90:
                px[x, y] = (r, g, b, 0)

def bleed(px, w, h, passes=8):
    for _ in range(passes):
        for y in range(h):
            for x in range(w):
                if px[x, y][3] == 0:
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < w and 0 <= ny < h:
                            r, g, b, a = px[nx, ny]
                            if a > 0:
                                px[x, y] = (r, g, b, 0)
                                break

def despill_global(px, w, h):
    """Clamp magenta-cast RGB on ANY remaining pixel (edge or interior).

    Runs AFTER erosion: eroding exposes new edge pixels that were interior
    when an edge-only pass would have run, so the pass must be global.
    Safe for this game's palettes (camo olive/tan/brown, black rifles,
    warm skin, grey jets: none carry r AND b above g).
    """
    fixed = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 0 and r > g + 8 and b > g + 8:
                px[x, y] = (min(r, g + 9), g, min(b, g + 9), a)
                fixed += 1
    return fixed

def erode(px, w, h, rounds=2):
    for _ in range(rounds):
        kill = []
        for y in range(1, h - 1):
            for x in range(1, w - 1):
                if px[x, y][3] > 0 and any(px[x + dx, y + dy][3] == 0
                                            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    kill.append((x, y))
        for x, y in kill:
            r, g, b, _ = px[x, y]
            px[x, y] = (r, g, b, 0)

def visibly_purple(r, g, b, a):
    spread = max(r, g, b) - min(r, g, b)
    return a > 0 and spread > 40 and r > g + 25 and b > g + 25

def process(src, dst, max_side):
    im = Image.open(src).convert("RGBA")
    px = im.load()
    w, h = im.size
    key_magenta(px, w, h)
    bleed(px, w, h)
    # keep aspect ratio, cap the longest side
    scale = max_side / max(w, h)
    if scale < 1:
        im = im.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    px = im.load()
    w, h = im.size
    erode(px, w, h)
    despill_global(px, w, h)
    # auto-crop to content with a small pad
    alpha = im.getchannel("A")
    bbox = alpha.getbbox()
    if bbox:
        pad = 6
        l, t, r, b = bbox
        im = im.crop((max(0, l - pad), max(0, t - pad), min(w, r + pad), min(h, b + pad)))
    q = im.quantize(colors=192, method=Image.FASTOCTREE)
    q.save(dst, optimize=True)

    # verification: zero visibly-purple pixels anywhere
    im2 = Image.open(dst).convert("RGBA")
    px2 = im2.load()
    w2, h2 = im2.size
    bad = 0
    for y in range(h2):
        for x in range(w2):
            if visibly_purple(*px2[x, y]):
                bad += 1
    size_kb = os.path.getsize(dst) // 1024
    status = "OK" if bad == 0 else f"FAIL ({bad} purple px)"
    print(f"{os.path.basename(dst)}: {im.size[0]}x{im.size[1]}, {size_kb}KB, purple check: {status}")
    return bad

if __name__ == "__main__":
    bad = process(sys.argv[1], sys.argv[2], int(sys.argv[3]))
    sys.exit(1 if bad else 0)
