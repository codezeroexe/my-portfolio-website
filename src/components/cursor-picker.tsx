"use client";

import { useEffect, useState } from "react";
import { CURSORS, DEFAULT_CURSOR, type CursorKind } from "@/lib/cursor";

/**
 * Previews only: a small panel to try the cursors, also linkable as
 * ?cursor=. The cursor itself is CSS (globals.css, html[data-cursor]); the
 * layout sets the default on <html>, and this only swaps the attribute.
 */
export function CursorPicker() {
  const [cursor, setCursor] = useState<CursorKind>(DEFAULT_CURSOR);

  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get("cursor");
    if (m && (CURSORS as readonly string[]).includes(m)) setCursor(m as CursorKind);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.cursor = cursor;
  }, [cursor]);

  const pick = (m: CursorKind) => {
    setCursor(m);
    const url = new URL(window.location.href);
    url.searchParams.set("cursor", m);
    window.history.replaceState(null, "", url);
  };

  return (
    <div className="fine fixed bottom-3 left-3 z-[200] flex flex-wrap items-baseline gap-x-2 border border-acid bg-ground px-3 py-2 text-acid">
      <span className="text-ash">cursor</span>
      {CURSORS.map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={m === cursor}
          onClick={() => pick(m)}
          className={m === cursor ? "underline underline-offset-4" : "opacity-60 hover:opacity-100"}
        >
          {m}
        </button>
      ))}
      <span className="text-ash normal-case">previews only</span>
    </div>
  );
}
