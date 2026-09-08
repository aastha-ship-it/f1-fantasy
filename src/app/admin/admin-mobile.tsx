import Link from "next/link";
import {
  MobEyebrow,
  MobSectionHead,
  MobBleed,
  MobButton,
} from "@/components/MobilePrimitives";
import { revealEventAction } from "./actions";
import { RevealButton } from "./reveal-button";

/**
 * /admin — 390pt fork (design_handoff_mobile §6.3, canvas
 * `screens-mobile-c.jsx:MobAdminScreen`).
 *
 * Separate component rather than `md:` classes: desktop is a nine-column
 * table row per round; mobile is a stack of action-first cards. Admin renders
 * no `MobileTabBar`, so nothing here pins to `--tabbar-h` (handoff §6.3).
 *
 * Server component. The one client island is `RevealButton`, reused from the
 * desktop tree so a `entered` round still reveals in a single tap — the
 * emotional core of the product is not worth a two-tap detour on a phone.
 *
 * TWO DELIBERATE DEPARTURES FROM THE ARTBOARD:
 *
 *  1. The 2x2 status tiles carry the FOUR PRODUCTION CRON PATHS, not the
 *     artboard's Cron / OpenF1 / Friends / Picks. The tile anatomy is the
 *     artboard's verbatim (label mono 9, value Titillium 17 tinted by state,
 *     meta mono 9); only the content differs, because "Friends: 10 active"
 *     is not loaded on this route and inventing it would breach the
 *     presentation-only rule. The four cron rows are the four things this
 *     page actually monitors and they fit the same 2x2.
 *  2. The action row gets ONE button, not the artboard's paired
 *     `ENTER RESULTS` / `FETCH OPENF1`. There is no /admin-level OpenF1
 *     fetch action — the fetch button lives on
 *     `/admin/results/round/[round]`, which is exactly where `ENTER RESULTS`
 *     already goes, so both artboard buttons would point at the same URL.
 *     And only the FIRST action row's button is accent-filled: the artboard
 *     draws one pending round, real state routinely has nine, and nine
 *     52px accent CTAs stacked is a wall of red — see `primaryAction`.
 */

/** Titillium Web 900 display face. The var name is historical (CLAUDE.md). */
const DISPLAY_FONT = "var(--font-boldonse), ui-sans-serif";

export type AdminStatusTile = {
  /** Cron path, e.g. "fetch-results". */
  label: string;
  /** Headline — a clock time or a date, already formatted server-side. */
  value: string;
  valueColor: string;
  meta: string;
  /** Full error text for the `title` attribute, when there is one. */
  title?: string;
};

export type AdminEventRowDatum = {
  round: number;
  /** Short event name, e.g. "Saudi Arabia" — CSS uppercases. */
  name: string;
  /** "APR 19", formatted server-side. */
  date: string;
  stateLabel: string;
  stateColor: string;
  /** Pending or entered — the rows that get the warning stripe + button. */
  needsAction: boolean;
  /**
   * True for the FIRST action row only. Local state routinely has eight or
   * nine rounds awaiting results, and one accent button per row turned the
   * screen into a wall of red — against both the mobile design system ("one
   * accent-filled button per screen") and .impeccable.md's ~10% accent
   * budget. The head of the queue is the CTA; the rest are surface-toned.
   */
  primaryAction: boolean;
  picksLine: string;
  actionHref: string;
  actionLabel: string;
  /**
   * Set only on `entered` rounds: the race session that `RevealButton` flips.
   * When present it replaces the link button.
   */
  revealEventId: string | null;
};

