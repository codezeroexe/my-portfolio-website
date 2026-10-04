"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { Sticker } from "@/components/edges";
import type { FieldSticker } from "@/components/sticker-field";
import { SECTIONS, type Section } from "@/components/sticker-field";
import type {
  EditorCommand,
  EditorMessage,
  EditorState,
} from "@/components/sticker-tools";

/**
 * The placement editor.
 *
 * ## This is the part that used to be the field
 *
 * sticker-field.tsx drew the stickers and this file used to be the same
 * component, which meant the drag handlers, the sliders, the tray and the
 * autosave all shipped to every visitor. Split, the field is a server
 * component and this is the only part that costs anything — and it is gated
 * behind the ?stickers=1 URL flag (via EditGate) plus a next/dynamic
 * boundary, so ordinary visits never fetch it. Production saves stay
 * key-gated server-side regardless of what renders here.
 *
 * ## Which array it is editing
 *
 * Two sides (desktop, mobile — the layouts genuinely differ rather than merely
 * being different widths) times four sections (hero, projects, about, contact):
 * eight arrays, because x/y are percentages of the *section* the sticker sits
 * in. A section that grows or shrinks takes its stickers with it, so editing
 * the hero bio no longer drifts everything below it. The set is picked from
 * matchMedia for the side and from a prop for the section, so the editor always
 * agrees with which array the field behind it is actually rendering. All eight
 * arrays are held in state at once, so switching section or resizing across
 * the breakpoint mid-edit never throws away unsaved work.
 *
 * ## Save writes one side
 *
 * The save button posts all four sections of the side being edited, under its
 * own const name, and the route names the draft file after that. Saving desktop
 * cannot touch mobile — which is the whole reason for having two files rather
 * than one.
 *
 * ## Why it draws its own stickers
 *
 * The real field is static HTML now and this component cannot reach into it, so
 * it renders a second copy of the positions on top and the stylesheet hides the
 * real one while data-sticker-edit is set. Both are absolute inset-0 over the
 * same box, so they line up exactly.
 *
 * This component draws the overlay and nothing else. The tray and the control
 * bar belong to the viewport switcher, in the parent document: position: fixed
 * resolves against the frame's viewport, so chrome rendered in here sat on top
 * of the very page it was meant to decorate.
 */

const LG = "(min-width: 1024px)";

const storageKey = (side: string, section: string) =>
  `sticker-placements:${side}:${section}`;

/**
 * Document-space geometry snapshots, measured once and used only to migrate
 * pre-section localStorage entries (see below). Desktop at a 1994px window,
 * mobile at 390px. Section widths are the column minus its padding, which is
 * why x needs converting too rather than transferring 1:1.
 */
const LEGACY_GEO = {
  desktop: {
    H: 2643, colW: 1152, pad: 32, secW: 1088,
    secs: { hero: [0, 858], projects: [862, 1750], about: [1754, 2127], contact: [2131, 2471] },
  },
  mobile: {
    H: 3841, colW: 390, pad: 20, secW: 350,
    secs: { hero: [0, 1241], projects: [1245, 2885], about: [2889, 3303], contact: [3306, 3669] },
  },
} as const;

/** assign a document-space sticker to its section and re-express the coords */
const migrateLegacy = (
  arr: FieldSticker[],
  side: "desktop" | "mobile",
): Record<Section, FieldSticker[]> | null => {
  const g = LEGACY_GEO[side];
  const out: Record<Section, FieldSticker[]> = { hero: [], projects: [], about: [], contact: [] };
  for (const st of arr) {
    if (!validSticker(st)) return null;
    const px = (st.x / 100) * g.colW - g.pad;
    const py = (st.y / 100) * g.H;
    let best: Section = "hero";
    let bd = Infinity;
    for (const name of SECTIONS) {
      const [t0, t1] = g.secs[name];
      const d = py < t0 ? t0 - py : py > t1 ? py - t1 : 0;
      if (d < bd) {
        bd = d;
        best = name;
      }
    }
    const [t0, t1] = g.secs[best];
    out[best].push({
      ...st,
      x: Math.round(((px / g.secW) * 100) * 10) / 10,
      y: Math.round((((py - t0) / (t1 - t0)) * 100) * 10) / 10,
    });
  }
  return out;
};

