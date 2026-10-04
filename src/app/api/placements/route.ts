import { createHash, timingSafeEqual } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { draftFile } from "@/lib/placements";

/**
 * Save endpoint for the sticker placement editor.
 *
 * Two modes, branched on NODE_ENV:
 *
 * - Development: validates and writes a draft file the page reads directly,
 *   so saving shows up on reload with no further step.
 * - Production: validates the same way, then commits
 *   `src/data/placements.json` to GitHub through the Contents API, which is
 *   what triggers Vercel to redeploy. The serverless filesystem is ephemeral,
 *   so writing a file here would vanish with the instance — git is the only
 *   persistence that survives.
 *
 * Production saves require a key: the editor sends `?key=` in the URL, the
 * client forwards it in the POST body, and it is compared here against
 * EDIT_KEY with a timing-safe compare. Wrong or missing key is a 401 with a
 * plain message the editor shows verbatim. The key lives only in the Vercel
 * dashboard, never in the repo — anyone reading this file learns where to
 * send the key, not what it is.
 *
 * The body is untrusted input from the page in both modes, so every field is
 * validated before it reaches the filesystem or the API: the name is a fixed
 * pattern, each sticker is checked against the asset naming and bounds, and
 * problems are collected into a 400 that names the offender rather than
 * throwing into an empty 500.
 */

// Single-repo tool, not a platform: the target never changes, so it is a
// constant rather than configuration. The token is env-only (see above).
const GH_OWNER = "codezeroexe";
const GH_REPO = "my-portfolio-website";
const PLACEMENTS_PATH = "src/data/placements.json";

const SIZE = { min: 8, max: 800 };
const POS = { min: -50, max: 150 };
// One folder deep is allowed now that letters live in /stickers/letters/A/ and
// friends. Each segment is still constrained to the same safe characters as the
// filename, so this cannot climb out of public/stickers even though the pattern
// now admits a slash.
//
// Upper case is allowed because it has to be: the letter folders on disk are
// A-Z, and page.tsx builds its paths from readdirSync, so a placed letter
// arrives here as /stickers/letters/H/h-14.webp. Rejecting it meant every
// letter sticker made the whole save fail. Upper case costs nothing here — the
// character class still admits no dot and no slash, so traversal stays
// impossible.
const SRC = /^\/stickers\/(?:[a-zA-Z0-9-]+\/)*[a-zA-Z0-9-]+\.webp$/;

type Incoming = {
  name?: unknown;
  stickers?: unknown;
  key?: unknown;
};

const num = (v: unknown, lo: number, hi: number): number | null => {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.min(hi, Math.max(lo, v));
};

type Normalised = {
  src: string;
  size: number;
  tilt: number;
  x: number;
  y: number;
  z?: "back";
};

const normalise = (): Normalised[] => [];

