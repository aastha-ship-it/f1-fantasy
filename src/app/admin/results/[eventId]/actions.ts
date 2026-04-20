"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  writeResultsWith,
  type WriteResultsInput,
  type WriteResultsResult,
} from "@/lib/writeResults";

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
  return writeResultsWith(caller, svc, input);
}
