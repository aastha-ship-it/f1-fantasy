"use client";

import { useState, useTransition } from "react";
import type { JoinResult } from "./actions";

export function JoinForm({
  action,
  next,
}: {
  action: (formData: FormData) => Promise<JoinResult>;
  next: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
        className="text-xs uppercase tracking-wider text-[color:var(--fg-subtle)]"
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
        className="rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-lg text-[color:var(--fg)] outline-none focus:border-[color:var(--accent)]"
      />
      {error && (
        <p
          role="alert"
          className="text-sm text-[color:var(--error)]"
          data-testid="invite-error"
        >
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-[color:var(--accent)] px-6 py-3 font-medium text-black transition-colors hover:bg-[color:var(--accent-hover)] disabled:opacity-50"
      >
        {pending ? "Checking…" : "Continue"}
      </button>
    </form>
  );
}