export async function POST(req: Request) {
  const isProd = process.env.NODE_ENV === "production";

  let body: Incoming;
  try {
    body = (await req.json()) as Incoming;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (typeof body.name !== "string" || !/^[A-Z_][A-Z0-9_]*$/.test(body.name)) {
    return NextResponse.json({ error: "bad name" }, { status: 400 });
  }
  const SECTIONS = ["hero", "projects", "about", "contact"] as const;
  const sections = (body as { sections?: unknown }).sections as
    | Record<string, unknown>
    | undefined;
  if (!sections || typeof sections !== "object") {
    return NextResponse.json({ error: "bad sections" }, { status: 400 });
  }
  const flat: { section: string; raw: unknown; i: number }[] = [];
  for (const key of SECTIONS) {
    const arr = sections[key];
    if (!Array.isArray(arr) || arr.length > 400) {
      return NextResponse.json({ error: `bad stickers in ${key}` }, { status: 400 });
    }
    arr.forEach((raw, i) => flat.push({ section: key, raw, i }));
  }

  // Collected rather than thrown. A throw inside this map used to escape the
  // handler entirely: Next returned a 500 with an empty body, and the editor's
  // res.json() then died with "Unexpected end of JSON input" — which says
  // nothing about which sticker was wrong or why. Now the offender is named.
  const problems: string[] = [];
  const out: Record<string, ReturnType<typeof normalise>> = {};

  for (const key of SECTIONS) out[key] = [];
  for (const { section, raw, i } of flat) {
    const s = raw as Record<string, unknown>;
    if (typeof s.src !== "string" || !SRC.test(s.src)) {
      problems.push(`${section} sticker ${i}: bad src ${JSON.stringify(s.src)}`);
      continue;
    }
    const size = num(s.size, SIZE.min, SIZE.max);
    const x = num(s.x, POS.min, POS.max);
    const y = num(s.y, POS.min, POS.max);
    const tilt = num(s.tilt, -360, 360);
    if (size === null || x === null || y === null || tilt === null) {
      problems.push(`${section} sticker ${i}: bad numbers`);
      continue;
    }
    const z = s.z === "back" ? "back" : "front";
    out[section].push({ src: s.src, size: Math.round(size), tilt, x, y, ...(z === "back" ? { z } : {}) });
  }

  if (problems.length) {
    return NextResponse.json(
      { error: problems.slice(0, 5).join("; ") },
      { status: 400 },
    );
  }

  const file = path.join(process.cwd(), draftFile(body.name));
  // Pure JSON, no leading comments. This used to carry `// written by the
  // sticker editor…` header lines for a human about to paste it, but the page
  // now reads this file directly and JSON.parse rejects a comment. Provenance
  // moved into a writtenAt field, which a parser can see and a reader still can.
  const total = SECTIONS.reduce((n, k) => n + out[k].length, 0);

  if (!isProd) {
    const body_text = `${JSON.stringify(
      { writtenAt: new Date().toISOString(), name: body.name, count: total, sections: out },
      null,
      2,
    )}\n`;

    try {
      await writeFile(file, body_text, "utf8");
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, file: draftFile(body.name), count: total });
  }

  // Production: the key first, before any network calls. Compared in constant
  // time so a wrong key costs the same as a right one; a missing EDIT_KEY is
  // a server misconfiguration, reported as 500 rather than locking everyone
  // out with a 401 they cannot fix from the editor.
  const want = process.env.EDIT_KEY;
  const got = typeof body.key === "string" ? body.key : "";
  if (!want) {
    return NextResponse.json({ error: "server missing EDIT_KEY" }, { status: 500 });
  }
  const a = createHash("sha256").update(got).digest();
  const b = createHash("sha256").update(want).digest();
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "wrong key" }, { status: 401 });
  }

  // Merge, don't replace: each save carries one side (desktop or mobile), and
  // the file holds both. Read-modify-write through the Contents API, which is
  // why the current sha is fetched first — committing blind would 409 on any
  // concurrent change, including Vercel's own.
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "server missing GITHUB_TOKEN" }, { status: 500 });
  }
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const side = body.name === "PLACEMENTS_DESKTOP" ? "desktop" : "mobile";
  try {
    const cur = await fetch(
      `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${PLACEMENTS_PATH}?ref=main`,
      { headers },
    );
    if (!cur.ok) {
      return NextResponse.json(
        { error: `github read failed: HTTP ${cur.status}` },
        { status: 502 },
      );
    }
    const curJson = (await cur.json()) as { sha?: string; content?: string };
    if (typeof curJson.sha !== "string" || typeof curJson.content !== "string") {
      return NextResponse.json({ error: "github read failed: bad shape" }, { status: 502 });
    }
    const doc = JSON.parse(Buffer.from(curJson.content, "base64").toString("utf8")) as {
      desktop?: unknown;
      mobile?: unknown;
    };
    doc[side] = out;
    const put = await fetch(
      `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${PLACEMENTS_PATH}`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({
          message: `stickers: save ${side} placements from the editor`,
          content: Buffer.from(JSON.stringify(doc, null, 2) + "\n").toString("base64"),
          sha: curJson.sha,
          branch: "main",
        }),
      },
    );
    if (!put.ok) {
      return NextResponse.json(
        { error: `github write failed: HTTP ${put.status}` },
        { status: 502 },
      );
    }
    const putJson = (await put.json()) as { commit?: { sha?: string } };
    const short =
      typeof putJson.commit?.sha === "string" ? putJson.commit.sha.slice(0, 7) : "ok";
    return NextResponse.json({
      ok: true,
      commit: short,
      count: total,
      note: "committed — redeploy takes about a minute",
    });
  } catch (e) {
    return NextResponse.json(
      { error: `github unreachable: ${(e as Error).message}` },
      { status: 502 },
    );
  }
}