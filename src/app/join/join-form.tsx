"use client";

import { useState, useTransition } from "react";
import type { JoinResult } from "./actions";

/**
 * Invite-code form. Visual: large monospace input styled to echo the
 * canvas's six-box treatment (Geist Mono + accent caret + letter-spacing).
 * Single field rather than 6 separate inputs because production codes vary
 * in length (`LECLERC-FTW-2026` is 16 chars, not 6).
 *
 * The label "Invite code" + button accessible-name "Continue" are required
 * by the E2 Playwright assertion — preserve them across redesigns.
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
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="next" value={next} />
      <label
        htmlFor="invite-code"
        className="text-xs uppercase text-[color:var(--fg-subtle)]"
        style={{ letterSpacing: "0.14em" }}
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
        className="border bg-[color:var(--surface)] px-5 py-5 text-2xl uppercase text-[color:var(--fg)] outline-none transition-colors focus:border-[color:var(--accent)] disabled:opacity-50"
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
          className="text-xs uppercase text-[color:var(--error)]"
          style={{ letterSpacing: "0.06em" }}
          data-testid="invite-error"
        >
          {error}
        </p>
      ) : (
        <p
          className="text-xs uppercase text-[color:var(--fg-subtle)]"
          style={{ letterSpacing: "0.06em" }}
        >
          Enter your code, then sign in with Google.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        aria-label="Continue"
        className="mt-4 flex items-center justify-center gap-2 px-6 py-5 text-base text-black transition-colors disabled:opacity-50"
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
            Continue <span aria-hidden>→ Sign in with Google</span>
          </>
        )}
      </button>
    </form>
  );
}
