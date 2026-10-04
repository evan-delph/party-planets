/** v0.7 economy, save migration and physically simulated minigame regressions. */
import assert from 'node:assert/strict';
import { BOARDS, getBoard } from '../game/boards';
import { DEFAULT_AVATAR, MINIGAMES } from '../game/config';
import {
  migrateGame,
  newGame,
  player,
  prepareMinigame,
  reduceGame,
  type Game,
} from '../game/engine';
import { ALL_ARCADE, ARCADE, arcadeInfo } from '../game/arcade/catalog';
import { REMIX_IDS, remixInfo } from '../game/arcade/remix-catalog';
import { skiRocks } from '../game/arcade/remix';
import {
  advanceArena,
  createArena,
  setControl,
  stepArena,
  type Arena,
  type Control,
} from '../game/arcade/simulation';

let checks = 0;
function check(value: unknown, message: string) {
  checks++;
  assert.ok(value, message);
}
function equal(actual: unknown, expected: unknown, message: string) {
  checks++;
  assert.deepEqual(actual, expected, message);
}
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const rng = () => 0.37;
const NOW = 100000;
function fresh(board = 'crown', goal = 0) {
  const players = [0, 1, 2, 3].map((i) =>
    player('p' + i, { ...DEFAULT_AVATAR, name: 'Alien ' + i }),
  );
  return newGame(DEFAULT_AVATAR, 5, 1, players, board, goal);
}
/** Points, diamonds and items without positions (v0.8 layouts reset positions). */
function possessions(g: Game) {
  return wallets(g).map(({ pos: _pos, ...rest }) => rest);
}
function wallets(g: Game) {
  return g.players.map((p) => ({
    points: p.shells,
    diamonds: p.pearls,
    items: p.items,
    pos: p.pos,
  }));
}
function edge(g: Game, to: number, remaining = 1, at = NOW) {
  const board = getBoard(g.boardId);
  const from = board.spaces.find((n) => n.next.includes(to))!.id;
  g.players[g.active].pos = from;
  g.phase = 'moving';
  g.path = [from];
  g.remaining = remaining;
  g.movement = { from, to, startedAt: at - 500, arrivesAt: at };
  g.due = at;
  g.pearl = board.spaces.find((n) => n.type === 'blue' && n.id !== to)!.id;
  return g;
}
function land(g: Game, kind: string, at = NOW) {
  edge(g, getBoard(g.boardId).spaces.find((n) => n.type === kind)!.id, 1, at);
  return reduceGame(g, '', { type: 'tick' }, at, rng);
}

equal(ARCADE.length, 30, 'The active arcade contains exactly thirty games');
equal(
  MINIGAMES.length,
  30,
  'Board ballots and the arcade use the same active roster',
);
equal(
  ARCADE.slice(0, 12).map((m) => m.id),
  [
    'canopy',
    'bumper',
    'rope',
    'coconut',
    'race',
    'duos',
    'sky',
    'bomb',
    'paint',
    'dig',
    'skate',
    'factory',
  ],
  'The original twelve games remain',
);
equal(
  ARCADE.slice(12).map((m) => m.id),
  [...REMIX_IDS],
  'All eighteen retained later games use the new mechanics',
);
equal(
  new Set(ARCADE.map((m) => m.id)).size,
  30,
  'Every active game has a distinct identity',
);
check(
  ALL_ARCADE.length >= 50 && arcadeInfo(47).id !== ARCADE[0].id,
  'Retired games retain metadata for completed saved results',
);
equal(BOARDS.length, 4, 'Four hand-designed boards are available');

