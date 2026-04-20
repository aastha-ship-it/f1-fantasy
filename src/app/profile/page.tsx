import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateProfileAction } from "./actions";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return (
      <main className="mx-auto w-full max-w-xl px-6 py-16">
        <p className="text-[color:var(--error)]">Sign in to continue.</p>
      </main>
    );
  }

  const [{ data: profile }, { data: drivers }] = await Promise.all([
    supabase
      .from("users")
      .select("display_name, favorite_team, favorite_driver, favorite_past_driver")
      .eq("id", userData.user.id)
      .maybeSingle<{
        display_name: string | null;
        favorite_team: string | null;
        favorite_driver: number | null;
        favorite_past_driver: string | null;
      }>(),
    supabase
      .from("drivers")
      .select("id, code, full_name, team")
      .eq("active", true)
      .order("team", { ascending: true })
      .order("full_name", { ascending: true }),
  ]);

  const teams = Array.from(
    new Set((drivers ?? []).map((d) => d.team as string)),
  ).sort();

  return (
    <main className="mx-auto w-full max-w-xl px-6 py-10">
      <Link
        href="/dashboard"
        className="mb-6 inline-block text-sm text-[color:var(--fg-subtle)] hover:text-[color:var(--fg)]"
      >
        ← Dashboard
      </Link>
      <p className="mb-4 text-xs uppercase tracking-wider text-[color:var(--fg-subtle)]">
        Profile
      </p>
      <h1
        className="mb-10 leading-none"
        style={{
          fontFamily: "var(--font-boldonse), ui-sans-serif",
          fontSize: "clamp(40px, 4.5vw, 72px)",
        }}
      >
        {(profile?.display_name?.trim() || userData.user.email || "YOU").toUpperCase()}
      </h1>
      <ProfileForm
        teams={teams}
        drivers={(drivers ?? []) as { id: number; code: string; full_name: string; team: string }[]}
        initial={{
          display_name: profile?.display_name ?? null,
          favorite_team: profile?.favorite_team ?? null,
          favorite_driver: profile?.favorite_driver ?? null,
          favorite_past_driver: profile?.favorite_past_driver ?? null,
        }}
        submit={updateProfileAction}
      />
    </main>
  );
}
