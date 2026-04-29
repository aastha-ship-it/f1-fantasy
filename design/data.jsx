// F1 2026 grid + track data. Single source of truth used by all screens.

const TEAMS = {
  mclaren:  { name: "McLaren",        short: "MCL", color: "oklch(72% 0.17 55)",  hex: "#FF8000", livery: ["#FF8000", "#0a0a0a", "#1F8FCF"] },
  ferrari:  { name: "Ferrari",        short: "FER", color: "oklch(58% 0.22 27)",  hex: "#E8002D", livery: ["#E8002D", "#1a0608", "#FFF200"] },
  redbull:  { name: "Red Bull",       short: "RBR", color: "oklch(38% 0.16 265)", hex: "#1E2A6E", livery: ["#1E2A6E", "#FF1E00", "#FFD400"] },
  mercedes: { name: "Mercedes",       short: "MER", color: "oklch(78% 0.08 180)", hex: "#27F4D2", livery: ["#27F4D2", "#0a1a1a", "#C0C0C0"] },
  aston:    { name: "Aston Martin",   short: "AST", color: "oklch(50% 0.15 165)", hex: "#229971", livery: ["#229971", "#0a1a14", "#CEDC00"] },
  williams: { name: "Williams",       short: "WIL", color: "oklch(58% 0.14 245)", hex: "#1868DB", livery: ["#1868DB", "#0c1a2a", "#FFFFFF"] },
  haas:     { name: "Haas",           short: "HAA", color: "oklch(88% 0.01 27)",  hex: "#B6BABD", livery: ["#B6BABD", "#0c0c0c", "#E8002D"] },
  kick:     { name: "Kick Sauber",    short: "KIC", color: "oklch(60% 0.20 145)", hex: "#52E252", livery: ["#52E252", "#0a1a0a", "#0a0a0a"] },
  alpine:   { name: "Alpine",         short: "ALP", color: "oklch(58% 0.18 260)", hex: "#0093CC", livery: ["#0093CC", "#0a0c1a", "#FF87BC"] },
  vcarb:    { name: "Racing Bulls",   short: "VCB", color: "oklch(45% 0.12 260)", hex: "#6692FF", livery: ["#6692FF", "#0a0c1a", "#E8002D"] },
};

// 2026 grid (post-Hamilton-to-Ferrari, Antonelli on Mercedes, Bortoleto on Sauber, etc.)
const DRIVERS = [
  { id: "VER", num: 1,  first: "Max",       last: "Verstappen", team: "redbull",  country: "NL" },
  { id: "TSU", num: 22, first: "Yuki",      last: "Tsunoda",    team: "redbull",  country: "JP" },
  { id: "LEC", num: 16, first: "Charles",   last: "Leclerc",    team: "ferrari",  country: "MC" },
  { id: "HAM", num: 44, first: "Lewis",     last: "Hamilton",   team: "ferrari",  country: "GB" },
  { id: "NOR", num: 4,  first: "Lando",     last: "Norris",     team: "mclaren",  country: "GB" },
  { id: "PIA", num: 81, first: "Oscar",     last: "Piastri",    team: "mclaren",  country: "AU" },
  { id: "RUS", num: 63, first: "George",    last: "Russell",    team: "mercedes", country: "GB" },
  { id: "ANT", num: 12, first: "Andrea K.", last: "Antonelli",  team: "mercedes", country: "IT" },
  { id: "ALO", num: 14, first: "Fernando",  last: "Alonso",     team: "aston",    country: "ES" },
  { id: "STR", num: 18, first: "Lance",     last: "Stroll",     team: "aston",    country: "CA" },
  { id: "ALB", num: 23, first: "Alex",      last: "Albon",      team: "williams", country: "TH" },
  { id: "SAI", num: 55, first: "Carlos",    last: "Sainz",      team: "williams", country: "ES" },
  { id: "GAS", num: 10, first: "Pierre",    last: "Gasly",      team: "alpine",   country: "FR" },
  { id: "DOO", num: 7,  first: "Jack",      last: "Doohan",     team: "alpine",   country: "AU" },
  { id: "HAD", num: 6,  first: "Isack",     last: "Hadjar",     team: "vcarb",    country: "FR" },
  { id: "LAW", num: 30, first: "Liam",      last: "Lawson",     team: "vcarb",    country: "NZ" },
  { id: "OCO", num: 31, first: "Esteban",   last: "Ocon",       team: "haas",     country: "FR" },
  { id: "BEA", num: 87, first: "Ollie",     last: "Bearman",    team: "haas",     country: "GB" },
  { id: "HUL", num: 27, first: "Nico",      last: "Hülkenberg", team: "kick",     country: "DE" },
  { id: "BOR", num: 5,  first: "Gabriel",   last: "Bortoleto",  team: "kick",     country: "BR" },
];

