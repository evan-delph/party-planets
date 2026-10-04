import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import ts from 'typescript';
const require = createRequire(import.meta.url);
require.extensions['.ts'] = (module, filename) => {
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  module._compile(compiled.outputText, filename);
};
const { advanceArena } = require('../game/arcade/simulation.ts');
const origin = process.env.PARTY_ORIGIN ?? 'http://localhost:3000';
const avatar = {
  name: 'Network tester',
  skin: '#86da62',
  shirt: '#12ad9a',
  hair: 1,
  eyes: 0,
  mouth: 0,
  accessory: 0,
  height: 1,
  width: 1,
};
async function post(body, key) {
  const r = await fetch(origin + '/api/room', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(key ? { 'x-party-token': key } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  return { status: r.status, data: await r.json() };
}
async function get(code, key) {
  const r = await fetch(origin + '/api/room?code=' + code, {
    headers: key ? { 'x-party-token': key } : {},
    signal: AbortSignal.timeout(15000),
  });
  return { status: r.status, data: await r.json() };
}
const host = await post({
  type: 'create',
  avatar,
  rounds: 10,
  boardId: 'moss',
});
assert.equal(host.status, 200, JSON.stringify(host));
const code = host.data.code,
  players = [host.data];
const joined = await Promise.all(
  [1, 2, 3].map((i) =>
    post({ type: 'join', code, avatar: { ...avatar, name: 'Tester ' + i } }),
  ),
);
for (const result of joined) {
  assert.equal(result.status, 200, JSON.stringify(result));
  players.push(result.data);
}
const full = await post({ type: 'join', code, avatar });
assert.equal(full.status, 400);
assert.match(full.data.error, /full/);
const unauthorized = await get(code);
assert.equal(unauthorized.status, 400);
const nonhost = await post({ type: 'start', code }, players[1].token);
assert.equal(nonhost.status, 400);
const started = await post({ type: 'start', code }, players[0].token);
assert.equal(started.status, 200);
assert.equal(started.data.game.players.length, 4);
assert.equal(started.data.game.boardId, 'moss');
assert.equal(started.data.game.bank, 0);
assert.equal(started.data.game.players.filter((p) => p.cpu).length, 0);
async function waitState(code, key, predicate, limit = 90000) {
  const until = Date.now() + limit;
  let state;
  while (Date.now() < until) {
    const r = await get(code, key);
    assert.equal(r.status, 200, JSON.stringify(r));
    state = r.data;
    if (predicate(state)) return state;
    await new Promise((r) => setTimeout(r, 220));
  }
  throw Error(
    'State timeout: ' +
      JSON.stringify({ phase: state?.game?.phase, due: state?.game?.due }),
  );
}
let preRoll = await waitState(
  code,
  players[0].token,
  (s) => s.game.phase === 'turn' && Date.now() >= s.game.announce.until,
);
let revision = preRoll.revision;
const wrong = await post(
  { type: 'action', code, revision, action: { type: 'roll' } },
  players[1].token,
);
assert.equal(wrong.status, 400);
const raced = await Promise.all(
  [0, 1].map(() =>
    post(
      { type: 'action', code, revision, action: { type: 'roll' } },
      players[0].token,
    ),
  ),
);
assert.equal(raced.filter((r) => r.status === 200).length, 1);
assert.equal(raced.filter((r) => r.status === 409).length, 1);
let state = (await get(code, players[0].token)).data;
const ids = state.game.players.map((p) => p.id);
const { getBoard } = require('../game/boards.ts');
const boardSpaces = getBoard(state.game.boardId).spaces;
for (let i = 0; i < 4; i++) {
  const p = players.find((p) => p.id === ids[i]);
  if (i) {
    state = await waitState(
      code,
      p.token,
      (s) => s.game.phase === 'turn' && Date.now() >= s.game.announce.until,
    );
    const rolled = await post(
      {
        type: 'action',
        code,
        revision: state.revision,
        action: { type: 'roll' },
      },
      p.token,
    );
    assert.equal(rolled.status, 200, JSON.stringify(rolled));
    state = rolled.data;
  }
  let budget = 100;
  while (state.game.phase !== 'landed' && budget-- > 0) {
    if (state.game.phase === 'fork') {
      const routed = await post(
        {
          type: 'action',
          code,
          revision: state.revision,
          action: {
            type: 'route',
            value: boardSpaces[state.game.players[i].pos].next[0],
          },
        },
        p.token,
      );
      assert.equal(routed.status, 200, JSON.stringify(routed));
      state = routed.data;
    } else if (
      state.game.phase === 'diamond' ||
      state.game.phase === 'lottery'
    ) {
      const lottery = state.game.lottery;
      const action =
        state.game.phase === 'diamond'
          ? { type: 'diamond', value: 0 }
          : lottery.stage === 'pick'
            ? { type: 'lotteryPick', value: 0, lotteryId: lottery.id }
            : lottery.stage === 'scratch'
              ? { type: 'lotteryScratch', lotteryId: lottery.id }
              : { type: 'lotteryContinue', lotteryId: lottery.id };
      const resolved = await post(
        { type: 'action', code, revision: state.revision, action },
        p.token,
      );
      assert.equal(resolved.status, 200, JSON.stringify(resolved));
      state = resolved.data;
    } else {
      await new Promise((r) => setTimeout(r, 220));
      state = (await get(code, p.token)).data;
    }
  }
  assert.ok(
    budget > 0,
    'Visible board movement reaches a landing: ' + state.game.phase,
  );
  await new Promise((r) =>
    setTimeout(r, Math.max(0, state.game.presentUntil - Date.now() + 25)),
  );
  const ended = await post(
    { type: 'action', code, revision: state.revision, action: { type: 'end' } },
    p.token,
  );
  assert.equal(ended.status, 200);
  state = ended.data;
}
assert.equal(state.game.phase, 'vote');
assert.equal(new Set(state.game.vote.choices).size, 3);
const voteId = state.game.vote.id,
  [choiceA, choiceB, excluded] = state.game.vote.choices;
const ballots = await Promise.all(
  players.map((p, i) =>
    post(
      {
        type: 'action',
        code,
        action: { type: 'vote', voteId, value: i < 2 ? choiceA : choiceB },
      },
      p.token,
    ),
  ),
);
for (const b of ballots) assert.equal(b.status, 200, JSON.stringify(b));
state = await waitState(
  code,
  players[0].token,
  (s) => s.game.phase === 'minigame',
);
assert.ok(
  [choiceA, choiceB].includes(state.game.mini),
  'Tie selects only tied candidates',
);
assert.notEqual(state.game.mini, excluded);
assert.equal(
  Object.keys(state.game.vote.ballots).length,
  4,
  'Concurrent ballots all survive CAS retries',
);
const staleVote = await post(
  {
    type: 'action',
    code,
    action: { type: 'vote', voteId: 'old-vote', value: excluded },
  },
  players[0].token,
);
assert.equal(staleVote.status, 200);
assert.equal(staleVote.data.game.mini, state.game.mini);
const snapshots = await Promise.all(players.map((p) => get(code, p.token)));
for (const snap of snapshots) {
  assert.equal(snap.status, 200);
  assert.deepEqual(snap.data.game, state.game);
  assert.ok(!JSON.stringify(snap.data).includes(players[0].token));
}
const ready = await Promise.all(
  players.map((p) =>
    post({ type: 'action', code, action: { type: 'ready' } }, p.token),
  ),
);
for (const result of ready)
  assert.equal(result.status, 200, JSON.stringify(result));
state = (await get(code, players[0].token)).data;
assert.equal(state.game.miniReady.length, 4);
assert.ok(state.game.miniStart - Date.now() <= 3000);
const wait = Math.max(0, state.game.miniStart - Date.now() + 50);
await new Promise((r) => setTimeout(r, wait));
const miniStart = state.game.miniStart;
const control = {
  x: -1,
  z: 0,
  a: true,
  b: false,
  seq: Date.now(),
  ap: 1,
  bp: 0,
  ar: 0,
};
const inputs = await Promise.all(
  players.map((p) =>
    post(
      { type: 'action', code, action: { type: 'control', miniStart, control } },
      p.token,
    ),
  ),
);
for (const input of inputs)
  assert.equal(input.status, 200, JSON.stringify(input));
const initial = (await get(code, players[0].token)).data.game.arcade;
await new Promise((r) => setTimeout(r, 280));
state = (await get(code, players[0].token)).data;
assert.ok(state.game.arcade.time > 0.2);
for (const p of state.game.arcade.actors) {
  assert.equal(p.input.seq, control.seq);
}
// The shuffled catalog includes boats, puzzles, and preview phases where left
// does not mean walking. Verify the actual selected rules against the same
// accepted-input snapshot, including every projectile, score, and role field.
const expected = structuredClone(initial);
advanceArena(expected, (state.game.arcade.tick + 0.1) / 60);
assert.deepEqual(
  state.game.arcade,
  expected,
  'Server applies the selected minigame physics to all four clients',
);
const old = await post(
  {
    type: 'action',
    code,
    action: {
      type: 'control',
      miniStart,
      control: { ...control, x: 1, seq: control.seq - 1 },
    },
  },
  players[0].token,
);
assert.equal(old.status, 200);
assert.equal(
  old.data.game.arcade.actors.find((p) => p.id === players[0].id).input.seq,
  control.seq,
);
const bad = await post(
  {
    type: 'action',
    code,
    action: {
      type: 'control',
      miniStart,
      control: { ...control, x: 50, seq: control.seq + 1 },
    },
  },
  players[0].token,
);
assert.equal(bad.status, 400);
const cheat = await post(
  {
    type: 'action',
    code,
    action: { type: 'arcadeResult', scores: [200000, 0, 0, 0] },
  },
  players[0].token,
);
assert.equal(cheat.status, 400);
const filled = await post({
  type: 'create',
  avatar,
  rounds: 5,
  difficulty: 2,
  diamondGoal: 5,
  boardId: 'alpine',
});
assert.equal(filled.status, 200, JSON.stringify(filled));
for (let i = 0; i < 2; i++)
  assert.equal(
    (
      await post({
        type: 'join',
        code: filled.data.code,
        avatar: { ...avatar, name: 'Crew ' + i },
      })
    ).status,
    200,
  );
const withCpu = await post(
  {
    type: 'start',
    code: filled.data.code,
    rounds: 15,
    difficulty: 0,
    diamondGoal: 1,
  },
  filled.data.token,
);
assert.equal(withCpu.status, 200, JSON.stringify(withCpu));
assert.equal(withCpu.data.game.players.filter((p) => p.cpu).length, 1);
assert.equal(withCpu.data.game.difficulty, 0);
assert.equal(withCpu.data.game.rounds, 15);
assert.equal(withCpu.data.game.diamondGoal, 1);
assert.ok(withCpu.data.game.players.every((p) => p.avatar.skin === '#86da62'));

const lobbyHost = await post({
  type: 'create',
  avatar,
  minigamePool: ['canopy', 'race'],
});
const lobbyGuest = await post({
  type: 'join',
  code: lobbyHost.data.code,
  avatar,
});
const left = await post(
  { type: 'leave', code: lobbyHost.data.code },
  lobbyHost.data.token,
);
assert.equal(left.status, 200);
const transferred = await get(lobbyHost.data.code, lobbyGuest.data.token);
assert.equal(transferred.data.host, lobbyGuest.data.id);
assert.equal(transferred.data.seats.length, 1);
const transferStart = await post(
  { type: 'start', code: lobbyHost.data.code },
  lobbyGuest.data.token,
);
assert.equal(transferStart.status, 200);
assert.deepEqual(transferStart.data.game.minigamePool, ['canopy', 'race']);
const guestLeft = await post({ type: 'leave', code }, players[1].token);
assert.equal(guestLeft.status, 200);
const afterLeave = (await get(code, players[0].token)).data;
assert.equal(
  afterLeave.game.players.find((p) => p.id === players[1].id).cpu,
  true,
);
assert.equal(
  afterLeave.game.arcade.actors.find((p) => p.id === players[1].id).cpu,
  true,
);
assert.equal((await get(code, players[1].token)).status, 400);
console.log(
  'PASS: three-human + one AI room with selected difficulty, host setup, timed dice/movement/forks, concurrent 2–2 voting, stale ballots,  four-client rooms, authorization, duplicate-roll conflict, turn order, ready countdown, concurrent controls and exact authoritative simulation, stale-input rejection, input bounds, server-only scoring, no token leakage.',
);
