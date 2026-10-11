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

// EAN-13, the shop kind: 95 modules, three tall guard bars, digits underneath.
const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const G = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
const R = ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"];
const PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

function ean13(first12: string) {
  const d = [...first12].map(Number);
  const sum = d.reduce((t, n, i) => t + n * (i % 2 ? 3 : 1), 0);
  const digits = [...d, (10 - (sum % 10)) % 10];
  const par = PARITY[digits[0]];
  let bits = "101";
  for (let i = 0; i < 6; i++) bits += (par[i] === "L" ? L : G)[digits[i + 1]];
  bits += "01010";
  for (let i = 7; i < 13; i++) bits += R[digits[i]];
  bits += "101";
  return { digits, bits };
}

const CODE = ean13("200101000001");
// guard bars (start, middle, end) run lower than the rest
const GUARD = (i: number) => i < 3 || (i >= 45 && i < 50) || i >= 92;

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

        <div className="md:flex md:flex-row-reverse md:items-center md:justify-between md:gap-6">
          <div className="md:flex-1">
            <div className="flex items-baseline justify-between text-[15px] font-bold">
              <span>status</span>
              <span>open to work</span>
            </div>
            <p className="mt-2 text-center md:text-left">thank you · come again</p>
          </div>

          <svg className="mx-auto mt-3 block h-[50px] w-[168px] shrink-0 md:mx-0 md:mt-0" viewBox="0 0 113 34" aria-hidden>
            <g fill="currentColor">
              {[...CODE.bits].map((bit, i) =>
                bit === "1" ? <rect key={i} x={9 + i} y={0} width={1} height={GUARD(i) ? 29 : 25} /> : null,
              )}
            </g>
            <g fill="currentColor" fontFamily="var(--font-fine)" fontSize="6" textAnchor="middle">
              <text x="4" y="33">{CODE.digits[0]}</text>
              <text x="33" y="33" textLength="38" lengthAdjust="spacing">{CODE.digits.slice(1, 7).join("")}</text>
              <text x="80" y="33" textLength="38" lengthAdjust="spacing">{CODE.digits.slice(7).join("")}</text>
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}
