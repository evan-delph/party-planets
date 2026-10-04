import { BOARDS, pearlDestinations } from '../game/boards';
import assert from 'node:assert/strict';
import {
  arenaFor,
  cpuSteal,
  newGame,
  prepareMinigame,
  reduceGame,
  validateAvatar,
  type Game,
} from '../game/engine';
import { BOARD, DEFAULT_AVATAR, ITEMS } from '../game/config';
import { ARCADE } from '../game/arcade/catalog';
import {
  Arena,
  Control,
  createArena,
  advanceArena,
  setControl,
  stepArena,
} from '../game/arcade/simulation';
let assertions = 0;
function check(v: unknown, message: string) {
  assert.ok(v, message);
  assertions++;
}
const humans = [0, 1, 2, 3].map((i) => ({ id: 'p' + i, cpu: false }));
const bots = humans.map((p) => ({ ...p, cpu: true }));
function drive(
  w: Arena,
  seconds: number,
  control: (w: Arena) => Partial<Control>,
  id = 'p0',
) {
  const end = w.tick + Math.round(seconds * 60);
  while (w.tick < end && !w.done) {
    setControl(w, id, {
      x: 0,
      z: 0,
      a: false,
      b: false,
      ...control(w),
      seq: w.tick + 1,
    });
    stepArena(w);
  }
  return w;
}
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
for (const b of BOARD) {
  check(b.id >= 0 && BOARD[b.id] === b, 'Stable board IDs');
  for (const n of b.next) check(!!BOARD[n], 'Every edge has a destination');
}
check(BOARD.length >= 50 && BOARD.length <= 80, 'Boards hold 50–80 spaces');
function boardGame(boardId = 'crown') {
  const s = newGame(DEFAULT_AVATAR, 10, 1, undefined, boardId, 0);
  s.phase = 'turn';
  s.flight = undefined;
  s.departed = Object.fromEntries(s.players.map((p) => [p.id, 0]));
  return s;
}
function rollToLanding(state: Game, random: () => number = () => 0) {
  let s = reduceGame(
      state,
      'local',
      { type: 'roll' },
      Math.max(Date.now(), state.announce?.until ?? 0) + 1,
      random,
    ),
    budget = 100;
  while (
    ['rolling', 'moving', 'fork', 'diamond', 'lottery'].includes(s.phase) &&
    budget-- > 0
  ) {
    if (s.phase === 'diamond')
      s = reduceGame(
        s,
        s.players[s.active].id,
        { type: 'diamond', value: s.players[s.active].shells >= 50 ? 1 : 0 },
        s.due,
        random,
      );
    else if (s.phase === 'lottery')
      s = reduceGame(
        s,
        s.players[s.active].id,
        {
          type:
            s.lottery!.stage === 'pick'
              ? 'lotteryPick'
              : s.lottery!.stage === 'scratch'
                ? 'lotteryScratch'
                : 'lotteryContinue',
          lotteryId: s.lottery!.id,
          value: 0,
        },
        s.due,
        random,
      );
    else if (s.phase === 'fork')
      s = reduceGame(
        s,
        'local',
        {
          type: 'route',
          value: BOARDS.find((b) => b.id === s.boardId)!.spaces[
            s.players[s.active].pos
          ].next[0],
        },
        s.due - 1,
        random,
      );
    else s = reduceGame(s, '', { type: 'tick' }, s.due + 1, random);
  }
  check(budget > 0, 'A board roll finishes');
  return s;
}
let g = boardGame();
assert.throws(() => reduceGame(g, g.players[1].id, { type: 'roll' }));
assertions++;
for (const item of ITEMS) {
  g = boardGame();
  g.players[0].items = [item.id];
  const next = reduceGame(g, 'local', { type: 'use', item: item.id });
  check(
    next.players[0].used && next.players[0].items.length === 0,
    `${item.id} consumes item`,
  );
  assert.throws(() =>
    reduceGame(next, 'local', { type: 'use', item: item.id }),
  );
  assertions++;
}
g = boardGame();
g.phase = 'landed';
g.players[0].pos = BOARD.find((s) => s.type === 'shop')!.id;
g.shopStock = ['shield', 'boost', 'double', 'magnet', 'warp'];
g = reduceGame(g, 'local', { type: 'buy', item: 'shield' });
check(
  g.players[0].shells === 14 && g.players[0].items.includes('shield'),
  'Shop purchase',
);
assert.throws(() => reduceGame(g, 'local', { type: 'buy', item: 'shield' }));
assertions++;

