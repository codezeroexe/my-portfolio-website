"use client";

import { useEffect } from "react";

const WORD = "hari";
const HOLD = 2600; // ms the pile stays before the stickers slap back

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * The secret word. Typing "hari" anywhere outside a text field knocks every
 * sticker in view loose: they fall to the bottom of the screen and pile up,
 * then slap back onto the sheet where they were. Under reduced motion they
 * fade out and back instead.
 */
export function Avalanche() {
  useEffect(() => {
    let typed = "";
    let lastKey = 0;
    let busy = false;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");

    const run = () => {
      busy = true;
      const h = window.innerHeight;
      const stickers = [...document.querySelectorAll<HTMLElement>("[data-sticker-field] .sticker")].filter((el) => {
        if (!el.offsetParent) return false; // the other breakpoint's set
        const r = el.getBoundingClientRect();
        return r.bottom > -40 && r.top < h + 40 && r.width > 0;
      });
      if (!stickers.length) {
        busy = false;
        return;
      }
      let longest = 0;
      const all = stickers.map((el) => {
        const r = el.getBoundingClientRect();
        const tilt = parseFloat(getComputedStyle(el).getPropertyValue("--tilt")) || 0;
        const rest = `translate(0px, 0px) rotate(${tilt}deg)`;
        if (still.matches) {
          const a = el.animate(
            [{ opacity: 1 }, { opacity: 0, offset: 0.15 }, { opacity: 0, offset: 0.85 }, { opacity: 1 }],
            { duration: HOLD + 900 },
          );
          longest = Math.max(longest, HOLD + 900);
          return a;
        }
        // land on the bottom edge, some on top of others
        const fall = h - r.height * rand(0.5, 0.62) - rand(0, 46) - (r.top + r.height / 2);
        const dx = rand(-40, 40);
        const spin = tilt + rand(-150, 150);
        const down = `translate(${dx.toFixed(1)}px, ${fall.toFixed(1)}px) rotate(${spin.toFixed(1)}deg)`;
        const hop = `translate(${(dx * 1.1).toFixed(1)}px, ${(fall - Math.min(28, r.height * 0.2)).toFixed(1)}px) rotate(${(spin + rand(-12, 12)).toFixed(1)}deg)`;
        const delay = rand(0, 260);
        const drop = Math.max(380, Math.sqrt(Math.max(0, fall)) * 34);
        const back = 420;
        const total = delay + drop + 260 + HOLD + back;
        longest = Math.max(longest, total);
        const t = (ms: number) => ms / total;
        return el.animate(
          [
            { transform: rest, offset: 0 },
            { transform: rest, offset: t(delay), easing: "cubic-bezier(0.5, 0, 1, 0.6)" },
            { transform: down, offset: t(delay + drop), easing: "ease-out" },
            { transform: hop, offset: t(delay + drop + 130), easing: "ease-in" },
            { transform: down, offset: t(delay + drop + 260) },
            { transform: down, offset: t(total - back), easing: "cubic-bezier(0.2, 0.7, 0.3, 1)" },
            // flung back up, a touch too big, then slapped flat
            { transform: `${rest} scale(1.22)`, offset: t(total - 110), easing: "ease-in" },
            { transform: `${rest} scale(1)`, offset: 1 },
          ],
          { duration: total },
        );
      });
      window.setTimeout(() => {
        for (const a of all) a.cancel();
        busy = false;
      }, longest + 50);
    };

    const key = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable]")) return;
      if (e.timeStamp - lastKey > 1500) typed = "";
      lastKey = e.timeStamp;
      typed = (typed + e.key.toLowerCase()).slice(-WORD.length);
      if (typed === WORD && !busy) {
        typed = "";
        run();
      }
    };

    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  return null;
}
