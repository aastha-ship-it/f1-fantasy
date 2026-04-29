"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { UpdateProfileResult } from "./actions";
import { ALL_TEAMS, teamMeta, type TeamMeta } from "@/lib/design/teams";
import { DriverPortrait } from "@/components/DriverPortrait";

const EASE_OUT_QUART = [0.22, 1, 0.36, 1] as const;

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
  submit,
}: {
  welcome: boolean;
  next: string;
  /** Provided by parent; design picks always show all 10 canonical teams. */
  teams: string[];
  drivers: Driver[];
  initial: Initial;
  submit: (fd: FormData) => Promise<UpdateProfileResult>;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<
    { kind: "err"; message: string } | null
  >(null);
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

  return (
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
      className="flex flex-col gap-12"
    >
      {welcome && <input type="hidden" name="welcome" value="1" />}
      <input type="hidden" name="next" value={next} />

      {/* Display name */}
      <div>
        <label
          htmlFor="display_name"
          className="mb-3 block text-xs uppercase text-[color:var(--fg-subtle)]"
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
          defaultValue={initial.display_name ?? ""}
          maxLength={30}
          placeholder="Aastha"
          onChange={() => setJustSaved(null)}
          className="w-full max-w-md border border-[color:var(--border)] bg-[color:var(--surface)] px-5 py-4 text-2xl text-[color:var(--fg)] outline-none focus:border-[color:var(--accent)]"
          style={{ fontFamily: "var(--font-boldonse), ui-sans-serif" }}
        />
        <p className="mt-2 text-xs text-[color:var(--fg-subtle)]">
          Shown on the leaderboard and on every reveal.
        </p>
      </div>

      {/* Two-column team / driver grids */}
      <div className="grid gap-12 lg:grid-cols-2">
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

      {/* All-time hero — past favourite. No livery image — we don't know
          which driver / team the user will pick, and a stock McLaren felt
          presumptuous (the original screenshot had Sebastian Vettel typed in
          while McLaren bodywork sat next to it). Container is no longer
          overflow-hidden so Boldonse's tall ascenders render cleanly above
          the input baseline instead of getting clipped. */}
      <div>
        <p
          className="mb-4 text-xs uppercase text-[color:var(--fg-subtle)]"
          style={{ letterSpacing: "0.18em" }}
          data-tabular
        >
          All-time hero
        </p>
        <div className="relative border border-[color:var(--border)] bg-[color:var(--surface)] p-6 sm:p-8">
          <p
            className="mb-2 text-xs uppercase text-[color:var(--fg-subtle)]"
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
            className="w-full bg-transparent uppercase outline-none placeholder:normal-case placeholder:text-[color:var(--fg-subtle)]"
            style={{
              fontFamily: "var(--font-boldonse), ui-sans-serif",
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
          <p className="mt-2 text-sm text-[color:var(--fg-muted)]">
            Any driver from F1 history. Schumacher, Räikkönen, Lauda, Senna — your call.
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
            <div className="flex items-center gap-6 px-6 py-4 text-black sm:px-8">
              <span aria-hidden className="inline-block size-2.5 bg-black" />
              <span
                className="leading-none"
                style={{
                  fontFamily: "var(--font-boldonse), ui-sans-serif",
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

      {/* Footer save row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm text-[color:var(--fg-muted)]">
          {feedback?.kind === "err" && (
            <span role="alert" className="text-[color:var(--error)]">
              {feedback.message}
            </span>
          )}
        </div>
        <button
          type="submit"
          disabled={pending || justSaved !== null}
          className="bg-[color:var(--accent)] px-10 py-4 text-sm uppercase tracking-wider text-black transition-colors hover:bg-[color:var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            fontFamily: "var(--font-boldonse), ui-sans-serif",
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
  );
}

function TeamPicker({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (team: string) => void;
}) {
  return (
    <div>
      <p
        className="mb-4 text-xs uppercase text-[color:var(--fg-subtle)]"
        style={{ letterSpacing: "0.18em" }}
        data-tabular
      >
        Favourite team
      </p>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {ALL_TEAMS.map((t) => {
          const isSelected = teamMeta(selected)?.slug === t.slug;
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
          background: isSelected
            ? "var(--surface-2)"
            : "var(--surface)",
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
  return (
    <div>
      <p
        className="mb-4 text-xs uppercase text-[color:var(--fg-subtle)]"
        style={{ letterSpacing: "0.18em" }}
        data-tabular
      >
        Favourite driver
      </p>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {drivers.slice(0, 20).map((d) => {
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
                  outline:
                    isSelected && t ? `2px solid ${t.hex}33` : "none",
                }}
                aria-pressed={isSelected}
              >
                <DriverPortrait code={d.code} team={d.team} size={48} />
                <span
                  className="text-sm"
                  style={{
                    fontFamily: "var(--font-boldonse), ui-sans-serif",
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
