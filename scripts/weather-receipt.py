"""
The "about" receipt's wear, baked into two images per layout (desktop, phone).

  public/receipt/<name>-shape.webp   the paper's outline: torn top and bottom,
                                     wavy sides, a nick or two, one torn corner.
                                     Used as the CSS mask of .receipt.
  public/receipt/<name>-wear.webp    everything that happened to it, laid over
                                     the printed text: age and edge browning,
                                     crumple facets, hard folds, coffee rings,
                                     grease, specks, and ink rubbed off along
                                     the folds.

Baked rather than drawn in CSS so the page pays nothing for it on scroll.
Run: python3 scripts/weather-receipt.py   (numpy, scipy, Pillow)
"""
import os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from scipy.spatial import cKDTree

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "receipt")
PAPER = np.array([244, 240, 226], float)  # oklch(0.955 0.014 90), roughly


def smooth(h, w, scale, rng):
    g = rng.standard_normal((max(2, int(h / scale) + 3), max(2, int(w / scale) + 3)))
    z = ndi.zoom(g, (h / (g.shape[0] - 1) * 0.999 + 1e-6, w / (g.shape[1] - 1) * 0.999 + 1e-6), order=3)
    z = z[:h, :w]
    if z.shape != (h, w):
        z = np.pad(z, ((0, h - z.shape[0]), (0, w - z.shape[1])), mode="edge")
    return z


def fbm(h, w, base, rng, octs=4):
    out = np.zeros((h, w))
    amp = 1.0
    tot = 0
    for o in range(octs):
        out += amp * smooth(h, w, base / (2**o), rng)
        tot += amp
        amp *= 0.5
    out /= tot
    return (out - out.min()) / (out.max() - out.min())


