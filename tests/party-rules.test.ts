/** v0.8 party rules: color teams, last turns, Nabbit, Captain Klaxon, Shrink/Growth Rays. */
import assert from 'node:assert/strict';
import { getBoard } from '../game/boards';
import { DEFAULT_AVATAR, RULES } from '../game/config';
import { ALL_ARCADE, supportsMode } from '../game/arcade/catalog';
import { advanceArena, createArena } from '../game/arcade/simulation';
import {
  arenaPlayers,
  cpuItem,
  gimmickOpen,
  lastTurnsRound,
  migrateGame,
  newGame,
  player,
  prepareMinigame,
  reduceGame,
  routeChoices,
  type Game,
} from '../game/engine';

let checks = 0;
function check(value: unknown, message: string) {
  checks++;
  assert.ok(value, message);
}
function equal(actual: unknown, expected: unknown, message: string) {
  checks++;
  assert.deepEqual(actual, expected, message);
}
const NOW = 100000;
const constant = (n: number) => () => n;
function fresh(rounds = 10) {
  const players = [0, 1, 2, 3].map((i) =>
    player('p' + i, { ...DEFAULT_AVATAR, name: 'Alien ' + i }),
  );
  const g = newGame(DEFAULT_AVATAR, rounds, 1, players, 'crown', 0);
  g.flight = undefined;
  g.departed = Object.fromEntries(players.map((p) => [p.id, 0]));
  return g;
}
const board = getBoard('crown');
const first = (kind: string) => board.spaces.find((n) => n.type === kind)!;
/** Put the active player one step before `to`, mid-move. */
function edge(g: Game, to: number, remaining = 1) {
  const from = board.spaces.find((n) => n.next.includes(to))!.id;
  g.players[g.active].pos = from;
  g.phase = 'moving';
  g.path = [from];
  g.remaining = remaining;
  g.movement = { from, to, startedAt: NOW - 500, arrivesAt: NOW };
  g.due = NOW;
  g.pearl = board.spaces.find((n) => n.type === 'blue' && n.id !== to)!.id;
  return g;
}
/** End the last seat's turn on a blue space with chosen colors for the others. */
function vote(colors: ('blue' | 'red')[]) {
  const g = fresh();
  g.active = 3;
  g.phase = 'landed';
  g.presentUntil = NOW;
  g.players.forEach((p, i) => (p.color = colors[i]));
  g.players[3].pos = first(colors[3]).id;
  return reduceGame(g, 'p3', { type: 'end' }, NOW + 1, constant(0.1));
}

// â”€â”€ Space-color teams â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ffa = vote(['blue', 'blue', 'blue', 'blue']);
equal(ffa.miniMode, 'ffa', 'Four blue landings make a free-for-all');
check(
  ffa.vote!.choices.every((n) => supportsMode(n, 'ffa')),
  'A free-for-all ballot only offers 4-player games',
);
const duo = vote(['blue', 'red', 'red', 'blue']);
equal(duo.miniMode, '2v2', 'Two blue and two red landings make 2 vs 2');
equal(duo.lineup, ['p0', 'p3', 'p1', 'p2'], 'Teams sit together, blue first');
check(
  duo.vote!.choices.every((n) => supportsMode(n, '2v2')) &&
    duo.vote!.choices.length === 3,
  'A team ballot offers three 2 vs 2 games',
);
const solo = vote(['red', 'blue', 'red', 'red']);
equal(solo.miniMode, '1v3', 'One odd color out makes a 1 vs 3');
equal(solo.lineup![0], 'p1', 'The lone color takes the solo seat');
check(
  solo.vote!.choices.length === 3 &&
    solo.vote!.choices.every((n) => supportsMode(n, '1v3')),
  'A solo showdown ballot offers three 1 vs 3 games',
);
const lone = vote(['blue', 'blue', 'blue', 'red']);
equal(lone.lineup![0], 'p3', 'Three blue and one red puts the red player solo');
const noTeams = (() => {
  const g = fresh();
  g.minigamePool = ['canopy', 'bumper'];
  g.active = 3;
  g.phase = 'landed';
  g.presentUntil = NOW;
  g.players.forEach((p, i) => (p.color = i % 2 ? 'red' : 'blue'));
  g.players[3].pos = first('red').id;
  return reduceGame(g, 'p3', { type: 'end' }, NOW + 1, constant(0.1));
})();
equal(
  noTeams.miniMode,
  'ffa',
  'Without enabled team games, a 2â€“2 split falls back to a free-for-all',
);
// Turn end records the landing color; neutral spaces flip a coin.
{
  const g = fresh();
  g.phase = 'landed';
  g.presentUntil = NOW;
  g.players[0].pos = first('red').id;
  const next = reduceGame(g, 'p0', { type: 'end' }, NOW + 1, constant(0.9));
  equal(next.players[0].color, 'red', 'A red landing joins the red team');
  const g2 = fresh();
  g2.phase = 'landed';
  g2.presentUntil = NOW;
  g2.players[0].pos = first('shop').id;
  equal(
    reduceGame(g2, 'p0', { type: 'end' }, NOW + 1, constant(0.2)).players[0]
      .color,
    'blue',
    'A neutral space flips a coin',
  );
}

