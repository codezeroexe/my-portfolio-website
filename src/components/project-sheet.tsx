import { repoUrl, type Project } from "@/lib/projects";
import { StickerField } from "@/components/sticker-field";
import type { SectionPlacements } from "@/lib/placements";

// short margin notes, not a second description
const NOTES: Record<string, string> = {
  zetavote: "runs on a laptop, on a plane",
  "yggdrasil-prototype": "friendly flags",
  "sqlshield-demo": "the bad version sits right beside it",
  "neural-fraud-detector-v3": "v1, v2, then this",
};

// no two panels sit square on the sheet
const TILTS = [-0.6, 0.5, -0.4, 0.6];
const CHIP_TILTS = [-2, 1.5, -1, 2.5, -1.5];
const STAMP_TILTS = [-3, 2.5, -2, 3];
// one accent per panel, round-robin like the tilts
const ACCENTS = [
  "var(--flare-red)",
  "var(--flare-amber)",
  "var(--flare-cyan)",
  "var(--flare-violet)",
];

const pushed = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });

/**
 * Four comic panels rather than four table rows: a hard bone rule, each with
 * its own offset shadow, and the whole panel is the link. No screenshots exist
 * for these repos, so the panel is typographic — the craft of the panel is the
 * argument, not a mockup.
 */
export function ProjectSheet({
  repos,
  desktop,
  mobile,
}: {
  repos: Project[];
  desktop: SectionPlacements;
  mobile: SectionPlacements;
}) {
  const DEV = process.env.NODE_ENV !== "production";
  return (
    <section id="projects" className="relative py-12">
      {DEV && <div data-editor-host="projects" />}
      <StickerField section="projects" stickers={desktop.projects} className="hidden lg:block" />
      <StickerField section="projects" stickers={mobile.projects} className="lg:hidden" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="fine text-ash">page 01 — the work</p>
          <h2 className="scream mt-3 text-5xl leading-[0.82] sm:text-7xl">
            WHAT I{" "}
            <span className="blank">BUILT</span>
          </h2>
        </div>
        <p className="fine text-ash">all linked · none sponsored</p>
      </div>

      <div className="mt-12 grid gap-9 md:grid-cols-2 md:gap-10">
        {repos.map((r, i) => (
          <a
            key={r.repo}
            href={repoUrl(r.repo)}
            target="_blank"
            rel="noopener noreferrer"
            aria-labelledby={`panel-${r.repo}`}
            className="panel"
            style={{
              ["--tilt" as string]: `${TILTS[i % TILTS.length]}deg`,
              ["--accent" as string]: ACCENTS[i % ACCENTS.length],
            }}
          >
            {/* the panel number is a sticker slot now. The element stays so the
                footprint and the absolutely-positioned box are unchanged and a
                digit cutout has somewhere to land, but it paints nothing. */}
            <span className="panel-num scream blank" aria-hidden>
              {String(i + 1).padStart(2, "0")}
            </span>

            <h3
              id={`panel-${r.repo}`}
              className="scream text-3xl leading-[0.88] sm:text-4xl"
            >
              {r.name}
            </h3>

            <p className="zine mt-3 max-w-sm text-sm text-ash">{r.description}</p>

            <p className="note mt-2 text-xl">{NOTES[r.repo] ?? "shipped"}</p>

            <ul className="mt-5 flex flex-wrap gap-1.5">
              {r.topics.map((t, j) => (
                <li
                  key={t}
                  className="chip"
                  style={{
                    ["--chip-tilt" as string]: `${CHIP_TILTS[(i + j) % CHIP_TILTS.length]}deg`,
                  }}
                >
                  {t}
                </li>
              ))}
            </ul>

            <span className="panel-foot">
              <span
                className="stamp fine"
                style={{
                  ["--stamp-tilt" as string]: `${STAMP_TILTS[i % STAMP_TILTS.length]}deg`,
                }}
              >
                pushed {pushed(r.pushed_at)}
              </span>
              <span className="scream repo-slab text-sm">repo ↗</span>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}