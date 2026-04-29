// Login + Profile screens

const SCREEN_W = 1440;

function LoginScreen() {
  return (
    <div style={{
      width: SCREEN_W, height: 900, background: 'var(--bg)', color: 'var(--fg)',
      fontFamily: 'Geist, system-ui, sans-serif', position: 'relative', overflow: 'hidden',
      display: 'grid', gridTemplateColumns: '1.1fr 1fr',
    }}>
      {/* Left — cinematic livery panel */}
      <div style={{
        position: 'relative', background: '#0a0608', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {/* Diagonal stripes */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'repeating-linear-gradient(115deg, transparent 0 60px, rgba(232,0,45,0.04) 60px 62px)',
        }} />
        {/* Massive car */}
        <div style={{ transform: 'rotate(-8deg) translateX(-40px)', opacity: 0.95 }}>
          <F1Car team="ferrari" width={1100} style={{ filter: 'drop-shadow(0 30px 50px rgba(0,0,0,0.7))' }} />
        </div>
        {/* Speed lines */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(90deg, transparent 0%, transparent 70%, rgba(0,0,0,0.7) 100%)',
        }} />
        {/* Bottom edge text */}
        <div style={{
          position: 'absolute', bottom: 32, left: 32,
          fontFamily: 'Geist Mono, monospace', fontSize: 11, letterSpacing: '0.15em',
          color: 'var(--fg-subtle)', textTransform: 'uppercase',
        }}>
          2026 Season · Round 6 · Miami GP — May 4
        </div>
      </div>
      {/* Right — login form */}
      <div style={{
        padding: '64px 72px', display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <F1Mark height={28} />
          <span style={{
            fontFamily: 'Geist Mono, monospace', fontSize: 11, letterSpacing: '0.2em',
            color: 'var(--fg-subtle)', textTransform: 'uppercase',
          }}>Fantasy · The Group</span>
        </div>

        <div>
          <div style={{
            fontFamily: 'Geist Mono, monospace', fontSize: 11, letterSpacing: '0.18em',
            color: 'var(--fg-subtle)', textTransform: 'uppercase', marginBottom: 24,
          }}>Sign in to predict</div>
          <h1 style={{
            fontFamily: 'Boldonse, sans-serif', fontSize: 88, lineHeight: 0.9,
            letterSpacing: '-0.015em', textTransform: 'uppercase', margin: 0,
          }}>Call<br/>The Race.</h1>
          <p style={{
            color: 'var(--fg-muted)', fontSize: 17, lineHeight: 1.55, marginTop: 24,
            maxWidth: 440,
          }}>
            Lock your podium picks before lights out. Reveal together when the chequered flag drops.
            Eight friends. One season. One champion.
          </p>

          <div style={{ marginTop: 48, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420 }}>
            <button style={{
              padding: '18px 24px', background: 'var(--surface)', color: 'var(--fg)',
              border: '1px solid var(--border)', fontSize: 15, fontWeight: 500,
              fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 12,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24"><path d="M12 11v3.6h5.1c-.2 1.4-1.6 4-5.1 4-3.1 0-5.6-2.5-5.6-5.6S8.9 7.4 12 7.4c1.7 0 2.9.7 3.6 1.4l2.4-2.4C16.5 4.9 14.4 4 12 4 7.6 4 4 7.6 4 12s3.6 8 8 8c4.6 0 7.7-3.2 7.7-7.8 0-.5 0-.9-.1-1.3H12z" fill="#fff"/></svg>
              Continue with Google
            </button>
            <div style={{
              fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'var(--fg-subtle)',
              letterSpacing: '0.06em', marginTop: 8,
            }}>
              Invite-only league · Code already on this device ✓
            </div>
          </div>
        </div>

        <div style={{
          display: 'flex', justifyContent: 'space-between', fontFamily: 'Geist Mono, monospace',
          fontSize: 11, color: 'var(--fg-subtle)', letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          <span>Locks in 2d 14h 23m</span>
          <span>Season 2026 · 12 of 24 done</span>
        </div>
      </div>
    </div>
  );
}

function ProfileScreen() {
  const favTeam = 'mclaren';
  const favDriver = 'PIA';
  return (
    <div style={{
      width: SCREEN_W, height: 1000, background: 'var(--bg)', color: 'var(--fg)',
      fontFamily: 'Geist, system-ui, sans-serif', padding: '40px 64px',
    }}>
      <TopBar active="profile" user="Aastha" />
      <div style={{ marginTop: 40, marginBottom: 32 }}>
        <div style={{
          fontFamily: 'Geist Mono, monospace', fontSize: 11, letterSpacing: '0.18em',
          color: 'var(--fg-subtle)', textTransform: 'uppercase', marginBottom: 12,
        }}>Welcome — set your colours</div>
        <h1 style={{
          fontFamily: 'Boldonse, sans-serif', fontSize: 72, lineHeight: 0.9,
          letterSpacing: '-0.015em', textTransform: 'uppercase', margin: 0,
        }}>Pick your<br/>side of the grid.</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginTop: 48 }}>
        {/* Favourite team */}
        <div>
          <div style={{
            fontFamily: 'Geist Mono, monospace', fontSize: 11, letterSpacing: '0.18em',
            color: 'var(--fg-subtle)', textTransform: 'uppercase', marginBottom: 16,
          }}>Favourite Team</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            {Object.entries(TEAMS).map(([key, t]) => (
              <button key={key} style={{
                padding: '20px 12px', background: key === favTeam ? 'var(--surface-2)' : 'var(--surface)',
                border: key === favTeam ? `1px solid ${t.hex}` : '1px solid var(--border)',
                cursor: 'pointer', display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 10, color: 'var(--fg)',
                outline: key === favTeam ? `2px solid ${t.hex}33` : 'none',
              }}>
                <TeamLogo team={key} size={36} />
                <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, letterSpacing: '0.1em' }}>{t.short}</span>
              </button>
            ))}
          </div>
        </div>
        {/* Favourite driver */}
        <div>
          <div style={{
            fontFamily: 'Geist Mono, monospace', fontSize: 11, letterSpacing: '0.18em',
            color: 'var(--fg-subtle)', textTransform: 'uppercase', marginBottom: 16,
          }}>Favourite Driver</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            {DRIVERS.slice(0, 10).map(d => {
              const sel = d.id === favDriver;
              const t = TEAMS[d.team];
              return (
                <button key={d.id} style={{
                  padding: '12px 8px', background: sel ? 'var(--surface-2)' : 'var(--surface)',
                  border: sel ? `1px solid ${t.hex}` : '1px solid var(--border)',
                  cursor: 'pointer', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 6, color: 'var(--fg)',
                }}>
                  <DriverPhoto driverId={d.id} size={48} />
                  <span style={{ fontFamily: 'Boldonse, sans-serif', fontSize: 13 }}>{d.id}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Past favourite — historic team */}
      <div style={{ marginTop: 48 }}>
        <div style={{
          fontFamily: 'Geist Mono, monospace', fontSize: 11, letterSpacing: '0.18em',
          color: 'var(--fg-subtle)', textTransform: 'uppercase', marginBottom: 16,
        }}>All-Time Hero</div>
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          padding: 32, display: 'grid', gridTemplateColumns: '1fr auto', gap: 24,
          alignItems: 'center',
        }}>
          <div>
            <div style={{ fontFamily: 'Boldonse, sans-serif', fontSize: 44, letterSpacing: '-0.01em' }}>
              SENNA · MP4/4
            </div>
            <div style={{ color: 'var(--fg-muted)', marginTop: 8, fontSize: 14 }}>
              McLaren-Honda · 1988 · 8 wins from 16 races
            </div>
          </div>
          <F1Car team="mclaren" width={460} />
        </div>
      </div>

      <div style={{
        marginTop: 56, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 12, color: 'var(--fg-subtle)' }}>
          Display name · <span style={{ color: 'var(--fg)' }}>Aastha</span>
        </div>
        <button style={{
          fontFamily: 'Boldonse, sans-serif', letterSpacing: '0.04em', textTransform: 'uppercase',
          padding: '18px 40px', background: 'var(--accent)', color: 'var(--fg)',
          border: 'none', fontSize: 15, cursor: 'pointer',
        }}>Save & enter the paddock →</button>
      </div>
    </div>
  );
}

function TopBar({ active, user = "Aastha" }) {
  const tabs = [
    { id: 'dashboard', label: 'Calendar' },
    { id: 'predict',   label: 'Predict' },
    { id: 'standings', label: 'Standings' },
    { id: 'league',    label: 'League' },
    { id: 'profile',   label: 'Profile' },
  ];
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      paddingBottom: 20, borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
        <F1Mark height={22} />
        <div style={{ display: 'flex', gap: 0 }}>
          {tabs.map(t => (
            <div key={t.id} style={{
              padding: '8px 16px',
              fontFamily: 'Geist Mono, monospace', fontSize: 12,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              color: t.id === active ? 'var(--fg)' : 'var(--fg-subtle)',
              borderBottom: t.id === active ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -22, paddingBottom: 22,
            }}>{t.label}</div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'var(--fg-subtle)', letterSpacing: '0.06em' }}>
          THE GROUP · 2026
        </span>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', background: 'var(--surface-2)',
          border: '1px solid var(--border)', display: 'grid', placeItems: 'center',
          fontFamily: 'Boldonse, sans-serif', fontSize: 13,
        }}>{user[0]}</div>
      </div>
    </div>
  );
}

Object.assign(window, { LoginScreen, ProfileScreen, TopBar, SCREEN_W });