def ss(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def over(base, rgb, a):
    """base is (rgb, alpha); composite rgb with alpha a on top."""
    brgb, ba = base
    oa = a + ba * (1 - a)
    safe = np.maximum(oa, 1e-6)[..., None]
    orgb = (rgb * a[..., None] + brgb * (ba * (1 - a))[..., None]) / safe
    return orgb, oa


def profile(n, rng, tooth, amp):
    """a jagged torn edge: n samples of offset in px"""
    xs, ys, x = [0], [0], 0
    up = True
    while x < n:
        x += rng.uniform(tooth * 0.5, tooth * 1.5)
        ys.append(rng.uniform(0.3, 1.0) * amp * (1 if up else 0.15))
        xs.append(x)
        up = not up
    p = np.interp(np.arange(n), xs, ys)
    # a couple of deeper bites
    for _ in range(2):
        c = rng.integers(n // 8, n - n // 8)
        wdt = rng.integers(int(tooth * 2), int(tooth * 4))
        p += np.clip(1 - np.abs(np.arange(n) - c) / wdt, 0, 1) * amp * rng.uniform(0.6, 1.1)
    return p


def shape(W, H, rng):
    yy, xx = np.mgrid[0:H, 0:W].astype(float)
    t = profile(W, rng, 16, 20)
    b = profile(W, rng, 16, 20)
    l = ndi.gaussian_filter1d(rng.standard_normal(H), 18) * 22
    r = ndi.gaussian_filter1d(rng.standard_normal(H), 18) * 22
    top = t[None, :] + 2
    bot = H - 1 - b[None, :] - 2
    left = 6 + l[:, None]
    right = W - 7 + r[:, None]
    a = np.minimum.reduce([
        np.clip(yy - top + 0.5, 0, 1),
        np.clip(bot - yy + 0.5, 0, 1),
        np.clip(xx - left + 0.5, 0, 1),
        np.clip(right - xx + 0.5, 0, 1),
    ])
    # one torn corner (bottom right), a diagonal bite with a rough edge
    cut = 70 + 14 * ndi.gaussian_filter1d(rng.standard_normal(W), 3)[None, :]
    d = (W - xx) + (H - yy) - cut
    a *= np.clip(d * 0.5 + 0.5, 0, 1)
    return a


def ring(yy, xx, cx, cy, R, thick, strength, rng, gappy=True):
    dx, dy = xx - cx, yy - cy
    r = np.hypot(dx, dy)
    th = (np.arctan2(dy, dx) + np.pi) / (2 * np.pi)
    n1 = ndi.gaussian_filter1d(rng.standard_normal(720), 10, mode="wrap")
    n1 = n1 / np.abs(n1).max()
    n2 = ndi.gaussian_filter1d(rng.standard_normal(720), 14, mode="wrap")
    n2 = n2 / np.abs(n2).max()
    idx = np.clip((th * 719).astype(int), 0, 719)
    rr = r / (R * (1 + 0.07 * n1[idx]))
    rim = np.exp(-(((rr - 1) * R) / thick) ** 2)
    if gappy:
        rim = rim * (0.35 + 0.65 * ss(n2[idx], -0.55, 0.0))
    inner = (rr < 1) * 0.10
    halo = np.exp(-np.maximum(rr - 1, 0) * R / 22) * 0.07 * (rr >= 1)
    return np.clip(strength * rim + inner + halo, 0, 0.62)


def blotch(yy, xx, cx, cy, rx, ry, fb, strength):
    d = np.hypot((xx - cx) / rx, (yy - cy) / ry)
    return np.clip(ss(1.0 - d + (fb - 0.5) * 0.9, 0.0, 0.5) * strength, 0, 0.7)


def line_s(yy, xx, px, py, deg, wob):
    th = np.radians(deg)
    return (xx - px) * -np.sin(th) + (yy - py) * np.cos(th) + wob


def wear(W, H, seed, lay):
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:H, 0:W].astype(float)
    S = shape(W, H, np.random.default_rng(seed + 1))
    dist = ndi.distance_transform_edt(S > 0.5)

    base = (np.zeros((H, W, 3)), np.zeros((H, W)))
    px = max(W, H) / 700.0  # feature scale

    # 1. age: blotchy yellowing, browner toward the edges
    f = fbm(H, W, 260 * px, rng)
    edge = np.exp(-dist / (46 * px))
    a = np.clip(0.05 + 0.24 * ss(f, 0.35, 0.8) + 0.38 * edge, 0, 0.6)
    base = over(base, np.broadcast_to(np.array([176, 128, 58.0]), (H, W, 3)), a)

    # 2. tide marks: the contour lines a damp patch leaves
    f2 = fbm(H, W, 380 * px, rng, 3)
    tide = np.exp(-(((f2 - 0.58) / 0.012) ** 2)) * 0.26 + np.exp(-(((f2 - 0.3) / 0.012) ** 2)) * 0.15
    base = over(base, np.broadcast_to(np.array([128, 86, 36.0]), (H, W, 3)), tide)

    # 3. stains
    coffee = np.array([104, 62, 24.0])
    for (fx, fy, fr, st) in lay["rings"]:
        a = ring(yy, xx, fx * W, fy * H, fr * W, 5.5 * px * 1.5, st, rng)
        base = over(base, np.broadcast_to(coffee, (H, W, 3)), a)
    fb = fbm(H, W, 90 * px, rng, 3)
    for (fx, fy, rx, ry, st, col) in lay["blotches"]:
        a = blotch(yy, xx, fx * W, fy * H, rx * W, ry * H, fb, st)
        base = over(base, np.broadcast_to(np.array(col, float), (H, W, 3)), a)
    # specks and splatter
    for _ in range(46):
        cx, cy = rng.uniform(0, W), rng.uniform(0, H)
        rad = rng.uniform(1.2, 5.5) * px * 1.4
        d = np.hypot(xx - cx, yy - cy)
        sp = np.clip((rad - d) / 1.2 + 0.5, 0, 1) * rng.uniform(0.25, 0.6)
        base = over(base, np.broadcast_to(coffee * 0.8, (H, W, 3)), sp)

    # 4. crumple: faceted shading, like a ball of paper opened out
    n = lay["facets"]
    gx, gy = int(np.sqrt(n * W / H)) + 1, int(np.sqrt(n * H / W)) + 1
    seeds = np.array([((i + rng.uniform(0.1, 0.9)) * W / gx, (j + rng.uniform(0.1, 0.9)) * H / gy)
                      for i in range(gx) for j in range(gy)])
    tree = cKDTree(seeds)
    pts = np.column_stack([xx.ravel(), yy.ravel()])
    dd, ii = tree.query(pts, k=2)
    d1, d2 = dd[:, 0].reshape(H, W), dd[:, 1].reshape(H, W)
    cell = rng.standard_normal(len(seeds))[ii[:, 0]].reshape(H, W)
    ridge = np.exp(-(d2 - d1) / (2.0 * px * 1.4)) * ss(fbm(H, W, 60 * px, rng, 3), 0.45, 0.7)
    base = over(base, np.zeros((H, W, 3)), np.clip(0.16 * ridge, 0, 0.2))
    base = over(base, np.broadcast_to(np.array([255, 252, 240.0]), (H, W, 3)), np.clip(cell, 0, 2) * 0.03)
    base = over(base, np.zeros((H, W, 3)), np.clip(-cell, 0, 2) * 0.04)
    # fine crinkle: embossed noise lit from the top left
    hgt = fbm(H, W, 34 * px, rng, 4) * 60
    gy_, gx_ = np.gradient(ndi.gaussian_filter(hgt, 1.2))
    lit = (gx_ + gy_) * 0.5
    base = over(base, np.broadcast_to(np.array([255, 253, 244.0]), (H, W, 3)), np.clip(lit, 0, 1) * 0.3)
    base = over(base, np.zeros((H, W, 3)), np.clip(-lit, 0, 1) * 0.3)

    # 5. hard folds
    fold_prox = np.zeros((H, W))
    wob = ndi.gaussian_filter(rng.standard_normal((H, W)), 30) * 40 * px
    for (fx, fy, deg, st) in lay["folds"]:
        s = line_s(yy, xx, fx * W, fy * H, deg, wob)
        dark = np.exp(-((s / (1.7 * px * 1.4)) ** 2)) * 0.38 * st
        hi = np.exp(-(((s + 4 * px) / (1.7 * px * 1.4)) ** 2)) * 0.5 * st
        shade = np.exp(-np.maximum(s, 0) / (46 * px)) * 0.16 * st * (s > 0)
        base = over(base, np.zeros((H, W, 3)), np.clip(dark + shade, 0, 0.7))
        base = over(base, np.broadcast_to(np.array([255, 253, 244.0]), (H, W, 3)), np.clip(hi, 0, 0.6))
        fold_prox = np.maximum(fold_prox, np.exp(-np.abs(s) / (34 * px)))
    # little scratches / hairline creases
    for _ in range(26):
        cx, cy = rng.uniform(0, W), rng.uniform(0, H)
        ln = rng.uniform(40, 170) * px
        deg = rng.uniform(0, 180)
        th = np.radians(deg)
        u = (xx - cx) * np.cos(th) + (yy - cy) * np.sin(th)
        v = -(xx - cx) * np.sin(th) + (yy - cy) * np.cos(th)
        m = np.exp(-((v / (1.0 * px * 1.4)) ** 2)) * (np.abs(u) < ln) * ss(ln - np.abs(u), 0, ln * 0.4)
        base = over(base, np.zeros((H, W, 3)), m * 0.2)

    # 6. ink rubbed off: paper-colour patches over the text, mostly along folds
    # and toward the edges
    f3 = fbm(H, W, 70 * px, rng, 4)
    rub = ss(f3, 0.62, 0.88) * (0.1 + 0.9 * np.maximum(fold_prox, edge * 1.2).clip(0, 1))
    base = over(base, np.broadcast_to(PAPER, (H, W, 3)), np.clip(rub * 0.45, 0, 0.38))

    # 7. fibre grain
    g = rng.standard_normal((H, W))
    g = ndi.gaussian_filter(g, 0.7)
    base = over(base, np.zeros((H, W, 3)), np.clip(-g, 0, 3) * 0.03)
    base = over(base, np.broadcast_to(np.array([255, 255, 250.0]), (H, W, 3)), np.clip(g, 0, 3) * 0.03)

    rgb, a = base
    return S, np.dstack([np.clip(rgb, 0, 255), np.clip(a * 255, 0, 255)]).astype(np.uint8)


LAYOUTS = {
    # fractions of width/height
    "desk": dict(
        W=1216, H=640, seed=11, facets=46,
        rings=[(0.80, 0.20, 0.085, 0.6), (0.20, 0.97, 0.07, 0.5)],
        blotches=[(0.42, 0.55, 0.10, 0.30, 0.34, (150, 112, 40)), (0.92, 0.78, 0.07, 0.20, 0.3, (60, 40, 20))],
        folds=[(0.5, 0.36, -2.5, 1.0), (0.5, 0.74, 1.6, 0.8), (0.31, 0.5, 91.5, 0.9)],
    ),
    "phone": dict(
        W=720, H=920, seed=23, facets=40,
        rings=[(0.74, 0.14, 0.17, 0.6), (0.18, 0.80, 0.14, 0.5)],
        blotches=[(0.35, 0.50, 0.22, 0.10, 0.34, (150, 112, 40)), (0.86, 0.90, 0.14, 0.06, 0.3, (60, 40, 20))],
        folds=[(0.5, 0.30, -2.0, 1.0), (0.5, 0.66, 2.2, 0.85), (0.62, 0.5, 90.5, 0.8)],
    ),
}

# how much of the wear is kept, 0..1. LEVEL=0.5 python3 scripts/weather-receipt.py
# LEVELS=0.08,0.15 writes <name>-wear-<level>.webp for each, to compare.
LEVEL = 0.08

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    env = os.environ.get("LEVELS")
    levels = [float(x) for x in env.split(",")] if env else [LEVEL]
    for name, lay in LAYOUTS.items():
        S, w = wear(lay["W"], lay["H"], lay["seed"], lay)
        shp = np.dstack([np.full(S.shape + (3,), 255), S * 255]).astype(np.uint8)
        Image.fromarray(shp, "RGBA").save(os.path.join(OUT, f"{name}-shape.webp"), quality=90, method=6)
        for lv in levels:
            v = w.copy()
            v[..., 3] = (v[..., 3] * lv).astype(np.uint8)
            suffix = f"-{lv}" if env else ""
            f = os.path.join(OUT, f"{name}-wear{suffix}.webp")
            Image.fromarray(v, "RGBA").save(f, quality=78, method=6)
            print(f, os.path.getsize(f) // 1024, "KB")
