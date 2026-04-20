"use client";

import { useState, useTransition } from "react";
import type { UpdateProfileResult } from "./actions";

type Driver = { id: number; code: string; full_name: string; team: string };

type Initial = {
  display_name: string | null;
  favorite_team: string | null;
  favorite_driver: number | null;
  favorite_past_driver: string | null;
};

export function ProfileForm({
  teams,
  drivers,
  initial,
  submit,
}: {
  teams: string[];
  drivers: Driver[];
  initial: Initial;
  submit: (fd: FormData) => Promise<UpdateProfileResult>;
}) {
  const [feedback, setFeedback] = useState<
    { kind: "ok" } | { kind: "err"; message: string } | null
  >(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        setFeedback(null);
        startTransition(async () => {
          const result = await submit(formData);
          setFeedback(result.ok ? { kind: "ok" } : { kind: "err", message: result.error });
        });
      }}
      className="flex flex-col gap-6"
    >
      <Field label="Display name" htmlFor="display_name" hint="Shown on the leaderboard and reveal. Max 30 characters.">
        <input
          id="display_name"
          name="display_name"
          type="text"
          defaultValue={initial.display_name ?? ""}
          maxLength={30}
          className="w-full rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-[color:var(--fg)] outline-none focus:border-[color:var(--accent)]"
        />
      </Field>

      <Field label="Favorite team" htmlFor="favorite_team">
        <select
          id="favorite_team"
          name="favorite_team"
          defaultValue={initial.favorite_team ?? ""}
          className="w-full rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-[color:var(--fg)]"
        >
          <option value="">—</option>
          {teams.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Favorite driver" htmlFor="favorite_driver">
        <select
          id="favorite_driver"
          name="favorite_driver"
          defaultValue={initial.favorite_driver ?? ""}
          className="w-full rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-[color:var(--fg)]"
        >
          <option value="">—</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.code} · {d.full_name} · {d.team}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Favorite past driver"
        htmlFor="favorite_past_driver"
        hint="Any driver from F1 history — Senna, Schumacher, Räikkönen…"
      >
        <input
          id="favorite_past_driver"
          name="favorite_past_driver"
          type="text"
          defaultValue={initial.favorite_past_driver ?? ""}
          className="w-full rounded border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-[color:var(--fg)] outline-none focus:border-[color:var(--accent)]"
        />
      </Field>

      <div className="flex items-center justify-between">
        <div>
          {feedback?.kind === "ok" && (
            <p role="status" className="text-sm text-[color:var(--success)]">
              Saved.
            </p>
          )}
          {feedback?.kind === "err" && (
            <p role="alert" className="text-sm text-[color:var(--error)]">
              {feedback.message}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-[color:var(--accent)] px-6 py-3 font-medium text-black transition-colors hover:bg-[color:var(--accent-hover)] disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={htmlFor}
        className="text-xs uppercase tracking-wider text-[color:var(--fg-subtle)]"
      >
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-xs text-[color:var(--fg-subtle)]">{hint}</p>
      )}
    </div>
  );
}
