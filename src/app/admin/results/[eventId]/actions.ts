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
