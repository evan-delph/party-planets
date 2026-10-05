/**
 * Minigame key art for the vote and results screens.
 *
 * Each minigame has a rendered preview (art/blender/minigame_cards.py →
 * public/textures/minigames/<id>.webp) and a three-stop colour theme that
 * drives its card: light highlight, main colour and a deep shade for outlines
 * and plates. If a render is missing, the card falls back to a themed
 * gradient so it never shows a broken image.
 */
import { useState, type CSSProperties, type ReactNode } from 'react';
import { assetUrl } from './assets';
import type { MiniMode } from './arcade/catalog';

type Theme = [light: string, main: string, deep: string];
const THEMES: Record<string, Theme> = {
  canopy: ['#ffe39a', '#ff9f43', '#7a3d0c'],
  bumper: ['#ffc2d4', '#ff4f7b', '#7f1a40'],
  rope: ['#ffd27a', '#ff5e3a', '#6e1a10'],
  coconut: ['#c8f58a', '#2fb36d', '#0e4f34'],
  race: ['#a8f6ff', '#1aa8e8', '#0b3f7a'],
  duos: ['#ddc8ff', '#7a4ef0', '#2a1764'],
  sky: ['#d4f5ff', '#45adff', '#1a4fae'],
  bomb: ['#ffb08f', '#e8403a', '#430d18'],
  paint: ['#e3ff9a', '#6fcc3c', '#24591a'],
  dig: ['#ffe7b8', '#f0a050', '#6e3f14'],
  skate: ['#c4f8ff', '#7d8cff', '#25236e'],
  factory: ['#ffd6f2', '#b07cff', '#3a1d70'],
  tidetiles: ['#ffd25e', '#ff6a1f', '#6e1206'],
  cannoncay: ['#effcff', '#62c4ff', '#174f99'],
  prickleice: ['#eef7ff', '#7aa8ff', '#233f8e'],
  crabtraffic: ['#ffe0b0', '#ff5d4d', '#6e1a1a'],
  crumbleclock: ['#ffe77a', '#ff6ac8', '#33176e'],
  lanternlurk: ['#fff4b0', '#5a66ff', '#12143a'],
  vinevault: ['#d6ff8a', '#33bf66', '#0d4734'],
  mangrovemotors: ['#ffd76a', '#14b8ab', '#0a4560'],
  bubbletrouble: ['#9ffff2', '#159fd6', '#0a336e'],
  frostyfreight: ['#ffffff', '#6fa8ff', '#233682'],
  pelicanpilots: ['#ffe68a', '#ff7655', '#1b5fae'],
  hotelhiccup: ['#fff1c8', '#ff8fa8', '#6e2a52'],
  picklepatrol: ['#d4ff7a', '#ff4fa0', '#341a66'],
  mangosluggers: ['#ffe866', '#ff951f', '#7a3208'],
  geckograffiti: ['#ffe68f', '#2fb877', '#163f33'],
  skewergallery: ['#fff38a', '#2aa8ff', '#0e2a66'],
  boulderbuffet: ['#b8fff6', '#16bcd4', '#07476e'],
  returnsender: ['#ffdcae', '#ff843a', '#552610'],
};
const FALLBACK: Theme = ['#fff1a8', '#ffb02e', '#6e3a08'];

export function minigameTheme(id: string): Theme {
  return THEMES[id] ?? FALLBACK;
}
/** CSS custom properties for a themed card (--mg-light, --mg-main, --mg-deep). */
export function themeStyle(id: string, extra?: CSSProperties): CSSProperties {
  const [light, main, deep] = minigameTheme(id);
  return {
    '--mg-light': light,
    '--mg-main': main,
    '--mg-deep': deep,
    ...extra,
  } as CSSProperties;
}
export function minigameArtUrl(id: string) {
  return assetUrl(`/textures/minigames/${id}.webp`);
}

/** Rendered preview with a themed gradient fallback and a light sweep layer. */
export function MinigameArt({
  id,
  className = '',
  children,
}: {
  id: string;
  className?: string;
  children?: ReactNode;
}) {
  const [broken, setBroken] = useState(false);
  return (
    <span className={'mg-art ' + className} aria-hidden="true">
      {!broken && (
        <img
          src={minigameArtUrl(id)}
          alt=""
          draggable={false}
          decoding="async"
          onError={() => setBroken(true)}
        />
      )}
      <span className="mg-art-shine" />
      {children}
    </span>
  );
}

