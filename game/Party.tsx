'use client';
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  ArrowRight,
  Check,
  ChevronRight,
  CircleHelp,
  Copy,
  Crown,
  Dices,
  Flag,
  Gem,
  Globe,
  Home,
  Palmtree,
  Play,
  RotateCcw,
  Settings,
  Shuffle,
  Sparkles,
  UserRound,
  Coins,
  Users,
  Volume2,
  VolumeX,
  Waves,
  X,
  Zap,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useGamepadUI } from './useGamepadUI';
import Lottery from './Lottery';
import {
  AlienPortrait,
  CoinIcon,
  CrownIcon,
  DiamondIcon,
  DiceCube,
  DiceIcon,
  GimmickIcon,
  ItemIcon,
  KlaxonPortrait,
  NabbitPortrait,
  PlaceBadge,
  SpaceIcon,
  Sparkle,
} from './art';
import { FinaleStandings, championOf } from './Finale';
import {
  CardCrest,
  CastCutout,
  Confetti,
  MechanicIcon,
  MinigameArt,
  MODE_SHORT,
  MODE_TITLE,
  PointerGlove,
  StageBackdrop,
  TimerRing,
  controlChips,
  mechanicOf,
  punchy,
  themeStyle,
} from './art-minigames';
import { BOARDS, PLANETS, getBoard, getPlanet } from './boards';
import { PartyLogo, PLANET_TINT } from './PartyLogo';
import { buildShot, shotScene } from './shot';
import { playSfx, setSfxMuted } from './audio';
import { useMusic } from './useMusic';
import type { Control } from './arcade/simulation';
import {
  scoreLabel,
  arcadeInfo,
  AVAILABLE_ARCADE,
  DEFAULT_MINIGAME_POOL,
  MODE_LABEL,
  normalizeMinigamePool,
} from './arcade/catalog';
import {
  Avatar,
  ALIEN_SKIN,
  DEFAULT_AVATAR,
  EMOTES,
  ITEMS,
  MINIGAMES,
  NABBER,
  OUTFITS,
  RULES,
  SPACE_INFO,
  VILLAIN,
} from './config';
import {
  Action,
  Game,
  arenaPlayers,
  lastTurnsCount,
  newGame,
  prepareMinigame,
  reduceGame,
  routeChoices,
  validateAvatar,
  migrateGame,
} from './engine';

const Scene = dynamic(() => import('./Scene'), {
  ssr: false,
  loading: () => <div className="scene" aria-hidden="true" />,
});
const ArcadeGame = dynamic(() => import('./arcade/ArcadeGame'), {
  ssr: false,
  loading: () => (
    <section className="arcade-full boot" aria-live="polite">
      <h1>Loading arena…</h1>
    </section>
  ),
});

type Room = {
  boardId?: string;
  serverTime: number;
  difficulty: number;
  diamondGoal: number;
  minigamePool?: string[];
  host: string;
  seats: { id: string; avatar: Avatar; away?: boolean }[];
  game: Game | null;
  rounds: number;
  revision: number;
  /** Presence/emote counter that changes without advancing `revision`. */
  pulse?: number;
  emotes?: { id: number; seat: string; emoji: string; at: number }[];
};
type Session = { code: string; id: string; token: string };
/** The last online room on this device, so a closed tab can rejoin. */
const LAST_ROOM = 'sp-room-last';
type RequestError = Error & { status?: number };
function Ufo({ className = '' }: { className?: string }) {
  return (
    <span className={'ufo-symbol ' + className} aria-hidden="true">
      🛸
    </span>
  );
}
type Panel =
  | 'setup'
  | 'menu'
  | 'creator'
  | 'online'
  | 'settings'
  | 'help'
  | 'arcade'
  | 'play'
  | 'boards';
