/**
 * Invite code gate for /join.
 *
 * Constant-time comparison via crypto.timingSafeEqual to avoid leaking
 * code length / prefix via response timing.
 */
import { timingSafeEqual } from "node:crypto";

export class InviteCodeError extends Error {
  constructor(message = "Invalid invite code") {
    super(message);
    this.name = "InviteCodeError";
  }
}

export function validateInviteCode(
  submitted: string,
  ctx: { envCode: string | undefined },
): void {
  if (!ctx.envCode) {
    // Misconfigured server (env var unset) must NOT pass.
    throw new InviteCodeError();
  }
  if (typeof submitted !== "string" || submitted.length === 0) {
    throw new InviteCodeError();
  }

  const a = Buffer.from(submitted, "utf8");
  const b = Buffer.from(ctx.envCode, "utf8");

  // timingSafeEqual requires equal-length buffers. Pad shorter buffer to
  // the longer length so comparison runs in constant time regardless.
  const max = Math.max(a.length, b.length);
  const aPad = Buffer.alloc(max);
  const bPad = Buffer.alloc(max);
  a.copy(aPad);
  b.copy(bPad);

  const lengthMatches = a.length === b.length;
  const bytesMatch = timingSafeEqual(aPad, bPad);

  if (!lengthMatches || !bytesMatch) {
    throw new InviteCodeError();
  }
}
