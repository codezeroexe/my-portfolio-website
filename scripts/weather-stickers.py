"""
Wear on every sticker, worked out from each sticker's own outline.

The clean originals live in stickers-src/, in the same folders as under
public/stickers/. This reads each one, wears it, and writes the result over
public/stickers/<same path>, which is what the page loads. Nothing on the page
changes: same paths, same placements.

## What a sticker gets depends on what it is

  vinyl  a die-cut printed sticker. Its edge lifts a hair and the exposed glue
         picks up a broken rim of dirt, heaviest on the points; the face is
         scratched one way, as if dragged across a desk; the reds fade first.
  paper  a letter cut out of a magazine. The cut shows the paper's white core,
         frayed; it creases; the print rubs off at the corners.

and then, per sticker in WEAR below:

  level   0..1, how long it has been on the laptop
  crease  a fold (paper) or a wrinkle run in from one edge (vinyl)
  lift    the most exposed corner was peeled up and pressed back down, with
          the dust its glue picked up while it was off
  tear    someone started to peel it and the print tore off the backing
  fade    sun, beyond what the level gives

Points and corners are found from the shape itself (where little of the
sticker is round a bit of edge, it sticks out and gets caught), so the wear
lands where handling would put it. Every length is in CSS px of the sticker as
placed, so a 30px letter and a 285px H are worn at the same physical scale.
Each sticker is seeded from its path, so a run is repeatable and no two
stickers wear the same way.

## Adding a sticker

Drop it into public/stickers/ as usual and run this. A file with no original in
stickers-src/ yet is taken as a new original: it is copied there first, then
worn. Give it a line in WEAR, or it gets the default.

Merged clusters (public/stickers/merged/) are screenshots of stickers that are
already worn, so they are skipped; re-merge them after re-running this.

usage:  python3 scripts/weather-stickers.py [path under public/stickers ...]
needs:  numpy, scipy, pillow  (python3 -m pip install numpy scipy pillow)
"""
import json
import shutil
import sys
import zlib
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "stickers-src"
OUT = ROOT / "public/stickers"

# One line per sticker. Paper unless it is a printed die-cut; level spread
# from nearly new to battered, so the wall looks collected over years rather
# than worn all at once.
WEAR = {
    # hero
    "letters/H/h-19.webp": dict(material="paper", level=0.5, crease=True),
    "letters/A/a-51.webp": dict(material="paper", level=0.45, lift=True),
    "letters/R/r-12.webp": dict(material="paper", level=0.6, crease=True, lift=True),
    "letters/I/i-08.webp": dict(material="paper", level=0.35),
    "special/trademark-01.webp": dict(level=0.4, lift=True),
    "acdc.webp": dict(level=0.75, tear=True),
    "avengers-assemble.webp": dict(level=0.55, crease=True),
    "call-me.webp": dict(level=0.45, tear=True),
    "f1-logo.webp": dict(level=0.3),
    "flash.webp": dict(level=0.5),
    "spidey.webp": dict(level=0.7, tear=True),
    "marvel.webp": dict(level=0.65, crease=True),
    "new-york.webp": dict(level=0.8, lift=True, fade=0.3),
    "parental-advisory.webp": dict(level=0.85, crease=True, lift=True),
    "sun.webp": dict(level=0.55, fade=0.35),
    "shapes/arrow-11.webp": dict(level=0.4, lift=True),
    "shapes/emoji-04.webp": dict(level=0.6, crease=True),
    # projects
    "4970f77a196cfc45ada0bfa525347e51.webp": dict(level=0.35, lift=True),
    "80c4c992b00614ce3f0d48fda45b688a.webp": dict(level=0.6, crease=True),
    "blazer.webp": dict(level=0.45),
    "earth.webp": dict(level=0.7, crease=True),
    "island.webp": dict(level=0.5, lift=True),
    "letters/B/b-22.webp": dict(material="paper", level=0.4, crease=True),
    "letters/I/i-06.webp": dict(material="paper", level=0.25),
    "letters/L/l-20.webp": dict(material="paper", level=0.55, lift=True),
    "letters/T/t-10.webp": dict(material="paper", level=0.4),
    "letters/U/u-13.webp": dict(material="paper", level=0.5, crease=True),
    "numbers/1-10.webp": dict(material="paper", level=0.6, crease=True),
    "numbers/2-06.webp": dict(material="paper", level=0.35),
    "numbers/3-03.webp": dict(material="paper", level=0.7, lift=True),
    "numbers/4-10.webp": dict(material="paper", level=0.45, crease=True),
    # about
    "bam-bam.webp": dict(level=0.65, tear=True),
    "cap.webp": dict(level=0.45, lift=True),
    "frank-head.webp": dict(level=0.4),
    "letters/A/a-16.webp": dict(material="paper", level=0.5, crease=True),
    "letters/E/e-21.webp": dict(material="paper", level=0.6, lift=True),
    "letters/M/m-13.webp": dict(material="paper", level=0.45, crease=True),
    "letters/M/m-25.webp": dict(material="paper", level=0.5, lift=True),
    "letters/R/r-20.webp": dict(material="paper", level=0.35),
    "letters/T/t-11.webp": dict(material="paper", level=0.55, crease=True),
    "letters/T/t-20.webp": dict(material="paper", level=0.45, lift=True),
    # contact
    "letters/H/h-12.webp": dict(material="paper", level=0.55, crease=True),
    "letters/I/i-04.webp": dict(material="paper", level=0.3),
    "mouth.webp": dict(level=0.5, crease=True),
    "special/exclamation-mark-07.webp": dict(material="paper", level=0.45),
    "spider-star.webp": dict(level=0.6, tear=True),
    "stussy.webp": dict(level=0.8, crease=True, lift=True),
}
DEFAULT = dict(level=0.45)