const driverById = Object.fromEntries(DRIVERS.map(d => [d.id, d]));

// 2026 calendar — round numbers, dates, country codes, status (done|next|upcoming)
const CALENDAR = [
  { round: 1,  name: "Australia",    city: "Melbourne",    flag: "🇦🇺", date: "Mar 8",  status: "done", track: "albert_park" },
  { round: 2,  name: "China",        city: "Shanghai",     flag: "🇨🇳", date: "Mar 22", status: "done", track: "shanghai", sprint: true },
  { round: 3,  name: "Japan",        city: "Suzuka",       flag: "🇯🇵", date: "Apr 5",  status: "done", track: "suzuka" },
  { round: 4,  name: "Bahrain",      city: "Sakhir",       flag: "🇧🇭", date: "Apr 12", status: "done", track: "bahrain" },
  { round: 5,  name: "Saudi Arabia", city: "Jeddah",       flag: "🇸🇦", date: "Apr 19", status: "done", track: "jeddah" },
  { round: 6,  name: "Miami",        city: "Miami",        flag: "🇺🇸", date: "May 4",  status: "next", track: "miami", sprint: true },
  { round: 7,  name: "Emilia-Romagna", city: "Imola",      flag: "🇮🇹", date: "May 18", status: "upcoming", track: "imola" },
  { round: 8,  name: "Monaco",       city: "Monte Carlo",  flag: "🇲🇨", date: "May 25", status: "upcoming", track: "monaco" },
  { round: 9,  name: "Spain",        city: "Barcelona",    flag: "🇪🇸", date: "Jun 1",  status: "upcoming", track: "catalunya" },
  { round: 10, name: "Canada",       city: "Montreal",     flag: "🇨🇦", date: "Jun 15", status: "upcoming", track: "montreal" },
  { round: 11, name: "Austria",      city: "Spielberg",    flag: "🇦🇹", date: "Jun 29", status: "upcoming", track: "spielberg" },
  { round: 12, name: "Britain",      city: "Silverstone",  flag: "🇬🇧", date: "Jul 6",  status: "upcoming", track: "silverstone" },
];

// Stylised track outlines — scaled to a 200×120 viewBox each. Hand-drawn approximations.
const TRACKS = {
  miami: "M30,90 L30,40 Q30,25 45,25 L130,25 Q150,25 155,40 L165,55 Q170,65 165,75 L160,85 Q155,95 145,95 L120,95 L115,75 L95,75 L85,95 L70,95 Q55,95 50,85 Z",
  albert_park: "M25,30 L25,90 Q25,100 35,100 L160,100 Q175,100 175,85 L175,55 Q175,40 160,40 L100,40 L100,30 Q100,20 90,20 L40,20 Q25,20 25,30 Z",
  shanghai: "M30,50 L30,40 Q30,25 45,25 L80,25 Q90,25 90,35 L90,55 Q90,65 100,65 L140,65 Q160,65 165,80 L165,90 Q165,100 150,100 L60,100 Q40,100 35,90 L30,75 Q25,65 30,50 Z",
  suzuka: "M30,60 Q30,40 50,35 L90,30 Q100,30 95,45 L85,65 Q80,75 90,80 L130,85 Q150,87 155,75 L165,55 Q170,40 155,35 L130,30 Q120,28 125,40 L130,55",
  bahrain: "M30,60 L30,40 Q30,25 45,25 L100,25 L100,50 L140,50 L150,30 Q160,25 170,35 L170,80 Q170,95 155,95 L60,95 Q40,95 35,80 Z",
  jeddah: "M25,90 L25,55 Q30,35 50,35 L75,40 Q90,45 95,30 L100,20 L120,30 L135,25 L150,40 Q170,55 165,75 L160,90 Q155,100 140,95 L70,90 Q50,95 35,95 Z",
  imola: "M30,80 L30,40 Q30,25 50,30 L90,40 Q100,45 105,30 L115,15 L135,25 L145,45 L160,55 Q170,65 160,75 L150,90 Q140,100 125,95 L60,90 Q40,90 30,80 Z",
  monaco: "M40,90 L30,70 Q25,55 35,45 L55,30 Q70,20 85,30 L100,40 L120,30 L140,25 Q155,25 155,40 L150,55 L165,65 Q170,75 160,85 L130,95 Q90,100 70,90 Z",
  catalunya: "M30,75 L30,40 Q30,25 50,30 L100,40 L120,30 Q140,25 145,40 L150,60 L160,70 Q165,80 155,90 L120,95 Q60,100 40,95 Q25,90 30,75 Z",
  montreal: "M30,90 L30,30 Q30,20 45,20 L70,30 Q90,40 100,30 L130,15 L160,25 Q175,30 170,50 L165,75 Q160,90 145,95 L60,95 Q35,95 30,90 Z",
  spielberg: "M30,80 L30,55 Q30,35 50,30 L80,35 Q95,40 105,30 L130,15 Q150,15 155,35 L160,60 Q160,80 145,90 L70,95 Q35,95 30,80 Z",
  silverstone: "M30,80 L30,45 Q30,30 50,30 L90,35 L100,25 L130,30 L155,20 Q170,25 170,45 L165,75 Q160,90 145,90 L70,95 Q35,95 30,80 Z",
};

