/**
 * Merge touching stickers into one image per cluster ("mega stickers").
 *
 * Why: placements are percentages of their section but sizes are pixels, so
 * when the column narrows or a section reflows, stickers that were composed
 * touching (the HARI letters, BUILT, MATTER...) drift apart or crush together.
 * A cluster baked into a single image keeps its exact arrangement at every
 * width, and still moves with the section like any other sticker.
 *
 * How:
 *   1. Load the running dev server at the composition width of each
 *      breakpoint (desktop 1440, mobile 500 — the editor's preview widths).
 *   2. Find clusters: stickers in the same section and layer whose rotated
 *      boxes overlap.
 *   3. Hide everything but one cluster and screenshot it on a transparent
 *      background, so tilt, scale, stacking order and the drop shadows are
 *      captured exactly as the browser draws them. The device scale factor is
 *      the highest natural/displayed ratio in the cluster, so no member loses
 *      source resolution.
 *   4. Write public/stickers/merged/<name>.webp (WebP q92), swap the members
 *      in src/data/placements.json for one entry, and record the members in
 *      src/data/merged-stickers.json so the merge can be undone.
 *
 * Merged images carry their shadow already; globals.css turns the .sticker
 * filter off for anything under /stickers/merged/ so it is not drawn twice.
 *
 * Usage (dev server running, no unsaved editor draft):
 *   node scripts/merge-stickers.mjs            merge every cluster
 *   node scripts/merge-stickers.mjs --dry-run  list clusters, change nothing
 *   node scripts/merge-stickers.mjs --unmerge  restore the original stickers
 *
 * To edit a merged cluster: --unmerge, move the stickers in the editor, save,
 * commit the draft into placements.json, then merge again.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const ROOT = process.cwd();
const URL = process.env.SITE_URL ?? "http://localhost:3000/";
const PLACEMENTS = path.join(ROOT, "src/data/placements.json");
const LEDGER = path.join(ROOT, "src/data/merged-stickers.json");
const OUT_DIR = path.join(ROOT, "public/stickers/merged");
const SRC_PREFIX = "/stickers/merged/";
const BREAKPOINTS = [
  { key: "desktop", draft: "PLACEMENTS_DESKTOP", viewport: { width: 1440, height: 900 } },
  { key: "mobile", draft: "PLACEMENTS_MOBILE", viewport: { width: 500, height: 900 } },
];
// room around the union box for the baked drop-shadow (0 6px 12px)
const PAD = { x: 24, top: 24, bottom: 40 };
// Chromium and WebP both top out just under 16384px per side
const MAX_PX = 16000;

const args = new Set(process.argv.slice(2));
const readJson = (f, fallback) => (existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : fallback);
const writeJson = (f, v) => writeFileSync(f, JSON.stringify(v, null, 2) + "\n");

if (args.has("--unmerge")) {
  unmerge();
} else {
  await merge();
}

function unmerge() {
  const placements = readJson(PLACEMENTS);
  const ledger = readJson(LEDGER, {});
  for (const [name, entry] of Object.entries(ledger)) {
    const arr = placements[entry.breakpoint][entry.section];
    const i = arr.findIndex((s) => s.src === entry.src);
    if (i === -1) console.warn(`${name}: not placed any more, restoring nothing`);
    else arr.splice(i, 1, ...entry.members);
    rmSync(path.join(ROOT, "public", entry.src), { force: true });
    console.log(`unmerged ${name} (${entry.members.length} stickers)`);
  }
  writeJson(PLACEMENTS, placements);
  rmSync(LEDGER, { force: true });
}

async function merge() {
  for (const bp of BREAKPOINTS) {
    if (existsSync(path.join(ROOT, `placements.${bp.draft}.draft.json`))) {
      throw new Error(
        `placements.${bp.draft}.draft.json exists: the page renders the draft, not ` +
          `placements.json. Commit or delete it first.`,
      );
    }
  }
  const placements = readJson(PLACEMENTS);
  const ledger = readJson(LEDGER, {});
  const browser = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  );
  const jobs = [];

  try {
    for (const bp of BREAKPOINTS) {
      const page = await browser.newPage({ viewport: bp.viewport });
      await load(page);
      const items = await measure(page);
      await page.close();

      for (const cluster of findClusters(items)) {
        if (cluster.some((s) => s.src.startsWith(SRC_PREFIX))) continue;
        const section = cluster[0].section;
        const arr = placements[bp.key][section];
        // match DOM order back to placement entries: the field renders the
        // array in order, split into back and front layers
        const layerEntries = arr.filter((s) => (s.z ?? "front") === cluster[0].layer);
        const members = cluster.map((s) => layerEntries[s.index]);
        if (members.some((m, k) => !m || m.src !== cluster[k].src)) {
          throw new Error(`${bp.key}/${section}: page and placements.json disagree`);
        }
        const hash = createHash("sha1")
          .update(JSON.stringify(members))
          .digest("hex")
          .slice(0, 8);
        const name = `${bp.key}-${section}-${hash}`;
        jobs.push({ bp, section, cluster, members, name });
      }
    }

    if (args.has("--dry-run")) {
      for (const j of jobs) console.log(j.name, j.members.map((m) => m.src).join(" "));
      return;
    }

    mkdirSync(OUT_DIR, { recursive: true });
    for (const job of jobs) {
      const { bp, section, cluster, members, name } = job;
      const box = unionBox(cluster);
      const scale = Math.min(
        Math.max(...cluster.map((s) => s.ratio), 1),
        MAX_PX / box.w,
        MAX_PX / box.h,
      );
      const page = await browser.newPage({ viewport: bp.viewport, deviceScaleFactor: scale });
      await load(page);
      // A screenshot cannot reach past the page edge, and stickers often hang
      // over it (negative x, or y above the section). Slide the field into
      // view for the capture so nothing is cut off; the placement still uses
      // the unshifted box.
      const pageWidth = await page.evaluate(() => document.documentElement.clientWidth);
      const dx = box.x < 0 ? -box.x : Math.min(0, pageWidth - (box.x + box.w));
      const dy = Math.max(0, -box.y);
      await isolate(page, section, cluster.map((s) => s.domIndex), dx, dy);
      const png = await page.screenshot({
        clip: { x: box.x + dx, y: box.y + dy, width: box.w, height: box.h },
        fullPage: true,
        omitBackground: true,
        timeout: 600_000,
      });
      await page.close();
      const { width: pw } = await sharp(png).metadata();
      if (Math.abs(pw - box.w * scale) > 2) {
        throw new Error(`${name}: capture is ${pw}px wide, expected ${Math.round(box.w * scale)}`);
      }

      const src = `${SRC_PREFIX}${name}.webp`;
      await sharp(png).webp({ quality: 92, alphaQuality: 100, smartSubsample: true, effort: 6 }).toFile(path.join(ROOT, "public", src));

      // the merged entry sits where the last member was, so anything stacked
      // above the cluster stays above it
      const merged = {
        src,
        size: Math.round(box.w),
        tilt: 0,
        x: round(((box.x + box.w / 2 - box.field.left) / box.field.width) * 100),
        y: round(((box.y + box.h / 2 - box.field.top) / box.field.height) * 100),
        ...(cluster[0].layer === "back" ? { z: "back" } : {}),
      };
      const arr = placements[bp.key][section];
      const last = Math.max(...members.map((m) => arr.indexOf(m)));
      arr.splice(last, 1, merged);
      placements[bp.key][section] = arr.filter((s) => s === merged || !members.includes(s));
      ledger[name] = { breakpoint: bp.key, section, src, members };
      console.log(
        `merged ${name}: ${members.length} stickers -> ${src} ` +
          `(${Math.round(box.w * scale)}x${Math.round(box.h * scale)}px at ${scale.toFixed(2)}x)`,
      );
    }
  } finally {
    await browser.close();
  }

  if (jobs.length) {
    writeJson(PLACEMENTS, placements);
    writeJson(LEDGER, ledger);
  } else {
    console.log("no clusters to merge");
  }
}

async function load(page) {
  await page.goto(URL, { waitUntil: "networkidle", timeout: 120_000 });
  // lazy images: scroll the whole page so every sticker decodes
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 80));
    }
    scrollTo(0, 0);
  });
  await page.waitForFunction(
    () => [...document.querySelectorAll("img.sticker")].every((i) => !i.offsetParent || i.complete),
    null,
    { timeout: 60_000 },
  );
}

/** every visible field sticker, with its rotated box in document coordinates */
function measure(page) {
  return page.evaluate(() => {
    const out = [];
    for (const field of document.querySelectorAll("[data-sticker-field]")) {
      if (!field.offsetParent) continue;
      const f = field.getBoundingClientRect();
      const fieldBox = {
        left: f.left + scrollX,
        top: f.top + scrollY,
        width: f.width,
        height: f.height,
      };
      const counts = { front: 0, back: 0 };
      const imgs = [...field.querySelectorAll("img.sticker")];
      imgs.forEach((img, domIndex) => {
        const layer = img.closest(".z-20") ? "front" : "back";
        const r = img.getBoundingClientRect();
        out.push({
          section: field.dataset.section,
          layer,
          index: counts[layer]++,
          domIndex,
          src: img.getAttribute("src"),
          w: img.offsetWidth,
          h: img.offsetHeight,
          cx: r.left + r.width / 2 + scrollX,
          cy: r.top + r.height / 2 + scrollY,
          tilt: parseFloat(img.style.getPropertyValue("--tilt")) || 0,
          ratio: img.naturalWidth / img.offsetWidth,
          rect: { l: r.left + scrollX, t: r.top + scrollY, r: r.right + scrollX, b: r.bottom + scrollY },
          field: fieldBox,
        });
      });
    }
    return out;
  });
}