PAPER = np.array([243, 238, 226], np.float32)  # the stock under the ink
GRIME = np.array([46, 34, 24], np.float32)
BACKING = np.array([234, 231, 222], np.float32)  # the paper under a vinyl print


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


class Noise:
    """Gaussian-blurred white noise, done in the frequency domain."""

    def __init__(self, rng, h, w):
        self.rng, self.h, self.w = rng, h, w
        self.fx = np.fft.fftfreq(w)[None, :]
        self.fy = np.fft.fftfreq(h)[:, None]

    def g(self, sx, sy=None, angle=0.0):
        """blurred sx along `angle`, sy across it; zero mean, unit std"""
        sy = sx if sy is None else sy
        c, s = np.cos(angle), np.sin(angle)
        u = self.fx * c + self.fy * s
        v = -self.fx * s + self.fy * c
        g = np.exp(-2 * np.pi ** 2 * ((u * sx) ** 2 + (v * sy) ** 2))
        o = np.real(np.fft.ifft2(np.fft.fft2(self.rng.standard_normal((self.h, self.w))) * g))
        return ((o - o.mean()) / (o.std() + 1e-9)).astype(np.float32)

    def fbm(self, s, octaves=3, gain=0.55, stretch=1.0, angle=0.0):
        t = np.zeros((self.h, self.w), np.float32)
        a, n = 1.0, 0.0
        for i in range(octaves):
            t += a * self.g(s / 2 ** i * stretch, s / 2 ** i, angle)
            n += a * a
            a *= gain
        return t / np.sqrt(n)


