// Predict screen — driver picker, telemetry nudges, lock countdown

function PredictScreen() {
  const picks = ["PIA", "LEC", null]; // P3 empty for "tap to pick" demo
  const event = CALENDAR.find(c => c.status === 'next');
  return (
    <div style={{
      width: SCREEN_W, height: 1500, background: 'var(--bg)', color: 'var(--fg)',
      fontFamily: 'Geist, system-ui, sans-serif', padding: '40px 64px 160px',
    }}>
      <TopBar active="predict" />

      {/* Hero with track diagram */}
      <div style={{
        marginTop: 40, marginBottom: 40, paddingBottom: 32,
        borderBottom: '1px solid var(--border)',
        display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 48, alignItems: 'flex-end',
      }}>
        <div>
          <div style={{
            fontFamily: 'Geist Mono, monospace', fontSize: 11, letterSpacing: '0.18em',
            color: 'var(--fg-subtle)', textTransform: 'uppercase', marginBottom: 12,
          }}>Round 6 · Race · Picks needed</div>
          <h1 style={{
            fontFamily: 'Boldonse, sans-serif', fontSize: 76, lineHeight: 0.9,
            letterSpacing: '-0.015em', textTransform: 'uppercase', margin: 0,
          }}>Miami<br/>Grand Prix</h1>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <TrackDiagram trackId="miami" color="var(--fg-muted)" strokeWidth={2} width={260} />
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'var(--fg-subtle)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Locks in</div>
          <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 56, fontWeight: 500, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>2d 14h 23m</div>
          <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 12, color: 'var(--fg-muted)', marginTop: 8, letterSpacing: '0.04em' }}>
            Sun 04 May · 20:00 IST · Miami Int. Autodrome
          </div>
        </div>
      </div>

      {/* Pick slots */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', marginBottom: 40 }}>
        {[1, 2, 3].map(pos => {
          const did = picks[pos - 1];
          const dr = did ? driverById[did] : null;
          const t = dr ? TEAMS[dr.team] : null;
          const isP1 = pos === 1;
          return (
            <div key={pos} style={{
              background: isP1 ? 'var(--surface-2)' : 'var(--surface)',
              padding: '32px 28px', minHeight: 320, display: 'flex', flexDirection: 'column', gap: 20, position: 'relative', overflow: 'hidden',
            }}>
              {/* Livery watermark on filled */}
              {dr && (
                <div style={{ position: 'absolute', right: -40, bottom: -20, opacity: 0.32, pointerEvents: 'none' }}>
                  <F1Car team={dr.team} width={460} />
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', position: 'relative' }}>
                <span style={{ fontFamily: 'Boldonse, sans-serif', fontSize: isP1 ? 96 : 64, lineHeight: 0.85 }}>P{pos}</span>
                <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, color: dr ? 'var(--fg-muted)' : 'var(--fg-subtle)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{dr ? 'Picked' : 'Tap to pick'}</span>
              </div>
              {dr ? (
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', position: 'relative' }}>
                  <DriverPhoto driverId={did} size={72} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontFamily: 'Boldonse, sans-serif', fontSize: 28, letterSpacing: '0.02em' }}>{dr.id}</span>
                    <span style={{ fontWeight: 500, fontSize: 14, color: 'var(--fg-muted)' }}>{dr.first} {dr.last}</span>
                    <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 8px', border: `1px solid ${t.hex}`, color: t.hex, alignSelf: 'flex-start', marginTop: 4 }}>{t.name}</span>
                  </div>
                </div>
              ) : (
                <div style={{ fontStyle: 'italic', fontWeight: 500, fontSize: 16, color: 'var(--fg-muted)' }}>Who's on the podium?</div>
              )}
              {dr && (
                <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'var(--fg-muted)', letterSpacing: '0.04em', textDecoration: 'underline', textUnderlineOffset: 3, alignSelf: 'flex-start', position: 'relative' }}>Change pick</span>
              )}
              {/* Telemetry nudges */}
              <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--border)', position: 'relative' }}>
                <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, color: 'var(--fg-subtle)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>Telemetry</div>
                {pos === 1 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'var(--fg-muted)' }}>
                    <div>Form L5 · <span style={{ color: 'var(--fg)' }}>P1 P3 P2 P1 P2</span></div>
                    <div>At Miami · <span style={{ color: 'var(--fg)' }}>1 win, 1 podium</span></div>
                    <div>Quali Δ Race · <span style={{ color: 'var(--success)' }}>+1.2</span></div>
                  </div>
                )}
                {pos === 2 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'var(--fg-muted)' }}>
                    <div>Form L5 · <span style={{ color: 'var(--fg)' }}>P3 P2 DNF P4 P3</span></div>
                    <div>At Miami · <span style={{ color: 'var(--fg)' }}>2 podiums in 3</span></div>
                    <div>Quali Δ Race · <span style={{ color: 'var(--warning)' }}>−0.8</span></div>
                  </div>
                )}
                {pos === 3 && (
                  <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'var(--fg-muted)' }}>
                    Group's hot picks for P3:<br/>
                    <span style={{ color: 'var(--fg)' }}>NOR · VER · RUS</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Driver picker grid */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
          <div style={{ fontFamily: 'Boldonse, sans-serif', fontSize: 22, letterSpacing: '-0.005em', textTransform: 'uppercase' }}>The Grid</div>
          <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'var(--fg-subtle)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>2026 · 20 drivers</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 1, background: 'var(--border)', border: '1px solid var(--border)' }}>
          {DRIVERS.map(d => {
            const t = TEAMS[d.team];
            const inPicks = picks.includes(d.id);
            return (
              <div key={d.id} style={{
                background: 'var(--surface)', padding: 12,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                opacity: inPicks ? 0.4 : 1, position: 'relative',
                borderTop: `3px solid ${t.hex}`,
              }}>
                <DriverPhoto driverId={d.id} size={48} />
                <span style={{ fontFamily: 'Boldonse, sans-serif', fontSize: 14, letterSpacing: '0.02em' }}>{d.id}</span>
                <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, color: 'var(--fg-subtle)', letterSpacing: '0.1em' }}>#{d.num}</span>
                {inPicks && (
                  <span style={{ position: 'absolute', top: 6, right: 6, fontFamily: 'Geist Mono, monospace', fontSize: 9, color: 'var(--accent)', letterSpacing: '0.1em' }}>✓</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Lock bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'var(--surface-2)', borderTop: '1px solid var(--border)',
        padding: '20px 64px', display: 'grid', gridTemplateColumns: '1fr auto', gap: 32, alignItems: 'center',
      }}>
        <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 13, color: 'var(--fg-muted)', letterSpacing: '0.04em' }}>
          2 of 3 slots picked · Picks save as you go · Final lock in <span style={{ color: 'var(--fg)' }}>2d 14h 23m</span>
        </div>
        <button style={{
          fontFamily: 'Boldonse, sans-serif', letterSpacing: '0.04em', textTransform: 'uppercase',
          padding: '18px 40px', background: 'var(--accent)', color: 'var(--fg)',
          border: 'none', fontSize: 16, cursor: 'pointer',
        }}>Lock in picks →</button>
      </div>
    </div>
  );
}