// â”€â”€ Team payouts and arena seating â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
{
  const g = structuredClone(duo);
  const index = g.vote!.choices[0];
  prepareMinigame(g, index, NOW - 99000, 7);
  equal(
    g.arcade!.actors.map((a) => [a.id, a.team]),
    [
      ['p0', 0],
      ['p3', 0],
      ['p1', 1],
      ['p2', 1],
    ],
    'The 2 vs 2 arena seats teammates on the same team',
  );
  equal(
    arenaPlayers(g).map((p) => p.id),
    ['p0', 'p3', 'p1', 'p2'],
    'Renderers receive players in seat order',
  );
  const before = g.players.map((p) => p.shells);
  const paid = reduceGame(
    g,
    'p0',
    { type: 'arcadeResult', scores: [5, 5, 2, 2] },
    NOW,
    constant(0.5),
  );
  equal(
    paid.players.map((p, i) => p.shells - before[i]),
    [RULES.teamWin, 0, 0, RULES.teamWin],
    'Both winning teammates are paid; seat-order scores map back to players',
  );
  const tied = reduceGame(
    g,
    'p0',
    { type: 'arcadeResult', scores: [4, 4, 4, 4] },
    NOW,
    constant(0.5),
  );
  check(
    tied.players.every((p, i) => p.shells - before[i] === RULES.teamTie),
    'A team tie pays everyone the tie prize',
  );
}
// Solo-driven showdowns: the solo alien rides the critter / commands the
// sentries. CPU-vs-CPU outcomes at normal difficulty stay roughly even.
{
  for (const id of ['tidetiles', 'cannoncay']) {
    const index = ALL_ARCADE.findIndex((m) => m.id === id);
    check(supportsMode(index, '1v3') && supportsMode(index, 'ffa'), `${id} offers both shapes`);
    let soloWins = 0;
    const runs = 30;
    for (let seed = 1; seed <= runs; seed++) {
      const w = createArena(
        index,
        [0, 1, 2, 3].map((i) => ({ id: 'p' + i, cpu: true })),
        1,
        seed * 977,
        '1v3',
      );
      advanceArena(w, 40);
      const scores = w.actors.map((a) => a.score);
      check(
        w.done &&
          w.duration === 30 &&
          (scores.join() === '1,0,0,0' || scores.join() === '0,1,1,1'),
        `${id} showdown ${seed} finishes with a solo-or-trio result`,
      );
      if (scores[0] === 1) soloWins++;
    }
    check(
      soloWins / runs > 0.2 && soloWins / runs < 0.75,
      `${id} showdown balance: solo wins ${Math.round((soloWins / runs) * 100)}%`,
    );
  }
}
{
  const g = structuredClone(solo);
  const index = g.vote!.choices[0];
  prepareMinigame(g, index, NOW - 99000, 7);
  equal(
    g.arcade!.actors.map((a) => a.team),
    [0, 1, 1, 1],
    'The 1 vs 3 arena seats the solo alien alone',
  );
  equal(g.arcade!.duration, 30, 'A board 1 vs 3 plays one fixed-solo heat');
  const before = g.players.map((p) => p.shells);
  const soloWin = reduceGame(
    g,
    'p0',
    { type: 'arcadeResult', scores: [1, 0, 0, 0] },
    NOW,
    constant(0.5),
  );
  equal(
    soloWin.players.map((p, i) => p.shells - before[i]),
    [0, RULES.soloWin, 0, 0],
    'A solo victory pays the bigger solo prize',
  );
  const trioWin = reduceGame(
    g,
    'p0',
    { type: 'arcadeResult', scores: [0, 1, 1, 1] },
    NOW,
    constant(0.5),
  );
  equal(
    trioWin.players.map((p, i) => p.shells - before[i]),
    [RULES.teamWin, 0, RULES.teamWin, RULES.teamWin],
    'A trio victory pays all three teammates',
  );
}

