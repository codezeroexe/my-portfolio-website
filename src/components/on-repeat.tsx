import type { WeekAlbum } from "@/lib/lastfm";

/**
 * This week's most-played album from Last.fm, refreshed with the page hourly.
 * The whole scrap is the link to the album.
 *
 * Five print treatments while the look is being chosen — see
 * on-repeat-picker.tsx for how they are switched. Once one is picked the
 * others go.
 */

export type OnRepeatStyle = "sleeve" | "cassette" | "ticket" | "note" | "xerox";

export const ON_REPEAT_STYLES: { key: OnRepeatStyle; label: string }[] = [
  { key: "sleeve", label: "record sleeve" },
  { key: "cassette", label: "cassette" },
  { key: "ticket", label: "ticket stub" },
  { key: "note", label: "polaroid + note" },
  { key: "xerox", label: "xerox cutout" },
];

const plays = (n: number) => `${n} ${n === 1 ? "play" : "plays"}`;
const label = (a: WeekAlbum) =>
  `On repeat this week: ${a.name} by ${a.artist}, on Last.fm`;

function Cover({ album }: { album: WeekAlbum }) {
  return album.image ? (
    <img
      src={album.image}
      alt=""
      width={300}
      height={300}
      referrerPolicy="no-referrer"
      className="block h-full w-full object-cover"
    />
  ) : (
    // no cover on Last.fm: the title written on blank card instead
    <span className="note flex h-full w-full items-center justify-center bg-[#f7f6f1] p-2 text-center text-base text-ground">
      {album.name}
    </span>
  );
}

function Link({
  album,
  className,
  children,
}: {
  album: WeekAlbum;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={album.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label(album)}
      className={`group ${className}`}
    >
      {children}
    </a>
  );
}

/** a record sleeve taped to the sheet, the disc sliding out towards the words */
function Sleeve({ album }: { album: WeekAlbum }) {
  return (
    <Link album={album} className="on-repeat inline-flex items-center gap-4 sm:gap-5">
      <span className="block max-w-[15rem] min-w-0 text-right">
        <span className="note block text-lg text-acid">on repeat this week</span>
        <span className="scream mt-1.5 block text-2xl leading-[0.9] break-words sm:text-3xl">
          {album.name}
        </span>
        <span className="zine mt-1 block text-sm text-ash">{album.artist}</span>
        <span className="mt-2.5 flex flex-wrap items-center justify-end gap-3">
          <span className="stamp fine">{plays(album.plays)}</span>
          <span className="fine text-ash transition-colors group-hover:text-bone">
            last.fm ↗
          </span>
        </span>
      </span>
      <span className="deck relative block shrink-0" aria-hidden>
        <span className="vinyl" />
        <span className="sleeve">
          <Cover album={album} />
        </span>
        <span className="tape absolute z-10 -top-3 right-3 h-5 w-16 rotate-6" />
      </span>
    </Link>
  );
}

/** a cassette with the cover as its J-card and the title on the label */
function Cassette({ album }: { album: WeekAlbum }) {
  return (
    <Link album={album} className="np-cassette inline-block">
      <span className="note block text-right text-lg text-acid">on repeat this week</span>
      <span className="cas-body mt-1" aria-hidden>
        <span className="cas-label">
          <span className="cas-cover">
            <Cover album={album} />
          </span>
          <span className="block min-w-0 flex-1">
            <span className="note block truncate text-xl leading-none text-ground">
              {album.name}
            </span>
            <span className="fine mt-1 block truncate text-ground/70">{album.artist}</span>
          </span>
          <span className="scream cas-side">A</span>
        </span>
        <span className="cas-window">
          <span className="cas-reel" />
          <span className="cas-tape" />
          <span className="cas-reel" />
        </span>
      </span>
      <span className="mt-2.5 flex items-center justify-end gap-3">
        <span className="stamp fine">{plays(album.plays)}</span>
        <span className="fine text-ash transition-colors group-hover:text-bone">last.fm ↗</span>
      </span>
    </Link>
  );
}

/** a gig ticket: cover on the stub, the title on the body, perforated between */
function Ticket({ album }: { album: WeekAlbum }) {
  return (
    <Link album={album} className="np-ticket">
      <span className="tk-stub" aria-hidden>
        <Cover album={album} />
      </span>
      <span className="tk-body">
        <span className="fine block">admit one · on repeat</span>
        <span className="scream mt-1.5 block text-2xl leading-[0.9] break-words sm:text-3xl">
          {album.name}
        </span>
        <span className="zine mt-1 block text-sm">{album.artist}</span>
        <span className="fine mt-2 flex justify-between gap-3">
          <span>{plays(album.plays)}</span>
          <span>last.fm ↗</span>
        </span>
      </span>
    </Link>
  );
}

/** the cover as a small taped polaroid with a sticky note stuck across it */
function Note({ album }: { album: WeekAlbum }) {
  return (
    <Link album={album} className="np-note relative inline-block">
      <span className="nt-photo" aria-hidden>
        <span className="block aspect-square">
          <Cover album={album} />
        </span>
        <span className="tape absolute -top-3 left-1/2 h-5 w-16 -translate-x-1/2 -rotate-3" />
      </span>
      <span className="nt-note note">
        <span className="block text-base leading-tight">on repeat this week:</span>
        <span className="mt-1 block text-2xl leading-none font-bold break-words">
          {album.name}
        </span>
        <span className="block text-lg leading-tight">– {album.artist}</span>
        <span className="mt-1 block text-base leading-tight underline decoration-1 underline-offset-2">
          {plays(album.plays)} ↗
        </span>
      </span>
    </Link>
  );
}

/** a photocopied cover, torn out, with the title cut from slabs */
function Xerox({ album }: { album: WeekAlbum }) {
  const words = album.name.split(/\s+/).filter(Boolean);
  return (
    <Link album={album} className="np-xerox relative inline-flex flex-col items-end">
      <span className="xr-copy" aria-hidden>
        <Cover album={album} />
      </span>
      <span className="xr-tag fine">on repeat this week</span>
      <span className="xr-words" aria-hidden>
        {words.map((w, i) => (
          <span key={i} className="scream xr-word" data-i={i % 3}>
            {w}
          </span>
        ))}
      </span>
      <span className="zine mt-2 text-sm text-bone">
        {album.artist} <span className="fine text-ash">· {plays(album.plays)} ↗</span>
      </span>
    </Link>
  );
}

export function OnRepeat({
  album,
  style = "sleeve",
}: {
  album: WeekAlbum;
  style?: OnRepeatStyle;
}) {
  switch (style) {
    case "cassette":
      return <Cassette album={album} />;
    case "ticket":
      return <Ticket album={album} />;
    case "note":
      return <Note album={album} />;
    case "xerox":
      return <Xerox album={album} />;
    default:
      return <Sleeve album={album} />;
  }
}
