"use client";

import { useEffect } from "react";

/**
 * Lifts a peeling sticker's corner further while the hand is over it, or for a
 * moment after a tap on a phone. The sticker layer ignores the pointer (so it
 * never eats a click meant for the page), so this checks the pointer against
 * each peeling sticker's box instead.
 */
export function StickerPeel() {
  useEffect(() => {
    let x = -1;
    let y = -1;
    let frame = 0;
    const tapped = new Map<Element, number>();

    const check = () => {
      frame = 0;
      for (const el of document.querySelectorAll<HTMLElement>(".peel")) {
        if (!el.offsetParent) continue;
        const r = el.getBoundingClientRect();
        // the inner 80% of the box: the corners of a tilted box are often bare
        const ix = r.width * 0.1;
        const iy = r.height * 0.1;
        const hit = x > r.left + ix && x < r.right - ix && y > r.top + iy && y < r.bottom - iy;
        if (hit !== el.hasAttribute("data-lifted")) el.toggleAttribute("data-lifted", hit);
      }
    };
    const ask = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };

    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      x = e.clientX;
      y = e.clientY;
      ask();
    };
    const tap = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      x = e.clientX;
      y = e.clientY;
      check();
      for (const el of document.querySelectorAll(".peel[data-lifted]")) {
        window.clearTimeout(tapped.get(el));
        tapped.set(el, window.setTimeout(() => el.removeAttribute("data-lifted"), 1400));
      }
      x = y = -1;
    };
    const leave = (e: MouseEvent) => {
      if (e.relatedTarget) return;
      x = y = -1;
      ask();
    };

    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", tap, { passive: true });
    window.addEventListener("scroll", ask, { passive: true });
    document.addEventListener("mouseout", leave);
    return () => {
      cancelAnimationFrame(frame);
      for (const t of tapped.values()) window.clearTimeout(t);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", tap);
      window.removeEventListener("scroll", ask);
      document.removeEventListener("mouseout", leave);
    };
  }, []);

  return null;
}
