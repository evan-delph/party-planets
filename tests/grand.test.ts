/**
 * Independent gameplay regressions for the 50-game expansion.
 * Exercises tangible outcomes through the shared offline/online simulation.
 * Fixtures arrange legal situations; assertions describe observable outcomes.
 * No DOM, renderer, fake implementation, source-text matching, or filesystem I/O.
 */
import assert from 'node:assert/strict';
import { ARCADE, scoreLabel } from '../game/arcade/catalog';
import {
  createArena,
  setControl,
  stepArena,
  type Arena,
  type Control,
  type Runner,
} from '../game/arcade/simulation';
import { newGame, player, prepareMinigame, reduceGame } from '../game/engine';
import { DEFAULT_AVATAR } from '../game/config';
import { BOARDS } from '../game/boards';
import { scenicPhase } from '../game/BoardLife';

let assertions = 0;
let passed = 0;
const failures: string[] = [];
function check(value: unknown, message: string): asserts value {
  assertions++;
  assert.ok(value, message);
}
function equal(actual: unknown, expected: unknown, message: string) {
  assertions++;
  assert.deepEqual(actual, expected, message);
}
function near(
  actual: number,
  expected: number,
  tolerance: number,
  message: string,
) {
  check(
    Math.abs(actual - expected) <= tolerance,
    `${message}: ${actual} vs ${expected}`,
  );
}
function test(name: string, run: () => void) {
  try {
    run();
    passed++;
    console.log(`PASS ${name}`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    failures.push(`${name}: ${detail}`);
    console.error(`FAIL ${name}: ${detail}`);
  }
}

const humanSeats = [0, 1, 2, 3].map((i) => ({ id: `reg-p${i}`, cpu: false }));
function indexOf(id: string) {
  const index = ARCADE.findIndex((game) => game.id === id);
  check(index >= 0, `Catalogue contains ${id}`);
  return index;
}
function arena(id: string, seed = 271, difficulty = 1, cpu = false) {
  return createArena(
    indexOf(id),
    humanSeats.map((p) => ({ ...p, cpu })),
    difficulty,
    seed,
  );
}
function advanceTicks(world: Arena, count: number) {
  for (let i = 0; i < count && !world.done; i++) stepArena(world);
}
function advanceTo(world: Arena, seconds: number) {
  const target = Math.ceil(seconds * 60 - 1e-8);
  let budget = Math.max(0, target - world.tick) + 1;
  while (world.tick < target && !world.done && budget-- > 0) stepArena(world);
  check(
    world.done || world.tick >= target,
    'Simulation advances without stalling',
  );
}
function place(p: Runner, x: number, z: number, y = 0) {
  Object.assign(p, {
    x,
    z,
    y,
    vx: 0,
    vz: 0,
    vy: 0,
    flash: 0,
    stun: 0,
    cooldown: 0,
  });
}
function send(world: Arena, seat: number, control: Partial<Control> = {}) {
  const p = world.actors[seat];
  const old = p.input;
  const c: Control = {
    x: 0,
    z: 0,
    a: false,
    b: false,
    ap: old.ap ?? p.seenAP,
    bp: old.bp ?? p.seenBP,
    ar: old.ar ?? p.seenAR,
    ...control,
    seq: old.seq + 1,
  };
  check(setControl(world, p.id, c), 'A fresh human control is accepted');
}
function pressA(world: Arena, seat: number) {
  const p = world.actors[seat];
  send(world, seat, { a: true, ap: (p.input.ap ?? p.seenAP) + 1 });
  stepArena(world);
}
function releaseA(world: Arena, seat: number) {
  const p = world.actors[seat];
  send(world, seat, { ar: (p.input.ar ?? p.seenAR) + 1 });
  stepArena(world);
}
type WorldObject = NonNullable<Arena['grand']>['objects'][number];
function addObject(
  world: Arena,
  fields: Partial<WorldObject> & Pick<WorldObject, 'kind'>,
) {
  const g = world.grand!;
  const object: WorldObject = {
    id: ++g.serial,
    x: 0,
    z: 0,
    y: 0,
    vx: 0,
    vz: 0,
    vy: 0,
    r: 0.45,
    life: 10,
    owner: -1,
    value: 1,
    hp: 1,
    tag: 0,
    age: 0,
    ...fields,
  };
  g.objects.push(object);
  return object;
}
const jsonCopy = <T>(value: T): T => JSON.parse(JSON.stringify(value));

test('Exactly 50 unique games preserve the original 12 positions', () => {
  equal(ARCADE.length, 50, 'Total catalogue is exactly 50');
  equal(
    new Set(ARCADE.map((g) => g.id)).size,
    50,
    'Every game has a unique stable ID',
  );
  equal(
    ARCADE.slice(0, 12).map((g) => g.id),
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
    'Saved minigame indices for the original 12 remain compatible',
  );
});

test('Postcard pickup and delivery remove an express letter and award it once', () => {
  const w = arena('postcardpanic');
  const g = w.grand!;
  const letter = g.objects.find((o) => o.kind === 'letter' && o.tag === 1)!;
  const cart = g.objects.find((o) => o.kind === 'mailcart' && o.tag === 1)!;
  check(letter && cart, 'Match includes express mail and a matching cart');
  g.objects = [letter, cart];
  g.nextSpawn = 1000;
  place(w.actors[0], 0, 0);
  w.actors.slice(1).forEach((p, i) => place(p, 6, 4 + i));
  Object.assign(letter, { x: 0, z: 0, y: 0.1, owner: -1, age: 0 });
  pressA(w, 0);
  equal(g.seats[0].held, letter.id, 'Nearby envelope enters the carry slot');
  equal(w.actors[0].score, 0, 'Pickup alone awards no delivery points');
  releaseA(w, 0);
  place(w.actors[0], cart.x, cart.z);
  pressA(w, 0);
  equal(
    w.actors[0].score,
    3,
    'Fresh matching express delivery earns three points',
  );
  equal(g.seats[0].held, -1, 'Delivery frees the carry slot');
  check(
    !g.objects.some((o) => o.id === letter.id),
    'Delivered letter leaves the world',
  );
  releaseA(w, 0);
  pressA(w, 0);
  advanceTicks(w, 120);
  equal(
    w.actors[0].score,
    3,
    'Further interaction cannot redeliver the same letter',
  );
  check(
    !g.objects.some((o) => o.id === letter.id),
    'Delivered mail is not resurrected by carried-item maintenance',
  );
});

test('Lantern pillars stop fire while the same exposed position is hit', () => {
  const covered = arena('lanternlurk');
  covered.tick = 119;
  covered.time = covered.tick / 60;
  place(covered.actors[0], 3, 4.4);
  covered.actors.slice(1).forEach((p, i) => place(p, -7, -6 + i * 6));
  Object.assign(covered.grand!.monster, {
    x: 3,
    z: 0.3,
    face: 0,
    at: 0,
    target: 0,
  });
  const exposed = jsonCopy(covered);
  exposed.grand!.tiles = [];
  const lives = covered.actors[0].lives;
  stepArena(covered);
  stepArena(exposed);
  equal(
    exposed.actors[0].lives,
    lives - 1,
    'The positive control is inside an active fire attack',
  );
  equal(
    covered.actors[0].lives,
    lives,
    'An intervening solid pillar protects the player',
  );
  check(covered.actors[0].alive, 'Cover prevents an unjust elimination');
});

test('Boulder climbers jump high enough to clear a real rolling melon', () => {
  const airborne = arena('boulderbuffet');
  stepArena(airborne); // Establish the first solo role through normal phase handling.
  const g = airborne.grand!;
  check(g.solo !== 1, 'Seat 1 is a climber in the opening heat');
  g.objects = [];
  const climber = airborne.actors[1];
  const floor = (8 - 0) * 0.31;
  place(climber, 0, 0, floor);
  pressA(airborne, 1);
  releaseA(airborne, 1);
  let clearance = climber.y - floor;
  for (let tick = 0; tick < 19; tick++) {
    stepArena(airborne);
    clearance = Math.max(clearance, climber.y - floor);
  }
  check(
    clearance > 1.05,
    'A normal jump rises above the rolling-hazard hit zone',
  );
  check(
    climber.y - floor > 1.0,
    'Fixture meets the melon while still airborne',
  );
  addObject(airborne, {
    kind: 'melon',
    owner: g.solo,
    x: climber.x,
    z: climber.z,
    y: floor + 0.6,
    r: 0.6,
  });
  const grounded = jsonCopy(airborne);
  place(grounded.actors[1], climber.x, climber.z, floor);
  const beforeZ = climber.z;
  const beforeChefScore = airborne.actors[g.solo].score;
  stepArena(airborne);
  stepArena(grounded);
  near(
    airborne.actors[1].z,
    beforeZ,
    1e-6,
    'Successful jump avoids downhill knockback',
  );
  equal(
    airborne.actors[g.solo].score,
    beforeChefScore,
    'A cleared melon gives the chef no hit points',
  );
  check(
    grounded.actors[1].z > beforeZ + 1,
    'The grounded positive control is knocked downhill',
  );
  check(
    grounded.actors[g.solo].score > beforeChefScore,
    'A real grounded hit rewards the chef',
  );
});

test('Skewer survival points recur in all four heats and roles rotate fairly', () => {
  const w = arena('skewergallery');
  for (let heat = 0; heat < 4; heat++) {
    advanceTo(w, heat * 13 + 1 / 60);
    equal(w.grand!.solo, heat, 'Each player receives one solo heat in order');
    const before = w.actors.map((p) => p.score);
    advanceTo(w, heat * 13 + 12);
    equal(
      w.actors.map((p, i) => p.score - before[i]),
      w.actors.map((_, i) => (i === heat ? 0 : 4)),
      `Heat ${heat + 1} awards all four scheduled survival points to each dodger`,
    );
  }
  advanceTo(w, 52);
  check(w.done, 'Four heats finish at the declared cap');
  equal(
    w.actors.map((p) => p.score),
    [12, 12, 12, 12],
    'Equal survival performance yields equal aggregate results',
  );
});

test('Skewer CPUs can play through every role without a startup or reset crash', () => {
  for (const difficulty of [0, 1, 2]) {
    const w = arena('skewergallery', 307 + difficulty * 73, difficulty, true);
    const soloRoles = new Set<number>();
    let sawShot = false;
    for (let budget = 0; budget < 52 * 60 + 2 && !w.done; budget++) {
      stepArena(w);
      soloRoles.add(w.grand!.solo);
      sawShot ||= w.grand!.objects.some((o) => o.kind === 'skewer');
    }
    check(w.done, `Difficulty ${difficulty} completes within its hard cap`);
    equal(
      [...soloRoles].sort(),
      [0, 1, 2, 3],
      'CPU match reaches all four solo roles',
    );
    check(sawShot, 'CPU shooter actually fires a projectile');
    check(
      w.actors.some((p) => p.score > 0),
      'CPU match produces gameplay points',
    );
    for (const p of w.actors) {
      check(
        [p.x, p.y, p.z, p.score].every(Number.isFinite),
        'CPU result and position remain finite',
      );
      check(
        Number.isInteger(p.score) && p.score >= 0 && p.score <= 200000,
        'CPU score is a valid engine result',
      );
    }
  }
});

test('A connected group of three Bento ingredients clears; a pair alone does not', () => {
  const triple = arena('bentoblocks');
  const s = triple.grand!.seats[0];
  s.grid.fill(0);
  s.grid[9 * 6] = 2;
  s.grid[9 * 6 + 1] = 2;
  // Put a matching ingredient over the third column, with a different one above it.
  s.piece = [2, 8, 2, 3, 0];
  const pairOnly = jsonCopy(triple);
  pairOnly.grand!.seats[0].grid[9 * 6] = 0;
  send(triple, 0, { b: true, bp: 1 });
  send(pairOnly, 0, { b: true, bp: 1 });
  stepArena(triple);
  stepArena(pairOnly);
  check(
    triple.actors[0].score > 0,
    'Completing a group of three awards points',
  );
  equal(
    triple.grand!.seats[0].grid.filter((v) => v === 2).length,
    0,
    'All three connected matching cells disappear',
  );
  equal(
    triple.grand!.seats[0].grid.filter((v) => v === 3).length,
    1,
    'The unmatched ingredient remains after gravity',
  );
  equal(pairOnly.actors[0].score, 0, 'A pair is below the match threshold');
  equal(
    pairOnly.grand!.seats[0].grid.filter((v) => v === 2).length,
    2,
    'Two matching ingredients stay on the board',
  );
});

test('A volleyball rally becomes a shared team result through the engine', () => {
  const players = humanSeats.map((seat, i) =>
    player(seat.id, { ...DEFAULT_AVATAR, name: `Reg ${i + 1}` }),
  );
  const game = prepareMinigame(
    newGame(DEFAULT_AVATAR, 10, 1, players),
    indexOf('volleybuns'),
    1000,
    719,
  );
  const w = game.arcade!;
  w.tick = w.duration * 60 - 1;
  w.time = w.tick / 60;
  w.actors.forEach((p, i) => place(p, i % 2 ? 6 : -6, p.team === 0 ? 6 : -6));
  const ball = w.grand!.objects.find((o) => o.kind === 'ball')!;
  Object.assign(ball, { x: 0, z: 5, y: 0.01, vx: 0, vz: 0, vy: -1, owner: 1 });
  const shellBalances = game.players.map((p) => p.shells);
  const result = reduceGame(
    game,
    'online',
    { type: 'tick' },
    game.miniStart + w.duration * 1000 + 1,
  );
  equal(
    result.phase,
    'results',
    'Authoritative completion enters the results phase',
  );
  equal(
    result.players.map((p) => p.score),
    [0, 0, 1, 1],
    'Both partners receive the rally winner score',
  );
  equal(
    result.players[2].shells - shellBalances[2],
    result.players[3].shells - shellBalances[3],
    'Winning partners receive equal prizes',
  );
  check(
    result.players[2].shells - shellBalances[2] >
      result.players[0].shells - shellBalances[0],
    'Winning team earns more than the losing team',
  );
});

test('One tangible coin can be claimed once, then banked once', () => {
  const w = arena('coinquake');
  const g = w.grand!;
  g.objects = [];
  g.nextSpawn = 1000;
  place(w.actors[0], 0, 0);
  place(w.actors[1], 0, 0); // Simultaneous claim opportunity, without choosing a winning seat.
  place(w.actors[2], -4, -4);
  place(w.actors[3], 4, -4);
  const coin = addObject(w, {
    kind: 'coin',
    x: 0,
    z: 0,
    y: 1.5,
    vy: -1,
    value: 5,
  });
  stepArena(w);
  equal(
    g.seats.reduce((sum, s) => sum + s.water, 0),
    5,
    'The shared object creates exactly five carried coins',
  );
  equal(
    g.seats.filter((s) => s.water > 0).length,
    1,
    'Only one overlapping player wins the claim',
  );
  check(
    !g.objects.some((o) => o.id === coin.id),
    'Claimed object leaves the world',
  );
  equal(
    w.actors.reduce((sum, p) => sum + p.score, 0),
    0,
    'Unbanked collection is not yet score',
  );
  advanceTicks(w, 60);
  equal(
    g.seats.reduce((sum, s) => sum + s.water, 0),
    5,
    'Waiting cannot collect the removed object again',
  );
  const collector = g.seats.findIndex((s) => s.water === 5);
  place(w.actors[collector], 4.5, 0);
  send(w, collector, { b: true, bp: 1 });
  advanceTicks(w, 32);
  equal(
    w.actors.reduce((sum, p) => sum + p.score, 0),
    5,
    'The collector banks precisely the claimed value',
  );
  equal(
    g.seats.reduce((sum, s) => sum + s.water, 0),
    0,
    'Banking consumes the carried value',
  );
  advanceTicks(w, 120);
  equal(
    w.actors.reduce((sum, p) => sum + p.score, 0),
    5,
    'An empty pouch cannot be banked twice',
  );
});

test('Score labels distinguish accuracy, race completion and points', () => {
  equal(
    scoreLabel(indexOf('fossilfillet'), 87),
    '87% accuracy',
    'Accuracy is a percentage, not survival time',
  );
  equal(
    scoreLabel(indexOf('vinevault'), 97850),
    '21.50s finish',
    'Finished race reports elapsed time',
  );
  equal(
    scoreLabel(indexOf('vinevault'), 45000),
    '50% progress',
    'Unfinished race reports progress',
  );
  equal(
    scoreLabel(indexOf('postcardpanic'), 23),
    '23 points',
    'Collection displays points',
  );
  equal(
    scoreLabel(indexOf('bentoblocks'), 31),
    '31 points',
    'Puzzle match count is not mislabeled as accuracy',
  );
});

test('JSON-resumed Pickle Patrol stays deterministic and stale input expires', () => {
  const original = arena('picklepatrol', 1733);
  original.actors.forEach((p, i) => place(p, i < 2 ? -5 : 5, i % 2 ? 6 : -5));
  send(original, 0, { x: 1, a: true, ap: 1, bp: 0, ar: 0 });
  advanceTicks(original, 10);
  check(
    original.grand!.objects.some((o) => o.kind === 'bolt'),
    'Resume point includes a real in-flight projectile',
  );
  const resumed = jsonCopy(original);
  advanceTicks(original, 110);
  advanceTicks(resumed, 110);
  equal(
    jsonCopy(resumed),
    jsonCopy(original),
    'Resumed simulation matches uninterrupted motion, projectiles and scores',
  );
  const p = resumed.actors[0];
  equal(
    [p.input.x, p.input.z, p.input.a, p.input.b],
    [0, 0, false, false],
    'Expired movement and held fire are neutralized',
  );
  check(
    Math.hypot(p.vx, p.vz) < 0.01,
    'A disconnected player stops moving after inertia settles',
  );
  equal(
    resumed.grand!.seats[0].ammo,
    2,
    'One held press fires once and is not replayed by expiry or resume',
  );
  // A retransmitted old edge must not fire again, but a new short press/release
  // delivered with a=false must still survive the network update interval.
  send(resumed, 0, { ap: 1, ar: 1 });
  stepArena(resumed);
  equal(
    resumed.grand!.seats[0].ammo,
    2,
    'A previously consumed edge does not replay',
  );
  send(resumed, 0, { a: false, ap: 2, ar: 2 });
  stepArena(resumed);
  equal(
    resumed.grand!.seats[0].ammo,
    1,
    'A complete tap between updates still fires its new shot',
  );
});

test('Every board has 138 reachable, distinct spaces with all-pair clearance', () => {
  check(BOARDS.length >= 3, 'The themed board selection is present');
  for (const board of BOARDS) {
    equal(board.spaces.length, 138, `${board.id}: exactly 138 board spaces`);
    equal(
      new Set(board.spaces.map((s) => s.id)).size,
      138,
      `${board.id}: unique space IDs`,
    );
    const byId = new Map(board.spaces.map((s) => [s.id, s]));
    const reachable = new Set<number>([board.spaces[0].id]);
    const pending = [...reachable];
    while (pending.length) {
      const id = pending.shift()!;
      for (const next of byId.get(id)!.next) {
        check(
          byId.has(next),
          `${board.id}: route ${id}→${next} has a destination`,
        );
        if (!reachable.has(next)) {
          reachable.add(next);
          pending.push(next);
        }
      }
    }
    equal(reachable.size, 138, `${board.id}: every space can be visited`);
    for (let i = 0; i < board.spaces.length; i++) {
      const a = board.spaces[i];
      check(
        Number.isFinite(a.x) && Number.isFinite(a.z),
        `${board.id}: finite space coordinates`,
      );
      for (let j = i + 1; j < board.spaces.length; j++) {
        const b = board.spaces[j];
        const gap = Math.hypot(a.x - b.x, a.z - b.z);
        check(
          gap >= 3.05 - 1e-9,
          `${board.id}: spaces ${a.id}/${b.id} have 3.05-unit clearance (actual ${gap})`,
        );
      }
    }
  }
});

test('Scenic activity repeats every minute and is inactive between appearances', () => {
  for (const offset of [0, 15, 30, 45]) {
    for (const duration of [10, 11, 12]) {
      near(
        scenicPhase(offset, offset, duration),
        0,
        1e-12,
        'Scenic appearance starts at phase zero',
      );
      near(
        scenicPhase(offset + duration / 2, offset, duration),
        0.5,
        1e-12,
        'Scenic action advances through its duration',
      );
      equal(
        scenicPhase(offset + duration, offset, duration),
        -1,
        'Scenic object is hidden at the end boundary',
      );
      equal(
        scenicPhase(offset + duration + 5, offset, duration),
        -1,
        'Scenic object stays hidden between appearances',
      );
      for (const relative of [
        -1,
        0,
        0.25,
        duration / 2,
        duration - 0.25,
        duration,
        59,
      ]) {
        const first = scenicPhase(offset + relative, offset, duration);
        near(
          scenicPhase(offset + relative + 60, offset, duration),
          first,
          1e-10,
          'Appearance repeats on the next minute',
        );
        near(
          scenicPhase(offset + relative + 180, offset, duration),
          first,
          1e-10,
          'Recurrence does not drift after three minutes',
        );
      }
    }
  }
  near(
    scenicPhase(65.5, 60),
    0.5,
    1e-12,
    'The default 11-second scenic duration also recurs',
  );
});

console.log(
  `Grand regression summary: ${passed} passed, ${failures.length} failed, ${assertions} assertions.`,
);
assert.equal(failures.length, 0, failures.join('\n'));
