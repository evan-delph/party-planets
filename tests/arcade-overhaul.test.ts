import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  AVAILABLE_ARCADE,
  arcadeInfo,
  normalizeMinigamePool,
} from '../game/arcade/catalog';
import {
  advanceArena,
  canopyHeight,
  createArena,
  setControl,
  stepArena,
  type Arena,
  type Control,
} from '../game/arcade/simulation';
import { bombBounds, puzzleSlot, riverHazards } from '../game/arcade/overhaul';
import {
  coursePlatforms,
  courseBridges,
  onSkyBridge,
} from '../game/arcade/expansion';
import { critterScale, spotlightApproach } from '../game/arcade/remix';
import {
  newGame,
  migrateGame,
  reduceGame,
  prepareMinigame,
} from '../game/engine';
import { DEFAULT_AVATAR } from '../game/config';

const humans = [0, 1, 2, 3].map((i) => ({ id: `p${i}`, cpu: false }));
function arena(id: string) {
  return createArena(
    AVAILABLE_ARCADE.find((m) => m.id === id)!.index,
    humans,
    1,
    123,
  );
}
function input(w: Arena, id: string, c: Partial<Control> = {}) {
  setControl(w, id, {
    x: 0,
    z: 0,
    a: false,
    b: false,
    seq: w.actors.find((p) => p.id === id)!.input.seq + 1,
    ...c,
  });
}
assert.equal(AVAILABLE_ARCADE.length, 28);
assert.ok(
  AVAILABLE_ARCADE.every(
    (m) =>
      !['factory', 'crumbleclock'].includes(m.id) &&
      arcadeInfo(m.index).id === m.id,
  ),
);
assert.equal(normalizeMinigamePool().length, 28);
for (const invalid of [[], ['factory'], ['crumbleclock'], ['not-a-game']])
  assert.throws(() => normalizeMinigamePool(invalid));
assert.deepEqual(normalizeMinigamePool(['dig', 'dig']), ['dig']);
for (const ids of [['dig'], ['bomb', 'mangosluggers']]) {
  let g = newGame(DEFAULT_AVATAR, 5, 1, undefined, 'crown', 0, ids);
  g.phase = 'landed';
  g.active = 3;
  g.players[3].cpu = false;
  g.players[3].pos = 0;
  g.due = 0;
  g = reduceGame(g, g.players[3].id, { type: 'end' }, 10000, () => 0.99);
  assert.equal(g.phase, 'vote');
  assert.equal(g.vote!.choices.length, ids.length);
  assert.ok(g.vote!.choices.every((i) => ids.includes(arcadeInfo(i).id)));
  g = reduceGame(g, 'online', { type: 'tick' }, g.due + 1, () => 0.999);
  assert.ok(
    Object.values(g.vote!.ballots).every((n) => g.vote!.choices.includes(n)),
  );
}
const legacy = newGame(DEFAULT_AVATAR);
legacy.contentRevision = 8;
legacy.phase = 'minigame';
legacy.mini = 11;
const possessions = legacy.players.map((p) => [p.shells, p.pearls, p.items]);
const upgraded = migrateGame(legacy);
assert.notEqual(upgraded.mini, 11);
assert.equal(upgraded.contentRevision, 11);
assert.deepEqual(
  upgraded.players.map((p) => [p.shells, p.pearls, p.items]),
  possessions,
);

const paper = arena('canopy');
const initial = canopyHeight(paper);
advanceArena(paper, 0.5);
assert.ok(canopyHeight(paper) < initial, 'Paper moves immediately');
paper.actors[0].x = 7.8;
paper.actors[0].z = 5.8;
advanceArena(paper, 2.5);
assert.equal(
  paper.actors[0].alive,
  false,
  'Touching the falling page loses before it reaches the ground',
);

const puzzle = arena('dig');
const pp = puzzle.overhaul!.puzzles[0];
advanceArena(puzzle, 5);
pp.held = 0;
Object.assign(pp.cursor, puzzleSlot(0));
pp.pieces[0].turn = 1;
input(puzzle, 'p0', { a: true });
stepArena(puzzle);
assert.equal(pp.pieces[0].locked, false, 'Wrong rotation stays loose');
advanceArena(puzzle, 5.3);
pp.held = 0;
pp.pieces[0].turn = 0;
input(puzzle, 'p0');
stepArena(puzzle);
input(puzzle, 'p0', { a: true });
stepArena(puzzle);
assert.equal(pp.pieces[0].locked, true, 'Correct slot and rotation lock');
assert.equal(puzzle.actors[0].score, 1000);

const tap = arena('mangosluggers');
input(tap, 'p0', { a: true, ap: 1 });
advanceArena(tap, 1);
assert.equal(tap.overhaul!.taps[0], 1, 'Held button is not repeated');
assert.throws(
  () => input(tap, 'p0', { ap: 600 }),
  'Fabricated queues are rejected',
);
input(tap, 'p0', { ap: 4 });
advanceArena(tap, 1.1);
assert.equal(tap.overhaul!.taps[0], 4, 'Batched genuine presses are preserved');
advanceArena(tap, 10);
input(tap, 'p0', { ap: 5 });
advanceArena(tap, 13);
assert.equal(tap.overhaul!.taps[0], 4, 'No taps count after ten seconds');
assert.equal(tap.actors[0].score, 552);

