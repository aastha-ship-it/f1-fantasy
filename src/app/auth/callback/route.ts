import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * OAuth callback. Supabase redirects here with `?code=...` after Google
 * (or any other provider) finishes. We exchange the code for a session,
 * mirror the auth user into public.users, and route by profile state:
 *
 *   - display_name null  → /profile?welcome=1 (first-time setup)
 *   - display_name set   → ?next param or /dashboard
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=missing_code", request.url),
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(error.message)}`,
        request.url,
      ),
    );
  }

  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    // Extremely unusual — session exchange succeeded but no user on client.
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Mirror auth.users → public.users (first login creates, subsequent no-op).
  await supabase.from("users").upsert(
    {
      id: authData.user.id,
      email: authData.user.email!,
    },
    { onConflict: "id" },
  );

  // Self-healing admin bootstrap.
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const signedInEmail = authData.user.email?.trim().toLowerCase();
  if (adminEmail && signedInEmail && adminEmail === signedInEmail) {
    const svc = createSupabaseServiceClient();
    await svc
      .from("admins")
      .upsert({ user_id: authData.user.id }, { onConflict: "user_id" });
  }

  // Route by profile completion. If the new user hasn't set display_name,
  // push them into the welcome profile-setup flow before they see anything
  // else.
  const { data: profile } = await supabase
    .from("users")
    .select("display_name")
    .eq("id", authData.user.id)
    .maybeSingle<{ display_name: string | null }>();

  const displayName = profile?.display_name?.trim() ?? "";
  if (displayName.length === 0) {
    const welcomeUrl = new URL("/profile", request.url);
    welcomeUrl.searchParams.set("welcome", "1");
    if (next && next !== "/dashboard") welcomeUrl.searchParams.set("next", next);
    return NextResponse.redirect(welcomeUrl);
  }

  return NextResponse.redirect(new URL(next, request.url));
}
