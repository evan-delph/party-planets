/**
 * Dev-only capture hook for screenshot comparisons: `?shot=<scene>` skips the
 * title screen and builds an exact game state so every capture of a scene is
 * the same. Scenes:
 *   menu · menu-panel · studio
 *   board:<boardId> · moving:<boardId> · vote · results
 *   brief:<gameId> · mini:<gameId>   (gameId from game/arcade/catalog.ts)
 * Capture with `node scripts/shot.mjs <scene> <out.png>`.
 */
import type { Avatar } from './config';
import {
  type Game,
  newGame,
  prepareMinigame,
  reduceGame,
} from './engine';
import { ALL_ARCADE } from './arcade/catalog';
import { advanceArena } from './arcade/simulation';
import { getBoard } from './boards';

export type ShotSetup = {
  started: boolean;
  panel: 'menu' | 'play' | 'creator';
  game: Game | null;
  boardId?: string;
};

export function shotScene(): string | null {
  const dev = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV;
  if (!dev || typeof location === 'undefined') return null;
  return new URLSearchParams(location.search).get('shot');
}

const SPREAD = [4, 13, 24, 37];
const constant = () => 0.42;

function boardGame(avatar: Avatar, boardId: string, now: number) {
  const g = newGame(avatar, 10, 1, undefined, boardId, 3);
  g.flight = undefined;
  g.departed = Object.fromEntries(g.players.map((p) => [p.id, 0]));
  g.rampClosesAt = now - 20000;
  const spaces = getBoard(boardId).spaces;
  g.players.forEach((p, i) => {
    p.pos = SPREAD[i] % spaces.length;
    p.shells = [34, 21, 47, 12][i];
    p.pearls = [1, 0, 2, 0][i];
  });
  g.round = 3;
  g.announce = undefined;
  g.due = now + 600000;
  return g;
}

export function buildShot(scene: string, avatar: Avatar, now: number): ShotSetup | null {
  const [kind, arg] = scene.split(':');
  if (kind === 'menu') return { started: false, panel: 'menu', game: null };
  if (kind === 'menu-panel') return { started: true, panel: 'menu', game: null };
  if (kind === 'studio') return { started: true, panel: 'creator', game: null };
  const boardId = getBoard(arg ?? 'crown').id;
  if (kind === 'board') {
    const g = boardGame(avatar, boardId, now);
    g.phase = 'turn';
    return { started: true, panel: 'play', game: g, boardId };
  }
  if (kind === 'moving') {
    const g = boardGame(avatar, boardId, now);
    const p = g.players[0],
      to = getBoard(boardId).spaces[p.pos].next[0];
    g.phase = 'moving';
    g.remaining = 5;
    g.path = [p.pos];
    g.movement = { from: p.pos, to, startedAt: now + 4000, arrivesAt: now + 600000 };
    return { started: true, panel: 'play', game: g, boardId };
  }
  if (kind === 'vote' || kind === 'results') {
    let g = boardGame(avatar, 'crown', now);
    g.active = 3;
    g.phase = 'landed';
    g.presentUntil = now - 1;
    g.players.forEach((p, i) => (p.color = i % 2 ? 'red' : 'blue'));
    g = reduceGame(g, g.players[3].id, { type: 'end' }, now, constant);
    if (g.vote) {
      g.vote.endsAt = now + 40000;
      g.due = now + 600000;
    }
    if (kind === 'results') {
      prepareMinigame(g, g.vote?.choices[0] ?? 0, now - 99000, 7);
      g = reduceGame(g, g.players[0].id, { type: 'arcadeResult', scores: [3, 9, 5, 7] }, now, constant);
      g.due = now + 600000;
    }
    return { started: true, panel: 'play', game: g, boardId: 'crown' };
  }
  if (kind === 'brief' || kind === 'mini') {
    const index = Math.max(0, ALL_ARCADE.findIndex((m) => m.id === arg));
    const g = boardGame(avatar, 'crown', now);
    g.players.forEach((p) => (p.cpu = true));
    // Minigames begin 15 s after preparation; `mini` scenes start mid-play.
    prepareMinigame(g, index, kind === 'mini' ? now - 22000 : now + 600000, 4242);
    if (kind === 'mini') {
      g.miniReady = g.players.map((p) => p.id);
      // Software-rendered captures run at a frame or two a second, so play the
      // first eight seconds up front.
      advanceArena(g.arcade!, 8);
      g.miniStart = now - 8000;
    }
    g.due = now + 600000;
    return { started: true, panel: 'play', game: g, boardId: 'crown' };
  }
  return null;
}
