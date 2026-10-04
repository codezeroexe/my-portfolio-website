"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { StickerEditor } from "@/components/sticker-editor";
import { SECTIONS, type Section as SectionName } from "@/components/sticker-field";
import type {
  EditorCommand,
  EditorMessage,
  EditorState,
  TrayAssets,
} from "@/components/sticker-tools";
import type { SectionPlacements } from "@/lib/placements";

/**
 * Desktop / mobile preview for the placement editor, and the editor's chrome.
 * Development only.
 *
 * ## Why an iframe and not a container
 *
 * Media queries answer to the viewport, not to a container, so a 390px-wide div
 * wrapped around the page still gets desktop CSS. An iframe at 390px is a real
 * 390px viewport, which means lg: does not fire inside it and the page lays out
 * as it would on a phone. Rewriting the page to container queries would achieve
 * the same thing by changing the production layout system to serve a dev tool,
 * which is not a trade worth making.
 *
 * ## Why the chrome lives here and not in there
 *
 * It used to live in the frame, and position: fixed resolved against the
 * frame's viewport — so the tray and the control bar sat on top of the 1088px
 * page they were meant to decorate, right across the hero. Here there are two
 * whole black columns beside the frame, and that is where they go: tray in the
 * left rail, controls in the right.
 *
 * The frame keeps the parts that have to know where they are on the page: the
 * sticker overlay and the scale/rotate handles. Those are positioned against
 * .page-content at that width and would be meaningless out here.
 *
 * So the two halves talk over postMessage — the parent sends intent, the frame
 * reports state back. The reducer stays in the frame; this file never mutates
 * the placements, it renders whatever it was last told.
 *
 * ## The two flags
 *
 * ?stickers alone puts this up, on the page you are already looking at.
 * ?stickers&frame=1 is what the frame loads, which renders the editor's overlay
 * instead of this. Without the second flag the frame would render a bar
 * containing a frame containing a bar, forever.
 */

/**
 * desktop is width 0, meaning "whatever the window is" — it drives the real page,
 * so its viewport is however wide the browser is.
 *
 * mobile is a real CSS-pixel width, because it has to be: media queries answer
 * to CSS pixels inside the frame, and a phone's *physical* resolution is not
 * its CSS width. A 1080-wide panel is 360, 393 or 411 CSS px depending on the
 * device's pixel ratio, and there is no way to tell those apart from the panel
 * resolution alone. Hence the stepper rather than a hardcoded guess.
 */
/**
 * The mobile preview width. 500, not 390: the mobile placements are a single
 * universal set (percentages of each section, so they compress proportionally
 * as the window narrows), and they are composed once at the wide end. 500px
 * covers the widest common phone CSS width, and everything narrower is a
 * proportional squeeze of the same composition rather than a separate layout.
 */
const MOBILE_DEFAULT = 500;

/** order the tabs appear in, so they do not shuffle between reloads */
const CATEGORIES = [
  ["stickers", "stickers"],
  ["letters", "letters"],
  ["numbers", "numbers"],
  ["words", "words"],
  ["shapes", "shapes"],
  ["special", "punct"],
] as const;

/** total across every sub-group of one category */
const countOf = (groups: Record<string, string[]> = {}) =>
  Object.values(groups).reduce((n, items) => n + items.length, 0);

const round = (n: number) => Math.round(n * 10) / 10;

