"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  writeResultsWith,
  type WriteResultsInput,
  type WriteResultsResult,
} from "@/lib/writeResults";
import { revealEventWith } from "@/lib/revealEvent";
import { currentAdmin } from "@/lib/adminGuard";
import { fetchResultForEvent } from "@/lib/results/fetchResults";

/**
 * Thin server-action wrapper around writeResultsWith. Creates both the
 * caller's cookie-bound client (for admin auth-check) and the service-role
 * client (for the actual writes that bypass RLS on results/scores/streaks).
 */
export async function fileResultsAction(
  input: WriteResultsInput,
): Promise<WriteResultsResult> {
  const caller = await createSupabaseServerClient();
  const svc = createSupabaseServiceClient();
  const result = await writeResultsWith(caller, svc, input);
  if (result.ok) {
    revalidatePath("/admin");
    revalidatePath(`/admin/results/${input.eventId}`);
  }
  return result;
}

/**
 * Combo action: file results, then trigger the reveal in one click.
 * Used by the "Save + Reveal to group" CTA on the manual entry screen.
 * Either step can fail independently; the result is a discriminated union
 * indicating which step ran + which failed.
 */
export type FileAndRevealResult =
  | {
      ok: true;
      scoresUpdated: number;
      revealedAt: string;
    }
  | {
      ok: false;
      stage: "write" | "reveal";
      message: string;
    };

export async function fileResultsAndRevealAction(
  input: WriteResultsInput,
): Promise<FileAndRevealResult> {
  const caller = await createSupabaseServerClient();
  const svc = createSupabaseServiceClient();

  const written = await writeResultsWith(caller, svc, input);
  if (!written.ok) {
    return {
      ok: false,
      stage: "write",
      message:
        written.error === "VALIDATION"
          ? written.message
          : written.error === "ADMIN_REQUIRED"
            ? "Admin privilege required."
            : written.error === "UNAUTHENTICATED"
              ? "Sign in again."
              : written.message,
    };
  }
  const revealed = await revealEventWith(caller, svc, {
    eventId: input.eventId,
  });
  if (!revealed.ok) {
    return {
      ok: false,
      stage: "reveal",
      message: revealed.message ?? "Reveal failed.",
    };
  }
  revalidatePath("/admin");
  revalidatePath(`/admin/results/${input.eventId}`);
  revalidatePath(`/reveal/${input.eventId}`);
  return {
    ok: true,
    scoresUpdated: written.scoresUpdated,
    revealedAt: revealed.revealedAt,
  };
}

/**
 * Admin "Fetch from OpenF1" (changes.md §7). currentAdmin()-gated; pulls the
 * session classification and runs the scoring pipeline (source='openf1').
 * writeResultsService enforces the freeze rule, so this never overwrites an
 * admin-entered or already-revealed result. Reveal stays a separate step.
 */
export type FetchFromOpenF1Result =
  | { ok: true; written: boolean; frozen?: boolean; message: string }
  | { ok: false; message: string };

export async function fetchFromOpenF1Action(
  eventId: string,
): Promise<FetchFromOpenF1Result> {
  const guard = await currentAdmin();
  if (!guard.ok) {
    return {
      ok: false,
      message:
        guard.reason === "unauthenticated"
          ? "Sign in again."
          : "Admin privilege required.",
    };
  }

  const svc = createSupabaseServiceClient();
  const { data: event, error } = await svc
    .from("events")
    .select("id, session_type, openf1_session_key")
    .eq("id", eventId)
    .maybeSingle<{
      id: string;
      session_type: string;
      openf1_session_key: number | null;
    }>();
  if (error) return { ok: false, message: error.message };
  if (!event) return { ok: false, message: "Event not found." };

  const r = await fetchResultForEvent(svc, event);
  if (r.ok) {
    revalidatePath("/admin");
    revalidatePath(`/admin/results/${eventId}`);
    return r.frozen
      ? {
          ok: true,
          written: false,
          frozen: true,
          message:
            "Results are admin-entered or the event is revealed — left unchanged.",
        }
      : {
          ok: true,
          written: true,
          message: "Fetched from OpenF1 and scored.",
        };
  }

  const reason = r.reason;
  const message =
    reason === "no_session_key"
      ? "No OpenF1 session key for this event yet."
      : reason === "no_rows"
        ? "OpenF1 has no classification for this session yet — try again later."
        : reason.startsWith("fetch:")
          ? `OpenF1 fetch failed: ${reason.slice(6)}`
          : reason.startsWith("parse:")
            ? `Could not parse OpenF1 results: ${reason.slice(6)}`
            : reason.startsWith("write:")
              ? `Write failed: ${reason.slice(6)}`
              : reason;
  return { ok: false, message };
}

/**
 * Admin "Accept as official" (design_handoff_phase11 §7). Promotes a
 * provisional OpenF1 row (`source='openf1'`) to `source='admin'` without
 * touching the podium — which freezes it from the auto-fetch path via the
 * Phase-12 rule (same end-state as a manual re-save, one click). Defensive:
 * a revealed event or an already-official / missing row is a no-op.
 */
export type AcceptAsOfficialResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function acceptAsOfficialAction(
  eventId: string,
): Promise<AcceptAsOfficialResult> {
  const guard = await currentAdmin();
  if (!guard.ok) {
    return {
      ok: false,
      message:
        guard.reason === "unauthenticated"
          ? "Sign in again."
          : "Admin privilege required.",
    };
  }

  const svc = createSupabaseServiceClient();
  const { data: ev } = await svc
    .from("events")
    .select("revealed_at")
    .eq("id", eventId)
    .maybeSingle<{ revealed_at: string | null }>();
  if (ev?.revealed_at) {
    return {
      ok: false,
      message: "Event is already revealed — results are frozen.",
    };
  }

  const { data: existing } = await svc
    .from("results")
    .select("source")
    .eq("event_id", eventId)
    .maybeSingle<{ source: string | null }>();
  if (!existing) {
    return {
      ok: false,
      message: "No results to accept yet — fetch from OpenF1 first.",
    };
  }
  if (existing.source === "admin") {
    return { ok: false, message: "Results are already official." };
  }

  const { error } = await svc
    .from("results")
    .update({ source: "admin" })
    .eq("event_id", eventId);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin");
  revalidatePath(`/admin/results/${eventId}`);
  return {
    ok: true,
    message: "Accepted as official. Auto-fetch will no longer touch this row.",
  };
}