for (const board of BOARDS) {
  const g = fresh(board.id),
    event = board.spaces.find((n) => n.type === 'event')!;
  edge(g, event.id);
  g.bank = 37;
  const ordered = [...board.spaces].sort(
    (a, b) =>
      Math.hypot(a.x - board.landmark.x, a.z - board.landmark.z) -
      Math.hypot(b.x - board.landmark.x, b.z - board.landmark.z),
  );
  g.players[1].pos = ordered[0].id;
  g.players[2].pos = ordered.at(-1)!.id;
  g.players.forEach((p, i) => {
    p.shells = i === 3 ? 0 : 100;
  });
  delete g.players[0].stats;
  const original = copy(g),
    next = reduceGame(g, '', { type: 'tick' }, NOW, rng);
  equal(g, original, board.id + ': event reduction does not mutate the input');
  equal(next.bank, 37, board.id + ': event losses never enter the bank');
  equal(
    next.effect?.losses?.length,
    4,
    board.id + ': all four players receive loss payloads',
  );
  const losses = next.effect!.losses!;
  check(
    losses.every(
      (l, i) =>
        Number.isInteger(l.delta) &&
        l.delta <= 0 &&
        -l.delta <= 20 &&
        -l.delta <= original.players[i].shells,
    ),
    board.id + ': losses are capped and cannot overdraw wallets',
  );
  equal(
    next.players.map((p, i) => p.shells - original.players[i].shells),
    losses.map((l) => l.delta || 0),
    board.id + ': presentation matches actual point deductions',
  );
  check(
    -losses[1].delta >= -losses[2].delta,
    board.id + ': distance weakens the event penalty',
  );
  equal(
    next.players[0].stats,
    { lossSpaces: 1, eventSpaces: 1 },
    board.id + ': the actual triggering loss counts once',
  );
  check(
    next.players
      .slice(1)
      .every((p) => p.stats?.lossSpaces === 0 && p.stats.eventSpaces === 0),
    board.id + ': bystander damage is not a landing statistic',
  );
  equal(next.players[3].shells, 0, board.id + ': an empty wallet stays empty');
  check(
    next.presentUntil! >= NOW + 7000,
    board.id + ': the board event has presentation time',
  );
  check(
    reduceGame(next, '', { type: 'tick' }, NOW, rng) === next,
    board.id + ': a duplicate tick does not repeat the event',
  );
  const empty = fresh(board.id);
  empty.players[0].shells = 0;
  equal(
    land(empty, 'event').players[0].stats,
    { lossSpaces: 0, eventSpaces: 1 },
    board.id + ': a zero-wallet event still counts as an event visit',
  );
}

for (const kind of ['red', 'hazard'])
  for (const [balance, shield, expected] of [
    [0, false, 0],
    [2, false, 1],
    [50, true, 0],
  ] as const) {
    const g = fresh();
    g.players[0].shells = balance;
    g.players[0].shield = shield;
    const next = land(g, kind);
    equal(
      next.players[0].stats?.lossSpaces,
      expected,
      kind + ': only an actual landing deduction counts',
    );
    equal(
      next.players[0].stats?.eventSpaces,
      0,
      kind + ': ordinary loss spaces are not global events',
    );
    check(
      next.players[0].shells >= 0,
      kind + ': penalties cannot make money negative',
    );
  }
const small = fresh();
small.players.forEach((p) => (p.shells = 2));
check(
  land(small, 'event').players.every((p) => p.shells >= 0),
  'Global events preserve low-balance wallet bounds',
);
const stolen = fresh();
stolen.players.forEach((p) => (p.shells = 100));
check(
  land(stolen, 'thief').players.every((p) => p.stats?.lossSpaces === 0),
  'Theft is not a money-loss-space visit',
);
const bank = fresh();
bank.bank = 23;
bank.players[0].shells = 5;
const paid = land(bank, 'bank');
equal(
  [paid.players[0].shells, paid.bank, paid.effect?.delta],
  [28, 0, 23],
  'The jackpot transfers the whole pot and exposes its real amount',
);
equal(
  paid.players[0].stats,
  { lossSpaces: 0, eventSpaces: 0 },
  'Bank transactions do not change landing bonus counters',
);
const passing = fresh();
passing.bank = 23;
passing.players[0].shells = 2;
edge(passing, getBoard().spaces.find((n) => n.type === 'bank')!.id, 2);
const deposited = reduceGame(passing, '', { type: 'tick' }, NOW, rng);
equal(
  [
    deposited.players[0].shells,
    deposited.bank,
    deposited.players[0].stats?.lossSpaces,
  ],
  [0, 25, 0],
  'Passing deposits only available points and does not count as a loss landing',
);
const delayed = fresh();
edge(delayed, getBoard().spaces.find((n) => n.type === 'event')!.id, 1, 1000);
const caughtUp = reduceGame(delayed, '', { type: 'tick' }, NOW, rng);
check(
  caughtUp.presentUntil! >= NOW + 7000,
  'Background catch-up preserves a full event presentation interval',
);

