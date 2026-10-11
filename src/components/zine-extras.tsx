"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import {
  DEFAULT_DOODLE,
  DEFAULT_MARKER,
  DOODLES,
  MARKERS,
  type DoodleKind,
  type MarkerKind,
} from "@/lib/zine-extras";

/**
 * The marker pen: a click on the sheet draws a quick doodle there, in the
 * cursor's own ink, and on previews a small picker to try the variants.
 *
 * The cursor itself is CSS (globals.css, html[data-cursor]); the layout sets
 * the default on <html> so it is there before this hydrates, and the picker
 * only swaps the attribute.
 *
 * Every doodle is drawn fresh from a few wobbly points, so no two match, and
 * its strokes are written on in order rather than appearing. A doodle lands
 * only on the sheet: never on a link, button or field (the click is theirs),
 * never while text is being selected, never in the sticker editor. The last
 * few stay, the oldest fades as a new one lands, and a reload clears them.
 */
export function ZineExtras({ picker }: { picker: boolean }) {
  const [marker, setMarker] = useState<MarkerKind>(DEFAULT_MARKER);
  const [doodle, setDoodle] = useState<DoodleKind>(DEFAULT_DOODLE);
  const [marks, setMarks] = useState<Mark[]>([]);
  const next = useRef(0);
  const marksRef = useRef<Mark[]>([]);
  useEffect(() => {
    marksRef.current = marks;
  }, [marks]);

  // previews take ?marker= and ?doodle= so a variant can be linked to
  useEffect(() => {
    if (!picker) return;
    const q = new URLSearchParams(window.location.search);
    const m = q.get("marker");
    const d = q.get("doodle");
    if (m && (MARKERS as readonly string[]).includes(m)) setMarker(m as MarkerKind);
    if (d && (DOODLES as readonly string[]).includes(d)) setDoodle(d as DoodleKind);
  }, [picker]);

  useEffect(() => {
    document.documentElement.dataset.cursor = marker;
  }, [marker]);

  const choose = useCallback((key: "marker" | "doodle", value: string) => {
    if (key === "marker") setMarker(value as MarkerKind);
    else setDoodle(value as DoodleKind);
    const url = new URL(window.location.href);
    url.searchParams.set(key, value);
    window.history.replaceState(null, "", url);
  }, []);

  useEffect(() => {
    if (doodle === "off") return;
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const t = e.target as Element | null;
      if (!t || t.closest(INTERACTIVE)) return;
      if (document.documentElement.hasAttribute("data-sticker-edit")) return;
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return;
      const id = next.current++;
      // a ring is drawn round something, so it is drawn bigger
      const size = doodle === "circles" ? 90 + Math.random() * 40 : 54 + Math.random() * 30;
      const mark: Mark = {
        id,
        x: e.pageX,
        y: e.pageY,
        rot: (Math.random() - 0.5) * 30,
        size,
        width: (INK_WIDTH[marker] * 100) / size,
        ...(doodle === "words"
          ? { word: WORDS[id % WORDS.length] }
          : { strokes: (doodle === "circles" ? ring() : SHAPES[id % SHAPES.length]()).map(toPath) }),
        gone: false,
      };
      const live = marksRef.current.filter((k) => !k.gone);
      if (live.length >= MAX) {
        // the oldest fades out as the new one lands, then is dropped
        const oldest = live[0].id;
        setMarks((m) => [...m.map((k) => (k.id === oldest ? { ...k, gone: true } : k)), mark]);
        setTimeout(() => setMarks((m) => m.filter((k) => k.id !== oldest)), 700);
      } else {
        setMarks((m) => [...m, mark]);
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [doodle, marker]);

  return (
    <>
      <div aria-hidden className="doodle-layer">
        {marks.map((m) => (
          <Doodle key={m.id} mark={m} />
        ))}
      </div>
      {picker && (
        <div
          data-no-doodle
          className="fine fixed bottom-3 left-3 z-[200] flex flex-col gap-1 border border-acid bg-ground px-3 py-2 text-acid"
        >
          <Row label="marker" options={MARKERS} value={marker} onPick={(v) => choose("marker", v)} />
          <Row label="doodle" options={DOODLES} value={doodle} onPick={(v) => choose("doodle", v)} />
          <span className="text-ash normal-case">previews only · click the sheet to draw</span>
        </div>
      )}
    </>
  );
}

type Pt = [number, number];
type Mark = {
  id: number;
  x: number;
  y: number;
  rot: number;
  size: number;
  /** stroke width in the doodle's 100-unit box, for a fixed width on screen */
  width: number;
  strokes?: { d: string; len: number }[];
  word?: string;
  gone: boolean;
};

const MAX = 8;
const INTERACTIVE =
  "a, button, input, textarea, select, label, summary, [role='button'], [contenteditable], [data-no-doodle]";
// px on screen: a paint pen and a fibre tip draw a line, a highlighter a band
const INK_WIDTH: Record<MarkerKind, number> = { paint: 3, red: 3.4, highlighter: 9, off: 3.4 };
const WORDS = ["hi!", "nice", "yes!", "wow", "ok", "cool", "<3", "10/10"];

function Doodle({ mark }: { mark: Mark }) {
  const style = {
    left: mark.x,
    top: mark.y,
    "--rot": `${mark.rot.toFixed(1)}deg`,
  } as CSSProperties;
  const cls = `doodle${mark.gone ? " doodle-gone" : ""}`;
  if (mark.word) {
    return (
      <span className={`${cls} doodle-word`} style={style}>
        {mark.word}
      </span>
    );
  }
  // strokes are written one after another, each taking time for its length
  let delay = 0;
  return (
    <svg className={cls} style={style} width={mark.size} height={mark.size} viewBox="0 0 100 100">
      {mark.strokes!.map(({ d, len }, i) => {
        const dur = 90 + len * 2.2;
        const s = { animationDelay: `${delay}ms`, animationDuration: `${dur}ms` };
        delay += dur + 50;
        return <path key={i} d={d} pathLength={1} strokeWidth={mark.width} style={s} />;
      })}
    </svg>
  );
}

// --- doodles, in a 100-unit box, each built fresh from wobbly points --------

type Stroke = { pts: Pt[]; straight?: boolean };
const curve = (pts: Pt[]): Stroke => ({ pts });
const r = (a: number) => (Math.random() - 0.5) * a;
const wob = (p: Pt, a = 3): Pt => [p[0] + r(a), p[1] + r(a)];

/** a loose ring, like circling something, overshooting where it started */
function ring(): Stroke[] {
  const a0 = Math.random() * Math.PI * 2;
  const sweep = Math.PI * 2 + 0.4 + Math.random() * 0.6;
  const rx = 36 + r(6);
  const ry = rx * (0.72 + Math.random() * 0.25);
  const ph = Math.random() * 6;
  const pts: Pt[] = [];
  for (let i = 0; i <= 26; i++) {
    const t = a0 + (sweep * i) / 26;
    const k = 1 + 0.05 * Math.sin(2 * t + ph) + (i / 26) * 0.08;
    pts.push([50 + Math.cos(t) * rx * k, 50 + Math.sin(t) * ry * k]);
  }
  return [curve(pts)];
}

function star(): Stroke[] {
  const pts: Pt[] = [];
  const turn = r(0.4);
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI / 2 + turn + (i * Math.PI) / 5;
    const rad = i % 2 ? 17 : 40;
    pts.push(wob([50 + Math.cos(a) * rad, 52 + Math.sin(a) * rad], 4));
  }
  pts.push(wob(pts[1], 2));
  return [{ pts, straight: true }];
}

function heart(): Stroke[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= 30; i++) {
    const t = (i / 30) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    pts.push(wob([50 + x * 2.3, 46 - y * 2.3], 2));
  }
  pts.push(wob([pts[1][0] + 3, pts[1][1] + 2], 1));
  return [curve(pts)];
}

