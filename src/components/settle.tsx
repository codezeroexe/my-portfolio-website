"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Sections arrive by settling onto the page rather than fading up a grid.
 * An IntersectionObserver disconnects after the first reveal, so nothing keeps
 * scrolling work alive after the visitor has seen it.
 */
export function Settle({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const seen = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.classList.add("settle");
        el.style.animationDelay = `${delay}ms`;
        seen.disconnect();
      },
      { threshold: 0.08, rootMargin: "0px 0px -6% 0px" },
    );

    seen.observe(el);
    return () => seen.disconnect();
  }, [delay]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
