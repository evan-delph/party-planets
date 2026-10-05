/**
 * The PARTY PLANETS logo: chunky glossy letters with a white die-cut sticker
 * border, an ink outline, an extruded side face and a little ringed planet and
 * UFO pilot. Drawn as inline SVG so it uses the page's Fredoka face and stays
 * crisp at any size. `variant` only changes which decorations are shown.
 */
import { useId } from 'react';

const INK = '#1b2440';
/** [top face, side face] per letter of PARTY. */
const PARTY = [
  ['#ff9a2e', '#c45200'],
  ['#ff4fa8', '#b0156c'],
  ['#2ccdf5', '#0a7db5'],
  ['#86e842', '#3d9a12'],
  ['#ffd52e', '#c98a00'],
] as const;
const PLANETS_FACE = ['#ffffff', '#5d36d6'] as const;
/** Per-glyph tilt, for a hand-placed, bouncy feel. */
const TILT_1 = '-7 4 -3 6 -5';
const TILT_2 = '-4 3 -5 2 -3 5 -2';

/** Planet tints used across the menu UI. */
export const PLANET_TINT: Record<string, string> = {
  earth: '#33c3f5',
  selene: '#a99bff',
  ignara: '#ff7a2e',
  verdara: '#ff6fd0',
};

function mix(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s: number) => {
    const v = (n >> s) & 255;
    return Math.round(v + (255 - v) * amount)
      .toString(16)
      .padStart(2, '0');
  };
  return '#' + ch(16) + ch(8) + ch(0);
}

