"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { UpdateProfileResult } from "./actions";
import { signOutAction } from "@/app/signout/actions";
import { ALL_TEAMS, teamMeta, type TeamMeta } from "@/lib/design/teams";
import { DriverPortrait } from "@/components/DriverPortrait";
import {
  MobButton,
  MobHairlineGrid,
  MobSectionHead,
} from "@/components/MobilePrimitives";

/**
 * 390pt fork (PR-2 §3). Canvas: `screens-mobile-c.jsx:MobProfileScreen`.
 *
 * Two patterns, chosen per element:
 *   A — one element, mobile at base, today's value restored at `md:`. Used
 *       for everything that carries form state or an accessible name a test
 *       binds to: the display-name input, the all-time-hero input, the save
 *       row and its single submit. Duplicating any of those would either
 *       double-submit a field or break Playwright's strict mode.
 *   B — a `md:hidden` mobile subtree beside the existing markup, which takes
 *       `hidden md:block` / `md:grid` ON ITSELF (never on a new wrapper — a
 *       wrapper would change the desktop box and the 1440 pixel baseline).
 *       Used for the team/driver tile grids, whose two layouts are genuinely
 *       different trees. Both trees are stateless `type="button"` handlers
 *       over the same `favTeam` / `favDriverId` state, so they cannot drift.
 */

const EASE_OUT_QUART = [0.22, 1, 0.36, 1] as const;

/** Titillium Web 900 display face. The var name is historical (CLAUDE.md). */
const DISPLAY_FONT = "var(--font-boldonse), ui-sans-serif";

type Driver = { id: number; code: string; full_name: string; team: string };

type Initial = {
  display_name: string | null;
  favorite_team: string | null;
  favorite_driver: number | null;
  favorite_past_driver: string | null;
};

