import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { TopBar } from "@/components/TopBar";
import { loadLobbyWeekend, resolveFocusRound } from "@/lib/lobby/loadLobby";
import { LobbyView } from "./lobby-view";

/**
 * Shared Lobby renderer for both `/dashboard/lobby` (auto-focus) and
 * `/dashboard/lobby/round/[round]`. Auth + profile guard via the user
 * client; the gated weekend data via the service client (see loadLobby).
 */
export async function LobbyPage({ round }: { round: number | null }) {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const myId = userData.user?.id ?? null;

  let myDisplayName: string | null = null;
  if (myId) {
    const { data: me } = await supabase
      .from("users")
      .select("display_name")
      .eq("id", myId)
      .maybeSingle<{ display_name: string | null }>();
    myDisplayName = me?.display_name?.trim() ?? null;
    if (!myDisplayName) redirect("/profile?welcome=1");
  }

  const season = new Date().getUTCFullYear();
  const svc = createSupabaseServiceClient();

  const focusRound =
    round ?? (await resolveFocusRound(svc, season));

  const header = (
    <TopBar
      active="lobby"
      displayName={myDisplayName}
      email={userData.user?.email ?? null}
    />
  );

  if (focusRound == null) {
    return (
      <>
        {header}
        <main className="mx-auto w-full max-w-[1600px] px-6 py-24 text-center sm:px-8 lg:px-12">
          <p className="text-sm text-[color:var(--fg-muted)]">
            No sessions scheduled yet. The Lobby fills in once the calendar
            syncs.
          </p>
        </main>
      </>
    );
  }

  const [weekend, allRounds] = await Promise.all([
    loadLobbyWeekend(svc, { season, round: focusRound, myUserId: myId }),
    svc
      .from("events")
      .select("round")
      .eq("season", season)
      .returns<{ round: number }[]>(),
  ]);

  if (!weekend) {
    return (
      <>
        {header}
        <main className="mx-auto w-full max-w-[1600px] px-6 py-24 text-center sm:px-8 lg:px-12">
          <p className="text-sm text-[color:var(--fg-muted)]">
            Round {focusRound} isn’t on the calendar.
          </p>
        </main>
      </>
    );
  }

  const rounds = Array.from(
    new Set((allRounds.data ?? []).map((r) => r.round)),
  ).sort((a, b) => a - b);
  const idx = rounds.indexOf(weekend.round);
  const prevRound = idx > 0 ? rounds[idx - 1]! : null;
  const nextRound =
    idx >= 0 && idx < rounds.length - 1 ? rounds[idx + 1]! : null;

  return (
    <>
      {header}
      <LobbyView
        weekend={weekend}
        prevRound={prevRound}
        nextRound={nextRound}
      />
    </>
  );
}
