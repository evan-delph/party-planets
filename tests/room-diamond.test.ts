import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as engine from '../game/engine';
import * as config from '../game/config';
import * as boards from '../game/boards';
import * as catalog from '../game/arcade/catalog';

// Exercise the real API handler against an isolated in-memory room record.
let row: { data: string; revision: number; expires: number };
const db = {
  prepare: (sql: string) => ({
    bind: (...args: unknown[]) => ({
      first: async () => row,
      run: async () => {
        assert.ok(sql.startsWith('UPDATE rooms'));
        if (args[2] !== row.revision) return { meta: { changes: 0 } };
        row.data = String(args[0]);
        row.revision++;
        return { meta: { changes: 1 } };
      },
    }),
  }),
};
const compiled = ts.transpileModule(
  fs.readFileSync('app/api/room/route.ts', 'utf8'),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
const exported: {
  POST?: (req: Request) => Promise<Response>;
  GET?: (req: Request) => Promise<Response>;
} = {};
vm.runInNewContext(compiled, {
  exports: exported,
  Response,
  Request,
  URL,
  crypto,
  require: (name: string) => {
    if (name === '@/db') return { database: () => db };
    if (name === '@/game/engine') return engine;
    if (name === '@/game/config') return config;
    if (name === '@/game/boards') return boards;
    if (name === '@/game/arcade/catalog') return catalog;
    throw Error('Unexpected dependency: ' + name);
  },
});
function fixture(balance: number) {
  const game = engine.newGame(
    config.DEFAULT_AVATAR,
    5,
    1,
    undefined,
    'crown',
    0,
  );
  game.phase = 'diamond';
  game.players[0].pos = game.pearl;
  game.players[0].shells = balance;
  game.remaining = 1;
  game.path = [game.pearl];
  game.flight = undefined;
  row = {
    data: JSON.stringify({
      host: 'local',
      seats: [
        { id: 'local', token: 'fixture-token', avatar: config.DEFAULT_AVATAR },
      ],
      game,
      rounds: 5,
      difficulty: 1,
    }),
    revision: 0,
    expires: Date.now() + 60000,
  };
}
async function choose(
  value: number,
  token = 'fixture-token',
  revision = row.revision,
) {
  return exported.POST!(
    new Request('http://localhost:3000/api/room', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-party-token': token },
      body: JSON.stringify({
        type: 'action',
        code: 'TEST1234',
        revision,
        action: { type: 'diamond', value },
      }),
    }),
  );
}
async function test() {
  fixture(100);
  assert.equal((await choose(1, 'wrong-token')).status, 400);
  const buy = await choose(1);
  assert.equal(buy.status, 200);
  const data = (await buy.json()) as { game: engine.Game };
  assert.equal(data.game.players[0].pearls, 1);
  assert.equal(data.game.players[0].shells, 50);
  assert.equal(
    (await choose(1, 'fixture-token', 0)).status,
    409,
    'Stale duplicate cannot purchase twice',
  );
  fixture(2);
  assert.equal((await choose(1)).status, 400);
  assert.equal(row.revision, 0, 'Rejected purchase never saves');
  const pass = await choose(0);
  assert.equal(pass.status, 200);
  const passed = (await pass.json()) as { game: engine.Game };
  assert.equal(passed.game.players[0].shells, 2);
  assert.notEqual(passed.game.phase, 'diamond');
  fixture(20);
  const room = JSON.parse(row.data);
  const lotto = boards.getBoard().spaces.find((n) => n.type === 'lottery')!;
  room.game.phase = 'moving';
  room.game.remaining = 2;
  room.game.due = Date.now();
  room.game.movement = {
    from: 0,
    to: lotto.id,
    startedAt: Date.now() - 1000,
    arrivesAt: Date.now(),
  };
  room.game = engine.reduceGame(room.game, '', { type: 'tick' }, Date.now());
  row.data = JSON.stringify(room);
  const hidden = await exported.GET!(
    new Request('http://localhost:3000/api/room?code=TEST1234', {
      headers: { 'x-party-token': 'fixture-token' },
    }),
  );
  const pending = ((await hidden.json()) as { game: engine.Game }).game;
  assert.equal(pending.lottery!.cards, undefined);
  assert.equal(
    JSON.parse(row.data).game.lottery.cards.length,
    16,
    'Redaction never mutates saved outcomes',
  );
  async function lottoAction(
    type: engine.Action['type'],
    value?: number,
    lotteryId = pending.lottery!.id,
  ) {
    return exported.POST!(
      new Request('http://localhost:3000/api/room', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-party-token': 'fixture-token',
        },
        body: JSON.stringify({
          type: 'action',
          code: 'TEST1234',
          revision: row.revision,
          action: { type, value, lotteryId },
        }),
      }),
    );
  }
  const win = room.game.lottery.cards.indexOf(2);
  assert.equal((await lottoAction('lotteryPick', 16)).status, 400);
  const picked = (await (await lottoAction('lotteryPick', win)).json()) as {
    game: engine.Game;
  };
  assert.equal(picked.game.lottery!.cards, undefined);
  assert.equal(picked.game.players[0].shells, 20);
  const revealed = (await (await lottoAction('lotteryScratch')).json()) as {
    game: engine.Game;
  };
  assert.equal(revealed.game.lottery!.cards!.length, 16);
  assert.equal(revealed.game.players[0].shells, 120);
  const repeated = (await (await lottoAction('lotteryScratch')).json()) as {
    game: engine.Game;
  };
  assert.equal(
    repeated.game.players[0].shells,
    120,
    'Fresh revision duplicate cannot pay twice',
  );
  const continued = (await (await lottoAction('lotteryContinue')).json()) as {
    game: engine.Game;
  };
  assert.ok(['moving', 'fork'].includes(continued.game.phase));
  assert.equal(continued.game.remaining, 1);
  console.log(
    'PASS: online diamond + lottery API, hidden cards, reveal, idempotent rewards, auth and stale revisions',
  );
}
void test().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