const trim = (src: string) => src.replace(/^\/stickers\/(letters|numbers|words|shapes|special)\//, "").replace(".webp", "");

export function ViewportSwitcher({
  desktop,
  mobile,
  assets: manifest,
}: {
  desktop: SectionPlacements;
  mobile: SectionPlacements;
  assets: TrayAssets;
}) {
  const [mount, setMount] = useState(false);
  const [mode, setMode] = useState<"desktop" | "mobile">("desktop");
  const [section, setSection] = useState<SectionName>("hero");
  const [mobileW, setMobileW] = useState(MOBILE_DEFAULT);
  const [st, setSt] = useState<EditorState | null>(null);
  const [tray, setTray] = useState(false);
  const [cat, setCat] = useState("stickers");
  const [sub, setSub] = useState("");
  const [liveW, setLiveW] = useState(0);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);

  // desktop drives the real page, so its "viewport" is simply however wide the
  // window is right now
  useEffect(() => {
    const onResize = () => setLiveW(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // portal target for the desktop editor: the active section's host, so the
  // overlay is measured against the real layout of that section at the real
  // width. One host per section; switching sections re-portals.
  useEffect(() => {
    setHost(
      document.querySelector<HTMLElement>(`[data-editor-host="${section}"]`),
    );
  }, [section]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    // No environment check here: edit mode is decided by URL alone, in every
    // environment. Production saves are what stay key-gated, server-side.
    if (!q.has("stickers") || q.has("frame")) {
      return;
    }
    setMount(true);
  }, []);

  useEffect(() => {
    if (!mount) return;
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const m = e.data as EditorMessage | undefined;
      if (m?.t === "state") setSt(m.state);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [mount]);

  if (!mount) return null;

  const framed = mode === "mobile";
  // desktop posts to itself, mobile posts up from the frame; both land here
  const send = (c: EditorCommand) =>
    framed
      ? frame.current?.contentWindow?.postMessage(c, window.location.origin)
      : window.postMessage(c, window.location.origin);

  const assets: TrayAssets = manifest;
  const groups = assets[cat] ?? {};
  const subKeys = Object.keys(groups);
  const activeSub = groups[sub] ? sub : (subKeys[0] ?? "");
  const trayItems = groups[activeSub] ?? [];
  const allCount = CATEGORIES.reduce((n, [k]) => n + countOf(assets[k]), 0);
  const sel = st?.sel ?? [];
  const primary = sel.length ? sel[sel.length - 1] : null;
  const picked = primary !== null && st ? st.items[primary] : null;

  return (
    // pointer-events-none, and the chrome opts back in. This container covers
    // the viewport, so without it every click meant for the page underneath
    // lands here instead — the lasso kept working because it listens on
    // window, but no sticker could be dragged at all.
    <div
      className={`pointer-events-none fixed inset-0 z-[100] ${framed ? "bg-ground" : "bg-transparent"}`}
    >
      {/* ── top bar: viewport + where you are ─────────────────────────── */}
      <div className="pointer-events-auto fixed left-0 top-0 z-[110] flex w-full flex-wrap items-center gap-2 border-b border-bone/30 bg-ground px-3 py-2 text-[10px] uppercase tracking-widest text-bone">
        <span className="fine text-acid">viewport</span>
        {(["desktop", "mobile"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setSt(null);
            }}
            className={`border px-2 py-1 ${
              m === mode
                ? "border-acid bg-acid text-ground"
                : "border-bone/50 hover:border-acid"
            }`}
          >
            {m} ·{" "}
            {m === "desktop" ? (liveW ? `${liveW}px` : "live") : `${mobileW}px`}
          </button>
        ))}

        {/* phone widths are CSS pixels, and the physical panel resolution does
            not tell you yours — 1080px is 360, 393 or 411 depending on pixel
            ratio. To read it off the phone, open the site and look at what
            devtools or a bookmarklet reports; or just try a width and see
            whether anything is cramped. */}
        <span className="fine text-acid">section</span>
        {SECTIONS.map((sec: SectionName) => (
          <button
            key={sec}
            type="button"
            onClick={() => setSection(sec)}
            className={`border px-2 py-1 ${
              sec === section
                ? "border-acid bg-acid text-ground"
                : "border-bone/50 hover:border-acid"
            }`}
          >
            {sec}
          </button>
        ))}
        <span className="fine text-ash">
          {st ? `${st.items.length} here` : ""}
        </span>

        {mode === "mobile" && (
          <span className="flex items-center gap-1 text-ash">
            <button
              type="button"
              onClick={() => setMobileW((w) => Math.max(320, w - 1))}
              className="border border-bone/50 px-2 py-1 hover:border-acid"
            >
              −
            </button>
            <input
              type="number"
              value={mobileW}
              min={320}
              max={500}
              onChange={(e) =>
                setMobileW(Math.min(500, Math.max(320, Number(e.target.value) || 0)))
              }
              className="w-14 border border-bone/50 bg-transparent px-1 py-1 text-center text-bone"
            />
            <button
              type="button"
              onClick={() => setMobileW((w) => Math.min(500, w + 1))}
              className="border border-bone/50 px-2 py-1 hover:border-acid"
            >
              +
            </button>
          </span>
        )}
        <span className="fine text-ash">
          {st ? `${st.name} · ${st.items.length} placed` : "loading…"} · the page
          inside is live — drag stickers in it
        </span>
      </div>

      {/* ── left rail: the tray ────────────────────────────────────────── */}
      <div className="pointer-events-auto fixed left-3 top-[4.75rem] z-[105] flex w-[min(24rem,40vw)] flex-col items-start gap-2">
        <button
          type="button"
          onClick={() => setTray((v) => !v)}
          className="border border-acid px-2 py-1 text-[10px] uppercase tracking-widest text-acid hover:bg-acid hover:text-ground"
        >
          {tray ? "close tray" : `add sticker (${allCount})`}
        </button>
        {tray && (
          <div className="flex w-full flex-col gap-2 border border-bone/50 bg-ground/95 p-2">
            <div className="flex flex-wrap gap-1">
              {CATEGORIES.filter(([k]) => assets[k]).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setCat(key);
                    setSub("");
                  }}
                  className={`flex items-center gap-1.5 border px-2 py-1 uppercase tracking-widest ${
                    key === cat
                      ? "border-acid bg-acid text-ground"
                      : "border-bone/50 text-bone hover:border-acid"
                  }`}
                >
                  {label}
                  <span className={key === cat ? "text-ground/70" : "text-ash"}>
                    {countOf(assets[key])}
                  </span>
                </button>
              ))}
            </div>

            {subKeys.length > 1 && (
              <div className="flex flex-wrap gap-1 border-t border-bone/20 pt-2">
                {subKeys.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSub(k)}
                    className={`min-w-6 border px-1.5 py-0.5 ${
                      k === activeSub
                        ? "border-acid bg-acid text-ground"
                        : "border-bone/40 text-bone hover:border-acid"
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            )}

            <div className="grid max-h-[min(52vh,520px)] grid-cols-4 gap-1.5 overflow-y-auto">
              {trayItems.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => send({ t: "add", src: a })}
                  title={a}
                  className="flex h-14 items-center justify-center border border-transparent hover:border-acid"
                >
                  <img src={a} alt="" className="max-h-12 max-w-full" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── right rail: the controls for the selected sticker ──────────── */}
      <div className="pointer-events-auto fixed right-3 top-[4.75rem] z-[105] flex w-[min(21rem,38vw)] flex-col items-stretch gap-2 border border-bone/50 bg-ground/95 p-2 text-[10px] text-bone">
        <span className="fine text-acid">{st?.name ?? "—"}</span>

        {picked ? (
          <>
            <span className="fine break-all text-ash">{trim(picked.src)}</span>
            <span className="flex gap-3 text-ash">
              <span>{Math.round(picked.size)}px</span>
              <span>{round(picked.tilt)}°</span>
              <span>{(picked.z ?? "front")}</span>
              {sel.length > 1 && <span>{sel.length} held</span>}
            </span>

            <span className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => send({ t: "step", dir: 1 })}
                className="border border-bone/50 px-2 py-0.5 hover:border-acid"
              >
                ↑ forward
              </button>
              <button
                type="button"
                onClick={() => send({ t: "step", dir: -1 })}
                className="border border-bone/50 px-2 py-0.5 hover:border-acid"
              >
                ↓ back
              </button>
            </span>

            <span className="flex items-center gap-1">
              {(["front", "back"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => send({ t: "layer", z: l })}
                  className={`border px-2 py-0.5 uppercase tracking-widest ${
                    (picked.z ?? "front") === l
                      ? "border-acid bg-acid text-ground"
                      : "border-bone/50 hover:border-acid"
                  }`}
                >
                  {l}
                </button>
              ))}
              <button
                type="button"
                onClick={() => send({ t: "del" })}
                className="ml-auto border border-acid px-2 py-0.5 uppercase tracking-widest text-acid hover:bg-acid hover:text-ground"
              >
                delete
              </button>
            </span>
          </>
        ) : (
          <span className="fine text-ash">
            click a sticker in the page to scale, rotate and reorder it
          </span>
        )}

        <span className="flex items-center gap-2 border-t border-bone/20 pt-2">
          <button
            type="button"
            onClick={() => send({ t: "save" })}
            className="border border-acid bg-acid px-2 py-0.5 uppercase tracking-widest text-ground hover:border-bone hover:bg-bone"
          >
            save {st?.side ?? "—"}
          </button>
          <button
            type="button"
            onClick={() => send({ t: "copy" })}
            className="border border-bone/50 px-2 py-0.5 uppercase tracking-widest hover:border-acid"
          >
            {st?.copied ? "copied" : st?.dirty ? "copy array *" : "copy array"}
          </button>
          {st?.saved && <span className="fine text-ash">{st.saved}</span>}
        </span>
      </div>

      {/* ── the page ───────────────────────────────────────────────────── */}

      {/* Desktop: the real page, edited in place. No iframe, so what you are
          looking at is the site at the site's own width — which is the only way
          the two can agree, since an iframe is a single fixed width and the
          page's layout changes with width. */}
      {!framed && host
        ? createPortal(
            <StickerEditor
              desktop={desktop}
              mobile={mobile}
              section={section}
              live
            />,
            host,
          )
        : null}

      {/* Mobile: a real 390px iframe, because lg: has to fail inside it for the
          single-column layout to appear, and media queries only answer to a
          viewport. */}
      {framed && (
        <div className="pointer-events-auto flex h-full justify-center overflow-hidden pt-[4.5rem]">
          <iframe
            ref={frame}
            key={section}
            src={`/?stickers=1&frame=1&section=${section}`}
            title="mobile preview"
            style={{ height: Math.round((mobileW * 844) / 390) }}
            width={mobileW}
            height={844}
            className="max-w-full border-x border-bone/30 bg-ground"
          />
        </div>
      )}
    </div>
  );
}