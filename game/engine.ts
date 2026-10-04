import { getBoard, pearlDestinations, BOARD_WALK_SPEED } from './boards';
import {
  arcadeInfo,
  AVAILABLE_ARCADE,
  miniMode,
  normalizeMinigamePool,
  type MiniMode,
} from './arcade/catalog';
import { OVERHAUL } from './arcade/overhaul';
import { remixInfo } from './arcade/remix-catalog';
import {
  Arena,
  Control,
  advanceArena,
  createArena,
  setControl,
} from './arcade/simulation';
import {
  Avatar,
  COLORS,
  ALIEN_SKIN,
  DEFAULT_AVATAR,
  ITEMS,
  MINIGAMES,
  NABBER,
  OUTFITS,
  RULES,
  spaceColor,
  VILLAIN,
  type TeamColor,
} from './config';
/** Discrete board moments for presentation (stomps, steals, villain strikes…). */
export type BoardEvent = {
  id: number;
  kind: 'stomp' | 'steal' | 'villain' | 'lastTurns' | 'size';
  player: string;
  target?: string;
  space: number;
  delta: number;
  text: string;
  at: number;
};
export type VillainStrike =
  | 'shakedown'
  | 'toll'
  | 'equalize'
  | 'relocate'
  | 'swap';
export type LastTurnsBonus = 'points' | 'items' | 'bailout';
export type Player = {
  stats?: { lossSpaces: number; eventSpaces: number };
  id: string;
  avatar: Avatar;
  cpu: boolean;
  pos: number;
  shells: number;
  pearls: number;
  items: string[];
  lotteryBoosts?: number; // Prize pouch: lottery items are never lost to a full bag.
  shield: boolean;
  boost: number;
  double: boolean;
  used: boolean;
  score: number;
  answered: number[];
  memory: number[];
  /** Team color from this round's final space; decides the minigame shape. */
  color?: TeamColor;
  /** Shrink/Growth Ray effect for the current turn only. */
  size?: 'mini' | 'mega';
  /** Points paid by the latest minigame. */
  prize?: number;
};
export type Game = {
  contentRevision?: 7 | 8 | 9 | 10;
  /** Arena seat order (player ids), grouped by team for 1 vs 3 and 2 vs 2. */
  lineup?: string[];
  miniMode?: MiniMode;
  teamDecks?: Partial<Record<'1v3' | '2v2', number[]>>;
  lastTurns?: {
    startRound: number;
    startedAt: number;
    trailing: string[];
    bonus: LastTurnsBonus;
    stage: 'standings' | 'bonus';
  };
  steal?: { player: string; space: number };
  /** Rivals already flattened by this turn's Growth Ray. */
  stomped?: string[];
  events?: BoardEvent[];
  minigamePool?: string[];
  shopStock?: string[];
  lottery?: {
    id: string;
    player: string;
    space: number;
    cards?: number[];
    selected?: number;
    result?: number;
    stage: 'pick' | 'scratch' | 'revealed';
    landingResolved?: boolean;
    resumeTurn?: boolean;
  };
  diamondPickup?: { player: string; space: number; startedAt: number };
  diamondLandingResolved?: boolean;
  finale?: { reason: 'goal' | 'bonuses'; startedAt: number; winner?: string };
  bonuses?: {
    label: string;
    value: number;
    winners: string[];
    awarded: boolean;
  }[];
  version: 1;
  presentUntil?: number;
  boardId?: string;
  bank?: number;
  routesOpen?: boolean;
  effect?: {
    id: number;
    kind: string;
    player: string;
    space: number;
    delta: number;
    losses?: { player: string; delta: number; space: number }[];
    startedAt?: number;
    detail?: string;
  };
  players: Player[];
  round: number;
  rounds: number;
  active: number;
  phase:
    | 'arrival'
    | 'turn'
    | 'rolling'
    | 'moving'
    | 'fork'
    | 'diamond'
    | 'steal'
    | 'lottery'
    | 'landed'
    | 'lastTurns'
    | 'vote'
    | 'minigame'
    | 'results'
    | 'bonus'
    | 'finished';
  diamondGoal?: number;
  flight?: { startedAt: number; landAt: number };
  departed?: Record<string, number>;
  rampClosesAt?: number;
  announce?: { id: number; player: string; startedAt: number; until: number };
  dice?: {
    values: number[];
    bonus: number;
    startedAt: number;
    revealAt: number;
    until: number;
  };
  movement?: { from: number; to: number; startedAt: number; arrivesAt: number };
  remaining?: number;
  turnShells?: number;
  turnDiamonds?: number;
  savedAt?: number;
  vote?: {
    id: string;
    choices: number[];
    ballots: Record<string, number>;
    endsAt: number;
    winner?: number;
    resolvedAt?: number;
  };
  pearl: number;
  lastRoll: number;
  path: number[];
  log: string[];
  mini: number;
  miniOrder?: number[];
  miniStart: number;
  seed: number;
  due: number;
  difficulty: number;
  bought: boolean;
  practice: boolean;
  arcade?: Arena;
  miniReady?: string[];
  miniVersion?: 2;
};
export type Action = {
  type:
    | 'route'
    | 'vote'
    | 'roll'
    | 'end'
    | 'use'
    | 'buy'
    | 'diamond'
    | 'steal'
    | 'lotteryPick'
    | 'lotteryScratch'
    | 'lotteryContinue'
    | 'ready'
    | 'control'
    | 'arcadeResult'
    | 'next'
    | 'tick';
  route?: string; // Legacy saves/actions: never used to choose a pre-roll route.
  voteId?: string;
  lotteryId?: string;
  /** Rival player id for a Nabbit steal. */
  target?: string;
  item?: string;
  value?: number;
  tick?: number;
  miniStart?: number;
  at?: number;
  control?: Control;
  scores?: number[];
};
export const BOT_NAMES = ['Chorizo', 'Coco', 'Bratley'];
export function player(id: string, avatar: Avatar, cpu = false): Player {
  return {
    id,
    stats: { lossSpaces: 0, eventSpaces: 0 },
    avatar: { ...avatar, skin: ALIEN_SKIN },
    cpu,
    pos: 0,
    shells: RULES.startingShells,
    pearls: 0,
    items: ['boost'],
    shield: false,
    boost: 0,
    double: false,
    used: false,
    score: 0,
    answered: [],
    memory: [],
  };
}
export function newGame(
  avatar: Avatar,
  rounds = 10,
  difficulty = 1,
  others?: Player[],
  boardId = 'crown',
  diamondGoal = 3,
  minigamePool?: string[],
): Game {
  const now = Date.now();
  return {
    version: 1,
    contentRevision: 10,
    minigamePool: normalizeMinigamePool(minigamePool),
    boardId: getBoard(boardId).id,
    bank: 0,
    routesOpen: true,
    players: others ?? [
      player('local', avatar),
      ...BOT_NAMES.map((name, i) =>
        player(
          'bot' + i,
          {
            ...DEFAULT_AVATAR,
            name,
            skin: ALIEN_SKIN,
            shirt: OUTFITS[i + 1],
            hair: i + 2,
            accessory: i,
          },
          true,
        ),
      ),
    ],
    round: 1,
    rounds,
    active: 0,
    phase: 'arrival',
    diamondGoal: [0, 1, 3, 5, 10].includes(diamondGoal) ? diamondGoal : 3,
    flight: { startedAt: now, landAt: now + 5000 },
    departed: {},
    pearl:
      pearlDestinations(boardId, 0).find(
        (n) => getBoard(boardId).spaces[n].type === 'blue',
      ) ?? 22,
    lastRoll: 0,
    path: [],
    log: [
      `Welcome to ${getBoard(boardId).name}. Bank deposits are shared. Collect diamonds to win.`,
    ],
    mini: 0,
    miniStart: 0,
    seed: 123,
    due: now + 5000,
    difficulty,
    bought: false,
    practice: false,
  };
}
function log(s: Game, msg: string) {
  s.log = [msg, ...s.log].slice(0, 30);
}
function rollDie(rng: () => number, sides: number = RULES.diceSides) {
  return 1 + Math.floor(rng() * sides);
}
function pushEvent(s: Game, e: Omit<BoardEvent, 'id'>) {
  const id = (s.events?.at(-1)?.id ?? 0) + 1;
  s.events = [...(s.events ?? []), { id, ...e }].slice(-12);
}
const playerName = (s: Game, id: string) =>
  s.players.find((p) => p.id === id)?.avatar.name ?? 'Someone';
