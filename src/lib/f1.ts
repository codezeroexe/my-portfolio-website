/**
 * Max Verstappen and Red Bull, from the Jolpica F1 API (the maintained
 * successor to Ergast, same JSON shape): the next race, the last result and
 * the two championship tables.
 *
 * Every field is optional on the way in and the whole thing degrades: a
 * missing piece is simply not printed, and if nothing comes back the section
 * is not rendered at all. Fetches are cached for an hour (the page revalidates
 * on the same clock) and time out so a slow API cannot hold the page up.
 */
const API = "https://api.jolpi.ca/ergast/f1/current";
const DRIVER = "max_verstappen";
const TEAM = "red_bull";

export type PodiumRow = { pos: number; code: string; name: string; team: string };

export type Paddock = {
  season: string;
  /** null once the season has no races left */
  next: { round: string; name: string; circuit: string; place: string; startsAt: string } | null;
  last: {
    round: string;
    name: string;
    podium: PodiumRow[];
    max: { pos: string; grid: string; status: string } | null;
  } | null;
  max: { pos: string; points: string; wins: string } | null;
  team: { pos: string; points: string } | null;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
async function get(path: string): Promise<any | null> {
  try {
    const res = await fetch(`${API}/${path}.json`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json())?.MRData ?? null;
  } catch (e) {
    console.warn(`[f1] ${path}: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

export function startOf(race: any): string {
  const date = str(race?.date);
  if (!date) return "";
  const time = str(race?.time) || "00:00:00Z";
  return `${date}T${time}`;
}

export function parsePaddock(m: {
  next: any;
  last: any;
  drivers: any;
  teams: any;
}): Paddock | null {
  const nextRace = m.next?.RaceTable?.Races?.[0];
  const lastRace = m.last?.RaceTable?.Races?.[0];
  const dList: any[] = m.drivers?.StandingsTable?.StandingsLists?.[0]?.DriverStandings ?? [];
  const tList: any[] = m.teams?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings ?? [];

  const startsAt = startOf(nextRace);
  const next =
    nextRace && startsAt && !Number.isNaN(Date.parse(startsAt))
      ? {
          round: str(nextRace.round),
          name: str(nextRace.raceName),
          circuit: str(nextRace.Circuit?.circuitName),
          place: [nextRace.Circuit?.Location?.locality, nextRace.Circuit?.Location?.country]
            .filter(Boolean)
            .join(", "),
          startsAt,
        }
      : null;

  const results: any[] = lastRace?.Results ?? [];
  const mr = results.find((r) => r?.Driver?.driverId === DRIVER);
  const last = lastRace
    ? {
        round: str(lastRace.round),
        name: str(lastRace.raceName),
        podium: results.slice(0, 3).map((r) => ({
          pos: Number(r.position),
          code: str(r.Driver?.code) || str(r.Driver?.familyName).slice(0, 3).toUpperCase(),
          name: str(r.Driver?.familyName),
          team: str(r.Constructor?.name),
        })),
        max: mr ? { pos: str(mr.position), grid: str(mr.grid), status: str(mr.status) } : null,
      }
    : null;

  const dm = dList.find((d) => d?.Driver?.driverId === DRIVER);
  const tm = tList.find((t) => t?.Constructor?.constructorId === TEAM);

  const out: Paddock = {
    season: str(nextRace?.season) || str(lastRace?.season) || str(m.drivers?.StandingsTable?.season),
    next,
    last,
    max: dm ? { pos: str(dm.position), points: str(dm.points), wins: str(dm.wins) } : null,
    team: tm ? { pos: str(tm.position), points: str(tm.points) } : null,
  };
  return out.next || out.last || out.max || out.team ? out : null;
}

export async function paddock(): Promise<Paddock | null> {
  const [next, last, drivers, teams] = await Promise.all([
    get("next"),
    get("last/results"),
    get("driverstandings"),
    get("constructorstandings"),
  ]);
  return parsePaddock({ next, last, drivers, teams });
}