// â”€â”€ Last turns â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
{
  equal(lastTurnsRound(10), 6, 'A 10-round party starts its last 5 at round 6');
  equal(lastTurnsRound(5), 3, 'A 5-round party starts its last 3 at round 3');
  const g = fresh(10);
  g.phase = 'results';
  g.round = 5;
  g.players.forEach((p, i) => {
    p.shells = [40, 12, 30, 12][i];
    p.pearls = [1, 0, 0, 0][i];
  });
  const announced = reduceGame(g, 'p0', { type: 'next' }, NOW, constant(0.1));
  equal(announced.phase, 'lastTurns', 'Round 6 opens with the last-turns show');
  equal(announced.round, 6, 'The show belongs to the new round');
  equal(
    announced.lastTurns!.trailing,
    ['p1', 'p3'],
    'Every tied last-place player gets the catch-up boost',
  );
  equal(announced.lastTurns!.bonus, 'points', 'The boost is chosen by rng');
  check(
    reduceGame(announced, '', { type: 'tick' }, announced.due - 1) ===
      announced,
    'The standings stay on screen until their deadline',
  );
  const awarded = reduceGame(
    announced,
    '',
    { type: 'tick' },
    announced.due,
    constant(0.1),
  );
  equal(
    awarded.players.map((p) => p.shells),
    [40, 12 + RULES.lastTurnsBonus, 30, 12 + RULES.lastTurnsBonus],
    'Trailing players receive the points boost exactly once',
  );
  const playing = reduceGame(awarded, '', { type: 'tick' }, awarded.due);
  equal(playing.phase, 'turn', 'Play resumes after the boost reveal');
  const doubled = structuredClone(playing);
  doubled.players[0].shells = 20;
  edge(doubled, first('blue').id);
  equal(
    reduceGame(doubled, '', { type: 'tick' }, NOW, constant(0.5)).players[0]
      .shells,
    20 + RULES.blueReward * 2,
    'Blue spaces pay double during the last turns',
  );
  const red = structuredClone(playing);
  red.players[0].shells = 20;
  edge(red, first('red').id);
  equal(
    reduceGame(red, '', { type: 'tick' }, NOW, constant(0.5)).players[0].shells,
    20 - RULES.redPenalty * 2,
    'Red spaces cost double during the last turns',
  );
  const items = reduceGame(g, 'p0', { type: 'next' }, NOW, constant(0.5));
  const gifted = reduceGame(items, '', { type: 'tick' }, items.due);
  equal(
    gifted.players[1].items,
    ['boost', 'double', 'mega'],
    'The item boost fills the bag up to its limit',
  );
}

