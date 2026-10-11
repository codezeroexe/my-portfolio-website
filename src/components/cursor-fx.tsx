"use client";

import { useEffect, useRef } from "react";

type HandState = "point" | "link" | "press" | "pen";

/** each picture's hotspot, [x, y] in px: the fingertip or the pencil point.
    The CSS in globals.css carries the same numbers. */
const HOTSPOTS: Record<HandState, [number, number]> = {
  point: [15, 5],
  link: [15, 5],
  press: [15, 5],
  pen: [3, 29],
};

const LINK = 'a, button, summary, label, [role="button"]';
const TEXT = "p, h1, h2, h3, h4, h5, h6, li, blockquote, figcaption";

/**
 * The cursor's two extras on top of the CSS cursor (globals.css):
 *
 * - The page draws the hand and the system cursor hides, so the hand can
 *   lean into the movement like a paper cut-out pinned at the fingertip, and
 *   dip on a click. Held upright under reduced motion.
 * - Over a link with data-cursor-label, a strip of tape beside the hand says
 *   what a click does.
 *
 * Mouse and trackpad only, never in the sticker editor, where the CSS cursor
 * steps aside too.
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

    let on = false;
    let x = 0;
    let y = 0;
    let vel = 0; // px per ms, sideways
    let movedT = 0; // the last move's event time, and when it arrived
    let movedAt = 0;
    let hot: [number, number] = HOTSPOTS.point;
    let showTag = false;
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
      if (over?.closest(TEXT)) return { state: "pen", say: "" };
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

      if (on) {
        const [hx, hy] = HOTSPOTS[state];
        const next = `/cursors/hand-${state}@2x.png`;
        if (next !== src) img.src = src = next;
        // the pointer's speed, measured from its own events; it fades once
        // the pointer stops, so the hand swings back upright
        if (now - movedAt > 40) vel *= 0.6;
        if (still.matches) {
          tilt = spin = 0;
        } else {
          // a stiff spring pulled toward a lean that trails the movement,
          // with a little overshoot when the hand stops
          const lean = Math.max(-26, Math.min(26, vel * 16.7 * 1.5));
          for (let i = 0; i < steps; i++) {
            spin = (spin + (lean - tilt) * 0.3) * 0.66;
            tilt += spin;
          }
        }
        for (let i = 0; i < steps; i++) dip += ((down ? 0.86 : 1) - dip) * 0.45;
        img.style.transformOrigin = `${hx}px ${hy}px`;
        hot = [hx, hy];
        place();
        busy = Math.abs(vel) > 0.002 || Math.abs(spin) > 0.01 || Math.abs(tilt) > 0.05 || Math.abs((down ? 0.86 : 1) - dip) > 0.002;
      }

      if (on && say) {
        if (say !== said) {
          words.textContent = said = say;
          tagW = tag.offsetWidth;
        }
        showTag = true;
        placeTag();
        tag.style.opacity = "1";
      } else {
        showTag = false;
        tag.style.opacity = "0";
      }

      if (busy) frame = requestAnimationFrame(tick);
      else then = owed = 0;
    };

    // the hand and its label go where the pointer is the moment it moves,
    // not a frame later; the frame loop only turns and dips the hand
    const place = () => {
      img.style.transform = `translate3d(${x - hot[0]}px, ${y - hot[1]}px, 0) rotate(${tilt.toFixed(2)}deg) scale(${dip.toFixed(3)})`;
    };
    const placeTag = () => {
      // beside the hand, or on its other side near the right edge
      const lx = x + 24 + tagW > window.innerWidth - 8 ? x - tagW - 14 : x + 24;
      tag.style.transform = `translate3d(${lx}px, ${y + 6}px, 0) rotate(-4deg)`;
    };

    const wake = () => {
      if (!frame && inside && on) frame = requestAnimationFrame(tick);
    };

    const read = () => {
      on = fine.matches && !("stickerEdit" in html.dataset);
      if (on && inside) html.dataset.cursorLive = "";
      else delete html.dataset.cursorLive;
      img.style.opacity = on && inside ? "1" : "0";
      if (!on) tag.style.opacity = "0";
      src = "";
      if (on) {
        // fetch the other states now, so the first swap doesn't blink
        for (const s of Object.keys(HOTSPOTS)) new Image().src = `/cursors/hand-${s}@2x.png`;
      }
      wake();
    };

    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      if (inside && e.timeStamp > movedT) {
        const v = (e.clientX - x) / Math.max(4, e.timeStamp - movedT);
        vel = vel * 0.4 + v * 0.6;
      }
      movedT = e.timeStamp;
      movedAt = performance.now();
      x = e.clientX;
      y = e.clientY;
      over = e.target as Element;
      if (on && inside) {
        place();
        if (showTag) placeTag();
      }
      if (!inside) {
        inside = true;
        vel = 0;
        if (on) {
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
    watch.observe(html, { attributes: true, attributeFilter: ["data-sticker-edit"] });
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
