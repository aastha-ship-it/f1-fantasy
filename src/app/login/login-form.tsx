"use client";

import { useState, useTransition } from "react";
import type { LoginResult } from "./actions";

export function LoginForm({
  action,
  next,
}: {
  action: (formData: FormData) => Promise<LoginResult>;
  next: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        setError(null);
        setMessage(null);
        startTransition(async () => {
          const result = await action(formData);
          if (result.ok) setMessage(result.message);
          else setError(result.error);
        });
      }}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="next" value={next} />
      <label
        htmlFor="email"
        className="text-xs uppercase tracking-wider text-[color:var(--fg-subtle)]"
      >
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        autoFocus
        required
        disabled={pending}
        className="rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-lg text-[color:var(--fg)] outline-none focus:border-[color:var(--accent)]"
      />
      {error && (
        <p role="alert" className="text-sm text-[color:var(--error)]">
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="text-sm text-[color:var(--success)]"
          data-testid="login-sent"
        >
          {message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-[color:var(--accent)] px-6 py-3 font-medium text-black transition-colors hover:bg-[color:var(--accent-hover)] disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send magic link"}
      </button>
    </form>
  );
}