const TRACK_LENGTH = {
  miami: "5.412 km", albert_park: "5.278 km", shanghai: "5.451 km", suzuka: "5.807 km",
  bahrain: "5.412 km", jeddah: "6.174 km", imola: "4.909 km", monaco: "3.337 km",
  catalunya: "4.657 km", montreal: "4.361 km", spielberg: "4.318 km", silverstone: "5.891 km",
};

// 10 friends in the league
const FRIENDS = [
  { id: "aastha", name: "Aastha",  team: "mclaren",  driver: "PIA", points: 47, perfectPodiums: 2 },
  { id: "vineet", name: "Vineet",  team: "redbull",  driver: "VER", points: 38, perfectPodiums: 0 },
  { id: "priya",  name: "Priya",   team: "ferrari",  driver: "LEC", points: 35, perfectPodiums: 1 },
  { id: "rohan",  name: "Rohan",   team: "mercedes", driver: "RUS", points: 31, perfectPodiums: 0 },
  { id: "nikhil", name: "Nikhil",  team: "ferrari",  driver: "HAM", points: 28, perfectPodiums: 0 },
  { id: "tara",   name: "Tara",    team: "aston",    driver: "ALO", points: 22, perfectPodiums: 0 },
  { id: "kunal",  name: "Kunal",   team: "mclaren",  driver: "NOR", points: 20, perfectPodiums: 0 },
  { id: "dev",    name: "Dev",     team: "williams", driver: "SAI", points: 17, perfectPodiums: 0 },
  { id: "anya",   name: "Anya",    team: "mercedes", driver: "ANT", points: 14, perfectPodiums: 0 },
  { id: "siddh",  name: "Siddh",   team: "redbull",  driver: "TSU", points: 11, perfectPodiums: 0 },
];

// Driver portrait — abstract racing helmet rendered in team livery colors. No external IP.
function DriverPortrait({ driverId, size = 80, style = {} }) {
  const d = driverById[driverId];
  if (!d) return null;
  const t = TEAMS[d.team];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
      <defs>
        <linearGradient id={`bg-${driverId}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={t.livery[1]} />
          <stop offset="1" stopColor="#000" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#bg-${driverId})`} />
      {/* Helmet silhouette */}
      <path d="M 22,68 Q 22,32 50,32 Q 78,32 78,68 L 78,82 Q 78,86 74,86 L 26,86 Q 22,86 22,82 Z"
            fill={t.livery[0]} />
      {/* Visor */}
      <path d="M 30,52 Q 30,46 36,46 L 64,46 Q 70,46 70,52 L 70,62 Q 70,66 66,66 L 34,66 Q 30,66 30,62 Z"
            fill="#0a0a0a" />
      <path d="M 32,54 L 68,54 L 68,58 L 32,58 Z" fill={t.livery[2]} opacity="0.4" />
      {/* Stripe */}
      <rect x="22" y="70" width="56" height="4" fill={t.livery[2]} />
      <rect x="22" y="76" width="56" height="2" fill={t.livery[1]} />
      {/* Number */}
      <text x="50" y="100" textAnchor="middle" fontFamily="'Boldonse', sans-serif"
            fontSize="13" fill={t.livery[2]} opacity="0.85"
            transform="translate(0, -4)">{d.num}</text>
    </svg>
  );
}