function StandingsScreen() {
  const sorted = [...FRIENDS].sort((a, b) => b.points - a.points);
  const max = sorted[0].points;
  return (
    <div style={{
      width: SCREEN_W, height: 1100, background: 'var(--bg)', color: 'var(--fg)',
      fontFamily: 'Geist, system-ui, sans-serif', padding: '40px 64px',
    }}>
      <TopBar active="standings" />

      <div style={{ marginTop: 40, marginBottom: 32, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 48, alignItems: 'end', paddingBottom: 24, borderBottom: '1px solid var(--border)' }}>
        <div>
          <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, letterSpacing: '0.18em', color: 'var(--fg-subtle)', textTransform: 'uppercase', marginBottom: 12 }}>The Group · Season 2026</div>
          <h1 style={{ fontFamily: 'Boldonse, sans-serif', fontSize: 72, lineHeight: 0.9, letterSpacing: '-0.015em', textTransform: 'uppercase', margin: 0 }}>League<br/>Standings</h1>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'var(--fg-subtle)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>After 5 of 24</div>
          <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 36, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>5 / 24</div>
        </div>
      </div>

      {/* Podium block */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr 1fr', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', marginBottom: 32, alignItems: 'stretch' }}>
        {[sorted[1], sorted[0], sorted[2]].map((f, i) => {
          const pos = [2, 1, 3][i];
          const isLeader = pos === 1;
          const t = TEAMS[f.team];
          return (
            <div key={f.id} style={{
              background: isLeader ? 'var(--surface-2)' : 'var(--surface)',
              padding: isLeader ? '40px 32px' : '32px 24px',
              display: 'flex', flexDirection: 'column', gap: 16, position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', right: -40, top: 0, bottom: 0, opacity: 0.18, display: 'flex', alignItems: 'center' }}>
                <F1Car team={f.team} width={380} />
              </div>
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'Boldonse, sans-serif', fontSize: isLeader ? 144 : 96, lineHeight: 0.85, color: isLeader ? 'var(--accent)' : 'var(--fg)' }}>{pos}</span>
                <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'var(--fg-subtle)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{f.perfectPodiums} PP</span>
              </div>
              <div style={{ position: 'relative', marginTop: 'auto' }}>
                <div style={{ fontFamily: 'Boldonse, sans-serif', fontSize: isLeader ? 36 : 28, letterSpacing: '-0.005em', textTransform: 'uppercase' }}>{f.name}</div>
                <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: t.hex, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 6 }}>
                  Team {TEAMS[f.team].name} · #{driverById[f.driver].num} {f.driver}
                </div>
                <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: isLeader ? 56 : 44, fontWeight: 500, marginTop: 16, fontVariantNumeric: 'tabular-nums' }}>{f.points}<span style={{ fontSize: 14, color: 'var(--fg-subtle)', marginLeft: 8 }}>PTS</span></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rest of the field */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {sorted.slice(3).map((f, i) => {
          const pos = i + 4;
          const t = TEAMS[f.team];
          const pct = (f.points / max) * 100;
          return (
            <div key={f.id} style={{
              display: 'grid', gridTemplateColumns: '60px 40px 1fr 200px 80px', gap: 24,
              padding: '18px 24px', alignItems: 'center',
              borderBottom: i < sorted.length - 4 ? '1px solid var(--border)' : 'none',
            }}>
              <span style={{ fontFamily: 'Boldonse, sans-serif', fontSize: 24 }}>{pos}</span>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--surface-2)', display: 'grid', placeItems: 'center', fontFamily: 'Boldonse, sans-serif', fontSize: 14, border: `1px solid ${t.hex}` }}>{f.name[0]}</div>
              <div>
                <div style={{ fontWeight: 500, fontSize: 16 }}>{f.name}</div>
                <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, color: t.hex, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Team {TEAMS[f.team].name}</div>
              </div>
              <div style={{ background: 'var(--bg)', height: 6, position: 'relative' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: t.hex }} />
              </div>
              <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 22, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{f.points}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { PredictScreen, StandingsScreen });
