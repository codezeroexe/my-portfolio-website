import sharp from "sharp";

export type Accent = {
  /** the ticket's fill, as a hex colour */
  bg: string;
  /** whichever of the sheet's ink or bone reads better on it */
  fg: string;
};

// the page's own ground and bone (globals.css) in sRGB, for the text pick
const INK = "#130c0c";
const BONE = "#f0ede6";

// a card-stock fallback for a black-and-white cover or a failed fetch
export const PAPER: Accent = { bg: "#f7f6f1", fg: INK };

type RGB = [number, number, number];

const hex = ([r, g, b]: RGB) =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

function luminance([r, g, b]: RGB) {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

const contrast = (a: number, b: number) =>
  (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

function rgbToHsl([r, g, b]: RGB): RGB {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === R ? ((G - B) / d + (G < B ? 6 : 0)) / 6 : max === G ? ((B - R) / d + 2) / 6 : ((R - G) / d + 4) / 6;
  return [h, s, l];
}

function hslToRgb([h, s, l]: RGB): RGB {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const ch = (t: number) => {
    const u = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (u < 1 / 6) return p + (q - p) * 6 * u;
    if (u < 1 / 2) return q;
    if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6;
    return p;
  };
  return [ch(h + 1 / 3) * 255, ch(h) * 255, ch(h - 1 / 3) * 255];
}

/**
 * The cover's accent: the most prominent vivid hue, not the average (an
 * average of a colourful cover is brown). Pixels are bucketed by hue and each
 * scores its saturation × brightness, so a small bright red beats a large
 * dull grey. Lightness is then held in a band that stays visible on the dark
 * sheet without turning pastel, and the text colour is whichever of ink or
 * bone has the higher contrast on it.
 */
export function accentFromPixels(data: Uint8Array | Buffer, channels: number): Accent {
  const BINS = 24;
  const score = new Array<number>(BINS).fill(0);
  const sum = Array.from({ length: BINS }, () => [0, 0, 0, 0]);
  let pixels = 0;

  for (let i = 0; i + 2 < data.length; i += channels) {
    pixels++;
    const rgb: RGB = [data[i], data[i + 1], data[i + 2]];
    const max = Math.max(...rgb) / 255;
    const min = Math.min(...rgb) / 255;
    const sat = max === 0 ? 0 : (max - min) / max;
    if (sat < 0.25 || max < 0.18) continue;
    const [h] = rgbToHsl(rgb);
    const bin = Math.min(BINS - 1, Math.floor(h * BINS));
    const w = sat * max;
    score[bin] += w;
    sum[bin][0] += rgb[0] * w;
    sum[bin][1] += rgb[1] * w;
    sum[bin][2] += rgb[2] * w;
    sum[bin][3] += w;
  }

  const best = score.indexOf(Math.max(...score));
  // under ~4% of the cover carrying any colour: treat it as black and white
  if (!pixels || score[best] < pixels * 0.04 * 0.3) return PAPER;

  const [r, g, b, w] = sum[best];
  const [h, s, l] = rgbToHsl([r / w, g / w, b / w]);
  const bg = hslToRgb([h, Math.max(s, 0.45), Math.min(0.72, Math.max(0.45, l))]);

  const lum = luminance(bg);
  const fg =
    contrast(lum, luminance([0x13, 0x0c, 0x0c])) >= contrast(lum, luminance([0xf0, 0xed, 0xe6]))
      ? INK
      : BONE;
  return { bg: hex(bg), fg };
}

/** fetch a cover and read its accent; card stock if anything goes wrong */
export async function accentFromUrl(url: string): Promise<Accent> {
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return PAPER;
    return await accentFromBuffer(Buffer.from(await res.arrayBuffer()));
  } catch {
    return PAPER;
  }
}

export async function accentFromBuffer(buf: Buffer): Promise<Accent> {
  const { data, info } = await sharp(buf)
    .resize(48, 48, { fit: "cover" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return accentFromPixels(data, info.channels);
}
