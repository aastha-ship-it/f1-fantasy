/**
 * Invite gate cookie. Set after a successful /join code submission.
 *
 * Value is an HMAC-SHA256 of the current INVITE_CODE, using SUPABASE_SERVICE_ROLE_KEY
 * as the server-side secret. Rotating INVITE_CODE invalidates all prior cookies
 * without logging anyone out of their Supabase session.
 *
 * Uses Web Crypto (subtle.sign) rather than node:crypto so this module can be
 * imported from Edge middleware AND Node server actions.
 */

export const INVITE_COOKIE_NAME = "f1f_invite";

const encoder = new TextEncoder();

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function serverSecret(): string {
  const s = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("SUPABASE_SERVICE_ROLE_KEY must be set");
  return s;
}

export async function inviteCookieValue(): Promise<string> {
  const code = process.env.INVITE_CODE;
  if (!code) throw new Error("INVITE_CODE must be set");
  return hmacSha256Hex(serverSecret(), code);
}

export async function isValidInviteCookie(
  value: string | undefined,
): Promise<boolean> {
  if (!value) return false;
  try {
    const expected = await inviteCookieValue();
    // Constant-time-ish compare. Lengths are fixed (SHA-256 hex = 64 chars)
    // so a simple loop without short-circuit is adequate.
    if (value.length !== expected.length) return false;
    let mismatch = 0;
    for (let i = 0; i < expected.length; i++) {
      mismatch |= value.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    return mismatch === 0;
  } catch {
    return false;
  }
}
