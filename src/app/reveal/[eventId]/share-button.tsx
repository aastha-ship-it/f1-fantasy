"use client";

import { useState } from "react";

/**
 * Copies the current /reveal/[eventId] URL to clipboard. Sits inline with
 * the "THE GROUP" section header per wireframe refinement. Shows a short
 * confirmation ("Link copied") for 2 seconds on success.
 */
export function ShareButton() {
  const [copied, setCopied] = useState(false);

  async function onClick() {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select-range approach isn't worth it — just tell the user.
      alert(window.location.href);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-[color:var(--border)] bg-transparent px-3 py-1.5 text-xs uppercase tracking-wider text-[color:var(--fg-muted)] hover:border-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"
      aria-label="Copy reveal link"
    >
      {copied ? "Link copied ✓" : "Share"}
    </button>
  );
}
