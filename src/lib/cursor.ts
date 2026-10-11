// The marker-pen cursor. Kept apart from the picker so the layout (a server
// component) can read the default as a plain value; exports of a "use client"
// module reach a server component as references, not values.

export const MARKERS = ["paint", "red", "highlighter", "off"] as const;
export type MarkerKind = (typeof MARKERS)[number];

export const DEFAULT_MARKER: MarkerKind = "red";
