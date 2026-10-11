"use client";

import { useEffect, useRef } from "react";
import { HOTSPOTS, type Hand, type HandState } from "@/lib/cursor";

const LINK = 'a, button, summary, label, [role="button"]';
const TEXT = "p, h1, h2, h3, h4, h5, h6, li, blockquote, figcaption";
const WATCH = ["data-cursor", "data-cursor-text", "data-cursor-label", "data-cursor-swing", "data-sticker-edit"];

/**
 * The cursor's two extras. The plain cursor is CSS (globals.css) and needs
 * none of this; each extra runs only while <html> says "on":
 *
 * - data-cursor-label: over a link with data-cursor-label, a strip of tape
 *   beside the hand saying what a click does.
 * - data-cursor-swing: the page draws the hand and the system cursor hides,
 *   so the hand can lean into the movement like a paper cut-out pinned at the
 *   fingertip, and dip on a click. Held upright under reduced motion.
 *
 * Mouse and trackpad only, never in the sticker editor.
 */
export function CursorFx() {
  const handRef = useRef<HTMLImageElement>(null);
  const tagRef = useRef<HTMLSpanElement>(null);
  const wordsRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const html = document.documentElement;
    const img = handRef.current!;
    const tag = tagRef.current!;
    const words = wordsRef.current!;
    const fine = window.matchMedia("(pointer: fine)");
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");

    let label = false;
    let swing = false;
    let hand: Exclude<Hand, "off"> = "line";
    let x = 0;
    let y = 0;
    let lastX = 0;
    let inside = false;
    let down = false;
    let over: Element | null = null;
    let tilt = 0; // degrees, and how fast it is changing
    let spin = 0;
    let dip = 1;
    let src = "";
    let said = "";
    let tagW = 0;
    let frame = 0;
    let then = 0; // last frame's time, and spring time not yet stepped
    let owed = 0;

    // what the hand is over decides its picture, as in the CSS: links win,
    // then text (which keeps its pen while a selection is dragged), then the
    // plain hand, pressed while the button is down
    const look = (): { state: HandState; say: string } => {
      const link = over?.closest(LINK);
      if (link) {
        const say = link.closest("[data-cursor-label]")?.getAttribute("data-cursor-label") ?? "";
        return { state: down ? "press" : "link", say };
      }
      const t = html.dataset.cursorText;
      if ((t === "pen" || t === "beam") && over?.closest(TEXT)) return { state: t, say: "" };
      return { state: down ? "press" : "point", say: "" };
    };

    const tick = (now: number) => {
      frame = 0;
      // the spring is tuned in 60Hz steps, so it swings the same on a 120Hz
      // screen: take as many steps as the time since the last frame holds
      const dt = then ? Math.min(now - then, 67) : 16.7;
      then = now;
      owed += dt;
      const steps = Math.floor(owed / 16.7);
      owed -= steps * 16.7;
      const { state, say } = look();
      let busy = false;

      if (swing) {
        const [hx, hy] = HOTSPOTS[hand][state];
        const next = `/cursors/hand-${hand}-${state}@2x.png`;
        if (next !== src) img.src = src = next;
        const vx = x - lastX;
        lastX = x;
        if (still.matches) {
          tilt = spin = 0;
        } else {
          // a spring pulled toward a lean that trails the movement
          const lean = Math.max(-24, Math.min(24, vx * (16.7 / dt) * 1.3));
          for (let i = 0; i < steps; i++) {
            spin = (spin + (lean - tilt) * 0.16) * 0.74;
            tilt += spin;
          }
        }
        for (let i = 0; i < steps; i++) dip += ((down ? 0.86 : 1) - dip) * 0.4;
        img.style.transformOrigin = `${hx}px ${hy}px`;
        img.style.transform = `translate3d(${x - hx}px, ${y - hy}px, 0) rotate(${tilt.toFixed(2)}deg) scale(${dip.toFixed(3)})`;
        busy = vx !== 0 || Math.abs(spin) > 0.01 || Math.abs(tilt) > 0.05 || Math.abs((down ? 0.86 : 1) - dip) > 0.002;
      }

      if (label && say) {
        if (say !== said) {
          words.textContent = said = say;
          tagW = tag.offsetWidth;
        }
        // beside the hand, or on its other side near the right edge
        const lx = x + 24 + tagW > window.innerWidth - 8 ? x - tagW - 14 : x + 24;
        tag.style.transform = `translate3d(${lx}px, ${y + 6}px, 0) rotate(-4deg)`;
        tag.style.opacity = "1";
      } else {
        tag.style.opacity = "0";
      }

      if (busy) frame = requestAnimationFrame(tick);
      else then = owed = 0;
    };

    const wake = () => {
      if (!frame && inside && (label || swing)) frame = requestAnimationFrame(tick);
    };

    const read = () => {
      const ok = fine.matches && !("stickerEdit" in html.dataset);
      const h = html.dataset.cursor;
      label = ok && html.dataset.cursorLabel === "on";
      swing = ok && html.dataset.cursorSwing === "on" && !!h && h in HOTSPOTS;
      if (swing) hand = h as Exclude<Hand, "off">;
      if (swing && inside) html.dataset.cursorLive = "";
      else delete html.dataset.cursorLive;
      img.style.opacity = swing && inside ? "1" : "0";
      if (!label) tag.style.opacity = "0";
      src = "";
      if (swing) {
        // fetch the other states now, so the first swap doesn't blink
        for (const s of Object.keys(HOTSPOTS[hand])) new Image().src = `/cursors/hand-${hand}-${s}@2x.png`;
      }
      wake();
    };

    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      x = e.clientX;
      y = e.clientY;
      over = e.target as Element;
      if (!inside) {
        inside = true;
        lastX = x;
        if (swing) {
          html.dataset.cursorLive = "";
          img.style.opacity = "1";
        }
      }
      wake();
    };
    const press = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      down = e.type === "pointerdown";
      wake();
    };
    const release = () => {
      down = false;
      wake();
    };
    const leave = (e: MouseEvent) => {
      if (e.relatedTarget) return;
      inside = false;
      delete html.dataset.cursorLive;
      img.style.opacity = "0";
      tag.style.opacity = "0";
    };
    // the page can scroll a link under a still pointer
    const scrolled = () => {
      if (!inside) return;
      over = document.elementFromPoint(x, y);
      wake();
    };

    const watch = new MutationObserver(read);
    watch.observe(html, { attributes: true, attributeFilter: WATCH });
    fine.addEventListener("change", read);
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", press, { passive: true });
    window.addEventListener("pointerup", press, { passive: true });
    window.addEventListener("pointercancel", release, { passive: true });
    window.addEventListener("blur", release);
    document.addEventListener("mouseout", leave);
    window.addEventListener("scroll", scrolled, { passive: true });
    read();

    return () => {
      watch.disconnect();
      fine.removeEventListener("change", read);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", press);
      window.removeEventListener("pointerup", press);
      window.removeEventListener("pointercancel", release);
      window.removeEventListener("blur", release);
      document.removeEventListener("mouseout", leave);
      window.removeEventListener("scroll", scrolled);
      cancelAnimationFrame(frame);
      delete html.dataset.cursorLive;
    };
  }, []);

  return (
    <>
      <img ref={handRef} className="cursor-hand" alt="" aria-hidden width={32} height={32} />
      <span ref={tagRef} className="cursor-tag" aria-hidden>
        <span ref={wordsRef} />
      </span>
    </>
  );
}
