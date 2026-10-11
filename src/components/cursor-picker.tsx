"use client";

import { useEffect, useState } from "react";
import { DEFAULT_MARKER, MARKERS, type MarkerKind } from "@/lib/cursor";

/**
 * Previews only: a small panel to try the marker cursors, also linkable as
 * ?marker=. The cursor itself is CSS (globals.css, html[data-cursor]); the
 * layout sets the default on <html>, and this only swaps the attribute.
 */
export function CursorPicker() {
  const [marker, setMarker] = useState<MarkerKind>(DEFAULT_MARKER);

  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get("marker");
    if (m && (MARKERS as readonly string[]).includes(m)) setMarker(m as MarkerKind);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.cursor = marker;
  }, [marker]);

  const pick = (m: MarkerKind) => {
    setMarker(m);
    const url = new URL(window.location.href);
    url.searchParams.set("marker", m);
    window.history.replaceState(null, "", url);
  };

  return (
    <div className="fine fixed bottom-3 left-3 z-[200] flex flex-wrap items-baseline gap-x-2 border border-acid bg-ground px-3 py-2 text-acid">
      <span className="text-ash">marker</span>
      {MARKERS.map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={m === marker}
          onClick={() => pick(m)}
          className={m === marker ? "underline underline-offset-4" : "opacity-60 hover:opacity-100"}
        >
          {m}
        </button>
      ))}
      <span className="text-ash normal-case">previews only</span>
    </div>
  );
}
