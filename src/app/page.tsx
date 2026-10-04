import { readdirSync } from "node:fs";
import path from "node:path";
import { GH_USER, projects, type Project } from "@/lib/projects";
import { PLACEMENTS_DESKTOP, PLACEMENTS_MOBILE, readDraft } from "@/lib/placements";
import { ProjectSheet } from "@/components/project-sheet";
import { Polaroid } from "@/components/edges";
import { StickerField } from "@/components/sticker-field";
import {
  EditGate,
  StickerEditorSlot,
  ViewportSwitcherSlot,
  type TrayAssets,
} from "@/components/sticker-tools";
import { Settle } from "@/components/settle";
import { LogoSticker, LOGOS } from "@/components/logo-sticker";

export const revalidate = 3600;

/**
 * The editor tray's inventory, read at build time so it can never fall out of
 * step with what is actually in public/stickers. Only the editor ever sees
 * any of this — it is passed as props into slots that render nothing unless
 * the URL carries ?stickers=1, so unedited visits never download it.
 */
const stickerDir = path.join(process.cwd(), "public/stickers");

const webps = (dir: string, prefix: string): string[] =>
  readdirSync(dir)
    .filter((f) => f.endsWith(".webp"))
    .map((f) => `${prefix}${f}`);

function buildTray(): TrayAssets {
  const tray: TrayAssets = {
    stickers: { "": webps(stickerDir, "/stickers/") },
    letters: {},
    words: {},
    shapes: {},
    special: {},
    numbers: {},
  };

  const dirs = readdirSync(stickerDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const [key, folder] of [
    ["words", "words"],
    ["shapes", "shapes"],
    ["special", "special"],
    ["numbers", "numbers"],
  ] as const) {
    if (dirs.includes(folder)) {
      tray[key][""] = webps(path.join(stickerDir, folder), `/stickers/${folder}/`);
    }
  }

  if (dirs.includes("letters")) {
    for (const letter of readdirSync(path.join(stickerDir, "letters"))) {
      const items = webps(
        path.join(stickerDir, "letters", letter),
        `/stickers/letters/${letter}/`,
      );
      if (items.length) tray.letters[letter.toUpperCase()] = items;
    }
  }

  return tray;
}

const stickerAssets = buildTray();

// the about strip: one ramp colour per fact, round-robin like the repo panels
const SLABS = [
  "var(--slab-red)",
  "var(--slab-amber)",
  "var(--slab-green)",
  "var(--slab-cyan)",
  "var(--slab-blue)",
  "var(--slab-violet)",
];
const SLAB_TILTS = [-1.4, 1.1, -0.8, 1.6, -1.1, 0.9];

// only the two fields worth taking from the API. Topics are hand-written
// because nothing on the account has any, and the panels link out by slug.
type GhRepo = { name: string; description: string | null; pushed_at: string };