// Team logo — abstract mark in team color (no real logos; trademark-safe)
function TeamMark({ team, size = 40 }) {
  const t = TEAMS[team];
  if (!t) return null;
  const marks = {
    mclaren:  <path d="M 8,32 Q 20,8 32,32 L 28,32 Q 20,18 12,32 Z" fill={t.hex} />,
    ferrari:  <path d="M 20,6 L 26,16 L 36,17 L 28,24 L 30,34 L 20,29 L 10,34 L 12,24 L 4,17 L 14,16 Z" fill={t.hex} />,
    redbull:  <g><circle cx="14" cy="20" r="8" fill={t.hex}/><circle cx="26" cy="20" r="8" fill="#FF1E00"/></g>,
    mercedes: <g><circle cx="20" cy="20" r="13" fill="none" stroke={t.hex} strokeWidth="2"/><path d="M 20,8 L 20,32 M 9,26 L 31,14 M 9,14 L 31,26" stroke={t.hex} strokeWidth="2"/></g>,
    aston:    <path d="M 20,6 L 34,20 L 20,34 L 6,20 Z" fill="none" stroke={t.hex} strokeWidth="2.5" />,
    williams: <g><rect x="6" y="14" width="28" height="3" fill={t.hex}/><rect x="6" y="20" width="28" height="3" fill={t.hex}/><rect x="6" y="26" width="28" height="3" fill={t.hex}/></g>,
    haas:     <path d="M 8,8 L 14,8 L 14,32 L 8,32 Z M 26,8 L 32,8 L 32,32 L 26,32 Z M 14,18 L 26,18 L 26,22 L 14,22 Z" fill={t.hex} />,
    kick:     <g><circle cx="20" cy="20" r="12" fill="none" stroke={t.hex} strokeWidth="3"/><path d="M 14,20 L 18,24 L 26,16" stroke={t.hex} strokeWidth="2.5" fill="none"/></g>,
    alpine:   <g><path d="M 6,32 L 16,12 L 26,32 Z" fill={t.hex}/><path d="M 18,32 L 28,18 L 34,32 Z" fill={t.hex} opacity="0.7"/></g>,
    vcarb:    <g><circle cx="14" cy="20" r="7" fill={t.hex}/><circle cx="26" cy="20" r="7" fill="#E8002D"/></g>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 40 40">{marks[team]}</svg>
  );
}

// F1 logo — abstract "F" + speed lines, generic enough to dodge IP
function F1Mark({ height = 24, color = "#E8002D" }) {
  const w = height * 2.5;
  return (
    <svg width={w} height={height} viewBox="0 0 100 40" style={{ display: 'block' }}>
      <path d="M 6,32 L 14,8 L 38,8 L 36,14 L 22,14 L 20,20 L 32,20 L 30,26 L 18,26 L 16,32 Z" fill="#fff" />
      <path d="M 44,8 L 56,8 L 56,32 L 50,32 L 50,14 L 44,14 Z" fill="#fff" />
      <path d="M 64,8 L 96,8 L 94,12 L 66,12 Z M 62,16 L 94,16 L 92,20 L 64,20 Z M 60,24 L 92,24 L 90,28 L 62,28 Z" fill={color} />
    </svg>
  );
}