// â”€â”€ Nabbit (steal) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
{
  const thief = first('thief').id;
  const g = fresh();
  g.players.forEach((p) => (p.shells = 30));
  g.players[2].pearls = 1;
  g.players[0].shells = 60;
  edge(g, thief, 3);
  const stop = reduceGame(g, '', { type: 'tick' }, NOW, constant(0.5));
  equal(stop.phase, 'steal', 'Passing Nabbit pauses the roll for a choice');
  equal(stop.remaining, 2, 'The steal stop keeps the remaining steps');
  check(
    reduceGame(stop, '', { type: 'tick' }, NOW + 999999) === stop,
    'Human steal decisions never time out',
  );
  assert.throws(() =>
    reduceGame(stop, 'p0', { type: 'steal', value: 2, target: 'p1' }),
  );
  checks++;
  const points = reduceGame(
    stop,
    'p0',
    { type: 'steal', value: 1, target: 'p1' },
    NOW,
    constant(0.5),
  );
  // 5 + floor(0.5 * 11) = 10 points stolen for a 5-point fee.
  equal(
    [points.players[0].shells, points.players[1].shells],
    [60 - RULES.nabPointsCost + 10, 20],
    'A points steal charges the fee and moves 5â€“15 points',
  );
  equal(points.phase, 'moving', 'The roll resumes after the steal');
  const gem = reduceGame(
    stop,
    'p0',
    { type: 'steal', value: 2, target: 'p2' },
    NOW,
    constant(0.5),
  );
  equal(
    [gem.players[0].pearls, gem.players[2].pearls, gem.players[0].shells],
    [1, 0, 60 - RULES.nabDiamondCost],
    'A diamond steal moves one diamond for the diamond fee',
  );
  const skip = reduceGame(stop, 'p0', { type: 'steal', value: 0 }, NOW);
  equal(
    skip.players.map((p) => [p.shells, p.pearls]),
    stop.players.map((p) => [p.shells, p.pearls]),
    'Declining Nabbit costs nothing',
  );
  const cpu = structuredClone(stop);
  cpu.players[0].cpu = true;
  const auto = reduceGame(cpu, '', { type: 'tick' }, cpu.due, constant(0.5));
  equal(
    [auto.players[0].pearls, auto.players[2].pearls],
    [1, 0],
    'A CPU that can afford it steals the diamond',
  );
  const broke = fresh();
  broke.players[0].shells = 2;
  edge(broke, thief, 1);
  check(
    reduceGame(broke, '', { type: 'tick' }, NOW, constant(0.5)).phase !==
      'steal',
    'Nabbit does not stop a player who cannot pay',
  );
  const giant = fresh();
  giant.players[0].shells = 60;
  giant.players[0].size = 'mega';
  edge(giant, thief, 2);
  check(
    reduceGame(giant, '', { type: 'tick' }, NOW, constant(0.5)).phase !==
      'steal',
    'A giant stomps right past Nabbit',
  );
}

// â”€â”€ Captain Klaxon (villain) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
{
  const villain = first('villain');
  check(!!villain, 'Every board has villain spaces');
  const strike = (roll: number) => {
    const g = fresh();
    g.players.forEach((p, i) => {
      p.shells = [40, 10, 3, 0][i];
      p.pos = 30 + i;
    });
    edge(g, villain.id);
    return reduceGame(g, '', { type: 'tick' }, NOW, constant(roll));
  };
  const shakedown = strike(0.05);
  equal(shakedown.players[0].shells, 20, 'Shakedown takes 20 points');
  equal(
    shakedown.players[0].stats?.lossSpaces,
    1,
    'A villain loss counts as a rough landing',
  );
  check(
    shakedown.effect?.kind === 'villain' && !!shakedown.effect.detail,
    'The strike is presented with its description',
  );
  equal(
    strike(0.25).players.map((p) => p.shells),
    [30, 0, 0, 0],
    'The toll costs everyone up to 10 points',
  );
  const equalized = strike(0.45);
  equal(
    equalized.players.map((p) => p.shells),
    [13, 13, 13, 13],
    'The equalizer splits all points evenly',
  );
  equal(equalized.bank, 1, 'The equalizer remainder goes to the bank');
  const relocated = strike(0.65);
  check(
    relocated.events?.at(-1)?.kind === 'villain',
    'Relocating the diamond is recorded as a board event',
  );
  const swapped = strike(0.85);
  check(
    swapped.players[0].pos !== villain.id &&
      swapped.players.some((p) => p.pos === villain.id),
    'Switcheroo swaps the lander with a rival',
  );
  const shielded = fresh();
  shielded.players[0].shells = 40;
  shielded.players[0].shield = true;
  edge(shielded, villain.id);
  const blocked = reduceGame(shielded, '', { type: 'tick' }, NOW, constant(0));
  equal(
    [blocked.players[0].shells, blocked.players[0].shield],
    [40, false],
    'An Orbit Shield blocks the shakedown',
  );
}

