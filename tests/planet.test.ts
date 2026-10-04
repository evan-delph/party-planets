/** Behavioral regressions for Planet Party. Copy into tests/ before running. */
import assert from 'node:assert/strict';
import { BOARDS, getBoard } from '../game/boards';
import { DEFAULT_AVATAR, RULES } from '../game/config';
import {
  newGame,
  player,
  reduceGame,
  validateAvatar,
  type Action,
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
const constant = (n: number) => () => n;
type Fixture = { game: Game; now: number };

function fresh(board = 'crown', goal = 0): Fixture {
  const seats = [0, 1, 2, 3].map((i) => {
    const p = player('human-' + i, { ...DEFAULT_AVATAR, name: 'Alien ' + i });
    p.items = [];
    return p;
  });
  let game = newGame(DEFAULT_AVATAR, 10, 1, seats, board, goal);
  let now = game.flight?.startedAt ?? Date.now();
  check(
    game.phase === 'arrival',
    'A new party starts with the arrival sequence',
  );
  equal(
    game.players.map((p) => p.pos),
    [0, 0, 0, 0],
    'All four passengers arrive at the first space',
  );
  now = Math.max(now, game.due) + 1;
  game = reduceGame(game, '', { type: 'tick' }, now, constant(0));
  check(game.phase === 'turn', 'The arrival releases the first turn');
  now = Math.max(now, game.announce?.until ?? now) + 1;
  return { game, now };
}
function act(f: Fixture, action: Action, rng = constant(0), actor?: string) {
  f.game = reduceGame(
    f.game,
    actor ?? f.game.players[f.game.active].id,
    action,
    f.now,
    rng,
  );
}
function tick(f: Fixture, at: number, rng = constant(0)) {
  f.now = Math.max(f.now, at);
  f.game = reduceGame(f.game, '', { type: 'tick' }, f.now, rng);
}
function noChange(f: Fixture, action: Action, message: string, actor?: string) {
  const before = JSON.stringify(f.game);
  try {
    act(f, action, constant(0), actor);
  } catch {}
  equal(JSON.stringify(f.game), before, message);
}
function settle(f: Fixture, rng = constant(0)) {
  let budget = 100;
  while (
    ['rolling', 'moving', 'fork', 'diamond'].includes(f.game.phase) &&
    budget-- > 0
  ) {
    if (f.game.phase === 'diamond') {
      act(
        f,
        {
          type: 'diamond',
          value:
            f.game.players[f.game.active].shells >= RULES.pearlPrice ? 1 : 0,
        },
        rng,
      );
    } else if (f.game.phase === 'fork') {
      const next = getBoard(f.game.boardId).spaces[
        f.game.players[f.game.active].pos
      ].next;
      act(f, { type: 'route', value: next[0] }, rng);
    } else {
      const deadline =
        f.game.phase === 'rolling'
          ? (f.game.dice?.until ?? f.game.due)
          : (f.game.movement?.arrivesAt ?? f.game.due);
      tick(f, deadline + 1, rng);
    }
  }
  check(
    budget > 0,
    'A rolled move always reaches a bounded decision or landing',
  );
}
function endTurn(f: Fixture, rng = constant(0)) {
  f.now = Math.max(f.now, f.game.presentUntil ?? f.now) + 1;
  act(f, { type: 'end' }, rng);
  f.now = Math.max(f.now, f.game.announce?.until ?? f.now) + 1;
}
function beginVote(rng = constant(0)): Fixture {
  const f = fresh();
  f.game.active = 3;
  // Earlier seats skipped their turns; give them blue landings (free-for-all).
  f.game.players.forEach((p) => (p.color = 'blue'));
  f.game.phase = 'landed';
  f.game.presentUntil = f.now;
  endTurn(f, rng);
  check(
    (f.game as Game).phase === 'vote',
    'Four complete board turns open a minigame vote',
  );
  check(!!f.game.vote, 'The vote has shared authoritative state');
  equal(
    new Set(f.game.vote!.choices).size,
    3,
    'The ballot contains exactly three distinct games',
  );
  equal(f.game.vote!.choices.length, 3, 'Exactly three choices are offered');
  return f;
}
function ballot(f: Fixture, seat: number, choice: number, rng = constant(0)) {
  act(
    f,
    { type: 'vote', value: choice, voteId: f.game.vote!.id },
    rng,
    f.game.players[seat].id,
  );
}
function finishVote(f: Fixture, rng = constant(0)) {
  let budget = 10;
  while (f.game.phase === 'vote' && budget-- > 0) {
    tick(
      f,
      Math.max(f.game.due, f.game.vote!.endsAt, f.game.vote!.resolvedAt ?? 0) +
        2000,
      rng,
    );
  }
  check(
    budget > 0 && f.game.phase === 'minigame',
    'A resolved vote enters its selected minigame',
  );
  return f.game.mini;
}

// The roll does not teleport the player or preselect a future fork.
for (const board of BOARDS) {
  const f = fresh(board.id);
  const fork = board.spaces.find((s) => s.next.length > 1)!;
  check(!!fork, `${board.id} has a real branch`);
  f.game.players[0].pos = fork.id;
  noChange(
    f,
    { type: 'route', value: fork.next[1] },
    'Routes cannot be selected before rolling',
  );
  const original = f.game;
  const serialized = JSON.stringify(original);
  act(f, { type: 'roll' });
  equal(
    JSON.stringify(original),
    serialized,
    'Rolling does not mutate the caller state',
  );
  check(
    f.game.phase === 'rolling',
    'Every roll exposes a dice animation phase',
  );
  equal(
    f.game.players[0].pos,
    fork.id,
    'The character stays put during the dice animation',
  );
  equal(
    f.game.dice?.values,
    [1],
    'The animation carries the actual die result',
  );
  tick(f, f.game.dice!.until + 1);
  check(
    f.game.phase === 'fork',
    'A rolled player at a fork chooses where to move',
  );
  equal(
    f.game.players[0].pos,
    fork.id,
    'A fork decision pauses at the actual branch',
  );
  equal(f.game.remaining, 1, 'Opening a fork prompt consumes no movement');
  noChange(
    f,
    { type: 'route', value: -123 },
    'An invalid destination cannot move the player',
  );
  noChange(
    f,
    { type: 'route', value: fork.next[1] },
    'Another player cannot choose the active route',
    f.game.players[1].id,
  );
  act(f, { type: 'route', value: fork.next[1] });
  check(
    f.game.phase === 'moving',
    'A chosen fork starts a visible movement segment',
  );
  const segment = f.game.movement!;
  equal(
    [segment.from, segment.to],
    [fork.id, fork.next[1]],
    'The movement follows the chosen edge',
  );
  check(
    segment.arrivesAt > segment.startedAt,
    'Board movement has a nonzero animation duration',
  );
  settle(f);
  check(
    f.game.path.includes(fork.next[1]),
    'The played path contains the selected destination',
  );
}

// A fork encountered partway through a roll interrupts movement at that fork.
{
  const f = fresh();
  const spaces = getBoard(f.game.boardId).spaces;
  const beforeFork = spaces.find(
    (s) => s.next.length === 1 && spaces[s.next[0]].next.length > 1,
  )!;
  check(!!beforeFork, 'There is an incoming segment to a branch');
  const fork = spaces[beforeFork.next[0]];
  f.game.players[0].pos = beforeFork.id;
  act(f, { type: 'roll' }, constant(0.1)); // Two steps on the ten-sided die.
  tick(f, f.game.dice!.until + 1);
  check(
    f.game.phase === 'moving',
    'The first segment begins without a premature route question',
  );
  tick(f, f.game.movement!.arrivesAt + 1);
  check(
    f.game.phase === 'fork',
    'The route question appears after reaching the branch',
  );
  equal(
    f.game.players[0].pos,
    fork.id,
    'The active character has physically reached the fork',
  );
  equal(f.game.remaining, 1, 'The unspent part of the roll survives the fork');
}

// Purchasing and relocation are shared rules, including occupied destinations.
check(RULES.pearlPrice === 50, 'A diamond costs exactly fifty points');
for (const board of BOARDS) {
  for (const sample of [0, 0.12, 0.4, 0.65, 0.9, 0.999999]) {
    const f = fresh(board.id);
    const predecessor = board.spaces.find(
      (s) => board.spaces[s.next[0]].type === 'blue',
    )!;
    const target = predecessor.next[0];
    f.game.players[0].pos = predecessor.id;
    f.game.players[0].shells = 100;
    f.game.pearl = target;
    const occupied = board.spaces
      .filter((s) => s.type === 'blue' && s.id !== target)
      .slice(0, 3);
    f.game.players.slice(1).forEach((p, i) => (p.pos = occupied[i].id));
    act(f, { type: 'roll' }, constant(0));
    settle(f, constant(sample));
    equal(
      f.game.players[0].pearls,
      1,
      'Passing the diamond buys exactly one diamond',
    );
    equal(
      f.game.players[0].shells,
      100 - 50 + RULES.blueReward,
      'Purchase deducts fifty before the landed reward',
    );
    check(
      !f.game.players.some((p) => p.pos === f.game.pearl),
      'The new diamond never appears under any character',
    );
    check(f.game.pearl !== target, 'The purchased diamond moves elsewhere');
    const once = JSON.stringify(f.game);
    tick(f, f.now);
    equal(
      JSON.stringify(f.game),
      once,
      'A duplicate timestamp cannot repeat purchases or landing rewards',
    );
  }
}
{
  const f = fresh('crown', 1);
  const spaces = getBoard(f.game.boardId).spaces;
  const predecessor = spaces.find((s) => spaces[s.next[0]].type === 'blue')!;
  f.game.players[0].pos = predecessor.id;
  f.game.players[0].shells = 50;
  f.game.pearl = predecessor.next[0];
  act(f, { type: 'roll' });
  settle(f);
  check(
    f.game.phase === 'finished',
    'Reaching the configured diamond goal ends the match',
  );
  equal(f.game.players[0].pearls, 1, 'The winning diamond is recorded');
}

// Authoritative voting: revisions are allowed before resolution, ties stay tied-only.
{
  const f = beginVote();
  const [a, b] = f.game.vote!.choices;
  ballot(f, 0, a);
  ballot(f, 0, b);
  equal(
    Object.keys(f.game.vote!.ballots).length,
    1,
    'Changing a ballot does not create an extra vote',
  );
  equal(
    f.game.vote!.ballots[f.game.players[0].id],
    b,
    'A voter can change their choice before resolution',
  );
  noChange(
    f,
    { type: 'vote', value: a, voteId: 'expired-vote' },
    'An old ballot cannot enter a new round',
    f.game.players[1].id,
  );
  noChange(
    f,
    { type: 'vote', value: -1, voteId: f.game.vote!.id },
    'An unoffered minigame cannot receive a vote',
    f.game.players[1].id,
  );
  tick(f, f.game.vote!.endsAt + 1);
  equal(
    finishVote(f),
    b,
    'An unanswered-seat timeout respects the votes actually cast',
  );
}
const tiedWinners = new Set<number>();
for (const sample of [0, 0.999999]) {
  const f = beginVote();
  const [a, b, excluded] = f.game.vote!.choices;
  ballot(f, 0, a, constant(sample));
  ballot(f, 1, a, constant(sample));
  ballot(f, 2, b, constant(sample));
  ballot(f, 3, b, constant(sample));
  const winner = finishVote(f, constant(sample));
  check(
    winner === a || winner === b,
    'A two-to-two tie resolves only between the tied choices',
  );
  check(winner !== excluded, 'A zero-vote option cannot win a two-way tie');
  tiedWinners.add(winner);
}
equal(
  tiedWinners.size,
  2,
  'Opposite random draws can select either tied candidate',
);
for (const sample of [0, 0.999999]) {
  const f = beginVote();
  const [a, b] = f.game.vote!.choices;
  [0, 1, 2].forEach((i) => ballot(f, i, a, constant(sample)));
  ballot(f, 3, b, constant(sample));
  equal(
    finishVote(f, constant(sample)),
    a,
    'A three-to-one vote always chooses the majority',
  );
}
{
  const f = beginVote();
  const choices = [...f.game.vote!.choices];
  tick(f, f.game.vote!.endsAt + 1, constant(0.999999));
  check(
    choices.includes(finishVote(f, constant(0.999999))),
    'An all-abstain timeout chooses one of the three offered games',
  );
}

// The ramp follows actual first rolls, not elapsed time or the first player.
{
  const f = fresh();
  for (let seat = 0; seat < 4; seat++) {
    const id = f.game.players[seat].id;
    equal(
      f.game.active,
      seat,
      'Full turns advance to the next passenger in order',
    );
    act(f, { type: 'roll' });
    settle(f);
    check(
      Number.isFinite(f.game.departed?.[id]),
      'A passenger gets an exit timestamp on their first roll',
    );
    equal(
      Object.keys(f.game.departed ?? {}).length,
      seat + 1,
      'Each alien leaves the UFO exactly once',
    );
    if (seat < 3)
      check(
        !f.game.rampClosesAt,
        'The ramp remains open while passengers have not rolled',
      );
    else
      check(
        Number.isFinite(f.game.rampClosesAt),
        'The ramp closes after the fourth first roll',
      );
    endTurn(f);
    if (seat < 3) {
      check(!!f.game.announce, 'Completing a turn announces the next player');
      check(
        f.game.announce!.until > 0,
        'The turn announcement has a bounded presentation window',
      );
    }
  }
  check(
    f.game.phase === 'vote',
    'All first turns lead to the first shared minigame vote',
  );
}

// Existing saved appearance data still loads while enforcing the alien skin.
equal(
  validateAvatar({ ...DEFAULT_AVATAR, skin: '#ec805b' }).skin,
  DEFAULT_AVATAR.skin,
  'Legacy saved skin is normalized to the fixed alien green',
);
equal(
  validateAvatar({ ...DEFAULT_AVATAR, pattern: 4 }).pattern,
  4,
  'Hawaiian shirt customization is accepted',
);
console.log(
  `PASS: ${checks} Planet Party rules checks: visible rolls, in-path forks, green aliens, UFO departures, exact diamond pricing and occupancy, immutable replay, and three-way majority/tie voting.`,
);
