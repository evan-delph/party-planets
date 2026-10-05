/**
 * Party Planets illustration kit: hand-authored SVG art for the HUD.
 * Every piece shares one ink outline and a sticker-like silhouette so the
 * interface reads as one family. To swap in painted art later, replace a
 * component's body with an <img> — call sites only depend on the props.
 */
import type { CSSProperties, ReactElement } from 'react';
import { ALIEN_SKIN, SPACE_INFO, type SpaceKind } from './config';

export const INK = '#1b2440';
type ArtProps = { size?: number; className?: string; style?: CSSProperties };
const box = (size: number, className = '', style?: CSSProperties) => ({
  width: size,
  height: size,
  className: 'art ' + className,
  style,
  'aria-hidden': true as const,
  focusable: 'false' as const,
});
const stroke = {
  stroke: INK,
  strokeWidth: 2.5,
  strokeLinejoin: 'round' as const,
  strokeLinecap: 'round' as const,
};

// ── Currency ────────────────────────────────────────────────────────────────
export function CoinIcon({ size = 20, className, style }: ArtProps) {
  return (
    <svg viewBox="0 0 32 32" {...box(size, className, style)}>
      <circle cx="16" cy="17" r="13" fill="#c97a06" {...stroke} />
      <circle cx="16" cy="15" r="13" fill="#ffcf3d" {...stroke} />
      <circle cx="16" cy="15" r="8.5" fill="none" stroke="#e59b12" strokeWidth="2" />
      <path
        d="M16 9.5l1.7 3.5 3.8.5-2.8 2.6.7 3.8L16 18l-3.4 1.9.7-3.8-2.8-2.6 3.8-.5z"
        fill="#fff3b0"
      />
      <path d="M8.5 10a9 9 0 0 1 5-4" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" opacity=".85" />
    </svg>
  );
}
export function DiamondIcon({ size = 20, className, style }: ArtProps) {
  return (
    <svg viewBox="0 0 32 32" {...box(size, className, style)}>
      <path d="M9 5h14l6.5 8L16 28.5 2.5 13z" fill="#5fe3ff" {...stroke} />
      <path
        d="M2.5 13h27M9 5l4 8 3 15.5M23 5l-4 8-3 15.5M13 13l3-8 3 8"
        fill="none"
        stroke="#1f8fc0"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M10 7h4.5l-2.8 5H5.5z" fill="#fff" opacity=".85" />
      <circle cx="25" cy="7" r="1.6" fill="#fff" />
    </svg>
  );
}
export function DiceIcon({ size = 24, value = 5, className, style }: ArtProps & { value?: number }) {
  const pips: Record<number, [number, number][]> = {
    1: [[16, 16]],
    2: [[11, 11], [21, 21]],
    3: [[10, 10], [16, 16], [22, 22]],
    4: [[11, 11], [21, 11], [11, 21], [21, 21]],
    5: [[10, 10], [22, 10], [16, 16], [10, 22], [22, 22]],
    6: [[11, 9], [21, 9], [11, 16], [21, 16], [11, 23], [21, 23]],
  };
  return (
    <svg viewBox="0 0 32 32" {...box(size, className, style)}>
      <rect x="3" y="5" width="26" height="25" rx="7" fill="#2a6fd8" {...stroke} />
      <rect x="3" y="3" width="26" height="25" rx="7" fill="#e9fbff" {...stroke} />
      {(pips[value] ?? pips[5]).map(([x, y], i) => (
        <circle key={i} cx={x} cy={y - 0.5} r="2.6" fill={INK} />
      ))}
    </svg>
  );
}

/**
 * A real 3D dice block built from six CSS faces (styled in ui-board-hud.css as
 * `.die3d`). It idles with a slow tumble and bob, so the roll prompt feels like
 * an object you can hit rather than a form button.
 */
const CUBE_PIPS: Record<number, number[]> = {
  1: [5],
  2: [3, 7],
  3: [3, 5, 7],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};