export function AdminMobile({
  attentionCount,
  tiles,
  events,
}: {
  attentionCount: number;
  tiles: AdminStatusTile[];
  events: AdminEventRowDatum[];
}) {
  return (
    <div className="md:hidden">
      <MobEyebrow color="var(--accent)">
        Event control ·{" "}
        {attentionCount > 0
          ? `${attentionCount} attention needed`
          : "All clear"}
      </MobEyebrow>
      <h1
        className="m-0 mt-2.5 uppercase"
        style={{ fontFamily: DISPLAY_FONT, fontSize: 38, lineHeight: 0.9 }}
      >
        Race
        <br />
        Control
      </h1>

      <div className="mt-5 grid grid-cols-2 gap-px border border-[color:var(--border)] bg-[color:var(--border)]">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="min-w-0 bg-[color:var(--surface)] p-3.5"
            title={t.title}
          >
            <MobEyebrow className="truncate">{t.label}</MobEyebrow>
            <p
              className="mt-2 uppercase"
              data-tabular
              style={{
                fontFamily: DISPLAY_FONT,
                fontSize: 17,
                color: t.valueColor,
              }}
            >
              {t.value}
            </p>
            <p
              className="mt-1.5 text-[color:var(--fg-subtle)]"
              style={{ fontSize: 9, lineHeight: 1.5 }}
            >
              {t.meta}
            </p>
          </div>
        ))}
      </div>

      <section className="mt-[26px]">
        <MobSectionHead title="Events" meta="Action first" />
        <MobBleed>
          <ol className="border-t border-[color:var(--border)]">
            {events.map((e) => (
              <li
                key={e.round}
                className="border-b border-[color:var(--border)]"
                style={{
                  background: e.needsAction ? "var(--surface-2)" : "transparent",
                  // Inset box-shadow, not a `border-left`: CLAUDE.md bans
                  // left-accent stripes on cards and this is the sanctioned
                  // exception — the same mechanism MobDisclosureRow and
                  // MobileTabBar use. A real border would also shift the
                  // row's 20px gutter by 3px.
                  boxShadow: e.needsAction
                    ? "inset 3px 0 0 0 var(--warning)"
                    : undefined,
                }}
              >
                {e.needsAction ? (
                  <div className="px-5 pt-3.5 pb-4">
                    <AdminEventHead {...e} />
                    <div className="mt-3.5">
                      {e.revealEventId ? (
                        <RevealButton
                          eventId={e.revealEventId}
                          action={revealEventAction}
                          variant={e.primaryAction ? "mobile" : "mobile-quiet"}
                        />
                      ) : (
                        <MobButton
                          href={e.actionHref}
                          tone={e.primaryAction ? "accent" : "surface"}
                          size={e.primaryAction ? "full" : "paired"}
                        >
                          {e.actionLabel}
                        </MobButton>
                      )}
                    </div>
                  </div>
                ) : (
                  <Link
                    href={e.actionHref}
                    className="block px-5 pt-3.5 pb-4"
                    style={{ minHeight: 44 }}
                  >
                    <AdminEventHead {...e} chevron />
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </MobBleed>
      </section>

      <div
        className="mt-5 border border-[color:var(--border)] p-3.5 text-[color:var(--fg-muted)]"
        style={{
          fontFamily: "var(--font-mono), ui-monospace, monospace",
          fontSize: 10,
          lineHeight: 1.6,
        }}
      >
        <strong className="text-[color:var(--fg)]">Save</strong> writes results
        and computes scores.{" "}
        <strong className="text-[color:var(--fg)]">Reveal</strong> flips picks
        visible to all friends.
      </div>
    </div>
  );
}

function AdminEventHead({
  round,
  name,
  date,
  stateLabel,
  stateColor,
  picksLine,
  chevron,
}: AdminEventRowDatum & { chevron?: boolean }) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <span
          className="uppercase text-[color:var(--fg-subtle)]"
          data-tabular
          style={{ fontSize: 9, letterSpacing: "0.12em" }}
        >
          R{String(round).padStart(2, "0")} · {date}
        </span>
        <span
          className="shrink-0 uppercase"
          data-tabular
          style={{ fontSize: 9, letterSpacing: "0.12em", color: stateColor }}
        >
          {stateLabel}
        </span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p
            className="truncate uppercase"
            style={{ fontFamily: DISPLAY_FONT, fontSize: 18 }}
          >
            {name}
          </p>
          <p
            className="mt-[5px] text-[color:var(--fg-subtle)]"
            data-tabular
            style={{ fontSize: 9 }}
          >
            {picksLine}
          </p>
        </div>
        {chevron && (
          <span
            aria-hidden
            className="shrink-0 leading-none text-[color:var(--fg-subtle)]"
            style={{ fontSize: 16 }}
          >
            ›
          </span>
        )}
      </div>
    </>
  );
}
