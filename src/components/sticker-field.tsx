import { Sticker } from "@/components/edges";

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
 * The field width, in CSS px, that each placement set was composed at: the
 * column at a 1440 window for desktop, the column at the editor's 500px
 * mobile preview for mobile. A sticker's `size` is pixels at this width.
 */
export const DESIGN_WIDTH = { desktop: 1088, mobile: 460 } as const;
export type Layout = keyof typeof DESIGN_WIDTH;

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
 * ## Sizes scale with the field, like positions do
 *
 * `size` used to be fixed pixels while x/y were percentages, so a narrower
 * column (desktop between 1024 and ~1150, phones under 500) pulled stickers
 * closer together without shrinking them, and composed groups crushed into
 * each other; a wider one (the mobile set on a tablet) pushed them apart. The
 * field is now a size container and each sticker's width is `size` as a
 * fraction of DESIGN_WIDTH in cqw, so the whole composition scales as one
 * picture. At the composition width nothing changes.
 *
 * ## The layer is pointer-events: none
 *
 * So it never eats a click meant for a panel, a link or a line of copy. Only
 * the editor's own copies of these positions become interactive.
 */
export function StickerField({
  stickers,
  section,
  layout,
  className = "",
}: {
  stickers: FieldSticker[];
  /** which section this field belongs to; rendered as data-section */
  section: string;
  /** which placement set this is, for the width its sizes were composed at */
  layout: Layout;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      data-sticker-field
      data-section={section}
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{ containerType: "inline-size" }}
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
                <Sticker
                  src={s.src}
                  alt=""
                  size={s.size}
                  tilt={s.tilt}
                  style={{ width: `calc(${s.size} * 100cqw / ${DESIGN_WIDTH[layout]})` }}
                />
              </div>
            ) : null,
          )}
        </div>
      ))}
    </div>
  );
}