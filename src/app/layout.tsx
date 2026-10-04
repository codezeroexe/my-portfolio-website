import type { Metadata, Viewport } from "next";
import { Anton, Archivo, Caveat, Space_Mono } from "next/font/google";
import "./globals.css";
import { PaperFilters } from "@/components/paper-filters";
import { EdgeClips } from "@/components/edges";
import { LiquidGround } from "@/components/liquid-ground";
import { ViewportBadge } from "@/components/viewport-badge";

const display = Anton({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

// Special Elite was a distressed typewriter face, but it carries serifs, and at
// paragraph length on a dark ground those slab serifs read as a textbook rather
// than a zine. Archivo is a grotesque with a tight, slightly squared feel that
// sits next to Anton without fighting it.
const body = Archivo({
  variable: "--font-body",
  subsets: ["latin"],
});

const hand = Caveat({
  variable: "--font-hand",
  subsets: ["latin"],
  weight: ["500", "700"],
});

// Cutive Mono was a typewriter face with slab serifs and a damaged lowercase
// that read as a broken font at label sizes. Space Mono is a geometric mono:
// still technical, still obviously a label, but the counters survive 10px.
const fine = Space_Mono({
  variable: "--font-fine",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Meet Hari!",
  description:
    "Building, experimenting, and figuring things out along the way. Interested in technology, design, and the things that happen somewhere in between.",
};

// Pinch zoom is off. Deliberate, not an oversight: the page is a fixed
// composition and a zoomed viewport breaks it — but it takes zooming away
// from visitors who need it (WCAG 1.4.4), so revisit if that ever matters
// more than the layout does.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${hand.variable} ${fine.variable}`}
    >
      <body className="xerox">
        {/* the moving ground. Fixed, so it is always one viewport of canvas
            rather than a canvas the height of the document. The pattern is
            locked to the page by a scroll uniform inside the shader, which is
            what keeps the "one sheet being unrolled" behaviour without paying
            for a full-document canvas. */}
        <LiquidGround />
        <PaperFilters />
        <EdgeClips />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:border-2 focus:border-bone focus:bg-ground focus:px-3 focus:py-2 focus:font-fine focus:text-xs focus:uppercase focus:tracking-widest"
        >
          Skip to content
        </a>
        {children}
        <ViewportBadge />
      </body>
    </html>
  );
}