export function ProfileForm({
  welcome,
  next,
  drivers,
  initial,
  email,
  submit,
  calendarSync,
}: {
  welcome: boolean;
  next: string;
  /** Provided by parent; design picks always show all 10 canonical teams. */
  teams: string[];
  drivers: Driver[];
  initial: Initial;
  /** Shown in the mobile identity row — the desktop "Signed in as" line is
   *  `md:hidden`, since the canvas puts the address in the row instead. */
  email: string | null;
  submit: (fd: FormData) => Promise<UpdateProfileResult>;
  /** `<CalendarSync>`, rendered as a sibling of this form. See page.tsx. */
  calendarSync?: ReactNode;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<{
    kind: "err";
    message: string;
  } | null>(null);
  const [justSaved, setJustSaved] = useState<{ at: Date } | null>(null);
  const [bannerOpen, setBannerOpen] = useState(false);
  // Auto-dismiss banner after 4s — matches the predict-detail PICKS LOCKED IN
  // pattern. Button copy stays in the "Profile saved" state until the user
  // edits a field.
  useEffect(() => {
    if (!bannerOpen) return;
    const t = setTimeout(() => setBannerOpen(false), 4000);
    return () => clearTimeout(t);
  }, [bannerOpen]);
  const [pending, startTransition] = useTransition();

  // Selected state mirrors the form so picks render visually before submit.
  const [favTeam, setFavTeam] = useState<string | null>(initial.favorite_team);
  const [favDriverId, setFavDriverId] = useState<number | null>(
    initial.favorite_driver,
  );
  const [pastDriver, setPastDriver] = useState<string>(
    initial.favorite_past_driver ?? "",
  );
  // Controlled only so the mobile identity-row avatar can carry the initial
  // of the name being typed, the way the canvas draws it. The <input> is
  // still the one submitted field — nothing reads this state on submit.
  const [displayName, setDisplayName] = useState<string>(
    initial.display_name ?? "",
  );

  const favTeamMeta = teamMeta(favTeam);
  const avatarInitial = (displayName.trim() || email?.trim() || "?")
    .charAt(0)
    .toUpperCase();

  return (
    <>
      <form
        action={(formData) => {
          // The grid buttons are visual; the form submit reads our state.
          if (favTeam) formData.set("favorite_team", favTeam);
          else formData.delete("favorite_team");
          if (favDriverId !== null)
            formData.set("favorite_driver", String(favDriverId));
          else formData.delete("favorite_driver");
          formData.set("favorite_past_driver", pastDriver);

          setFeedback(null);
          startTransition(async () => {
            try {
              const result = await submit(formData);
              if (result.ok) {
                setJustSaved({ at: new Date() });
                setBannerOpen(true);
                router.refresh();
              } else {
                setFeedback({ kind: "err", message: result.error });
              }
            } catch (err) {
              if (
                err instanceof Error &&
                !err.message.includes("NEXT_REDIRECT")
              ) {
                setFeedback({ kind: "err", message: err.message });
              }
            }
          });
        }}
        className="flex flex-col gap-[26px] md:gap-12"
      >
        {welcome && <input type="hidden" name="welcome" value="1" />}
        <input type="hidden" name="next" value={next} />

        {/* Display name — the canvas's identity row below the fork, today's
            labelled field at md:. ONE element per control (pattern A): the
            row's chrome (`border`, `flex`, padding) is base-only and
            `md:block md:border-0 md:bg-transparent md:p-0` returns the box to
            the bare <div> it is today. */}
        <div className="flex items-center gap-[14px] border border-[color:var(--border)] bg-[color:var(--surface)] p-[14px] md:block md:border-0 md:bg-transparent md:p-0">
          <span
            aria-hidden
            className="grid size-[46px] shrink-0 place-items-center rounded-full bg-[color:var(--surface-2)] md:hidden"
            style={{
              // The one sanctioned circle on the whole mobile design system,
              // ringed in the selected team's hex (canvas 📱 /profile).
              border: `1px solid ${favTeamMeta?.hex ?? "var(--border)"}`,
              fontFamily: DISPLAY_FONT,
              fontSize: 18,
            }}
          >
            {avatarInitial}
          </span>

          {/* `md:contents` dissolves this column at desktop, so the label /
              input / helper land as direct children of the row again and the
              >=780 DOM box tree is byte-identical to today's. */}
          <div className="min-w-0 flex-1 md:contents">
            <label
              htmlFor="display_name"
              // sr-only, never `hidden`: the field's accessible name (and the
              // `getByLabel("Your name (required)")` e2e anchor) has to
              // survive below the fork even though the canvas draws no label.
              // `md:not-sr-only` restores it — its 12px gap moves onto the
              // input's `md:mt-3` because not-sr-only also resets `margin`.
              className="sr-only md:not-sr-only md:block md:text-xs md:uppercase md:text-[color:var(--fg-subtle)]"
              style={{ letterSpacing: "0.18em" }}
              data-tabular
            >
              {welcome ? "Your name (required)" : "Display name"}
            </label>
            <input
              id="display_name"
              name="display_name"
              type="text"
              required
              autoFocus={welcome}
              value={displayName}
              maxLength={30}
              placeholder="Aastha"
              onChange={(e) => {
                setDisplayName(e.target.value);
                setJustSaved(null);
              }}
              className="w-full border-0 bg-transparent p-0 text-[16px] text-[color:var(--fg)] outline-none focus:border-[color:var(--accent)] md:mt-3 md:max-w-md md:border md:border-[color:var(--border)] md:bg-[color:var(--surface)] md:px-5 md:py-4 md:text-2xl"
              style={{ fontFamily: DISPLAY_FONT }}
            />
            {email && (
              <p
                className="mt-1 truncate uppercase text-[color:var(--fg-subtle)] md:hidden"
                data-tabular
                style={{ fontSize: 9, letterSpacing: "0.08em" }}
              >
                {email}
              </p>
            )}
          </div>

          {/* The canvas's EDIT chip. A <label>, so tapping it focuses the
              field, and `aria-hidden` so it does not concatenate onto the
              input's accessible name — the real label above is the name. */}
          <label
            htmlFor="display_name"
            aria-hidden
            className="flex min-h-[44px] shrink-0 items-center border border-[color:var(--border)] px-2.5 uppercase text-[color:var(--fg-muted)] md:hidden"
            data-tabular
            style={{ fontSize: 9, letterSpacing: "0.12em" }}
          >
            Edit
          </label>

          <p className="mt-2 hidden text-xs text-[color:var(--fg-subtle)] md:block">
            Shown on the leaderboard and on every reveal.
          </p>
        </div>

        {/* Two-column team / driver grids */}
        <div className="grid gap-[26px] md:gap-12 lg:grid-cols-2">
          <TeamPicker
            selected={favTeam}
            onSelect={(team) => {
              setFavTeam(team);
              setJustSaved(null);
            }}
          />
          <DriverPicker
            drivers={drivers}
            selected={favDriverId}
            onSelect={(id) => {
              setFavDriverId(id);
              setJustSaved(null);
            }}
          />
        </div>

        {/* All-time hero — past favourite. The desktop card deliberately has
            no livery image (a stock McLaren next to a typed-in Vettel read as
            presumptuous, and the container has to stay overflow-visible so
            the display face's ascenders aren't clipped). Below the fork the
            canvas asks for the watermark back — so it is drawn from the
            team the user has ACTUALLY selected, inside a base-only
            `overflow-hidden`, and it simply isn't there until they pick one. */}
        <div>
          <MobSectionHead className="md:hidden" title="All-time hero" />
          <p
            className="mb-4 hidden text-xs uppercase text-[color:var(--fg-subtle)] md:block"
            style={{ letterSpacing: "0.18em" }}
            data-tabular
          >
            All-time hero
          </p>
          <div className="relative overflow-hidden border border-[color:var(--border)] bg-[color:var(--surface)] p-4 md:overflow-visible md:p-8">
            {favTeamMeta && (
              <Image
                aria-hidden
                src={favTeamMeta.carSrc}
                alt=""
                width={280}
                height={105}
                unoptimized
                className="pointer-events-none absolute select-none md:hidden"
                style={{
                  right: -60,
                  bottom: -8,
                  opacity: 0.3,
                  width: 280,
                  height: "auto",
                  maxWidth: "none",
                }}
              />
            )}
            <p
              className="relative mb-2 hidden text-xs uppercase text-[color:var(--fg-subtle)] md:block"
              style={{ letterSpacing: "0.18em" }}
              data-tabular
            >
              Your hero
            </p>
            <input
              id="favorite_past_driver"
              type="text"
              value={pastDriver}
              onChange={(e) => {
                setPastDriver(e.target.value);
                setJustSaved(null);
              }}
              placeholder="Senna · MP4/4"
              // `relative` only so the text clears the watermark; `md:static`
              // puts it back in the desktop paint order. No size fork needed:
              // the existing clamp already bottoms out at the canvas's 22px
              // on a 390pt screen.
              className="relative w-full bg-transparent uppercase outline-none placeholder:normal-case placeholder:text-[color:var(--fg-subtle)] md:static"
              style={{
                fontFamily: DISPLAY_FONT,
                // Capped so common driver names ("SEBASTIAN VETTEL",
                // "MAX VERSTAPPEN", "LEWIS HAMILTON") fit the panel without
                // horizontal scroll. Boldonse is wide; 32px + tight tracking
                // is the sweet spot.
                fontSize: "clamp(22px, 2.6vw, 32px)",
                letterSpacing: "-0.02em",
                // Generous padding-top absorbs Boldonse's tall ascenders so
                // the first line isn't clipped (the global [style*="Boldonse"]
                // rule already adds 0.12em; we top it up to ~0.5em).
                paddingTop: "0.4em",
                paddingBottom: "0.1em",
                lineHeight: 1.15,
              }}
            />
            <p className="relative mt-2 text-[10px] text-[color:var(--fg-muted)] md:static md:text-sm">
              Any driver from F1 history. Schumacher, Räikkönen, Lauda, Senna —
              your call.
            </p>
          </div>
        </div>

        {/* F1-style success banner — earned motion, only mounts on a real save.
            Auto-dismisses after 4s; the "Profile saved" button copy persists
            until the user edits a field. */}
        <AnimatePresence>
          {bannerOpen && justSaved && (
            <motion.div
              key="profile-banner"
              role="status"
              className="overflow-hidden bg-[color:var(--accent)]"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.45, ease: EASE_OUT_QUART }}
              data-testid="profile-saved-banner"
            >
              <div className="flex items-center gap-4 px-4 py-3 text-black md:gap-6 md:px-8 md:py-4">
                <span aria-hidden className="inline-block size-2.5 bg-black" />
                <span
                  className="leading-none"
                  style={{
                    fontFamily: DISPLAY_FONT,
                    fontSize: 22,
                    letterSpacing: "0.02em",
                  }}
                >
                  PROFILE SAVED
                </span>
                <span
                  className="text-[11px] uppercase opacity-80"
                  style={{
                    fontFamily: "var(--font-mono), ui-monospace, monospace",
                    letterSpacing: "0.1em",
                  }}
                  data-tabular
                >
                  Saved {justSaved.at.toISOString().slice(11, 16)} UTC
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Save bar — pattern A on today's footer row. Below the fork it pins
            itself ABOVE MobileTabBar (never over it), which is why the offset
            reads `--tabbar-h` rather than a literal; in welcome mode there is
            no tab bar, so it sits on the safe-area edge instead. `md:static
            md:z-auto md:border-0 md:bg-transparent md:px-0 md:py-0` returns
            it to the in-flow row it is today — px/py rather than `p-0` so
            base and `md:` sit in the same property bucket. */}
        <div
          className={`fixed inset-x-0 z-20 flex flex-wrap items-center justify-between gap-4 border-t border-[color:var(--border)] bg-[color:var(--bg)] px-5 py-3 md:static md:z-auto md:border-0 md:bg-transparent md:px-0 md:py-0 ${
            welcome
              ? "bottom-[env(safe-area-inset-bottom,0px)]"
              : "bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom,0px))]"
          }`}
        >
          {/* `empty:hidden` so the full-width mobile button doesn't wrap
              below a zero-height spacer; `md:empty:block` keeps the empty
              cell that `justify-between` needs to hold the desktop button
              right. */}
          <div className="text-xs text-[color:var(--fg-muted)] empty:hidden md:text-sm md:empty:block">
            {feedback?.kind === "err" && (
              <span role="alert" className="text-[color:var(--error)]">
                {feedback.message}
              </span>
            )}
          </div>
          {/* ONE submit. A second button with this accessible name would fail
              the welcome-flow e2e click under Playwright's strict mode. */}
          <button
            type="submit"
            disabled={pending || justSaved !== null}
            className="grid h-[52px] w-full place-items-center bg-[color:var(--accent)] text-[13px] uppercase tracking-wider text-black transition-colors hover:bg-[color:var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60 md:block md:h-auto md:w-auto md:px-10 md:py-4 md:text-sm"
            style={{
              fontFamily: DISPLAY_FONT,
              letterSpacing: "0.04em",
            }}
          >
            {pending
              ? "Saving…"
              : justSaved
                ? "Profile saved ✓"
                : welcome
                  ? "Save & enter the paddock →"
                  : "Save profile"}
          </button>
        </div>
      </form>

      {calendarSync}

      {/* Sign out — new below the fork, and the ONLY sign-out on a phone:
          TopBar's ⏻ is `hidden md:block` as of PR-2. It has to be a SIBLING
          of the profile <form> (a nested <form> is invalid HTML), which is
          why <CalendarSync> comes through as a slot — this way it still
          lands under the calendar panel, where the canvas puts it. */}
      {!welcome && (
        <form action={signOutAction} className="mt-[26px] md:hidden">
          <MobButton type="submit" tone="ghost">
            Sign out
          </MobButton>
        </form>
      )}
    </>
  );
}

