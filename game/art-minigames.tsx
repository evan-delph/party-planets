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

/**
 * The default cast (engine.ts BOT_LOOKS + config DEFAULT_AVATAR). Hero cut-outs are
 * rendered for these looks only (art/blender/minigame_cards.py `cast`), so a
 * customised avatar never gets a cut-out that doesn't look like them.
 */
const CAST: Record<string, { who: string; hair: number; acc: number }> = {
  '#12ad9a': { who: 'frankie', hair: 0, acc: 0 },
  '#f25265': { who: 'chorizo', hair: 7, acc: 5 },
  '#7549cb': { who: 'coco', hair: 6, acc: 2 },
  '#f4b62c': { who: 'bratley', hair: 5, acc: 1 },
};
type Look = { shirt: string; hair?: number; accessory?: number };
export function castKey(a: Look) {
  const c = CAST[a.shirt.toLowerCase()];
  return c && (a.hair ?? 0) === c.hair && (a.accessory ?? 0) === c.acc ? c.who : null;
}

/** Big rendered hero cut-out of a cast member: `leap` (solo star) or `cheer`. */
export function CastCutout({
  avatar,
  pose,
  className = '',
  style,
}: {
  avatar: Look;
  pose: 'leap' | 'cheer';
  className?: string;
  style?: CSSProperties;
}) {
  const [broken, setBroken] = useState(false);
  const who = castKey(avatar);
  if (!who || broken) return null;
  return (
    <img
      className={`mg-cast mg-cast-${pose} ${className}`}
      src={assetUrl(`/textures/minigames/cast-${who}-${pose}.webp`)}
      alt=""
      aria-hidden="true"
      draggable={false}
      decoding="async"
      style={style}
      onError={() => setBroken(true)}
    />
  );
}

/**
 * Full-screen stage behind the vote and results: a rendered party-planet sky
 * (vote-stage.webp) with drifting coins, stars and confetti at three depths.
 */
export function StageBackdrop() {
  let s = 77;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const kinds = ['coin', 'star', 'coin', 'gem', 'star', 'coin'] as const;
  return (
    <>
      <span
        className="pv-backdrop"
        aria-hidden="true"
        style={{ backgroundImage: `url(${assetUrl('/textures/minigames/vote-stage.webp')})` }}
      />
      <span className="pv-floaters" aria-hidden="true">
        {Array.from({ length: 14 }, (_, i) => {
          const depth = i % 3; // 0 far, 1 mid, 2 near (big, blurred)
          const left = i % 2 ? 2 + rnd() * 16 : 82 + rnd() * 16;
          return (
            <i
              key={i}
              className={`pv-float is-${kinds[i % kinds.length]} depth-${depth}`}
              style={
                {
                  left: `${left}%`,
                  top: `${6 + rnd() * 84}%`,
                  '--s': `${[18, 30, 58][depth] * (0.8 + rnd() * 0.5)}px`,
                  '--r': `${Math.round(rnd() * 80 - 40)}deg`,
                  '--d': `${(rnd() * -8).toFixed(1)}s`,
                  '--t': `${(7 + rnd() * 6).toFixed(1)}s`,
                } as CSSProperties
              }
            />
          );
        })}
      </span>
    </>
  );
}

