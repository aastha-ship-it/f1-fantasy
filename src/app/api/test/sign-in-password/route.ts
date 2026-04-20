import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * TEST-ONLY password sign-in endpoint.
 *
 * Exists solely so Playwright can establish a Supabase session without
 * driving the real Google-OAuth consent page. Returns 404 in production,
 * so it can never be used as a backdoor on a deployed site.
 *
 * Expects { email, password } JSON POST. On success, @supabase/ssr's
 * cookie setters attach the session cookies to the response — so any
 * subsequent request in the same browser/Playwright context is signed in.
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as { email?: unknown }).email !== "string" ||
    typeof (body as { password?: unknown }).password !== "string"
  ) {
    return NextResponse.json(
      { ok: false, error: "email and password required" },
      { status: 400 },
    );
  }
  const { email, password } = body as { email: string; password: string };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 401 },
    );
  }
  // Mirror the /auth/callback first-login hook: ensure a public.users row
  // exists. Real OAuth sign-ins hit /auth/callback which handles this; the
  // test endpoint has to do it here or the profile UPDATE later affects
  // zero rows.
  if (data.user) {
    await supabase.from("users").upsert(
      { id: data.user.id, email: data.user.email! },
      { onConflict: "id" },
    );
  }
  return NextResponse.json({ ok: true, userId: data.user?.id });
}