// Full matches exercise the actual arena results rather than inventing CPU scores.
for (let seed = 1; seed <= 9; seed++) {
  let now = 100000;
  const random = rng(seed);
  g = newGame(
    DEFAULT_AVATAR,
    [10, 15, 20][seed % 3],
    seed % 3,
    undefined,
    BOARDS[(seed - 1) % BOARDS.length].id,
    0,
  );
  now = g.due + 1;
  let steps = 0;
  while (g.phase !== 'finished' && steps++ < 2500) {
    const active = g.players[g.active];
    if (
      [
        'arrival',
        'rolling',
        'moving',
        'fork',
        'vote',
        'bonus',
        'lastTurns',
      ].includes(g.phase)
    ) {
      now = Math.max(now, g.due + 1);
      g = reduceGame(g, '', { type: 'tick' }, now, random);
    } else if (g.phase === 'steal')
      g = reduceGame(g, active.id, cpuSteal(g, active), now, random);
    else if (g.phase === 'diamond')
      g = reduceGame(
        g,
        active.id,
        { type: 'diamond', value: active.shells >= 50 ? 1 : 0 },
        now,
        random,
      );
    else if (g.phase === 'lottery')
      g = reduceGame(
        g,
        active.id,
        {
          type:
            g.lottery!.stage === 'pick'
              ? 'lotteryPick'
              : g.lottery!.stage === 'scratch'
                ? 'lotteryScratch'
                : 'lotteryContinue',
          lotteryId: g.lottery!.id,
          value: Math.floor(random() * 16),
        },
        now,
        random,
      );
    else if (g.phase === 'turn')
      g = reduceGame(
        g,
        active.id,
        { type: 'roll', route: random() > 0.5 ? 'jungle' : 'coast' },
        now,
        random,
      );
    else if (g.phase === 'landed')
      g = reduceGame(g, active.id, { type: 'end' }, now, random);
    else if (g.phase === 'minigame') {
      const arena = arenaFor(g, g.mini, g.seed);
      advanceArena(arena, arena.duration);
      check(arena.done, 'Every round has a bounded end');
      now = g.miniStart + arena.duration * 1000;
      g = reduceGame(
        g,
        'local',
        { type: 'arcadeResult', scores: arena.actors.map((a) => a.score) },
        now,
        random,
      );
    } else if (g.phase === 'results')
      g = reduceGame(g, 'local', { type: 'next' }, now, random);
    now += 8000;
    for (const p of g.players) {
      check(p.shells >= 0 && Number.isFinite(p.shells), 'Currency valid');
      check(p.items.length <= 3, 'Inventory cap');
      check(!!BOARD[p.pos], 'Position on graph');
    }
  }
  check(
    g.phase === 'finished' && g.round === g.rounds,
    'Match ends at configured round',
  );
}

// Same seed and fixed steps must agree across online and offline simulations.
for (let index = 0; index < ARCADE.length; index++)
  for (let difficulty = 0; difficulty < 3; difficulty++)
    for (let seed = 1; seed <= 3; seed++) {
      const a = createArena(index, bots, difficulty, seed),
        b = structuredClone(a);
      advanceArena(a, a.duration);
      advanceArena(b, b.duration / 2);
      advanceArena(b, b.duration);
      assert.deepEqual(a, b);
      assertions++;
      check(a.done && a.time <= a.duration, `${a.kind} finishes`);
      for (const p of a.actors)
        check(
          [p.x, p.y, p.z, p.vx, p.vy, p.vz, p.score].every(Number.isFinite),
          `${a.kind} finite physics`,
        );
      if (a.kind === 'duos')
        check(
          a.overhaul!.boats.some((t) => t.finish > 0),
          'A CPU team physically completes the cave river',
        );
      if (a.kind === 'race')
        check(
          a.actors.every((p) => p.finish > 0 && p.gear === 5),
          'CPUs drive the whole course and change gears',
        );
    }
