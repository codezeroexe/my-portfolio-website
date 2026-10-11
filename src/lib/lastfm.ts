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
type LfmTopAlbums = { topalbums?: { album?: LfmAlbum[] } };

/**
 * The most-played album of the last seven days, or null.
 *
 * Null covers every way this can go wrong — no key set, a rate limit, a quiet
 * week with nothing scrobbled — and the sticker simply is not printed. The key
 * is read on the server only and never reaches the page.
 */
export async function weekAlbum(): Promise<WeekAlbum | null> {
  const key = process.env.LASTFM_API_KEY;
  if (!key) return null;

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
    if (!res.ok) return null;
    const data: LfmTopAlbums = await res.json();
    const top = data.topalbums?.album?.[0];
    if (!top) return null;

    // largest first; an empty #text means Last.fm has no art for it
    const image =
      ["extralarge", "large", "medium"]
        .map((s) => top.image?.find((i) => i.size === s)?.["#text"])
        .find((u) => u) ?? null;

    return {
      name: top.name,
      artist: top.artist.name,
      url: top.url,
      image,
      plays: Number(top.playcount) || 0,
      accent: image ? await accentFromUrl(image) : PAPER,
    };
  } catch {
    return null;
  }
}
