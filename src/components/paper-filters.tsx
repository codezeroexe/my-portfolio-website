/**
 * Filter and shape definitions.
 *
 * Every edge in this design is irregular, and every one of them clips a
 * silhouette rather than warping content. `feDisplacementMap` on a photograph
 * distorts the face inside it, and on type it breaks legibility, so it is used
 * here for exactly one thing: fraying the ends of masking tape, which is
 * texture with no content to destroy.
 */
export function PaperFilters() {
  return (
    <svg
      aria-hidden
      focusable="false"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    >
      <defs>
        <filter id="tape-torn" x="-30%" y="-70%" width="160%" height="240%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.035 0.55"
            numOctaves={3}
            seed={11}
            result="fibres"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="fibres"
            scale={7}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}
