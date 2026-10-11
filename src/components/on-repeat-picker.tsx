"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Temporary: shows one of the on-repeat print treatments, chosen with
 * ?np=<style> in the URL. With the parameter present a small switcher prints
 * in the bottom-left corner so the styles can be flicked through on a real
 * device. Without it the first style shows and nothing else changes.
 *
 * Every style is server-rendered and passed in, so switching is instant and
 * needs no refetch. Goes away once a style is chosen.
 */
export function OnRepeatPicker({
  styles,
}: {
  styles: { key: string; label: string; node: ReactNode }[];
}) {
  const [active, setActive] = useState(styles[0].key);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (!q.has("np")) return;
    setPicking(true);
    const want = q.get("np");
    if (styles.some((s) => s.key === want)) setActive(want!);
  }, [styles]);

  const choose = (key: string) => {
    setActive(key);
    const url = new URL(window.location.href);
    url.searchParams.set("np", key);
    window.history.replaceState(null, "", url);
  };

  return (
    <>
      {styles.find((s) => s.key === active)?.node}
      {picking && (
        <div className="fixed bottom-3 left-3 z-[200] flex flex-wrap gap-1.5 border border-acid bg-ground p-2">
          {styles.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => choose(s.key)}
              className={`fine px-2 py-1 ${
                s.key === active ? "bg-acid text-ground" : "text-acid"
              }`}
            >
              {i + 1} {s.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
