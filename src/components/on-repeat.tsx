import type { CSSProperties } from "react";
import type { WeekAlbum } from "@/lib/lastfm";

/**
 * This week's most-played album from Last.fm, printed as a worn gig ticket:
 * the whole cover on a square stub, the title on the body, perforated
 * between, with the wear laid over the lot. The card takes the cover's own
 * accent colour (lib/accent.ts), so it changes with the music. Refreshed with
 * the page, hourly; the whole ticket is the link to the album.
 *
 * `flip` puts the stub on the right, for the phone layout where a sticker
 * lands on that corner.
 */
export function OnRepeat({ album, flip = false }: { album: WeekAlbum; flip?: boolean }) {
  const title = shortTitle(album.name);
  const fit = fitTitle(title);
  const artist = fitArtist(album.artist);
  return (
    <a
      href={album.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`On repeat this week: ${album.name} by ${album.artist}, on Last.fm`}
      className={`np-ticket${flip ? " tk-flip" : ""}`}
      style={
        {
          "--tk-bg": album.accent.bg,
          "--tk-fg": album.accent.fg,
        } as CSSProperties
      }
    >
      <span className="tk-card">
        <span className="tk-stub" aria-hidden>
          {album.image ? (
            <img
              src={album.image}
              alt=""
              width={300}
              height={300}
              referrerPolicy="no-referrer"
              className="block h-full w-full object-cover"
            />
          ) : (
            // no cover on Last.fm: the title written on the stub instead
            <span className="note flex h-full w-full items-center justify-center p-2 text-center text-base">
              {title}
            </span>
          )}
        </span>
        <span className="tk-body">
          <span className="tk-small block font-bold">admit one · on repeat</span>
          <span
            title={album.name}
            className="tk-title mt-1.5 line-clamp-4"
            style={{ fontSize: fit.size }}
          >
            {title}
          </span>
          <span
            title={album.artist}
            className="tk-small mt-1 block truncate normal-case tracking-normal"
            style={{ fontSize: artist }}
          >
            {album.artist}
          </span>
          <span className="tk-small mt-auto flex justify-between gap-3">
            <span>
              {album.plays} {album.plays === 1 ? "play" : "plays"}
            </span>
            <span>last.fm ↗</span>
          </span>
        </span>
      </span>
    </a>
  );
}

// Fitting the names. Both ticket faces are monospaced (measured: Rubik Mono
// One 0.85em a character, Space Mono 0.612em), so how a name wraps at a given
// size is plain arithmetic and is worked out here rather than in the browser.
// Sizes come out in cqi, against the body's text column (a size container in
// globals.css), so a narrower ticket on a small phone scales them down without
// changing the wrap.
const COLUMN = 179; // px: the body's text column at full width (globals.css)
const TITLE_ROOM = 50; // px: the height left for the title in the 9rem card
const TITLE_EM = 0.86; // a character plus the title's 0.01em tracking
const ARTIST_EM = 0.612;

const cqi = (px: number) => `${((px / COLUMN) * 100).toFixed(2)}cqi`;

/** lines `text` takes at `perLine` characters, breaking long words anywhere */
function lineCount(text: string, perLine: number) {
  let lines = 0;
  let used = perLine;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (used + 1 + word.length <= perLine) {
      used += 1 + word.length;
      continue;
    }
    lines += Math.ceil(word.length / perLine);
    used = word.length % perLine || perLine;
  }
  return Math.max(lines, 1);
}

/**
 * The largest size, 30px down to 11px, at which the whole title fits the
 * room on the card. Past that (seventy-odd characters) it stops at four
 * lines with an ellipsis; the full name stays in the link's label and the
 * hover title.
 */
function fitTitle(title: string) {
  for (let px = 30; px >= 11; px -= 0.25) {
    const perLine = Math.floor(COLUMN / (TITLE_EM * px));
    if (lineCount(title, perLine) * px <= TITLE_ROOM) return { size: cqi(px) };
  }
  return { size: cqi(11) };
}

/** one line: 0.8rem, stepping down to 10.5px, then cut with an ellipsis */
function fitArtist(artist: string) {
  const px = Math.min(12.8, Math.max(10.5, COLUMN / (ARTIST_EM * artist.length)));
  return cqi(px);
}

// Last.fm keeps the release's full name; the ticket prints the album's
const EDITION =
  /\s*(?:[([][^)\]]*\b(?:deluxe|remaster(?:ed)?|edition|expanded|anniversary|bonus|explicit|reissue|version)\b[^)\]]*[)\]]|-\s+(?:single|ep|deluxe(?:\s+edition)?|(?:\d{4}\s+)?remaster(?:ed)?(?:\s+\d{4})?))\s*$/i;

/** "Blonde (Deluxe Edition) [Remastered]" -> "Blonde" */
function shortTitle(name: string) {
  let out = name.trim();
  for (let prev = ""; prev !== out; ) {
    prev = out;
    out = out.replace(EDITION, "");
  }
  return out || name;
}
