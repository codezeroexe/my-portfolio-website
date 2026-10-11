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

/**
 * The most-played album of the last seven days, or null.
 *
 * Null covers every way this can go wrong — no key set, a rate limit, a quiet
 * week with nothing scrobbled — and the sticker simply is not printed. The key
 * is read on the server only and never reaches the page. Each of those says
 * why in the server log (Vercel's build and runtime logs), under
 * "[on-repeat]", since nothing on the page does.
 */
export async function weekAlbum(): Promise<WeekAlbum | null> {
  const key = process.env.LASTFM_API_KEY;
  if (!key) {
    console.warn("[on-repeat] LASTFM_API_KEY is not set, so no ticket");
    return null;
  }

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
      console.warn(`[on-repeat] Last.fm said ${res.status}: ${data.message ?? "no message"}`);
      return null;
    }
    const top = data.topalbums?.album?.[0];
    if (!top) {
      console.warn(`[on-repeat] nothing scrobbled by ${LASTFM_USER} in the last 7 days`);
      return null;
    }

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
  } catch (err) {
    console.warn("[on-repeat] could not reach Last.fm:", err);
    return null;
  }
}