const onlineTap = newGame(DEFAULT_AVATAR);
prepareMinigame(
  onlineTap,
  AVAILABLE_ARCADE.find((m) => m.id === 'mangosluggers')!.index,
  100000,
  123,
);
const queued = reduceGame(
  onlineTap,
  onlineTap.players[0].id,
  {
    type: 'control',
    miniStart: onlineTap.miniStart,
    control: { x: 0, z: 0, a: false, b: false, seq: 1, ap: 4 },
  },
  onlineTap.miniStart - 1,
);
assert.strictEqual(
  queued,
  onlineTap,
  'Briefing input cannot bank button presses',
);
const accepted = reduceGame(
  onlineTap,
  onlineTap.players[0].id,
  {
    type: 'control',
    miniStart: onlineTap.miniStart,
    control: { x: 0, z: 0, a: false, b: false, seq: 2, ap: 1 },
  },
  onlineTap.miniStart + 20,
);
assert.equal(
  accepted.arcade!.actors[0].input.ap,
  1,
  'Automatic countdown accepts play without a Ready click',
);
const flood = arena('mangosluggers');
input(flood, 'p0', { ap: 4 });
assert.throws(
  () => input(flood, 'p0', { ap: 8 }),
  /Too many button presses/,
  'Repeated packets cannot refill the tap budget',
);
advanceArena(flood, 0.2);
input(flood, 'p0', { ap: 8 });
assert.equal(
  flood.actors[0].input.ap,
  8,
  'Real elapsed time replenishes the tap budget',
);

const bomb = arena('bomb');
const p = bomb.actors[0];
bomb.overhaul!.bombs.push({
  id: 99,
  x: p.x,
  z: p.z,
  y: 0.3,
  vx: 0,
  vz: 0,
  vy: 0,
  born: 0,
  fuse: 4,
  holder: -1,
});
input(bomb, 'p0', { a: true });
stepArena(bomb);
assert.equal(bomb.overhaul!.bombs[0].holder, 0);
input(bomb, 'p0');
stepArena(bomb);
input(bomb, 'p0', { x: 1, a: true });
stepArena(bomb);
assert.equal(bomb.overhaul!.bombs[0].holder, -1);
assert.ok(bomb.overhaul!.bombs[0].vx > 0);
assert.equal(bomb.overhaul!.bombs[0].fuse, 4, 'Throwing never resets fuse');
assert.ok(
  bombBounds(65).x < bombBounds(20).x,
  'Late-game pressure prevents endless stalemates',
);
assert.ok(
  riverHazards.some((h) => h.rock) && riverHazards.some((h) => !h.rock),
);

const moss = arena('paint');
const painter = moss.actors[0];
painter.x = 3;
painter.z = 1.5;
painter.y = 0.00001;
painter.vy = -1;
painter.distance = 1.03;
stepArena(moss);
assert.ok(
  moss.extra!.cells.some((c) => c.owner === 0),
  'Tiny positive landing heights still stamp overlapping tiles',
);
const pads = coursePlatforms();
assert.ok(pads.some((p) => p.w < 1.3));
assert.notEqual(coursePlatforms(0)[3].x, coursePlatforms(1)[3].x);
for (const b of courseBridges())
  assert.ok(onSkyBridge((b.a.x + b.b.x) / 2, (b.a.z + b.b.z) / 2, 0));
assert.ok(critterScale(30) > critterScale(0));
assert.equal(critterScale(99), 1.9);
assert.notEqual(
  spotlightApproach(123, 0, 3).gap,
  spotlightApproach(123, 1, 3).gap,
);
assert.ok(spotlightApproach(123, 0, 7.1).gap < 0);
const straight = arena('prickleice'),
  turning = arena('prickleice');
for (let i = 0; i < 90; i++) {
  input(straight, 'p0');
  input(turning, 'p0', { x: i % 20 < 10 ? 0.8 : -0.8 });
  stepArena(straight);
  stepArena(turning);
}
assert.ok(
  straight.remix!.seats[0].skiSpeed > turning.remix!.seats[0].skiSpeed,
  'Straight runs accelerate faster',
);
assert.ok(straight.remix!.seats[0].skiSpeed <= 13.5);
const ui = fs.readFileSync('game/Party.tsx', 'utf8');
assert.ok(ui.includes('product of keperoni industries incorporated'));
// The menu carries no alien characters (user rule), so the logo no longer
// uses the alien-piloted UFO sticker; the arcade still ships the image.
assert.ok(fs.existsSync('public/ufo-sticker.webp'));
assert.ok(
  !ui.includes('/ufo-sticker.webp'),
  'The menu and title logo carry no alien-piloted UFO',
);
assert.ok(
  ui.includes('if (reduced || !orbital)'),
  'On-planet selection uses the direct transition',
);
console.log(
  'PASS: arcade overhaul — enabled pools, safe migration, paper contact, puzzle locking, ten-second taps, bomb pickup/throw, moss landing, bridges, acceleration and start-screen credit',
);
