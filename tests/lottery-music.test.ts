import assert from 'node:assert/strict';
import {
  newGame,
  reduceGame,
  migrateGame,
  randomShopStock,
  type Game,
  type Action,
} from '../game/engine';
import { BOARDS, getBoard } from '../game/boards';
import { DEFAULT_AVATAR, ITEMS, MINIGAMES } from '../game/config';
import { musicScore } from '../game/useMusic';
import {
  createArena,
  advanceArena,
  stepArena,
  setControl,
} from '../game/arcade/simulation';
import { pitchAt, spotlightApproach } from '../game/arcade/remix';

const now = 100000;
function arriving(boardId = 'crown', kind = 'lottery', remaining = 3): Game {
  const g = newGame(DEFAULT_AVATAR, 5, 1, undefined, boardId, 0);
  const target = getBoard(boardId).spaces.find((n) => n.type === kind)!;
  g.phase = 'moving';
  g.flight = undefined;
  g.announce = undefined;
  g.path = [0];
  g.remaining = remaining;
  g.due = now;
  g.movement = {
    from: 0,
    to: target.id,
    startedAt: now - 1000,
    arrivesAt: now,
  };
  return g;
}
function action(g: Game, type: Action['type'], value?: number) {
  return reduceGame(
    g,
    g.players[g.active].id,
    { type, value, lotteryId: g.lottery?.id },
    now + 1000,
  );
}
function prize(g: Game, outcome: number) {
  g = action(g, 'lotteryPick', g.lottery!.cards!.indexOf(outcome));
  return action(g, 'lotteryScratch');
}
for (const board of BOARDS) {
  assert.ok(
    board.spaces.some((n) => n.type === 'shop'),
    board.name + ' shop',
  );
  assert.ok(
    board.spaces.some((n) => n.type === 'lottery'),
    board.name + ' lottery',
  );
  const g = reduceGame(arriving(board.id), '', { type: 'tick' }, now + 999999);
  assert.equal(g.phase, 'lottery');
  assert.equal(g.remaining, 2);
  assert.equal(g.movement, undefined);
  assert.deepEqual([...g.lottery!.cards!].sort(), [
    ...Array(13).fill(0),
    1,
    2,
    3,
  ]);
  assert.equal(
    reduceGame(g, '', { type: 'tick' }, now + 9999999),
    g,
    'Human never times out',
  );
  assert.throws(() =>
    reduceGame(
      g,
      'bot0',
      { type: 'lotteryPick', value: 0, lotteryId: g.lottery!.id },
      now,
    ),
  );
  for (const value of [-1, 16, 0.5, NaN])
    assert.throws(() => action(g, 'lotteryPick', value));
  const blank = prize(g, 0),
    continued = action(blank, 'lotteryContinue');
  assert.equal(blank.lottery!.result, 0);
  assert.ok(['moving', 'fork'].includes(continued.phase));
  assert.equal(continued.remaining, 2);
  assert.equal(continued.active, 0);
  assert.deepEqual(blank.players, g.players);
}
const base = reduceGame(arriving(), '', { type: 'tick' }, now);
for (const outcome of [1, 2, 3]) {
  const g = structuredClone(base);
  g.players[0].items = ['boost', 'shield', 'warp'];
  const awarded = prize(g, outcome),
    again = action(awarded, 'lotteryScratch');
  assert.deepEqual(again.players, awarded.players, 'Cannot award twice');
  assert.equal(awarded.players[0].pearls, outcome === 1 ? 1 : 0);
  assert.equal(awarded.players[0].shells, outcome === 2 ? 120 : 20);
  assert.equal(awarded.players[0].lotteryBoosts ?? 0, outcome === 3 ? 1 : 0);
  assert.equal(awarded.players[0].items.length, 3, 'Full bag is preserved');
  assert.equal(
    awarded.pearl,
    g.pearl,
    'Free diamond does not move purchasable diamond',
  );
  assert.deepEqual(
    action(JSON.parse(JSON.stringify(awarded)), 'lotteryContinue').players,
    awarded.players,
  );
}
let landed = reduceGame(
  arriving('crown', 'lottery', 1),
  '',
  { type: 'tick' },
  now,
);
landed = action(prize(landed, 0), 'lotteryContinue');
assert.equal(landed.active, 1);
assert.equal(landed.phase, 'turn');
const goal = structuredClone(base);
goal.diamondGoal = 1;
assert.equal(action(prize(goal, 1), 'lotteryContinue').phase, 'finished');
let cpu = structuredClone(base);
cpu.players[0].cpu = true;
for (let i = 0; i < 3; i++)
  cpu = reduceGame(cpu, '', { type: 'tick' }, cpu.due + 1, () => 0.7);
