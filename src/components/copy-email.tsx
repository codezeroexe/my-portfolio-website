"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The email box. A click copies the address instead of opening a mail app,
 * and the line under the address says so for a moment. Without a clipboard
 * (or script) it stays a plain mailto link.
 */
export function CopyEmail({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async (e: React.MouseEvent) => {
    if (!navigator.clipboard) return;
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(email);
    } catch {
      window.location.href = `mailto:${email}`;
      return;
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2400);
  };

  return (
    <a
      href={`mailto:${email}`}
      onClick={copy}
      className="group inline-block border-4 border-bone px-6 py-5 transition-transform hover:-translate-y-1"
    >
      <span className="scream block text-2xl text-bone sm:text-3xl">{email}</span>
      <span className="fine mt-2 block text-ash group-hover:text-bone" aria-live="polite">
        {copied ? "copied, paste it anywhere" : "copy my email →"}
      </span>
    </a>
  );
}