function tick(): Stroke[] {
  return [curve([wob([18, 54]), wob([30, 64], 2), wob([42, 78]), wob([60, 50], 2), wob([84, 20])])];
}

function cross(): Stroke[] {
  return [
    curve([wob([24, 24]), wob([50, 52], 3), wob([78, 78])]),
    curve([wob([78, 22]), wob([50, 50], 3), wob([22, 80])]),
  ];
}

function spiral(): Stroke[] {
  const pts: Pt[] = [];
  const a0 = Math.random() * 6;
  for (let i = 0; i <= 34; i++) {
    const t = (i / 34) * Math.PI * 4.4;
    const rad = 4 + t * 2.75;
    pts.push(wob([50 + Math.cos(t + a0) * rad, 50 + Math.sin(t + a0) * rad * 0.9], 1.5));
  }
  return [curve(pts)];
}

function arrow(): Stroke[] {
  const tip = wob([86, 34], 2);
  return [
    curve([wob([12, 78]), wob([36, 52], 4), wob([62, 40], 4), tip]),
    { pts: [wob([tip[0] - 18, tip[1] - 6], 2), tip, wob([tip[0] - 8, tip[1] + 16], 2)], straight: true },
  ];
}

/** a loopy underline, the way a pen fidgets */
function loops(): Stroke[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= 44; i++) {
    const t = (i / 44) * Math.PI * 2 * 3.2;
    pts.push(wob([10 + t * 3.9 - 9 * Math.sin(t), 56 + 13 * Math.cos(t) - t * 0.6], 1));
  }
  return [curve(pts)];
}

function smiley(): Stroke[] {
  const [face] = ring();
  return [
    face,
    curve([wob([38, 38], 2), wob([39, 45], 2)]),
    curve([wob([62, 38], 2), wob([61, 45], 2)]),
    curve([wob([32, 58], 2), wob([50, 72], 2), wob([68, 58], 2)]),
  ];
}

const SHAPES = [star, tick, heart, spiral, arrow, cross, loops, smiley];

/** a stroke to a path (a curve through its points, or straight runs) and its length */
function toPath({ pts, straight }: Stroke) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return { d: straight ? linePath(pts) : curvePath(pts), len };
}

const f = (n: number) => n.toFixed(1);

function linePath(pts: Pt[]) {
  return `M${pts.map((p) => `${f(p[0])} ${f(p[1])}`).join("L")}`;
}

function curvePath(pts: Pt[]) {
  // Catmull-Rom through the points, as cubic Beziers
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

function Row<T extends string>({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onPick: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <span className="text-ash">{label}</span>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={o === value}
          onClick={() => onPick(o)}
          className={o === value ? "underline underline-offset-4" : "opacity-60 hover:opacity-100"}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