/** What a minigame asks of you, from its category, for the card's icon badge. */
export type Mechanic = 'dodge' | 'race' | 'battle' | 'aim' | 'balance' | 'score';
export function mechanicOf(category: string): Mechanic {
  const c = category.toLowerCase();
  if (/balanc|wave|tower|stack/.test(c)) return 'balance';
  if (/race|ski|downhill|rally|dash|relay|rush|run/.test(c)) return 'race';
  if (/shoot|throw|hoop|gallery|target|aim|jump-shot|sluggers|bat/.test(c)) return 'aim';
  if (/battle|duel|bumper|brawl|tug|sumo|push/.test(c)) return 'battle';
  if (/surviv|chase|dodge|nerve|timing|migration|escape/.test(c)) return 'dodge';
  return 'score';
}
const MECH_PATHS: Record<Mechanic, ReactNode> = {
  dodge: <path d="M13.5 2 4 13.5h6.2L8.8 22 20 9.6h-6.6L13.5 2Z" />,
  race: (
    <>
      <path d="M5 3v19" strokeLinecap="round" />
      <path d="M5 4h14l-2.6 4.5L19 13H5Z" />
      <path d="M9.5 4v9M14 4v9M5 8.5h13" opacity=".55" />
    </>
  ),
  battle: (
    <path d="m12 1.8 2.3 5.4 5.6-2-2 5.6 5.4 2.3-5.4 2.3 2 5.6-5.6-2L12 24l-2.3-5.4-5.6 2 2-5.6L.8 12.8l5.4-2.3-2-5.6 5.6 2Z" />
  ),
  aim: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <circle cx="12" cy="12" r="5.2" />
      <circle cx="12" cy="12" r="1.6" />
    </>
  ),
  balance: <path d="M2 15c2.5-3 5-3 7.5 0s5 3 7.5 0 3.8-2.6 5-1.6M2 9.5c2.5-3 5-3 7.5 0s5 3 7.5 0 3.8-2.6 5-1.6" fill="none" strokeLinecap="round" />,
  score: <path d="m12 2 2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 16.8l-5.9 3.3 1.3-6.6L2.5 8.9l6.6-.8Z" />,
};
export function MechanicIcon({ kind, size = 18 }: { kind: Mechanic; size?: number }) {
  return (
    <svg className={`mg-mech mg-mech-${kind}`} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      {MECH_PATHS[kind]}
    </svg>
  );
}