// â”€â”€ Shrink Ray / Growth Ray â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
{
  const g = fresh();
  g.phase = 'turn';
  g.players[0].items = ['mini'];
  const small = reduceGame(g, 'p0', { type: 'use', item: 'mini' }, NOW);
  equal(small.players[0].size, 'mini', 'The Shrink Ray shrinks the player');
  const rolled = reduceGame(small, 'p0', { type: 'roll' }, NOW, constant(0.99));
  equal(rolled.dice!.values, [5], 'A shrunken roll is 1â€“5');
  // Wormholes only open for tiny travellers.
  const hole = structuredClone(small);
  const at = hole.players[0].pos;
  const target = board.spaces.find(
    (n) => !board.spaces[at].next.includes(n.id) && n.id !== at,
  )!.id;
  const spaces = getBoard('crown').spaces;
  spaces[at].miniNext = [target];
  try {
    check(
      routeChoices(hole).includes(target),
      'A tiny player can take a wormhole',
    );
    hole.players[0].size = undefined;
    check(
      !routeChoices(hole).includes(target),
      'Normal-sized players cannot use wormholes',
    );
  } finally {
    delete spaces[at].miniNext;
  }
  const end = structuredClone(rolled);
  end.phase = 'landed';
  end.presentUntil = NOW;
  equal(
    reduceGame(end, 'p0', { type: 'end' }, NOW + 1).players[0].size,
    undefined,
    'Size effects last one turn',
  );
}
{
  const g = fresh();
  g.phase = 'turn';
  g.players[0].items = ['mega'];
  const big = reduceGame(g, 'p0', { type: 'use', item: 'mega' }, NOW);
  const rolled = reduceGame(big, 'p0', { type: 'roll' }, NOW, constant(0.5));
  equal(rolled.dice!.values.length, 2, 'A giant rolls two dice');
  const stomp = structuredClone(rolled);
  const to = first('blue').id;
  edge(stomp, to, 3);
  stomp.players[1].pos = to;
  stomp.players[2].pos = to;
  stomp.players[1].shells = 25;
  stomp.players[2].shells = 4;
  stomp.players[0].shells = 0;
  const flattened = reduceGame(stomp, '', { type: 'tick' }, NOW, constant(0.5));
  equal(
    flattened.players.slice(0, 3).map((p) => p.shells),
    [RULES.megaStomp + 4, 25 - RULES.megaStomp, 0],
    'Passing rivals are stomped for up to 10 points each',
  );
  equal(
    flattened.events?.filter((e) => e.kind === 'stomp').length,
    2,
    'Each stomp is a presentable board event',
  );
}

// â”€â”€ CPU item policy â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
{
  const g = fresh();
  const p = g.players[1];
  p.items = ['shield', 'boost'];
  equal(cpuItem(g, p), 'boost', 'CPUs prefer movement over a spare shield');
  p.items = ['warp'];
  p.shells = 10;
  equal(cpuItem(g, p), undefined, 'CPUs keep a Tractor Beam until they can buy');
  p.shells = 60;
  equal(cpuItem(g, p), 'warp', 'A CPU that can afford a diamond warps to it');
}

