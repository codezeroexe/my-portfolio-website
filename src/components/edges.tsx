/**
 * Torn edges, marker swipes, and the die-cut sticker primitive.
 *
 * Every edge here is irregular, and every one of them *clips a silhouette*.
 * Nothing displaces content: warping a photograph distorts the face inside it
 * and warping type breaks legibility. A CSS `border-radius` trick can only ever
 * fake a tear, so the shapes are hand-authored jittered polylines instead.
 */

import type { CSSProperties, ReactNode } from "react";

// deterministic pseudo-random, so a given seed always tears the same way
function rnd(seed: number, i: number): number {
  const v = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

/** A chewed rectangle: mostly straight runs, ragged edges, occasional fibre. */
function tornEdge(w: number, h: number, seed: number): string {
  const ampX = w * 0.028;
  const ampY = h * 0.028;
  const pts: [number, number][] = [];
  const nx = 26;
  const ny = 18;

  const jitterX = (i: number) => (rnd(seed, i) - 0.5) * ampX;
  const jitterY = (i: number) => (rnd(seed, i + 100) - 0.5) * ampY;

  for (let i = 0; i <= nx; i++) {
    const t = i / nx;
    // every third notch bites in harder, like a fibre pulled loose
    const bite = i % 3 === 0 ? -ampY * 0.7 : 0;
    pts.push([t * w, jitterY(i) + bite]);
  }
  for (let i = 1; i <= ny; i++) {
    const t = i / ny;
    pts.push([w + jitterX(i), t * h]);
  }
  for (let i = 1; i <= nx; i++) {
    const t = i / nx;
    const bite = i % 4 === 0 ? ampY * 0.7 : 0;
    pts.push([w - t * w, h + jitterY(i + 40) + bite]);
  }
  for (let i = 1; i < ny; i++) {
    const t = i / ny;
    pts.push([jitterX(i + 70), h - t * h]);
  }

  return `M ${pts.map(([x, y]) => `${x.toFixed(3)} ${y.toFixed(3)}`).join(" L ")} Z`;
}

/** An organic blob for marker swipes and burst shapes. */
function blobPath(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed: number,
  wobble: number,
): string {
  const n = 14;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k =
      1 +
      Math.sin(seed * 4.1 + i * 2.7) * wobble +
      Math.cos(seed * 1.7 + i * 1.3) * wobble * 0.5;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  let d = `M ${((pts[0][0] + pts[n - 1][0]) / 2).toFixed(1)} ${((pts[0][1] + pts[n - 1][1]) / 2).toFixed(1)} `;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % n];
    d += `Q ${x0.toFixed(1)} ${y0.toFixed(1)} ${((x0 + x1) / 2).toFixed(1)} ${((y0 + y1) / 2).toFixed(1)} `;
  }
  return `${d}Z`;
}

/** A comic impact burst: alternating long and short points. */
function burst(r: number, seed: number): string {
  const points = 14;
  const pts: [number, number][] = [];
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const long = i % 2 === 0;
    const rr = long ? r : r * (0.62 + rnd(seed, i) * 0.12);
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  return `M ${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L ")} Z`;
}

/**
 * Registers every torn edge, blob and burst as a clip path on one hidden SVG.
 *
 * Each shape is authored in a 0-100 box and stretched to the element with
 * `preserveAspectRatio="none"`, so one definition serves a 960px-wide project
 * block and a 300px polaroid alike. Without the stretch a clip would only cover
 * its own 100 units and lop off the rest of the element.
 */
export function EdgeClips() {
  const torn = [
    { id: "tear-a", seed: 3, ratio: 1 },
    { id: "tear-b", seed: 17, ratio: 1 },
    { id: "tear-c", seed: 29, ratio: 1 },
    { id: "tear-wide", seed: 11, ratio: 1.7 },
    { id: "tear-tall", seed: 41, ratio: 0.6 },
    { id: "tear-paper", seed: 53, ratio: 1 },
  ];

  return (
    <svg
      aria-hidden
      focusable="false"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    >
      <defs>
        {torn.map((t) => (
          <clipPath key={t.id} id={t.id} clipPathUnits="objectBoundingBox">
            <path
              d={tornEdge(1, 1 / t.ratio, t.seed)}
              preserveAspectRatio="none"
            />
          </clipPath>
        ))}
        {[
          { id: "blob-1", seed: 5, wob: 0.12 },
          { id: "blob-2", seed: 23, wob: 0.16 },
          { id: "blob-3", seed: 37, wob: 0.1 },
        ].map((b) => (
          <clipPath key={b.id} id={b.id} clipPathUnits="objectBoundingBox">
            <path d={blobPath(0.5, 0.5, 0.48, 0.44, b.seed, b.wob)} />
          </clipPath>
        ))}
        {[
          { id: "burst-a", seed: 3 },
          { id: "burst-b", seed: 19 },
        ].map((b) => (
          <clipPath key={b.id} id={b.id} clipPathUnits="objectBoundingBox">
            <path d={burst(0.5, b.seed)} />
          </clipPath>
        ))}
      </defs>
    </svg>
  );
}

