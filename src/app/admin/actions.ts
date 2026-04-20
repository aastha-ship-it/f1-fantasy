"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  revealEventWith,
  type RevealEventResult,
} from "@/lib/revealEvent";

export async function revealEventAction(input: {
  eventId: string;
}): Promise<RevealEventResult> {
  const caller = await createSupabaseServerClient();
  const svc = createSupabaseServiceClient();
  const result = await revealEventWith(caller, svc, input);
  if (result.ok) {
    revalidatePath("/admin");
    revalidatePath(`/reveal/${input.eventId}`);
  }
  return result;
}
