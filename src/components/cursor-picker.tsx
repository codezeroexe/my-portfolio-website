"use client";

import { useEffect, useState } from "react";
import { DEFAULT_CURSOR, HANDS, TEXT_CURSORS } from "@/lib/cursor";

const ROWS = [
  { key: "hand", attr: "cursor", options: HANDS },
  { key: "text", attr: "cursorText", options: TEXT_CURSORS },
  { key: "label", attr: "cursorLabel", options: ["on", "off"] },
  { key: "swing", attr: "cursorSwing", options: ["on", "off"] },
] as const;

type Key = (typeof ROWS)[number]["key"];

const start: Record<Key, string> = {
  hand: DEFAULT_CURSOR.hand,
  text: DEFAULT_CURSOR.text,
  label: DEFAULT_CURSOR.label ? "on" : "off",
  swing: DEFAULT_CURSOR.swing ? "on" : "off",
};

/**
 * Previews only: a small panel to try the hands and what they do, also
 * linkable as ?hand=&text=&label=&swing=. The cursor itself is CSS
 * (globals.css, html[data-cursor]) plus cursor-fx.tsx for the label and the
 * swing; the layout sets the defaults on <html>, and this only swaps the
 * attributes.
 */
export function CursorPicker() {
  const [picked, setPicked] = useState(start);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const next = { ...start };
    for (const row of ROWS) {
      const v = q.get(row.key);
      if (v && (row.options as readonly string[]).includes(v)) next[row.key] = v;
    }
    setPicked(next);
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    for (const row of ROWS) html.dataset[row.attr] = picked[row.key];
  }, [picked]);

  const pick = (key: Key, v: string) => {
    setPicked((p) => ({ ...p, [key]: v }));
    const url = new URL(window.location.href);
    url.searchParams.set(key, v);
    window.history.replaceState(null, "", url);
  };

  return (
    <div className="fine fixed bottom-3 left-3 z-[200] grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 border border-acid bg-ground px-3 py-2 text-acid">
      {ROWS.map((row) => (
        <div key={row.key} className="contents">
          <span className="text-ash">{row.key}</span>
          <span className="flex flex-wrap gap-x-2">
            {row.options.map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={v === picked[row.key]}
                onClick={() => pick(row.key, v)}
                className={v === picked[row.key] ? "underline underline-offset-4" : "opacity-60 hover:opacity-100"}
              >
                {v}
              </button>
            ))}
          </span>
        </div>
      ))}
      <span className="col-span-2 text-ash normal-case">previews only</span>
    </div>
  );
}
