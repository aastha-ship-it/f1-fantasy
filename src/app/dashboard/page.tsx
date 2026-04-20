import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatLocal, sessionLabel } from "@/lib/sessionLabel";

/**
 * Phase 0 stub dashboard — proves the auth + invite gate loop works.
 * Phase 4 replaces this with the state-aware smart home.
 */
export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const nowIso = new Date().toISOString();
  const { data: nextOpen } = await supabase
    .from("events")
    .select("id, name, session_type, session_start_at, lock_at")
    .gt("lock_at", nowIso)
    .order("session_start_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <h1
        className="mb-8 text-5xl leading-none"
        style={{ fontFamily: "var(--font-boldonse), ui-sans-serif" }}
      >
        F1 FANTASY
      </h1>
      <p className="text-sm text-[color:var(--fg-muted)]">
        Signed in as{" "}
        <span className="text-[color:var(--fg)]">{data.user?.email}</span>
      </p>
      {nextOpen ? (
        <section className="mt-10 rounded border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
          <p className="text-xs uppercase tracking-wider text-[color:var(--fg-subtle)]">
            Next session
          </p>
          <p
            className="mt-2 text-3xl"
            style={{ fontFamily: "var(--font-boldonse), ui-sans-serif" }}
          >
            {nextOpen.name.toUpperCase()}
          </p>
          <p className="mt-1 text-sm text-[color:var(--fg-muted)]">
            {sessionLabel(nextOpen.session_type)} ·{" "}
            <span data-tabular>{formatLocal(nextOpen.session_start_at)}</span>
          </p>
          <Link
            href="/dashboard/predict"
            className="mt-6 inline-block rounded bg-[color:var(--accent)] px-5 py-3 font-medium text-black transition-colors hover:bg-[color:var(--accent-hover)]"
          >
            Lock in your picks →
          </Link>
        </section>
      ) : (
        <section className="mt-10 rounded border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
          <p className="text-sm text-[color:var(--fg-muted)]">
            No open sessions right now.
          </p>
        </section>
      )}
    </main>
  );
}