const goal = fresh('crown', 1);
goal.players[0].shells = 60;
const diamondSpace = goal.pearl;
edge(goal, diamondSpace, 3);
goal.pearl = diamondSpace;
const decision = reduceGame(goal, '', { type: 'tick' }, NOW, rng);
equal(
  decision.phase,
  'diamond',
  'The winning diamond still requires a purchase decision',
);
const won = reduceGame(decision, 'p0', { type: 'diamond', value: 1 }, NOW, rng);
equal(
  [
    won.phase,
    won.finale?.reason,
    won.finale?.winner,
    won.players[0].shells,
    won.players[0].pearls,
  ],
  ['finished', 'goal', 'p0', 10, 1],
  'Meeting the diamond goal finishes immediately before remaining board movement',
);
check(
  !won.bonuses && !won.movement && won.diamondPickup?.player === 'p0',
  'An immediate victory retains its purchase presentation without a bonus ceremony',
);
check(
  !won.players.some((p) => p.pos === won.pearl),
  'The replacement diamond avoids every occupied space',
);
check(
  reduceGame(won, '', { type: 'tick' }, NOW + 999999, rng) === won,
  'Completed goal wins cannot gain extra rewards',
);

const finale = fresh();
finale.round = finale.rounds;
finale.players.forEach((p, i) => {
  p.shells = [10, 14, 1, 0][i];
  p.pearls = [2, 1, 0, 0][i];
  p.stats = { lossSpaces: [2, 4, 4, 0][i], eventSpaces: [5, 0, 5, 0][i] };
});
prepareMinigame(finale, 0, NOW - 20000, 123);
const results = reduceGame(
  finale,
  'p0',
  { type: 'arcadeResult', scores: [9, 3, 0, 0] },
  NOW,
  rng,
);
equal(
  results.players.map((p) => p.shells),
  [20, 20, 4, 3],
  'Final minigame prizes are applied before bonus comparisons',
);
let ceremony = reduceGame(results, 'p0', { type: 'next' }, NOW, rng);
equal(
  ceremony.bonuses?.map((b) => ({ value: b.value, winners: b.winners })),
  [
    { value: 20, winners: ['p0', 'p1'] },
    { value: 4, winners: ['p1', 'p2'] },
    { value: 5, winners: ['p0', 'p2'] },
  ],
  'Bonus snapshots include every tied qualifying player',
);
equal(
  ceremony.players.map((p) => p.pearls),
  [2, 1, 0, 0],
  'Boarding the ship does not award diamonds prematurely',
);
check(
  reduceGame(ceremony, '', { type: 'tick' }, ceremony.due - 1, rng) ===
    ceremony,
  'The ceremony waits until its first reveal',
);
const snapshot = copy(
  ceremony.bonuses!.map(({ awarded: _awarded, ...b }) => b),
);
for (let category = 0; category < 3; category++) {
  const before = ceremony,
    at = before.due + (category === 0 ? 100000 : 0);
  ceremony = reduceGame(before, '', { type: 'tick' }, at, rng);
  equal(
    ceremony.bonuses!.filter((b) => b.awarded).length,
    category + 1,
    'Each reveal awards exactly one category',
  );
  equal(
    before.bonuses!.filter((b) => b.awarded).length,
    category,
    'A bonus reveal preserves its input state',
  );
  equal(
    ceremony.bonuses!.map(({ awarded: _awarded, ...b }) => b),
    snapshot,
    'Awarding diamonds never changes comparison snapshots',
  );
  check(
    ceremony.due >= at + 5000,
    'Even an overdue reveal keeps the next reveal visible',
  );
  check(
    reduceGame(ceremony, '', { type: 'tick' }, at, rng) === ceremony,
    'Duplicate reveal ticks never award a category twice',
  );
  ceremony = copy(ceremony);
}
equal(
  ceremony.players.map((p) => p.pearls),
  [4, 3, 2, 0],
  'Tied category awards accumulate exactly once after serialized resume',
);
ceremony = reduceGame(ceremony, '', { type: 'tick' }, ceremony.due, rng);
equal(
  [ceremony.phase, ceremony.finale?.winner],
  ['finished', 'p0'],
  'The final standings use the awarded diamond totals',
);
check(
  reduceGame(ceremony, '', { type: 'tick' }, ceremony.due + 999999, rng) ===
    ceremony,
  'A finished ceremony cannot repeat awards',
);
const zero = fresh();
zero.phase = 'results';
zero.round = zero.rounds;
zero.players.forEach((p) => {
  p.shells = 0;
  delete p.stats;
});
let noVisits = reduceGame(zero, 'p0', { type: 'next' }, NOW, rng);
equal(
  noVisits.bonuses?.map((b) => b.winners),
  [['p0', 'p1', 'p2', 'p3'], [], []],
  'Zero points may tie, but zero qualifying loss/event visits award nobody',
);
for (let n = 0; n < 4; n++)
  noVisits = reduceGame(noVisits, '', { type: 'tick' }, noVisits.due, rng);
