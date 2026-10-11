// The custom cursor: a hand, drawn as a die-cut sticker. Kept apart from the
// components so the layout (a server component) can read the defaults as
// plain values; exports of a "use client" module reach a server component as
// references, not values.

/** the line hand, and the same hand as pixel art with small, medium and big
    pixels (1, 1.5 and 2 css px each) */
export const HANDS = ["pixel-s", "pixel-m", "pixel-l", "line", "off"] as const;
export type Hand = (typeof HANDS)[number];

/** what the hand turns into over text: a writing hand, an I-beam, or nothing */
export const TEXT_CURSORS = ["pen", "beam", "off"] as const;
export type TextCursor = (typeof TEXT_CURSORS)[number];

export type HandState = "point" | "link" | "press" | "pen" | "beam";

export type CursorSettings = {
  hand: Hand;
  text: TextCursor;
  /** a strip of tape beside the hand over links, saying what a click does */
  label: boolean;
  /** the page draws the hand so it can swing as it moves (cursor-fx.tsx) */
  swing: boolean;
};

export const DEFAULT_CURSOR: CursorSettings = {
  hand: "pixel-m",
  text: "pen",
  label: false,
  swing: false,
};

/** each image's hotspot, [x, y] in px: the fingertip, the pen or pencil
    point, the middle of the I-beam. The CSS in globals.css carries the same
    numbers. */
export const HOTSPOTS: Record<Exclude<Hand, "off">, Record<HandState, [number, number]>> = {
  "pixel-s": { point: [13, 5], link: [13, 5], press: [13, 5], pen: [1, 30], beam: [15, 16] },
  "pixel-m": { point: [12, 3], link: [12, 3], press: [12, 5], pen: [2, 29], beam: [15, 15] },
  "pixel-l": { point: [15, 5], link: [15, 5], press: [15, 5], pen: [3, 29], beam: [15, 17] },
  line: { point: [7, 5], link: [7, 5], press: [9, 9], pen: [4, 28], beam: [16, 16] },
};
