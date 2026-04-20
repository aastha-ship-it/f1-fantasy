import type { SupabaseClient } from "@supabase/supabase-js";
import { OPENF1, fetchJson } from "./openf1";

type OpenF1Driver = {
  driver_number: number;
  name_acronym: string;
  full_name: string;
  team_name: string;
  team_colour: string | null;
  headshot_url: string | null;
  session_key: number;
};

type OpenF1Session = {
  session_key: number;
  date_end: string;
  session_name: string;
  is_cancelled?: boolean;
  year: number;
};

export type DriverSyncSummary = {
  session_key_used: number;
  roster_size: number;
  deactivated: number;
};

async function mostRecentCompletedRace(): Promise<number> {
  const year = new Date().getUTCFullYear();
  const current = await fetchJson<OpenF1Session[]>(
    `${OPENF1}/sessions?session_name=Race&year=${year}`,
  );
  const previous = await fetchJson<OpenF1Session[]>(
    `${OPENF1}/sessions?session_name=Race&year=${year - 1}`,
  );
  const past = [...current, ...previous]
    .filter((s) => !s.is_cancelled)
    .filter((s) => new Date(s.date_end).getTime() < Date.now())
    .sort(
      (a, b) =>
        new Date(b.date_end).getTime() - new Date(a.date_end).getTime(),
    );
  if (past.length === 0)
    throw new Error("No completed non-cancelled Race sessions found");
  return past[0].session_key;
}

export async function syncDrivers(
  svc: SupabaseClient,
): Promise<DriverSyncSummary> {
  const sessionKey = await mostRecentCompletedRace();
  const drivers = await fetchJson<OpenF1Driver[]>(
    `${OPENF1}/drivers?session_key=${sessionKey}`,
  );
  const byNumber = new Map<number, OpenF1Driver>();
  for (const d of drivers) byNumber.set(d.driver_number, d);
  const activeNumbers = [...byNumber.keys()];

  for (const d of byNumber.values()) {
    await svc.from("drivers").upsert(
      {
        id: d.driver_number,
        code: d.name_acronym,
        full_name: d.full_name,
        team: d.team_name,
        active: true,
        headshot_url: d.headshot_url,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
  }

  let deactivated = 0;
  if (activeNumbers.length > 0) {
    const { data } = await svc
      .from("drivers")
      .update({ active: false, updated_at: new Date().toISOString() })
      .not("id", "in", `(${activeNumbers.join(",")})`)
      .select("id");
    deactivated = data?.length ?? 0;
  }

  return {
    session_key_used: sessionKey,
    roster_size: byNumber.size,
    deactivated,
  };
}
