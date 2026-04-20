import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { currentAdmin } from "@/lib/adminGuard";
import { revealEventAction } from "./actions";
import { RevealButton } from "./reveal-button";

type AwaitingRow = {
  id: string;
  name: string;
  round: number;
  session_type: "race" | "quali" | "sprint_race" | "sprint_quali";
  session_start_at: string;
};

type CompletedRow = AwaitingRow & {
  results: { event_id: string } | null;
  revealed_at: string | null;
};

const SESSION_LABEL: Record<AwaitingRow["session_type"], string> = {
  race: "Race",
  quali: "Qualifying",
  sprint_race: "Sprint",
  sprint_quali: "Sprint Qualifying",
};

function fmt(date: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(date));
  } catch {
    return date;
  }
}

export default async function AdminHomePage() {
  const guard = await currentAdmin();
  if (!guard.ok) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-16">
        <h1
          className="mb-4 text-4xl leading-none"
          style={{ fontFamily: "var(--font-boldonse), ui-sans-serif" }}
        >
          ADMIN
        </h1>
        <p className="text-[color:var(--error)]">
          {guard.reason === "unauthenticated"
            ? "Sign in to continue."
            : "Forbidden. This route is admin-only."}
        </p>
        <Link
          href="/dashboard"
          className="mt-8 inline-block text-sm text-[color:var(--fg-subtle)] hover:text-[color:var(--fg)]"
        >
          ← Back to dashboard
        </Link>
      </main>
    );
  }

  const supabase = await createSupabaseServerClient();
  const nowIso = new Date().toISOString();

  const { data: awaiting } = await supabase
    .from("events")
    .select("id, name, round, session_type, session_start_at")
    .lt("session_start_at", nowIso)
    .order("session_start_at", { ascending: false })
    .limit(20);

  const awaitingRows = (awaiting ?? []) as AwaitingRow[];
  const awaitingIds = awaitingRows.map((r) => r.id);

  const { data: results } = await supabase
    .from("results")
    .select("event_id")
    .in(
      "event_id",
      awaitingIds.length > 0
        ? awaitingIds
        : ["00000000-0000-0000-0000-000000000000"],
    );
  const haveResults = new Set((results ?? []).map((r) => r.event_id as string));

  const { data: revealed } = await supabase
    .from("events")
    .select("id, revealed_at")
    .in(
      "id",
      awaitingIds.length > 0
        ? awaitingIds
        : ["00000000-0000-0000-0000-000000000000"],
    );
  const revealedAt = new Map<string, string | null>();
  for (const r of revealed ?? [])
    revealedAt.set(r.id as string, (r.revealed_at as string | null) ?? null);

  const completed: CompletedRow[] = awaitingRows.map((r) => ({
    ...r,
    results: haveResults.has(r.id) ? { event_id: r.id } : null,
    revealed_at: revealedAt.get(r.id) ?? null,
  }));

  const pending = completed.filter((r) => !r.results);
  const reveal = completed.filter((r) => r.results && !r.revealed_at);
  const done = completed.filter((r) => r.results && r.revealed_at);

  return (
    <main className="mx-auto w-full max-w-[1600px] px-6 py-10 sm:px-8 lg:px-12 xl:px-16">
      <p className="mb-4 text-xs uppercase tracking-wider text-[color:var(--fg-subtle)]">
        Admin
      </p>
      <h1
        className="mb-10 leading-none"
        style={{
          fontFamily: "var(--font-boldonse), ui-sans-serif",
          fontSize: "clamp(40px, 4.5vw, 72px)",
        }}
      >
        OPERATIONS
      </h1>

      <div className="grid gap-6 lg:grid-cols-3">
        <Section title="Awaiting results" count={pending.length}>
          {pending.length === 0 && (
            <EmptyLine>All completed sessions have results filed.</EmptyLine>
          )}
          {pending.map((r) => (
            <SessionRow
              key={r.id}
              row={r}
              cta={
                <Link
                  href={`/admin/results/${r.id}`}
                  className="rounded bg-[color:var(--accent)] px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-[color:var(--accent-hover)]"
                >
                  File →
                </Link>
              }
            />
          ))}
        </Section>

        <Section title="Ready to reveal" count={reveal.length}>
          {reveal.length === 0 && (
            <EmptyLine>No events waiting to be revealed.</EmptyLine>
          )}
          {reveal.map((r) => (
            <SessionRow
              key={r.id}
              row={r}
              cta={<RevealButton eventId={r.id} action={revealEventAction} />}
            />
          ))}
        </Section>

        <Section title="Revealed" count={done.length}>
          {done.length === 0 && <EmptyLine>Nothing revealed yet.</EmptyLine>}
          {done.map((r) => (
            <SessionRow
              key={r.id}
              row={r}
              cta={
                <Link
                  href={`/reveal/${r.id}`}
                  className="rounded bg-[color:var(--surface-2)] px-3 py-1.5 text-xs uppercase tracking-wider text-[color:var(--success)] hover:bg-[color:var(--border)]"
                >
                  View →
                </Link>
              }
            />
          ))}
        </Section>
      </div>

      <Link
        href="/dashboard"
        className="mt-12 inline-block text-sm text-[color:var(--fg-subtle)] hover:text-[color:var(--fg)]"
      >
        ← Back to dashboard
      </Link>
    </main>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-xs uppercase tracking-wider text-[color:var(--fg-muted)]">
          {title}
        </h2>
        <span
          className="rounded bg-[color:var(--surface-2)] px-2 py-0.5 text-xs text-[color:var(--fg-subtle)]"
          data-tabular
        >
          {count}
        </span>
      </div>
      <ul className="flex max-h-[520px] flex-col gap-2 overflow-y-auto pr-1">
        {children}
      </ul>
    </section>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return (
    <li className="rounded border border-dashed border-[color:var(--border)] px-3 py-3 text-xs text-[color:var(--fg-subtle)]">
      {children}
    </li>
  );
}

function SessionRow({
  row,
  cta,
}: {
  row: AwaitingRow;
  cta: React.ReactNode;
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded border border-[color:var(--border)] bg-[color:var(--bg)] px-3 py-2.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="truncate text-sm text-[color:var(--fg)]">
          <span
            data-tabular
            className="mr-2 text-[color:var(--fg-subtle)]"
          >
            R{row.round.toString().padStart(2, "0")}
          </span>
          {row.name}
        </p>
        <p
          className="truncate text-xs text-[color:var(--fg-subtle)]"
          data-tabular
        >
          {SESSION_LABEL[row.session_type]} · {fmt(row.session_start_at)}
        </p>
      </div>
      {cta}
    </li>
  );
}
