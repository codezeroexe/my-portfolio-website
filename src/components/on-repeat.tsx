import type { WeekAlbum } from "@/lib/lastfm";

/**
 * This week's most-played album, printed as a record sleeve taped to the
 * sheet with the disc sliding out of it. Data comes from Last.fm and refreshes
 * with the page, hourly. The whole scrap is the link to the album.
 */
export function OnRepeat({ album }: { album: WeekAlbum }) {
  return (
    <a
      href={album.url}
      target="_blank"
      rel="noopener noreferrer"
      className="on-repeat group inline-flex items-center gap-5 sm:gap-7"
      aria-label={`On repeat this week: ${album.name} by ${album.artist}, on Last.fm`}
    >
      <span className="deck relative block shrink-0" aria-hidden>
        <span className="vinyl" />
        <span className="sleeve">
          {album.image ? (
            <img
              src={album.image}
              alt=""
              width={300}
              height={300}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="block h-full w-full object-cover"
            />
          ) : (
            // no cover on Last.fm: a blank sleeve with the title written on it
            <span className="note flex h-full w-full items-center justify-center p-3 text-center text-lg text-ground">
              {album.name}
            </span>
          )}
        </span>
        <span className="tape absolute z-10 -top-2.5 left-4 h-5 w-16 -rotate-6" />
      </span>

      <span className="block min-w-0">
        <span className="note block text-xl text-acid">on repeat this week</span>
        <span className="scream mt-2 block text-3xl leading-[0.9] break-words">
          {album.name}
        </span>
        <span className="zine mt-1.5 block text-sm text-ash">{album.artist}</span>
        <span className="mt-3 flex flex-wrap items-center gap-3">
          <span className="stamp fine">
            {album.plays} {album.plays === 1 ? "play" : "plays"}
          </span>
          <span className="fine text-ash transition-colors group-hover:text-bone">
            last.fm ↗
          </span>
        </span>
      </span>
    </a>
  );
}
