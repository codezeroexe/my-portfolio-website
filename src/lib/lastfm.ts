import { accentFromUrl, PAPER, type Accent } from "@/lib/accent";

export const LASTFM_USER = "srhxri";

export const lastfmProfile = `https://www.last.fm/user/${LASTFM_USER}`;

export type WeekAlbum = {
  name: string;
  artist: string;
  url: string;
  /** null when Last.fm has no cover for it */
  image: string | null;
  plays: number;
  /** the ticket colour, read from the cover */
  accent: Accent;
};

// the slice of user.getTopAlbums the sticker reads
type LfmImage = { "#text": string; size: string };
type LfmAlbum = {
  name: string;
  playcount: string;
  url: string;
  artist: { name: string };
  image?: LfmImage[];
};
// an error comes back as { error, message }, sometimes with a 200
type LfmTopAlbums = { topalbums?: { album?: LfmAlbum[] }; error?: number; message?: string };

export type WeekResult =
  | { album: WeekAlbum; why?: undefined }
  /** why there is no ticket, in a line safe to print on a preview */
  | { album: null; why: string };

/**
 * The most-played album of the last seven days, or the reason there is none.
 *
 * No album covers every way this can go wrong — no key set, a rejected key, a
 * rate limit, a quiet week with nothing scrobbled — and the ticket simply is
 * not printed. The reason goes to the server log under "[on-repeat]" (Vercel's
 * build and runtime logs), and the page shows it on preview deployments. The
 * key is read on the server only and never appears in either.
 */
export async function weekAlbum(): Promise<WeekResult> {
  const key = process.env.LASTFM_API_KEY?.trim();
  const skip = (why: string) => {
    const safe = key ? why.split(key).join("***") : why;
    console.warn(`[on-repeat] ${safe}`);
    return { album: null, why: safe } as const;
  };
  if (!key) return skip("LASTFM_API_KEY is not set for this deployment");

  const qs = new URLSearchParams({
    method: "user.gettopalbums",
    user: LASTFM_USER,
    period: "7day",
    limit: "1",
    api_key: key,
    format: "json",
  });

  try {
    const res = await fetch(`https://ws.audioscrobbler.com/2.0/?${qs}`, {
      next: { revalidate: 3600 },
    });
    const data: LfmTopAlbums = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      return skip(`Last.fm said ${res.status}: ${data.message ?? "no message"}`);
    }
    const top = data.topalbums?.album?.[0];
    if (!top) return skip(`nothing scrobbled by ${LASTFM_USER} in the last 7 days`);

    // largest first; an empty #text means Last.fm has no art for it
    const image =
      ["extralarge", "large", "medium"]
        .map((s) => top.image?.find((i) => i.size === s)?.["#text"])
        .find((u) => u) ?? null;

    return {
      album: {
        name: top.name,
        artist: top.artist.name,
        url: top.url,
        image,
        plays: Number(top.playcount) || 0,
        accent: image ? await accentFromUrl(image) : PAPER,
      },
    };
  } catch (err) {
    return skip(`could not reach Last.fm: ${err instanceof Error ? err.message : String(err)}`);
  }
}