function TeamPicker({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (team: string) => void;
}) {
  const selectedMeta = teamMeta(selected);
  return (
    <div>
      <MobSectionHead
        className="md:hidden"
        title="Favourite team"
        meta={selectedMeta?.name}
      />
      <p
        className="mb-4 hidden text-xs uppercase text-[color:var(--fg-subtle)] md:block"
        style={{ letterSpacing: "0.18em" }}
        data-tabular
      >
        Favourite team
      </p>

      {/* Pattern B — mobile tree. 5-across hairline grid, 68px tiles. */}
      <MobHairlineGrid
        cols={5}
        className="border border-[color:var(--border)] md:hidden"
      >
        {ALL_TEAMS.map((t) => {
          const isSelected = selectedMeta?.slug === t.slug;
          return (
            <button
              key={t.slug}
              type="button"
              onClick={() => onSelect(t.name)}
              aria-pressed={isSelected}
              className="flex min-h-[68px] flex-col items-center justify-center gap-1.5"
              style={{
                background: isSelected ? "var(--surface-2)" : "var(--surface)",
                // Inset shadow, not a border: a real border would reflow the
                // 1px hairline grid by a pixel per selected cell.
                boxShadow: isSelected ? `inset 0 0 0 1px ${t.hex}` : undefined,
              }}
            >
              <Image
                src={t.logoSrc}
                alt=""
                width={26}
                height={26}
                className="object-contain"
                style={{ width: 26, height: 26 }}
              />
              <span
                className="uppercase"
                data-tabular
                style={{
                  fontSize: 8,
                  letterSpacing: "0.1em",
                  color: isSelected ? "var(--fg)" : "var(--fg-subtle)",
                }}
              >
                {t.short}
              </span>
            </button>
          );
        })}
        {/* The roster is 11 teams, which is not a multiple of 5, so the last
            row leaves 4 empty cell slots. MobHairlineGrid paints `--border`
            behind its children and relies on each child being opaque — with
            nothing in those slots the bare grid background shows through and
            reads as one big phantom tile. These fillers carry the surface
            colour and nothing else. */}
        {Array.from({ length: (5 - (ALL_TEAMS.length % 5)) % 5 }, (_, i) => (
          <div
            key={`team-filler-${i}`}
            aria-hidden
            className="bg-[color:var(--surface)]"
          />
        ))}
      </MobHairlineGrid>

      <ul className="hidden grid-cols-3 gap-2 sm:grid-cols-5 md:grid">
        {ALL_TEAMS.map((t) => {
          const isSelected = selectedMeta?.slug === t.slug;
          return (
            <TeamButton
              key={t.slug}
              team={t}
              isSelected={isSelected}
              onClick={() => onSelect(t.name)}
            />
          );
        })}
      </ul>
    </div>
  );
}