/** shape check shared by the restore path and the legacy migration below */
const validSticker = (s: unknown): s is FieldSticker =>
  !!s &&
  typeof s === "object" &&
  typeof (s as FieldSticker).src === "string" &&
  ["size", "tilt", "x", "y"].every(
    (k) => typeof (s as Record<string, unknown>)[k] === "number",
  );

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round = (n: number) => Math.round(n * 10) / 10;

/** a drag rectangle, in percentages of the field */
type Band = { x0: number; y0: number; x1: number; y1: number };

type Sets = {
  desktop: Record<Section, FieldSticker[]>;
  mobile: Record<Section, FieldSticker[]>;
};
type Side = keyof Sets;

export function StickerEditor({
  desktop,
  mobile,
  section,
  live = false,
}: {
  desktop: Record<Section, FieldSticker[]>;
  mobile: Record<Section, FieldSticker[]>;
  /**
   * Which section's array this instance edits. Set by the viewport switcher
   * for the desktop copy. Unset inside the mobile preview's frame, which reads
   * it from the section flag in its own URL instead.
   */
  section?: Section;
  /**
   * Set by the viewport switcher when it portals this component into the real
   * page for the desktop view, which is the only editor that should be running
   * in that mode. Unset inside the mobile preview's frame, which identifies
   * itself by the frame flag in its own URL instead.
   */
  live?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [mount, setMount] = useState(false);
  const [side, setSide] = useState<Side>("desktop");
  const [sets, setSets] = useState<Sets>({ desktop, mobile });
  // dirty per side+section ("desktop:hero"), so the autosave above can flush a
  // section you already left and the switcher can show the active one
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  /**
   * Indices into the current side's array. Empty means nothing is selected.
   *
   * A list rather than a set because order carries meaning: the last entry is
   * the primary, and the primary is what the scale/rotate handles attach to.
   * Everything else — drag, layer step, front/back, delete — applies to the
   * whole list, which is the behaviour you want when nudging a word's worth of
   * letters at once.
   */
  const [sel, setSel] = useState<number[]>([]);
  const primary = sel.length ? sel[sel.length - 1] : null;
  // The framed copy reads its section from its own URL (?section=hero), which
  // the parent sets on the iframe. The desktop copy gets it as a prop.
  const urlSection =
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("section");
  const activeSection: Section =
    section ?? (SECTIONS.includes(urlSection as Section) ? (urlSection as Section) : "hero");
  // Indices are per-array, so a selection cannot survive a section switch.
  useEffect(() => {
    setSel([]);
  }, [activeSection]);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  /**
   * An in-progress move of one or more stickers.
   *
   * A snapshot of every selected position rather than a single anchor offset:
   * with several stickers held, each one has to move by the same delta the
   * pointer has travelled, and the only way to know that is to remember where
   * they all were when the drag started.
   */
  const drag = useRef<{
    px: number;
    py: number;
    snapshot: { i: number; x: number; y: number }[];
  } | null>(null);

  /** a rubber band, in field percentages like every other coordinate here */
  const [bandBox, setBandBox] = useState<Band | null>(null);
  /** one ref per sticker, so the gizmo can measure a real box for its handles */
  const stickerRefs = useRef<(HTMLDivElement | null)[]>([]);
  /** which handle is being dragged, and the numbers its gesture started from */
  const gizmo = useRef<{
    mode: "scale" | "rotate";
    i: number;
    cx: number;
    cy: number;
    startDist: number;
    startAngle: number;
    startSize: number;
    startTilt: number;
  } | null>(null);
  /** an in-progress rubber band, in field percentages like every other coord */
  const band = useRef<Band | null>(null);

  /** where the cursor last was over the page itself, not over the editor chrome */
  const atPointer = useRef<{ x: number; y: number } | null>(null);
  /** so a run of adds comes out at the same scale and angle until changed */
  const lastSize = useRef(100);
  const lastTilt = useRef(0);

  const items = sets[side][activeSection];
  const name = side === "desktop" ? "PLACEMENTS_DESKTOP" : "PLACEMENTS_MOBILE";
  const dkey = `${side}:${activeSection}`;


  // Edit mode is decided by URL alone, in every environment — the NODE_ENV
  // check that used to lead this condition is gone. Production saves stay
  // key-gated server-side; mounting the editor itself reveals nothing that
  // is not already on the page.
  useEffect(() => {
    // Framed only. The same page component mounts this in the parent too, and
    // the parent has nothing to edit — the frame is the one rendering the page
    // the stickers are measured against. Letting the parent's instance mount
    // would put a second overlay and a second set of window listeners behind
    // the switcher, which is invisible and pointless.
    if (
      (!framed && !live) ||
      !new URLSearchParams(window.location.search).has("stickers")
    ) {
      return;
    }
    setMount(true);
    document.documentElement.dataset.stickerEdit = activeSection;

    const mq = window.matchMedia(LG);
    const onChange = () => setSide(mq.matches ? "desktop" : "mobile");
    onChange();
    mq.addEventListener("change", onChange);

    // Restore unsaved work, all eight arrays. Without this, a refresh throws
    // away every placement and you are back to guessing — which is exactly how
    // a tab ends up disagreeing with another one.
    //
    // Also checks the pre-section key format (sticker-placements:NAME), once
    // per side and only when that side has no new-format keys yet. Those hold
    // document-anchored coordinates, so they go through the same section
    // assignment the migration used rather than being imported raw — raw would
    // silently misplace every sticker. The old key is deleted after a
    // successful migration so it can never shadow newer edits. Anything that
    // fails validation is left for the committed source to cover.
    // Read outside setState: updaters must stay pure (StrictMode
    // double-invokes them in dev), and storage reads are the opposite.
    try {
      const next: {
        desktop: Partial<Record<Section, FieldSticker[]>>;
        mobile: Partial<Record<Section, FieldSticker[]>>;
      } = { desktop: {}, mobile: {} };
      let touched = false;
      for (const sd of ["desktop", "mobile"] as const) {
        let hasNew = false;
        for (const sec of SECTIONS) {
          const raw = localStorage.getItem(storageKey(sd, sec));
          if (!raw) continue;
          const parsed = JSON.parse(raw) as unknown;
          if (!Array.isArray(parsed) || !parsed.length) continue;
          if (!parsed.every(validSticker)) continue;
          next[sd][sec] = parsed as FieldSticker[];
          hasNew = true;
          touched = true;
        }
        if (!hasNew) {
          // No new-format data for this side: try the pre-section key once.
          // Delete it after a successful migration so it can never shadow
          // newer edits on a later mount.
          const legacyName =
            sd === "desktop" ? "PLACEMENTS_DESKTOP" : "PLACEMENTS_MOBILE";
          const raw = localStorage.getItem(`sticker-placements:${legacyName}`);
          if (!raw) continue;
          try {
            const parsed = JSON.parse(raw) as unknown;
            if (!Array.isArray(parsed) || !parsed.length) continue;
            const migrated = migrateLegacy(parsed as FieldSticker[], sd);
            if (!migrated) continue;
            for (const sec of SECTIONS) {
              if (migrated[sec].length) next[sd][sec] = migrated[sec];
            }
            localStorage.removeItem(`sticker-placements:${legacyName}`);
            touched = true;
          } catch {
            // leave the old key alone rather than destroying work
          }
        }
      }
      if (touched) {
        setSets((prev) => ({
          desktop: { ...prev.desktop, ...next.desktop },
          mobile: { ...prev.mobile, ...next.mobile },
        }));
      }
    } catch {
      // private mode, quota, malformed json: the arrays in the source are still
      // the fallback, so there is nothing to recover from
    }

    // Track the cursor anywhere on the page so a newly added sticker can land
    // where you were looking instead of in a guessed spot. Positions over the
    // editor chrome are ignored, otherwise every add would spawn under the
    // tray you just clicked. pointerdown counts too, so a click with no
    // movement in between still updates the target.
    const track = (e: PointerEvent) => {
      const el = e.target as Element | null;
      if (el?.closest?.("[data-sticker-chrome]")) return;
      const r = box.current?.getBoundingClientRect();
      if (!r) return;
      atPointer.current = {
        x: ((e.clientX - r.left) / r.width) * 100,
        y: ((e.clientY - r.top) / r.height) * 100,
      };
    };
    window.addEventListener("pointermove", track);
    window.addEventListener("pointerdown", track);
    return () => {
      mq.removeEventListener("change", onChange);
      window.removeEventListener("pointermove", track);
      window.removeEventListener("pointerdown", track);
    };
    // mount once: the desktop/mobile arrays arrive as props and are only read
    // on the first pass, everything after that is local state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // autosave every dirty section, not just the visible one. Switching sections
  // must not orphan edits: the visible array changes, but the dirty flags for
  // the section you left are still set, so they get written here too.
  useEffect(() => {
    if (!mount) return;
    const keys = Object.keys(dirty).filter((k) => dirty[k]);
    if (!keys.length) return;
    try {
      for (const k of keys) {
        const [sd, sec] = k.split(":") as [Side, Section];
        localStorage.setItem(storageKey(sd, sec), JSON.stringify(sets[sd][sec]));
      }
      setDirty((prev) => {
        const next = { ...prev };
        for (const k of keys) next[k] = false;
        return next;
      });
    } catch {
      // nothing to do: the save button is still the way out
    }
  }, [sets, mount, dirty]);

  const write = (fn: (prev: FieldSticker[]) => FieldSticker[], keepSel = false) => {
    setSets((prev) => ({
      ...prev,
      [side]: { ...prev[side], [activeSection]: fn(prev[side][activeSection]) },
    }));
    setDirty((prev) => ({ ...prev, [dkey]: true }));
    if (!keepSel) setSel([]);
  };

  const onDown = (i: number) => (e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;

    if (additive) {
      if (sel.includes(i)) {
        // toggle off and stop there — starting a drag of a sticker you just
        // removed from the selection is not what anyone means by shift-click
        setSel(sel.filter((j) => j !== i));
        return;
      }
      setSel([...sel, i]);
    } else if (!sel.includes(i)) {
      setSel([i]);
    }

    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    const held = additive ? [...sel, i] : sel.includes(i) ? sel : [i];
    drag.current = {
      px: ((e.clientX - r.left) / r.width) * 100,
      py: ((e.clientY - r.top) / r.height) * 100,
      snapshot: held.map((j) => ({ i: j, x: items[j].x, y: items[j].y })),
    };
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const onMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    const r = box.current?.getBoundingClientRect();
    if (!d || !r) return;
    const dx = ((e.clientX - r.left) / r.width) * 100 - d.px;
    const dy = ((e.clientY - r.top) / r.height) * 100 - d.py;
    write((prev) => {
      const next = [...prev];
      for (const s of d.snapshot) {
        next[s.i] = {
          ...next[s.i],
          x: round(clamp(s.x + dx, -30, 130)),
          y: round(clamp(s.y + dy, -30, 130)),
        };
      }
      return next;
    }, true);
  };

  const patch = (i: number, p: Partial<FieldSticker>) => {
    if (p.size !== undefined) lastSize.current = p.size;
    if (p.tilt !== undefined) lastTilt.current = p.tilt;
    setSets((prev) => {
      const arr = prev[side][activeSection];
      const next = [...arr];
      next[i] = { ...next[i], ...p };
      return { ...prev, [side]: { ...prev[side], [activeSection]: next } };
    });
    setDirty((prev) => ({ ...prev, [dkey]: true }));
  };

  // the gizmo's pointermove is on window, so it outlives the render that
  // created it and would otherwise close over a stale patch
  const patchRef = useRef(patch);
  patchRef.current = patch;

  /**
   * Scale and rotate by dragging, not by slider.
   *
   * Both gestures are measured from the sticker's own centre, which is why each
   * selected sticker keeps a ref: the handles are positioned in CSS but the
   * arithmetic cannot be, because it needs a real viewport rect.
   *
   *   scale  — distance from centre to pointer, over the distance it started
   *            at. Ratio, not pixels, so it behaves the same at any zoom and
   *            across the em-vs-px mismatch in the size clamp below.
   *   rotate — angle from centre to pointer, offset by the angle the sticker
   *            started at. That offset is what makes it relative rather than
   *            absolute: grabbing the handle never snaps the sticker to zero.
   */
  const onHandleDown =
    (mode: "scale" | "rotate", i: number) => (e: ReactPointerEvent) => {
      // stopPropagation so the field's own onMove never sees this gesture
      e.preventDefault();
      e.stopPropagation();
      const r = stickerRefs.current[i]?.getBoundingClientRect();
      if (!r) return;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      gizmo.current = {
        mode,
        i,
        cx,
        cy,
        startDist: Math.hypot(e.clientX - cx, e.clientY - cy),
        startAngle: (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI,
        startSize: items[i].size,
        startTilt: items[i].tilt,
      };
      (e.target as Element).setPointerCapture(e.pointerId);
    };

  useEffect(() => {
    if (!mount) return;
    const move = (e: PointerEvent) => {
      const g = gizmo.current;
      if (!g) return;
      const dx = e.clientX - g.cx;
      const dy = e.clientY - g.cy;
      if (g.mode === "scale") {
        const d = Math.hypot(dx, dy);
        // a handle grabbed at distance zero would divide by zero; treat it as
        // "no scale change" rather than producing Infinity
        if (g.startDist < 1) return;
        patchRef.current(g.i, {
          size: Math.round(clamp(g.startSize * (d / g.startDist), 24, 800)),
        });
      } else {
        const a = (Math.atan2(dy, dx) * 180) / Math.PI;
        // wrapped into -180..180 so crossing the handle's own axis does not
        // spin the sticker through a full turn
        patchRef.current(g.i, {
          tilt: round(((a - g.startAngle + g.startTilt + 540) % 360) - 180),
        });
      }
    };
    const up = () => (gizmo.current = null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    // mount only: patchRef carries the live setter
  }, [mount]);

  /**
   * Layer order.
   *
   * Array order is the stacking order — the last item paints last, so it is on
   * top. No explicit z field, which means there is nothing to renumber and no
   * way for the order and a number to disagree.
   *
   * Steps move the sticker one place among its neighbours *in the same layer*.
   * Crossing in front of the page content is the separate front/back toggle,
   * because that is a different stacking context entirely and not a matter of
   * degree.
   */
  const step = (i: number, dir: 1 | -1) =>
    write((prev) => {
      const layer = prev[i].z ?? "front";
      const here = prev.findIndex((s, j) => j > i && (s.z ?? "front") === layer);
      const there = prev.findLastIndex((s, j) => j < i && (s.z ?? "front") === layer);
      const swap = dir === 1 ? here : there;
      if (swap < 0) return prev;
      const next = [...prev];
      [next[i], next[swap]] = [next[swap], next[i]];
      return next;
    }, true);

  const add = (src: string) => {
    // where the cursor last was over the page, so the sticker lands where you
    // were looking. No page position yet means the very first add, which goes
    // to the middle rather than to a corner.
    const at = atPointer.current ?? { x: 50, y: 40 };
    write((prev) => [
      ...prev,
      {
        src,
        size: lastSize.current,
        tilt: lastTilt.current,
        x: round(clamp(at.x, -30, 130)),
        y: round(clamp(at.y, -30, 130)),
      },
    ]);
    setSel([items.length]);
  };

  const literal = () => {
    const body = items
      .map(
        (s) =>
          `  { src: "${s.src}", size: ${Math.round(s.size)}, tilt: ${round(
            s.tilt,
          )}, x: ${round(s.x)}, y: ${round(s.y)}${
            s.z === "back" ? ', z: "back"' : ""
          } },`,
      )
      .join("\n");
    return `const ${name}_${activeSection.toUpperCase()}: FieldSticker[] = [\n${body}\n];`;
  };

  /**
   * Hand this set to the project.
   *
   * A browser cannot write to the repo, so this posts to a development-only
   * route that drops a draft file the build can be baked from. Only the array
   * being edited is sent: the other breakpoint's draft is a different file and
   * is not touched. It 404s in production.
   */
  const save = async () => {
    setSaved("saving…");
    try {
      // The key travels in the body, never in code: the editor is opened as
      // ?stickers=1&key=…, and the server compares it against EDIT_KEY. Absent
      // in dev, where the route skips the check; required in prod, where a
      // missing key comes back 401 and shows below verbatim.
      const key = new URLSearchParams(window.location.search).get("key") ?? "";
      const res = await fetch("/api/placements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, sections: sets[side], key }),
      });
      // read as text first, parse second. res.json() rejects with
      // "Unexpected end of JSON input" on an empty body, which is what an
      // unhandled 500 looks like from here — so a server-side failure used to
      // surface as a JSON parser error and say nothing about the real problem.
      const text = await res.text();
      let data: {
        ok?: boolean;
        file?: string;
        count?: number;
        commit?: string;
        note?: string;
        error?: string;
      } = {};
      try {
        if (text) data = JSON.parse(text);
      } catch {
        data = {};
      }
      setSaved(
        data.ok
          ? `${data.count} → ${data.commit ?? data.file}${data.note ? ` · ${data.note}` : ""}`
          : `failed: ${data.error ?? (text ? `HTTP ${res.status}` : `HTTP ${res.status} (empty body)`)}`,
      );
      if (data.ok)
        setDirty((prev) => {
          const next = { ...prev };
          for (const sec of SECTIONS) next[`${side}:${sec}`] = false;
          return next;
        });
    } catch (e) {
      setSaved(`failed: ${(e as Error).message}`);
    }
    setTimeout(() => setSaved(null), 6000);
  };

  const copy = () => {
    navigator.clipboard?.writeText(literal());
    // The localStorage entry is deliberately NOT removed. It used to be, on the
    // reasoning that the array was in the source by now — but that reasoning
    // assumes the save worked and the paste happened. Both are manual, and a
    // refresh between them silently destroyed the placement work. The browser
    // copy costs ~1kB and is the only thing standing between a failed save and
    // losing an afternoon.
    setDirty((prev) => ({ ...prev, [dkey]: false }));
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  /**
   * Inside the preview frame, or opened on its own.
   *
   * Framed is the normal case: the parent owns the chrome and this component
   * reports up, and in the desktop view that is this same window: the switcher
   * portals the editor in and listens for state here, then sends commands back
   * to the same listener. The mobile view is the frame case. Either way the
   * parent is the only thing that renders controls, because a fixed control bar
   * in here would land on top of the very page it is meant to decorate.
   */
  const framed = new URLSearchParams(
    typeof window === "undefined" ? "" : window.location.search,
  ).has("frame");

  const del = () => {
    if (!sel.length) return;
    write((prev) => prev.filter((_, j) => !sel.includes(j)));
    setSel([]);
  };

  /** every selected sticker gets front, or every one gets back */
  const setLayer = (z: "front" | "back") =>
    write((prev) => prev.map((s, i) => (sel.includes(i) ? { ...s, z } : s)), true);

  /**
   * Move the whole selection one place, outermost-first.
   *
   * Iterating high-to-low going down and low-to-high going up keeps the swaps
   * from treading on each other: two adjacent selected stickers both step down
   * and each still moves exactly one position rather than swapping with the
   * other and standing still.
   */
  const stepAll = (dir: 1 | -1) =>
    write((prev) => {
      const next = [...prev];
      const order = [...sel].sort((a, b) => (dir === 1 ? a - b : b - a));
      for (const i of order) {
        const layer = next[i].z ?? "front";
        const j =
          dir === 1
            ? next.findIndex((s, k) => k > i && (s.z ?? "front") === layer)
            : next.findLastIndex((s, k) => k < i && (s.z ?? "front") === layer);
        if (j < 0) continue;
        [next[i], next[j]] = [next[j], next[i]];
      }
      return next;
    }, true);

  /** the parent posts intent; these are the live versions of the handlers */
  const api = useRef({ add, patch, stepAll, setLayer, del, save, copy, primary });
  api.current = { add, patch, stepAll, setLayer, del, save, copy, primary };

  // Report up on every change. Cheap enough for a dev tool, and it means the
  // parent never has to guess whether it is looking at stale state.
  //
  // Gated on mounted, not on framed, and this one mattered just as much as the
  // command listener: with `framed` here too, the desktop editor posted nothing,
  // so the control panel sat showing "save —" with no counts and no selected
  // sticker, and every button it renders was dead because none of them could
  // reach an editor. Both halves of the bridge were gated on the old
  // iframe-only assumption.
  useEffect(() => {
    if (!mount) return;
    const msg: EditorMessage = {
      t: "state",
      state: {
        name,
        side,
        section: activeSection,
        items,
        sel,
        dirty: dirty[dkey] ?? false,
        saved,
        copied,
      },
    };
    // Posts to window.parent either way. In the frame that is the switcher; in
    // the portaled desktop editor it is this same window, so the message comes
    // straight back to the switcher's listener either way. One code path.
    window.parent.postMessage(msg, window.location.origin);
  }, [mount, name, side, activeSection, items, sel, dirty, saved, copied]);

  /**
   * Rubber-band selection.
   *
   * Listens on window rather than on the field, because the field is
   * pointer-events: none — that is what lets a click fall through to a panel or
   * a link underneath, and it means empty space never targets it. A sticker and
   * a handle both call stopPropagation, so anything that does reach this
   * listener started on empty page, which is exactly the gesture that should
   * mean "select a region".
   *
   * A drag under four pixels is treated as a plain click and clears the
   * selection instead, so deselecting does not need a second gesture.
   *
   * Hit testing uses a square of side `size` centred on each sticker rather
   * than its real bounds. The rendered height depends on each image's aspect
   * ratio, which is not known without loading every asset, and a lasso drawn by
   * hand does not need pixel-exact edges to be useful.
   */
  useEffect(() => {
    if (!mount) return;

    const at = (e: PointerEvent) => {
      const r = box.current?.getBoundingClientRect();
      if (!r) return null;
      return {
        x: ((e.clientX - r.left) / r.width) * 100,
        y: ((e.clientY - r.top) / r.height) * 100,
      };
    };

    const down = (e: PointerEvent) => {
      const el = e.target as Element | null;
      if (el?.closest?.("[data-sticker-chrome]")) return;
      if (el?.closest?.("[data-sticker-editor]")) return;
      if (e.button !== 0) return;
      const p = at(e);
      if (!p) return;
      band.current = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
    };

    const move = (e: PointerEvent) => {
      // check for a gesture before measuring. at() reads a rect, and doing that
      // on every mouse move anywhere on the page is a forced layout for
      // something that is idle almost all the time.
      const b = band.current;
      if (!b) return;
      const p = at(e);
      if (!p) return;
      b.x1 = p.x;
      b.y1 = p.y;
      setBandBox({ ...b });
    };

    const up = () => {
      const b = band.current;
      band.current = null;
      setBandBox(null);
      if (!b) return;
      const w = Math.abs(b.x1 - b.x0);
      const h = Math.abs(b.y1 - b.y0);
      if (w < 1 && h < 1) {
        setSel([]);
        return;
      }
      const x0 = Math.min(b.x0, b.x1);
      const x1 = Math.max(b.x0, b.x1);
      const y0 = Math.min(b.y0, b.y1);
      const y1 = Math.max(b.y0, b.y1);
      const r = box.current?.getBoundingClientRect();
      if (!r) return;
      const inside = items
        .map((s, i) => {
          const hw = (s.size / 2 / r.width) * 100;
          const hh = (s.size / 2 / r.height) * 100;
          return s.x + hw >= x0 && s.x - hw <= x1 && s.y + hh >= y0 && s.y - hh <= y1
            ? i
            : -1;
        })
        .filter((i) => i >= 0);
      // the last one caught becomes the primary, which is the one the handles
      // attach to — so lassoing right-to-left grabs the handle on the last
      // sticker the band crossed, which is the one you can see you finished on
      setSel(inside);
    };

    window.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    // items/box are read fresh on every gesture via refs and this closure is
    // re-created whenever the array identity changes, which is on every edit
  }, [mount, items, setSel]);

  useEffect(() => {
    // Gated on mounted, not on framed. It used to be `if (!framed) return`,
    // which was correct when the switcher's iframe was the only way to reach an
    // editor — but the desktop editor is now portaled into this same window with
    // `live`, so `framed` was false in the default view and every button in the
    // control rail was posting into a void. The switcher is the only thing that
    // sends commands and it only exists alongside a mounted editor, so mounted
    // is the real precondition.
    if (!mount) return;
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const c = e.data as EditorCommand | undefined;
      if (!c || typeof c.t !== "string") return;
      const a = api.current;
      if (c.t === "add") a.add(c.src);
      if (c.t === "patch" && a.primary !== null) a.patch(a.primary, c.p);
      if (c.t === "layer") a.setLayer(c.z);
      if (c.t === "step") a.stepAll(c.dir);
      if (c.t === "del") a.del();
      if (c.t === "save") a.save();
      if (c.t === "copy") a.copy();
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [mount]);

  // Portal target: the active section's host, so the overlay is measured
  // against that section's box at the real width. One host per section;
  // switching sections re-portals without remounting, which keeps the other
  // sections' unsaved edits in state.
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setHost(
      document.querySelector<HTMLElement>(`[data-editor-host="${activeSection}"]`),
    );
  }, [activeSection, mount]);

  if (!mount) return null;
  if (!host) return null;

  return createPortal(
    <div
      ref={box}
      aria-hidden
      data-sticker-editor
      onPointerMove={onMove}
      onPointerUp={() => (drag.current = null)}
      onPointerLeave={() => (drag.current = null)}
      className="pointer-events-none absolute inset-0"
    >
        {/* the rubber band itself */}
        {bandBox && (
          <span
            aria-hidden
            className="pointer-events-none absolute border border-dashed border-acid bg-acid/10"
            style={{
              left: `${Math.min(bandBox.x0, bandBox.x1)}%`,
              top: `${Math.min(bandBox.y0, bandBox.y1)}%`,
              width: `${Math.abs(bandBox.x1 - bandBox.x0)}%`,
              height: `${Math.abs(bandBox.y1 - bandBox.y0)}%`,
            }}
          />
        )}

        {(["back", "front"] as const).map((layer) => (
          <div
            key={layer}
            className={`absolute inset-0 ${layer === "front" ? "z-20" : "-z-[5]"}`}
          >
            {items.map((s, i) =>
              (s.z ?? "front") === layer ? (
                <div
                  key={`${s.src}-${i}`}
                  ref={(el) => {
                    stickerRefs.current[i] = el;
                  }}
                  onPointerDown={onDown(i)}
                  title={`${s.src} — drag to move`}
                  className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 ${
                    sel.includes(i) ? "" : "cursor-grab active:cursor-grabbing"
                  }`}
                  style={{ left: `${s.x}%`, top: `${s.y}%` }}
                >
                  <Sticker src={s.src} alt="" size={s.size} tilt={s.tilt} />

                  {sel.includes(i) && (
                    <>
                      {/* The selection ring. Note it is axis-aligned, not the sticker's own
                          outline: .sticker rotates the inner img about its
                          centre, and the wrapper stays the unrotated
                          rectangle, so this traces the pre-rotation box and
                          under-covers at the corners of a tilted sticker. Left
                          that way on purpose — rotating the gizmo with the
                          object would rotate its hit area too, and dragging
                          from a handle that swings around is worse than a ring
                          that does not hug the glyphs. The handles below are
                          axis-aligned for the same reason. */}
                      <span className="pointer-events-none absolute inset-0 -m-3 border-2 border-dashed border-acid" />

                      {/* Handles hang off the primary only. Scaling or rotating
                          a handful of stickers at once has no single obvious
                          answer — scale from which edge, rotate about which
                          centre — so one at a time is the honest default.
                          Everything that *is* unambiguous across a selection
                          (move, layer step, front/back, delete) works on all
                          of them. */}

                      {primary === i && (
                        <>
                          {/* rotate: a stem off the top with a knob on the end,
                              set far enough out that the arc you sweep is
                              unambiguous. */}
                      <span
                        data-sticker-chrome
                        className="pointer-events-auto absolute left-1/2 -top-11 flex -translate-x-1/2 flex-col items-center"
                      >
                        <span className="h-8 w-px bg-acid" />
                        <button
                          type="button"
                          aria-label="rotate"
                          onPointerDown={onHandleDown("rotate", i)}
                          className="h-4 w-4 -translate-y-1/2 cursor-grab rounded-full border-2 border-acid bg-ground hover:bg-acid active:cursor-grabbing"
                        />
                      </span>

                      {/* scale: bottom-right corner, the usual place. Distance
                          from centre does the work, so it scales on any drag
                          direction rather than only on the diagonal. */}
                      <button
                        type="button"
                        aria-label="scale"
                        data-sticker-chrome
                        onPointerDown={onHandleDown("scale", i)}
                        className="pointer-events-auto absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-sm border-2 border-acid bg-ground hover:bg-acid"
                      />
                      </>
                    )}
                  </>
                )}
              </div>
            ) : null,
            )}
          </div>
        ))}
    </div>,
    host,
  );
}