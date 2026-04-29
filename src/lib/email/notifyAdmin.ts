/**
 * Thin Resend wrapper. Sends a single plain-text email to ADMIN_EMAIL.
 *
 * Designed to be safe to call without configuration:
 *   - missing RESEND_API_KEY  → no-op, returns sent=false with reason
 *   - missing ADMIN_EMAIL     → no-op, returns sent=false with reason
 *   - non-2xx from Resend     → returns sent=false with reason, never throws
 *
 * Callers (cron handlers) should await this without try/catch — failure is
 * already surfaced via the return shape, and we never want a notify failure
 * to mask the original incident.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_FROM = "F1 Fantasy <noreply@f1-fantasy.app>";

export type NotifyResult =
  | { sent: true; id: string }
  | { sent: false; reason: string };

export async function notifyAdmin(input: {
  subject: string;
  body: string;
}): Promise<NotifyResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: "RESEND_API_KEY missing" };

  const to = process.env.ADMIN_EMAIL;
  if (!to) return { sent: false, reason: "ADMIN_EMAIL missing" };

  const from = process.env.RESEND_FROM ?? DEFAULT_FROM;

  let res: Response;
  try {
    res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: input.subject,
        text: input.body,
      }),
    });
  } catch (err) {
    return {
      sent: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }

  if (!res.ok) {
    return { sent: false, reason: `Resend ${res.status}` };
  }

  const json = (await res.json().catch(() => ({}))) as { id?: string };
  return { sent: true, id: json.id ?? "" };
}