def weather(img, css_w, seed, material="vinyl", level=0.5, crease=False, lift=False, tear=False, fade=None):
    rgba = np.asarray(img.convert("RGBA")).astype(np.float32)
    W0 = rgba.shape[1]
    P = 4  # pad, so a sticker cut to the very edge of its image has an edge
    rgba = np.pad(rgba, ((P, P), (P, P), (0, 0)))
    H, W = rgba.shape[:2]
    rgb, alpha = rgba[..., :3], rgba[..., 3] / 255
    k = W0 / css_w  # image px per css px
    css = lambda v: v * k
    rng = np.random.default_rng(seed)
    N = Noise(rng, H, W)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    L = level

    inside = alpha > 0.5
    d = ndi.distance_transform_edt(inside) / k  # css px in from the edge
    # how much a bit of edge sticks out: little of the sticker round it means
    # a point or a corner, the bits that get caught; a lot means a notch
    held = ndi.gaussian_filter(inside.astype(np.float32), css(5))
    point = ndi.gaussian_filter(smooth(0.46, 0.2, held) * (d < 12), css(1.2))
    cy, cx = [float(v.mean()) for v in np.nonzero(inside)]
    ext = np.sqrt(inside.sum()) / k  # rough size of the sticker, css px

    light = np.zeros((H, W), np.float32)  # ink gone, stock showing
    dark = np.zeros((H, W), np.float32)  # dirt
    fuzz = N.fbm(css(1.4), 2)

    # --- edges
    if material == "paper":
        # the cut shows the white core, frayed: a thin band that wanders,
        # wider where a corner has been knocked about
        width = 0.35 + 0.9 * smooth(-0.6, 1.6, N.fbm(css(14), 3)) * (0.4 + L) + 4.5 * point * L
        fibre = N.fbm(css(0.9), 2, stretch=2.0)
        band = 1 - smooth(0, 1, (d + fuzz * 0.35) / width)
        light += band ** 1.3 * (0.55 + 0.35 * smooth(-1, 1, fibre))
        light += point * smooth(0.3, 1.5, N.fbm(css(2.2), 3)) * 0.4 * L
        dark += (1 - smooth(0, 6, d)) * (0.5 + 0.5 * smooth(-1, 1, N.fbm(css(8), 3))) * 0.07 * L
    else:
        # the edge lifts a hair and the exposed glue catches dust: a broken
        # dark rim right at the cut, heavier where it sticks out
        rim = 1 - smooth(0.15, 0.9 + 0.8 * point, d + fuzz * 0.25)
        runs = smooth(-0.4, 0.9, N.fbm(css(6), 3)) * (0.35 + 0.65 * L) + point * 0.8 * L
        dark += rim * np.clip(runs, 0, 1) * 0.42
        # and a softer grey creeping in from it
        creep = 1 - smooth(0, 3 + 7 * L, d + fuzz)
        dark += creep * (0.4 + 0.6 * smooth(-1.2, 1.2, N.fbm(css(10), 3))) * 0.09 * (0.3 + L)
        # print rubbed through on the points
        light += point * smooth(0.2, 1.4, N.fbm(css(2), 3)) * 0.45 * L * (1 - smooth(0, 6, d))

    # chips out of the outline, on the points, once it has been around a while
    a_out = alpha.copy()
    if L > 0.35:
        ys, xs = np.nonzero((d > 0) & (d < 1.2) & (point > 0.3))
        n = int(rng.poisson(1 + 4 * (L - 0.35) * min(ext / 80, 2)))
        for _ in range(min(n, len(ys))):
            i = rng.integers(len(ys))
            r = css(rng.uniform(0.8, 1.6 + 1.4 * L))
            q = np.hypot(xx - xs[i], yy - ys[i]) + fuzz * css(0.35)
            bite = smooth(r * 0.65, r, q)
            a_out *= bite
            ring = (1 - smooth(r, r + css(1.2), q)) * (bite > 0.5)
            if material == "paper":
                light += ring * 0.5
            else:
                dark += ring * 0.25

    # --- the face
    drag = rng.uniform(0, np.pi)  # the way it gets rubbed
    # print density a touch uneven
    mott = N.fbm(css(ext * 0.35), 3)
    light += np.clip(mott - 0.3, 0, None) * 0.05 * (0.3 + L)
    dark += np.clip(-mott - 0.3, 0, None) * 0.05 * (0.3 + L)
    # soft scuffs dragged one way
    sc = smooth(0.9, 2.3, N.fbm(css(9), 3, stretch=4, angle=drag)) * smooth(0, 1.2, N.fbm(css(ext * 0.4), 2))
    light += sc * (0.10 + 0.14 * L) * (0.6 if material == "paper" else 1)

    # scratches: hairlines, mostly along the drag, broken where the point skipped
    if material == "vinyl" and L > 0.2:
        n = int(rng.poisson(1 + 7 * L * min(ext / 90, 1.6)))
        for _ in range(n):
            ang = drag + rng.normal(0, 0.35)
            ln = css(rng.uniform(4, 10 + 22 * L))
            px = cx + rng.normal(0, 0.3) * ext * k
            py = cy + rng.normal(0, 0.3) * ext * k
            bend = rng.normal(0, 0.06)
            t = np.clip(((xx - px) * np.cos(ang) + (yy - py) * np.sin(ang)) / ln, -0.5, 0.5)
            ox = px + t * ln * np.cos(ang) - np.sin(ang) * bend * ln * (t * t - 0.25)
            oy = py + t * ln * np.sin(ang) + np.cos(ang) * bend * ln * (t * t - 0.25)
            q = np.hypot(xx - ox, yy - oy) / k
            line = np.exp(-(q / rng.uniform(0.12, 0.26)) ** 2) * (1 - smooth(0.25, 0.5, np.abs(t)))
            light += line * smooth(-0.2, 0.8, N.g(css(1.1))) * rng.uniform(0.18, 0.5)

    # --- a fold, or a wrinkle
    if crease:
        a = rng.uniform(0, np.pi)
        off = rng.uniform(-0.35, 0.35)
        proj = (xx - cx) * -np.sin(a) + (yy - cy) * np.cos(a)
        s = (proj - off * np.abs(proj[inside]).max()) / k  # css px across it
        runs = smooth(-0.3, 0.9, N.g(css(4), css(0.8), a))
        if material == "paper":
            # a straight fold: ink cracked along the crest in broken runs, the
            # two halves at slightly different angles to the light
            light += np.exp(-(s / 0.35) ** 2) * runs * (0.4 + 0.3 * smooth(-1, 1.2, N.g(css(0.6))))
            light += np.exp(-((s - 0.9) / 0.7) ** 2) * 0.10
            light += smooth(0, 3, s) * 0.035
            dark += np.exp(-((s + 1.1) / 1.6) ** 2) * 0.10
        else:
            # vinyl wrinkles rather than folds: a ridge run in from one edge,
            # from being peeled and stuck down again
            along = ((xx - cx) * np.cos(a) + (yy - cy) * np.sin(a)) / k
            along = along * rng.choice([-1, 1])
            reach = np.abs(along[inside]).max()
            from_edge = smooth(-0.1 * reach, 0.45 * reach, along)
            light += np.exp(-(s / 0.45) ** 2) * runs * 0.32 * from_edge
            dark += (np.exp(-((s + 0.9) / 0.8) ** 2) * 0.12 + np.exp(-((s - 1.0) / 0.8) ** 2) * 0.05) * from_edge

    # --- the corner that was peeled up and pressed back down
    if lift:
        score = point * (d > 0.5) * np.hypot(xx - cx, yy - cy)
        ty, tx = np.unravel_index(np.argmax(score), score.shape)
        vx, vy = tx - cx, ty - cy
        m = np.hypot(vx, vy)
        sk = rng.normal(0, 0.25)  # folds are never quite square to the corner
        fx = (vx * np.cos(sk) - vy * np.sin(sk)) / m
        fy = (vx * np.sin(sk) + vy * np.cos(sk)) / m
        depth = rng.uniform(0.09, 0.15) * ext + 3
        s = ((xx - tx) * fx + (yy - ty) * fy) / k + depth  # > 0 on the flap
        flap = smooth(-0.3, 0.3, s) * inside
        light += np.exp(-(s / 0.5) ** 2) * (0.35 + 0.35 * smooth(-0.3, 0.8, N.g(css(1.5)))) * inside
        light += flap * 0.025
        # the dust its glue picked up while it was off: under the fold line,
        # and spotted over the flap
        dark += np.exp(-((s + 0.9) / 0.9) ** 2) * 0.16 * inside
        dark += flap * smooth(1.2, 2.2, N.g(css(0.5))) * 0.22
        dark += flap * smooth(-0.5, 1.5, N.fbm(css(3), 2)) * 0.06

    # --- where someone started to peel it and the print tore off the backing
    torn = np.zeros((H, W), np.float32)
    if tear:
        ys, xs = np.nonzero((d > 0.2) & (d < 1.5) & (point > 0.25))
        if len(ys) == 0:
            ys, xs = np.nonzero((d > 0.2) & (d < 1.5))
        i = rng.integers(len(ys))
        ty, tx = ys[i], xs[i]
        r = rng.uniform(0.07, 0.12) * ext + 2.5
        q = np.hypot(xx - tx, yy - ty) / k
        q = q + N.fbm(css(r * 0.5), 3) * r * 0.3 + N.fbm(css(0.7), 2) * 0.35
        torn = (1 - smooth(r - 0.3, r + 0.3, q)) * inside
        # a lip of torn print, and fibres of backing pulled up past it
        dark += np.exp(-((q - r - 0.25) / 0.35) ** 2) * inside * 0.22
        fib = smooth(0.6, 1.6, N.fbm(css(0.5), 2, stretch=2.5, angle=np.arctan2(ty - cy, tx - cx) + np.pi / 2))
        light += (1 - smooth(r, r + 1.6, q)) * (q > r) * fib * 0.5 * inside
        dark += torn * (0.4 + 0.6 * smooth(-1, 1.5, N.fbm(css(3), 3))) * 0.1

    # grime, warm and low, gathered in the hollows of the shape
    dark += (1 - smooth(0, 14, d)) * (1 - held) * 0.12 * L
    # grain
    gr = N.g(css(0.45))
    light += np.clip(gr - 1.1, 0, None) * 0.03
    dark += np.clip(-gr - 1.1, 0, None) * 0.02

    light = np.clip(light, 0, 0.85) * inside
    dark = np.clip(dark, 0, 0.5) * inside

    # fade: the reds go first, everything drifts warm, more on the side that
    # faced the window
    f = (0.04 + 0.16 * L) if fade is None else fade
    side = rng.uniform(0, 2 * np.pi)
    sun = 0.6 + 0.4 * smooth(-1, 1, ((xx - cx) * np.cos(side) + (yy - cy) * np.sin(side)) / (ext * k * 0.6))
    lum = rgb @ np.array([0.299, 0.587, 0.114], np.float32)
    redness = smooth(20, 120, rgb[..., 0] - rgb[..., 1:].max(-1))
    faded = rgb + (lum[..., None] - rgb) * 0.75 + (PAPER - rgb) * 0.25
    out = rgb + (faded - rgb) * np.clip(f * sun * (1 + 0.8 * redness), 0, 1)[..., None]
    out = out * np.array([1.0, 0.99, 0.965], np.float32) ** (f * 4)

    backing = BACKING * (0.97 + 0.03 * N.fbm(css(0.8), 2))[..., None]
    out = out * (1 - torn[..., None]) + backing * torn[..., None]
    # rubbed through to the stock: lighter, never darker than what was there
    out = out * (1 - light[..., None]) + np.maximum(PAPER, out) * light[..., None]
    out = out * (1 - dark[..., None]) + GRIME * dark[..., None]
    res = np.dstack([np.clip(out, 0, 255), np.clip(a_out * 255, 0, 255)]).round().astype(np.uint8)
    return Image.fromarray(res[P:-P, P:-P], "RGBA")


