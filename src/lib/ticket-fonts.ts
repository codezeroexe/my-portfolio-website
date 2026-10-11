import {
  Abril_Fatface,
  Alfa_Slab_One,
  Archivo_Black,
  Big_Shoulders_Stencil,
  Courier_Prime,
  Cutive_Mono,
  DotGothic16,
  IBM_Plex_Mono,
  Rubik_Mono_One,
  Rye,
  Special_Elite,
} from "next/font/google";

/**
 * Type for the on-repeat ticket: a title face and a details face per pair.
 *
 * Temporary: several pairs while one is chosen, switched with ?font=<key>
 * (components/ticket-font-picker.tsx). Only the first is used without the
 * parameter. None but the first is preloaded, and a browser only downloads a
 * face it actually draws, so the spares cost nothing on a normal visit.
 */

// 1. wood-type slab and a box-office typewriter (the default)
const slabHead = Alfa_Slab_One({ subsets: ["latin"], weight: "400", variable: "--font-ticket-head" });
const slabBody = Courier_Prime({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-ticket" });

// 2. old letterpress poster and a worn, inky typewriter
const pressHead = Rye({ subsets: ["latin"], weight: "400", variable: "--tf-press-head", preload: false });
const pressBody = Special_Elite({ subsets: ["latin"], weight: "400", variable: "--tf-press-body", preload: false });

// 3. crate stencil and a plain mono
const stencilHead = Big_Shoulders_Stencil({ subsets: ["latin"], weight: "800", variable: "--tf-stencil-head", preload: false });
const stencilBody = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--tf-stencil-body", preload: false });

// 4. heavy grotesque with dot-matrix details, like a printed-on-demand ticket
const dotHead = Archivo_Black({ subsets: ["latin"], weight: "400", variable: "--tf-dot-head", preload: false });
const dotBody = DotGothic16({ subsets: ["latin"], weight: "400", variable: "--tf-dot-body", preload: false });

// 5. theatre-bill display serif and a thin typewriter
const theatreHead = Abril_Fatface({ subsets: ["latin"], weight: "400", variable: "--tf-theatre-head", preload: false });
const theatreBody = Cutive_Mono({ subsets: ["latin"], weight: "400", variable: "--tf-theatre-body", preload: false });

// 6. wide blocky mono, with the page's own label face for the details
const blockHead = Rubik_Mono_One({ subsets: ["latin"], weight: "400", variable: "--tf-block-head", preload: false });

export const ticketFontVariables = [
  slabHead,
  slabBody,
  pressHead,
  pressBody,
  stencilHead,
  stencilBody,
  dotHead,
  dotBody,
  theatreHead,
  theatreBody,
  blockHead,
]
  .map((f) => f.variable)
  .join(" ");

export type TicketFont = { key: string; label: string; head: string; body: string };

export const TICKET_FONTS: TicketFont[] = [
  { key: "slab", label: "slab + typewriter", head: "--font-ticket-head", body: "--font-ticket" },
  { key: "press", label: "letterpress", head: "--tf-press-head", body: "--tf-press-body" },
  { key: "stencil", label: "stencil", head: "--tf-stencil-head", body: "--tf-stencil-body" },
  { key: "dot", label: "dot matrix", head: "--tf-dot-head", body: "--tf-dot-body" },
  { key: "theatre", label: "theatre bill", head: "--tf-theatre-head", body: "--tf-theatre-body" },
  { key: "block", label: "wide block", head: "--tf-block-head", body: "--font-fine" },
];
