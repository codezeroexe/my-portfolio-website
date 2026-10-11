// The small extras: a marker pen for a cursor, and a click makes it draw a
// quick doodle on the sheet in its own ink. Kept apart from the client
// component so the layout (a server component) can read the defaults as plain
// values; exports of a "use client" module reach a server component as
// references, not values.

export const MARKERS = ["paint", "red", "highlighter", "off"] as const;
export const DOODLES = ["mixed", "circles", "words", "off"] as const;
export type MarkerKind = (typeof MARKERS)[number];
export type DoodleKind = (typeof DOODLES)[number];

export const DEFAULT_MARKER: MarkerKind = "red";
export const DEFAULT_DOODLE: DoodleKind = "mixed";
