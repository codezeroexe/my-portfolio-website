"use client";

import { useEffect, useRef } from "react";

/**
 * A strip of masking tape along the top edge that unrolls as the page is
 * read: its length is how far down the page the visitor has scrolled. The
 * strip itself is drawn once and only the window it shows changes, so
 * scrolling costs a width change on one small element. The torn end is a
 * separate piece riding the window's edge. Decorative, so hidden from readers.
 */
export function ScrollTape() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tape = ref.current!;
    let frame = 0;
    const draw = () => {
      frame = 0;
      const room = document.documentElement.scrollHeight - window.innerHeight;
      const read = room > 0 ? Math.min(1, Math.max(0, window.scrollY / room)) : 0;
      tape.style.setProperty("--read", read.toFixed(4));
    };
    const ask = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    draw();
    window.addEventListener("scroll", ask, { passive: true });
    window.addEventListener("resize", ask);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", ask);
      window.removeEventListener("resize", ask);
    };
  }, []);

  return (
    <div ref={ref} className="scroll-tape" aria-hidden>
      <div className="scroll-tape-clip">
        <div className="scroll-tape-body" />
      </div>
      <div className="scroll-tape-end" />
    </div>
  );
}