// â”€â”€ Board gimmicks and wormholes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
{
  equal(
    [1, 2, 3, 4].map((r) => gimmickOpen('crown', r)),
    [true, false, true, false],
    'Crown Cay: the footbridge opens at low tide on odd rounds',
  );
  equal(
    [1, 2, 3, 4].map((r) => gimmickOpen('coral', r)),
    [false, true, false, true],
    'Nimbus Reef: the cloud ferry docks on even rounds',
  );
  equal(
    [1, 2, 3, 6].map((r) => gimmickOpen('fissure', r)),
    [true, true, false, false],
    'Emberfault: every third round erupts and closes the Lava Bridge',
  );
  check(
    [1, 2, 3].every((r) => gimmickOpen('crater', r)),
    'Moonwake Basin never closes roads',
  );
  equal(newGame(DEFAULT_AVATAR, 10, 1, undefined, 'coral', 0).routesOpen, false, 'Round 1 starts with the ferry away');
  // Round transitions apply the gimmick and announce it.
  const g = fresh();
  g.phase = 'results';
  g.round = 1;
  const next = reduceGame(g, 'p0', { type: 'next' }, NOW, constant(0.5));
  check(
    next.routesOpen === false && /High tide/.test(next.log[0]),
    'High tide floods the footbridge and is announced',
  );
  // The gimmick closes only its own road; other forks stay open.
  {
    const crown = getBoard('crown'),
      gate = crown.gateRoad!;
    const c = fresh();
    c.routesOpen = false;
    c.players[0].pos = gate.from;
    check(
      !routeChoices(c).includes(gate.spaceIds[0]) && routeChoices(c).length === 1,
      'High tide removes the Lagoon Footbridge from the fork',
    );
    const rim = crown.spaces.findIndex((s, i) => i !== gate.from && s.next.length > 1);
    c.players[0].pos = rim;
    equal(routeChoices(c).length, 2, 'Other forks stay open at high tide');
    c.routesOpen = true;
    c.players[0].pos = gate.from;
    check(routeChoices(c).includes(gate.spaceIds[0]), 'Low tide opens the footbridge');
  }
  // Jump pads emit a launch event carrying the destination.
  {
    const crater = getBoard('crater').spaces;
    const pads = crater.filter((s) => s.type === 'portal');
    const before = crater.find((s) => s.next.includes(pads[0].id))!;
    const j = fresh();
    j.boardId = 'crater';
    j.players[0].pos = before.id;
    j.phase = 'moving';
    j.remaining = 1;
    j.path = [before.id];
    j.movement = { from: before.id, to: pads[0].id, startedAt: NOW, arrivesAt: NOW + 500 };
    j.due = NOW + 500;
    const landed = reduceGame(j, '', { type: 'tick' }, NOW + 600, constant(0.5));
    const launch = landed.events?.find((e) => e.kind === 'launch');
    check(
      landed.players[0].pos === pads[1].id && launch?.space === pads[0].id && launch.to === pads[1].id,
      'Jump pads launch explorers to the next pad with a launch event',
    );
  }
  // Each board carries one Shrink Ray wormhole that only tiny players see.
  for (const id of ['crown', 'crater', 'fissure', 'coral']) {
    const spaces = getBoard(id).spaces;
    const holes = spaces.filter((s) => s.miniNext?.length);
    equal(holes.length, 1, `${id} has one wormhole`);
    const w = fresh();
    w.boardId = id;
    w.players[0].pos = holes[0].id;
    w.players[0].size = 'mini';
    check(routeChoices(w).includes(holes[0].miniNext![0]), `${id}: tiny explorers can enter the wormhole`);
  }
  equal(getBoard('alpine').id, 'crown', 'Retired board links resolve to their replacement');
}

// â”€â”€ Save migration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
{
  const g = fresh();
  g.contentRevision = 9;
  const before = JSON.stringify(g);
  const upgraded = migrateGame(g, NOW);
  equal(upgraded.contentRevision, 11, 'Revision 9 saves upgrade to revision 11');
  equal(JSON.stringify(g), before, 'Migration never mutates the saved snapshot');
  equal(
    upgraded.players.map((p) => p.shells),
    g.players.map((p) => p.shells),
    'Migration preserves balances',
  );
}

console.log(
  `PASS: ${checks} party-rule checks â€” color teams, team payouts, last turns, Nabbit, Captain Klaxon, Shrink/Growth Rays, CPU items, migration`,
);