function TeamButton({
  team,
  isSelected,
  onClick,
}: {
  team: TeamMeta;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full flex-col items-center gap-2 px-3 py-5 transition-colors"
        style={{
          background: isSelected ? "var(--surface-2)" : "var(--surface)",
          border: `1px solid ${isSelected ? team.hex : "var(--border)"}`,
          outline: isSelected ? `2px solid ${team.hex}33` : "none",
          outlineOffset: "0px",
        }}
        aria-pressed={isSelected}
      >
        <Image
          src={team.logoSrc}
          alt={team.name}
          width={36}
          height={36}
          className="h-9 w-9 object-contain"
        />
        <span
          className="text-xs uppercase"
          style={{ letterSpacing: "0.1em" }}
          data-tabular
        >
          {team.short}
        </span>
      </button>
    </li>
  );
}

function DriverPicker({
  drivers,
  selected,
  onSelect,
}: {
  drivers: Driver[];
  selected: number | null;
  onSelect: (id: number) => void;
}) {
  // Same 20 on both trees. The canvas draws 10 because its fixture holds 10;
  // halving the roster on a phone would be a functional regression.
  const roster = drivers.slice(0, 20);
  const selectedDriver = roster.find((d) => d.id === selected);
  return (
    <div>
      <MobSectionHead
        className="md:hidden"
        title="Favourite driver"
        meta={selectedDriver?.code}
      />
      <p
        className="mb-4 hidden text-xs uppercase text-[color:var(--fg-subtle)] md:block"
        style={{ letterSpacing: "0.18em" }}
        data-tabular
      >
        Favourite driver
      </p>

      {/* Pattern B — mobile tree. 5-across, 78px tiles, portrait 34. */}
      <MobHairlineGrid
        cols={5}
        className="border border-[color:var(--border)] md:hidden"
      >
        {roster.map((d) => {
          const t = teamMeta(d.team);
          const isSelected = selected === d.id;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => onSelect(d.id)}
              aria-pressed={isSelected}
              className="flex min-h-[78px] flex-col items-center justify-center gap-[5px]"
              style={{
                background: isSelected ? "var(--surface-2)" : "var(--surface)",
                boxShadow:
                  isSelected && t ? `inset 0 0 0 1px ${t.hex}` : undefined,
              }}
            >
              <DriverPortrait code={d.code} team={d.team} size={34} />
              <span style={{ fontFamily: DISPLAY_FONT, fontSize: 11 }}>
                {d.code}
              </span>
            </button>
          );
        })}
        {/* Same phantom-tile guard as the team grid: the roster is 20 today
            (a clean 4 rows), but it is whatever `drivers.active` holds, so
            the fillers keep a short grid from painting bare `--border`. */}
        {Array.from({ length: (5 - (roster.length % 5)) % 5 }, (_, i) => (
          <div
            key={`driver-filler-${i}`}
            aria-hidden
            className="bg-[color:var(--surface)]"
          />
        ))}
      </MobHairlineGrid>

      <ul className="hidden grid-cols-3 gap-2 sm:grid-cols-5 md:grid">
        {roster.map((d) => {
          const t = teamMeta(d.team);
          const isSelected = selected === d.id;
          return (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => onSelect(d.id)}
                className="flex w-full flex-col items-center gap-2 px-2 py-3 transition-colors"
                style={{
                  background: isSelected
                    ? "var(--surface-2)"
                    : "var(--surface)",
                  border: `1px solid ${
                    isSelected && t ? t.hex : "var(--border)"
                  }`,
                  outline: isSelected && t ? `2px solid ${t.hex}33` : "none",
                }}
                aria-pressed={isSelected}
              >
                <DriverPortrait code={d.code} team={d.team} size={48} />
                <span
                  className="text-sm"
                  style={{
                    fontFamily: DISPLAY_FONT,
                  }}
                >
                  {d.code}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
