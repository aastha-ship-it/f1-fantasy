/**
 * Phone-vs-not classification from a User-Agent string.
 *
 * Used only by `/reveal/[eventId]`, where the two cinematic choreographies
 * must not both mount (two simultaneous Framer Motion timelines would burn
 * the frame budget the reveal needs). Every other screen branches in CSS at
 * the 780px `md:` fork, which resizes correctly and needs no UA sniffing.
 *
 * Tablets are deliberately NOT phones: the 780px fork puts them in the
 * desktop tree, so they get the wide cinematic. iPadOS 13+ "Request Desktop
 * Website" sends a Macintosh UA and falls through to false, which is correct.
 */
export function isPhoneUA(ua: string | null | undefined): boolean {
  if (!ua) return false;
  if (/iPad/i.test(ua)) return false;
  if (/iPhone|iPod/i.test(ua)) return true;
  // Android tablets omit the "Mobile" token; Android phones include it.
  return /Android/i.test(ua) && /Mobile/i.test(ua);
}
