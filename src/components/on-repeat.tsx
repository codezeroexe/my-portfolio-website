import type { CSSProperties } from "react";
import type { WeekAlbum } from "@/lib/lastfm";

/**
 * This week's most-played album from Last.fm, printed as a worn gig ticket:
 * the cover full-bleed on the stub, the title on the body, perforated between,
 * with paper grain, a crease, scuffed corners and a frayed edge laid over the
 * lot. The card takes the cover's own accent colour (lib/accent.ts), so it
 * changes with the music. Refreshed with the page, hourly; the whole ticket is
 * the link to the album.
 *
 * `flip` puts the stub on the right, for the phone layout where a sticker
 * lands on that corner.
 */
export function OnRepeat({ album, flip = false }: { album: WeekAlbum; flip?: boolean }) {
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
              {album.name}
            </span>
          )}
        </span>
        <span className="tk-body">
          <span className="tk-small block font-bold">admit one · on repeat</span>
          {/* a long name steps down a size and stops at two lines, so the
              ticket keeps its height and clear of the stickers under it */}
          <span
            title={album.name}
            className={`tk-title mt-1.5 line-clamp-2 ${album.name.length > 9 ? "text-lg" : "text-xl sm:text-2xl"}`}
          >
            {album.name}
          </span>
          <span className="tk-small mt-1 block text-[0.8rem] normal-case tracking-normal">
            {album.artist}
          </span>
          <span className="tk-small mt-2 flex justify-between gap-3">
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