equal(
  noVisits.players.map((p) => p.pearls),
  [1, 1, 1, 1],
  'Absent landing categories do not grant phantom diamonds',
);

function legacy() {
  const g = fresh();
  delete g.contentRevision;
  g.bank = 29;
  g.players.forEach((p, i) => {
    p.shells = 7 + i * 19;
    p.pearls = i;
    p.score = 101 + i;
    p.pos = i + 5;
    delete p.stats;
  });
  return g;
}
for (const resolved of [false, true]) {
  const g = legacy();
  g.phase = 'vote';
  g.miniOrder = [40, 5, 5, 29];
  g.vote = {
    id: 'legacy-vote',
    choices: [27, 40, 49],
    ballots: { p0: 40 },
    endsAt: NOW + 1000,
    ...(resolved ? { winner: 40, resolvedAt: NOW - 100 } : {}),
  };
  const original = copy(g),
    updated = migrateGame(g, NOW);
  equal(g, original, 'Migration does not mutate a saved snapshot');
  // v0.8 replaced every board layout, so pre-revision-11 saves restart at the
  // landing pad while keeping points, diamonds and items.
  equal(
    wallets(updated),
    wallets(g).map((w) => ({ ...w, pos: 0 })),
    'Refreshing an old ballot preserves possessions and returns the crew to the pad',
  );
  equal(updated.bank, 29, 'Migration preserves the shared bank');
  check(
    updated.vote?.id !== g.vote.id &&
      new Set(updated.vote?.choices).size === 3 &&
      updated.vote!.choices.every((i) => i >= 0 && i < 30),
    'Retired vote choices become a fresh legal ballot',
  );
  check(
    updated.vote?.winner === undefined,
    'A retired resolved vote cannot launch an invalid catalog index',
  );
  check(migrateGame(updated, NOW + 1) === updated, 'Migration is idempotent');
}
const oldRemix = legacy();
oldRemix.phase = 'minigame';
oldRemix.mini = 12;
oldRemix.arcade = createArena(12, oldRemix.players, 1, 123);
delete oldRemix.arcade.remix;
const restarted = migrateGame(oldRemix, NOW);
equal(
  possessions(restarted),
  possessions(oldRemix),
  'Restarting changed mechanics never replays board rewards',
);
check(
  restarted.arcade?.remix &&
    restarted.arcade.tick === 0 &&
    restarted.miniStart > NOW,
  'An incompatible active remix restarts at its new briefing',
);
const oldResults = legacy();
oldResults.phase = 'results';
oldResults.mini = 47;
oldResults.due = NOW - 1;
const retained = migrateGame(oldResults, NOW);
equal(
  [retained.phase, retained.mini, retained.players.map((p) => p.score)],
  ['results', 47, oldResults.players.map((p) => p.score)],
  'Retired completed results retain their identity and recorded scores',
);
equal(
  possessions(retained),
  possessions(oldResults),
  'Retired results keep their already-paid prizes',
);
const nextRound = reduceGame(retained, 'online', { type: 'tick' }, NOW, rng);
equal(
  wallets(nextRound),
  wallets(retained),
  'Continuing migrated results does not pay prizes twice',
);
const retiredLive = legacy();
retiredLive.phase = 'minigame';
retiredLive.mini = 47;
retiredLive.arcade = createArena(47, retiredLive.players, 1, 456);
equal(
  migrateGame(retiredLive, NOW).arcade!.kind,
  'canopy',
  'Removed live games safely restart at an enabled briefing',
);

