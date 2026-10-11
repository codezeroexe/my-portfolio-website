// The custom cursor. Kept apart from the picker so the layout (a server
// component) can read the default as a plain value; exports of a "use client"
// module reach a server component as references, not values.

export const CURSORS = ["arrow", "marker", "hand", "scissors", "bolt", "off"] as const;
export type CursorKind = (typeof CURSORS)[number];

export const DEFAULT_CURSOR: CursorKind = "arrow";