def placed_widths():
    """The widest each sticker is placed, in css px, from the placements and
    from the members of any merged cluster."""
    widths = {}

    def take(s):
        key = s["src"].removeprefix("/stickers/")
        widths[key] = max(widths.get(key, 0), s["size"])

    for sections in json.loads((ROOT / "src/data/placements.json").read_text()).values():
        for stickers in sections.values():
            for s in stickers:
                take(s)
    ledger = ROOT / "src/data/merged-stickers.json"
    if ledger.exists():
        for entry in json.loads(ledger.read_text()).values():
            for s in entry["members"]:
                take(s)
    return widths


def main():
    names = sys.argv[1:]
    if not names:
        names = sorted(
            {p.relative_to(SRC).as_posix() for p in SRC.rglob("*.webp")}
            | {p.relative_to(OUT).as_posix() for p in OUT.rglob("*.webp") if p.relative_to(OUT).parts[0] != "merged"}
        )
    widths = placed_widths()
    for name in names:
        src, out = SRC / name, OUT / name
        if not src.exists():
            # a new sticker: what is in public/ is the clean original
            src.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(out, src)
            print(f"{name}: new, kept the original in stickers-src/")
        wear = {"material": "vinyl", **DEFAULT, **WEAR.get(name, {})}
        css_w = widths.get(name, 100)
        img = weather(Image.open(src), css_w, zlib.crc32(name.encode()), **wear)
        out.parent.mkdir(parents=True, exist_ok=True)
        img.save(out, "WEBP", quality=90, alpha_quality=100, method=6)
        print(f"{name}: {wear['material']} {wear['level']} at {css_w}px")


if __name__ == "__main__":
    main()
