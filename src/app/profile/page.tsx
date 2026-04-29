import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/TopBar";
import { updateProfileAction } from "./actions";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; next?: string }>;
}) {
  const params = await searchParams;
  const welcome = params.welcome === "1";
  const next =
    params.next && params.next.startsWith("/") ? params.next : "/dashboard";

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-16">
        <p className="text-[color:var(--error)]">Sign in to continue.</p>
      </main>
    );
  }

  const [{ data: profile }, { data: drivers }] = await Promise.all([
    supabase
      .from("users")
      .select(
        "display_name, favorite_team, favorite_driver, favorite_past_driver",
      )
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
    <>
      {!welcome && (
        <TopBar
          active="profile"
          displayName={profile?.display_name}
          email={userData.user.email ?? null}
        />
      )}
      <main className="mx-auto w-full max-w-[1200px] px-6 py-12 sm:px-10 lg:px-16">
        <div className="mb-12">
          <p
            className="mb-3 text-xs uppercase text-[color:var(--fg-subtle)]"
            style={{ letterSpacing: "0.18em" }}
            data-tabular
          >
            {welcome ? "Welcome · Set your colours" : "Profile"}
          </p>
          <h1
            className="m-0 tracking-tight"
            data-tight
            style={{
              fontFamily: "var(--font-boldonse), ui-sans-serif",
              fontSize: "clamp(40px, 7vw, 72px)",
              lineHeight: 0.95,
            }}
          >
            {welcome ? (
              <>
                PICK YOUR
                <br />
                SIDE OF THE GRID.
              </>
            ) : (
              "YOUR COLOURS"
            )}
          </h1>
          {!welcome && (
            <p className="mt-3 text-sm text-[color:var(--fg-subtle)]">
              Signed in as{" "}
              <span className="text-[color:var(--fg-muted)]">
                {userData.user.email}
              </span>
            </p>
          )}
        </div>

        <ProfileForm
          welcome={welcome}
          next={next}
          teams={teams}
          drivers={
            (drivers ?? []) as {
              id: number;
              code: string;
              full_name: string;
              team: string;
            }[]
          }
          initial={{
            display_name: profile?.display_name ?? null,
            favorite_team: profile?.favorite_team ?? null,
            favorite_driver: profile?.favorite_driver ?? null,
            favorite_past_driver: profile?.favorite_past_driver ?? null,
          }}
          submit={updateProfileAction}
        />
      </main>
    </>
  );
}
