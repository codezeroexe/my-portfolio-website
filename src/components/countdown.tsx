"use client";

import { useEffect, useState } from "react";

/**
 * Days, hours and minutes to a start time. Ticks once a minute and not at
 * all while the tab is hidden, so it costs nothing on scroll. Renders dashes
 * until mounted so the server markup never disagrees with the client's clock.
 */
export function Countdown({ to }: { to: string }) {
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const t = Date.parse(to);
    const tick = () => setLeft(t - Date.now());
    tick();
    const id = window.setInterval(() => {
      if (!document.hidden) tick();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [to]);

  if (left === null) return <span>-- : -- : --</span>;
  if (left <= 0) return <span>LIGHTS OUT</span>;
  const mins = Math.floor(left / 60_000);
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    <span>
      {p(d)}D : {p(h)}H : {p(m)}M
    </span>
  );
}
