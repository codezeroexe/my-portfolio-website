"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

/**
 * Load boundaries for the two development-only sticker tools.
 *
 * ## Why this file exists
 *
 * Both tools are gated on NODE_ENV, which sounds like it would be enough. It is
 * not: `process.env.NODE_ENV !== "production"` folds to `false` at build time,
 * so React never *renders* the editor — but a plain `import` still puts the
 * module in the client graph, and the chunk came out referenced by index.html,
 * which means real visitors were downloading 8.5kB of drag handlers they can
 * never enter.
 *
 * Being folded away is not the same as not being shipped. A dynamic import is:
 * the module lands in a chunk that nothing references until the import actually
 * runs, and the import only runs when one of these renders — which is `?stickers=1`
 * in development and never otherwise.
 *
 * ssr: false so nothing preloads the chunk on a server render. That is only
 * legal inside a client component, which is the whole reason this wrapper is a
 * client file rather than two `dynamic()` calls in page.tsx.
 */

/**
 * The tray's two levels: category, then sub-group. Only letters have
 * sub-groups, one folder per letter, so the tray can offer A-Z rather than
 * dumping every letter of the alphabet into one flat scroll. Everything else
 * uses a single unnamed group, which keeps the shape uniform instead of
 * special-casing one branch. Declared here rather than in either consumer so
 * there is one definition.
 */
export type TrayAssets = Record<string, Record<string, string[]>>;

/**
 * The editor runs inside the preview frame so its drag coordinates are
 * measured against the real layout at that width, but the chrome has to render
 * in the parent — inside the frame, `position: fixed` resolves against the
 * frame's viewport, so a fixed tray would sit on top of the 1088px page it is
 * meant to decorate. The parent has whole black columns either side of the
 * frame; that is where the chrome belongs.
 *
 * So the two halves talk over postMessage. The parent sends intent and the
 * editor reports state back, which keeps the reducer in one place: the parent
 * never mutates the placements itself, it just renders whatever it was last
 * told. Same-origin only, and the origin is checked on both ends.
 */
export type EditorState = {
  name: string;
  side: "desktop" | "mobile";
  section: import("@/lib/placements").Section;
  items: import("@/components/sticker-field").FieldSticker[];
  sel: number[];
  dirty: boolean;
  saved: string | null;
  copied: boolean;
};

export type EditorCommand =
  | { t: "add"; src: string }
  | { t: "patch"; p: Partial<EditorState["items"][number]> }
  | { t: "step"; dir: 1 | -1 }
  | { t: "layer"; z: "front" | "back" }
  | { t: "del" }
  | { t: "save" }
  | { t: "copy" };

export type EditorMessage = { t: "state"; state: EditorState };

export const StickerEditorSlot = dynamic(
  () => import("@/components/sticker-editor").then((m) => m.StickerEditor),
  { ssr: false },
);

export const ViewportSwitcherSlot = dynamic(
  () => import("@/components/viewport-switcher").then((m) => m.ViewportSwitcher),
  { ssr: false },
);

/**
 * Runtime gate for the editor slots. page.tsx renders the slots
 * unconditionally inside this, and it renders null — fetching nothing,
 * mounting nothing — unless the URL carries ?stickers=1.
 *
 * This replaced a build-time `DEV` fold, which kept the editor out of
 * production entirely. The editor now has to exist on the deployment, so the
 * decision moved to runtime. The dynamic boundaries above still hold: the
 * chunks are separate files the browser only requests when this renders them,
 * so ordinary visitors download nothing extra. The save endpoint stays
 * key-gated server-side regardless of what renders here — this controls
 * visibility, not authority.
 */
export function EditGate({ children }: { children: React.ReactNode }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(new URLSearchParams(window.location.search).has("stickers"));
  }, []);
  if (!on) return null;
  return <>{children}</>;
}