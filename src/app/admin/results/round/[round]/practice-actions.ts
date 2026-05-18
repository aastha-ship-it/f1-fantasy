"use server";

import { revalidatePath } from "next/cache";
import { currentAdmin } from "@/lib/adminGuard";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * Admin FP-override actions (changes.md §6). Same trust boundary as the
 * results actions: `currentAdmin()` resolves auth + admin membership, then
 * the service client performs the RLS-bypassing write to
 * `practice_overrides`. An override row wins over the live OpenF1 fetch in
 * the Practice banner.
 */

export type PracticeOverrideResult =
  | { ok: true }
  | { ok: false; error: string };

function revalidate(round: number) {
  revalidatePath(`/admin/results/round/${round}`);
  revalidatePath(`/dashboard/predict/round/${round}`);
}

export async function savePracticeOverrideAction(input: {
  season: number;
  round: number;
  fpIndex: number;
  p1DriverId: number;
  p2DriverId: number;
  p3DriverId: number;
}): Promise<PracticeOverrideResult> {
  const guard = await currentAdmin();
  if (!guard.ok) {
    return {
      ok: false,
      error:
        guard.reason === "unauthenticated"
          ? "Sign in again."
          : "Admin privilege required.",
    };
  }

  if (
    ![1, 2, 3].includes(input.fpIndex) ||
    !input.p1DriverId ||
    !input.p2DriverId ||
    !input.p3DriverId
  ) {
    return { ok: false, error: "Pick a driver for P1, P2 and P3." };
  }
  if (
    new Set([input.p1DriverId, input.p2DriverId, input.p3DriverId]).size !== 3
  ) {
    return { ok: false, error: "P1, P2 and P3 must be three distinct drivers." };
  }

  const svc = createSupabaseServiceClient();
  const { error } = await svc.from("practice_overrides").upsert(
    {
      season: input.season,
      round: input.round,
      fp_index: input.fpIndex,
      p1_driver_id: input.p1DriverId,
      p2_driver_id: input.p2DriverId,
      p3_driver_id: input.p3DriverId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "season,round,fp_index" },
  );
  if (error) return { ok: false, error: error.message };

  revalidate(input.round);
  return { ok: true };
}

export async function clearPracticeOverrideAction(input: {
  season: number;
  round: number;
  fpIndex: number;
}): Promise<PracticeOverrideResult> {
  const guard = await currentAdmin();
  if (!guard.ok) {
    return {
      ok: false,
      error:
        guard.reason === "unauthenticated"
          ? "Sign in again."
          : "Admin privilege required.",
    };
  }

  const svc = createSupabaseServiceClient();
  const { error } = await svc
    .from("practice_overrides")
    .delete()
    .eq("season", input.season)
    .eq("round", input.round)
    .eq("fp_index", input.fpIndex);
  if (error) return { ok: false, error: error.message };

  revalidate(input.round);
  return { ok: true };
}
