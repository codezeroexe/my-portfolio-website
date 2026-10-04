import { readFileSync } from "node:fs";
import path from "node:path";
import {
  SECTIONS,
  type FieldSticker,
  type Section,
  type SectionPlacements,
} from "@/components/sticker-field";

// Re-exported so existing import sites keep working; the field module owns them
// because it has no node imports and is safe to bundle into client code, which
// this file is not (readFileSync).
export type { Section, SectionPlacements };

/**
 * Placements, one array per section per breakpoint.
 *
 * x/y are percentages of the *section* the sticker sits in — hero, projects,
 * about, contact — not of the document. A section that grows or shrinks takes
 * its stickers with it, so editing the hero bio no longer drifts everything
 * below it. That is the whole reason for the shape: the document-anchored
 * version before it made every content edit a full-page re-tune.
 *
 * This used to be one array per breakpoint measured against <main>. The
 * per-section values were converted mechanically from those (assign each
 * sticker to the section its centre sat in, re-express the coordinates) and
 * verified pixel-identical before the old arrays were removed.
 */

const empty = (): SectionPlacements => ({ hero: [], projects: [], about: [], contact: [] });

/**
 * The committed placements, and the only thing production renders.
 *
 * The data lives in `./data/placements.json`, shaped
 * `{ desktop: SectionPlacements, mobile: SectionPlacements }` — that file's
 * shape is the contract, because the save route rewrites it through the
 * GitHub API in production (see route.ts). Keep the two in sync by editing
 * the JSON, never this file.
 *
 * JSON rather than TS literals for exactly that reason: the route can
 * serialise an object straight to the file, while TS source would need a
 * code printer. Imported at build time, so the page stays fully static.
 */
import placementData from "../data/placements.json";

export const PLACEMENTS_DESKTOP = placementData.desktop as SectionPlacements;
export const PLACEMENTS_MOBILE = placementData.mobile as SectionPlacements;

/** One draft file per array. Two arrays, one per breakpoint. */
export const draftFile = (name: string) => `placements.${name}.draft.json`;

/**
 * The saved placements for one breakpoint, or null if there is no usable draft.
 *
 * The draft carries all four sections under `sections`. Returns null rather
 * than empty arrays so the caller can fall back to the baked arrays — an empty
 * draft is a real state (you deleted everything) and must not be confused
 * with no draft at all.
 *
 * Dev only, deliberately. A draft is a working file: it can be half-edited,
 * stale, or missing. Production reads committed source and nothing else.
 *
 * The shape check is light on purpose. The route already validated every field
 * on the way in, so the only realistic corruption is a hand-edit, and the aim
 * is to degrade to "no draft" rather than to render a sticker with an undefined
 * src.
 */
export function readDraft(name: string): SectionPlacements | null {
  if (process.env.NODE_ENV === "production") return null;
  try {
    const raw = readFileSync(path.join(process.cwd(), draftFile(name)), "utf8");
    const parsed = JSON.parse(raw) as { sections?: unknown };
    if (!parsed.sections || typeof parsed.sections !== "object") return null;
    const out = empty();
    for (const key of SECTIONS) {
      const arr = (parsed.sections as Record<string, unknown>)[key];
      if (!Array.isArray(arr)) return null;
      const ok = arr.every(
        (s) =>
          s &&
          typeof s === "object" &&
          typeof (s as FieldSticker).src === "string" &&
          [ "size", "tilt", "x", "y" ].every(
            (k) => typeof (s as Record<string, unknown>)[k] === "number",
          ),
      );
      if (!ok) return null;
      out[key] = arr as FieldSticker[];
    }
    return out;
  } catch {
    // no draft yet, which is the normal case on a fresh checkout
    return null;
  }
}