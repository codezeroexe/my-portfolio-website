import { Countdown } from "@/components/countdown";
import type { Paddock } from "@/lib/f1";

const DAY = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});
const HOUR = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false });

/**
 * A laminated paddock pass on a lanyard, and the timing sheet pinned beside
 * it. Static markup except the countdown; the look is all in globals.css
 * (.pass, .lanyard, .timing).
 */
export function PaddockPass({ data }: { data: Paddock }) {
  const { next, last, max, team } = data;
  const start = next ? new Date(next.startsAt) : null;

  return (
    <div className="mt-8 flex flex-col items-center gap-12 md:flex-row md:items-start md:gap-14">
      {next && start && (
        <div className="lanyard-wrap">
          <div className="lanyard" aria-hidden>
            <span>PADDOCK · PADDOCK · PADDOCK · PADDOCK</span>
          </div>
          <div className="pass fine">
            <div className="pass-clip" aria-hidden />
            <div className="pass-head">
              <span>PADDOCK</span>
              <span>{data.season || "F1"} · R{next.round}</span>
            </div>
            <p className="pass-label">next race</p>
            <p className="pass-race">{next.name.replace(/ Grand Prix$/i, "")}</p>
            <p className="pass-gp">Grand Prix</p>
            <p className="mt-2">{next.circuit}</p>
            <p className="opacity-70">{next.place}</p>
            <p className="mt-3 font-bold">
              {DAY.format(start)} · {HOUR.format(start)} UTC
            </p>
            <p className="pass-count">
              <Countdown to={next.startsAt} />
            </p>
            <div className="pass-foot">
              <span className="pass-tag">VER</span>
              <span className="pass-tag pass-tag-red">RBR</span>
            </div>
          </div>
        </div>
      )}

      <div className="timing fine">
        {last && (
          <>
            <p className="opacity-70">last race · round {last.round}</p>
            <p className="timing-title">{last.name}</p>
            <ol className="timing-rows">
              {last.podium.map((p) => (
                <li key={p.pos} className={p.code === "VER" ? "timing-max" : undefined}>
                  <span>P{p.pos}</span>
                  <b>{p.code}</b>
                  <span className="truncate opacity-70">{p.team}</span>
                </li>
              ))}
              {last.max && !last.podium.some((p) => p.code === "VER") && (
                <li className="timing-max">
                  <span>P{last.max.pos}</span>
                  <b>VER</b>
                  <span className="truncate opacity-70">from P{last.max.grid}</span>
                </li>
              )}
            </ol>
          </>
        )}

        {(max || team) && (
          <>
            <p className="mt-5 opacity-70">championship</p>
            <ol className="timing-rows">
              {max && (
                <li className="timing-max">
                  <span>P{max.pos}</span>
                  <b>VER</b>
                  <span>
                    {max.points} pts · {max.wins} {max.wins === "1" ? "win" : "wins"}
                  </span>
                </li>
              )}
              {team && (
                <li>
                  <span>P{team.pos}</span>
                  <b>RBR</b>
                  <span>{team.points} pts · constructors</span>
                </li>
              )}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}
