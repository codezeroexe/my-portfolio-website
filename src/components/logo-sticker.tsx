/**
 * Real brand logos, cut from Simple Icons (CC0-1.0) and recoloured to ink.
 *
 * Each SVG carries a stroked copy of its own path underneath in paper white.
 * That underlay is the die-cut keyline: the white follows the logo's own
 * silhouette instead of the box it happens to occupy, so a Python logo reads as
 * one sticker rather than a picture frame with a snake in it.
 */
export function LogoSticker({
  src,
  label,
  size = 40,
  tilt = 0,
  className = "",
}: {
  src: string;
  label: string;
  size?: number;
  tilt?: number;
  className?: string;
}) {
  return (
    <img
      src={src}
      alt={label}
      title={label}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={`sticker ${className}`}
      style={{
        width: size,
        height: size,
        ["--tilt" as string]: `${tilt}deg`,
      }}
    />
  );
}

export const LOGOS = [
  { src: "/logos/python.svg", label: "Python" },
  { src: "/logos/tensorflow.svg", label: "TensorFlow" },
  { src: "/logos/react.svg", label: "React" },
  { src: "/logos/nextdotjs.svg", label: "Next.js" },
  { src: "/logos/typescript.svg", label: "TypeScript" },
  { src: "/logos/openjdk.svg", label: "Java" },
  { src: "/logos/d3dotjs.svg", label: "D3.js" },
  { src: "/logos/postgresql.svg", label: "PostgreSQL" },
];
