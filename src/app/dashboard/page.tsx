import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Phase 0 stub dashboard — proves the auth + invite gate loop works.
 * Phase 4 replaces this with the state-aware smart home.
 */
export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const { data: nextEvent } = await supabase
    .from("events")
    .select("name, session_type, session_start_at")
    .gt("session_start_at", new Date().toISOString())
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
      {nextEvent && (
        <section className="mt-10 rounded border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
          <p className="text-xs uppercase tracking-wider text-[color:var(--fg-subtle)]">
            Next session
          </p>
          <p
            className="mt-2 text-3xl"
            style={{ fontFamily: "var(--font-boldonse), ui-sans-serif" }}
          >
            {nextEvent.name.toUpperCase()}
          </p>
          <p className="mt-1 text-sm text-[color:var(--fg-muted)]">
            {nextEvent.session_type} ·{" "}
            <span data-tabular>
              {new Date(nextEvent.session_start_at).toLocaleString()}
            </span>
          </p>
        </section>
      )}
    </main>
  );
}
