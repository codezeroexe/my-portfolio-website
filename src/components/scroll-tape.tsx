"use client";

import { useEffect, useRef } from "react";

/**
 * A strip of masking tape down the right edge, in place of the scrollbar: its
 * length is how far down the page the visitor has scrolled, and with a mouse
 * it can be dragged to scroll. The strip is drawn once and only the window it
 * shows changes, so scrolling costs a height change on one small element. The
 * torn end is a separate piece riding the window's edge. The native scrollbar
 * is hidden while this runs (html[data-tape]); wheel, keys and touch scroll as
 * ever. Decorative for readers, who have the page's own landmarks.
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
    document.documentElement.dataset.tape = "";

    // dragging: the pointer's height on the track is how far down the page
    const room = () => document.documentElement.scrollHeight - window.innerHeight;
    const to = (y: number) => {
      // the tape's end sits at 30 + f * (innerHeight - 24): see globals.css
      const f = Math.min(1, Math.max(0, (y - 30) / (window.innerHeight - 24)));
      window.scrollTo({ top: f * room(), behavior: "instant" });
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType === "touch" || e.button !== 0) return;
      e.preventDefault();
      tape.setPointerCapture(e.pointerId);
      tape.setAttribute("data-drag", "");
      to(e.clientY);
    };
    const move = (e: PointerEvent) => {
      if (tape.hasAttribute("data-drag")) to(e.clientY);
    };
    const up = (e: PointerEvent) => {
      tape.removeAttribute("data-drag");
      if (tape.hasPointerCapture(e.pointerId)) tape.releasePointerCapture(e.pointerId);
    };
    tape.addEventListener("pointerdown", down);
    tape.addEventListener("pointermove", move);
    tape.addEventListener("pointerup", up);
    tape.addEventListener("pointercancel", up);

    window.addEventListener("scroll", ask, { passive: true });
    window.addEventListener("resize", ask);
    return () => {
      cancelAnimationFrame(frame);
      delete document.documentElement.dataset.tape;
      tape.removeEventListener("pointerdown", down);
      tape.removeEventListener("pointermove", move);
      tape.removeEventListener("pointerup", up);
      tape.removeEventListener("pointercancel", up);
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