/** Players in arena seat order. Falls back to turn order for older saves. */
export function arenaPlayers(s: Game): Player[] {
  const seated = s.lineup?.map((id) => s.players.find((p) => p.id === id));
  return seated?.length === s.players.length && seated.every(Boolean)
    ? (seated as Player[])
    : s.players;
}
export function arenaFor(s: Game, index: number, seed: number) {
  const mode =
    s.miniMode && miniMode(index) === s.miniMode ? s.miniMode : undefined;
  return createArena(index, arenaPlayers(s), s.difficulty, seed, mode);
}
/** Fewest forward steps between two spaces (main roads only). */
export function stepsTo(boardId: string | undefined, from: number, to: number) {
  const board = getBoard(boardId).spaces,
    distance = new Map([[from, 0]]),
    queue = [from];
  for (let k = 0; k < queue.length; k++) {
    const at = queue[k];
    if (at === to) return distance.get(at)!;
    for (const n of board[at].next)
      if (!distance.has(n)) {
        distance.set(n, distance.get(at)! + 1);
        queue.push(n);
      }
  }
  return undefined;
}
function deckOf(s: Game, mode: MiniMode) {
  return mode === 'ffa' ? s.miniOrder : s.teamDecks?.[mode];
}
function setDeck(s: Game, mode: MiniMode, deck: number[]) {
  if (mode === 'ffa') s.miniOrder = deck;
  else (s.teamDecks ??= {})[mode] = deck;
}
function movePearl(s: Game, rng: () => number) {
  const candidates = pearlDestinations(
    s.boardId,
    s.players[s.active].pos,
  ).filter((n) => n !== s.pearl && !s.players.some((p) => p.pos === n));
  if (candidates.length)
    s.pearl = candidates[Math.floor(rng() * candidates.length)];
}
export function prepareMinigame(
  s: Game,
  index: number,
  now = Date.now(),
  seed = Math.floor(Math.random() * 100000),
) {
  s.phase = 'minigame';
  s.mini = index;
  s.miniStart = now + 15000;
  s.seed = seed;
  s.miniReady = [];
  s.miniVersion = 2;
  s.arcade = arenaFor(s, index, seed);
  s.players.forEach((p) => {
    p.score = 0;
    p.answered = [];
    p.memory = [];
  });
  return s;
}
function startMini(s: Game, now: number, rng: () => number) {
  const enabled = AVAILABLE_ARCADE.filter((m) =>
    normalizeMinigamePool(s.minigamePool).includes(m.id),
  ).map((m) => m.index);
  // Space colors decide the shape: 4–0 free-for-all, 3–1 solo showdown, 2–2 teams.
  const blues = s.players.filter((p) => p.color === 'blue'),
    reds = s.players.filter((p) => p.color !== 'blue');
  let mode: MiniMode =
    blues.length === 2
      ? '2v2'
      : blues.length === 1 || blues.length === 3
        ? '1v3'
        : 'ffa';
  let pool = enabled.filter((n) => miniMode(n) === mode);
  if (!pool.length) {
    mode = 'ffa';
    pool = enabled.filter((n) => miniMode(n) === 'ffa');
  }
  // Only team games enabled: play them with seat-paired teams.
  if (!pool.length) pool = enabled;
  const solo = blues.length === 1 ? blues[0] : reds[0];
  s.miniMode = mode;
  s.lineup = (
    mode === '2v2'
      ? [...blues, ...reds]
      : mode === '1v3'
        ? [solo, ...s.players.filter((p) => p !== solo)]
        : s.players
  ).map((p) => p.id);
  const count = Math.min(3, pool.length);
  let deck = deckOf(s, mode)?.filter((n) => pool.includes(n));
  if ((deck?.length ?? 0) < count) {
    deck = [...pool];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  }
  setDeck(s, mode, deck!);
  s.phase = 'vote';
  s.vote = {
    id: s.round + ':' + now,
    choices: deck!.slice(-count),
    ballots: {},
    endsAt: now + 20000,
  };
  s.due = now + 1000;
  log(
    s,
    mode === '2v2'
      ? `Team battle! ${blues.map((p) => p.avatar.name).join(' & ')} vs ${reds.map((p) => p.avatar.name).join(' & ')}.`
      : mode === '1v3'
        ? `Solo showdown! ${solo.avatar.name} takes on the other three.`
        : 'Free-for-all! Choose our next adventure.',
  );
}
function resolveVote(s: Game, now: number, rng: () => number) {
  const v = s.vote!;
  if (v.winner !== undefined) return;
  const counts = v.choices.map(
    (choice) => Object.values(v.ballots).filter((n) => n === choice).length,
  );
  const most = Math.max(...counts);
  const tied = v.choices.filter((_, i) => counts[i] === most);
  v.winner = tied[Math.floor(rng() * tied.length)];
  v.resolvedAt = now;
  s.due = now + 2400;
  // Unselected candidates rotate away; the winning game leaves the deck.
  const mode = s.miniMode ?? 'ffa';
  setDeck(s, mode, [
    ...v.choices.filter((n) => n !== v.winner),
    ...(deckOf(s, mode) ?? []).filter((n) => !v.choices.includes(n)),
  ]);
  log(
    s,
    (tied.length > 1 ? 'Random tiebreak: ' : 'Vote winner: ') +
      MINIGAMES[v.winner].name +
      '.',
  );
}
function beginTurn(s: Game, now: number) {
  const p = s.players[s.active];
  s.phase = 'turn';
  s.diamondLandingResolved = undefined;
  s.lottery = undefined;
  s.shopStock = undefined;
  s.path = [];
  s.movement = undefined;
  s.dice = undefined;
  p.used = false;
  s.announce = {
    id: (s.announce?.id ?? 0) + 1,
    player: p.id,
    startedAt: now,
    until: now + 2000,
  };
  s.due = now + (p.cpu ? 2600 : RULES.turnTimeout);
}
export function routeChoices(s: Game): number[] {
  const p = s.players[s.active],
    space = getBoard(s.boardId).spaces[p.pos];
  const roads = s.routesOpen === false ? space.next.slice(0, 1) : space.next;
  return p.size === 'mini' && space.miniNext?.length
    ? [...roads, ...space.miniNext]
    : roads;
}
function beginEdge(s: Game, to: number, now: number) {
  const from = s.players[s.active].pos,
    board = getBoard(s.boardId).spaces;
  const duration = Math.max(
    280,
    Math.round(
      (Math.hypot(board[to].x - board[from].x, board[to].z - board[from].z) /
        BOARD_WALK_SPEED) *
        1000,
    ),
  );
  s.movement = { from, to, startedAt: now, arrivesAt: now + duration };
  s.phase = 'moving';
  s.due = now + duration;
}
function continueWalk(s: Game, now: number) {
  const choices = routeChoices(s);
  if (choices.length > 1) {
    s.phase = 'fork';
    s.movement = undefined;
    s.due = now + (s.players[s.active].cpu ? 1300 : 30000);
  } else beginEdge(s, choices[0], now);
}
function finishMini(s: Game, now: number, scores?: number[]) {
  // Scores arrive in arena seat order.
  const seats = arenaPlayers(s);
  seats.forEach(
    (p, i) =>
      (p.score =
        scores?.[i] ??
        s.arcade?.actors.find((a) => a.id === p.id)?.score ??
        0),
  );
  const mode = s.arcade?.mode;
  if (mode === '1v3' || mode === '2v2') {
    const split = mode === '1v3' ? 1 : 2,
      sides = [seats.slice(0, split), seats.slice(split)],
      best = sides.map((side) => Math.max(...side.map((p) => p.score)));
    sides.forEach((side, t) =>
      side.forEach(
        (p) =>
          (p.prize =
            best[0] === best[1]
              ? RULES.teamTie
              : best[t] > best[1 - t]
                ? side.length === 1
                  ? RULES.soloWin
                  : RULES.teamWin
                : 0),
      ),
    );
  } else
    for (const p of s.players) {
      const rank = s.players.filter((q) => q.score > p.score).length;
      p.prize = RULES.minigameReward[rank] ?? 1;
    }
  s.players.forEach((p) => (p.shells += p.prize ?? 0));
  s.phase = 'results';
  s.due = now + 15000;
  log(s, arcadeInfo(s.mini).name + ' finished! Point prizes awarded.');
}
export function randomShopStock(rng: () => number): string[] {
  const ids: string[] = ITEMS.map((item) => item.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, 5);
}
function openLottery(
  s: Game,
  now: number,
  rng: () => number,
  landingResolved = false,
) {
  const p = s.players[s.active],
    cards = [1, 2, 3, ...Array<number>(13).fill(0)];
  for (let i = 15; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  s.lottery = {
    id: `${s.round}:${s.active}:${s.path.length}:${now}`,
    player: p.id,
    space: p.pos,
    cards,
    stage: 'pick',
    landingResolved,
  };
  s.phase = 'lottery';
  s.movement = undefined;
  s.due = now + 1500;
  log(s, `${p.avatar.name} stopped at the lottery. Pick one of 16 cards!`);
}
function scratchLottery(s: Game, now: number) {
  const l = s.lottery!,
    p = s.players[s.active];
  if (l.stage !== 'scratch' || l.selected === undefined || !l.cards) return;
  l.result = l.cards[l.selected];
  l.stage = 'revealed';
  s.due = now + 3500;
  if (l.result === 1) {
    p.pearls++;
    s.diamondPickup = { player: p.id, space: p.pos, startedAt: now };
    log(s, `${p.avatar.name} scratched 1: a chest with a FREE diamond!`);
  } else if (l.result === 2) {
    p.shells += 100;
    log(s, `${p.avatar.name} scratched 2: 100 coins!`);
  } else if (l.result === 3) {
    p.lotteryBoosts = (p.lotteryBoosts ?? 0) + 1;
    log(
      s,
      `${p.avatar.name} scratched 3: a Lucky +5 item, safely kept in the prize pouch.`,
    );
  } else
    log(
      s,
      `${p.avatar.name} scratched a blank. The winning cards are now revealed.`,
    );
  s.effect = {
    id: (s.effect?.id ?? 0) + 1,
    kind: l.result === 1 ? 'diamond' : 'lottery',
    player: p.id,
    space: p.pos,
    delta: l.result === 2 ? 100 : l.result ? 1 : 0,
    startedAt: now,
  };
}
function nextBoardTurn(s: Game, now: number, rng: () => number) {
  s.lottery = undefined;
  s.shopStock = undefined;
  s.steal = undefined;
  const p = s.players[s.active];
  // The space a turn ends on sets the team color; other spaces flip a coin.
  p.color =
    spaceColor(getBoard(s.boardId).spaces[p.pos].type) ??
    (rng() < 0.5 ? 'blue' : 'red');
  p.size = undefined;
  s.active++;
  if (s.active >= s.players.length) {
    s.active = 0;
    startMini(s, now, rng);
  } else beginTurn(s, now);
}
function finishLottery(s: Game, now: number, rng: () => number) {
  const l = s.lottery!,
    p = s.players[s.active];
  if (l.stage !== 'revealed') return;
  s.lottery = undefined;
  if (s.diamondGoal && p.pearls >= s.diamondGoal) {
    s.phase = 'finished';
    s.finale = { reason: 'goal', startedAt: now, winner: p.id };
    return;
  }
  if (l.resumeTurn) {
    s.phase = 'turn';
    s.due = now + (p.cpu ? 1800 : RULES.turnTimeout);
  } else if ((s.remaining ?? 0) > 0 && !l.landingResolved) continueWalk(s, now);
  else nextBoardTurn(s, now, rng);
}
/** Captain Klaxon's villain space: one random strike. */
function villainStrike(s: Game, p: Player, now: number, rng: () => number) {
  const strikes: VillainStrike[] = [
    'shakedown',
    'toll',
    'equalize',
    'relocate',
    'swap',
  ];
  const strike = strikes[Math.floor(rng() * strikes.length)];
  let losses: NonNullable<Game['effect']>['losses'];
  let text: string;
  if (strike === 'shakedown') {
    if (p.shield) {
      p.shield = false;
      text = `${VILLAIN} demanded 20 points, but the Orbit Shield held!`;
    } else {
      const n = Math.min(20, p.shells);
      p.shells -= n;
      text = `${VILLAIN}'s shakedown! ${p.avatar.name} hands over ${n} points.`;
    }
  } else if (strike === 'toll') {
    losses = s.players.map((q) => {
      const n = Math.min(10, q.shells);
      q.shells -= n;
      return { player: q.id, delta: -n, space: q.pos };
    });
    text = `${VILLAIN}'s space toll! Everyone pays up to 10 points.`;
  } else if (strike === 'equalize') {
    const total = s.players.reduce((sum, q) => sum + q.shells, 0),
      share = Math.floor(total / s.players.length);
    losses = s.players.map((q) => {
      const delta = share - q.shells;
      q.shells = share;
      return { player: q.id, delta, space: q.pos };
    });
    s.bank = (s.bank ?? 0) + (total - share * s.players.length);
    text = `${VILLAIN}'s Equalizer Ray! Everyone now has ${share} points.`;
  } else if (strike === 'relocate') {
    const from = s.pearl;
    movePearl(s, rng);
    text =
      s.pearl === from
        ? `${VILLAIN} tried to hide the diamond, but it would not budge.`
        : `${VILLAIN} teleported the diamond to space ${s.pearl + 1}!`;
  } else {
    const rivals = s.players.filter((q) => q.id !== p.id),
      rival = rivals[Math.floor(rng() * rivals.length)];
    [p.pos, rival.pos] = [rival.pos, p.pos];
    text = `${VILLAIN}'s Switcheroo! ${p.avatar.name} and ${rival.avatar.name} swap places.`;
  }
  log(s, text);
  pushEvent(s, {
    kind: 'villain',
    player: p.id,
    space: p.pos,
    delta: 0,
    text,
    at: now,
  });
  return { strike, losses, text };
}
function canNab(s: Game, p: Player) {
  return (
    p.size !== 'mega' &&
    s.players.some(
      (q) =>
        q.id !== p.id &&
        ((q.shells > 0 && p.shells >= RULES.nabPointsCost) ||
          (q.pearls > 0 && p.shells >= RULES.nabDiamondCost)),
    )
  );
}
/** CPU Nabbit choice: a diamond when affordable, otherwise the richest wallet. */
export function cpuSteal(s: Game, p: Player): Action {
  const rivals = s.players.filter((q) => q.id !== p.id);
  const gem = [...rivals]
    .filter((q) => q.pearls > 0)
    .sort((a, b) => b.pearls - a.pearls || b.shells - a.shells)[0];
  if (gem && p.shells >= RULES.nabDiamondCost && s.difficulty > 0)
    return { type: 'steal', value: 2, target: gem.id };
  const rich = [...rivals].sort((a, b) => b.shells - a.shells)[0];
  if (rich.shells >= 8 && p.shells >= RULES.nabPointsCost)
    return { type: 'steal', value: 1, target: rich.id };
  return { type: 'steal', value: 0 };
}
function resolveSteal(
  s: Game,
  choice: number,
  target: string | undefined,
  now: number,
  rng: () => number,
) {
  const p = s.players[s.active],
    rival = s.players.find((q) => q.id === target && q.id !== p.id);
  if (choice === 1) {
    if (!rival || rival.shells <= 0) throw Error('Choose a rival with points.');
    if (p.shells < RULES.nabPointsCost)
      throw Error(`Nabbit charges ${RULES.nabPointsCost} points.`);
  }
  if (choice === 2) {
    if (!rival || rival.pearls <= 0)
      throw Error('Choose a rival with a diamond.');
    if (p.shells < RULES.nabDiamondCost)
      throw Error(`Nabbit charges ${RULES.nabDiamondCost} points for a diamond.`);
  }
  s.steal = undefined;
  if (choice === 1 && rival) {
    p.shells -= RULES.nabPointsCost;
    const n = Math.min(rival.shells, 5 + Math.floor(rng() * 11));
    rival.shells -= n;
    p.shells += n;
    const text = `${NABBER} swiped ${n} points from ${rival.avatar.name} for ${p.avatar.name}!`;
    log(s, text);
    pushEvent(s, {
      kind: 'steal',
      player: p.id,
      target: rival.id,
      space: p.pos,
      delta: n,
      text,
      at: now,
    });
    s.effect = {
      id: (s.effect?.id ?? 0) + 1,
      kind: 'steal',
      player: p.id,
      space: p.pos,
      delta: n - RULES.nabPointsCost,
      losses: [{ player: rival.id, delta: -n, space: rival.pos }],
      startedAt: now,
      detail: text,
    };
  } else if (choice === 2 && rival) {
    p.shells -= RULES.nabDiamondCost;
    rival.pearls--;
    p.pearls++;
    s.diamondPickup = { player: p.id, space: p.pos, startedAt: now };
    const text = `${NABBER} snatched a diamond from ${rival.avatar.name} for ${p.avatar.name}!`;
    log(s, text);
    pushEvent(s, {
      kind: 'steal',
      player: p.id,
      target: rival.id,
      space: p.pos,
      delta: 1,
      text,
      at: now,
    });
    s.effect = {
      id: (s.effect?.id ?? 0) + 1,
      kind: 'steal',
      player: p.id,
      space: p.pos,
      delta: 1,
      startedAt: now,
      detail: text,
    };
    if (s.diamondGoal && p.pearls >= s.diamondGoal) {
      s.phase = 'finished';
      s.finale = { reason: 'goal', startedAt: now, winner: p.id };
      s.movement = undefined;
      return;
    }
  } else log(s, `${p.avatar.name} waved goodbye to ${NABBER}.`);
  if (!s.remaining) landPlayer(s, now, rng);
  else continueWalk(s, now);
}
export function lastTurnsCount(rounds: number) {
  return rounds >= 10 ? 5 : 3;
}
export function lastTurnsRound(rounds: number) {
  return rounds - lastTurnsCount(rounds) + 1;
}
/** Diamonds first, points second — the same order as the final ranking. */
function standings(s: Game) {
  return [...s.players].sort(
    (a, b) => b.pearls - a.pearls || b.shells - a.shells,
  );
}
function startLastTurns(s: Game, now: number, rng: () => number) {
  const order = standings(s),
    last = order.at(-1)!;
  const bonuses: LastTurnsBonus[] = ['points', 'items', 'bailout'];
  s.lastTurns = {
    startRound: s.round,
    startedAt: now,
    trailing: order
      .filter((p) => p.pearls === last.pearls && p.shells === last.shells)
      .map((p) => p.id),
    bonus: bonuses[Math.floor(rng() * bonuses.length)],
    stage: 'standings',
  };
  s.phase = 'lastTurns';
  s.announce = undefined;
  s.due = now + 6500;
  log(
    s,
    `LAST ${lastTurnsCount(s.rounds)} TURNS! Blue and red spaces now pay double.`,
  );
}
function awardLastTurns(s: Game, now: number) {
  const l = s.lastTurns!,
    trailing = l.trailing.map((id) => s.players.find((p) => p.id === id)!);
  let text: string;
  if (l.bonus === 'points') {
    trailing.forEach((p) => (p.shells += RULES.lastTurnsBonus));
    text = `+${RULES.lastTurnsBonus} points`;
  } else if (l.bonus === 'items') {
    trailing.forEach((p) => {
      for (const id of ['double', 'mega'])
        if (p.items.length < RULES.inventorySize) p.items.push(id);
    });
    text = 'a Double Orbit and a Growth Ray';
  } else {
    const pot = s.bank ?? 0,
      share = Math.floor(pot / trailing.length) + 10;
    trailing.forEach((p) => (p.shells += share));
    s.bank = pot - Math.floor(pot / trailing.length) * trailing.length;
    text = `a bank bailout of ${share} points`;
  }
  const names = trailing.map((p) => p.avatar.name).join(' & ');
  log(s, `Catch-up boost: ${names} receive${trailing.length > 1 ? '' : 's'} ${text}!`);
  trailing.forEach((p) =>
    pushEvent(s, {
      kind: 'lastTurns',
      player: p.id,
      space: p.pos,
      delta: 0,
      text: `Catch-up boost: ${text}`,
      at: now,
    }),
  );
  l.stage = 'bonus';
  s.due = now + 5000;
}
/** CPU item use: situational rather than always the first item in the bag. */
export function cpuItem(s: Game, p: Player): string | undefined {
  if ((p.lotteryBoosts ?? 0) > 0) return 'five';
  const has = (id: string) => p.items.includes(id);
  const gap = stepsTo(s.boardId, p.pos, s.pearl);
  if (has('warp') && p.shells >= RULES.pearlPrice) return 'warp';
  if (has('mini') && gap !== undefined && gap <= RULES.miniDiceSides)
    return 'mini';
  if (has('mega') && s.players.some((q) => q.id !== p.id && q.shells >= 5))
    return 'mega';
  for (const id of ['double', 'magnet', 'steal', 'boost'])
    if (has(id)) return id;
  if (has('shield') && !p.shield) return 'shield';
  return undefined;
}
function landPlayer(s: Game, now: number, rng: () => number) {
  const BOARD = getBoard(s.boardId).spaces,
    p = s.players[s.active];
  const type = BOARD[p.pos].type;
  if (type === 'lottery') {
    openLottery(s, now, rng);
    return;
  }
  const before = p.shells;
  p.stats ??= { lossSpaces: 0, eventSpaces: 0 };
  let losses: NonNullable<Game['effect']>['losses'];
  if (type === 'bank') {
    const pot = s.bank ?? 0;
    p.shells += pot;
    s.bank = 0;
    log(s, `BANK JACKPOT! ${p.avatar.name} collected ${pot} points.`);
  }
  if (type === 'hazard') {
    const board = getBoard(s.boardId);
    if (p.shield) {
      p.shield = false;
      log(s, 'Orbit Shield blocked ' + board.hazard + '.');
    } else {
      const loss = Math.min(p.shells, board.loss);
      p.shells -= loss;
      log(s, `${board.hazard}! ${p.avatar.name} loses ${loss} points.`);
      if (board.id === 'alpine' || board.id === 'moss') {
        p.pos =
          s.path[Math.max(0, s.path.length - (board.id === 'alpine' ? 4 : 3))];
        log(
          s,
          board.id === 'alpine'
            ? 'The avalanche swept you back along your trail!'
            : 'Sticky roots dragged you back along your trail!',
        );
      }
    }
  }
  if (type === 'spring') {
    p.shells += 8;
    log(s, getBoard(s.boardId).reward + ': +8 points!');
  }
  if (type === 'portal') {
    const gates = BOARD.filter((b) => b.type === 'portal');
    const idx = gates.findIndex((b) => b.id === p.pos);
    p.pos = gates[(idx + 1) % gates.length].id;
    log(s, 'Portal express! Travel to the next district.');
  }
  let detail: string | undefined;
  if (type === 'villain') {
    const strike = villainStrike(s, p, now, rng);
    losses = strike.losses;
    detail = strike.text;
  }
  if (type === 'switch') {
    s.routesOpen = s.routesOpen === false;
    p.shells += 4;
    log(
      s,
      `Shortcuts ${s.routesOpen ? 'OPEN' : 'CLOSED'}! Switch bonus: +4 points.`,
    );
  }
  // The last turns double ordinary blue and red spaces.
  const stakes = s.lastTurns ? 2 : 1;
  if (type === 'blue') p.shells += RULES.blueReward * stakes;
  if (type === 'red') {
    if (p.shield) {
      p.shield = false;
      log(s, 'Orbit Shield blocked the penalty.');
    } else p.shells = Math.max(0, p.shells - RULES.redPenalty * stakes);
  }
  if (type === 'lucky') {
    if (p.items.length < RULES.inventorySize && rng() > 0.5) {
      const item = ITEMS[Math.floor(rng() * ITEMS.length)];
      p.items.push(item.id);
      log(s, `Lucky gift: ${item.name}!`);
    } else {
      p.shells += 8;
      log(s, 'Lucky tide: +8 points!');
    }
  }
  if (type === 'event') {
    const board = getBoard(s.boardId);
    p.stats.eventSpaces++;
    losses = s.players.map((q) => {
      const n = BOARD[q.pos];
      const distance = Math.hypot(
        n.x - board.landmark.x,
        n.z - board.landmark.z,
      );
      const penalty = Math.max(
        1,
        Math.min(
          board.globalEvent.maxLoss,
          Math.ceil(
            board.globalEvent.maxLoss *
              (1 - distance / (board.radius * board.globalEvent.radiusFactor)),
          ),
        ),
      );
      const loss = Math.min(q.shells, penalty);
      q.shells -= loss;
      return { player: q.id, delta: -loss, space: q.pos };
    });
    log(
      s,
      `${board.globalEvent.name}! ${losses.map((l) => `${s.players.find((q) => q.id === l.player)!.avatar.name} −${-l.delta}`).join(' · ')}. These points leave the game; the bank is unchanged.`,
    );
  }
  if (
    p.shells < before &&
    ['red', 'hazard', 'event', 'villain'].includes(type)
  )
    p.stats.lossSpaces++;
  // A Nabbit stop on the final step keeps its steal effect on screen.
  if (!(type === 'thief' && s.effect?.kind === 'steal' && s.effect.startedAt === now))
    s.effect = {
      id: (s.effect?.id ?? 0) + 1,
      kind: type,
      player: p.id,
      space: s.path[s.path.length - 1],
      delta: p.shells - before,
      losses,
      startedAt: now,
      ...(detail ? { detail } : {}),
    };
  s.movement = undefined;
  s.presentUntil =
    now +
    (type === 'event'
      ? 7000
      : type === 'villain'
        ? 6500
        : type === 'bank'
          ? 5500
          : type === 'thief'
            ? 2400
            : 1200);
  s.phase = 'landed';
  s.bought = false;
  s.shopStock = BOARD[p.pos].type === 'shop' ? randomShopStock(rng) : undefined;
  s.due = Math.max(
    s.presentUntil + 300,
    now + (p.cpu ? 1800 : RULES.turnTimeout),
  );
  // A hazard can carry a player back onto a previously declined diamond.
  // Preserve its completed landing effects while asking for a new decision.
  if (p.pos === s.pearl && p.pos !== s.path[s.path.length - 1]) {
    s.diamondLandingResolved = true;
    s.phase = 'diamond';
    s.due = now + 1500;
  } else if (BOARD[p.pos].type === 'lottery') {
    openLottery(s, now, rng, true);
  }
}
function arriveAtSpace(s: Game, now: number, rng: () => number) {
  const p = s.players[s.active],
    board = getBoard(s.boardId).spaces;
  p.pos = s.movement!.to;
  s.path.push(p.pos);
  s.remaining = Math.max(0, (s.remaining ?? 1) - 1);
  if (board[p.pos].type === 'bank' && s.remaining > 0) {
    const deposit = Math.min(5, p.shells);
    p.shells -= deposit;
    s.bank = (s.bank ?? 0) + deposit;
    log(
      s,
      p.avatar.name +
        ' deposited ' +
        deposit +
        ' points. Bank: ' +
        s.bank +
        '.',
    );
  }
  if (p.pos === 0) {
    p.shells += RULES.lapReward;
    log(s, p.avatar.name + ' returned to the landing pad: +10 points.');
  }
  if (p.size === 'mega')
    for (const q of s.players) {
      if (q.id === p.id || q.pos !== p.pos || s.stomped?.includes(q.id))
        continue;
      const n = Math.min(q.shells, RULES.megaStomp);
      q.shells -= n;
      p.shells += n;
      (s.stomped ??= []).push(q.id);
      const text = `STOMP! ${p.avatar.name} flattened ${q.avatar.name} for ${n} points.`;
      log(s, text);
      pushEvent(s, {
        kind: 'stomp',
        player: p.id,
        target: q.id,
        space: p.pos,
        delta: n,
        text,
        at: now,
      });
    }
  if (p.pos === s.pearl) {
    s.diamondLandingResolved = undefined;
    s.phase = 'diamond';
    s.movement = undefined;
    s.due = now + 1500;
    log(s, p.avatar.name + ' reached the diamond. Buy it or continue?');
    return;
  }
  if (board[p.pos].type === 'lottery') {
    openLottery(s, now, rng);
    return;
  }
  if (board[p.pos].type === 'thief' && canNab(s, p)) {
    s.steal = { player: p.id, space: p.pos };
    s.phase = 'steal';
    s.movement = undefined;
    s.due = now + 1500;
    log(s, `${NABBER} pops out: “Pay me and I'll nab something for you!”`);
    return;
  }
  if (!s.remaining) landPlayer(s, now, rng);
  else continueWalk(s, now);
}
function resolveDiamond(s: Game, buy: boolean, now: number, rng: () => number) {
  const p = s.players[s.active];
  const landingResolved = s.diamondLandingResolved;
  s.diamondLandingResolved = undefined;
  if (buy) {
    if (p.shells < RULES.pearlPrice)
      throw Error('You need 50 points to buy a diamond.');
    p.shells -= RULES.pearlPrice;
    p.pearls++;
    s.diamondPickup = { player: p.id, space: p.pos, startedAt: now };
    movePearl(s, rng);
    log(
      s,
      p.avatar.name +
        ' bought a diamond for 50 points! A new diamond has appeared.',
    );
    s.effect = {
      id: (s.effect?.id ?? 0) + 1,
      kind: 'diamond',
      player: p.id,
      space: p.pos,
      delta: 1,
    };
    if (s.diamondGoal && p.pearls >= s.diamondGoal) {
      s.phase = 'finished';
      s.finale = { reason: 'goal', startedAt: now, winner: p.id };
      s.movement = undefined;
      log(
        s,
        p.avatar.name + ' reached ' + s.diamondGoal + ' diamonds and wins!',
      );
      return;
    }
  } else {
    log(s, p.avatar.name + ' chose to continue without buying a diamond.');
  }
  if (getBoard(s.boardId).spaces[p.pos].type === 'lottery') {
    openLottery(s, now, rng, !!landingResolved);
  } else if (landingResolved) {
    s.phase = 'landed';
    s.due = Math.max(
      s.presentUntil ?? now,
      now + (p.cpu ? 1800 : RULES.turnTimeout),
    );
  } else if (!s.remaining) landPlayer(s, now, rng);
  else continueWalk(s, now);
}
export function reduceGame(
  state: Game,
  actor: string,
  action: Action,
  now = Date.now(),
  rng: () => number = Math.random,
): Game {
  const migrated = migrateGame(state, now);
  if (migrated !== state) return migrated;
  const BOARD = getBoard(state.boardId).spaces;
  let a = action;
  const current = state.players[state.active];
  if (state.phase === 'bonus') {
    if (a.type !== 'tick' || now < state.due) return state;
    const s = structuredClone(state),
      pending = s.bonuses!.find((b) => !b.awarded);
    if (pending) {
      pending.winners.forEach((id) => {
        s.players.find((p) => p.id === id)!.pearls++;
      });
      pending.awarded = true;
      log(
        s,
        pending.label +
          ': ' +
          (pending.winners
            .map((id) => s.players.find((p) => p.id === id)!.avatar.name)
            .join(', ') || 'No qualifying landings') +
          (pending.winners.length ? ' +1 diamond each.' : '.'),
      );
      s.finale!.startedAt += Math.max(0, now - s.due);
      s.due = now + 5000;
    } else {
      s.phase = 'finished';
      s.finale!.winner = [...s.players].sort(
        (a, b) => b.pearls - a.pearls || b.shells - a.shells,
      )[0].id;
      log(
        s,
        'Bonus ceremony complete! Diamonds decide the champion; points break ties.',
      );
    }
    return s;
  }
  if (state.phase === 'lastTurns') {
    if (a.type !== 'tick' || now < state.due) return state;
    const s = structuredClone(state);
    if (s.lastTurns!.stage === 'standings') awardLastTurns(s, now);
    else beginTurn(s, now);
    return s;
  }
  if (
    a.type === 'tick' &&
    state.phase === 'results' &&
    now >= state.due &&
    actor === 'online'
  ) {
    actor = state.players[0].id;
    a = { type: 'next' };
  }
  if (
    a.type === 'tick' &&
    ['arrival', 'rolling', 'moving', 'fork', 'vote'].includes(state.phase)
  ) {
    if (now < state.due) return state;
    const s = structuredClone(state);
    if (s.phase === 'arrival') {
      beginTurn(s, now);
      return s;
    }
    if (s.phase === 'vote') {
      const v = s.vote!;
      if (v.winner !== undefined) {
        prepareMinigame(s, v.winner, now, Math.floor(rng() * 100000));
        return s;
      }
      s.players.forEach((p, i) => {
        if (
          p.cpu &&
          v.ballots[p.id] === undefined &&
          now >= v.endsAt - 20000 + (i + 1) * 1000
        )
          v.ballots[p.id] = v.choices[Math.floor(rng() * v.choices.length)];
      });
      if (
        now >= v.endsAt ||
        s.players.every((p) => v.ballots[p.id] !== undefined)
      )
        resolveVote(s, now, rng);
      else s.due = Math.min(v.endsAt, now + 500);
      return s;
    }
    if (s.phase === 'fork') {
      const choices = routeChoices(s);
      beginEdge(s, choices[Math.floor(rng() * choices.length)], now);
      return s;
    }
    if (s.phase === 'rolling') continueWalk(s, s.due);
    // Catch up elapsed edges after a delayed poll, stopping at every human fork.
    for (let i = 0; i < 24 && s.phase === 'moving' && now >= s.due; i++)
      arriveAtSpace(s, s.due, rng);
    if (
      (s as Game).phase === 'landed' &&
      s.effect?.startedAt !== undefined &&
      s.effect.startedAt < now
    ) {
      const delay = now - s.effect.startedAt;
      s.effect.startedAt = now;
      s.presentUntil = (s.presentUntil ?? now) + delay;
      s.due += delay;
    }
    if ((s as Game).phase === 'fork' && !s.players[s.active].cpu)
      s.due = now + 30000;
    if (['diamond', 'lottery', 'steal'].includes((s as Game).phase))
      s.due = now + 1500;
    return s;
  }
  if (a.type === 'tick') {
    if (state.phase === 'lottery') {
      if (!current.cpu || now < state.due) return state;
      const s = structuredClone(state),
        l = s.lottery!;
      if (l.stage === 'pick') {
        l.selected = Math.floor(rng() * 16);
        l.stage = 'scratch';
        s.due = now + 1200;
      } else if (l.stage === 'scratch') scratchLottery(s, now);
      else finishLottery(s, now, rng);
      return s;
    }
    if (state.phase === 'diamond') {
      // Human decisions never expire, even after delayed polls or loading a save.
      if (!current.cpu || now < state.due) return state;
      const s = structuredClone(state);
      resolveDiamond(s, current.shells >= RULES.pearlPrice, now, rng);
      return s;
    }
    if (state.phase === 'steal') {
      if (!current.cpu || now < state.due) return state;
      const s = structuredClone(state),
        choice = cpuSteal(s, current);
      resolveSteal(s, choice.value ?? 0, choice.target, now, rng);
      return s;
    }
    if (state.phase === 'minigame') {
      if (actor !== 'online' || now < state.miniStart) return state;
      const s = structuredClone(state);
      s.arcade ??= arenaFor(s, s.mini, s.seed);
      s.miniReady = s.players.filter((p) => !p.cpu).map((p) => p.id);
      const oldTick = s.arcade.tick;
      advanceArena(s.arcade, (now - s.miniStart) / 1000);
      if (s.arcade.done) finishMini(s, now);
      return s.arcade.tick === oldTick && s.phase === 'minigame' ? state : s;
    }
    if (
      (state.phase === 'turn' || state.phase === 'landed') &&
      now >= state.due
    ) {
      actor = current.id;
      a = {
        type: state.phase === 'turn' ? 'roll' : 'end',
      };
    } else return state;
  }
  if (state.phase === 'finished') return state;
  const s = structuredClone(state),
    p = s.players.find((x) => x.id === actor);
  if (!p) throw Error('Player not found.');
  if (a.type === 'vote') {
    if (
      s.phase !== 'vote' ||
      !s.vote ||
      s.vote.winner !== undefined ||
      a.voteId !== s.vote.id ||
      now >= s.vote.endsAt
    )
      return state;
    if (!Number.isInteger(a.value) || !s.vote.choices.includes(a.value!))
      throw Error('Choose one of these three minigames.');
    if (s.vote.ballots[p.id] === a.value) return state;
    s.vote.ballots[p.id] = a.value!;
    if (s.players.every((p) => s.vote!.ballots[p.id] !== undefined))
      resolveVote(s, now, rng);
    return s;
  }
  if (a.type === 'ready') {
    if (s.phase !== 'minigame') return state;
    s.miniReady ??= [];
    if (s.miniReady.includes(actor)) return state;
    s.miniReady.push(actor);
    if (
      s.players
        .filter((p) => !p.cpu)
        .every((p) => s.miniReady!.includes(p.id)) &&
      (s.arcade?.time ?? 0) === 0
    )
      s.miniStart = now + 3000;
    return s;
  }
  if (a.type === 'control') {
    if (
      s.phase !== 'minigame' ||
      p.cpu ||
      now < s.miniStart ||
      a.miniStart !== s.miniStart ||
      !a.control
    )
      return state;
    s.arcade ??= arenaFor(s, s.mini, s.seed);
    const before = s.arcade.tick;
    advanceArena(s.arcade, (now - s.miniStart) / 1000);
    if (s.arcade.done) {
      finishMini(s, now);
      return s;
    }
    const changed = setControl(s.arcade, actor, a.control);
    return changed || s.arcade.tick !== before ? s : state;
  }
  if (a.type === 'arcadeResult') {
    if (s.phase !== 'minigame' || actor !== s.players[0].id) return state;
    if (
      !a.scores ||
      a.scores.length !== s.players.length ||
      a.scores.some((n) => !Number.isFinite(n) || n < 0 || n > 200000)
    )
      throw Error('Invalid minigame results.');
    finishMini(s, now, a.scores);
    return s;
  }
  if (a.type === 'next') {
    if (s.phase !== 'results') return state;
    if (s.practice) {
      s.phase = 'finished';
      return s;
    }
    if (s.round >= s.rounds) {
      s.phase = 'bonus';
      s.finale = { reason: 'bonuses', startedAt: now };
      s.bonuses = [
        {
          label: 'Point Collector',
          values: s.players.map((p) => p.shells),
          requireLanding: false,
        },
        {
          label: 'Rough Landing',
          values: s.players.map((p) => p.stats?.lossSpaces ?? 0),
          requireLanding: true,
        },
        {
          label: 'Event Explorer',
          values: s.players.map((p) => p.stats?.eventSpaces ?? 0),
          requireLanding: true,
        },
      ].map(({ label, values, requireLanding }) => {
        const value = Math.max(...values);
        return {
          label,
          value,
          winners:
            requireLanding && value === 0
              ? []
              : s.players
                  .filter((_, i) => values[i] === value)
                  .map((p) => p.id),
          awarded: false,
        };
      });
      s.due = now + 16000;
      log(
        s,
        'All aboard! Three bonus diamonds will be awarded in the ship lounge. Ties share the award.',
      );
    } else {
      s.round++;
      s.active = 0;
      s.players.forEach((x) => {
        x.used = false;
        x.color = undefined;
      });
      if (
        !s.lastTurns &&
        s.rounds > lastTurnsCount(s.rounds) &&
        s.round === lastTurnsRound(s.rounds)
      )
        startLastTurns(s, now, rng);
      else beginTurn(s, now);
    }
    return s;
  }
  if (p.id !== current.id) throw Error('Wait for your turn.');
  if (['lotteryPick', 'lotteryScratch', 'lotteryContinue'].includes(a.type)) {
    const l = s.lottery;
    if (
      s.phase !== 'lottery' ||
      !l ||
      l.id !== a.lotteryId ||
      l.player !== p.id
    )
      return state;
    if (a.type === 'lotteryPick' && l.stage === 'pick') {
      if (!Number.isInteger(a.value) || a.value! < 0 || a.value! > 15)
        throw Error('Choose one of the 16 cards.');
      l.selected = a.value;
      l.stage = 'scratch';
      s.due = now + 1200;
    } else if (a.type === 'lotteryScratch') scratchLottery(s, now);
    else if (a.type === 'lotteryContinue') finishLottery(s, now, rng);
    return s;
  }
  if (a.type === 'diamond') {
    if (s.phase !== 'diamond' || p.pos !== s.pearl) return state;
    if (a.value !== 0 && a.value !== 1) throw Error('Choose buy or continue.');
    resolveDiamond(s, a.value === 1, now, rng);
    return s;
  }
  if (a.type === 'steal') {
    if (s.phase !== 'steal' || s.steal?.player !== p.id) return state;
    if (![0, 1, 2].includes(a.value ?? -1))
      throw Error('Choose points, a diamond, or no thanks.');
    resolveSteal(s, a.value!, a.target, now, rng);
    return s;
  }
  if (a.type === 'route') {
    if (s.phase !== 'fork') return state;
    if (!routeChoices(s).includes(a.value!))
      throw Error('Choose a road at this fork.');
    beginEdge(s, a.value!, now);
    return s;
  }
  if ((a.type === 'roll' || a.type === 'use') && now < (s.announce?.until ?? 0))
    return state;
  if (a.type === 'use') {
    if (s.phase !== 'turn' || p.used)
      throw Error('Use one item before rolling.');
    const ix = p.items.indexOf(a.item ?? '');
    if (a.item === 'five' && (p.lotteryBoosts ?? 0) > 0) p.lotteryBoosts!--;
    else {
      if (ix < 0) throw Error('You do not have that item.');
      p.items.splice(ix, 1);
    }
    p.used = true;
    switch (a.item) {
      case 'boost':
        p.boost = 3;
        break;
      case 'five':
        p.boost = 5;
        break;
      case 'double':
        p.double = true;
        break;
      case 'magnet':
        p.shells += 8;
        break;
      case 'warp':
        p.pos = BOARD.find((b) => b.next.includes(s.pearl))?.id ?? 0;
        break;
      case 'steal': {
        const rival = s.players
          .filter((x) => x.id !== p.id)
          .sort((a, b) => b.shells - a.shells)[0];
        const n = Math.min(5, rival.shells);
        rival.shells -= n;
        p.shells += n;
        break;
      }
      case 'shield':
        p.shield = true;
        break;
      case 'mini':
      case 'mega':
        p.size = a.item;
        pushEvent(s, {
          kind: 'size',
          player: p.id,
          space: p.pos,
          delta: 0,
          text:
            a.item === 'mini'
              ? `${p.avatar.name} shrank down!`
              : `${p.avatar.name} grew GIGANTIC!`,
          at: now,
        });
        break;
    }
    log(
      s,
      `${p.avatar.name} used ${ITEMS.find((i) => i.id === a.item)?.name}.`,
    );
    if (a.item === 'warp' && BOARD[p.pos].type === 'lottery') {
      openLottery(s, now, rng);
      s.lottery!.resumeTurn = true;
    }
    return s;
  }
  if (a.type === 'buy') {
    const item = ITEMS.find((i) => i.id === a.item);
    if (
      s.phase !== 'landed' ||
      BOARD[p.pos].type !== 'shop' ||
      s.bought ||
      !item ||
      !(s.shopStock ?? ITEMS.slice(0, 5).map((i) => i.id)).includes(a.item!)
    )
      throw Error('Visit a shop to buy one item.');
    if (p.items.length >= RULES.inventorySize) throw Error('Your bag is full.');
    if (p.shells < item.cost) throw Error('Not enough points.');
    p.shells -= item.cost;
    p.items.push(item.id);
    s.bought = true;
    log(s, `${p.avatar.name} bought ${item.name}.`);
    return s;
  }
  if (a.type === 'roll') {
    if (s.phase !== 'turn') return state;
    const choice = p.cpu && !p.used ? cpuItem(s, p) : undefined;
    if (choice) {
      const used = reduceGame(s, p.id, { type: 'use', item: choice }, now, rng);
      return reduceGame(used, p.id, a, now, rng);
    }
    const values = [
      rollDie(rng, p.size === 'mini' ? RULES.miniDiceSides : RULES.diceSides),
    ];
    if (p.double || p.size === 'mega') values.push(rollDie(rng));
    s.stomped = [];
    const bonus = p.boost,
      total = values.reduce((a, b) => a + b, 0) + bonus;
    p.double = false;
    p.boost = 0;
    s.departed ??= Object.fromEntries(
      s.round > 1 ? s.players.map((p) => [p.id, 0]) : [],
    );
    const first = s.departed[p.id] === undefined;
    if (first) {
      s.departed[p.id] = now;
      if (s.players.every((q) => s.departed![q.id] !== undefined))
        s.rampClosesAt = now + 4000;
    }
    const startedAt = now + (first ? 1200 : 0);
    s.dice = {
      values,
      bonus,
      startedAt,
      revealAt: startedAt + 1700,
      until: startedAt + 2800,
    };
    s.lastRoll = total;
    s.remaining = total;
    s.path = [p.pos];
    s.turnShells = p.shells;
    s.turnDiamonds = p.pearls;
    s.phase = 'rolling';
    s.due = s.dice.until;
    log(
      s,
      p.avatar.name +
        ' rolled ' +
        total +
        (bonus ? ' (including +' + bonus + ' boost).' : '.'),
    );
    return s;
  }
  if (a.type === 'end') {
    if (s.phase !== 'landed' || now < (s.presentUntil ?? 0)) return state;
    if (
      p.cpu &&
      BOARD[p.pos].type === 'shop' &&
      !s.bought &&
      p.items.length < RULES.inventorySize
    ) {
      const stock = ITEMS.filter(
        (i) =>
          (s.shopStock ?? ITEMS.slice(0, 5).map((j) => j.id)).includes(i.id) &&
          i.cost <= p.shells,
      );
      const item = stock[Math.floor(rng() * stock.length)];
      if (item) {
        p.shells -= item.cost;
        p.items.push(item.id);
        log(s, `${p.avatar.name} bought ${item.name}.`);
      }
    }
    nextBoardTurn(s, now, rng);
    return s;
  }
  return state;
}
/** Upgrade device/room saves once; board prizes and balances are never replayed. */
export function migrateGame(state: Game, now = Date.now()): Game {
  if (state.contentRevision === 10) return state;
  const s = structuredClone(state);
  // Revision 10 adds team colors, steals, villain spaces and size items;
  // all new fields are optional, so older saves only need the stamp.
  s.contentRevision = 10;
  const savedPool = s.minigamePool?.filter((id) =>
    AVAILABLE_ARCADE.some((m) => m.id === id),
  );
  s.minigamePool = normalizeMinigamePool(
    savedPool?.length ? savedPool : undefined,
  );
  const pool = AVAILABLE_ARCADE.filter((m) =>
    s.minigamePool!.includes(m.id),
  ).map((m) => m.index);
  if (
    s.phase === 'landed' &&
    getBoard(s.boardId).spaces[s.players[s.active].pos].type === 'shop' &&
    !s.shopStock
  )
    s.shopStock = randomShopStock(() => 0.37);
  s.players.forEach((p) => {
    p.stats ??= { lossSpaces: 0, eventSpaces: 0 };
  });
  s.miniOrder = s.miniOrder?.filter(
    (n, i, a) => pool.includes(n) && a.indexOf(n) === i,
  );
  if (
    s.phase === 'vote' &&
    (!s.vote?.choices.length || s.vote.choices.some((n) => !pool.includes(n)))
  ) {
    startMini(s, now, () => 0.37);
    log(s, 'The minigame roster changed. A fresh ballot is ready.');
  }
  if (
    s.phase === 'minigame' &&
    (!pool.includes(s.mini) ||
      (OVERHAUL.includes(arcadeInfo(s.mini).id)
        ? !s.arcade?.overhaul
        : remixInfo(arcadeInfo(s.mini).id) && !s.arcade?.remix))
  ) {
    prepareMinigame(s, pool.includes(s.mini) ? s.mini : pool[0], now, s.seed);
    log(
      s,
      'This minigame has new rules. Its briefing restarted; your board points and diamonds are preserved.',
    );
  }
  return s;
}
export function validateAvatar(v: unknown): Avatar {
  const a = v as Avatar;
  if (
    !a ||
    typeof a.name !== 'string' ||
    !(COLORS.includes(a.skin) || a.skin === ALIEN_SKIN) ||
    !OUTFITS.includes(a.shirt)
  )
    throw Error('Invalid character.');
  for (const [key, max] of [
    ['hair', 7],
    ['eyes', 3],
    ['mouth', 2],
    ['accessory', 6],
  ] as const) {
    if (!Number.isInteger(a[key]) || a[key] < 0 || a[key] > max)
      throw Error('Invalid character option.');
  }
  if (
    !Number.isFinite(a.height) ||
    a.height < 0.75 ||
    a.height > 1.25 ||
    !Number.isFinite(a.width) ||
    a.width < 0.75 ||
    a.width > 1.25
  )
    throw Error('Invalid character proportions.');
  for (const key of ['hairColor', 'eyeColor', 'shoeColor'] as const)
    if (a[key] !== undefined && !/^#[0-9a-f]{6}$/i.test(a[key]!))
      throw Error('Invalid character color.');
  for (const [key, max] of [
    ['pattern', 4],
    ['brows', 3],
    ['nose', 3],
    ['beard', 2],
  ] as const)
    if (
      a[key] !== undefined &&
      (!Number.isInteger(a[key]) || a[key]! < 0 || a[key]! > max)
    )
      throw Error('Invalid detail option.');
  for (const [key, min, max] of [
    ['eyeSpacing', 0.12, 0.24],
    ['mouthScale', 0.7, 1.5],
  ] as const)
    if (
      a[key] !== undefined &&
      (!Number.isFinite(a[key]) || a[key]! < min || a[key]! > max)
    )
      throw Error('Invalid face proportion.');
  for (const key of ['freckles', 'gloves'] as const)
    if (a[key] !== undefined && typeof a[key] !== 'boolean')
      throw Error('Invalid character detail.');
  return {
    ...DEFAULT_AVATAR,
    ...a,
    skin: ALIEN_SKIN,
    name: a.name.trim().slice(0, 18) || 'Frankie',
  };
}
