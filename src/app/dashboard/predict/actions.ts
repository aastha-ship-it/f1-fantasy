"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  submitPredictionWith,
  type SubmitPredictionInput,
  type SubmitPredictionResult,
} from "@/lib/submitPrediction";

/**
 * Thin Next.js server-action wrapper around submitPredictionWith.
 * Accepts an object (easier for useTransition callers than FormData).
 */
export async function submitPrediction(
  input: SubmitPredictionInput,
): Promise<SubmitPredictionResult> {
  const supabase = await createSupabaseServerClient();
  return submitPredictionWith(supabase, input);
}