let w = createArena(0, humans);
const hole = w.holes[0];
w.actors[0].x = hole.x;
w.actors[0].z = hole.z;
w.actors[1].x = 7;
w.actors[1].z = 5;
advanceArena(w, 3.8);
check(
  w.actors[0].alive && !w.actors[1].alive,
  'The actual safe opening decides canopy survival',
);
w = createArena(0, humans);
const oldX = w.actors[0].x;
drive(w, 0.4, () => ({ x: -1 }));
check(w.actors[0].x < oldX - 1, 'Directional input moves the player');
const stopX = w.actors[0].x;
advanceArena(w, 1.6);
check(
  w.actors[0].input.x === 0 && w.actors[0].x > stopX - 4,
  'Missing controls expire',
);
w = createArena(1, humans);
const d = w.actors[0];
d.x = 6.8;
d.z = 0;
d.face = Math.PI / 2;
drive(w, 0.5, () => ({ x: 1, a: true }));
check(!d.alive, 'A missed outward dash can eliminate its player');
const high = createArena(2, humans),
  low = structuredClone(high);
drive(high, 0.35, () => ({ a: true }));
drive(low, 0.35, (x) => ({ a: x.tick === 0 }));
check(
  high.actors[0].y > low.actors[0].y + 0.2,
  'Holding jump changes jump height',
);
w = createArena(2, humans);
advanceArena(w, 25);
check(
  w.actors.every((p) => !p.alive),
  'Players who never jump burn out',
);
w = createArena(2, humans);
setControl(w, 'p0', {
  x: 0,
  z: 0,
  a: false,
  b: false,
  seq: 100,
  ap: 1,
  ar: 1,
  bp: 0,
});
stepArena(w);
check(w.actors[0].jumps === 1, 'Short jump press survives a network packet');
check(
  !setControl(w, 'p0', { x: 1, z: 0, a: true, b: false, seq: 99 }),
  'Old sequence cannot overwrite current input',
);
stepArena(w);
check(w.actors[0].jumps === 1, 'Duplicate edge cannot jump twice');
assert.throws(() =>
  setControl(w, 'p0', { x: NaN, z: 0, a: false, b: false, seq: 101 }),
);
assertions++;
w = createArena(3, humans);
const shooter = w.actors[0];
shooter.x = 0;
shooter.z = 0;
shooter.face = Math.PI / 2;
w.actors[1].x = 5;
w.actors[1].z = 0;
w.actors[2].x = -4;
w.actors[2].z = -4;
w.actors[3].x = -4;
w.actors[3].z = 4;
drive(w, 1.5, () => ({ a: true }));
check(shooter.charge > 1, 'Holding grows a coconut');
drive(w, 0.6, () => ({ a: false }));
check(
  w.shotId === 1 && shooter.charge === 0,
  'Releasing launches the charged projectile',
);
check(
  !w.actors[1].alive || w.actors[1].x > 6,
  'A projectile physically knocks its target back',
);
const racing = createArena(
  4,
  humans.map((p, i) => ({ ...p, cpu: i !== 0 })),
);
advanceArena(racing, racing.duration);
check(
  racing.actors[0].distance === 0 &&
    racing.actors[0].score < racing.actors[1].score,
  'A racer who never accelerates loses',
);
const shifted = createArena(4, humans),
  unshifted = structuredClone(shifted);
drive(shifted, 14, (s) => ({ a: true, b: s.actors[0].rpm > 0.85 }));
drive(unshifted, 14, () => ({ a: true }));
check(
  shifted.actors[0].distance > unshifted.actors[0].distance * 2,
  'Gear timing changes race performance',
);
w = createArena(5, humans);
const unsynced = structuredClone(w);
for (let i = 0; i < 240; i++) {
  for (const id of ['p0', 'p1'])
    setControl(w, id, {
      x: 0,
      z: 0,
      a: i % 45 === 0,
      b: false,
      seq: w.tick + 1,
    });
  setControl(unsynced, 'p0', {
    x: 0,
    z: 0,
    a: i % 45 === 0,
    b: false,
    seq: unsynced.tick + 1,
  });
  stepArena(w);
  stepArena(unsynced);
}
check(
  w.overhaul!.boats[0].distance > unsynced.overhaul!.boats[0].distance,
  'Synchronized rowing travels farther',
);
check(
  Math.abs(unsynced.overhaul!.boats[0].offset) > 0.1,
  'One-sided paddling veers sideways',
);