/** Die-cut silhouette across the top of a card, themed to the game's world. */
type Crest = 'lava' | 'wave' | 'ice' | 'leaf' | 'star';
const CRESTS: Record<string, Crest> = {
  tidetiles: 'lava', bomb: 'lava', rope: 'lava', mangosluggers: 'lava',
  boulderbuffet: 'wave', race: 'wave', bubbletrouble: 'wave', mangrovemotors: 'wave',
  pelicanpilots: 'wave', coconut: 'wave', crabtraffic: 'wave', skewergallery: 'wave',
  cannoncay: 'ice', prickleice: 'ice', frostyfreight: 'ice', skate: 'ice',
  vinevault: 'leaf', canopy: 'leaf', geckograffiti: 'leaf', paint: 'leaf', dig: 'leaf',
};
export function crestOf(id: string): Crest {
  return CRESTS[id] ?? 'star';
}
export function CardCrest({ id }: { id: string }) {
  const kind = crestOf(id);
  const ink = { stroke: '#1a1240', strokeWidth: 3, strokeLinejoin: 'round' as const };
  return (
    <svg className={`pv-crest crest-${kind}`} viewBox="0 0 300 48" preserveAspectRatio="none" aria-hidden="true">
      {kind === 'lava' && (
        <>
          <path d="M84 34 96 18l12 7 14-17 13 13 15-15 15 15 13-11 13 16 11-6 10 14Z" fill="#3a1e1a" {...ink} />
          <path d="M122 14l5 10-4 6M150 8l-3 12 7 8M178 16l-4 10" fill="none" stroke="#ffb21a" strokeWidth="3" strokeLinecap="round" />
          <path d="M108 30q5 0 5 7t-5 8q-5 0-5-8t5-7ZM190 30q4 0 4 5t-4 7q-4 0-4-7t4-5Z" fill="#ff7a1a" {...ink} strokeWidth={2.5} />
          <circle cx="150" cy="40" r="3" fill="#ffd23f" />
        </>
      )}
      {kind === 'wave' && (
        <>
          <path
            d="M78 36c8-16 30-26 52-22 16 3 22 16 12 22-7 4-14-2-10-7-12-2-26 2-38 8ZM222 36c-8-16-30-26-52-22-16 3-22 16-12 22 7 4 14-2 10-7 12-2 26 2 38 8Z"
            fill="#5fd4ff"
            {...ink}
          />
          <path d="M112 15c8-5 20-4 24 2M188 15c-8-5-20-4-24 2" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
          <circle cx="150" cy="10" r="5" fill="#fff" {...ink} strokeWidth={2.5} />
          <circle cx="140" cy="4" r="3" fill="#fff" {...ink} strokeWidth={2} />
          <circle cx="161" cy="5" r="2.5" fill="#fff" {...ink} strokeWidth={2} />
        </>
      )}
      {kind === 'ice' && (
        <>
          <path d="M100 32l5 13 5-13M126 32l4 9 4-9M166 32l4 11 4-11M192 32l4 8 4-8" fill="#bfe8ff" {...ink} strokeWidth={2.5} />
          <path
            d="M82 34c2-12 18-17 30-10 6-14 28-18 38-6 10-12 32-10 38 4 12-4 26 2 30 12Z"
            fill="#f6fcff"
            {...ink}
          />
          <path d="M120 22c6-4 14-4 18 0M164 20c6-3 12-2 16 2" fill="none" stroke="#bfe8ff" strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {kind === 'leaf' && (
        <>
          <path d="M150 34C130 34 104 26 92 10c22-4 46 6 58 24Z" fill="#3fcf6a" {...ink} />
          <path d="M150 34c20 0 46-8 58-24-22-4-46 6-58 24Z" fill="#2fb85a" {...ink} />
          <path d="M104 14c14 2 30 10 42 18M196 14c-14 2-30 10-42 18" fill="none" stroke="#1a1240" strokeWidth="1.5" opacity=".5" />
          <circle cx="150" cy="24" r="10" fill="#ff6ac8" {...ink} />
          <circle cx="150" cy="24" r="4" fill="#ffd23f" />
        </>
      )}
      {kind === 'star' && (
        <>
          <path d="m150 2 7 14 15 2-11 10 3 15-14-7-14 7 3-15-11-10 15-2Z" fill="#ffd23f" {...ink} />
          <path d="m108 22 4 8 9 1-6 6 1 9-8-4-8 4 1-9-6-6 9-1Z m192 22 4 8 9 1-6 6 1 9-8-4-8 4 1-9-6-6 9-1Z" fill="#ffffff" {...ink} strokeWidth={2.5} />
        </>
      )}
    </svg>
  );
}

/** First sentence of a brief: one punchy line for the vote card. */
export function punchy(brief: string) {
  const m = brief.match(/^.*?[.!?](?=\s|$)/);
  const first = (m ? m[0] : brief).trim();
  // Keep only the lead clause of a long sentence ("..., while ...").
  const clause = first.split(/[,;:]\s|\s(?:while|but|so)\s|\s[–—-]\s/)[0].trim();
  return clause === first ? first : clause.replace(/[.!?]?$/, '.');
}

/** Glove pointer that bobs over the card under the cursor. */
export function PointerGlove() {
  return (
    <svg className="pv-pointer" viewBox="0 0 64 64" aria-hidden="true">
      <path
        d="M24 6c3.3 0 6 2.7 6 6v15l2.2-.6c3-.8 6 1 6.6 3.9 3-1.2 6.3.6 6.9 3.7 3-.9 6.1 1.2 6.3 4.3l.4 7c.5 8.8-6.5 16.2-15.3 16.2H33c-5.2 0-10-2.8-12.6-7.3L13 41.4c-1.6-2.8-.6-6.3 2.2-7.8 2.5-1.4 5.6-.7 7.2 1.6l-4.4-2.4V12c0-3.3 2.7-6 6-6Z"
        fill="#ffffff"
        stroke="#1a1240"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <path d="M32 27v9M39 30v7M46 34v5" stroke="#1a1240" strokeWidth="2.5" strokeLinecap="round" opacity=".45" />
      <path d="M22 54h24" stroke="#7affea" strokeWidth="5" strokeLinecap="round" />
    </svg>
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