export function DiceCube({ size = 64, className, style }: ArtProps) {
  return (
    <span
      className={'die3d ' + (className ?? '')}
      style={{ '--die': size + 'px', ...style } as CSSProperties}
      aria-hidden="true"
    >
      <span className="die3d-body">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <span key={n} className={`die3d-side die3d-s${n}`}>
            {CUBE_PIPS[n].map((c) => (
              <i
                key={c}
                style={{ gridRow: Math.ceil(c / 3), gridColumn: ((c - 1) % 3) + 1 }}
              />
            ))}
          </span>
        ))}
      </span>
      <span className="die3d-shadow" />
    </span>
  );
}

// ── Characters ──────────────────────────────────────────────────────────────
/** Round portrait of a crew alien in their shirt color. */
export function AlienPortrait({
  shirt,
  size = 44,
  mood = 'happy',
  className,
  style,
}: ArtProps & { shirt: string; mood?: 'happy' | 'sad' | 'neutral' }) {
  const id = 'ap' + shirt.replace('#', '');
  return (
    <svg viewBox="0 0 64 64" {...box(size, className, style)}>
      <defs>
        <clipPath id={id}>
          <circle cx="32" cy="32" r="29" />
        </clipPath>
        <radialGradient id={id + 'g'} cx="0.5" cy="0.25" r="0.8">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#cfeaff" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="29" fill={`url(#${id}g)`} />
      <g clipPath={`url(#${id})`}>
        <path d="M8 66c2-13 11-19 24-19s22 6 24 19z" fill={shirt} {...stroke} />
        <path d="M24 47l8 7 8-7" fill="none" stroke="#ffffff" strokeWidth="2.5" opacity=".7" />
        <path d="M32 6.5c-11.5 0-19 8.5-19 19 0 11 8.5 22.5 19 22.5s19-11.5 19-22.5c0-10.5-7.5-19-19-19z" fill={ALIEN_SKIN} {...stroke} />
        <path d="M18 18c2-6 7-9 12-9" fill="none" stroke="#c6f5ad" strokeWidth="3" strokeLinecap="round" />
        <path d="M17.5 25.5c2.5-5 10-5.5 11.5 0.5 1 4.5-3 8-7 7.5-4.5-.5-6.5-4-4.5-8z" fill={INK} />
        <path d="M46.5 25.5c-2.5-5-10-5.5-11.5 0.5-1 4.5 3 8 7 7.5 4.5-.5 6.5-4 4.5-8z" fill={INK} />
        <circle cx="21.5" cy="26" r="1.9" fill="#fff" />
        <circle cx="39" cy="26" r="1.9" fill="#fff" />
        {mood === 'happy' ? (
          <path d="M27 38.5q5 4.5 10 0" fill="none" {...stroke} strokeWidth="2.2" />
        ) : mood === 'sad' ? (
          <path d="M27.5 41q4.5-3.5 9 0" fill="none" {...stroke} strokeWidth="2.2" />
        ) : (
          <path d="M28 39.5h8" fill="none" {...stroke} strokeWidth="2.2" />
        )}
        <ellipse cx="19" cy="36" rx="3" ry="1.8" fill="#ff9fb0" opacity=".55" />
        <ellipse cx="45" cy="36" rx="3" ry="1.8" fill="#ff9fb0" opacity=".55" />
      </g>
      <circle cx="32" cy="32" r="29" fill="none" stroke={INK} strokeWidth="3" />
    </svg>
  );
}
/** Nabbit, the sticky-fingered space raccoon who runs the steal stop. */
export function NabbitPortrait({ size = 96, className, style }: ArtProps) {
  return (
    <svg viewBox="0 0 96 96" {...box(size, className, style)}>
      <path d="M48 4v10" {...stroke} />
      <path d="M48 1.5l2 4 4.4.6-3.2 3 .8 4.4L48 11.4l-4 2.1.8-4.4-3.2-3 4.4-.6z" fill="#ffd23f" {...stroke} strokeWidth="2" />
      <circle cx="21" cy="26" r="11" fill="#8f82b3" {...stroke} />
      <circle cx="75" cy="26" r="11" fill="#8f82b3" {...stroke} />
      <circle cx="21" cy="26" r="5.5" fill="#f2a3c7" />
      <circle cx="75" cy="26" r="5.5" fill="#f2a3c7" />
      <path d="M48 14c-22 0-34 14-34 31 0 19 15 31 34 31s34-12 34-31c0-17-12-31-34-31z" fill="#b6abd6" {...stroke} />
      <path d="M48 52c-13 0-21 6-21 13 0 7 9 11 21 11s21-4 21-11c0-7-8-13-21-13z" fill="#efeaff" />
      <path d="M13 40c8-6 19-7 27-2 4 2 12 2 16 0 8-5 19-4 27 2-3 9-12 12-20 9-5-2-9-3-15-3s-10 1-15 3c-8 3-17 0-20-9z" fill="#3a2f55" {...stroke} />
      <ellipse cx="33" cy="41" rx="6" ry="6.5" fill="#fff" />
      <ellipse cx="63" cy="41" rx="6" ry="6.5" fill="#fff" />
      <circle cx="35" cy="42" r="3.4" fill={INK} />
      <circle cx="61" cy="42" r="3.4" fill={INK} />
      <circle cx="36.2" cy="40.6" r="1.2" fill="#fff" />
      <circle cx="62.2" cy="40.6" r="1.2" fill="#fff" />
      <path d="M43 54c0-3 10-3 10 0 0 2.5-3 4.5-5 4.5s-5-2-5-4.5z" fill={INK} />
      <path d="M36 62q12 9 24 0" fill="#fff" {...stroke} strokeWidth="2.2" />
      <path d="M45 63.4v3.4M51 63.4v3.4" stroke={INK} strokeWidth="1.6" />
      <path d="M70 70c6-3 15-1 17 6 2 8-4 14-12 14s-13-5-12-11c0-4 3-7 7-9z" fill="#c9965c" {...stroke} />
      <path d="M69 71c3 2 10 2 12-2" fill="none" {...stroke} strokeWidth="2" />
      <path d="M76 81.5h4M78 78.5v6" stroke="#ffe08a" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
/** Captain Klaxon, the grumpy space pirate behind the villain spaces. */
export function KlaxonPortrait({ size = 96, className, style }: ArtProps) {
  return (
    <svg viewBox="0 0 96 96" {...box(size, className, style)}>
      <path d="M48 30c-20 0-30 13-30 29 0 18 14 32 30 32s30-14 30-32c0-16-10-29-30-29z" fill="#d9577f" {...stroke} />
      <path d="M26 46c2-5 7-8 12-8" fill="none" stroke="#f38fac" strokeWidth="3" strokeLinecap="round" />
      <path d="M8 34c10-22 70-22 80 0-8 5-20 7-40 7S16 39 8 34z" fill="#3b2156" {...stroke} />
      <path d="M22 26c4-14 48-14 52 0" fill="#4a2a6b" {...stroke} />
      <path d="M10 33.5c12 4 64 4 76 0" fill="none" stroke="#ffcf3d" strokeWidth="2.6" />
      <ellipse cx="48" cy="22" rx="8" ry="3" fill="#e8e3f5" {...stroke} strokeWidth="1.8" />
      <path d="M44 20.5c0-3 8-3 8 0" fill="#9de9ff" {...stroke} strokeWidth="1.6" />
      <path d="M39 27l18-3M39 24l18 3" stroke="#e8e3f5" strokeWidth="2" strokeLinecap="round" />
      <path d="M26 50l14 2" {...stroke} strokeWidth="3.4" />
      <path d="M56 52l14-3" {...stroke} strokeWidth="3.4" />
      <path d="M58 57c0-4 9-4 10 0 1 5-2 8-5 8s-5-3-5-8z" fill="#ffe14f" {...stroke} strokeWidth="2" />
      <path d="M63 57.5v6" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M25 55c3-2 13-2 16 0 1 5-2 10-8 10s-9-5-8-10z" fill={INK} />
      <path d="M22 50l-6-5M44 54l14-12" stroke={INK} strokeWidth="2.2" />
      <path d="M34 75c4-4 24-4 28 0" fill="none" {...stroke} strokeWidth="2.6" />
      <path d="M33 72c5 7 25 7 30 0-4 3-26 3-30 0z" fill="#fff" {...stroke} strokeWidth="2" />
      <path d="M44 74.5v4" stroke={INK} strokeWidth="1.6" />
      <rect x="49" y="74" width="4" height="4.6" rx="1" fill="#ffcf3d" />
      <path d="M30 70c4 1 7-1 9-3 3 2 6 2 9 0 3 2 6 2 9 0 2 2 5 4 9 3-3 3-8 3-11 1-2 2-5 2-7 1-2 1-5 1-7-1-3 2-8 2-11-1z" fill="#3b2156" {...stroke} strokeWidth="1.8" />
    </svg>
  );
}

// ── Space and item icons ────────────────────────────────────────────────────
export const SPACE_GLYPH: Partial<Record<SpaceKind, ReactElement>> = {
  blue: <path d="M16 9v14M9 16h14" stroke="#fff" strokeWidth="4" strokeLinecap="round" />,
  red: <path d="M9 16h14" stroke="#fff" strokeWidth="4" strokeLinecap="round" />,
  start: <path d="M22 12a8 8 0 1 0 1 7M22 7v5h-5" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />,
  lucky: <path d="M16 7l2.6 5.6 6 .7-4.4 4.1 1.2 6L16 20.4l-5.4 3 1.2-6-4.4-4.1 6-.7z" fill="#fff" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />,
  event: <path d="M16 6l2.4 6.2 6.4-2-3.6 5.8 5.6 3.6-6.6.8.4 6.6L16 22l-4.6 5 .4-6.6-6.6-.8 5.6-3.6-3.6-5.8 6.4 2z" fill="#fff" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />,
  shop: (
    <g fill="#fff" stroke={INK} strokeWidth="1.8" strokeLinejoin="round">
      <path d="M9 13h14l-1.5 11h-11z" />
      <path d="M12.5 13a3.5 3.5 0 0 1 7 0" fill="none" />
    </g>
  ),
  lottery: (
    <g stroke={INK} strokeWidth="1.8" strokeLinejoin="round">
      <path d="M7 11h18v3a2 2 0 0 0 0 4v3H7v-3a2 2 0 0 0 0-4z" fill="#fff" />
      <path d="M13 11v10" strokeDasharray="1.6 1.6" />
    </g>
  ),
  bank: (
    <g stroke={INK} strokeWidth="1.8">
      <ellipse cx="16" cy="21" rx="7" ry="2.6" fill="#ffcf3d" />
      <ellipse cx="16" cy="17" rx="7" ry="2.6" fill="#ffcf3d" />
      <ellipse cx="16" cy="13" rx="7" ry="2.6" fill="#ffe27a" />
    </g>
  ),
  hazard: (
    <g strokeLinejoin="round">
      <path d="M16 7l9 16H7z" fill="#fff" stroke={INK} strokeWidth="1.8" />
      <path d="M16 12.5v5" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="16" cy="20.3" r="1.3" fill={INK} />
    </g>
  ),
  spring: <path d="M16 7l7 9-7 9-7-9z" fill="#fff" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />,
  portal: <path d="M16 16m-2 0a2 2 0 1 1 4 0 4 4 0 1 1-8 0 6 6 0 1 1 12 0 8 8 0 1 1-16 0" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />,
  thief: (
    <g>
      <circle cx="16" cy="17" r="8" fill="#b6abd6" stroke={INK} strokeWidth="1.8" />
      <path d="M8.5 15.5c3-2.5 6-2.5 7.5-1 1.5-1.5 4.5-1.5 7.5 1-1 3-4 3.5-7.5 2-3.5 1.5-6.5 1-7.5-2z" fill="#3a2f55" />
      <circle cx="12.6" cy="15.6" r="1.4" fill="#fff" />
      <circle cx="19.4" cy="15.6" r="1.4" fill="#fff" />
    </g>
  ),
  villain: (
    <g>
      <path d="M16 7c-5.5 0-8.5 3.5-8.5 8 0 3 1.6 5 3.5 6v3.5h10V21c1.9-1 3.5-3 3.5-6 0-4.5-3-8-8.5-8z" fill="#fff" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="12.8" cy="15.5" r="2" fill={INK} />
      <circle cx="19.2" cy="15.5" r="2" fill={INK} />
      <path d="M14 24.5v-2.5M18 24.5v-2.5" stroke={INK} strokeWidth="1.4" />
    </g>
  ),
  switch: <path d="M9 12h13l-3-3M23 20H10l3 3" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />,
};
export function SpaceIcon({ kind, size = 22, className, style }: ArtProps & { kind: SpaceKind }) {
  const info = SPACE_INFO[kind];
  return (
    <svg viewBox="0 0 32 32" {...box(size, className, style)}>
      <ellipse cx="16" cy="18" rx="14" ry="12.5" fill={INK} opacity=".9" />
      <circle cx="16" cy="16" r="13.5" fill={info?.color ?? '#ccc'} {...stroke} />
      {SPACE_GLYPH[kind]}
    </svg>
  );
}

const ITEM_ART: Record<string, ReactElement> = {
  boost: (
    <g {...stroke}>
      <path d="M6 30l14-12M8 22l9-6M14 34l10-12" stroke="#ffb347" strokeWidth="3" />
      <circle cx="26" cy="14" r="8" fill="#ffd23f" />
      <path d="M22.5 11.5a4 4 0 0 1 3.5-2" fill="none" stroke="#fff" strokeWidth="2" />
    </g>
  ),
  double: (
    <g {...stroke}>
      <rect x="4" y="12" width="17" height="17" rx="4.5" fill="#e9fbff" transform="rotate(-10 12 20)" />
      <rect x="18" y="8" width="17" height="17" rx="4.5" fill="#bfe9ff" transform="rotate(12 26 16)" />
      <circle cx="10" cy="18" r="1.8" fill={INK} stroke="none" />
      <circle cx="14.5" cy="23" r="1.8" fill={INK} stroke="none" />
      <circle cx="26" cy="16.5" r="1.8" fill={INK} stroke="none" />
    </g>
  ),
  magnet: (
    <g {...stroke}>
      <path d="M8 8v12a12 12 0 0 0 24 0V8h-7v12a5 5 0 0 1-10 0V8z" fill="#ff5a5a" />
      <path d="M8 8h7v5H8zM25 8h7v5h-7z" fill="#dfe6f0" />
      <path d="M2 30l3-2M38 30l-3-2M20 38v-3" stroke="#ffd23f" strokeWidth="2.2" />
    </g>
  ),
  warp: (
    <g {...stroke}>
      <path d="M14 18l-7 18h26l-7-18z" fill="#bfffa8" opacity=".75" stroke="none" />
      <ellipse cx="20" cy="15" rx="15" ry="5" fill="#c9d6e6" />
      <path d="M12 13c0-6 16-6 16 0" fill="#9de9ff" />
      <circle cx="11" cy="16" r="1.3" fill="#ffd23f" stroke="none" />
      <circle cx="20" cy="17.5" r="1.3" fill="#ffd23f" stroke="none" />
      <circle cx="29" cy="16" r="1.3" fill="#ffd23f" stroke="none" />
    </g>
  ),
  steal: (
    <g {...stroke}>
      <path d="M3 16c6-6 11-5 14 1 3-6 11-8 19-3-6-1-11 2-13 8-2 5-7 5-9 1-2-4-5-7-11-7z" fill="#fff" />
      <path d="M23 21l7 2-7 2" fill="#ffb347" />
      <circle cx="21.5" cy="19" r="1.1" fill={INK} stroke="none" />
      <circle cx="12" cy="31" r="5" fill="#ffcf3d" />
    </g>
  ),
  shield: (
    <g {...stroke}>
      <path d="M20 4l14 5v9c0 9-6 15-14 18C12 33 6 27 6 18V9z" fill="#7cc8ff" />
      <path d="M20 9l9 3v6c0 6-4 10-9 12z" fill="#c9ecff" stroke="none" />
      <path d="M14 18l4 4 8-8" fill="none" strokeWidth="3" />
    </g>
  ),
  five: (
    <g {...stroke}>
      <circle cx="20" cy="20" r="15" fill="#7dffb2" />
      <text x="20" y="26.5" textAnchor="middle" fontSize="18" fontWeight="900" fill={INK} stroke="none" fontFamily="Fredoka Variable, Trebuchet MS, sans-serif">
        +5
      </text>
    </g>
  ),
  mini: (
    <g {...stroke}>
      <path d="M5 14h18l5-4v16l-5-4h-6l-2 9h-6l1-9H5z" fill="#c08bff" />
      <circle cx="10" cy="17.5" r="2" fill="#fff" />
      <path d="M33 13v12M29.5 21.5L33 25l3.5-3.5" fill="none" stroke="#7a3ff0" strokeWidth="2.6" />
    </g>
  ),
  mega: (
    <g {...stroke}>
      <path d="M5 14h18l5-4v16l-5-4h-6l-2 9h-6l1-9H5z" fill="#ff9b3d" />
      <circle cx="10" cy="17.5" r="2" fill="#fff" />
      <path d="M33 25V13M29.5 16.5L33 13l3.5 3.5" fill="none" stroke="#d1460b" strokeWidth="2.6" />
    </g>
  ),
};
export function ItemIcon({ id, size = 26, className, style }: ArtProps & { id: string }) {
  return (
    <svg viewBox="0 0 40 40" {...box(size, className, style)}>
      {ITEM_ART[id] ?? <circle cx="20" cy="20" r="12" fill="#ddd" {...stroke} />}
    </svg>
  );
}

// ── Decorations ─────────────────────────────────────────────────────────────
export function CrownIcon({ size = 28, className, style }: ArtProps) {
  return (
    <svg viewBox="0 0 40 32" {...box(size, className, style)}>
      <path d="M4 10l8 7 8-13 8 13 8-7-3 17H7z" fill="#ffd23f" {...stroke} />
      <path d="M7 27h26" {...stroke} />
      <circle cx="20" cy="18" r="2.6" fill="#ff5a8a" {...stroke} strokeWidth="1.6" />
    </svg>
  );
}
/** Placement medal: gold, silver, bronze, then a plain badge. */
export function PlaceBadge({ place, size = 30, className, style }: ArtProps & { place: number }) {
  const fill = ['#ffd23f', '#dfe6f0', '#e8a56b'][place - 1] ?? '#ffffff';
  return (
    <svg viewBox="0 0 32 32" {...box(size, className, style)}>
      <path d="M16 2.5l3.4 3 4.5-.6 1.3 4.3 4 2.2-1.6 4.3 1.6 4.3-4 2.2-1.3 4.3-4.5-.6-3.4 3-3.4-3-4.5.6-1.3-4.3-4-2.2 1.6-4.3-1.6-4.3 4-2.2 1.3-4.3 4.5.6z" fill={fill} {...stroke} strokeWidth="2" />
      <text x="16" y="21.5" textAnchor="middle" fontSize="13" fontWeight="900" fill={INK} fontFamily="Fredoka Variable, Trebuchet MS, sans-serif">
        {place}
      </text>
    </svg>
  );
}
export function Sparkle({ size = 16, color = '#ffd23f', className, style }: ArtProps & { color?: string }) {
  return (
    <svg viewBox="0 0 16 16" {...box(size, className, style)}>
      <path d="M8 0c.8 4.2 3.8 7.2 8 8-4.2.8-7.2 3.8-8 8-.8-4.2-3.8-7.2-8-8 4.2-.8 7.2-3.8 8-8z" fill={color} />
    </svg>
  );
}
