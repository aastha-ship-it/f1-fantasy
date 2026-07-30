import { teamMeta } from "@/lib/design/teams";

export type LeagueRowProps = {
  rank: number;
  name: string;
  initial: string;
  points: number;
  pct: number;
  favTeam: string | null;
  favDriverCode: string | null;
  perfects: number;
  streak: number;
  isMe: boolean;
};

const EMOJI_FONT =
  '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

/**
 * Desktop "rest of the field" league row — five-column grid (rank / avatar /
 * name+meta / progress bar / points), lifted verbatim from page.tsx. Only its
 * home changed; the grid template, font sizes and combined team/driver/PP/
 * streak meta line are byte-for-byte the original.
 */
export function LeagueRowDesktop(p: LeagueRowProps) {
  const fav = p.favTeam ? teamMeta(p.favTeam) : null;
  return (
    <div
      className="grid items-center gap-6 border-b border-[color:var(--border)] px-6 py-4 last:border-b-0"
      style={{
        gridTemplateColumns:
          "60px 40px minmax(0,1fr) minmax(120px,200px) 80px",
        background: p.isMe ? "var(--surface-2)" : "transparent",
      }}
    >
      <span
        className="leading-none"
        style={{
          fontFamily: "var(--font-boldonse), ui-sans-serif",
          fontSize: 24,
        }}
        data-tabular
      >
        {p.rank}
      </span>
      <span
        className="grid place-items-center rounded-full"
        style={{
          width: 36,
          height: 36,
          background: "var(--surface-2)",
          border: `1px solid ${fav?.hex ?? "var(--border)"}`,
          fontFamily: "var(--font-boldonse), ui-sans-serif",
          fontSize: 14,
        }}
      >
        {p.initial}
      </span>
      <div className="min-w-0">
        <p className="truncate text-base">{p.name}</p>
        <p
          className="text-[10px] uppercase"
          style={{
            color: fav?.hex ?? "var(--fg-subtle)",
            letterSpacing: "0.1em",
          }}
          data-tabular
        >
          {fav ? `Team ${fav.name}` : "No favorite team"}
          {p.favDriverCode && ` · ${p.favDriverCode}`}
          {p.perfects > 0 && ` · ${p.perfects} PP`}
          {p.streak ? ` · 🔥 ${p.streak}` : ""}
        </p>
      </div>
      <div
        className="relative h-1.5"
        style={{ background: "var(--bg)" }}
        aria-hidden
      >
        <div
          className="absolute inset-y-0 left-0"
          style={{
            width: `${p.pct}%`,
            background: fav?.hex ?? "var(--fg-subtle)",
          }}
        />
      </div>
      <span
        className="text-right"
        style={{
          fontFamily: "var(--font-mono), ui-monospace, monospace",
          fontSize: 22,
        }}
        data-tabular
      >
        {p.points}
      </span>
    </div>
  );
}

/**
 * Mobile "rest of the field" league row — four columns you actually scan
 * (rank, avatar, name, points) with everything else behind a native
 * <details>. <details> deliberately over a client component: zero JS, free
 * keyboard and screen-reader semantics, and page.tsx stays a server
 * component.
 */
export function LeagueRowMobile(p: LeagueRowProps) {
  const fav = p.favTeam ? teamMeta(p.favTeam) : null;
  return (
    <details
      className="border-b border-[color:var(--border)] last:border-b-0"
      style={{ background: p.isMe ? "var(--surface-2)" : "transparent" }}
    >
      <summary
        className="grid cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden"
        style={{ gridTemplateColumns: "28px 36px minmax(0,1fr) auto" }}
      >
        <span
          className="leading-none"
          style={{
            fontFamily: "var(--font-boldonse), ui-sans-serif",
            fontSize: 18,
          }}
          data-tabular
        >
          {p.rank}
        </span>
        <span
          className="grid place-items-center rounded-full"
          style={{
            width: 32,
            height: 32,
            background: "var(--surface-2)",
            border: `1px solid ${fav?.hex ?? "var(--border)"}`,
            fontFamily: "var(--font-boldonse), ui-sans-serif",
            fontSize: 13,
          }}
        >
          {p.initial}
        </span>
        <span className="min-w-0 truncate text-sm">{p.name}</span>
        <span
          style={{
            fontFamily: "var(--font-boldonse), ui-sans-serif",
            fontSize: 20,
          }}
          data-tabular
        >
          {p.points}
        </span>
      </summary>

      <div className="px-4 pb-4">
        <div
          className="relative mb-3 h-1.5"
          style={{ background: "var(--bg)" }}
          aria-hidden
        >
          <div
            className="absolute inset-y-0 left-0"
            style={{
              width: `${p.pct}%`,
              background: fav?.hex ?? "var(--fg-subtle)",
            }}
          />
        </div>
        <dl
          className="grid gap-x-4 gap-y-2"
          style={{ gridTemplateColumns: "repeat(2, minmax(0,1fr))" }}
        >
          <Stat label="TEAM" value={fav ? fav.name.toUpperCase() : "—"} />
          <Stat label="DRIVER" value={p.favDriverCode ?? "—"} />
          <Stat label="PERFECT PODIUMS" value={String(p.perfects)} />
          {p.streak > 0 && (
            <div className="flex items-baseline justify-between gap-2">
              <dt
                className="text-[10px] uppercase text-[color:var(--fg-subtle)]"
                style={{ letterSpacing: "0.1em" }}
                data-tabular
              >
                P1 STREAK
              </dt>
              <dd className="text-sm" data-tabular>
                {/* Emoji font scoped to the glyph only — commit 93212e1.
                    Applying it to the row would swap the whole row's face. */}
                <span aria-hidden style={{ fontFamily: EMOJI_FONT }}>
                  🔥
                </span>{" "}
                {p.streak}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </details>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt
        className="text-[10px] uppercase text-[color:var(--fg-subtle)]"
        style={{ letterSpacing: "0.1em" }}
        data-tabular
      >
        {label}
      </dt>
      <dd className="text-sm" data-tabular>
        {value}
      </dd>
    </div>
  );
}
