"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type UpdateProfileResult =
  | { ok: true }
  | { ok: false; error: string };

function trimOrNull(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length === 0 ? null : s;
}

function parseDriverId(v: FormDataEntryValue | null): number | null {
  if (typeof v !== "string" || v.length === 0) return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

export async function updateProfileAction(
  formData: FormData,
): Promise<UpdateProfileResult> {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { ok: false, error: "Not signed in" };
  }

  const displayName = trimOrNull(formData.get("display_name"));
  if (displayName && displayName.length > 30) {
    return { ok: false, error: "Display name must be 30 characters or fewer" };
  }

  const { error } = await supabase
    .from("users")
    .update({
      display_name: displayName,
      favorite_team: trimOrNull(formData.get("favorite_team")),
      favorite_driver: parseDriverId(formData.get("favorite_driver")),
      favorite_past_driver: trimOrNull(formData.get("favorite_past_driver")),
    })
    .eq("id", userData.user.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { ok: true };
}
