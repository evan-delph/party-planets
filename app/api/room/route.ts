import { getBoard } from '@/game/boards';
import { normalizeMinigamePool } from '@/game/arcade/catalog';
import { database } from '@/db';
import {
  Game,
  Player,
  Action,
  newGame,
  player,
  reduceGame,
  validateAvatar,
} from '@/game/engine';
import { DEFAULT_AVATAR, OUTFITS } from '@/game/config';
type Room = {
  boardId?: string;
  host: string;
  seats: { id: string; token: string; avatar: Player['avatar'] }[];
  game: Game | null;
  rounds: number;
  difficulty: number;
  diamondGoal?: number;
  minigamePool?: string[];
};
const response = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
function visible(room: Room, revision: number) {
  return {
    serverTime: Date.now(),
    host: room.host,
    seats: room.seats.map(({ id, avatar }) => ({ id, avatar })),
    game:
      room.game?.lottery && room.game.lottery.stage !== 'revealed'
        ? {
            ...room.game,
            lottery: {
              ...room.game.lottery,
              cards: undefined,
              result: undefined,
            },
          }
        : room.game,
    rounds: room.rounds,
    difficulty: room.difficulty,
    diamondGoal: room.diamondGoal ?? 3,
    minigamePool: normalizeMinigamePool(room.minigamePool),
    boardId: room.boardId,
    revision,
  };
}
const token = () => crypto.randomUUID() + crypto.randomUUID();
function checkOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    throw Error('Invalid origin.');
}
async function load(code: string) {
  if (!/^[A-Z0-9]{8}$/.test(code))
    throw Error('Enter an 8-character room code.');
  const row = await database()
    .prepare('SELECT data, revision, expires FROM rooms WHERE code = ?')
    .bind(code)
    .first<{ data: string; revision: number; expires: number }>();
  if (!row || row.expires < Date.now())
    throw Error('This room was not found or has expired.');
  return { room: JSON.parse(row.data) as Room, revision: row.revision };
}
function auth(room: Room, key: string) {
  const seat = room.seats.find((s) => s.token === key);
  if (!seat)
    throw Error('Your room session expired. Rejoin with the room code.');
  return seat;
}
async function save(code: string, room: Room, revision: number) {
  const result = await database()
    .prepare(
      'UPDATE rooms SET data = ?, revision = revision + 1 WHERE code = ? AND revision = ?',
    )
    .bind(JSON.stringify(room), code, revision)
    .run();
  return result.meta.changes === 1;
}
export async function GET(request: Request) {
  try {
    const code = new URL(request.url).searchParams.get('code') ?? '',
      key = request.headers.get('x-party-token') ?? '';
    for (let retry = 0; retry < 4; retry++) {
      const { room, revision } = await load(code);
      const seat = auth(room, key),
        now = Date.now(),
        targetArenaTime = room.game
          ? Math.max(0, (now - room.game.miniStart) / 1000)
          : 0,
        shouldAdvance =
          room.game &&
          (room.game.phase !== 'minigame' ||
            seat.id === room.host ||
            !room.game.arcade ||
            targetArenaTime - room.game.arcade.time > 0.75);
      if (room.game && shouldAdvance) {
        const next = reduceGame(room.game, 'online', { type: 'tick' }, now);
        if (next !== room.game) {
          room.game = next;
          if (!(await save(code, room, revision))) continue;
          return response(visible(room, revision + 1));
        }
      }
      return response(visible(room, revision));
    }
    return response({ error: 'Room is busy. Retrying…' }, 409);
  } catch (e) {
    return response({ error: (e as Error).message }, 400);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    if (Number(request.headers.get('content-length') ?? 0) > 12000)
      throw Error('Request too large.');
    const raw = await request.text();
    if (raw.length > 12000) throw Error('Request too large.');
    const body = JSON.parse(raw);
    if (body.type === 'create') {
      const avatar = validateAvatar(body.avatar),
        id = crypto.randomUUID(),
        key = token(),
        code = crypto
          .randomUUID()
          .replaceAll('-', '')
          .slice(0, 8)
          .toUpperCase();
      const rounds = [5, 10, 15, 20, 30].includes(body.rounds)
        ? body.rounds
        : 10;
      const room: Room = {
        host: id,
        seats: [{ id, token: key, avatar }],
        game: null,
        rounds,
        minigamePool: normalizeMinigamePool(body.minigamePool),
        boardId: getBoard(body.boardId).id,
        difficulty: [0, 1, 2].includes(body.difficulty) ? body.difficulty : 1,
        diamondGoal: [0, 1, 3, 5, 10].includes(body.diamondGoal)
          ? body.diamondGoal
          : 3,
      };
      await database()
        .prepare(
          'INSERT INTO rooms (code, data, revision, expires) VALUES (?, ?, 0, ?)',
        )
        .bind(code, JSON.stringify(room), Date.now() + 86400000)
        .run();
      return response({ code, id, token: key, ...visible(room, 0) });
    }
    const code = String(body.code ?? '')
      .trim()
      .toUpperCase();
    for (let retry = 0; retry < 5; retry++) {
      const { room, revision } = await load(code);
      if (body.type === 'join') {
        if (room.game) throw Error('This party has already started.');
        if (room.seats.length >= 4) throw Error('This party is full.');
        const avatar = validateAvatar(body.avatar),
          seat = { id: crypto.randomUUID(), token: token(), avatar };
        room.seats.push(seat);
        if (!(await save(code, room, revision))) continue;
        return response({
          code,
          id: seat.id,
          token: seat.token,
          ...visible(room, revision + 1),
        });
      }
      const seat = auth(room, request.headers.get('x-party-token') ?? '');
      if (body.type === 'leave') {
        room.seats = room.seats.filter((s) => s.id !== seat.id);
        if (room.host === seat.id) room.host = room.seats[0]?.id ?? '';
        if (room.game) {
          const player = room.game.players.find((p) => p.id === seat.id);
          if (player) player.cpu = true;
          const runner = room.game.arcade?.actors.find((p) => p.id === seat.id);
          if (runner) runner.cpu = true;
        }
        if (!(await save(code, room, revision))) continue;
        return response({ left: true, serverTime: Date.now() });
      } else if (body.type === 'start') {
        if (seat.id !== room.host)
          throw Error('Only the host can start the party.');
        if (room.game) return response(visible(room, revision));
        room.minigamePool = normalizeMinigamePool(
          body.minigamePool ?? room.minigamePool,
        );
        if (body.rounds !== undefined) {
          if (
            ![5, 10, 15, 20, 30].includes(body.rounds) ||
            ![0, 1, 2].includes(body.difficulty) ||
            ![0, 1, 3, 5, 10].includes(body.diamondGoal)
          )
            throw Error('Invalid party settings.');
          room.rounds = body.rounds;
          room.difficulty = body.difficulty;
          room.diamondGoal = body.diamondGoal;
        }
        const players = room.seats.map((s) => player(s.id, s.avatar));
        while (players.length < 4) {
          const i = players.length;
          players.push(
            player(
              'bot' + i,
              {
                ...DEFAULT_AVATAR,
                name: ['', 'Chorizo', 'Coco', 'Bratley'][i],
                shirt: OUTFITS[i],
                hair: i,
              },
              true,
            ),
          );
        }
        room.game = newGame(
          seat.avatar,
          room.rounds,
          room.difficulty,
          players,
          room.boardId,
          room.diamondGoal ?? 3,
          room.minigamePool,
        );
      } else if (body.type === 'action') {
        if (!room.game) throw Error('The party has not started.');
        const action = body.action as Action;
        if (
          !action ||
          ![
            'roll',
            'route',
            'vote',
            'end',
            'use',
            'buy',
            'diamond',
            'steal',
            'lotteryPick',
            'lotteryScratch',
            'lotteryContinue',
            'ready',
            'control',
            'next',
          ].includes(action.type)
        )
          throw Error('Unknown action.');
        if (action.type === 'next' && seat.id !== room.host)
          throw Error('Only the host can continue the round.');
        if (
          !['control', 'ready', 'vote'].includes(action.type) &&
          body.revision !== revision
        )
          return response(
            { error: 'The party moved ahead. Try that action again.' },
            409,
          );
        if (
          action.type === 'control' &&
          (!Number.isFinite(action.miniStart) ||
            !action.control ||
            !['ap', 'bp', 'ar'].every((key) =>
              Number.isSafeInteger(action.control![key as 'ap' | 'bp' | 'ar']),
            ))
        )
          throw Error('Invalid minigame input.');
        const next = reduceGame(room.game, seat.id, action);
        if (next === room.game) return response(visible(room, revision));
        room.game = next;
      } else throw Error('Unknown request.');
      if (!(await save(code, room, revision))) continue;
      return response(visible(room, revision + 1));
    }
    return response({ error: 'Room is busy. Please try again.' }, 409);
  } catch (e) {
    return response({ error: (e as Error).message }, 400);
  }
}
