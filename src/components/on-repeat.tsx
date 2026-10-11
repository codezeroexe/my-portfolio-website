import type { CSSProperties } from "react";
import type { WeekAlbum } from "@/lib/lastfm";

/**
 * This week's most-played album from Last.fm, printed as a gig ticket: the
 * cover full-bleed on the stub, the title on the body, perforated between.
 * The card takes the cover's own accent colour (lib/accent.ts), so it changes
 * with the music. Refreshed with the page, hourly; the whole ticket is the
 * link to the album.
 */
export function OnRepeat({ album }: { album: WeekAlbum }) {
  return (
    <a
      href={album.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`On repeat this week: ${album.name} by ${album.artist}, on Last.fm`}
      className="np-ticket"
      style={
        {
          "--tk-bg": album.accent.bg,
          "--tk-fg": album.accent.fg,
        } as CSSProperties
      }
    >
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
        <span className="fine block">admit one · on repeat</span>
        <span className="scream mt-1.5 block text-2xl leading-[0.9] break-words sm:text-3xl">
          {album.name}
        </span>
        <span className="zine mt-1 block text-sm">{album.artist}</span>
        <span className="fine mt-2 flex justify-between gap-3">
          <span>
            {album.plays} {album.plays === 1 ? "play" : "plays"}
          </span>
          <span>last.fm ↗</span>
        </span>
      </span>
    </a>
  );
}
