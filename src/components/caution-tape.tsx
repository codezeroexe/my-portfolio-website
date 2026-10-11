/**
 * Section divider: a strip of caution tape, in four printed variants.
 * Static markup and CSS only (see .caution in globals.css).
 *
 *  warn   WARNING between striped rims
 *  stop   DO NOT CROSS between striped rims
 *  chev   a run of black chevrons
 *  diag   plain diagonal stripes
 */
export type TapeKind = "warn" | "stop" | "chev" | "diag";

const WORDS: Partial<Record<TapeKind, { word: string; n: number; dot?: boolean }>> = {
  warn: { word: "WARNING", n: 4, dot: true },
  stop: { word: "DO NOT CROSS", n: 3 },
};

export function CautionTape({ kind, tilt }: { kind: TapeKind; tilt: number }) {
  const w = WORDS[kind];
  return (
    <div
      className={`caution caution--${kind}`}
      style={{ ["--tilt" as string]: `${tilt}deg` }}
      aria-hidden
    >
      {w &&
        Array.from({ length: w.n }, (_, i) => (
          <span key={i}>
            {w.dot && i > 0 && <i />}
            {w.word}
          </span>
        ))}
    </div>
  );
}
