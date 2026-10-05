'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Flag,
  Pause,
  Play,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { AlienPortrait } from '../art';
import { Game, arenaFor, arenaPlayers } from '../engine';
import { scoreLabel, arcadeInfo } from './catalog';
import { remixInfo } from './remix-catalog';
import { remixReadout } from './remix';
import { overhaulReadout } from './overhaul';
import { grandInfo } from './grand-catalog';
import { grandReadout } from './grand';
import { playSfx } from '../audio';
import {
  Arena,
  Control,
  advanceArena,
  createArena,
  setControl,
  stepArena,
} from './simulation';
import { createRenderer } from './renderer';
import { connectedGamepad, readPad } from '../gamepad';
type Props = {
  game: Game;
  meId: string;
  online: boolean;
  clock: number;
  low: boolean;
  reduced: boolean;
  muted: boolean;
  onReady: () => void;
  onFinish: (scores: number[]) => void;
  onControl: (c: Control) => Promise<void>;
  onExit: (arena: Arena) => void;
  onMute: () => void;
};
/** Screenshot capture (game/shot.ts) starts mid-game without the resume pause. */
const shotMode = () =>
  typeof document !== 'undefined' &&
  document.documentElement.classList.contains('shot-mode');
export default function ArcadeGame(props: Props) {
  const info = arcadeInfo(props.game.mini),
    root = useRef<HTMLDivElement>(null),
    latest = useRef(props);
  latest.current = props;
  // Arena seats can be regrouped into teams, so never index board turn order.
  const seats = arenaPlayers(props.game);
  const world = useRef<Arena>(
    structuredClone(
      props.game.arcade ?? arenaFor(props.game, props.game.mini, props.game.seed),
    ),
  );
  const [hud, setHud] = useState(() => structuredClone(world.current)),
    [paused, setPaused] = useState(
      !props.online && (props.game.arcade?.time ?? 0) > 0 && !shotMode(),
    ),
    [error, setError] = useState(''),
    [connectedPad, setConnectedPad] = useState(false);
  const accepting = useRef(false),
    pausedRef = useRef(!props.online && (props.game.arcade?.time ?? 0) > 0 && !shotMode()),
    keys = useRef(new Set<string>()),
    touch = useRef({ x: 0, z: 0, a: false, b: false }),
    pointer = useRef<{ x: number; z: number } | null>(null),
    pointerHeld = useRef(false),
    renderRef = useRef<ReturnType<typeof createRenderer> | null>(null),
    audio = useRef<AudioContext | null>(null),
    sequence = useRef(Date.now()),
    completed = useRef(false),
    networkBusy = useRef(false);
  const resumedActor = world.current.actors.find((a) => a.id === props.meId);
  const edges = useRef({
    ap: Math.max(resumedActor?.seenAP ?? 0, resumedActor?.input.ap ?? 0),
    bp: Math.max(resumedActor?.seenBP ?? 0, resumedActor?.input.bp ?? 0),
    ar: Math.max(resumedActor?.seenAR ?? 0, resumedActor?.input.ar ?? 0),
  });
  const clockSample = useRef({ time: props.clock, mono: performance.now() });
  if (clockSample.current.time !== props.clock)
    clockSample.current = { time: props.clock, mono: performance.now() };
  const ready = props.game.miniReady?.includes(props.meId) ?? false,
    countdown = Math.max(
      0,
      Math.ceil((props.game.miniStart - props.clock) / 1000),
    );
  function tone(
    f: number,
    duration = 0.12,
    volume = 0.035,
    type: OscillatorType = 'sine',
  ) {
    if (latest.current.muted) return;
    try {
      const ctx = audio.current ?? new AudioContext();
      audio.current = ctx;
      void ctx.resume();
      const osc = ctx.createOscillator(),
        gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(
        f * 0.9,
        ctx.currentTime + duration,
      );
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {}
  }
  function pause() {
    if (latest.current.online) return;
    setPaused((v) => {
      pausedRef.current = !v;
      keys.current.clear();
      touch.current = { x: 0, z: 0, a: false, b: false };
      return !v;
    });
  }
  function start() {
    tone(659);
    keys.current.clear();
    props.onReady();
  }
  function leave() {
    props.onExit(structuredClone(world.current));
  }
  useEffect(() => {
    function down(e: KeyboardEvent) {
      if ((e.target as HTMLElement)?.matches('input,textarea,[role=combobox]'))
        return;
      if (e.code === 'Escape') {
        e.preventDefault();
        pause();
        return;
      }
      if (!accepting.current) return;
      if (
        [
          'Space',
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
          'KeyW',
          'KeyA',
          'KeyS',
          'KeyD',
          'KeyE',
          'ShiftLeft',
          'ShiftRight',
        ].includes(e.code)
      ) {
        e.preventDefault();
        if (!keys.current.has(e.code)) {
          if (e.code === 'Space') edges.current.ap++;
          if (
            ['KeyE', 'ShiftLeft', 'ShiftRight'].includes(e.code) ||
            (info.id === 'race' && ['ArrowUp', 'KeyW'].includes(e.code))
          )
            edges.current.bp++;
        }
        keys.current.add(e.code);
      }
    }
    function up(e: KeyboardEvent) {
      if (accepting.current && e.code === 'Space' && keys.current.has(e.code))
        edges.current.ar++;
      keys.current.delete(e.code);
    }
    function blur() {
      keys.current.clear();
      touch.current = { x: 0, z: 0, a: false, b: false };
      pointer.current = null;
      if (!latest.current.online) {
        pausedRef.current = true;
        setPaused(true);
      }
    }
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);
  useEffect(() => {
    if (!root.current) return;
    let view: ReturnType<typeof createRenderer>;
    try {
      view = createRenderer(
        root.current,
        arenaPlayers(props.game),
        info.id,
        props.low,
        props.game.boardId,
      );
      renderRef.current = view;
    } catch (e) {
      setError(`3D rendering could not start: ${(e as Error).message}`);
      return;
    }
    let raf = 0,
      last = performance.now(),
      acc = 0,
      lastHud = 0,
      lastSend = 0,
      lastControlKey = '',
      finishTime = 0,
      lastServer: unknown = null,
      jumps = 0,
      gear = 1,
      lastFlash = 0,
      lastExplosion = 0,
      lastPassAt = -2,
      wasPadA = false,
      wasPadB = false,
      wasPadStart = false,
      padArmed = false;
    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const p = latest.current;
      const game = p.game;
      let w = world.current;
      const liveClock =
        clockSample.current.time + (now - clockSample.current.mono);
      const waiting =
        !game.miniReady?.includes(p.meId) || liveClock < game.miniStart;
      const pad = connectedGamepad(),
        padInput = readPad(pad);
      if (document.hasFocus() && padInput.start && !wasPadStart) {
        if (!game.miniReady?.includes(p.meId)) p.onReady();
        else if (!waiting) {
          if (p.online) p.onExit(structuredClone(w));
          else pause();
        }
      }
      wasPadStart = padInput.start;
      accepting.current =
        !waiting &&
        !pausedRef.current &&
        !completed.current &&
        // Screenshot capture (game/shot.ts) runs unfocused in headless Chrome.
        (document.hasFocus() ||
          document.documentElement.classList.contains('shot-mode'));
      if (!accepting.current) padArmed = false;
      else if (!padInput.a && !padInput.b) padArmed = true;
      const c: Control = {
        x:
          (keys.current.has('KeyD') || keys.current.has('ArrowRight') ? 1 : 0) -
          (keys.current.has('KeyA') || keys.current.has('ArrowLeft') ? 1 : 0) +
          touch.current.x,
        z:
          (keys.current.has('KeyS') || keys.current.has('ArrowDown') ? 1 : 0) -
          (keys.current.has('KeyW') || keys.current.has('ArrowUp') ? 1 : 0) +
          touch.current.z,
        a: keys.current.has('Space') || touch.current.a,
        b:
          keys.current.has('KeyE') ||
          keys.current.has('ShiftLeft') ||
          keys.current.has('ShiftRight') ||
          touch.current.b,
        seq: ++sequence.current,
      };
      if (
        info.id === 'race' &&
        (keys.current.has('ArrowUp') || keys.current.has('KeyW'))
      )
        c.b = true;
      if (pad) {
        if (padInput.x) c.x = padInput.x;
        if (padInput.z) c.z = padInput.z;
        c.a ||= padArmed && padInput.a;
        c.b ||= padArmed && padInput.b;
      }
      {
        const a = padArmed && padInput.a,
          b = padArmed && padInput.b;
        if (a && !wasPadA) edges.current.ap++;
        if (!a && wasPadA) edges.current.ar++;
        if (b && !wasPadB) edges.current.bp++;
        wasPadA = a;
        wasPadB = b;
      }
      c.ap = edges.current.ap;
      c.bp = edges.current.bp;
      c.ar = edges.current.ar;
      const actor = w.actors.find((a) => a.id === p.meId) ?? w.actors[0];
      if (pointer.current && pointerHeld.current) {
        const dx = pointer.current.x - actor.x,
          dz = pointer.current.z - actor.z,
          d = Math.hypot(dx, dz);
        c.x = d > 0.2 ? dx / Math.max(1, d) : 0;
        c.z = d > 0.2 ? dz / Math.max(1, d) : 0;
      }
      c.x = Math.max(-1, Math.min(1, c.x));
      c.z = Math.max(-1, Math.min(1, c.z));
      if (p.online && game.arcade && lastServer !== game.arcade) {
        lastServer = game.arcade;
        w = structuredClone(game.arcade);
        world.current = w;
        const mine = w.actors.find((a) => a.id === p.meId);
        sequence.current = Math.max(sequence.current, mine?.input.seq ?? 0);
        for (const k of ['ap', 'bp', 'ar'] as const)
          edges.current[k] = Math.max(edges.current[k], mine?.input[k] ?? 0);
        c.seq = ++sequence.current;
        c.ap = edges.current.ap;
        c.bp = edges.current.bp;
        c.ar = edges.current.ar;
      }
      if (!accepting.current) {
        const current = w.actors.find((a) => a.id === p.meId)!;
        edges.current = {
          ap: current.seenAP,
          bp: current.seenBP,
          ar: current.seenAR,
        };
      }
      if (accepting.current) {
        setControl(w, p.meId, c);
        if (p.online) {
          advanceArena(
            w,
            Math.min(
              w.time + 0.5,
              Math.max(0, (liveClock - game.miniStart) / 1000),
            ),
          );
          const controlKey = [
              Math.round(c.x * 20),
              Math.round(c.z * 20),
              Number(c.a),
              Number(c.b),
              c.ap,
              c.bp,
              c.ar,
            ].join(':'),
            activeControl =
              Math.abs(c.x) > 0.01 || Math.abs(c.z) > 0.01 || c.a || c.b,
            sendDue =
              controlKey !== lastControlKey ||
              (activeControl && now - lastSend > 300);
          if (sendDue && now - lastSend > 75 && !networkBusy.current) {
            lastSend = now;
            lastControlKey = controlKey;
            networkBusy.current = true;
            void p.onControl(c).finally(() => (networkBusy.current = false));
          }
        } else {
          acc += dt;
          while (acc >= 1 / 60 && !w.done) {
            stepArena(w);
            acc -= 1 / 60;
          }
          if (w.done) acc = 0;
        }
        const me = w.actors.find((a) => a.id === p.meId)!;
        if (me.jumps > jumps) {
          jumps = me.jumps;
          tone(460, 0.14, 0.04, 'triangle');
        }
        if (me.gear > gear) {
          if (info.id === 'race')
            tone(me.flash ? 880 : 240, 0.16, 0.045, 'triangle');
          else
            playSfx(
              info.id === 'dig'
                ? 'dig'
                : info.id === 'paint'
                  ? 'stamp'
                  : 'pass',
              0,
              p.muted,
            );
        }
        gear = me.gear;
        if (info.id === 'bomb' && w.extra) {
          if (w.extra.explosions > lastExplosion) playSfx('hazard', 0, p.muted);
          else if (w.extra.passAt > lastPassAt) playSfx('pass', 0, p.muted);
          lastExplosion = w.extra.explosions;
          lastPassAt = w.extra.passAt;
        }
        if (me.flash > 0.5 && lastFlash < 0.5)
          tone(100, 0.22, 0.06, 'sawtooth');
        lastFlash = me.flash;
        if (w.done && !p.online) {
          if (!finishTime) {
            finishTime = now;
            tone(1046, 0.45, 0.05);
          }
          if (now - finishTime > 1600) {
            completed.current = true;
            p.onFinish(w.actors.map((a) => a.score));
          }
        }
      }
      view.draw(w, p.meId, dt, p.reduced);
      if (now - lastHud > 100) {
        lastHud = now;
        setHud(structuredClone(w));
        setConnectedPad(!!pad);
      }
    }
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      view.dispose();
      renderRef.current = null;
      void audio.current?.close();
      audio.current = null;
    };
  }, [props.game.seed, props.game.mini, props.game.boardId, props.low]);
  const me = hud.actors.find((p) => p.id === props.meId) ?? hud.actors[0],
    // Some 1 vs 3 games give the solo alien different controls.
    role =
      hud.mode === '1v3'
        ? remixInfo(info.id)?.roles?.[me.team === 0 ? 'solo' : 'team']
        : undefined,
    controls = role?.controls ?? info.controls,
    actionLabel = role?.action ?? info.action,
    tip = role?.tip ?? info.tip,
    mates = hud.actors
      .filter((a) => a.team === me.team && a.id !== me.id)
      .map((a) => seats.find((p) => p.id === a.id)?.avatar.name ?? '?'),
    alive = hud.actors.filter((p) => p.alive).length;
  const team = hud.teams[me.team];
  const grand = remixInfo(info.id) ?? grandInfo(info.id),
    readout = hud.overhaul
      ? overhaulReadout(hud, props.meId)
      : hud.remix
        ? remixReadout(hud, props.meId)
        : hud.grand
          ? grandReadout(hud, props.meId)
          : null;
  // ── HUD presentation (corner plates, timer, banner) ──────────────────────
  const PLAYER_HUES = ['#ffbf1f', '#ff4f86', '#25a8ff', '#9a62ff'],
    timeLeft = Math.max(0, Math.ceil(hud.duration - hud.time)),
    timeFrac = hud.duration > 0 ? Math.min(1, Math.max(0, (hud.duration - hud.time) / hud.duration)) : 0;
  function plateText(a: Arena['actors'][number]): string {
    if (!a.alive) return 'OUT';
    if (grand || hud.overhaul) return scoreLabel(props.game.mini, a.score);
    switch (info.id) {
      case 'race':
        return `${Math.min(100, Math.floor((a.distance / 620) * 100))}% GEAR ${a.gear}`;
      case 'duos':
        return a.team === 0 ? 'TEAM SUN' : 'TEAM MOON';
      case 'rope':
        return '♥'.repeat(a.lives) || 'OUT';
      case 'sky':
        return `${a.checkpoint + 1}/16 ISLAND`;
      case 'bomb':
        return hud.actors[hud.extra!.holder].id === a.id ? 'HAS THE MORSEL' : 'RUN!';
      case 'paint':
        return `${a.score} TILES`;
      case 'dig':
        return `${a.score} RELICS`;
      case 'skate':
        return `${a.gear}/4 LAPS`;
      case 'factory':
        return `${hud.extra!.orders[a.team]} ORDERS`;
      default:
        return 'IN PLAY';
    }
  }
  /** Split a plate readout into a big stat and a small label. */
  function plateStat(a: Arena['actors'][number]): [string, string] {
    const text = plateText(a),
      m = /^([+-]?[\d.,:/]+%?|♥+)\s*[·-]?\s*(.*)$/.exec(text);
    return m ? [m[1], m[2]] : ['', text];
  }
  /** Turn "BIG · detail" callout strings into a banner with a highlighted lead. */
  function bannerText(text: string) {
    const [lead, ...rest] = text.split(' · ');
    return rest.length ? (
      <>
        <em>{lead}</em>
        <span>{rest.join(' · ')}</span>
      </>
    ) : (
      <span>{text}</span>
    );
  }
  const corners = ['tl', 'tr', 'bl', 'br'];
  function pointerPosition(e: React.PointerEvent) {
    const point = renderRef.current?.groundPoint(e.clientX, e.clientY);
    if (point) pointer.current = point;
  }
  function stick(e: React.PointerEvent<HTMLDivElement>) {
    const b = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - b.left - b.width / 2) / 32,
      z = (e.clientY - b.top - b.height / 2) / 32,
      l = Math.max(1, Math.hypot(x, z));
    touch.current.x = x / l;
    touch.current.z = z / l;
  }
  return (
    <section
      className={`arcade-full mg-hud arena-${info.id}`}
      aria-label={info.name}
    >
      <div
        className="arcade-world"
        ref={root}
        onPointerDown={(e) => {
          if (info.id === 'rope' || info.id === 'race') return;
          pointerHeld.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          pointerPosition(e);
        }}
        onPointerMove={(e) => {
          if (pointerHeld.current) pointerPosition(e);
        }}
        onPointerUp={() => {
          pointerHeld.current = false;
          pointer.current = null;
        }}
        onPointerCancel={() => {
          pointerHeld.current = false;
          pointer.current = null;
        }}
      />
      {(info.id === 'race' || info.id === 'duos') && (
        <div
          className={`split-views ${info.id === 'race' ? 'four-views' : 'two-views'}`}
          aria-hidden="true"
        >
          {(info.id === 'race'
            ? hud.actors
            : [hud.actors[0], hud.actors[2]]
          ).map((a, i) => (
            <div key={a.id}>
              <span>
                {info.id === 'race'
                  ? `P${i + 1}${a.id === props.meId ? ' · YOU' : ''}`
                  : `${i ? 'MOON' : 'SUN'} · P${i * 2 + 1} + P${i * 2 + 2}`}
              </span>
            </div>
          ))}
        </div>
      )}
      <header className="mg-top">
        <button
          className="mg-round-btn"
          title={props.online ? 'Leave minigame view' : 'Pause game'}
          aria-label={props.online ? 'Leave minigame view' : 'Pause game'}
          onClick={props.online ? leave : pause}
        >
          {props.online ? <ArrowLeft /> : <Pause />}
        </button>
        <div
          className={`mg-timer${timeLeft <= 10 ? ' is-low' : ''}`}
          role="timer"
          aria-label={`${timeLeft} seconds left`}
        >
          <i className="mg-timer-knob" aria-hidden="true" />
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle className="mg-timer-face" cx="50" cy="50" r="46" />
            <circle
              className="mg-timer-fill"
              cx="50"
              cy="50"
              r="38"
              pathLength={100}
              strokeDasharray={`${(timeFrac * 100).toFixed(2)} 100`}
            />
          </svg>
          <b key={timeLeft <= 10 ? timeLeft : 'steady'}>{timeLeft}</b>
        </div>
        <button
          className="mg-round-btn"
          title="Toggle sound"
          aria-label="Toggle sound"
          onClick={props.onMute}
        >
          {props.muted ? <VolumeX /> : <Volume2 />}
        </button>
        <div className="mg-title">
          <h1>{info.name}</h1>
          <span>
            {props.game.practice ? 'ARCADE' : `ROUND ${props.game.round}`}
          </span>
        </div>
      </header>
      <div className="mg-plates">
        {hud.actors.map((a, i) => {
          const [big, small] = plateStat(a),
            you = a.id === props.meId;
          return (
            <div
              key={a.id}
              className={`mg-plate mg-${corners[i] ?? 'tl'}${!a.alive ? ' is-out' : ''}${you ? ' is-you' : ''}`}
              style={{ '--pc': PLAYER_HUES[i % 4] } as React.CSSProperties}
            >
              <span className="mg-medal">
                <AlienPortrait
                  shirt={seats[i]?.avatar.shirt ?? PLAYER_HUES[i % 4]}
                  size={60}
                  mood={a.alive ? 'happy' : 'sad'}
                />
                <i>P{i + 1}</i>
              </span>
              <div className="mg-plate-body">
                <b className="mg-name">
                  {seats[i]?.avatar.name ?? `Player ${i + 1}`}
                </b>
                <strong className={`mg-stat${big ? '' : ' is-word'}`}>
                  {big && <span>{big}</span>}
                  {small && <small>{small}</small>}
                </strong>
              </div>
              {you && <em className="mg-you">YOU</em>}
            </div>
          );
        })}
      </div>
      {info.id === 'sky' && (
        <div className="mg-track" aria-hidden="true">
          <div className="mg-track-rail">
            <i
              className="mg-track-done"
              style={{ width: `${(me.checkpoint / 15) * 100}%` }}
            />
            {Array.from({ length: 16 }, (_, k) => (
              <span
                key={k}
                className={k === 15 ? 'is-goal' : k <= me.checkpoint ? 'is-hit' : ''}
                style={{ left: `${(k / 15) * 100}%` }}
              />
            ))}
            <Flag className="mg-track-flag" />
          </div>
          {hud.actors.map((a, i) => {
            const same = hud.actors.filter((b) => b.checkpoint === a.checkpoint),
              k = same.indexOf(a);
            return (
              <span
                key={a.id}
                className={`mg-track-head${a.id === props.meId ? ' is-you' : ''}`}
                style={
                  {
                    left: `${(Math.min(15, a.checkpoint) / 15) * 100}%`,
                    '--pc': PLAYER_HUES[i % 4],
                    '--dx': `${(k - (same.length - 1) / 2) * 15}px`,
                    zIndex: a.id === props.meId ? 9 : 4 - k,
                  } as React.CSSProperties
                }
              >
                <AlienPortrait
                  shirt={seats[i]?.avatar.shirt ?? PLAYER_HUES[i % 4]}
                  size={30}
                />
              </span>
            );
          })}
        </div>
      )}
      {ready && countdown > 0 && (
        <div className="arena-countdown mg-countdown" key={countdown}>
          <strong>{countdown <= 3 ? countdown : 'READY?'}</strong>
          <span>{props.online ? 'Waiting for everyone…' : 'Get ready!'}</span>
        </div>
      )}
      {ready && countdown === 0 && !hud.done && (
        <div
          key={info.id === 'sky' ? `isle-${me.checkpoint}` : 'callout'}
          className={
            grand || hud.overhaul
              ? 'arena-callout mg-banner grand-callout'
              : 'arena-callout mg-banner'
          }
          aria-live="polite"
        >
          <span className="mg-banner-icon" aria-hidden="true">
            {info.id === 'sky' ? <Flag /> : <Sparkles />}
          </span>
          <div className="mg-banner-body">
          {!me.alive ? (
            bannerText('YOU’RE OUT! · Watch the final showdown')
          ) : readout ? (
            <>
              <strong>{readout.title}</strong>
              <small>{readout.detail}</small>
            </>
          ) : info.id === 'sky' ? (
            bannerText(
              me.checkpoint >= 15
                ? 'GOAL! · You made it across the sky'
                : `ISLAND ${me.checkpoint + 1} · Leap to the next platform!`,
            )
          ) : info.id === 'bomb' ? (
            bannerText(
              `${hud.actors[hud.extra!.holder].id === props.meId ? 'YOU HAVE IT!' : 'CHASE / EVADE'} · ${Math.max(0, hud.extra!.fuse - hud.time).toFixed(1)}s fuse · E to dash`,
            )
          ) : info.id === 'paint' ? (
            bannerText(
              `${me.score} tiles · ${me.charge > 0.05 ? 'Release to hop — ' + Math.round((me.charge / 1.3) * 100) + '%' : 'Aim, hold Space, release to stamp'}`,
            )
          ) : info.id === 'dig' ? (
            bannerText(
              `${me.score} relic points · ${me.charge > 0.01 ? 'Digging ' + Math.round(me.charge * 100) + '%' : 'Hold Space to dig the block ahead'}`,
            )
          ) : info.id === 'skate' ? (
            bannerText(
              `LAP ${Math.min(4, me.gear + 1)} / 4 · ${Math.round(me.charge * 10)} speed · E brakes`,
            )
          ) : info.id === 'factory' ? (
            bannerText(
              `SUN ${hud.extra!.orders[0]} : ${hud.extra!.orders[1]} MOON · ${me.gear === 1 ? 'Carrying BUN — find an empty tray' : me.gear === 2 ? 'Carrying FILLING — find a bun tray' : 'Space: pick up at a supply bin'}`,
            )
          ) : info.id === 'canopy' ? (
            <>
              {bannerText(
                hud.dropAt - hud.time < 0.9
                  ? 'TAKE COVER!'
                  : `DROP ${hud.dropIndex + 1} · Find an opening`,
              )}
              <i
                style={{
                  width: `${Math.max(0, (hud.dropAt - hud.time) / hud.dropPeriod) * 100}%`,
                }}
              />
            </>
          ) : info.id === 'bumper' ? (
            bannerText(
              `${alive} left · ${me.cooldown > 0 ? `Dash ready in ${me.cooldown.toFixed(1)}s` : 'DASH READY'}`,
            )
          ) : info.id === 'rope' ? (
            bannerText('WATCH THE BAR · Time your jump')
          ) : info.id === 'coconut' ? (
            me.charge > 0.1 ? (
              bannerText(
                `COCONUT ${Math.round((me.charge / 1.8) * 100)}% · Release to throw`,
              )
            ) : (
              bannerText('AIM · Move to aim, hold Space to charge')
            )
          ) : info.id === 'race' ? (
            <>
              <span>
                GEAR {me.gear} · {Math.round(me.vz * 3.6)} km/h
              </span>
              <div className="rpm-meter">
                <i
                  style={{ width: `${Math.min(100, (me.rpm / 1.2) * 100)}%` }}
                />
                <b
                  style={{ left: `${Math.min(100, (me.rpm / 1.2) * 100)}%` }}
                />
              </div>
              <span>
                {me.gear === 5
                  ? 'TOP GEAR — FULL THROTTLE'
                  : me.rpm >= 0.74 && me.rpm <= 1
                    ? 'SHIFT NOW!'
                    : 'Hold throttle · Shift in the green band'}
              </span>
            </>
          ) : (
            <>
              <span>
                {
                  [
                    '01 · Open the gate together',
                    '02 · Jump across the moving platform',
                    '03 · Alternate strokes to launch',
                    'FINISHED!',
                  ][team.stage]
                }
              </span>
              <small>
                {team.stage === 0
                  ? 'Both partners stand on their pad and hold E'
                  : team.stage === 1
                    ? 'Space to jump. Falling returns you to the ledge.'
                    : team.stage === 2
                      ? `${Math.min(10, team.work)} / 10 · ${seats[me.team * 2 + team.turn]?.avatar.name}’s stroke — tap E`
                      : ''}
              </small>
            </>
          )}
          </div>
        </div>
      )}
      {hud.done && (
        <div className="arena-finish mg-finish">
          <strong>FINISH!</strong>
          <span>
            {[...hud.actors]
              .sort((a, b) => b.score - a.score)
              .filter(
                (a) => a.score === Math.max(...hud.actors.map((x) => x.score)),
              )
              .map(
                (a) =>
                  props.game.players.find((p) => p.id === a.id)?.avatar.name,
              )
              .join(' & ')}{' '}
            wins!
          </span>
        </div>
      )}
      <footer className="arena-controls mg-controls">
        <span>
          {!['rope', 'race', 'mangosluggers'].includes(info.id) && (
            <span className="mg-ctl">
              <kbd className="is-stick">{connectedPad ? 'STICK' : 'WASD'}</kbd>
              Move
            </span>
          )}
          {info.id !== 'canopy' && (
            <span className="mg-ctl">
              <kbd className="is-a">{connectedPad ? 'A' : 'SPACE'}</kbd>
              {actionLabel}
            </span>
          )}
          {info.id === 'race' && (
            <span className="mg-ctl">
              <kbd className="is-b">{connectedPad ? 'B' : 'E'}</kbd>
              Shift
            </span>
          )}
        </span>
        <span>
          {grand && info.id !== 'mangosluggers' ? (
            <span className="mg-ctl">
              <kbd className="is-b">{connectedPad ? 'B' : 'E'}</kbd>
              {controls
                .split(' · ')
                .filter((s) => /E | E|E$/.test(s))
                .join(' · ') || 'Secondary action'}
            </span>
          ) : ['duos', 'bomb', 'dig', 'sky', 'skate', 'factory'].includes(
              info.id,
            ) ? (
            <span className="mg-ctl">
              <kbd className="is-b">{connectedPad ? 'B' : 'E'}</kbd>
              {info.id === 'dig'
                ? 'Rotate piece'
                : info.id === 'sky'
                  ? 'Walk slowly'
                  : info.id === 'duos'
                    ? 'Brace / brake'
                    : info.id === 'bomb'
                      ? 'Dash'
                      : info.id === 'skate'
                        ? 'Brake'
                        : info.id === 'factory'
                          ? 'Discard'
                          : 'Operate'}
            </span>
          ) : props.online ? (
            <span className="mg-ctl is-note">
              {connectedPad
                ? 'Start / Menu: leave view · Match keeps running'
                : 'Online round continues in real time'}
            </span>
          ) : (
            <span className="mg-ctl">
              <kbd>{connectedPad ? 'START' : 'ESC'}</kbd>
              Pause
            </span>
          )}
        </span>
      </footer>
      <div className="touch-input">
        <div
          className="touch-stick"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            stick(e);
          }}
          onPointerMove={(e) => {
            if (e.buttons) stick(e);
          }}
          onPointerUp={() => {
            touch.current.x = 0;
            touch.current.z = 0;
          }}
          onPointerCancel={() => {
            touch.current.x = 0;
            touch.current.z = 0;
          }}
        >
          <span>MOVE</span>
        </div>
        <div className="touch-buttons">
          {((grand && info.id !== 'mangosluggers') ||
            ['race', 'duos', 'bomb', 'dig', 'sky', 'skate', 'factory'].includes(
              info.id,
            )) && (
            <button
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                touch.current.b = true;
                edges.current.bp++;
              }}
              onPointerUp={() => (touch.current.b = false)}
              onPointerCancel={() => (touch.current.b = false)}
            >
              {info.id === 'dig'
                ? 'ROTATE'
                : info.id === 'sky'
                  ? 'WALK SLOWLY'
                  : info.id === 'duos'
                    ? 'BRACE'
                    : grand
                      ? 'E · ACTION 2'
                      : info.id === 'race'
                        ? 'SHIFT'
                        : info.id === 'bomb'
                          ? 'DASH'
                          : info.id === 'skate'
                            ? 'BRAKE'
                            : info.id === 'factory'
                              ? 'DISCARD'
                              : 'OPERATE'}
            </button>
          )}
          <button
            className="touch-action"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              touch.current.a = true;
              edges.current.ap++;
              tone(300, 0.03, 0.008);
            }}
            onPointerUp={() => {
              touch.current.a = false;
              edges.current.ar++;
            }}
            onPointerCancel={() => {
              touch.current.a = false;
              edges.current.ar++;
            }}
          >
            {actionLabel}
          </button>
        </div>
      </div>
      {(!ready || paused || error) && (
        <div className="arena-overlay">
          <div className={`arcade-brief mg-brief${paused ? ' is-paused' : ''}`}>
            <span className="eyebrow">
              {error
                ? 'RENDERER ISSUE'
                : paused
                  ? 'TAKE A BREATHER'
                  : info.category.toUpperCase()}
            </span>
            <h2>{paused ? 'Party paused' : info.name}</h2>
            <p>
              {error ||
                (hud.mode === '1v3' && remixInfo(info.id)?.soloBrief) ||
                info.brief}
            </p>
            {!paused && !error && (
              <>
                <div className="brief-controls">
                  <kbd>
                    {connectedPad
                      ? 'STICK / D-PAD · A · B'
                      : info.id === 'rope'
                        ? 'SPACE'
                        : info.id === 'race'
                          ? 'SPACE + E'
                          : 'WASD'}
                  </kbd>
                  <span>
                    {connectedPad
                      ? controls
                          .replace(/WASD|Arrows|arrows/g, 'Stick / D-pad')
                          .replace(/Space|SPACE/g, 'A')
                          .replace(/\bE\b/g, 'B') +
                        (props.online
                          ? ' · Start / Menu leaves view; match keeps running'
                          : ' · Start / Menu to pause')
                      : controls}
                  </span>
                </div>
                <p className="brief-tip">{tip}</p>
                <div className="mg-brief-lineup" aria-hidden="true">
                  {hud.actors.map((a, i) => (
                    <span
                      key={a.id}
                      className={a.id === props.meId ? 'is-you' : ''}
                      style={{ '--pc': PLAYER_HUES[i % 4] } as React.CSSProperties}
                    >
                      <AlienPortrait
                        shirt={seats[i]?.avatar.shirt ?? PLAYER_HUES[i % 4]}
                        size={52}
                      />
                      <b>{seats[i]?.avatar.name ?? `P${i + 1}`}</b>
                    </span>
                  ))}
                </div>
                <div className="brief-team">
                  {hud.mode === '1v3'
                    ? me.team === 0
                      ? 'SOLO SHOWDOWN · You against all three!'
                      : `TEAM OF THREE · with ${mates.join(' & ')}`
                    : hud.mode === '2v2' ||
                        grand?.teams ||
                        info.id === 'duos' ||
                        info.id === 'factory'
                    ? `Your partner: ${mates[0] ?? '—'}`
                    : grand?.heats
                      ? 'Four 12-second heats. Everyone gets the solo role once.'
                      : 'Four rivals. Every move counts.'}
                </div>
              </>
            )}
            {!error && (
              <button className="primary" onClick={paused ? pause : start}>
                <Play fill="currentColor" />
                {paused ? 'Resume game' : 'I’m ready — let’s play'}
                <ArrowRight />
              </button>
            )}
            <button className="text-button" onClick={leave}>
              <ArrowLeft size={15} />
              {props.game.practice
                ? 'Back to minigame arcade'
                : 'Back to board menu'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