/** same section, same layer, rotated boxes overlapping (separating-axis test) */
function findClusters(items) {
  const corners = (s) => {
    const a = (s.tilt * Math.PI) / 180;
    const c = Math.cos(a);
    const n = Math.sin(a);
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => {
      const x = (u * s.w) / 2;
      const y = (v * s.h) / 2;
      return [s.cx + x * c - y * n, s.cy + x * n + y * c];
    });
  };
  const overlaps = (A, B) => {
    const pa = corners(A);
    const pb = corners(B);
    for (const P of [pa, pb]) {
      for (let i = 0; i < 4; i++) {
        const [x1, y1] = P[i];
        const [x2, y2] = P[(i + 1) % 4];
        const proj = (Q) => Q.map(([x, y]) => x * (y2 - y1) + y * (x1 - x2));
        const a = proj(pa);
        const b = proj(pb);
        if (Math.max(...a) < Math.min(...b) || Math.max(...b) < Math.min(...a)) return false;
      }
    }
    return true;
  };
  const parent = items.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (a.section === b.section && a.layer === b.layer && overlaps(a, b)) {
        parent[find(i)] = find(j);
      }
    }
  }
  const groups = new Map();
  items.forEach((s, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), s]));
  // keep DOM order inside a cluster so members line up with the array
  return [...groups.values()].filter((g) => g.length > 1).map((g) => g.sort((a, b) => a.domIndex - b.domIndex));
}

