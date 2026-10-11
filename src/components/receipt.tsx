import { LOGOS } from "@/components/logo-sticker";

/**
 * The "about" facts and the tool marks, printed as one till receipt.
 *
 * Static markup only: the zigzag edge is a mask, the print is Space Mono, the
 * logos are the same ink SVGs the stickers use (their white keyline underlay
 * disappears on paper, which is what we want here).
 */
const FACTS: [string, string][] = [
  ["based", "Kerala → Pune"],
  ["studying", "AI, Symbiosis"],
  ["builds", "Python · React"],
  ["ships", "Next.js · WebGL"],
  ["also", "digital art"],
];

// code 39 would be honest; this is just irregular bars seeded from the name
const BARS = [2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 1, 2, 3, 1, 2, 1, 1, 3, 1, 2, 2, 1, 3, 1, 1, 2, 1, 1, 3, 2, 1, 2, 1, 3, 1, 1, 2, 3, 1, 2];

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="shrink-0">{k}</dt>
      <span className="receipt-dots" aria-hidden />
      <dd className="shrink-0 text-right font-bold">{v}</dd>
    </div>
  );
}

export function Receipt({ year }: { year: number }) {
  let x = 0;
  const bars = BARS.map((w, i) => {
    const r = i % 2 === 0 ? <rect key={i} x={x} y={0} width={w} height={24} /> : null;
    x += w;
    return r;
  });

  return (
    <div className="receipt-wrap">
      <div className="receipt fine">
        <p className="text-center text-[15px] font-bold tracking-[0.25em]">HARI</p>
        <p className="text-center">AI developer &amp; web designer · {year}</p>

        <hr className="receipt-rule" />

        <div className="md:grid md:grid-cols-2 md:gap-x-6">
          <dl className="space-y-1">
            {FACTS.map(([k, v]) => (
              <Line key={k} k={k} v={v} />
            ))}
          </dl>

          <hr className="receipt-rule md:hidden" />

          <div className="md:border-l-[1.5px] md:border-dashed md:border-current/55 md:pl-6">
            <p className="mb-2 opacity-70">tools used</p>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-2">
              {LOGOS.map((l) => (
                <li key={l.src} className="flex items-center gap-2">
                  <img src={l.src} alt="" width={18} height={18} loading="lazy" decoding="async" className="receipt-ink h-[18px] w-[18px] shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{l.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <hr className="receipt-rule" />

        <div className="flex items-baseline justify-between text-[15px] font-bold">
          <span>status</span>
          <span>open to work</span>
        </div>

        <svg className="mx-auto mt-3 h-[24px] w-[70%]" viewBox={`0 0 ${x} 24`} preserveAspectRatio="none" aria-hidden>
          <g fill="currentColor">{bars}</g>
        </svg>
        <p className="mt-2 text-center">thank you · come again</p>
      </div>
    </div>
  );
}