// 2026-style F1 car silhouette — top-down, in livery colors. Used in reveal sweep.
function F1CarLivery({ team, width = 600, style = {}, className = "" }) {
  const t = TEAMS[team];
  if (!t) return null;
  const id = `car-${team}-${Math.random().toString(36).slice(2, 7)}`;
  return (
    <svg width={width} height={width * 0.32} viewBox="0 0 600 192" style={style} className={className}>
      <defs>
        <linearGradient id={`${id}-body`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={t.livery[0]} />
          <stop offset="0.6" stopColor={t.livery[0]} />
          <stop offset="1" stopColor={t.livery[1]} />
        </linearGradient>
        <linearGradient id={`${id}-stripe`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={t.livery[2]} stopOpacity="0" />
          <stop offset="0.3" stopColor={t.livery[2]} />
          <stop offset="1" stopColor={t.livery[2]} />
        </linearGradient>
      </defs>
      {/* Front wing */}
      <rect x="10" y="76" width="80" height="40" fill={t.livery[1]} />
      <rect x="10" y="80" width="80" height="6" fill={t.livery[2]} />
      <rect x="10" y="106" width="80" height="6" fill={t.livery[2]} />
      {/* Front tires */}
      <rect x="78" y="56" width="56" height="20" rx="4" fill="#0a0a0a" />
      <rect x="78" y="116" width="56" height="20" rx="4" fill="#0a0a0a" />
      <rect x="84" y="60" width="44" height="2" fill="#444" />
      <rect x="84" y="130" width="44" height="2" fill="#444" />
      {/* Nose */}
      <path d="M 90,86 L 150,80 L 160,96 L 150,112 L 90,106 Z" fill={`url(#${id}-body)`} />
      {/* Chassis main body */}
      <path d="M 150,76 L 360,72 Q 400,72 410,80 L 440,86 L 440,106 L 410,112 Q 400,120 360,120 L 150,116 Z"
            fill={`url(#${id}-body)`} />
      {/* Halo */}
      <path d="M 250,76 Q 270,60 290,76 L 290,80 Q 270,68 250,80 Z" fill={t.livery[1]} />
      {/* Cockpit */}
      <ellipse cx="270" cy="96" rx="22" ry="10" fill={t.livery[1]} />
      <ellipse cx="270" cy="96" rx="18" ry="7" fill="#0a0a0a" />
      {/* Sidepod intakes */}
      <path d="M 220,80 L 340,80 L 350,90 L 340,112 L 220,112 L 210,90 Z" fill={`url(#${id}-body)`} />
      <rect x="240" y="86" width="80" height="3" fill={t.livery[2]} opacity="0.7" />
      {/* Center stripe */}
      <rect x="150" y="93" width="290" height="6" fill={`url(#${id}-stripe)`} opacity="0.6" />
      {/* Rear tires */}
      <rect x="430" y="50" width="64" height="22" rx="4" fill="#0a0a0a" />
      <rect x="430" y="120" width="64" height="22" rx="4" fill="#0a0a0a" />
      <rect x="436" y="54" width="52" height="2" fill="#444" />
      <rect x="436" y="136" width="52" height="2" fill="#444" />
      {/* Engine cover */}
      <path d="M 360,72 L 420,68 L 440,86 L 440,106 L 420,124 L 360,120 Z" fill={t.livery[1]} />
      <rect x="365" y="88" width="60" height="16" fill={t.livery[0]} opacity="0.9" />
      {/* Rear wing */}
      <rect x="490" y="62" width="14" height="68" fill={t.livery[1]} />
      <rect x="495" y="50" width="80" height="14" fill={t.livery[1]} />
      <rect x="495" y="128" width="80" height="14" fill={t.livery[1]} />
      <rect x="500" y="55" width="70" height="4" fill={t.livery[2]} />
      <rect x="500" y="133" width="70" height="4" fill={t.livery[2]} />
      {/* Driver number on engine cover */}
      <text x="395" y="102" textAnchor="middle" fontFamily="'Boldonse', sans-serif"
            fontSize="20" fill={t.livery[2]} fontWeight="700">
        {DRIVERS.find(d => d.team === team)?.num ?? ""}
      </text>
    </svg>
  );
}

// Track diagram component — outlines for race calendar
function TrackDiagram({ trackId, color = "currentColor", strokeWidth = 2.5, width = 200, style = {} }) {
  const path = TRACKS[trackId];
  if (!path) return null;
  return (
    <svg viewBox="0 0 200 120" width={width} style={style}>
      <path d={path} fill="none" stroke={color} strokeWidth={strokeWidth}
            strokeLinejoin="round" strokeLinecap="round" />
      {/* Start/finish line */}
      <circle cx="30" cy="60" r="3" fill={color} />
    </svg>
  );
}

// Miami GP results (from the wireframe reference)
const MIAMI_RESULT = {
  podium: [
    { driver: "PIA", lap: "1:32.847" },
    { driver: "LEC", lap: "+3.412" },
    { driver: "NOR", lap: "+8.201" },
  ],
  fastestLap: { driver: "VER", time: "1:29.284" },
};

// Friend predictions for Miami — varied outcomes
const MIAMI_PREDICTIONS = {
  aastha: { picks: ["PIA", "LEC", "NOR"], pts: 18, breakdown: "3 exact · perfect podium", perfect: true },
  vineet: { picks: ["PIA", "NOR", "VER"], pts: 7,  breakdown: "1 exact · 1 slot · 1 dnf" },
  priya:  { picks: ["PIA", "RUS", "SAI"], pts: 5,  breakdown: "1 exact · 0 slot · 2 miss" },
  rohan:  { picks: ["VER", "PIA", "LEC"], pts: 4,  breakdown: "0 exact · 2 slot · 1 miss" },
  nikhil: { picks: ["VER", "HAM", "PIA"], pts: 2,  breakdown: "0 exact · 1 slot · 2 miss" },
  tara:   { picks: ["VER", "RUS", "ALO"], pts: 0,  breakdown: "0 exact · 0 slot — rough week" },
  anya:   { picks: ["NOR", "PIA", "RUS"], pts: 4,  breakdown: "0 exact · 2 slot · 1 miss" },
  siddh:  { picks: ["PIA", "VER", "HAM"], pts: 5,  breakdown: "1 exact · 0 slot · 2 miss" },
  kunal:  { picks: ["LEC", "PIA", "NOR"], pts: 9,  breakdown: "1 exact · 2 slot · 0 miss" },
  dev:    { picks: ["PIA", "VER", "SAI"], pts: 5,  breakdown: "1 exact · 0 slot · 2 miss" },
};

// === REAL ASSET COMPONENTS ===
// Map of driver IDs that DON'T have a photo → known alternative file. TSU→PER, DOO→COL.
const DRIVER_PHOTO_ALT = { TSU: 'PER', DOO: 'COL' };
function driverPhotoSrc(driverId) {
  const id = DRIVER_PHOTO_ALT[driverId] || driverId;
  return `assets/drivers/${id}.png`;
}
// Tight portrait crop (600×600 square, driver-centered) — used in cards/avatars
function driverPortraitSrc(driverId) {
  return `assets/drivers-portrait/${driverId}.png`;
}

// Driver photo — full F1.com-style portrait card with team-color background
function DriverPhoto({ driverId, size = 80, style = {}, mode = 'avatar' }) {
  const d = driverById[driverId];
  if (!d) return null;
  const t = TEAMS[d.team];
  const src = driverPhotoSrc(driverId);
  if (mode === 'full') {
    return (
      <img src={src} alt={`${d.first} ${d.last}`}
           style={{ display: 'block', width: '100%', height: 'auto', ...style }} />
    );
  }
  // avatar mode: circular crop using pre-cropped portrait (600×600 driver-centered)
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: t.livery[1], overflow: 'hidden', position: 'relative',
      flexShrink: 0, ...style,
    }}>
      <img src={driverPortraitSrc(driverId)} alt={`${d.first} ${d.last}`}
           style={{
             position: 'absolute', inset: 0,
             width: '100%', height: '100%',
             objectFit: 'cover', objectPosition: 'center top',
           }} />
    </div>
  );
}