function unionBox(cluster) {
  const l = Math.min(...cluster.map((s) => s.rect.l)) - PAD.x;
  const t = Math.min(...cluster.map((s) => s.rect.t)) - PAD.top;
  const r = Math.max(...cluster.map((s) => s.rect.r)) + PAD.x;
  const b = Math.max(...cluster.map((s) => s.rect.b)) + PAD.bottom;
  const x = Math.floor(l);
  const y = Math.floor(t);
  return { x, y, w: Math.ceil(r) - x, h: Math.ceil(b) - y, field: cluster[0].field };
}

/** hide everything on the page except the cluster's stickers, on transparency */
function isolate(page, section, domIndexes, dx, dy) {
  return page.evaluate(
    ({ section, domIndexes, dx, dy }) => {
      const field = [...document.querySelectorAll(`[data-sticker-field][data-section="${section}"]`)].find(
        (f) => f.offsetParent,
      );
      const imgs = [...field.querySelectorAll("img.sticker")];
      domIndexes.forEach((i) => imgs[i].classList.add("merge-keep"));
      field.style.translate = `${dx}px ${dy}px`;
      const style = document.createElement("style");
      style.textContent = `
        html, body, * { background: transparent !important; backdrop-filter: none !important;
          box-shadow: none !important; text-shadow: none !important; border-color: transparent !important; }
        * { visibility: hidden !important; }
        canvas, video { display: none !important; }
        img.merge-keep { visibility: visible !important; }`;
      document.head.appendChild(style);
    },
    { section, domIndexes, dx, dy },
  );
}

function round(n) {
  return Math.round(n * 100) / 100;
}
