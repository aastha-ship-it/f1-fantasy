"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type UpdateProfileResult =
  | { ok: true; welcome: boolean; next: string }
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
  // Display name is required — in welcome mode and forever after.
  if (!displayName) {
    return { ok: false, error: "Display name is required" };
  }
  if (displayName.length > 30) {
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

  const welcome = formData.get("welcome") === "1";
  const nextRaw = formData.get("next");
  const next =
    typeof nextRaw === "string" && nextRaw.startsWith("/")
      ? nextRaw
      : "/dashboard";
  if (welcome) {
    // Server-side redirect — cleaner than round-tripping through the client
    // router, and avoids the dashboard defensive-guard race where the
    // client navigates before its cached data sees the new display_name.
    redirect(next);
  }
  return { ok: true, welcome, next };
}