// Driver portrait card — F1.com style: name + team + number + flag overlaid on hero photo
function DriverHeroCard({ driverId, width = 360, style = {} }) {
  const d = driverById[driverId];
  if (!d) return null;
  const t = TEAMS[d.team];
  return (
    <div style={{
      width, position: 'relative', overflow: 'hidden',
      background: t.livery[1], aspectRatio: '1000/500', ...style,
    }}>
      <img src={driverPhotoSrc(driverId)} alt={`${d.first} ${d.last}`}
           style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
  );
}

// Team logo — real PNG (with .jpg fallbacks for haas/redbull)
const LOGO_EXT = {
  haas: 'jpg', redbull: 'jpg',
};
function TeamLogo({ team, size = 40, style = {}, invert = false }) {
  const t = TEAMS[team];
  if (!t) return null;
  const ext = LOGO_EXT[team] || 'png';
  return (
    <img src={`assets/logos/${team}.${ext}`} alt={t.name}
         style={{
           display: 'block', width: size, height: size, objectFit: 'contain',
           filter: invert ? 'brightness(1.1) contrast(1.05)' : 'none',
           ...style,
         }} />
  );
}

// F1 car — real side-profile livery photo. Used in reveal sweep + dashboard hero.
function F1Car({ team, width = 600, style = {}, className = "" }) {
  const t = TEAMS[team];
  if (!t) return null;
  return (
    <img src={`assets/cars/${team}.png`} alt={`${t.name} 2026 car`}
         className={className}
         style={{
           display: 'block', width, height: 'auto',
           ...style,
         }} />
  );
}

Object.assign(window, {
  TEAMS, DRIVERS, driverById, CALENDAR, TRACKS, TRACK_LENGTH, FRIENDS,
  DriverPortrait, TeamMark, F1Mark, F1CarLivery, TrackDiagram,
  DriverPhoto, DriverHeroCard, TeamLogo, F1Car, driverPortraitSrc, driverPhotoSrc,
  MIAMI_RESULT, MIAMI_PREDICTIONS,
});