assert.ok(['moving', 'fork'].includes(cpu.phase));
assert.equal(cpu.remaining, 2);
const overlap = arriving();
overlap.pearl = overlap.movement!.to;
const diamond = reduceGame(overlap, '', { type: 'tick' }, now);
assert.equal(diamond.phase, 'diamond');
assert.equal(action(diamond, 'diamond', 0).phase, 'lottery');
const warp = newGame(DEFAULT_AVATAR, 5, 1, undefined, 'crown', 0);
warp.phase = 'turn';
warp.announce = undefined;
warp.players[0].items = ['warp'];
const lotto = getBoard().spaces.find((n) => n.type === 'lottery')!;
warp.pearl = lotto.next[0];
warp.remaining = 9;
const warpStop = reduceGame(warp, 'local', { type: 'use', item: 'warp' }, now);
assert.equal(warpStop.phase, 'lottery');
assert.equal(warpStop.lottery!.resumeTurn, true);
const resumed = action(prize(warpStop, 0), 'lotteryContinue');
assert.equal(resumed.phase, 'turn');
assert.equal(resumed.active, 0);
assert.equal(resumed.players[0].used, true);
const boost = newGame(DEFAULT_AVATAR, 5, 1, undefined, 'crown', 0);
boost.phase = 'turn';
boost.announce = undefined;
boost.players[0].lotteryBoosts = 1;
const used = reduceGame(boost, 'local', { type: 'use', item: 'five' }, now);
const rolled = reduceGame(used, 'local', { type: 'roll' }, now, () => 0);
assert.equal(rolled.lastRoll, 6);
assert.equal(rolled.players[0].lotteryBoosts, 0);
const shop = reduceGame(
  arriving('crown', 'shop', 1),
  '',
  { type: 'tick' },
  now,
  () => 0.5,
);
assert.equal(shop.shopStock!.length, 5);
assert.equal(new Set(shop.shopStock).size, 5);
const missing = ITEMS.find((i) => !shop.shopStock!.includes(i.id))!;
assert.throws(() =>
  reduceGame(shop, 'local', { type: 'buy', item: missing.id }, now),
);
assert.deepEqual(
  reduceGame(shop, '', { type: 'tick' }, now + 100).shopStock,
  shop.shopStock,
);
assert.notDeepEqual(
  randomShopStock(() => 0.1),
  randomShopStock(() => 0.8),
);
const legacy = structuredClone(shop);
legacy.contentRevision = 7;
delete legacy.shopStock;
const migrated = migrateGame(legacy, now);
assert.equal(migrated.shopStock!.length, 5);
assert.deepEqual(migrated.players, legacy.players);
assert.equal(migrateGame(migrated, now), migrated);
const scores = MINIGAMES.map((mini) =>
  JSON.stringify(musicScore(`mini:${mini.id}`)),
);
assert.equal(
  new Set(scores).size,
  MINIGAMES.length,
  'Every minigame has a unique composition',
);
assert.deepEqual(musicScore('solar-menu'), musicScore('solar-menu'));
assert.ok(
  new Set(
    Array.from({ length: 30 }, (_, i) => pitchAt(123, i * 1.45 + 0.1).type),
  ).size === 3,
);
for (const heat of [0, 1, 2]) {
  assert.ok(spotlightApproach(123, heat, 3.8).gap > 0);
  assert.ok(spotlightApproach(123, heat, 7.1).gap < 0);
}
const players = ['p0', 'p1', 'p2', 'p3'].map((id) => ({ id, cpu: true }));
for (const seed of [4, 20]) {
  const arena = createArena(
    MINIGAMES.findIndex((m) => m.id === 'picklepatrol'),
    players,
    1,
    seed,
  );
  for (let i = 0; i < 2400; i++) {
    stepArena(arena);
    assert.ok(
      arena.remix!.seats.every((s) => !s.falseStart),
      'CPU never fires from a stale beacon',
    );
  }
}
const bat = createArena(
  MINIGAMES.findIndex((m) => m.id === 'mangosluggers'),
  players.map((p) => ({ ...p, cpu: false })),
  1,
  123,
);
setControl(bat, 'p0', { x: 0, z: 0, a: true, b: false, seq: 1, ap: 1 });
stepArena(bat);
assert.equal(
  bat.overhaul!.taps[0],
  1,
  'A genuine press counts once in Tap Launch',
);
assert.equal(bat.actors[0].score, 438);
advanceArena(bat, pitchAt(123, 0).contact - 0.01);
setControl(bat, 'p0', { x: 0, z: 0, a: true, b: false, seq: 2, ap: 2 });
stepArena(bat);
assert.equal(
  bat.overhaul!.taps[0],
  2,
  'A second genuine press increases long-jump distance',
);
console.log(
  'PASS: lottery prizes/stops/replays/CPU/warp/full bags, randomized shops, save migration, 30 unique music scores, fair CPU and swing timing',
);