g = prepareMinigame(newGame(DEFAULT_AVATAR), 2, 1000, 77);
const before = JSON.stringify(g);
check(
  reduceGame(g, '', { type: 'tick' }, 90000) === g,
  'Offline briefing waits for the player',
);
check(JSON.stringify(g) === before, 'Tick does not mutate caller state');
g = reduceGame(g, 'local', { type: 'ready' }, 90000);
check(
  g.miniStart === 93000,
  'Ready always provides a fresh three-second countdown',
);
g = reduceGame(g, 'online', { type: 'tick' }, 95000);
check((g.arcade?.time ?? 0) === 2, 'Online world advances on server time');
g = reduceGame(g, 'online', { type: 'tick' }, 150000);
check(g.phase === 'results', 'Server ends minigame');
g = reduceGame(g, 'online', { type: 'tick' }, 170000);
check(
  g.phase === 'turn' && g.round === 2,
  'Online continues after host disconnects',
);
g = prepareMinigame(newGame(DEFAULT_AVATAR), 0, 0, 1);
g = reduceGame(g, 'online', { type: 'tick' }, 16000);
check(
  g.miniReady?.includes('local'),
  'Online briefing timeout releases the overlay',
);
assert.throws(() => validateAvatar({ ...DEFAULT_AVATAR, height: Infinity }));
assert.throws(() => validateAvatar({ ...DEFAULT_AVATAR, hair: 8 }));
assertions += 2;