/** A torn scrap of paper to sit a block of text on. */
export function TornPaper({
  children,
  clip = "tear-paper",
  tilt = 0,
  className = "",
  tone = "deep",
  style,
}: {
  children: ReactNode;
  clip?: string;
  tilt?: number;
  className?: string;
  tone?: "deep" | "plain";
  style?: CSSProperties;
}) {
  return (
    <div
      className={`relative ${className}`}
      style={
        {
          transform: `rotate(${tilt}deg)`,
          clipPath: `url(#${clip})`,
          background: tone === "deep" ? "var(--paper-deep)" : "var(--paper)",
          padding: "1.9rem 2.1rem",
          ...style,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}

/**
 * A die-cut sticker.
 *
 * No white keyline is drawn here. The extracted artwork already carries the
 * physical sticker's white border, so adding a ring would double it up. What is
 * left is the drop shadow, the tilt, and the lift on hover.
 */
export function Sticker({
  src,
  alt,
  size = 108,
  tilt = 0,
  className = "",
  style,
  priority = false,
}: {
  src: string;
  alt: string;
  size?: number;
  tilt?: number;
  className?: string;
  style?: CSSProperties;
  priority?: boolean;
}) {
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={`sticker ${className}`}
      style={
        {
          width: size,
          height: "auto",
          ["--tilt" as string]: `${tilt}deg`,
          ...style,
        } as CSSProperties
      }
    />
  );
}

/** A polaroid: a clean card, hairline border, photo untouched inside. */
export function Polaroid({
  src,
  alt,
  caption,
  width = 320,
  tilt = -2,
  imgWidth = 980,
  imgHeight = 1070,
  className = "",
}: {
  src: string;
  alt: string;
  caption?: string;
  width?: number;
  tilt?: number;
  imgWidth?: number;
  imgHeight?: number;
  className?: string;
}) {
  const edge = width * 0.024;
  return (
    <div
      className={`scrap relative inline-block w-full ${className}`}
      // width is a ceiling, not a fixed size: at 390px a hard 380px overflowed
      // the column by 30px. Everything inside is sized off `width` anyway, so
      // the padding maths is unchanged when the real box is narrower.
      style={{ maxWidth: width }}
    >
      <div
        className="relative"
        style={{
          // the card stock, not --bone: this is the one light object on a black
          // sheet, and it is a printed photograph rather than an element
          background: "#f7f6f1",
          padding: edge,
          clipPath: `inset(${edge * 0.22}px round 1px)`,
          transform: `rotate(${tilt}deg)`,
          boxShadow: "0 10px 22px -12px oklch(0 0 0 / 0.9)",
        }}
      >
        <img
          src={src}
          alt={alt}
          width={imgWidth}
          height={imgHeight}
          className="block w-full"
        />
        {caption && (
          <p
            className="note text-center"
            style={{
              fontSize: width * 0.055,
              // ink on the white card. Without this the caption inherited the
              // page's bone and printed bone-on-white, i.e. invisibly.
              color: "oklch(0.25 0.02 30)",
              margin: `${edge}px 0 0`,
            }}
          >
            {caption}
          </p>
        )}
      </div>
      <span
        className="tape absolute z-10"
        style={{
          width: width * 0.44,
          height: 26,
          top: -11,
          left: width * 0.28,
        }}
      />
    </div>
  );
}

/** A comic impact burst, for a sticker-shaped callout. */
export function Burst({
  children,
  clip = "burst-a",
  color = "var(--yellow)",
  className = "",
}: {
  children: ReactNode;
  clip?: string;
  color?: string;
  className?: string;
}) {
  return (
    <span className={`relative inline-block ${className}`}>
      {/* the burst shape is a background layer so the spiky points can overhang
          the label without clipping the words sitting inside them */}
      <span
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{ background: color, clipPath: `url(#${clip})` }}
      />
      <span className="relative inline-flex items-center justify-center px-8 py-5 text-center">
        {children}
      </span>
    </span>
  );
}