function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <Select value={value} onValueChange={(v) => v && onChange(v)}>
        <SelectTrigger className="choice">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((v) => (
            <SelectItem key={v} value={v}>
              {v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
function ColorPicker({
  label,
  values,
  value,
  onChange,
}: {
  label: string;
  values: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="field">
      <span>{label}</span>
      <RadioGroup
        className="swatches"
        aria-label={label}
        value={value}
        onValueChange={(v) => onChange(String(v))}
      >
        {values.map((c, i) => (
          <RadioGroupItem
            key={c}
            value={c}
            aria-label={`${label} ${i + 1}`}
            className="swatch"
            style={{ background: c }}
          />
        ))}
      </RadioGroup>
    </div>
  );
}
const hair = [
    'Smooth',
    'Curls',
    'Quiff',
    'Bob',
    'Spikes',
    'Sun hat',
    'Ponytail',
    'Mohawk',
  ],
  eyes = ['Bright', 'Sleepy', 'Tiny', 'Bold brows'],
  mouths = ['Smile', 'Serious', 'Big grin'],
  accessories = [
    'None',
    'Sunglasses',
    'Flower',
    'Crown',
    'Pool float',
    'Earmuffs',
    'Backpack',
  ];
export default function Party({ offline = false }: { offline?: boolean } = {}) {
  const [started, setStarted] = useState(false);
  const [lastRoom, setLastRoom] = useState<Session | null>(null);
  const [invite, setInvite] = useState('');
  const [arcadeSearch, setArcadeSearch] = useState('');
  const [minigamePool, setMinigamePool] = useState<string[]>(
    DEFAULT_MINIGAME_POOL,
  );
  const [avatar, setAvatar] = useState<Avatar>(DEFAULT_AVATAR),
    [panel, setPanel] = useState<Panel>('menu'),
    [game, setGame] = useState<Game | null>(null),
    [saved, setSaved] = useState<Game | null>(null),
    [rounds, setRounds] = useState(10),
    [difficulty, setDifficulty] = useState(1),
    [diamondGoal, setDiamondGoal] = useState(3),
    [boardId, setBoardId] = useState('crown'),
    [orbital, setOrbital] = useState(true),
    [muted, setMuted] = useState(false),
    [musicVolume, setMusicVolume] = useState(0.65),
    [sunBrightness, setSunBrightness] = useState(0.55),
    [preferencesLoaded, setPreferencesLoaded] = useState(false),
    [travelTo, setTravelTo] = useState<string | undefined>(),
    [low, setLow] = useState(false),
    [reduced, setReduced] = useState(false),
    [view, setView] = useState(0),
    [notice, setNotice] = useState(''),
    [session, setSession] = useState<Session | null>(null),
    [room, setRoom] = useState<Room | null>(null),
    [code, setCode] = useState(''),
    [busy, setBusy] = useState(false),
    [clock, setClock] = useState(Date.now()),
    [copied, setCopied] = useState(false);
  const offsetRef = useRef(0);
  const onlineRef = useRef<Room | null>(null),
    audioRef = useRef<AudioContext | null>(null),
    gameRef = useRef(game);
  gameRef.current = game;
  const BOARD = getBoard(game?.boardId ?? boardId).spaces;
  useEffect(() => {
    setSfxMuted(muted);
  }, [muted]);
  useMusic(
    game?.phase === 'minigame' && panel === 'play'
      ? `mini:${arcadeInfo(game.mini).id}`
      : panel === 'play'
        ? `board:${game?.boardId ?? boardId}`
        : 'solar-menu',
    muted ? 0 : musicVolume,
    started,
  );
  useEffect(() => {
    try {
      const prefs = JSON.parse(localStorage.getItem('sp-audio-sun') ?? '{}');
      if (typeof prefs.music === 'number' && Number.isFinite(prefs.music))
        setMusicVolume(Math.max(0, Math.min(1, prefs.music)));
      if (typeof prefs.sun === 'number' && Number.isFinite(prefs.sun))
        setSunBrightness(Math.max(0, Math.min(1, prefs.sun)));
      if (typeof prefs.muted === 'boolean') setMuted(prefs.muted);
    } catch {}
    try {
      const stored = localStorage.getItem('sp-minigame-pool');
      if (stored) setMinigamePool(normalizeMinigamePool(JSON.parse(stored)));
    } catch {}
    setPreferencesLoaded(true);
  }, []);
  useEffect(() => {
    if (!preferencesLoaded) return;
    try {
      localStorage.setItem(
        'sp-audio-sun',
        JSON.stringify({ music: musicVolume, sun: sunBrightness, muted }),
      );
    } catch {}
  }, [preferencesLoaded, musicVolume, sunBrightness, muted]);
  useEffect(() => {
    if (preferencesLoaded)
      try {
        localStorage.setItem('sp-minigame-pool', JSON.stringify(minigamePool));
      } catch {}
  }, [preferencesLoaded, minigamePool]);
  function toggleMinigame(id: string) {
    if (minigamePool.includes(id) && minigamePool.length === 1) {
      setNotice('Keep at least one minigame checked for board play.');
      return;
    }
    setMinigamePool((pool) =>
      pool.includes(id) ? pool.filter((n) => n !== id) : [...pool, id],
    );
  }
  useEffect(() => {
    const click = (event: MouseEvent) => {
      const button = (event.target as Element)?.closest(
        'button, [role="button"], [role="tab"], [role="option"]',
      );
      if (
        button &&
        !button.hasAttribute('disabled') &&
        button.getAttribute('aria-disabled') !== 'true'
      )
        playSfx('click', 0, muted);
    };
    document.addEventListener('click', click, true);
    return () => document.removeEventListener('click', click, true);
  }, [muted]);
  useEffect(() => {
    let lastWarning = 0;
    const audio = (e: Event) => {
      const d = (e as CustomEvent).detail;
      playSfx(d.kind, d.delta, muted);
    };
    const performanceWarning = (e: Event) => {
      if (Date.now() - lastWarning < 30000) return;
      lastWarning = Date.now();
      setNotice(
        `Browser performance: ${(e as CustomEvent).detail.fps} FPS. Detail was reduced automatically. Performance graphics is also available in Settings.`,
      );
    };
    window.addEventListener('sp-sound', audio);
    window.addEventListener('sp-performance-slow', performanceWarning);
    return () => {
      window.removeEventListener('sp-sound', audio);
      window.removeEventListener('sp-performance-slow', performanceWarning);
    };
  }, [muted]);
  function sound(freq = 500) {
    if (muted) return;
    try {
      const c = audioRef.current ?? new AudioContext();
      audioRef.current = c;
      void c.resume();
      const osc = c.createOscillator(),
        gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, c.currentTime);
      osc.frequency.exponentialRampToValueAtTime(
        freq * 0.65,
        c.currentTime + 0.12,
      );
      gain.gain.setValueAtTime(0.055, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.16);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + 0.17);
    } catch {}
  }
  useEffect(() => {
    try {
      const a = localStorage.getItem('sp-avatar');
      if (a) setAvatar(validateAvatar(JSON.parse(a)));
      const s = localStorage.getItem('sp-save');
      if (s) {
        let parsed = JSON.parse(s);
        if (parsed.version === 1 && parsed.players?.length === 4) {
          if (parsed.phase === 'minigame' && parsed.miniVersion !== 2)
            prepareMinigame(
              parsed,
              AVAILABLE_ARCADE.some((m) => m.index === parsed.mini)
                ? parsed.mini
                : AVAILABLE_ARCADE[0].index,
            );
          parsed.players = parsed.players.map((p: Game['players'][number]) => ({
            ...p,
            avatar: validateAvatar(p.avatar),
          }));
          parsed.diamondGoal ??= 0;
          parsed = migrateGame(parsed, parsed.savedAt ?? Date.now());
          if (!parsed.flight)
            parsed.departed = Object.fromEntries(
              parsed.players.map((p: Game['players'][number]) => [p.id, 0]),
            );
          setSaved(parsed);
        }
      }
      const se = sessionStorage.getItem('sp-room');
      if (se && !offline) setSession(JSON.parse(se));
      else if (!offline) {
        // A closed tab can rejoin its last room (rooms live for 24 hours).
        const last = JSON.parse(localStorage.getItem(LAST_ROOM) ?? 'null');
        if (last && Date.now() - last.at < 86400000)
          setLastRoom({ code: last.code, id: last.id, token: last.token });
      }
      // Invite links (?join=CODE) open straight into the join form.
      const join = new URLSearchParams(location.search).get('join');
      if (join && /^[A-Za-z0-9]{8}$/.test(join) && !offline) {
        setInvite(join.toUpperCase());
        setCode(join.toUpperCase());
        history.replaceState(null, '', location.pathname);
      }
    } catch {}
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    // Dev-only screenshot scenes (?shot=…), see game/shot.ts.
    const scene = shotScene();
    const setup = scene ? buildShot(scene, DEFAULT_AVATAR, Date.now()) : null;
    if (setup) {
      document.documentElement.classList.add('shot-mode');
      setSession(null);
      setStarted(setup.started);
      setPanel(setup.panel);
      if (setup.boardId) setBoardId(setup.boardId);
      if (setup.game) {
        setOrbital(false);
        setGame(setup.game);
      }
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('sp-avatar', JSON.stringify(avatar));
    } catch {}
  }, [avatar]);
  useEffect(() => {
    if (game && !session && !game.practice) {
      try {
        localStorage.setItem(
          'sp-save',
          JSON.stringify({ ...game, savedAt: Date.now() }),
        );
        setSaved({ ...game, savedAt: Date.now() });
      } catch {
        setNotice(
          'Your browser could not save this match. Keep this tab open.',
        );
      }
    }
  }, [game, session]);
  useEffect(() => {
    if (panel !== 'play') return;
    const timer = setInterval(() => {
      const now = Date.now() + offsetRef.current;
      setClock(now);
      if (!session)
        setGame((g) => (g ? reduceGame(g, '', { type: 'tick' }, now) : g));
    }, 100);
    return () => clearInterval(timer);
  }, [session, panel]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 6500);
    return () => clearTimeout(t);
  }, [notice]);
  function receive(data: Room) {
    if (data.revision < (onlineRef.current?.revision ?? -1)) return;
    if (!onlineRef.current) {
      setRounds(data.rounds);
      setDifficulty(data.difficulty ?? 1);
      setDiamondGoal(data.diamondGoal ?? 3);
      setBoardId(data.boardId ?? 'crown');
    }
    const entering = !!data.game && !onlineRef.current?.game;
    const seenEmote = onlineRef.current?.emotes?.at(-1)?.id ?? 0;
    if (
      onlineRef.current &&
      data.emotes?.some((e) => e.id > seenEmote && e.seat !== session?.id)
    )
      playSfx('pass', 0, muted);
    onlineRef.current = data;
    setRoom(data);
    if (data.game) {
      setGame(data.game);
      if (entering) {
        setPanel('play');
        setOrbital(false);
      }
    }
  }
  useEffect(() => {
    if (!session) return;
    let stop = false,
      failures = 0,
      t: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function poll() {
      try {
        const sent = Date.now(),
          known = onlineRef.current;
        // The server answers "unchanged" when it has nothing newer than this.
        const since = known ? `&since=${known.revision}.${known.pulse ?? 0}` : '';
        const res = await fetch(`/api/room?code=${session!.code}${since}`, {
          headers: { 'x-party-token': session!.token },
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(10000),
          ]),
        });
        const data = (await res.json()) as Room &
          Session & { error?: string; unchanged?: boolean };
        if (!stop) {
          if (res.ok) {
            failures = 0;
            offsetRef.current =
              data.serverTime + (Date.now() - sent) / 2 - Date.now();
            if (!data.unchanged) receive(data);
          } else {
            failures++;
            setNotice(data.error ?? 'Could not reach the party.');
            if (
              res.status === 400 &&
              /expired|not found/.test(data.error ?? '')
            ) {
              clearSession();
              return;
            }
          }
        }
      } catch {
        failures++;
        if (!stop)
          setNotice('Connection interrupted. Reconnecting to your party…');
      }
      if (!stop)
        t = setTimeout(
          poll,
          failures
            ? Math.min(15000, 800 * 2 ** Math.min(failures, 5)) +
                Math.random() * 300
            : ['minigame', 'moving', 'rolling', 'arrival', 'vote'].includes(
                  gameRef.current?.phase ?? '',
                )
              ? 220
              : 650,
        );
    }
    void poll();
    return () => {
      stop = true;
      controller.abort();
      clearTimeout(t);
    };
  }, [session]);
  async function request(body: Record<string, unknown>) {
    const sent = Date.now();
    const res = await fetch('/api/room', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session ? { 'x-party-token': session.token } : {}),
      },
      body: JSON.stringify({ ...body, code: body.code ?? session?.code }),
      signal: AbortSignal.timeout(10000),
    });
    const data = (await res.json()) as Room & Session & { error?: string };
    if (!res.ok) {
      const error: RequestError = Error(data.error ?? 'The request failed.');
      error.status = res.status;
      throw error;
    }
    offsetRef.current = data.serverTime + (Date.now() - sent) / 2 - Date.now();
    return data;
  }
  /** Fetch the room's latest full state (used to recover from stale actions). */
  async function refresh() {
    if (!session) return;
    const res = await fetch(`/api/room?code=${session.code}`, {
      headers: { 'x-party-token': session.token },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) receive((await res.json()) as Room);
  }
  async function connect(type: 'create' | 'join') {
    setBusy(true);
    try {
      const data = await request({
        type,
        boardId,
        avatar,
        rounds,
        difficulty,
        diamondGoal,
        minigamePool,
        code: code.trim().toUpperCase(),
      });
      const s = { code: data.code, id: data.id, token: data.token };
      onlineRef.current = null;
      setSession(s);
      sessionStorage.setItem('sp-room', JSON.stringify(s));
      try {
        localStorage.setItem(LAST_ROOM, JSON.stringify({ ...s, at: Date.now() }));
      } catch {}
      receive(data);
      sound();
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function dispatch(action: Action) {
    if (busy) return;
    setBusy(true);
    try {
      if (session) {
        const send = () =>
          request({
            type: 'action',
            action,
            revision: onlineRef.current?.revision,
          });
        let data: Room;
        try {
          data = await send();
        } catch (e) {
          // The room advanced (a timer or another player) since our last poll:
          // catch up once and resend if the action still makes sense.
          if ((e as RequestError).status !== 409) throw e;
          await refresh();
          data = await send();
        }
        receive(data);
      } else setGame((g) => (g ? reduceGame(g, g.players[0].id, action) : g));
      sound(action.type === 'roll' ? 690 : 430);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function clearSession() {
    offsetRef.current = 0;
    setSession(null);
    setRoom(null);
    onlineRef.current = null;
    sessionStorage.removeItem('sp-room');
    try {
      localStorage.removeItem(LAST_ROOM);
    } catch {}
    setLastRoom(null);
    setPanel('menu');
    setGame(null);
  }
  function disconnect() {
    if (session) {
      // Capture the current session before clearing it. Leaving must not delay
      // starting solo play, but the server needs to release this seat.
      void request({ type: 'leave' }).catch(() => {});
    }
    clearSession();
  }
  function resumeGame(source: Game) {
    const g = structuredClone(source),
      shift = Date.now() - (g.savedAt ?? Date.now());
    g.due += shift;
    if (g.presentUntil) g.presentUntil += shift;
    if (g.finale) g.finale.startedAt += shift;
    if (g.effect?.startedAt) g.effect.startedAt += shift;
    if (g.diamondPickup) g.diamondPickup.startedAt += shift;
    if (g.flight) {
      g.flight.startedAt += shift;
      g.flight.landAt += shift;
    }
    if (g.departed)
      Object.keys(g.departed).forEach((id) => {
        if (g.departed![id]) g.departed![id] += shift;
      });
    if (g.rampClosesAt) g.rampClosesAt += shift;
    if (g.announce) {
      g.announce.startedAt += shift;
      g.announce.until += shift;
    }
    if (g.dice) {
      g.dice.startedAt += shift;
      g.dice.revealAt += shift;
      g.dice.until += shift;
    }
    if (g.movement) {
      g.movement.startedAt += shift;
      g.movement.arrivesAt += shift;
    }
    if (g.vote) {
      g.vote.endsAt += shift;
      if (g.vote.resolvedAt) g.vote.resolvedAt += shift;
    }
    if (g.miniStart) g.miniStart += shift;
    if (!source.savedAt && g.phase === 'turn')
      g.due = Date.now() + RULES.turnTimeout;
    return g;
  }
  function startSolo(resume = false, selectedBoard = boardId) {
    setOrbital(false);
    offsetRef.current = 0;
    if (session) disconnect();
    setGame(
      resume && saved
        ? resumeGame(saved)
        : newGame(
            avatar,
            rounds,
            difficulty,
            undefined,
            selectedBoard,
            diamondGoal,
            minigamePool,
          ),
    );
    setPanel('play');
    sound(700);
  }
  function practice(index: number) {
    if (session) disconnect();
    const g = newGame(avatar, 1, difficulty, undefined, boardId);
    g.practice = true;
    prepareMinigame(g, index);
    setGame(g);
    setPanel('play');
    sound();
  }
  function randomize() {
    setAvatar((a) => ({
      ...a,
      skin: ALIEN_SKIN,
      shirt: OUTFITS[Math.floor(Math.random() * 8)],
      hair: Math.floor(Math.random() * 8),
      eyes: Math.floor(Math.random() * 4),
      mouth: Math.floor(Math.random() * 3),
      accessory: Math.floor(Math.random() * 7),
      pattern: Math.floor(Math.random() * 5),
    }));
    sound();
  }
  const playing = panel === 'play' && game,
    active = game?.players[game.active],
    me =
      game?.players.find((p) => p.id === (session?.id ?? 'local')) ??
      game?.players[0],
    myTurn = active?.id === me?.id,
    mini = game ? arcadeInfo(game.mini) : MINIGAMES[0],
    isMini = started && playing && game.phase === 'minigame';
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if ((e.target as HTMLElement)?.matches('input,textarea,[role=combobox]'))
        return;
      if (panel !== 'play' || !gameRef.current) return;
      const g = gameRef.current;
      if (g.phase === 'minigame') return;
      if (
        e.code === 'Space' &&
        myTurn &&
        (g.phase === 'turn' || g.phase === 'landed')
      ) {
        e.preventDefault();
        void dispatch({
          type: g.phase === 'turn' ? 'roll' : 'end',
        });
      }
    }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  const back = () => setPanel(game ? 'play' : 'menu');
  const startScreen = () => {
    setStarted(true);
    sound(659);
  };
  // An invite link opens the join form as soon as the title screen is passed.
  useEffect(() => {
    if (!started || !invite) return;
    if (!session) setPanel('online');
    setInvite('');
  }, [started, invite, session]);
  const padConnected = useGamepadUI({
    started,
    onStart: startScreen,
    onBack: () => {
      if (panel === 'play') setPanel('menu');
      else if (panel !== 'menu') back();
    },
    context: `${panel}-${game?.phase ?? ''}-${game?.active ?? 0}-${game?.lottery?.stage ?? ''}`,
  });
  const spaceView = !started || (orbital && !playing && panel !== 'creator');
  useEffect(() => {
    document.documentElement.dataset.partyTheme = spaceView ? 'dark' : 'light';
    return () => {
      delete document.documentElement.dataset.partyTheme;
    };
  }, [spaceView]);
  useEffect(() => {
    if (started) return;
    const begin = (e: KeyboardEvent) => {
      if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      startScreen();
    };
    window.addEventListener('keydown', begin, true);
    return () => window.removeEventListener('keydown', begin, true);
  }, [started]);
  useEffect(() => {
    if (panel !== 'play' || !game) return;
    if (game.phase === 'arrival') playSfx('arrival', 0, muted);
    if (game.phase === 'turn') playSfx('turn', 0, muted);
    if (game.phase === 'vote') playSfx('vote', 0, muted);
    if (game.phase === 'lastTurns') playSfx('lastTurns', 0, muted);
  }, [game?.phase, game?.active, panel]);
  const matchOptions = (
    <div className="match-options">
      <Choice
        label="Turns per player"
        options={['5 turns', '10 turns', '15 turns', '20 turns', '30 turns']}
        value={rounds + ' turns'}
        onChange={(v) => setRounds(parseInt(v))}
      />
      <Choice
        label="Diamonds required to win"
        options={[
          'Turn limit only',
          '1 diamond',
          '3 diamonds',
          '5 diamonds',
          '10 diamonds',
        ]}
        value={
          diamondGoal
            ? diamondGoal + (diamondGoal === 1 ? ' diamond' : ' diamonds')
            : 'Turn limit only'
        }
        onChange={(v) => setDiamondGoal(parseInt(v) || 0)}
      />
      <Choice
        label="AI opponent difficulty"
        options={['Easy', 'Normal', 'Expert']}
        value={['Easy', 'Normal', 'Expert'][difficulty]}
        onChange={(v) => setDifficulty(['Easy', 'Normal', 'Expert'].indexOf(v))}
      />
    </div>
  );
  const flightLive = playing && game.phase === 'arrival';
  const announcing =
    playing && game.phase === 'turn' && clock < (game.announce?.until ?? 0);
  const rolling =
    playing &&
    game.phase === 'rolling' &&
    game.dice &&
    clock >= game.dice.startedAt;

  return (
    <main
      className={`game-shell ${spaceView ? '' : 'light-ui'} ${!started ? 'title-mode' : ''} ${panel === 'creator' ? 'creating' : ''} ${isMini ? 'minigame-mode' : ''}`}
    >
      {!isMini && (
        <Scene
          avatar={avatar}
          mode={panel === 'creator' ? 'creator' : 'board'}
          players={playing ? game.players : undefined}
          pearl={playing ? game.pearl : undefined}
          active={playing ? game.active : undefined}
          low={low}
          reduced={reduced}
          view={view}
          boardId={playing ? (game?.boardId ?? boardId) : boardId}
          effect={playing ? game.effect : undefined}
          path={playing ? game.path : undefined}
          bank={playing ? game.bank : undefined}
          focus={!!playing}
          orbital={spaceView}
          titleScreen={!started}
          sunBrightness={sunBrightness}
          travelTo={travelTo}
          onTravelComplete={() => {
            if (!travelTo) return;
            setBoardId(travelTo);
            setOrbital(false);
            setTravelTo(undefined);
            setView((v) => v + 1);
          }}
          onOrbitView={setOrbital}
          game={playing ? game : undefined}
          clockOffset={offsetRef.current}
        />
      )}
      {!started && (
        <button
          className="title-screen"
          onClick={startScreen}
          aria-label="Press any button to start Party Planets"
        >
          <span className="title-brand pp-title-brand">
            <PartyLogo />
          </span>
          <span className="start-prompt">press any button to start</span>
          <span className="start-credit">
            product of keperoni industries incorporated
          </span>
        </button>
      )}
      {started && padConnected && !isMini && (
        <div className="controller-hint">
          D-pad / stick: select · A: confirm · B: back
        </div>
      )}
      <header
        className="masthead"
        style={isMini ? { display: 'none' } : undefined}
      >
        <button
          className={
            panel === 'menu' ? 'wordmark pp-wordmark on-menu' : 'wordmark pp-wordmark'
          }
          aria-label="Main menu"
          onClick={() => setPanel('menu')}
        >
          <PartyLogo variant="compact" />
        </button>
        <div className="top-actions">
          {playing && (
            <span className="edition">
              {session ? (
                <>
                  <Globe size={14} /> {session.code}
                </>
              ) : (
                <>
                  <Palmtree size={15} /> SOLO PARTY
                </>
              )}{' '}
              <b>
                {game.practice
                  ? 'PRACTICE'
                  : `ROUND ${game.round} / ${game.rounds}`}
              </b>
            </span>
          )}
          <button
            className="icon-button"
            title="How to play"
            onClick={() => setPanel('help')}
          >
            <CircleHelp />
          </button>
          <button
            className="icon-button"
            title={muted ? 'Enable sound' : 'Mute sound'}
            onClick={() => setMuted(!muted)}
          >
            {muted ? <VolumeX /> : <Volume2 />}
          </button>
          <button
            className="icon-button"
            title="Settings"
            onClick={() => setPanel('settings')}
          >
            <Settings />
          </button>
        </div>
      </header>
      {panel === 'menu' && (
        <>
          <div className="pp-menu-sky" aria-hidden="true">
            <span className="pp-sky-nebula" />
            <span className="pp-sky-rays" />
            <span className="pp-sky-dust" />
            <span className="pp-sky-vignette" />
            <span className="pp-sky-confetti">
              <i />
              <i />
            </span>
          </div>
          <div className="pp-menu-hero" aria-hidden="true">
            <span className="pp-logo-burst" />
            <PartyLogo />
          </div>
          <section className="menu-panel home-menu pp-menu">
            <h1 className="pp-menu-banner">
              <span>
                A whole <em>universe!</em>
              </span>
            </h1>
            <fieldset className="planet-tabs pp-planets" aria-label="Planets">
              {PLANETS.map((p) => (
                <button
                  key={p.id}
                  className="pp-planet"
                  style={
                    { '--pt': PLANET_TINT[p.id] ?? '#33c3f5' } as React.CSSProperties
                  }
                  aria-pressed={getBoard(boardId).planet === p.id}
                  disabled={!!travelTo}
                  onClick={() => {
                    setBoardId(p.boardIds[0]);
                    setOrbital(true);
                  }}
                >
                  <span className="pp-orb" aria-hidden="true">
                    <span
                      style={{
                        backgroundImage: `url(/textures/planets/${p.id}-color.webp)`,
                      }}
                    />
                  </span>
                  <span className="pp-planet-name">{p.name}</span>
                </button>
              ))}
            </fieldset>
            <div className="home-worlds" role="group" aria-label="Party boards">
              {BOARDS.filter((b) => b.planet === getBoard(boardId).planet).map(
                (b) => (
                  <button
                    key={b.id}
                    disabled={!!travelTo}
                    aria-pressed={boardId === b.id}
                    className={
                      boardId === b.id ? 'home-world selected' : 'home-world'
                    }
                    onClick={() => {
                      if (b.id === boardId && !orbital) return;
                      if (reduced || !orbital) {
                        setBoardId(b.id);
                        setOrbital(false);
                        setView((v) => v + 1);
                      } else {
                        setOrbital(true);
                        setTravelTo(b.id);
                      }
                    }}
                  >
                    <span
                      className="pp-board-badge"
                      style={
                        {
                          '--pt': PLANET_TINT[b.planet] ?? '#33c3f5',
                        } as React.CSSProperties
                      }
                    >
                      {b.planet === 'selene' ? (
                        <Gem strokeWidth={2.6} />
                      ) : b.planet === 'verdara' ? (
                        <Sparkles strokeWidth={2.6} />
                      ) : b.planet === 'ignara' ? (
                        <Zap strokeWidth={2.6} />
                      ) : b.id === 'crown' ? (
                        <Palmtree strokeWidth={2.6} />
                      ) : (
                        <Waves strokeWidth={2.6} />
                      )}
                    </span>
                    <b>{b.name}</b>
                    <small>{b.ecosystem.split(' & ')[0]}</small>
                  </button>
                ),
              )}
            </div>
            <button
              className="primary pp-play"
              disabled={!!travelTo}
              onClick={() => setPanel('setup')}
            >
              <span className="pp-play-icon" aria-hidden="true">
                <Play size={22} fill="currentColor" strokeWidth={2.6} />
              </span>
              <span className="pp-play-label">
                Play {getBoard(boardId).name}
              </span>
              <ArrowRight className="pp-play-arrow" strokeWidth={3} />
            </button>
            <div className="menu-sub pp-crew">
              <span className="pp-crew-chip" aria-hidden="true">
                <Users size={16} strokeWidth={2.8} />
              </span>
              <span>
                <b>You</b> + 3 CPU rivals
              </span>
            </div>
            <button
              className="menu-option pp-opt pp-opt-online"
              onClick={() =>
                offline
                  ? setNotice(
                      'Online parties are available in the hosted edition. This file plays solo without internet.',
                    )
                  : setPanel('online')
              }
            >
              <span className="pp-opt-badge" aria-hidden="true">
                <Globe strokeWidth={2.75} />
              </span>
              <span>
                Online party<small>Up to 4 friends</small>
              </span>
              <ChevronRight strokeWidth={3.5} />
            </button>
            <button
              className="menu-option pp-opt pp-opt-studio"
              onClick={() => setPanel('creator')}
            >
              <span className="pp-opt-badge" aria-hidden="true">
                <UserRound strokeWidth={2.75} />
              </span>
              <span>
                Character studio<small>Meet your next alter ego</small>
              </span>
              <ChevronRight strokeWidth={3.5} />
            </button>
            <button
              className="menu-option pp-opt pp-opt-arcade"
              onClick={() => setPanel('arcade')}
            >
              <span className="pp-opt-badge" aria-hidden="true">
                <DiceIcon size={34} value={5} />
              </span>
              <span>
                Minigame arcade
                <small>Play all {AVAILABLE_ARCADE.length} games</small>
              </span>
              <ChevronRight strokeWidth={3.5} />
            </button>
            <button
              className="text-button pp-back"
              onClick={() => {
                setTravelTo(undefined);
                setOrbital(true);
                setStarted(false);
              }}
            >
              <Home size={16} /> Back to start screen
            </button>
            {saved && saved.phase !== 'finished' && (
              <button className="text-button" onClick={() => startSolo(true)}>
                Resume solo · Round {saved.round}
              </button>
            )}
            {session && (
              <button
                className="text-button"
                onClick={() => setPanel(room?.game ? 'play' : 'online')}
              >
                Return to online party
              </button>
            )}
          </section>
          <div
            className="location pp-location"
            style={
              {
                '--pt': PLANET_TINT[getBoard(boardId).planet] ?? '#33c3f5',
              } as React.CSSProperties
            }
          >
            <span className="pp-loc-tag">{orbital ? 'Now orbiting' : 'Now landing'}</span>
            <span className="pp-orb pp-loc-orb" aria-hidden="true">
              <span
                style={{
                  backgroundImage: `url(/textures/planets/${getBoard(boardId).planet}-color.webp)`,
                }}
              />
            </span>
            <h2 className="pp-loc-name">
              {orbital
                ? getPlanet(getBoard(boardId).planet).name
                : getBoard(boardId).name}
            </h2>
            <div className="pp-loc-stats">
              {orbital ? (
                <>
                  <span>
                    <b>
                      {
                        BOARDS.filter(
                          (b) => b.planet === getBoard(boardId).planet,
                        ).length
                      }
                    </b>{' '}
                    {BOARDS.filter((b) => b.planet === getBoard(boardId).planet)
                      .length === 1
                      ? 'board'
                      : 'boards'}
                  </span>
                  <span>
                    <b>{AVAILABLE_ARCADE.length}</b> minigames
                  </span>
                </>
              ) : (
                <span>{getBoard(boardId).ecosystem}</span>
              )}
            </div>
            <p className="pp-loc-hint">Drag to explore · Scroll to zoom</p>
          </div>
        </>
      )}
      {panel === 'setup' && (
        <section className="center-panel setup-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">MISSION BRIEFING</span>
              <h2>Set up your party</h2>
            </div>
            <button
              className="icon-button"
              onClick={() => setPanel('menu')}
              title="Close game setup"
            >
              <X />
            </button>
          </div>
          <div className="setup-destination">
            <Ufo />
            <div>
              <b>{getBoard(boardId).name}</b>
              <span>
                {getBoard(boardId).ecosystem} · 1 explorer + 3 AI rivals
              </span>
            </div>
          </div>
          {matchOptions}
          <p className="muted">
            {diamondGoal
              ? 'First to ' +
                diamondGoal +
                (diamondGoal === 1 ? ' diamond' : ' diamonds') +
                ' wins. '
              : ''}
            At the turn limit, most diamonds wins; points break ties. Each
            diamond costs 50 points.
          </p>
          <button className="primary" onClick={() => startSolo(false, boardId)}>
            <Ufo /> Launch party <ArrowRight />
          </button>
        </section>
      )}
      {panel === 'boards' && (
        <section className="center-panel worlds-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">THREE PLANETS · NINE ECOSYSTEMS</span>
              <h2>Choose your party world</h2>
            </div>
            <button
              className="icon-button"
              onClick={() => setPanel('menu')}
              title="Close boards"
            >
              <X />
            </button>
          </div>
          <div className="world-grid">
            {BOARDS.map((b) => (
              <button
                key={b.id}
                className={
                  boardId === b.id ? 'world-card selected' : 'world-card'
                }
                onClick={() => {
                  setBoardId(b.id);
                  setOrbital(false);
                  setView((v) => v + 1);
                }}
                style={{ '--world-color': b.ground } as React.CSSProperties}
              >
                <span className="world-number">{getPlanet(b.planet).name}</span>
                <h3>{b.name}</h3>
                <b>{b.ecosystem}</b>
                <p>{b.description}</p>
                <small>
                  {b.hazard}: −{b.loss} points · Bank jackpots · Portals
                </small>
              </button>
            ))}
          </div>
          <p>
            Pass a bank: deposit up to 5 points. Land on a bank: collect the
            entire shared pot.
          </p>
          <button className="primary" onClick={() => setPanel('setup')}>
            <Play /> Play {getBoard(boardId).name}
          </button>
        </section>
      )}
      {panel === 'creator' && (
        <>
          <div className="creator-caption">
            <span className="eyebrow">INTERGALACTIC CHARACTER STUDIO</span>
            <h1>{avatar.name}</h1>
            <p>100% you. Extra personality.</p>
            <button className="light-button" onClick={randomize}>
              <Shuffle /> Surprise me
            </button>
          </div>
          <section className="side-panel creator-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">MAKE SOMEONE UNFORGETTABLE</span>
                <h2>Character studio</h2>
              </div>
              <button
                className="icon-button"
                onClick={back}
                title="Close creator"
              >
                <X />
              </button>
            </div>
            <label className="field">
              <span>Name</span>
              <input
                maxLength={18}
                value={avatar.name}
                onChange={(e) => setAvatar({ ...avatar, name: e.target.value })}
              />
            </label>
            <Tabs defaultValue="body">
              <TabsList className="studio-tabs">
                <TabsTrigger value="body">Body</TabsTrigger>
                <TabsTrigger value="face">Face</TabsTrigger>
                <TabsTrigger value="style">Style</TabsTrigger>
              </TabsList>
              <TabsContent value="body">
                <p className="alien-note">
                  Always green. Entirely you. Fine-tune your alien’s proportions
                  here.
                </p>
                <label className="field">
                  <span>
                    Height <small>{Math.round(avatar.height * 100)}%</small>
                  </span>
                  <Slider
                    aria-label="Height"
                    min={0.75}
                    max={1.25}
                    step={0.05}
                    value={[avatar.height]}
                    onValueChange={(v) =>
                      setAvatar({
                        ...avatar,
                        height: Array.isArray(v) ? v[0] : v,
                      })
                    }
                  />
                </label>
                <label className="field">
                  <span>
                    Build <small>{Math.round(avatar.width * 100)}%</small>
                  </span>
                  <Slider
                    aria-label="Build"
                    min={0.75}
                    max={1.25}
                    step={0.05}
                    value={[avatar.width]}
                    onValueChange={(v) =>
                      setAvatar({
                        ...avatar,
                        width: Array.isArray(v) ? v[0] : v,
                      })
                    }
                  />
                </label>
              </TabsContent>
              <TabsContent value="face">
                <ColorPicker
                  label="Eye color"
                  values={[
                    '#294d5d',
                    '#513831',
                    '#58856a',
                    '#659ccf',
                    '#9371aa',
                    '#171c26',
                  ]}
                  value={avatar.eyeColor ?? '#294d5d'}
                  onChange={(eyeColor) => setAvatar({ ...avatar, eyeColor })}
                />
                <Choice
                  label="Eyebrows"
                  options={['None', 'Soft', 'Thick', 'Raised']}
                  value={['None', 'Soft', 'Thick', 'Raised'][avatar.brows ?? 0]}
                  onChange={(v) =>
                    setAvatar({
                      ...avatar,
                      brows: ['None', 'Soft', 'Thick', 'Raised'].indexOf(v),
                    })
                  }
                />
                <Choice
                  label="Nose"
                  options={['Button', 'Round', 'Pointed', 'Tiny']}
                  value={
                    ['Button', 'Round', 'Pointed', 'Tiny'][avatar.nose ?? 0]
                  }
                  onChange={(v) =>
                    setAvatar({
                      ...avatar,
                      nose: ['Button', 'Round', 'Pointed', 'Tiny'].indexOf(v),
                    })
                  }
                />
                <label className="field">
                  <span>Eye spacing</span>
                  <Slider
                    aria-label="Eye spacing"
                    min={0.12}
                    max={0.24}
                    step={0.01}
                    value={[avatar.eyeSpacing ?? 0.155]}
                    onValueChange={(v) =>
                      setAvatar({
                        ...avatar,
                        eyeSpacing: Array.isArray(v) ? v[0] : v,
                      })
                    }
                  />
                </label>
                <label className="field">
                  <span>Smile size</span>
                  <Slider
                    aria-label="Smile size"
                    min={0.7}
                    max={1.5}
                    step={0.1}
                    value={[avatar.mouthScale ?? 1]}
                    onValueChange={(v) =>
                      setAvatar({
                        ...avatar,
                        mouthScale: Array.isArray(v) ? v[0] : v,
                      })
                    }
                  />
                </label>
                <label className="toggle-row">
                  <span>Freckles</span>
                  <Switch
                    checked={avatar.freckles ?? false}
                    onCheckedChange={(freckles) =>
                      setAvatar({ ...avatar, freckles })
                    }
                  />
                </label>
                <Choice
                  label="Eyes"
                  options={eyes}
                  value={eyes[avatar.eyes]}
                  onChange={(v) =>
                    setAvatar({ ...avatar, eyes: eyes.indexOf(v) })
                  }
                />
                <Choice
                  label="Mouth"
                  options={mouths}
                  value={mouths[avatar.mouth]}
                  onChange={(v) =>
                    setAvatar({ ...avatar, mouth: mouths.indexOf(v) })
                  }
                />
                <Choice
                  label="Hair"
                  options={hair}
                  value={hair[avatar.hair]}
                  onChange={(v) =>
                    setAvatar({ ...avatar, hair: hair.indexOf(v) })
                  }
                />
              </TabsContent>
              <TabsContent value="style">
                <ColorPicker
                  label="Hair color"
                  values={[
                    '#603821',
                    '#241d27',
                    '#d3a348',
                    '#e5ddd2',
                    '#b85742',
                    '#7c5ba6',
                    '#d778a8',
                    '#3b8790',
                  ]}
                  value={avatar.hairColor ?? '#603821'}
                  onChange={(hairColor) => setAvatar({ ...avatar, hairColor })}
                />
                <ColorPicker
                  label="Shoes"
                  values={[
                    '#183e47',
                    '#fbf0d9',
                    '#e77873',
                    '#f3bd50',
                    '#7095c9',
                    '#a17ccc',
                  ]}
                  value={avatar.shoeColor ?? '#183e47'}
                  onChange={(shoeColor) => setAvatar({ ...avatar, shoeColor })}
                />
                <Choice
                  label="Outfit pattern"
                  options={[
                    'Solid',
                    'Stripes',
                    'Confetti',
                    'Overalls',
                    'Hawaiian shirt',
                  ]}
                  value={
                    [
                      'Solid',
                      'Stripes',
                      'Confetti',
                      'Overalls',
                      'Hawaiian shirt',
                    ][avatar.pattern ?? 0]
                  }
                  onChange={(v) =>
                    setAvatar({
                      ...avatar,
                      pattern: [
                        'Solid',
                        'Stripes',
                        'Confetti',
                        'Overalls',
                        'Hawaiian shirt',
                      ].indexOf(v),
                    })
                  }
                />
                <Choice
                  label="Facial hair"
                  options={['None', 'Mustache', 'Goatee']}
                  value={['None', 'Mustache', 'Goatee'][avatar.beard ?? 0]}
                  onChange={(v) =>
                    setAvatar({
                      ...avatar,
                      beard: ['None', 'Mustache', 'Goatee'].indexOf(v),
                    })
                  }
                />
                <label className="toggle-row">
                  <span>Gloves</span>
                  <Switch
                    checked={avatar.gloves ?? true}
                    onCheckedChange={(gloves) =>
                      setAvatar({ ...avatar, gloves })
                    }
                  />
                </label>
                <ColorPicker
                  label="Outfit"
                  values={OUTFITS}
                  value={avatar.shirt}
                  onChange={(shirt) => setAvatar({ ...avatar, shirt })}
                />
                <Choice
                  label="Accessory"
                  options={accessories}
                  value={accessories[avatar.accessory]}
                  onChange={(v) =>
                    setAvatar({ ...avatar, accessory: accessories.indexOf(v) })
                  }
                />
              </TabsContent>
            </Tabs>
            <div className="panel-footer">
              <span>Saved on this device</span>
              <button
                className="primary"
                onClick={() => {
                  setAvatar((a) => ({
                    ...a,
                    name: a.name.trim() || 'Frankie',
                  }));
                  setPanel('menu');
                  sound();
                }}
              >
                <Check /> Looking good
              </button>
            </div>
          </section>
        </>
      )}
      {panel === 'online' && (
        <section className="center-panel online-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">BETTER TOGETHER</span>
              <h2>Online party</h2>
            </div>
            <button
              className="icon-button"
              onClick={back}
              title="Close online party"
            >
              <X />
            </button>
          </div>
          {session && room ? (
            <>
              <div className="room-code">
                <span>ROOM CODE</span>
                <strong>{session.code}</strong>
                <button
                  className="light-button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(session.code);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2500);
                    } catch {
                      setNotice('Select and copy the room code above.');
                    }
                  }}
                >
                  {copied ? <Check /> : <Copy />}
                  {copied ? 'Copied' : 'Copy code'}
                </button>
                <button
                  className="light-button"
                  onClick={async () => {
                    const link = `${location.origin}${location.pathname}?join=${session.code}`;
                    try {
                      if (navigator.share && matchMedia('(pointer: coarse)').matches)
                        await navigator.share({ title: 'Party Planets', text: 'Join my party!', url: link });
                      else {
                        await navigator.clipboard.writeText(link);
                        setNotice('Invite link copied — send it to your friends.');
                      }
                    } catch {
                      setNotice(link);
                    }
                  }}
                >
                  <Users /> Invite link
                </button>
              </div>
              <div className="seats">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i}>
                    <span
                      className="seat-dot"
                      style={{
                        background: room.seats[i]?.avatar.shirt ?? '#ccdfd0',
                      }}
                    >
                      <UserRound />
                    </span>
                    <b>{room.seats[i]?.avatar.name ?? 'Open seat'}</b>
                    <small>
                      {room.seats[i]?.id === room.host
                        ? 'HOST'
                        : room.seats[i]
                          ? 'READY'
                          : 'CPU if unfilled'}
                    </small>
                  </div>
                ))}
              </div>
              <p className="muted">
                Share this page and the room code with friends who can access
                this game. Rooms last 24 hours; if you close the tab, Online party offers a one-click rejoin.
              </p>
              {room.host === session.id && !room.game && (
                <>
                  {matchOptions}
                  <p className="muted">
                    Open seats become AI opponents at the selected difficulty.
                  </p>
                </>
              )}
              {room.host !== session.id && (
                <p>
                  {room.rounds} turns · {room.diamondGoal || 'No'} diamond goal
                  · {['Easy', 'Normal', 'Expert'][room.difficulty ?? 1]} AI
                </p>
              )}
              {room.host === session.id ? (
                <button
                  className="primary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      receive(
                        await request({
                          type: 'start',
                          rounds,
                          difficulty,
                          diamondGoal,
                          minigamePool,
                        }),
                      );
                    } catch (e) {
                      setNotice((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <Play /> Start party
                </button>
              ) : (
                <p>Waiting for the host to start…</p>
              )}
              <button className="text-button" onClick={disconnect}>
                Disconnect on this device
              </button>
            </>
          ) : (
            <>
              <p>
                Create a room or join your friends. Empty seats become CPU
                rivals when the host starts.
              </p>
              {lastRoom && (
                <button
                  className="primary"
                  onClick={() => {
                    sessionStorage.setItem('sp-room', JSON.stringify(lastRoom));
                    onlineRef.current = null;
                    setSession(lastRoom);
                    setLastRoom(null);
                    sound();
                  }}
                >
                  <RotateCcw /> Rejoin party {lastRoom.code}
                </button>
              )}
              {matchOptions}
              <Choice
                label="Online board"
                options={BOARDS.map((b) => b.name)}
                value={getBoard(boardId).name}
                onChange={(name) =>
                  setBoardId(BOARDS.find((b) => b.name === name)!.id)
                }
              />
              <button
                className="primary"
                disabled={busy}
                onClick={() => connect('create')}
              >
                <Users />
                {busy ? 'Connecting…' : 'Create a party'}
              </button>
              <div className="divider">OR JOIN A PARTY</div>
              <label className="field">
                <span>Room code</span>
                <input
                  maxLength={8}
                  placeholder="8-character code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
              </label>
              <button
                className="secondary"
                disabled={busy || code.length !== 8}
                onClick={() => connect('join')}
              >
                Join party <ArrowRight />
              </button>
              <p className="footnote">
                Experimental online play · Requires internet access
              </p>
            </>
          )}
        </section>
      )}
      {panel === 'settings' && (
        <section className="center-panel">
          <div className="panel-heading">
            <h2>Party settings</h2>
            <button
              className="icon-button"
              onClick={back}
              title="Close settings"
            >
              <X />
            </button>
          </div>
          <Choice
            label="Next solo match"
            options={[
              '5 rounds',
              '10 rounds',
              '15 rounds',
              '20 rounds',
              '30 rounds',
            ]}
            value={`${rounds} rounds`}
            onChange={(v) => setRounds(parseInt(v))}
          />
          <Choice
            label="CPU difficulty"
            options={['Easy', 'Normal', 'Expert']}
            value={['Easy', 'Normal', 'Expert'][difficulty]}
            onChange={(v) =>
              setDifficulty(['Easy', 'Normal', 'Expert'].indexOf(v))
            }
          />
          <label className="toggle-row">
            <span>Sound (music + effects)</span>
            <Switch checked={!muted} onCheckedChange={(v) => setMuted(!v)} />
          </label>
          <div className="preference-slider">
            <label id="music-volume-label">
              Music volume <b>{Math.round(musicVolume * 100)}%</b>
            </label>
            <Slider
              aria-labelledby="music-volume-label"
              value={[musicVolume * 100]}
              min={0}
              max={100}
              step={5}
              onValueChange={(v) =>
                setMusicVolume((typeof v === 'number' ? v : v[0]) / 100)
              }
            />
          </div>
          <div className="preference-slider">
            <label id="sun-brightness-label">
              Sun brightness <b>{Math.round(sunBrightness * 100)}%</b>
            </label>
            <Slider
              aria-labelledby="sun-brightness-label"
              value={[sunBrightness * 100]}
              min={0}
              max={100}
              step={5}
              onValueChange={(v) =>
                setSunBrightness((typeof v === 'number' ? v : v[0]) / 100)
              }
            />
            <small>Dimmable sun and glow in space and on every board.</small>
          </div>
          <label className="toggle-row">
            <span>Reduce character motion</span>
            <Switch checked={reduced} onCheckedChange={setReduced} />
          </label>
          <label className="toggle-row">
            <span>Performance graphics</span>
            <Switch checked={low} onCheckedChange={setLow} />
          </label>
          <p className="muted">
            Match settings apply to your next solo party. Graphics and sound
            change immediately.
          </p>
          <button className="primary" onClick={back}>
            Done
          </button>
        </section>
      )}
      {panel === 'help' && (
        <section className="center-panel help-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">YOUR FLIGHT BRIEFING</span>
              <h2>How to party</h2>
            </div>
            <button
              className="icon-button"
              onClick={back}
              title="Close instructions"
            >
              <X />
            </button>
          </div>
          <div className="help-rule">
            <Gem />
            <div>
              <b>Collect the most diamonds</b>
              <p>
                Every diamond stops your roll so you can choose to buy it for 50
                points or continue. Reach the diamond goal to win early;
                otherwise return to the ship for three bonus awards at the turn
                limit. Most diamonds wins after bonuses; points break ties.
              </p>
            </div>
          </div>
          <div className="help-rule">
            <Dices />
            <div>
              <b>Roll, explore, stir things up</b>
              <p>
                Use one item before rolling. Choose your road only when your
                alien reaches a fork. Land on a shop to buy one item.
              </p>
            </div>
          </div>
          <div className="help-rule">
            <Flag />
            <div>
              <b>Every round ends in a minigame</b>
              <p>
                All four players take a turn, then vote between three games.
                Most votes wins; ties are chosen randomly among tied games.
                Compete for 10 / 6 / 3 / 1 points. Tied minigame scores earn
                equal prizes.
              </p>
            </div>
          </div>
          <div className="legend">
            {Object.entries(SPACE_INFO).map(([k, s]) => (
              <div key={k}>
                <span style={{ background: s.color }}>{s.mark}</span>
                {s.name}
              </div>
            ))}
          </div>
          <p>
            Event spaces trigger this board’s landmark event. Everyone loses up
            to 20 points based on distance, and those points never enter the
            bank. Bonus diamonds reward the highest final point balance, most
            actual money-loss landings and most event landings. Tied leaders
            share awards; empty landing categories award none.
          </p>
          <p className="muted">
            Space = roll / end turn · WASD / arrows = minigame movement · Space
            = action · Drag = board camera · Scroll = board zoom. Controller:
            stick / D-pad = move or select, A = confirm / action, B = back /
            secondary, Start = pause minigame. Solo saves after each action. In
            online rooms, idle turns advance after 60 seconds.
          </p>
          <button className="primary" onClick={back}>
            Got it. Let’s party.
          </button>
        </section>
      )}
      {panel === 'arcade' && (
        <section className="center-panel arcade-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">A LITTLE FRIENDLY COMPETITION</span>
              <h2>Minigame arcade</h2>
            </div>
            <button className="icon-button" onClick={back} title="Close arcade">
              <X />
            </button>
          </div>
          <div className="arcade-search">
            <input
              aria-label="Search minigames"
              placeholder={`Search ${AVAILABLE_ARCADE.length} minigames by name or type…`}
              value={arcadeSearch}
              onChange={(e) => setArcadeSearch(e.target.value)}
            />
            <span>
              {
                AVAILABLE_ARCADE.filter((m) =>
                  (m.name + ' ' + m.category)
                    .toLowerCase()
                    .includes(arcadeSearch.toLowerCase()),
                ).length
              }{' '}
              / {AVAILABLE_ARCADE.length} games
            </span>
          </div>
          <p className="pool-help">
            Checked games join your next board party. Unchecked games are still
            playable here. {minigamePool.length} selected · the room host
            chooses for online parties.
          </p>
          <div className="arcade-grid">
            {AVAILABLE_ARCADE.map((m) => ({ m, i: m.index }))
              .filter(({ m }) =>
                (m.name + ' ' + m.category)
                  .toLowerCase()
                  .includes(arcadeSearch.toLowerCase()),
              )
              .map(({ m, i }) => (
                <article className="arcade-choice" key={m.id}>
                  <label className="pool-toggle">
                    <Checkbox
                      aria-label={`Include ${m.name} in board games`}
                      checked={minigamePool.includes(m.id)}
                      onCheckedChange={() => toggleMinigame(m.id)}
                    />{' '}
                    Include in board games
                  </label>
                  <button
                    className="arcade-card"
                    onClick={() => practice(i)}
                    style={{ '--mini-color': m.accent } as React.CSSProperties}
                  >
                    <span className="arcade-icon">
                      {i === 0 ? (
                        <Palmtree />
                      ) : i === 1 ? (
                        <Zap />
                      ) : i === 2 ? (
                        <Waves />
                      ) : (
                        <Sparkles />
                      )}
                    </span>
                    <small>
                      {m.category} · {m.duration} sec
                    </small>
                    <h3>{m.name}</h3>
                    <p>{m.brief}</p>
                    <span className="play-label">
                      Play now <ArrowRight size={17} />
                    </span>
                  </button>
                </article>
              ))}
          </div>
        </section>
      )}
      {playing && !isMini && (
        <>
          {flightLive && (
            <div className="arrival-caption" role="status">
              <Ufo />
              <span className="eyebrow">
                DESTINATION:{' '}
                {getPlanet(getBoard(game.boardId).planet).name.toUpperCase()}
              </span>
              <h2>The crew has arrived</h2>
              <p>Touching down at {getBoard(game.boardId).name}…</p>
            </div>
          )}
          {announcing && (
            <div
              className="turn-announcement"
              key={game.announce?.id}
              role="status"
              style={
                active
                  ? ({ '--player': active.avatar.shirt } as React.CSSProperties)
                  : undefined
              }
            >
              {active && (
                <AlienPortrait
                  className="announce-portrait"
                  shirt={active.avatar.shirt}
                  avatar={active.avatar}
                  size={92}
                />
              )}
              <div>
                <span className="eyebrow">
                  ROUND {game.round} · NEXT EXPLORER
                </span>
                <h2>{active?.avatar.name}</h2>
                <p>
                  {myTurn
                    ? 'Your turn — hit the dice block!'
                    : `${active?.avatar.name}'s turn to explore!`}
                </p>
              </div>
              <Sparkle className="announce-spark s1" size={22} />
              <Sparkle className="announce-spark s2" size={14} color="#7cf3ff" />
            </div>
          )}
          {rolling && clock >= game.dice!.revealAt && (
            <div className="roll-callout" role="status" key={game.dice!.startedAt}>
              <b>
                {game.dice!.values.reduce((a, b) => a + b, 0) + game.dice!.bonus}
              </b>
              <span>
                {game.dice!.values.length > 1
                  ? game.dice!.values.join(' + ')
                  : 'spaces'}
                {game.dice!.bonus ? ` + ${game.dice!.bonus} boost` : ''}
              </span>
            </div>
          )}
          {game.phase === 'rolling' && !rolling && (
            <div className="departure-caption" role="status">
              <Ufo /> {active?.avatar.name} is leaving the ship…
            </div>
          )}
          {game.phase === 'moving' && (
            <div className="travel-status">
              <span>{active?.avatar.name} is exploring</span>
              <b>{game.remaining} {game.remaining === 1 ? 'space' : 'spaces'} to go</b>
            </div>
          )}
          {game.phase === 'fork' && (
            <section className="center-panel fork-panel">
              <span className="eyebrow">
                A FORK IN THE ROAD · {game.remaining} {game.remaining === 1 ? 'STEP' : 'STEPS'} LEFT
              </span>
              <h2>Which way, {active?.avatar.name}?</h2>
              <p>Your roll pauses here while you pick a road.</p>
              <div className="fork-options">
                {routeChoices(game).map((to, i) => (
                  <button
                    className="secondary"
                    key={to}
                    disabled={!myTurn || busy}
                    onClick={() => dispatch({ type: 'route', value: to })}
                  >
                    <SpaceIcon kind={BOARD[to].type} size={30} />
                    <span>
                      {getBoard(game.boardId).routeLabels?.[active!.pos]?.[i] ??
                        'Road ' + (i + 1)}
                      <small>Next: {SPACE_INFO[BOARD[to].type].name}</small>
                    </span>
                  </button>
                ))}
              </div>
              <small>
                {myTurn
                  ? 'Choose a road to continue your roll.'
                  : 'Waiting for ' + active?.avatar.name}{' '}
                · Auto-pick in{' '}
                {Math.max(0, Math.ceil((game.due - clock) / 1000))}s
              </small>
            </section>
          )}
          {game.phase === 'lottery' && game.lottery && (
            <Lottery
              game={game}
              mine={!!myTurn}
              busy={busy}
              dispatch={dispatch}
            />
          )}
          {game.phase === 'diamond' && (
            <section
              className="center-panel diamond-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="diamond-title"
            >
              <DiamondIcon className="diamond-symbol" size={72} />
              <span className="eyebrow">
                DIAMOND STOP · SPACE {active!.pos + 1}
              </span>
              <h2 id="diamond-title">Buy a diamond?</h2>
              <p>
                {active?.avatar.name} has {active!.shells} points. A diamond
                costs {RULES.pearlPrice} points.
              </p>
              {myTurn ? (
                <>
                  <button
                    className="primary"
                    disabled={busy || active!.shells < RULES.pearlPrice}
                    onClick={() => dispatch({ type: 'diamond', value: 1 })}
                  >
                    <DiamondIcon size={22} /> Buy for {RULES.pearlPrice} points
                  </button>
                  {active!.shells < RULES.pearlPrice && (
                    <p className="muted">
                      You need {RULES.pearlPrice - active!.shells} more points
                      to buy this diamond.
                    </p>
                  )}
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => dispatch({ type: 'diamond', value: 0 })}
                  >
                    Continue without buying <ArrowRight />
                  </button>
                </>
              ) : (
                <p>Waiting for {active?.avatar.name} to choose…</p>
              )}
              <small>
                {game.remaining
                  ? `${game.remaining} spaces remain in this roll.`
                  : 'This is the last space in your roll.'}
              </small>
            </section>
          )}
          {game.phase === 'steal' && (
            <section
              className="center-panel diamond-panel steal-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="steal-title"
            >
              <NabbitPortrait className="steal-symbol" size={104} />
              <span className="eyebrow">{NABBER.toUpperCase()}’S DEN</span>
              <h2 id="steal-title">“Want me to nab something?”</h2>
              <p>
                Pay {RULES.nabPointsCost} points to steal 5–15 points, or{' '}
                {RULES.nabDiamondCost} points to steal a diamond.{' '}
                {active?.avatar.name} has {active!.shells} points.
              </p>
              {myTurn ? (
                <div className="steal-targets">
                  {game.players
                    .filter((p) => p.id !== active!.id)
                    .map((p) => (
                      <div className="steal-target" key={p.id}>
                        <AlienPortrait shirt={p.avatar.shirt} size={34} />
                        <strong>{p.avatar.name}</strong>
                        <small>
                          <DiamondIcon size={15} /> {p.pearls}{' '}
                          <CoinIcon size={15} /> {p.shells}
                        </small>
                        <button
                          className="secondary"
                          disabled={
                            busy ||
                            p.shells <= 0 ||
                            active!.shells < RULES.nabPointsCost
                          }
                          onClick={() =>
                            dispatch({ type: 'steal', value: 1, target: p.id })
                          }
                        >
                          <CoinIcon size={17} /> Points
                        </button>
                        <button
                          className="primary"
                          disabled={
                            busy ||
                            p.pearls <= 0 ||
                            active!.shells < RULES.nabDiamondCost
                          }
                          onClick={() =>
                            dispatch({ type: 'steal', value: 2, target: p.id })
                          }
                        >
                          <DiamondIcon size={17} /> Diamond
                        </button>
                      </div>
                    ))}
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => dispatch({ type: 'steal', value: 0 })}
                  >
                    No thanks <ArrowRight size={15} />
                  </button>
                </div>
              ) : (
                <p>{active?.avatar.name} is haggling with {NABBER}…</p>
              )}
            </section>
          )}
          {game.phase === 'lastTurns' && game.lastTurns && (
            <section
              className="center-panel last-turns-panel"
              role="status"
              aria-live="polite"
            >
              <span className="eyebrow">THE FINAL STRETCH</span>
              <h2 className="last-turns-title">
                LAST {lastTurnsCount(game.rounds)} TURNS!
              </h2>
              <p>Blue and red spaces now pay double. Here are the standings:</p>
              <ol className="last-turns-standings">
                {[...game.players]
                  .sort((a, b) => b.pearls - a.pearls || b.shells - a.shells)
                  .map((p) => (
                    <li
                      key={p.id}
                      className={
                        game.lastTurns!.trailing.includes(p.id) ? 'trailing' : ''
                      }
                    >
                      <AlienPortrait
                        shirt={p.avatar.shirt}
                        size={34}
                        mood={
                          game.lastTurns!.trailing.includes(p.id)
                            ? 'sad'
                            : 'happy'
                        }
                      />
                      <strong>{p.avatar.name}</strong>
                      <span>
                        <DiamondIcon size={16} /> {p.pearls}{' '}
                        <CoinIcon size={16} /> {p.shells}
                      </span>
                    </li>
                  ))}
              </ol>
              <div className="last-turns-bonus">
                {game.lastTurns.stage === 'standings' ? (
                  <>
                    <Shuffle size={18} /> Spinning a catch-up boost for{' '}
                    {game.lastTurns.trailing
                      .map(
                        (id) =>
                          game.players.find((p) => p.id === id)?.avatar.name,
                      )
                      .join(' & ')}
                    …
                  </>
                ) : (
                  <>
                    <Sparkles size={18} /> {game.log[0]}
                  </>
                )}
              </div>
            </section>
          )}
          {game.phase === 'landed' &&
            game.effect?.kind === 'villain' &&
            game.effect.detail &&
            clock < (game.presentUntil ?? 0) && (
              <div className="villain-banner" role="status" key={game.effect.id}>
                <KlaxonPortrait size={84} className="villain-portrait" />
                <div>
                  <b>{VILLAIN.toUpperCase()} STRIKES!</b>
                  <p>{game.effect.detail}</p>
                </div>
              </div>
            )}
          {game.phase === 'vote' &&
            game.vote &&
            (() => {
              // Minigame vote stage (ui-vote-results.css): team shape up top,
              // three themed key-art cards, live ballots as alien pips.
              const vote = game.vote,
                mode = game.miniMode ?? 'ffa',
                seats = arenaPlayers(game),
                split = mode === '1v3' ? 1 : mode === '2v2' ? 2 : 4,
                decided = vote.winner !== undefined,
                left = Math.max(0, (vote.endsAt - clock) / 1000),
                counts = vote.choices.map(
                  (c) =>
                    game.players.filter((p) => vote.ballots[p.id] === c).length,
                ),
                top = Math.max(...counts),
                leaders = counts.filter((n) => n === top).length,
                mine = vote.ballots[me!.id];
              const side = (list: typeof seats, team: string, tag: string) => (
                <span className={`pv-side ${team}`}>
                  <small>{tag}</small>
                  <span>
                    {list.map((p) => (
                      <span
                        className="pv-seat"
                        key={p.id}
                        style={{ '--player': p.avatar.shirt } as React.CSSProperties}
                      >
                        <AlienPortrait
                          shirt={p.avatar.shirt}
                          avatar={p.avatar}
                          size={40}
                        />
                        <b>{p.id === me?.id ? 'You' : p.avatar.name}</b>
                      </span>
                    ))}
                  </span>
                </span>
              );
              // Hero cut-outs: the solo star (or first team) leaps in from the
              // left, the other side cheers from the bottom right.
              const heroes = split === 4 ? seats.slice(0, 2) : seats.slice(0, split),
                crowd = split === 4 ? seats.slice(2) : seats.slice(split);
              return (
                <section
                  className={
                    'center-panel vote-panel pv-stage' +
                    (decided ? ' is-decided' : '')
                  }
                  aria-labelledby="pv-title"
                >
                  <StageBackdrop />
                  <span className={`pv-cast pv-cast-hero n${heroes.length}`} aria-hidden="true">
                    {heroes.map((p, k) => (
                      <CastCutout
                        key={p.id}
                        avatar={p.avatar}
                        pose={split === 1 ? 'leap' : 'cheer'}
                        style={{ '--k': k } as React.CSSProperties}
                      />
                    ))}
                  </span>
                  <span className={`pv-cast pv-cast-crowd n${crowd.length}`} aria-hidden="true">
                    {crowd.map((p, k) => (
                      <CastCutout
                        key={p.id}
                        avatar={p.avatar}
                        pose="cheer"
                        style={{ '--k': k } as React.CSSProperties}
                      />
                    ))}
                  </span>
                  <header className="pv-head">
                    <div className="pv-heading">
                      <span className="pv-kicker">
                        Round {game.round} · The crew decides
                      </span>
                      <h2
                        id="pv-title"
                        className="pv-title"
                        key={decided ? 'go' : 'vote'}
                        data-text={decided ? 'Let’s play!' : 'Minigame vote!'}
                      >
                        {decided ? 'Let’s play!' : 'Minigame vote!'}
                      </h2>
                      <span className="pv-sparkles" aria-hidden="true">
                        <Sparkle size={30} />
                        <Sparkle size={18} color="#ffffff" />
                        <Sparkle size={22} color="#7affea" />
                      </span>
                    </div>
                    <div
                      className={`pv-teams mode-${mode}`}
                      role="status"
                      aria-label={MODE_LABEL[mode] + ' round'}
                    >
                      <span className="pv-mode">
                        <b>{MODE_SHORT[mode]}</b>
                        <small>{MODE_TITLE[mode]}</small>
                      </span>
                      {split === 4 ? (
                        side(seats, 'team-all', 'Every alien for themselves')
                      ) : (
                        <>
                          {side(
                            seats.slice(0, split),
                            'team-a',
                            split === 1 ? 'Solo' : 'Blue team',
                          )}
                          <em className="pv-vs">VS</em>
                          {side(
                            seats.slice(split),
                            'team-b',
                            split === 1 ? 'Trio' : 'Red team',
                          )}
                        </>
                      )}
                    </div>
                    <TimerRing left={left} total={20} done={decided}>
                      {decided ? <Check /> : Math.ceil(left)}
                    </TimerRing>
                  </header>
                  <div className="pv-cards">
                    {vote.choices.map((index, i) => {
                      const m = MINIGAMES[index],
                        voters = game.players.filter(
                          (p) => vote.ballots[p.id] === index,
                        ),
                        won = vote.winner === index,
                        leading =
                          !decided && top > 0 && leaders === 1 && counts[i] === top,
                        brief =
                          (mode === '1v3' &&
                            (m as { soloBrief?: string }).soloBrief) ||
                          m.brief;
                      return (
                        <button
                          key={index}
                          disabled={busy || decided}
                          // Start the keyboard/pad cursor on the first card.
                          autoFocus={i === 0 && mine === undefined && !decided}
                          className={
                            'pv-card' +
                            (mine === index ? ' is-mine' : '') +
                            (leading ? ' is-leading' : '') +
                            (won ? ' is-winner' : '') +
                            (decided && !won ? ' is-out' : '')
                          }
                          aria-pressed={mine === index}
                          aria-label={`${m.name}: ${voters.length} of ${game.players.length} votes`}
                          onClick={() =>
                            dispatch({
                              type: 'vote',
                              value: index,
                              voteId: vote.id,
                            })
                          }
                          style={themeStyle(m.id, {
                            '--i': i,
                            '--len': Math.max(10, m.name.length),
                          } as React.CSSProperties)}
                        >
                          <CardCrest id={m.id} />
                          <MinigameArt id={m.id} className="pv-art">
                            <span className="pv-mech">
                              <MechanicIcon kind={mechanicOf(m.category)} />
                              {m.category}
                            </span>
                            <span className="pv-time">{m.duration}s</span>
                          </MinigameArt>
                          <span className="pv-plate">
                            <span className="pv-name" data-text={m.name}>
                              {m.name}
                            </span>
                          </span>
                          <span className="pv-brief">{punchy(brief)}</span>
                          <span className="pv-keys">
                            {controlChips(m.controls).map((c) => (
                              <span key={c.keys}>
                                <kbd>{c.keys}</kbd>
                                {c.label}
                              </span>
                            ))}
                          </span>
                          {/* One slot per player in seat order: a ghost of their
                              face until their ballot pops in. */}
                          <span className="pv-ballots">
                            {game.players.map((p) => {
                              const here = vote.ballots[p.id] === index;
                              return (
                                <span
                                  className={'pv-pip' + (here ? ' is-filled' : '')}
                                  key={p.id + (here ? '-in' : '')}
                                  title={p.avatar.name}
                                  style={
                                    {
                                      '--player': p.avatar.shirt,
                                    } as React.CSSProperties
                                  }
                                >
                                  <AlienPortrait
                                    shirt={p.avatar.shirt}
                                    avatar={p.avatar}
                                    size={36}
                                  />
                                </span>
                              );
                            })}
                          </span>
                          <PointerGlove />
                          {mine === index && (
                            <span className="pv-you">Your pick</span>
                          )}
                          {won && (
                            <>
                              <span className="pv-stamp">Selected!</span>
                              <Confetti seed={index + 1} />
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <p className="pv-hint" aria-live="polite">
                    {decided ? (
                      game.log[0]
                    ) : mine !== undefined ? (
                      'Vote locked in! You can switch until the timer runs out.'
                    ) : (
                      <>
                        <kbd>A</kbd> / click a card to vote · Most votes wins,
                        ties are a coin flip
                      </>
                    )}
                  </p>
                </section>
              );
            })()}
          {!game.finale &&
            ['turn', 'landed', 'rolling', 'moving', 'fork'].includes(game.phase) && (
              <div className="hud-shade" aria-hidden="true" />
            )}
          <div
            className="scoreboard"
            style={game.finale ? { display: 'none' } : undefined}
          >
            {game.players.map((p, i) => (
              <div
                className={`player-card ${game.active === i && game.phase !== 'results' && game.phase !== 'finished' ? 'active' : ''} ${p.id === me?.id ? 'is-me' : ''}`}
                key={p.id}
                style={{ '--player': p.avatar.shirt } as React.CSSProperties}
              >
                {game.active === i &&
                  game.phase !== 'results' &&
                  game.phase !== 'finished' && (
                    <span className="player-turn-tag" aria-hidden="true">
                      TURN
                    </span>
                  )}
                <span className="player-portrait">
                  <AlienPortrait
                    shirt={p.avatar.shirt}
                    avatar={p.avatar}
                    size={60}
                    mood={
                      game.effect?.player === p.id &&
                      clock < (game.presentUntil ?? 0) &&
                      game.effect.delta < 0
                        ? 'sad'
                        : 'happy'
                    }
                  />
                  <PlaceBadge
                    className="player-place"
                    size={24}
                    place={
                      game.players.filter(
                        (q) =>
                          q.pearls > p.pearls ||
                          (q.pearls === p.pearls && q.shells > p.shells),
                      ).length + 1
                    }
                  />
                </span>
                <div className="player-info">
                  <strong>
                    {p.avatar.name}
                    {p.color && (
                      <span
                        className={`team-dot team-${p.color}`}
                        title={`${p.color} team this round`}
                      />
                    )}
                  </strong>
                  <small>
                    {room?.seats.find((s) => s.id === p.id)?.away
                      ? 'AWAY · CPU'
                      : p.cpu
                        ? 'CPU'
                        : p.id === me?.id
                          ? 'YOU'
                          : 'PLAYER'}{' '}
                    {p.shield ? '· SHIELDED' : ''}
                    {p.size === 'mini' ? '· TINY' : p.size === 'mega' ? '· GIANT' : ''}
                  </small>
                </div>
                <div className="currency">
                  <span className="cur-gem" title="Diamonds">
                    <DiamondIcon size={22} /> <b>{p.pearls}</b>
                  </span>
                  <span className="cur-coin" title="Points">
                    <CoinIcon size={22} /> <b>{p.shells}</b>
                  </span>
                </div>
                {(() => {
                  const emote = room?.emotes
                    ?.filter((e) => e.seat === p.id && clock - e.at < 3500)
                    .at(-1);
                  return (
                    emote && (
                      <span className="emote-bubble" key={emote.id} aria-label={`${p.avatar.name} reacts ${emote.emoji}`}>
                        {emote.emoji}
                      </span>
                    )
                  );
                })()}
              </div>
            ))}
          </div>
          {session && !game.finale && (
            <div className="emote-bar" aria-label="Send a reaction">
              {EMOTES.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    void request({ type: 'emote', emoji })
                      .then(receive)
                      .catch(() => {});
                  }}
                  title={`React ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
          {(game.phase === 'turn' || game.phase === 'landed') && (
            <>
              <div className="board-dock">
                <div className="board-label">
                  <span className="eyebrow">
                    <small>
                      {getPlanet(getBoard(game.boardId).planet).name.toUpperCase()}
                    </small>
                    {getBoard(game.boardId).name.toUpperCase()}
                  </span>
                  <span className="goal-chip" title="Diamond price and goal">
                    <DiamondIcon size={20} /> {RULES.pearlPrice} pts ·{' '}
                    {game.diamondGoal
                      ? `first to ${game.diamondGoal}`
                      : `round ${game.round} of ${game.rounds}`}
                  </span>
                  <span className="bank-pot" title="Shared bank">
                    <CoinIcon size={20} /> Bank {game.bank ?? 0}
                  </span>
                  {(() => {
                    const board = getBoard(game.boardId),
                      open = game.routesOpen !== false;
                    const label =
                      board.gimmick === 'tide'
                        ? open
                          ? 'Low tide · bridge open'
                          : 'High tide · bridge flooded'
                        : board.gimmick === 'ferry'
                          ? open
                            ? 'Ferry docked'
                            : 'Ferry away'
                          : board.gimmick === 'eruption'
                            ? open
                              ? 'Lava bridge open'
                              : 'Eruption · bridge shut'
                            : 'Jump pads active';
                    return (
                      <span
                        className={`gimmick-tag ${open ? 'open' : 'closed'}`}
                        title={board.gimmickRule}
                      >
                        <GimmickIcon kind={board.gimmick} open={open} size={20} />
                        {label}
                      </span>
                    );
                  })()}
                  {game.lastTurns && (
                    <span className="last-turns-tag">
                      LAST {lastTurnsCount(game.rounds)} TURNS · ×2 spaces
                    </span>
                  )}
                </div>
                <div className="activity">
                  <span className="eyebrow">LATEST</span>
                  {game.log.slice(0, 1).map((line) => (
                    <p key={line} className="new">
                      {line}
                    </p>
                  ))}
                </div>
              </div>
              <section
                className={`turn-panel ${myTurn && game.phase === 'turn' ? 'roll-ready' : ''} ${myTurn ? '' : 'waiting'}`}
                style={
                  active
                    ? ({ '--player': active.avatar.shirt } as React.CSSProperties)
                    : undefined
                }
              >
                <div className="turn-title">
                  <span className="dice-face">
                    {active && (
                      <AlienPortrait
                        shirt={active.avatar.shirt}
                        avatar={active.avatar}
                        size={72}
                      />
                    )}
                    {game.phase === 'landed' && (
                      <b className="last-roll">{game.lastRoll}</b>
                    )}
                  </span>
                  <div>
                    <span className="eyebrow">
                      {myTurn
                        ? 'YOUR TURN'
                        : active?.cpu
                          ? 'CPU TURN'
                          : 'FRIEND’S TURN'}
                    </span>
                    <h2>{active?.avatar.name}</h2>
                  </div>
                </div>
                {myTurn ? (
                  <>
                    {game.phase === 'turn' ? (
                      <>
                        <button
                          className="primary roll-button"
                          disabled={busy || !!announcing}
                          onClick={() =>
                            dispatch({
                              type: 'roll',
                            })
                          }
                        >
                          <DiceCube size={66} />
                          <span className="roll-copy">
                            <b>ROLL!</b>
                            <small>Hit the dice block</small>
                          </span>
                          <span className="roll-key">SPACE</span>
                        </button>
                        <div className="inventory" aria-label="Your bag">
                          <span className="inventory-label">
                            BAG
                            <small>Use before rolling</small>
                          </span>
                          {!!me?.lotteryBoosts && (
                            <button
                              className="bag-slot"
                              disabled={busy || me.used}
                              title="Add 5 to your next roll. Kept separately from your bag."
                              onClick={() =>
                                dispatch({ type: 'use', item: 'five' })
                              }
                            >
                              <ItemIcon id="five" size={34} />
                              <span className="bag-name">Lucky +5</span>
                              <b className="bag-count">×{me.lotteryBoosts}</b>
                            </button>
                          )}
                          {me?.items.map((id, i) => (
                            <button
                              className="bag-slot"
                              key={i}
                              disabled={busy || me.used}
                              title={
                                ITEMS.find((x) => x.id === id)?.description
                              }
                              onClick={() =>
                                dispatch({ type: 'use', item: id })
                              }
                            >
                              <ItemIcon id={id} size={34} />
                              <span className="bag-name">
                                {ITEMS.find((x) => x.id === id)?.name}
                              </span>
                            </button>
                          ))}
                          {Array.from(
                            {
                              length: Math.max(
                                0,
                                RULES.inventorySize - (me?.items.length ?? 0),
                              ),
                            },
                            (_, i) => (
                              <span
                                className="bag-slot empty"
                                key={'empty' + i}
                                title="Empty slot · visit a shop to fill it"
                              >
                                <span className="bag-name">Empty</span>
                              </span>
                            ),
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="landing">
                          <SpaceIcon kind={BOARD[active!.pos].type} size={24} />
                          {SPACE_INFO[BOARD[active!.pos].type].name}
                        </p>
                        {BOARD[active!.pos].type === 'shop' && !game.bought && (
                          <div className="shop">
                            {(
                              game.shopStock ??
                              ITEMS.slice(0, 5).map((i) => i.id)
                            )
                              .map((id) => ITEMS.find((i) => i.id === id)!)
                              .filter(Boolean)
                              .map((item) => (
                                <button
                                  disabled={
                                    busy ||
                                    me!.shells < item.cost ||
                                    me!.items.length >= 3
                                  }
                                  key={item.id}
                                  title={item.description}
                                  onClick={() =>
                                    dispatch({ type: 'buy', item: item.id })
                                  }
                                >
                                  <ItemIcon id={item.id} size={30} />
                                  <span>{item.name}</span>
                                  <b>
                                    {item.cost} <CoinIcon size={15} />
                                  </b>
                                </button>
                              ))}
                          </div>
                        )}
                        <button
                          className="primary"
                          disabled={busy || clock < (game.presentUntil ?? 0)}
                          onClick={() => dispatch({ type: 'end' })}
                        >
                          {clock < (game.presentUntil ?? 0)
                            ? 'Landing…'
                            : 'End turn'}{' '}
                          <ArrowRight />
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <p className="muted">
                    {active?.cpu
                      ? 'Planning a little planetary mischief…'
                      : 'Waiting for your friend’s move…'}
                  </p>
                )}
              </section>
              <div className="map-controls">
                <button
                  className="icon-button"
                  title="Reset camera"
                  onClick={() => setView((v) => v + 1)}
                >
                  <RotateCcw />
                </button>
                {game.round <= 1 && <span>Drag to explore · Scroll to zoom</span>}
              </div>
            </>
          )}
          {game.effect &&
            clock < (game.presentUntil ?? 0) &&
            ['event', 'bank'].includes(game.effect.kind) &&
            !game.finale && (
              <section
                className="event-readout"
                aria-live="polite"
                aria-atomic="true"
              >
                <h3>
                  {game.effect.kind === 'bank'
                    ? `Jackpot! +${game.effect.delta} points`
                    : getBoard(game.boardId).globalEvent.name}
                </h3>
                {game.effect.losses && (
                  <div className="event-losses">
                    {game.effect.losses.map((l) => (
                      <span key={l.player}>
                        {
                          game.players.find((p) => p.id === l.player)?.avatar
                            .name
                        }
                        <b>{l.delta}</b>
                      </span>
                    ))}
                  </div>
                )}
                <p>
                  {game.effect.kind === 'bank'
                    ? 'The entire bank is yours.'
                    : 'Closer to the landmark means a larger loss · Maximum 20 · Bank unchanged'}
                </p>
              </section>
            )}
          {game.finale && <FinaleStandings players={game.players} />}
          {game.finale &&
            ((clock - game.finale.startedAt < 11000 &&
              game.finale.reason === 'goal') ||
              (game.phase === 'bonus' &&
                clock - game.finale.startedAt < 14500)) && (
              <div className="finale-caption">
                <span className="eyebrow">
                  {game.finale.reason === 'goal'
                    ? 'CHEERS TO THE CHAMPION'
                    : 'ALL ABOARD'}
                </span>
                <h2>
                  {game.finale.reason === 'goal'
                    ? `${game.players.find((p) => p.id === game.finale?.winner)?.avatar.name} wins!`
                    : 'Next stop: the party lounge.'}
                </h2>
                <p>
                  {game.finale.reason === 'goal'
                    ? 'One small sip. One giant victory dance.'
                    : 'Three bonus diamonds are waiting inside.'}
                </p>
              </div>
            )}
          {game.phase === 'bonus' &&
            clock - game.finale!.startedAt >= 14500 && (
              <section className="bonus-panel" aria-live="polite">
                <span className="eyebrow">SHIP LOUNGE</span>
                <h2>Bonus diamonds</h2>
                {game.bonuses?.map((b) => (
                  <div
                    className={'bonus-award ' + (!b.awarded ? 'pending' : '')}
                    key={b.label}
                  >
                    <b>
                      {b.label} {b.awarded ? '◆' : '◇'}
                    </b>
                    <span>
                      {b.awarded
                        ? b.winners.length
                          ? b.winners
                              .map(
                                (id) =>
                                  game.players.find((p) => p.id === id)?.avatar
                                    .name,
                              )
                              .join(' & ') + ` · +1 diamond (${b.value})`
                          : 'No qualifying landings'
                        : 'Award coming up…'}
                    </span>
                  </div>
                ))}
                <p>
                  Tied leaders each receive a diamond. Empty landing categories
                  award none.
                </p>
              </section>
            )}
          {(game.phase === 'results' ||
            (game.phase === 'finished' &&
              (!game.finale || clock - game.finale.startedAt >= 11000))) && (
            <section
              className={
                'center-panel results-panel pr-stage ' +
                (game.finale ? 'finale-results' : '')
              }
              style={themeStyle(game.phase === 'finished' ? '' : mini.id)}
            >
              {/* Results stage (ui-vote-results.css): key-art header, podium rows. */}
              <StageBackdrop />
              {!game.finale &&
                (() => {
                  // The minigame's top two celebrate either side of the card.
                  const podium = [...game.players].sort((a, b) => b.score - a.score);
                  return (
                    <>
                      <CastCutout
                        className="pr-cast pr-cast-left"
                        avatar={podium[0].avatar}
                        pose="leap"
                      />
                      {podium[1] && (
                        <CastCutout
                          className="pr-cast pr-cast-right"
                          avatar={podium[1].avatar}
                          pose="cheer"
                        />
                      )}
                    </>
                  );
                })()}
              <div className="pr-card">
              {game.phase === 'finished' ? (
                <span className="mg-art pr-hero pr-hero-champion" aria-hidden="true">
                  {/* Finale header: the champion's rendered portrait under a spotlight. */}
                  <span className="pr-champ-rays" />
                  <AlienPortrait
                    className="pr-champ-face"
                    shirt={championOf(game).avatar.shirt}
                    avatar={championOf(game).avatar}
                    mood="happy"
                    size={118}
                  />
                  <CrownIcon className="pr-champ-crown" size={46} />
                  <span className="pr-badge">Planet champion</span>
                </span>
              ) : (
                <MinigameArt id={mini.id} className="pr-hero">
                  <span className="pr-badge">Minigame results</span>
                </MinigameArt>
              )}
              <h2
                className={'pr-title' + (game.phase === 'finished' ? ' pr-title-champion' : '')}
                data-text={
                  game.phase === 'finished'
                    ? `${championOf(game).avatar.name} wins!`
                    : mini.name
                }
              >
                {game.phase === 'finished'
                  ? `${championOf(game).avatar.name} wins!`
                  : mini.name}
              </h2>
              <ol className="pr-list">
                {[...game.players]
                  .sort((a, b) =>
                    game.phase === 'finished'
                      ? b.pearls - a.pearls || b.shells - a.shells
                      : b.score - a.score,
                  )
                  .map((p, i) => {
                    const rank =
                      game.players.filter((q) =>
                        game.phase === 'finished'
                          ? q.pearls > p.pearls ||
                            (q.pearls === p.pearls && q.shells > p.shells)
                          : q.score > p.score,
                      ).length + 1;
                    return (
                      <li
                        key={p.id}
                        className={'pr-row' + (rank === 1 ? ' is-first' : '')}
                        style={
                          {
                            '--i': i,
                            '--player': p.avatar.shirt,
                          } as React.CSSProperties
                        }
                      >
                        <PlaceBadge className="pr-place" place={rank} size={38} />
                        <AlienPortrait
                          className="pr-face"
                          shirt={p.avatar.shirt}
                          avatar={p.avatar}
                          size={46}
                          mood={rank === 1 ? 'happy' : rank === 4 ? 'sad' : 'neutral'}
                        />
                        {rank === 1 && <CrownIcon className="pr-crown" size={30} />}
                        <span className="pr-who">
                          <b>{p.avatar.name}</b>
                          <small>
                            {p.cpu ? 'CPU' : p.id === me?.id ? 'You' : 'Player'}
                            {' · '}
                            {game.phase === 'finished'
                              ? `${p.shells} points`
                              : game.arcade?.mode
                                ? p.prize === RULES.teamTie
                                  ? 'Tie'
                                  : p.prize
                                    ? 'Win'
                                    : 'Loss'
                                : scoreLabel(game.mini, p.score)}
                          </small>
                        </span>
                        <span className="pr-prize">
                          {game.phase === 'finished' ? (
                            <b>
                              <DiamondIcon size={20} /> {p.pearls}
                            </b>
                          ) : (
                            <b>
                              <CoinIcon size={20} /> +
                              {p.prize ?? RULES.minigameReward[rank - 1]}
                            </b>
                          )}
                        </span>
                      </li>
                    );
                  })}
              </ol>
              <Confetti count={34} seed={game.round + 3} />
              <div className="pr-actions">
              {game.practice ? (
                <div className="practice-results-actions">
                  <button
                    className="primary"
                    onClick={() => practice(game.mini)}
                  >
                    <RotateCcw /> Play again
                  </button>
                  <button
                    className="secondary"
                    onClick={() => {
                      setGame(null);
                      setPanel('arcade');
                    }}
                  >
                    Choose another game
                  </button>
                </div>
              ) : game.phase === 'finished' ? (
                <button
                  className="primary"
                  onClick={() => {
                    setGame(null);
                    if (session) disconnect();
                    else setPanel('menu');
                  }}
                >
                  Back to the planets <Home />
                </button>
              ) : !session || session.id === room?.host ? (
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => dispatch({ type: 'next' })}
                >
                  {game.practice
                    ? 'Finish practice'
                    : game.round === game.rounds
                      ? 'Board ship for bonus diamonds'
                      : 'Next round'}{' '}
                  <ArrowRight />
                </button>
              ) : (
                <p className="pr-wait">
                  Waiting for the host · Automatically continues in{' '}
                  {Math.max(0, Math.ceil((game.due - clock) / 1000))} seconds
                </p>
              )}
              </div>
              </div>
            </section>
          )}
        </>
      )}
      {isMini && (
        <ArcadeGame
          key={game.seed + ':' + game.mini + ':' + game.round}
          game={game}
          meId={me!.id}
          online={!!session}
          clock={clock}
          low={low}
          reduced={reduced}
          muted={muted}
          onMute={() => setMuted((v) => !v)}
          onReady={() => dispatch({ type: 'ready' })}
          onFinish={(scores) => dispatch({ type: 'arcadeResult', scores })}
          onControl={async (control: Control) => {
            if (!session) return;
            try {
              receive(
                await request({
                  type: 'action',
                  action: {
                    type: 'control',
                    control,
                    miniStart: gameRef.current?.miniStart,
                  },
                }),
              );
            } catch (e) {
              setNotice((e as Error).message);
            }
          }}
          onExit={(arena) => {
            if (game.practice) {
              setGame(null);
              setPanel('arcade');
            } else {
              if (!session) setGame((g) => (g ? { ...g, arcade: arena } : g));
              setPanel('menu');
            }
          }}
        />
      )}
      {notice && (
        <div className="toast" role="status">
          <span>{notice}</span>
          <button aria-label="Dismiss message" onClick={() => setNotice('')}>
            <X size={16} />
          </button>
        </div>
      )}
    </main>
  );
}
