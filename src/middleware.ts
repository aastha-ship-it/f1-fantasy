import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { INVITE_COOKIE_NAME, isValidInviteCookie } from "@/lib/inviteCookie";

const PUBLIC_PATHS = new Set(["/join", "/login"]);
// /api/cron/* is gated by CRON_SECRET inside each route; the invite + session
// middleware would block Vercel's cron requests (they have no user cookies).
// /api/share/* is public (OG images for link-preview crawlers) — individual
// routes under there gate themselves on event state + reveal status.
const PUBLIC_PREFIXES = [
  "/auth/",
  "/_next/",
  "/api/public/",
  "/api/cron/",
  "/api/share/",
  "/api/test/",
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Refresh Supabase session cookies on every request so Server Components
  // see a fresh session. Pattern from @supabase/ssr docs.
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );
  const { data } = await supabase.auth.getUser();

  if (isPublicPath(pathname)) return response;

  // All non-public routes require both an invite cookie AND a Supabase session.
  const hasInvite = await isValidInviteCookie(
    request.cookies.get(INVITE_COOKIE_NAME)?.value,
  );
  if (!hasInvite) {
    const url = request.nextUrl.clone();
    url.pathname = "/join";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (!data.user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|assets/).*)"],
};