export function PartyLogo({
  variant = 'hero',
  className = '',
  ufo,
}: {
  variant?: 'hero' | 'compact';
  className?: string;
  /** Mascot sticker flying past the top-right corner (hero only). */
  ufo?: string;
}) {
  const uid = 'pl' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const hero = variant === 'hero';
  // Line geometry in viewBox units.
  const l1 = { x: 340, y: 128, size: 128 };
  const l2 = { x: 340, y: 262, size: 140 };
  const text = (
    line: typeof l1,
    content: React.ReactNode,
    props: React.SVGProps<SVGTextElement>,
    tilt: string,
  ) => (
    <text
      x={line.x}
      y={line.y}
      fontSize={line.size}
      textAnchor="middle"
      rotate={tilt}
      strokeLinejoin="round"
      strokeLinecap="round"
      {...props}
    >
      {content}
    </text>
  );
  const party = (fill: (i: number) => string) =>
    'PARTY'.split('').map((c, i) => (
      <tspan key={i} fill={fill(i)} stroke={fill(i)}>
        {c}
      </tspan>
    ));
  /** Every layer of one line, back to front. */
  const layers = (
    line: typeof l1,
    word: string,
    tilt: string,
    face: (i: number) => string,
    side: (i: number) => string,
  ) => {
    const plain = (fill: string, sw: number, dy: number, _id: string) =>
      text(
        line,
        word,
        {
          fill,
          stroke: fill,
          strokeWidth: sw,
          transform: `translate(0 ${dy})`,
        } as React.SVGProps<SVGTextElement>,
        tilt,
      );
    const colored = (
      fill: (i: number) => string,
      sw: number,
      dy: number,
      _id: string,
    ) =>
      text(
        line,
        word === 'PARTY'
          ? party(fill)
          : word
              .split('')
              .map((c, i) => (
                <tspan key={i} fill={fill(i)} stroke={fill(i)}>
                  {c}
                </tspan>
              )),
        {
          strokeWidth: sw,
          transform: `translate(0 ${dy})`,
        } as React.SVGProps<SVGTextElement>,
        tilt,
      );
    return (
      <>
        {/* white die-cut sticker edge */}
        {plain('#ffffff', 36, 14, 'w2')}
        {plain('#ffffff', 36, 0, 'w1')}
        {/* ink outline + hard drop lip */}
        {plain(INK, 20, 14, 'k3')}
        {plain(INK, 20, 7, 'k2')}
        {plain(INK, 20, 0, 'k1')}
        {/* extruded side face */}
        {colored(side, 7, 9, 's2')}
        {colored(side, 7, 4, 's1')}
        {/* glossy top face */}
        {colored(face, 5, 0, 'f')}
      </>
    );
  };
  const g = (name: string, i: number) => `url(#${uid}${name}${i})`;
  const svg = (
    <svg
      className={`party-logo ${hero ? 'is-hero' : 'is-compact'} ${className}`}
      viewBox={hero ? '0 -10 700 330' : '30 0 620 300'}
      role="img"
      aria-label="Party Planets"
      style={{ fontFamily: "'PP Fredoka', 'Fredoka Variable', 'Trebuchet MS', sans-serif" }}
      fontWeight={700}
    >
      <defs>
        {PARTY.map(([top], i) => (
          <linearGradient
            key={i}
            id={`${uid}a${i}`}
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1={l1.y - l1.size * 0.72}
            x2="0"
            y2={l1.y}
          >
            <stop offset="0" stopColor={mix(top, 0.72)} />
            <stop offset="0.4" stopColor={mix(top, 0.5)} />
            <stop offset="0.43" stopColor={top} />
            <stop offset="1" stopColor={mix(top, -0.0)} />
          </linearGradient>
        ))}
        <linearGradient
          id={`${uid}b0`}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1={l2.y - l2.size * 0.72}
          x2="0"
          y2={l2.y}
        >
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.42" stopColor="#ffffff" />
          <stop offset="0.45" stopColor="#f1f2ff" />
          <stop offset="1" stopColor="#dcdcff" />
        </linearGradient>
        <radialGradient id={`${uid}ball`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffe9a8" />
          <stop offset="0.45" stopColor="#ffb13b" />
          <stop offset="1" stopColor="#e2561b" />
        </radialGradient>
      </defs>
      <g className="logo-line logo-line-2">
        {layers(
          l2,
          'PLANETS',
          TILT_2,
          () => g('b', 0),
          () => PLANETS_FACE[1],
        )}
      </g>
      <g className="logo-line logo-line-1">
        {layers(
          l1,
          'PARTY',
          TILT_1,
          (i) => g('a', i),
          (i) => PARTY[i][1],
        )}
      </g>
      {/* ringed planet tucked against the P */}
      <g className="logo-planet">
      <g transform="translate(78 78) rotate(-18)">
        <ellipse rx="62" ry="17" fill="none" stroke="#ffffff" strokeWidth="28" />
        <circle r="44" fill="#ffffff" />
        <path d="M-62 0a62 17 0 0 1 124 0" fill="none" stroke={INK} strokeWidth="15" />
        <path d="M-62 0a62 17 0 0 1 124 0" fill="none" stroke="#7af0ff" strokeWidth="6" />
        <circle r="35" fill={`url(#${uid}ball)`} stroke={INK} strokeWidth="6" />
        <path d="M-31 8c16 6 46 6 62 0" fill="none" stroke="#e8611f" strokeWidth="5" opacity=".6" />
        <path d="M-20 -21a25 25 0 0 1 15-9" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
        <path d="M-62 0a62 17 0 0 0 124 0" fill="none" stroke={INK} strokeWidth="15" strokeLinecap="round" />
        <path d="M-62 0a62 17 0 0 0 124 0" fill="none" stroke="#7af0ff" strokeWidth="6" strokeLinecap="round" />
      </g>
      </g>
      {hero && (
        <>
          <path
            className="logo-spark s1"
            d="M612 196c2 11 8 17 19 19-11 2-17 8-19 19-2-11-8-17-19-19 11-2 17-8 19-19z"
            fill="#ffe14d"
            stroke={INK}
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path
            className="logo-spark s2"
            d="M44 196c1.5 8 6 12.5 14 14-8 1.5-12.5 6-14 14-1.5-8-6-12.5-14-14 8-1.5 12.5-6 14-14z"
            fill="#7af0ff"
            stroke={INK}
            strokeWidth="4"
            strokeLinejoin="round"
          />
        </>
      )}
    </svg>
  );
  // The SVG stays static; motion lives on HTML wrappers so it is GPU-composited.
  return (
    <span className={`party-logo-wrap ${hero ? 'is-hero' : 'is-compact'}`}>
      {svg}
      {hero && ufo && (
        <img className="logo-ufo-img" src={ufo} alt="" aria-hidden="true" />
      )}
    </span>
  );
}
