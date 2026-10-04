import assert from 'node:assert/strict';
import { newGame, reduceGame, type Game } from '../game/engine';
import { BOARDS, getBoard } from '../game/boards';
import { DEFAULT_AVATAR, MINIGAMES, RULES } from '../game/config';
import { createArena, advanceArena } from '../game/arcade/simulation';
import { remixInfo } from '../game/arcade/remix-catalog';
import { remixReadout } from '../game/arcade/remix';
import { readPad } from '../game/gamepad';

const now = 100000;
function arriving(balance = 100, remaining = 3): Game {
  const g = newGame(DEFAULT_AVATAR, 5, 1, undefined, 'crown', 0);
  g.phase = 'moving';
  g.flight = undefined;
  g.announce = undefined;
  const target = getBoard().spaces.find(
    (n) => n.type === 'blue' && n.next.length === 1,
  )!;
  g.pearl = target.id;
  g.players[0].shells = balance;
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
const stopped = reduceGame(arriving(), '', { type: 'tick' }, now + 999999);
assert.equal(stopped.phase, 'diamond');
assert.equal(stopped.players[0].pos, stopped.pearl);
assert.equal(stopped.remaining, 2);
assert.equal(stopped.movement, undefined);
assert.equal(stopped.players[0].shells, 100);
assert.equal(reduceGame(stopped, '', { type: 'tick' }, now + 9999999), stopped);
assert.throws(() =>
  reduceGame(stopped, 'bot0', { type: 'diamond', value: 1 }, now),
);
const bought = reduceGame(
  stopped,
  'local',
  { type: 'diamond', value: 1 },
  now,
  () => 0.4,
);
assert.equal(bought.players[0].shells, 50);
assert.equal(bought.players[0].pearls, 1);
assert.equal(bought.remaining, 2);
assert.equal(bought.phase, 'moving');
assert.ok(!bought.players.some((p) => p.pos === bought.pearl));
assert.equal(
  reduceGame(bought, 'local', { type: 'diamond', value: 1 }, now),
  bought,
);
const declined = reduceGame(
  stopped,
  'local',
  { type: 'diamond', value: 0 },
  now,
);
assert.equal(declined.players[0].shells, 100);
assert.equal(declined.pearl, stopped.pearl);
assert.equal(declined.phase, 'moving');
const poor = reduceGame(arriving(2, 1), '', { type: 'tick' }, now);
assert.equal(poor.phase, 'diamond');
assert.throws(() =>
  reduceGame(poor, 'local', { type: 'diamond', value: 1 }, now),
);
const passed = reduceGame(poor, 'local', { type: 'diamond', value: 0 }, now);
assert.equal(passed.phase, 'landed');
assert.equal(passed.players[0].shells, 2 + RULES.blueReward);
assert.equal(
  reduceGame(passed, 'local', { type: 'diamond', value: 0 }, now),
  passed,
);
const restored = JSON.parse(JSON.stringify(stopped));
assert.equal(
  reduceGame(restored, '', { type: 'tick' }, now + 99999999),
  restored,
);
const cpu = structuredClone(stopped);
cpu.players[0].cpu = true;
assert.equal(
  reduceGame(cpu, '', { type: 'tick' }, cpu.due + 1).players[0].pearls,
  1,
);
assert.equal(
  stopped.due,
  now + 999999 + 1500,
  'Delayed arrivals retain a full decision interval',
);
for (const board of BOARDS) {
  const reachable = new Set<number>([0]),
    queue = [0];
  while (queue.length)
    for (const to of board.spaces[queue.shift()!].next)
      if (!reachable.has(to)) {
        reachable.add(to);
        queue.push(to);
      }
  assert.ok(
    board.spaces.some((s) => s.type === 'shop' && reachable.has(s.id)),
    `${board.id} has a reachable store`,
  );
}
for (let i = 0; i < MINIGAMES.length; i++) {
  const arena = createArena(i, stopped.players, 1, 123);
  if (!arena.remix) continue;
  assert.ok(
    remixReadout(arena, 'local')?.title,
    MINIGAMES[i].name + ' briefing',
  );
  if (remixInfo(arena.kind)?.heats) {
    assert.equal(arena.remix.heat, 0);
    arena.remix.heat = -1;
    assert.ok(remixReadout(arena, 'local')?.title.includes('Heat 1'));
  }
  advanceArena(arena, arena.duration);
  assert.ok(
    remixReadout(arena, 'local')?.title,
    MINIGAMES[i].name + ' completed',
  );
}
const pad = (axes: number[], pressed: number[]) => ({
  axes,
  buttons: Array.from({ length: 17 }, (_, i) => ({
    pressed: pressed.includes(i),
    touched: false,
    value: pressed.includes(i) ? 1 : 0,
  })),
});
assert.deepEqual(readPad(null), {
  x: 0,
  z: 0,
  a: false,
  b: false,
  start: false,
  any: false,
});
assert.equal(readPad(pad([0.1, -0.1], [])).x, 0);
assert.equal(readPad(pad([1, -1], [])).z, -1);
assert.equal(readPad(pad([], [12])).z, -1);
assert.equal(readPad(pad([], [15])).x, 1);
assert.equal(readPad(pad([], [0, 9])).a, true);
assert.equal(readPad(pad([], [0, 9])).start, true);
assert.equal(readPad(pad([], [5])).b, true);
console.log(
  'PASS: diamond decisions, save/resume, shops, initial/final minigame HUD, controller mapping',
);
