// Dashboard — calendar with track diagrams, F1.com-inspired

function DashboardScreen() {
  return (
    <div style={{
      width: SCREEN_W, height: 1400, background: 'var(--bg)', color: 'var(--fg)',
      fontFamily: 'Geist, system-ui, sans-serif', padding: '40px 64px',
    }}>
      <TopBar active="dashboard" />

      {/* Hero — next race */}
      <div style={{
        marginTop: 32, marginBottom: 48,
        background: 'linear-gradient(105deg, #1a0608 0%, var(--surface) 60%)',
        border: '1px solid var(--border)', position: 'relative', overflow: 'hidden',
        display: 'grid', gridTemplateColumns: '1.3fr 1fr', minHeight: 360,
      }}>
        <div style={{ padding: '40px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{
              fontFamily: 'Geist Mono, monospace', fontSize: 11, letterSpacing: '0.18em',
              color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 12,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
              Next Race · Round 6
            </div>
            <h1 style={{
              fontFamily: 'Boldonse, sans-serif', fontSize: 84, lineHeight: 0.9,
              letterSpacing: '-0.015em', textTransform: 'uppercase', margin: 0,
            }}>Miami<br/>Grand Prix</h1>
            <div style={{ color: 'var(--fg-muted)', fontSize: 15, marginTop: 16, fontFamily: 'Geist Mono, monospace', letterSpacing: '0.04em' }}>
              MAY 2 – 4 · MIAMI INT. AUTODROME · 5.412 KM · 57 LAPS
            </div>
          </div>
          <div style={{ display: 'flex', gap: 32, alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'var(--fg-subtle)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Picks Lock In</div>
              <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 44, fontWeight: 500, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>2d 14h 23m</div>
            </div>
            <button style={{
              fontFamily: 'Boldonse, sans-serif', letterSpacing: '0.04em', textTransform: 'uppercase',
              padding: '16px 32px', background: 'var(--accent)', color: 'var(--fg)',
              border: 'none', fontSize: 14, cursor: 'pointer',
            }}>Make Predictions →</button>
          </div>
        </div>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <TrackDiagram trackId="miami" color="var(--fg)" strokeWidth={2.5} width={420} />
          <div style={{ position: 'absolute', top: 24, right: 24, fontFamily: 'Geist Mono, monospace', fontSize: 10, color: 'var(--fg-subtle)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Track Layout
          </div>
        </div>
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 24 }}>
        <div style={{ fontFamily: 'Boldonse, sans-serif', fontSize: 28, letterSpacing: '-0.01em', textTransform: 'uppercase' }}>
          2026 Calendar
        </div>
        <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'var(--fg-subtle)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          5 done · 1 next · 18 upcoming
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1,
        background: 'var(--border)', border: '1px solid var(--border)',
      }}>
        {CALENDAR.map(r => {
          const isNext = r.status === 'next';
          const isDone = r.status === 'done';
          return (
            <div key={r.round} style={{
              background: isNext ? 'var(--surface-2)' : 'var(--surface)',
              padding: 20, position: 'relative', minHeight: 200,
              opacity: isDone ? 0.55 : 1,
              outline: isNext ? '1px solid var(--accent)' : 'none',
              outlineOffset: -1,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'var(--fg-subtle)', letterSpacing: '0.1em' }}>
                  R{String(r.round).padStart(2, '0')} · {r.date.toUpperCase()}
                </div>
                {isNext && (
                  <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 9, letterSpacing: '0.15em', color: 'var(--accent)', border: '1px solid var(--accent)', padding: '2px 6px', textTransform: 'uppercase' }}>NEXT</span>
                )}
                {isDone && (
                  <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 9, letterSpacing: '0.15em', color: 'var(--fg-subtle)', textTransform: 'uppercase' }}>✓ Revealed</span>
                )}
                {r.sprint && !isDone && !isNext && (
                  <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 9, letterSpacing: '0.15em', color: 'var(--warning)', textTransform: 'uppercase' }}>Sprint</span>
                )}
              </div>
              <div style={{
                fontFamily: 'Boldonse, sans-serif', fontSize: 22, lineHeight: 1.05,
                letterSpacing: '-0.005em', textTransform: 'uppercase', marginTop: 12,
              }}>
                {r.name}
              </div>
              <div style={{ color: 'var(--fg-muted)', fontSize: 12, marginTop: 4, fontFamily: 'Geist Mono, monospace', letterSpacing: '0.04em' }}>
                {r.flag} {r.city.toUpperCase()}
              </div>
              <div style={{ marginTop: 18, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <TrackDiagram trackId={r.track} color={isNext ? 'var(--accent)' : 'var(--fg-muted)'} strokeWidth={1.8} width={140} />
                <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, color: 'var(--fg-subtle)', textAlign: 'right', letterSpacing: '0.05em' }}>
                  {TRACK_LENGTH[r.track]}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Driver standings preview */}
      <div style={{ marginTop: 56, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
        <div>
          <div style={{ fontFamily: 'Boldonse, sans-serif', fontSize: 22, letterSpacing: '-0.005em', textTransform: 'uppercase', marginBottom: 16 }}>
            Driver Standings
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            {[
              { d: 'NOR', pts: 121 },{ d: 'PIA', pts: 118 },{ d: 'VER', pts: 99 },
              { d: 'LEC', pts: 85 },{ d: 'RUS', pts: 71 },{ d: 'HAM', pts: 64 },
            ].map((row, i) => {
              const dr = driverById[row.d]; const t = TEAMS[dr.team];
              return (
                <div key={row.d} style={{
                  display: 'grid', gridTemplateColumns: '40px 40px 1fr auto auto', gap: 16,
                  padding: '14px 20px', alignItems: 'center',
                  borderBottom: i < 5 ? '1px solid var(--border)' : 'none',
                }}>
                  <span style={{ fontFamily: 'Boldonse, sans-serif', fontSize: 18, color: i === 0 ? 'var(--accent)' : 'var(--fg)' }}>{i + 1}</span>
                  <DriverPhoto driverId={row.d} size={36} />
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{dr.first} {dr.last}</div>
                    <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, color: t.hex, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{TEAMS[dr.team].name}</div>
                  </div>
                  <span style={{ width: 4, height: 28, background: t.hex }} />
                  <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 18, fontVariantNumeric: 'tabular-nums', minWidth: 40, textAlign: 'right' }}>{row.pts}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <div style={{ fontFamily: 'Boldonse, sans-serif', fontSize: 22, letterSpacing: '-0.005em', textTransform: 'uppercase', marginBottom: 16 }}>
            Constructor Standings
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            {[
              { t: 'mclaren', pts: 239 },{ t: 'ferrari', pts: 149 },{ t: 'redbull', pts: 124 },
              { t: 'mercedes', pts: 118 },{ t: 'aston', pts: 42 },{ t: 'williams', pts: 28 },
            ].map((row, i) => {
              const t = TEAMS[row.t];
              return (
                <div key={row.t} style={{
                  display: 'grid', gridTemplateColumns: '40px 48px 1fr auto auto', gap: 16,
                  padding: '14px 20px', alignItems: 'center',
                  borderBottom: i < 5 ? '1px solid var(--border)' : 'none',
                }}>
                  <span style={{ fontFamily: 'Boldonse, sans-serif', fontSize: 18, color: i === 0 ? 'var(--accent)' : 'var(--fg)' }}>{i + 1}</span>
                  <TeamLogo team={row.t} size={32} />
                  <div style={{ fontFamily: 'Boldonse, sans-serif', fontSize: 16, letterSpacing: '0.01em', textTransform: 'uppercase' }}>{t.name}</div>
                  <span style={{ width: 4, height: 28, background: t.hex }} />
                  <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 18, fontVariantNumeric: 'tabular-nums', minWidth: 40, textAlign: 'right' }}>{row.pts}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { DashboardScreen });
