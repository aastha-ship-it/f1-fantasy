"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { JoinResult } from "./actions";

/**
 * Invite-code form. Visual: large monospace input styled to echo the
 * canvas's six-box treatment (Geist Mono + accent caret + letter-spacing).
 * Single field rather than 6 separate inputs because production codes vary
 * in length (`LECLERC-FTW-2026` is 16 chars, not 6).
 *
 * The label "Invite code" + button accessible-name "Continue" are required
 * by the E2 Playwright assertion — preserve them across redesigns.
 *
 * 390pt fork (PR-2 §5). The canvas draws a 6-cell code grid; we keep the
 * one field (see above — production codes are 16 chars) and give it the
 * cell treatment instead: 56px tall, `--surface` ground, accent border once
 * non-empty. The helper line stays today's copy, not the canvas's
 * "6 characters · not case sensitive", which would be a lie.
 *
 * Every control here is pattern A — one element, mobile at base, today's
 * value restored at `md:` — because each of them is either the submitted
 * field or a test anchor. Only the button's VISIBLE text forks, by a pair
 * of spans; `aria-label="Continue"` is what the tests read and it is the
 * same string at every width.
 */
export function JoinForm({
  action,
  next,
}: {
  action: (formData: FormData) => Promise<JoinResult>;
  next: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState("");

  return (
    <form
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await action(formData);
          if (!result.ok) setError(result.error);
        });
      }}
      // `flex-1` + `mt-auto` on the button bottom-anchor the CTA on a phone;
      // `relative` lifts the form above the page's stripe wash. Both revert
      // at md to the auto-height, static block it is today.
      className="relative flex flex-1 flex-col gap-2.5 md:static md:flex-initial md:gap-4"
    >
      <input type="hidden" name="next" value={next} />
      <label
        htmlFor="invite-code"
        className="text-[9px] uppercase tracking-[0.16em] text-[color:var(--fg-subtle)] md:text-xs md:tracking-[0.14em]"
        data-tabular
      >
        Invite code
      </label>
      <input
        id="invite-code"
        name="code"
        type="text"
        autoComplete="off"
        autoFocus
        required
        disabled={pending}
        value={value}
        onChange={(e) => setValue(e.currentTarget.value)}
        spellCheck={false}
        autoCapitalize="characters"
        className="h-[56px] border bg-[color:var(--surface)] px-4 text-[22px] uppercase text-[color:var(--fg)] outline-none transition-colors focus:border-[color:var(--accent)] disabled:opacity-50 md:h-auto md:px-5 md:py-5 md:text-2xl"
        style={{
          fontFamily: "var(--font-mono), ui-monospace, monospace",
          letterSpacing: "0.18em",
          borderColor: value ? "var(--accent)" : "var(--border)",
          fontVariantNumeric: "tabular-nums",
        }}
      />

      {error ? (
        <p
          role="alert"
          className="text-[9px] uppercase text-[color:var(--error)] md:text-xs"
          style={{ letterSpacing: "0.06em" }}
          data-testid="invite-error"
        >
          {error}
        </p>
      ) : (
        <p
          className="text-[9px] uppercase text-[color:var(--fg-subtle)] md:text-xs"
          style={{ letterSpacing: "0.06em" }}
        >
          Enter your code, then sign in with Google.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        aria-label="Continue"
        className="mt-auto flex h-[52px] items-center justify-center gap-2 text-[13px] text-black transition-colors disabled:opacity-50 md:mt-4 md:h-auto md:px-6 md:py-5 md:text-base"
        style={{
          background: "var(--accent)",
          fontFamily: "var(--font-boldonse), ui-sans-serif",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {pending ? (
          "Checking…"
        ) : (
          <>
            {/* Visible text only — `aria-label="Continue"` above is the
                accessible name at both widths, so the e2e anchor never
                moves. The desktop string spells out where the button goes
                next; at 390 that does not fit a 52px block. */}
            <span className="md:hidden">Join the group →</span>
            {/* `md:contents`, not `md:inline`: the button is a flex row with
                `gap-2`, and today's desktop children are TWO flex items — the
                bare "Continue" text node and the arrow <span>. An `inline`
                wrapper would collapse them into one item and drop the 8px
                gap (caught by the 1440 pixel diff). `display: contents`
                dissolves the wrapper so its children stay the button's own
                flex items. */}
            <span className="hidden md:contents">
              Continue <span aria-hidden>→ Sign in with Google</span>
            </span>
          </>
        )}
      </button>

      <p
        className="text-center uppercase text-[color:var(--fg-subtle)] md:hidden"
        data-tabular
        style={{ fontSize: 9, letterSpacing: "0.06em" }}
      >
        Already a member?{" "}
        <Link href="/login" className="text-[color:var(--accent)]">
          Sign in
        </Link>
      </p>
    </form>
  );
}
