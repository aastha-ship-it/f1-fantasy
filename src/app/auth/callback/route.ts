import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * Magic-link callback. Supabase redirects here with `?code=...` after the user
 * clicks the emailed link. We exchange the code for a session (PKCE flow),
 * then forward to `next` (default /dashboard).
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

  // First-login hook: ensure a row exists in public.users mirroring auth.users.
  const { data: authData } = await supabase.auth.getUser();
  if (authData.user) {
    await supabase.from("users").upsert(
      {
        id: authData.user.id,
        email: authData.user.email!,
      },
      { onConflict: "id" },
    );

    // Self-healing admin bootstrap. If ADMIN_EMAIL matches the signing-in
    // user and they're not yet in public.admins, insert them. Covers the
    // `supabase db reset` case where the admins row gets wiped.
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const signedInEmail = authData.user.email?.trim().toLowerCase();
    if (adminEmail && signedInEmail && adminEmail === signedInEmail) {
      const svc = createSupabaseServiceClient();
      await svc
        .from("admins")
        .upsert({ user_id: authData.user.id }, { onConflict: "user_id" });
    }
  }

  return NextResponse.redirect(new URL(next, request.url));
}