/** Rendered crew alien cut-out (transparent) that cheers from a screen corner. */
export function CrewCutout({ side }: { side: 'left' | 'right' }) {
  const [broken, setBroken] = useState(false);
  if (broken) return null;
  return (
    <img
      className={`mg-crew mg-crew-${side}`}
      src={assetUrl(`/textures/minigames/crew-${side}.webp`)}
      alt=""
      aria-hidden="true"
      draggable={false}
      decoding="async"
      onError={() => setBroken(true)}
    />
  );
}

export const MODE_SHORT: Record<MiniMode, string> = {
  ffa: 'FFA',
  '1v3': '1 VS 3',
  '2v2': '2 VS 2',
};
export const MODE_TITLE: Record<MiniMode, string> = {
  ffa: 'Free-for-all',
  '1v3': 'Solo showdown',
  '2v2': 'Team battle',
};

/** Split "WASD: move · Space: hop" into key caps and what they do (max 3). */
export function controlChips(controls: string) {
  return controls
    .split(/\s*[·•|]\s*/)
    .map((part) => {
      const at = part.indexOf(':');
      const keys = (at < 0 ? part : part.slice(0, at)).trim();
      const label = (at < 0 ? '' : part.slice(at + 1)).trim();
      return {
        keys: keys
          .replace(/\s*\/\s*arrows?/i, '')
          .replace(/^Hold\s+/i, '')
          .replace(/^Arrows$/i, '↑↓←→')
          .toUpperCase(),
        label: label.replace(/\s*\(.*\)$/, '').split(/[,&]/)[0].trim(),
      };
    })
    .filter((c) => c.keys && c.keys.length <= 12)
    .slice(0, 3);
}

/** Circular countdown dial: the ring drains as `left` approaches zero. */
export function TimerRing({
  left,
  total,
  done,
  children,
}: {
  left: number;
  total: number;
  done?: boolean;
  children?: ReactNode;
}) {
  const r = 40,
    c = 2 * Math.PI * r,
    frac = done ? 1 : Math.max(0, Math.min(1, left / total));
  const urgent = !done && left <= 5;
  return (
    <span
      className={'mg-timer' + (urgent ? ' is-urgent' : '') + (done ? ' is-done' : '')}
      role="timer"
      aria-label={done ? 'Voting closed' : `${Math.ceil(left)} seconds left`}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="47" className="mg-timer-plate" />
        {Array.from({ length: 20 }, (_, i) => (
          <line
            key={i}
            x1="50"
            y1="6"
            x2="50"
            y2={i % 5 ? 10 : 13}
            transform={`rotate(${i * 18} 50 50)`}
            className="mg-timer-tick"
          />
        ))}
        <circle cx="50" cy="50" r={r} className="mg-timer-track" />
        <circle
          cx="50"
          cy="50"
          r={r}
          className="mg-timer-fill"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <b key={done ? 'done' : Math.ceil(left)}>{children}</b>
    </span>
  );
}

/** Deterministic confetti pieces for celebration bursts. */
export function Confetti({ count = 28, seed = 1 }: { count?: number; seed?: number }) {
  const colors = ['#ffd23f', '#ff5a7a', '#3fd0ff', '#7dff8a', '#b78cff', '#ffffff'];
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  return (
    <span className="mg-confetti" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        const angle = rnd() * Math.PI * 2,
          dist = 90 + rnd() * 160;
        return (
          <i
            key={i}
            style={
              {
                '--x': `${Math.cos(angle) * dist}px`,
                '--y': `${Math.sin(angle) * dist * 0.7 - 40}px`,
                '--r': `${Math.round(rnd() * 720 - 360)}deg`,
                '--d': `${(rnd() * 0.25).toFixed(2)}s`,
                background: colors[i % colors.length],
                width: 6 + Math.round(rnd() * 6),
                height: 10 + Math.round(rnd() * 8),
              } as CSSProperties
            }
          />
        );
      })}
    </span>
  );
}