function arena(id: string, difficulty = 1, seed = 123, cpu = true): Arena {
  const index = ARCADE.findIndex((m) => m.id === id);
  const w = createArena(
    index,
    [0, 1, 2, 3].map((i) => ({ id: 'p' + i, cpu })),
    difficulty,
    seed,
  );
  check(
    index >= 0 && (!!w.remix || !!w.overhaul),
    id + ': creation routes into the dedicated simulation',
  );
  return w;
}
function finite(value: unknown): boolean {
  return typeof value === 'number'
    ? Number.isFinite(value)
    : !value || typeof value !== 'object' || Object.values(value).every(finite);
}
let cpuRuns = 0;
for (const id of REMIX_IDS)
  for (const difficulty of [0, 1, 2])
    for (const seed of [17, 123]) {
      const w = arena(id, difficulty, seed);
      advanceArena(w, 6.25);
      const replay = copy(w);
      advanceArena(w, w.duration + 10);
      for (let t = 6.62; t < replay.duration && !replay.done; t += 0.37)
        advanceArena(replay, t);
      advanceArena(replay, replay.duration);
      cpuRuns++;
      check(
        w.done && w.time <= w.duration && finite(w),
        id + ': CPU play finishes with finite state',
      );
      equal(
        replay,
        w,
        id +
          ': serialized replay and differently sized tick batches have identical results',
      );
      if (remixInfo(id)!.teams)
        equal(
          [w.actors[0].score, w.actors[2].score],
          [w.actors[1].score, w.actors[3].score],
          id + ': team partners share final scores',
        );
      if (id === 'prickleice')
        check(
          w.actors.some((p) => p.finish > 0 && p.distance >= 240),
          'CPU skiers can complete the actual downhill course',
        );
      if (id === 'geckograffiti')
        check(
          w.actors.every((p) => p.finish > 0),
          'CPU teams retrieve relics and reach the shrine',
        );
      const done = copy(w);
      advanceArena(w, 9999);
      equal(w, done, id + ': completed simulations remain frozen');
    }
function hold(w: Arena, id: string, c: Partial<Control>, frames: number) {
  for (let n = 0; n < frames; n++) {
    if (n % 6 === 0) {
      const p = w.actors.find((a) => a.id === id)!;
      setControl(w, id, {
        x: 0,
        z: 0,
        a: false,
        b: false,
        ...c,
        seq: p.input.seq + 1,
      });
    }
    stepArena(w);
  }
}
const poles = arena('prickleice', 1, 17, false),
  coasting = arena('prickleice', 1, 17, false);
hold(poles, 'p0', { a: true, ap: 1 }, 90);
hold(coasting, 'p0', {}, 90);
check(
  poles.actors[0].distance > coasting.actors[0].distance + 0.3,
  'Holding poles produces measurable downhill acceleration',
);
const rocks = skiRocks(17);
check(
  rocks.length >= 20 && new Set(rocks.map((o) => o.d)).size === rocks.length,
  'The ski course has separate collision obstacles down the slope',
);
const boat = arena('mangrovemotors', 1, 17, false),
  oldZ = boat.actors[0].z;
