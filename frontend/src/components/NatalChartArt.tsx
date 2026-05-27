import { useMemo } from 'react';

interface Props {
  /** Birth date — used as deterministic seed for planet placement. */
  birthDate?: string | null;
  className?: string;
}

const ZODIAC = [
  '♈', '♉', '♊', '♋', '♌', '♍',
  '♎', '♏', '♐', '♑', '♒', '♓',
];

const PLANETS = ['☉', '☽', '☿', '♀', '♂', '♃', '♄', '♅', '♆', '♇'];

function seedFromDate(d?: string | null): number {
  if (!d) return 42;
  let h = 0;
  for (let i = 0; i < d.length; i++) h = (h * 31 + d.charCodeAt(i)) >>> 0;
  return h || 42;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Hand-drawn-feeling natal chart wheel.
 * Pure SVG, monochrome, scales fluidly. Deterministic per birth date.
 */
export function NatalChartArt({ birthDate, className }: Props) {
  const planets = useMemo(() => {
    const rnd = mulberry32(seedFromDate(birthDate));
    // Spread planets around the wheel, deterministic but unique per user.
    const baseAngles = Array.from({ length: PLANETS.length }, (_, i) => i * 36);
    return PLANETS.map((p, i) => {
      const jitter = (rnd() - 0.5) * 28; // ±14°
      return { glyph: p, angle: (baseAngles[i] + jitter + 360) % 360 };
    });
  }, [birthDate]);

  // A few aspect lines between planets (chord lines through center area).
  const aspects = useMemo(() => {
    const rnd = mulberry32(seedFromDate(birthDate) ^ 0x9e3779b9);
    const lines: Array<[number, number]> = [];
    const used = new Set<string>();
    while (lines.length < 5) {
      const a = Math.floor(rnd() * planets.length);
      const b = Math.floor(rnd() * planets.length);
      if (a === b) continue;
      const k = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (used.has(k)) continue;
      used.add(k);
      lines.push([a, b]);
    }
    return lines;
  }, [planets, birthDate]);

  // Geometry — viewBox 400×400, centered.
  const cx = 200;
  const cy = 200;
  const rOuter = 188;
  const rZodiac = 168;
  const rZodiacInner = 142;
  const rHouse = 120;
  const rInner = 70;
  const rPlanet = 102;

  const polar = (r: number, deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  return (
    <svg
      viewBox="0 0 400 400"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Натальная карта"
    >
      <defs>
        <radialGradient id="ncBg" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="hsl(var(--background))" />
          <stop offset="100%" stopColor="hsl(var(--secondary))" />
        </radialGradient>
      </defs>

      {/* Outer disc */}
      <circle cx={cx} cy={cy} r={rOuter} fill="url(#ncBg)" stroke="hsl(var(--foreground))" strokeWidth="1" />

      {/* Zodiac ring */}
      <circle cx={cx} cy={cy} r={rZodiac} fill="none" stroke="hsl(var(--foreground))" strokeWidth="0.6" opacity="0.7" />
      <circle cx={cx} cy={cy} r={rZodiacInner} fill="none" stroke="hsl(var(--foreground))" strokeWidth="0.6" opacity="0.7" />

      {/* 12 zodiac sectors */}
      {ZODIAC.map((sign, i) => {
        const a = i * 30;
        const p1 = polar(rZodiac, a);
        const p2 = polar(rZodiacInner, a);
        const labelP = polar((rZodiac + rZodiacInner) / 2, a + 15);
        return (
          <g key={`z-${i}`}>
            <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="hsl(var(--foreground))" strokeWidth="0.5" opacity="0.6" />
            <text
              x={labelP.x}
              y={labelP.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="14"
              fill="hsl(var(--foreground))"
              opacity="0.85"
            >
              {sign}
            </text>
          </g>
        );
      })}

      {/* Tick marks every degree (subtle) */}
      {Array.from({ length: 360 }).map((_, deg) => {
        const major = deg % 30 === 0;
        const mid = deg % 10 === 0;
        const r1 = rZodiacInner;
        const r2 = rZodiacInner - (major ? 8 : mid ? 4 : 2);
        const p1 = polar(r1, deg);
        const p2 = polar(r2, deg);
        return (
          <line
            key={`t-${deg}`}
            x1={p1.x}
            y1={p1.y}
            x2={p2.x}
            y2={p2.y}
            stroke="hsl(var(--foreground))"
            strokeWidth={major ? 0.7 : 0.3}
            opacity={major ? 0.6 : mid ? 0.3 : 0.18}
          />
        );
      })}

      {/* House ring */}
      <circle cx={cx} cy={cy} r={rHouse} fill="none" stroke="hsl(var(--foreground))" strokeWidth="0.5" opacity="0.5" />

      {/* 12 house cusps */}
      {Array.from({ length: 12 }).map((_, i) => {
        const a = i * 30 + 7; // slight offset so houses don't align with signs
        const p1 = polar(rHouse, a);
        const p2 = polar(rInner, a);
        const labelP = polar(rHouse - 11, a + 15);
        return (
          <g key={`h-${i}`}>
            <line
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke="hsl(var(--foreground))"
              strokeWidth={i % 3 === 0 ? 0.7 : 0.4}
              opacity={i % 3 === 0 ? 0.55 : 0.35}
            />
            <text
              x={labelP.x}
              y={labelP.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="7"
              fill="hsl(var(--muted-foreground))"
              opacity="0.7"
              letterSpacing="1"
            >
              {i + 1}
            </text>
          </g>
        );
      })}

      {/* Aspect lines through inner area */}
      <g opacity="0.45">
        {aspects.map(([a, b], i) => {
          const p1 = polar(rInner - 4, planets[a].angle);
          const p2 = polar(rInner - 4, planets[b].angle);
          return (
            <line
              key={`a-${i}`}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke="hsl(var(--foreground))"
              strokeWidth="0.5"
              strokeDasharray={i % 2 === 0 ? '0' : '2 3'}
            />
          );
        })}
      </g>

      {/* Inner circle */}
      <circle cx={cx} cy={cy} r={rInner} fill="none" stroke="hsl(var(--foreground))" strokeWidth="0.5" opacity="0.6" />

      {/* Center mark */}
      <circle cx={cx} cy={cy} r="2" fill="hsl(var(--foreground))" />
      <circle cx={cx} cy={cy} r="14" fill="none" stroke="hsl(var(--foreground))" strokeWidth="0.4" opacity="0.4" />

      {/* Planets */}
      {planets.map((pl, i) => {
        const p = polar(rPlanet, pl.angle);
        const tick1 = polar(rHouse - 2, pl.angle);
        const tick2 = polar(rHouse - 10, pl.angle);
        return (
          <g key={`p-${i}`}>
            <line
              x1={tick1.x}
              y1={tick1.y}
              x2={tick2.x}
              y2={tick2.y}
              stroke="hsl(var(--foreground))"
              strokeWidth="0.6"
              opacity="0.7"
            />
            <circle cx={p.x} cy={p.y} r="10" fill="hsl(var(--background))" stroke="hsl(var(--foreground))" strokeWidth="0.6" />
            <text
              x={p.x}
              y={p.y + 0.5}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="12"
              fill="hsl(var(--foreground))"
            >
              {pl.glyph}
            </text>
          </g>
        );
      })}

      {/* Cardinal axis labels (ASC/DSC/MC/IC) */}
      {[
        { label: 'ASC', a: 270 },
        { label: 'DSC', a: 90 },
        { label: 'MC', a: 0 },
        { label: 'IC', a: 180 },
      ].map(({ label, a }) => {
        const p = polar(rOuter - 6, a);
        return (
          <text
            key={label}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="6"
            letterSpacing="2"
            fill="hsl(var(--muted-foreground))"
            opacity="0.8"
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}