export default async function Home() {
  let repos: Project[] = projects;

  try {
    const res = await fetch(
      `https://api.github.com/users/${GH_USER}/repos?sort=pushed&per_page=100`,
      {
        headers: { Accept: "application/vnd.github+json" },
        next: { revalidate: 3600 },
      },
    );
    if (res.ok) {
      const data: GhRepo[] = await res.json();
      const byRepo = new Map(data.map((r) => [r.name.toLowerCase(), r]));
      // merged per repo rather than all-or-nothing: a rate limit, a rename or
      // one missing repo costs that panel its live date, not the whole sheet.
      repos = projects.map((p) => {
        const found = byRepo.get(p.repo);
        return found
          ? {
              ...p,
              description: found.description || p.description,
              pushed_at: found.pushed_at,
            }
          : p;
      });
    }
  } catch {
    // a rate limit must not blank the sheet
  }

  // In development a saved draft wins over the baked arrays, so hitting save
  // in the editor is the whole job — reload and the layout is on the page.
  // Read here, not at module scope: a top-level read is evaluated once per
  // module instance and cached, so a draft saved afterwards never shows up.
  // Production has no draft file and always reads the committed source.
  const desktop = readDraft("PLACEMENTS_DESKTOP") ?? PLACEMENTS_DESKTOP;
  const mobile = readDraft("PLACEMENTS_MOBILE") ?? PLACEMENTS_MOBILE;

  return (
    <>
      <main id="main-content" className="relative">
      {/* the frosted pane, spanning the whole sheet. It is a direct child of
          <main> rather than of the content column: the column is max-w-6xl, so
          inside it the pane stopped 144px short on each side at 1440 and the
          liquid showed through beside the content. z-index -1 keeps it behind
          the text and in front of the canvas at -10. */}
      <div className="partition" aria-hidden />

      <div className="page-content relative mx-auto max-w-6xl px-5 pb-24 sm:px-8">
        <EditGate>
          <StickerEditorSlot desktop={desktop} mobile={mobile} />
        </EditGate>

        {/* ── the poster ───────────────────────────────────────────── */}
        {/* Each section carries its own pair of fields, one per breakpoint,
            switched in CSS rather than in JS: a server cannot know the window
            width, so choosing in script means shipping one set and swapping
            after the fact — which on a phone is a visible flash of the wrong
            stickers on exactly the devices the mobile set exists for.

            x/y are percentages of the section, not the document. A section
            that grows or shrinks takes its stickers with it, so editing the
            hero bio no longer drifts everything below it. */}
        <section id="hero" className="relative py-10 md:py-16">
          <div data-editor-host="hero" />
          <StickerField section="hero" stickers={desktop.hero} className="hidden lg:block" />
          <StickerField section="hero" stickers={mobile.hero} className="lg:hidden" />
          <div className="relative">
            <h1 className="scream blank relative text-[30vw] leading-[0.72] sm:text-[24vw] md:text-[19vw] lg:text-[17rem]">
              HARI
            </h1>

            <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1">
              <span className="scream text-2xl sm:text-3xl">AI DEVELOPER</span>
              <span className="slab text-ground text-xl sm:text-2xl">
                &amp; WEB DESIGNER
              </span>
            </p>

          </div>

          {/* the portrait, printed on a torn polaroid */}
          <div className="mt-8 grid gap-10 md:grid-cols-12 md:gap-8">
            <div className="scrap relative md:col-span-5">
              <div className="sway relative inline-block">
                <Polaroid
                  src="/photo.jpg"
                  alt="Hari"
                  caption="me, somewhere between two shops"
                  width={380}
                  tilt={-3}
                />
              </div>
            </div>

            <div className="md:col-span-7">
              <p className="zine mt-6 max-w-lg text-sm text-ash">
                Big on music, F1, tech, Marvel, and travelling to places I’ve
                never been. I’m fairly selective about who I spend time with,
                but usually bring a lot of energy when I do. Most of my free
                time goes into discovering something new or getting
                unnecessarily invested in something I like.
              </p>

              <dl className="mt-8 grid grid-cols-2 gap-x-5 gap-y-5 sm:grid-cols-3">
                {[
                  ["based", "Kerala → Pune"],
                  ["studying", "AI, Symbiosis"],
                  ["builds", "Python · React"],
                  ["ships", "Next.js · WebGL"],
                  ["also", "digital art"],
                  ["status", "open to work"],
                ].map(([k, v], i) => (
                  <div
                    key={k}
                    className="slab slab-box"
                    style={{
                      ["--slab-bg" as string]: SLABS[i % SLABS.length],
                      ["--slab-tilt" as string]: `${SLAB_TILTS[i % SLAB_TILTS.length]}deg`,
                    }}
                  >
                    <dt className="fine">{k}</dt>
                    <dd className="zine mt-0.5 text-sm">{v}</dd>
                  </div>
                ))}
              </dl>

              {/* the real marks, die-cut, dropped straight onto the poster */}
              <div className="mt-9 flex flex-wrap items-start gap-x-4 gap-y-5">
                {LOGOS.map((l, i) => (
                  <span
                    key={l.src}
                    className="flex w-[74px] flex-col items-center gap-1.5"
                  >
                    <LogoSticker
                      src={l.src}
                      label={l.label}
                      size={44}
                      tilt={[-4, 3, -2, 4, -3, 2, -4, 2][i % 8]}
                    />
                    <span className="fine text-ash">{l.label}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>


        </section>

        <div className="tear-line" aria-hidden />

        {/* ── work ──────────────────────────────────────────────────── */}
        <Settle>
          <ProjectSheet repos={repos} desktop={desktop} mobile={mobile} />
        </Settle>

        <div className="tear-line" aria-hidden />

        {/* ── method ────────────────────────────────────────────────── */}
        <Settle>
          <section id="about" className="relative py-12">
            <div data-editor-host="about" />
            <StickerField section="about" stickers={desktop.about} className="hidden lg:block" />
            <StickerField section="about" stickers={mobile.about} className="lg:hidden" />
            <p className="fine text-ash">page 02 — how i work</p>
            <h2 className="scream mt-3 text-5xl leading-[0.82] sm:text-7xl">
              THE BORING
              <br />
              PARTS{" "}
              <span className="blank">MATTER</span>
            </h2>

            <div className="mt-8 grid gap-8 md:grid-cols-12">
              {/* was a 7/5 split with the clapboard in the right column. That
                  image is gone, so the text takes the measure the left column
                  had — 7/12 of 1152 is 672px, which is max-w-2xl exactly. */}
              <div className="zine space-y-5 text-sm text-ash md:col-span-7">
                <p>
                  I’m less interested in building things just to prove they can
                  be built. I like figuring out why something should exist,
                  what makes it useful, and how to make the experience feel
                  right.
                </p>
                <p>
                  The polished surface is only part of it. The structure
                  underneath, the tiny decisions, the failed attempts, and the
                  things nobody notices are usually what make the final result
                  work.
                </p>
              </div>
            </div>
          </section>
        </Settle>

        <div className="tear-line" aria-hidden />

        {/* ── contact ───────────────────────────────────────────────── */}
        <Settle>
          <section id="contact" className="relative py-12">
            <div data-editor-host="contact" />
            <StickerField section="contact" stickers={desktop.contact} className="hidden lg:block" />
            <StickerField section="contact" stickers={mobile.contact} className="lg:hidden" />
            <p className="fine text-ash">page 03 — talk to me</p>
            <h2 className="scream mt-3 text-6xl leading-[0.82] sm:text-8xl">
              SAY <span className="blank">HI</span>
            </h2>

            <div className="mt-8 flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
              <a
                href="mailto:srhxri06@gmail.com"
                className="group inline-block border-4 border-bone px-6 py-5 transition-transform hover:-translate-y-1"
              >
                <span className="scream block text-2xl text-bone sm:text-3xl">
                  srhxri06@gmail.com
                </span>
                <span className="fine mt-2 block text-ash group-hover:text-bone">
                  write to me →
                </span>
              </a>

              <div>
                <ul className="flex flex-wrap gap-x-6 gap-y-3">
                  {[
                    ["GitHub", "https://github.com/codezeroexe"],
                    ["LinkedIn", "https://linkedin.com/in/srhari06/"],
                    ["Instagram", "https://www.instagram.com/code.zxro/"],
                    ["X", "https://x.com/codezeroexe"],
                  ].map(([label, href]) => (
                    <li key={label}>
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="fine border-b-2 border-transparent pb-1 transition-colors hover:border-bone hover:text-bone"
                      >
                        {label} ↗
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </Settle>

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-rule pt-5">
          <span className="fine text-ash">© {new Date().getFullYear()} Hari</span>
          <span className="fine text-ash">all work mine · all links real</span>
        </footer>
      </div>
      </main>

      <EditGate>
        <ViewportSwitcherSlot
          desktop={desktop}
          mobile={mobile}
          assets={stickerAssets}
        />
      </EditGate>
    </>
  );
}