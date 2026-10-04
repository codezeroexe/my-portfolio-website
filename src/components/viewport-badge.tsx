"use client";

import { useEffect, useState } from "react";

/**
 * Viewport readout for measuring real devices. Open any page with ?vp=1 and a
 * small fixed badge shows the live CSS viewport size, updating on resize and
 * rotation. Exists because bookmarklet javascript: URLs get stripped by mobile
 * address bars and alert() is suppressed there — this needs no setup at all.
 *
 * Renders nothing unless the flag is present, so production pays zero cost.
 * Mount-gated (never SSR'd) to avoid a hydration mismatch between the
 * server-rendered nothing and the client's measured something.
 */
export function ViewportBadge() {
  const [on, setOn] = useState(false);
  const [size, setSize] = useState("");

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("vp")) return;
    setOn(true);
    const read = () => setSize(`${window.innerWidth} × ${window.innerHeight}`);
    read();
    window.addEventListener("resize", read);
    window.addEventListener("orientationchange", read);
    return () => {
      window.removeEventListener("resize", read);
      window.removeEventListener("orientationchange", read);
    };
  }, []);

  if (!on) return null;

  return (
    <div
      aria-hidden
      className="fine fixed bottom-3 right-3 z-[200] border border-acid bg-ground px-3 py-2 text-acid"
    >
      {size || "…"}
    </div>
  );
}