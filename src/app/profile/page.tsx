import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/TopBar";
import { MobileTabBar } from "@/components/MobileTabBar";
import { updateProfileAction } from "./actions";
import { ProfileForm } from "./profile-form";
import { CalendarSync } from "./calendar-sync";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; next?: string }>;
}) {
  const params = await searchParams;
  const welcome = params.welcome === "1";
  const next =
    params.next && params.next.startsWith("/") ? params.next : "/dashboard";

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-16">
        <p className="text-[color:var(--error)]">Sign in to continue.</p>
      </main>
    );
  }

  // Same season window the ICS feed covers (see /api/calendar/[token])
  // so the panel's "{n} events · {n} sessions" reflects the real subscription.
  const calYear = new Date().getUTCFullYear();

  const [{ data: profile }, { data: drivers }, { data: calRows }] =
    await Promise.all([
      supabase
        .from("users")
        .select(
          "display_name, favorite_team, favorite_driver, favorite_past_driver, calendar_token",
        )
        .eq("id", userData.user.id)
        .maybeSingle<{
          display_name: string | null;
          favorite_team: string | null;
          favorite_driver: number | null;
          favorite_past_driver: string | null;
          calendar_token: string | null;
        }>(),
      supabase
        .from("drivers")
        .select("id, code, full_name, team")
        .eq("active", true)
        .order("team", { ascending: true })
        .order("full_name", { ascending: true }),
      supabase
        .from("events")
        .select("round, season")
        .in("season", [calYear, calYear + 1])
        .returns<{ round: number; season: number }[]>(),
    ]);

  const calSessions = calRows ?? [];
  const sessionCount = calSessions.length;
  const eventCount = new Set(calSessions.map((r) => `${r.season}-${r.round}`))
    .size;

  const teams = Array.from(
    new Set((drivers ?? []).map((d) => d.team as string)),
  ).sort();

  return (
    <>
      {!welcome && (
        <>
          <TopBar
            active="profile"
            displayName={profile?.display_name}
            email={userData.user.email ?? null}
          />
          <MobileTabBar active="profile" />
        </>
      )}
      {/* 780px fork, pattern A. Below it the page is the handoff's 20px
          gutter with room under the content for BOTH pinned bars (the
          profile save bar sits on top of MobileTabBar); at md: every value
          today's page resolved to at >=780 is restored verbatim — note
          today's base `px-6` was only ever visible below 640 because
          `sm:px-10` covered 640–779, so `md:px-10` reproduces it exactly. */}
      <main className="mx-auto w-full max-w-[1200px] px-5 py-5 pb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom,0px)+96px)] md:px-10 md:py-12 md:pb-12 lg:px-16">
        <div className="mb-[18px] md:mb-12">
          <p
            className="mb-2.5 text-[9px] uppercase tracking-[0.16em] text-[color:var(--fg-subtle)] md:mb-3 md:text-xs md:tracking-[0.18em]"
            data-tabular
          >
            {welcome ? "Welcome · Set your colours" : "Profile"}
          </p>
          {/* The h1 forks without a second element (it is the e2e anchor for
              the welcome flow, and two matching headings break Playwright's
              strict mode):
                · font-size — `clamp(36px, …)` instead of `clamp(40px, …)`.
                  The 40px floor was already dead at >=780 (7vw is 54.6px at
                  780), so lowering it changes nothing above the fork and
                  gives the handoff's 36px at 390.
                · line-height — Tailwind cannot reach it: the global
                  `[style*="Boldonse"]` rule is UNLAYERED, so it outranks
                  every utility no matter the order, and only an inline value
                  wins. So the inline value reads a custom property and the
                  breakpoint switches the property. */}
          <h1
            className="m-0 tracking-tight [--h1-lh:0.9] md:[--h1-lh:0.95]"
            data-tight
            style={{
              fontFamily: "var(--font-boldonse), ui-sans-serif",
              fontSize: "clamp(36px, 7vw, 72px)",
              lineHeight: "var(--h1-lh)",
            }}
          >
            {welcome ? (
              <>
                PICK YOUR
                <br />
                SIDE OF THE GRID.
              </>
            ) : (
              "YOUR COLOURS"
            )}
          </h1>
          {/* Below the fork the email lives in the identity row inside the
              form (canvas: 📱 /profile), so this line would be a duplicate. */}
          {!welcome && (
            <p className="mt-3 hidden text-sm text-[color:var(--fg-subtle)] md:block">
              Signed in as{" "}
              <span className="text-[color:var(--fg-muted)]">
                {userData.user.email}
              </span>
            </p>
          )}
        </div>

        {/* CalendarSync goes in as a SLOT rather than as a sibling below.
            PR-2 adds a mobile sign-out under the calendar panel, and a
            <form> may not nest inside the profile <form> — so the sign-out
            has to be a sibling of that form that still renders after this
            panel. ProfileForm returns a fragment, so the DOM <main> ends up
            with is unchanged: heading block, <form>, then this <section>. */}
        <ProfileForm
          welcome={welcome}
          next={next}
          teams={teams}
          drivers={
            (drivers ?? []) as {
              id: number;
              code: string;
              full_name: string;
              team: string;
            }[]
          }
          initial={{
            display_name: profile?.display_name ?? null,
            favorite_team: profile?.favorite_team ?? null,
            favorite_driver: profile?.favorite_driver ?? null,
            favorite_past_driver: profile?.favorite_past_driver ?? null,
          }}
          email={userData.user.email ?? null}
          submit={updateProfileAction}
          calendarSync={
            !welcome ? (
              <CalendarSync
                eventCount={eventCount}
                sessionCount={sessionCount}
              />
            ) : null
          }
        />
      </main>
    </>
  );
}