for (const board of BOARDS) {
  check(
    board.spaces.length >= 50 && board.spaces.length <= 80,
    'Every board has 50–80 hand-placed spaces',
  );
  const visit = new Set([0]),
    q = [0];
  for (let i = 0; i < q.length; i++)
    for (const n of board.spaces[q[i]].next) {
      check(!!board.spaces[n], 'Valid edge');
      if (!visit.has(n)) {
        visit.add(n);
        q.push(n);
      }
    }
  check(
    visit.size === board.spaces.length,
    'Every district and branch is reachable',
  );
  const spaces = board.spaces;
  const bankBefore = spaces.find(
    (s) =>
      s.next.length === 1 &&
      spaces[s.next[0]].type === 'bank' &&
      spaces[spaces[s.next[0]].next[0]].type === 'blue',
  )!;
  check(!!bankBefore, 'A bank has an ordinary onward path');
  for (const coins of [0, 3, 7]) {
    let bank = boardGame(board.id);
    bank.players[0].pos = bankBefore.id;
    bank.players[0].shells = coins;
    bank = rollToLanding(bank, () => 0.1);
    check(
      bank.bank === Math.min(5, coins),
      'Pass deposits only available money',
    );
    check(
      bank.players[0].shells + (bank.bank ?? 0) === coins + 3,
      'Bank passing conserves funds plus blue reward',
    );
  }
  let bank = boardGame(board.id);
  bank.players[0].pos = bankBefore.id;
  bank.bank = 23;
  bank = rollToLanding(bank);
  check(
    bank.players[0].shells === 43 && bank.bank === 0,
    'Landing wins whole bank without a deposit',
  );
  check(
    bank.effect?.kind === 'bank' && bank.effect.delta === 23,
    'Payout has one animation event',
  );
  const beforeHazard = spaces.find(
    (s) => s.next.length === 1 && spaces[s.next[0]].type === 'hazard',
  )!;
  let hazard = boardGame(board.id);
  hazard.players[0].pos = beforeHazard.id;
  hazard.players[0].shells = 2;
  hazard = rollToLanding(hazard);
  check(
    hazard.players[0].shells === 0,
    'Ecosystem hazard cannot make money negative',
  );
  check(
    hazard.effect?.kind === 'hazard' && hazard.effect.delta === -2,
    'Hazard records exact loss',
  );
  check(
    reduceGame(hazard, '', { type: 'tick' }, 1) === hazard,
    'Polling does not repeat hazard',
  );
  hazard = boardGame(board.id);
  hazard.players[0].pos = beforeHazard.id;
  hazard.players[0].shield = true;
  hazard = rollToLanding(hazard);
  check(
    hazard.players[0].shells === 20 && !hazard.players[0].shield,
    'Shield blocks hazard once',
  );
  // Jump pads exist only on Moonwake Basin.
  const beforePortal = spaces.find(
    (s) => s.next.length === 1 && spaces[s.next[0]].type === 'portal',
  );
  check(
    !!beforePortal === (board.gimmick === 'jumppads'),
    'Jump pads appear exactly on the jump-pad board',
  );
  if (beforePortal) {
    let portal = boardGame(board.id);
    portal.players[0].pos = beforePortal.id;
    portal.bank = 12;
    const entered = beforePortal.next[0];
    portal = rollToLanding(portal);
    check(
      portal.players[0].pos !== entered &&
        spaces[portal.players[0].pos].type === 'portal' &&
        portal.bank === 12,
      'Jump pads fling players across the basin without pass effects',
    );
  }
  const destinations = pearlDestinations(board.id, 14);
  check(
    destinations.length > 0 &&
      destinations.every(
        (n) => !['bank', 'hazard', 'start', 'portal'].includes(spaces[n].type),
      ),
    'Diamonds have reachable suitable spaces',
  );
  // Board gimmicks (tide, ferry, eruption) close the branch roads.
  let gate = boardGame(board.id);
  gate.routesOpen = false;
  const fork = spaces.find((s) => s.next.length > 1)!;
  gate.players[0].pos = fork.id;
  gate = rollToLanding(gate);
  check(gate.path[1] === fork.next[0], 'Closed branch uses main route');
}
{
  const arena = createArena(7, bots, 1, 42);
  const holder = 0;
  arena.overhaul!.bombs.push({
    id: 99,
    x: arena.actors[0].x,
    z: arena.actors[0].z,
    y: 1,
    vx: 0,
    vz: 0,
    vy: 0,
    holder,
    born: 0,
    fuse: 1 / 60,
    pickedAt: 0,
  });
  stepArena(arena);
  const eliminated = arena.actors[holder];
  check(!eliminated.alive, 'The fuse eliminates its actual carrier');
  check(
    arena.overhaul!.explosions[0].x === eliminated.x &&
      arena.overhaul!.explosions[0].z === eliminated.z,
    'Explosion presentation stays at the actual blast location',
  );
}
for (let index = 6; index < 12; index++) {
  const a = createArena(index, bots, 1, 19);
  advanceArena(a, a.duration);
  check(a.done, 'Expansion round finishes');
  if (a.kind === 'sky' || a.kind === 'skate')
    check(
      a.actors.some((p) => p.finish > 0),
      'CPU can finish expanded race',
    );
  if (a.kind === 'bomb')
    check(
      a.actors.filter((p) => p.alive).length <= 1,
      'Bomb Domb ends with at most one survivor',
    );
  if (a.kind === 'paint')
    check(
      a.actors.every(
        (p, i) =>
          p.score === a.extra!.cells.filter((c) => c.owner === i).length,
      ),
      'Territory scores reflect final ownership',
    );
  if (a.kind === 'factory')
    check(
      a.extra!.orders.some((n) => n > 0),
      'CPUs produce completed orders',
    );
  if (a.kind === 'dig')
    check(
      a.overhaul!.puzzles.some((p) => p.pieces.every((piece) => piece.locked)),
      'CPU completes the eight-piece puzzle',
    );
}

console.log(
  `PASS: ${assertions} assertions; 9 complete matches; ${ARCADE.length * 9} deterministic arena runs; physical controls, hazards, projectiles, gears, relay cooperation, input sequences, readiness, deadlines, board/items/scoring.`,
);
