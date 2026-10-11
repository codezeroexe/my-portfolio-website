import { Sticker, type Peel } from "@/components/edges";

/**
 * Stickers whose corner has come unstuck: the corner, then how far it is
 * lifted at rest and when the hand touches it, as a fraction of the sticker's
 * width. Picked from each image's outline so the fold catches the sticker
 * itself, not the empty corner of its box (round ones need a deeper fold).
 */
const PEELS: Record<string, [Peel["corner"], number, number]> = {
  "/stickers/parental-advisory.webp": ["tl", 0.115, 0.255],
  "/stickers/acdc.webp": ["bl", 0.13, 0.235],
  "/stickers/call-me.webp": ["bl", 0.165, 0.24],
  "/stickers/new-york.webp": ["tl", 0.335, 0.43],
  "/stickers/stussy.webp": ["tr", 0.3, 0.395],
  "/stickers/island.webp": ["tr", 0.33, 0.42],
  "/stickers/bam-bam.webp": ["br", 0.21, 0.33],
  "/stickers/avengers-assemble.webp": ["tr", 0.14, 0.22],
};

const peelFor = (src: string, size: number): Peel | undefined => {
  const p = PEELS[src];
  return p && { corner: p[0], rest: p[1] * size, lift: p[2] * size };
};

/** the four sections a sticker can belong to; x/y are percentages of it */
export type Section = "hero" | "projects" | "about" | "contact";
export const SECTIONS: Section[] = ["hero", "projects", "about", "contact"];
export type SectionPlacements = Record<Section, FieldSticker[]>;

export type FieldSticker = {
  src: string;
  /** centre point, as a percentage of the field */
  x: number;
  y: number;
  size: number;
  /** degrees, positive clockwise. The full circle is available. */
  tilt: number;
  /**
   * Which side of the page content this sticker is stuck to.
   *
   * "front" (the default) prints it over everything — over panels, over
   * headings, over copy. "back" tucks it behind the content, so it reads as
   * part of the sheet rather than as something lying on top of it.
   */
  z?: "front" | "back";
};

/**
 * Every sticker on the page, in one overlay across the whole document.
 *
 * ## This is a server component and it stays that way
 *
 * It used to be the placement editor as well as the thing that draws the
 * stickers, which meant the whole thing shipped `"use client"` and React
 * hydrated all of it for every visitor — several hundred lines of drag
 * handlers and slider state that a production build cannot even enter. Drawing
 * stickers needs none of that, so the drawing lives here, the dragging lives in
 * sticker-editor.tsx, and this file renders to plain HTML.
 *
 * ## Coordinates are anchored to the text, not the window
 *
 * The field is a child of .page-content, so inset-0 resolves against the
 * max-w-6xl column rather than against <main>. x is therefore a percentage of
 * the column and a sticker keeps the same distance from the words at every
 * window width. Anchored to the window instead, the margin stickers drifted
 * further out as the window grew — 270px of nothing between sticker and text on
 * a 1920 screen, because the column stopped at 1152 and x: 94 kept meaning 94%
 * of the whole window.
 *
 * Values are not clamped to 0..100. Negative x and x > 100 hang a sticker
 * outside the column, into the page margin, which is the way to get the
 * floating-in-the-margin look back on a wide screen once the anchor moved.
 *
 * ## Why one overlay over everything
 *
 * This used to be four fields, one per section, each clipped to its own box and
 * each clamping its stickers to stay inside. That put a hard ceiling on where a
 * sticker could go: nothing could cross a section boundary, and anything near
 * an edge was cut in half. There was no reason for the ceiling — a sticker is a
 * sticker, and it belongs on top of whatever it lands on.
 *
 * x and y are percentages rather than pixels, so a placement survives a resize,
 * a zoom, and a phone because everything scales together rather than because
 * anything was measured.
 *
 * ## The layer is pointer-events: none
 *
 * So it never eats a click meant for a panel, a link or a line of copy. Only
 * the editor's own copies of these positions become interactive.
 */
export function StickerField({
  stickers,
  section,
  className = "",
}: {
  stickers: FieldSticker[];
  /** which section this field belongs to; rendered as data-section */
  section: string;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      data-sticker-field
      data-section={section}
      className={`pointer-events-none absolute inset-0 ${className}`}
    >
      {(["back", "front"] as const).map((layer) => (
        <div
          key={layer}
          className={`absolute inset-0 ${layer === "front" ? "z-20" : "-z-[5]"}`}
        >
          {stickers.map((s, i) =>
            (s.z ?? "front") === layer ? (
              <div
                key={`${s.src}-${i}`}
                style={{ left: `${s.x}%`, top: `${s.y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2"
              >
                <Sticker src={s.src} alt="" size={s.size} tilt={s.tilt} peel={peelFor(s.src, s.size)} />
              </div>
            ) : null,
          )}
        </div>
      ))}
    </div>
  );
}