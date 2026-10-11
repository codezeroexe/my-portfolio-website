"use client";

import { useEffect, useState } from "react";
import type { TicketFont } from "@/lib/ticket-fonts";

/**
 * Temporary: with ?font=<key> in the URL, sets the on-repeat ticket's type to
 * that pair and prints a small switcher in the bottom-left corner so the
 * pairs can be flicked through on a real device. Renders nothing otherwise.
 * Goes away once a pair is chosen.
 */
export function TicketFontPicker({ fonts }: { fonts: TicketFont[] }) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (!q.has("font")) return;
    const want = q.get("font");
    setActive(fonts.some((f) => f.key === want) ? want : fonts[0].key);
  }, [fonts]);

  useEffect(() => {
    const f = fonts.find((x) => x.key === active);
    if (!f) return;
    const root = document.documentElement.style;
    root.setProperty("--tk-head", `var(${f.head})`);
    root.setProperty("--tk-body", `var(${f.body})`);
  }, [active, fonts]);

  if (!active) return null;

  const choose = (key: string) => {
    setActive(key);
    const url = new URL(window.location.href);
    url.searchParams.set("font", key);
    window.history.replaceState(null, "", url);
  };

  return (
    <div className="fixed bottom-3 left-3 z-[200] flex max-w-[calc(100vw-1.5rem)] flex-wrap gap-1.5 border border-acid bg-ground p-2">
      {fonts.map((f, i) => (
        <button
          key={f.key}
          type="button"
          onClick={() => choose(f.key)}
          className={`fine px-2 py-1 ${f.key === active ? "bg-acid text-ground" : "text-acid"}`}
        >
          {i + 1} {f.label}
        </button>
      ))}
    </div>
  );
}