hold(boat, 'p0', { z: -1, a: true, ap: 1 }, 60);
check(boat.actors[0].z < oldZ - 2, 'Held throttle and steering move the boat');
const puzzle = arena('hotelhiccup', 1, 17, false),
  rot = puzzle.remix!.seats[0].rot[0];
hold(puzzle, 'p0', { b: true, bp: 1 }, 60);
equal(
  puzzle.remix!.seats[0].rot[0],
  (rot + 1) % 4,
  'Held rotation produces one action edge',
);
hold(puzzle, 'p0', { bp: 1 }, 12);
hold(puzzle, 'p0', { b: true, bp: 2 }, 12);
equal(
  puzzle.remix!.seats[0].rot[0],
  (rot + 2) % 4,
  'Release and press creates another rotation',
);
const shot = arena('crumbleclock', 1, 17, false);
hold(shot, 'p0', { a: true, ap: 1 }, 15);
check(
  shot.actors[0].y > 0 && shot.remix!.serial === 0,
  'Holding jump does not automatically fire',
);
hold(shot, 'p0', { ap: 1 }, 1);
hold(shot, 'p0', { a: true, ap: 2 }, 1);
check(
  shot.remix!.objects.some((o) => o.kind === 'ball' && o.owner === 0),
  'A second airborne press shoots',
);
const lastShot = arena('crumbleclock', 1, 17, false);
lastShot.tick = 35 * 60 - 1;
lastShot.time = lastShot.tick / 60;
lastShot.remix!.objects.push({
  id: 1,
  kind: 'ball',
  x: -0.1 + Math.sin(35 * 1.2) * 1.7,
  z: -0.99,
  y: 1,
  vx: 0,
  vz: -12,
  vy: 0,
  r: 0.2,
  owner: 0,
  value: 1,
  life: 3,
});
stepArena(lastShot);
equal(
  [lastShot.done, lastShot.actors[0].score],
  [true, 1],
  'A final-frame basket contributes to the final result',
);
const gust = arena('frostyfreight', 1, 17, false);
gust.tick = 264;
gust.time = 4.4;
gust.actors.forEach((p) => (p.distance = 22));
for (let i = 0; i < 3; i++) stepArena(gust);
equal(
  gust.actors.map((p) => p.distance),
  [20, 20, 20, 20],
  'A gust drops a team to its ledge once',
);
const waves = arena('boulderbuffet');
advanceArena(waves, 12);
check(
  waves.remix!.serial > 10,
  'CPU attackers keep creating waves after their first landing',
);
const idleHeats = arena('boulderbuffet', 1, 17, false);
advanceArena(idleHeats, idleHeats.duration);
equal(
  idleHeats.actors.map((p) => p.score),
  [13, 13, 13, 13],
  'Every solo role receives equal survival time',
);
const parcels = arena('returnsender', 1, 17, false);
advanceArena(parcels, parcels.duration);
check(
  parcels.done &&
    parcels.time < 25 &&
    Math.max(...parcels.remix!.teamPoints) === 10,
  'A defeated depot stops the match and further delivery scoring',
);
const mixed = arena('geckograffiti');
mixed.actors[0].cpu = false;
mixed.actors[0].x = mixed.actors[0].z = 0;
mixed.remix!.seats[0].carrying = 1;
mixed.remix!.objects = mixed.remix!.objects.filter(
  (o) => !(o.owner === 0 && o.value === 1),
);
advanceArena(mixed, mixed.duration);
check(
  mixed.remix!.seats[1].carrying === 0 && mixed.actors[1].finish > 0,
  'A CPU partner finds the remaining relic when the human takes its preferred one',
);
const easy = arena('vinevault', 0),
  hard = arena('vinevault', 2);
advanceArena(easy, easy.duration);
advanceArena(hard, hard.duration);
check(
  Math.min(...hard.actors.map((p) => p.score)) >
    Math.max(...easy.actors.map((p) => p.score)),
  'Hard leaf-climbing opponents outperform Easy opponents',
);

console.log(
  `Party Planets v0.7: ${checks} assertions passed; ${cpuRuns} CPU completion/replay cases.`,
);
