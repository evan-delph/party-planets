import type { Arena, Control, Runner } from './simulation';
import { randomAt } from './simulation';

export const OVERHAUL = ['duos', 'bomb', 'dig', 'mangosluggers'];
export const RIVER_LENGTH = 210;
export const riverCenter = (d: number) =>
  Math.sin(d / 23) * 3 + Math.sin(d / 51) * 4;
export const riverHazards = Array.from({ length: 9 }, (_, i) => ({
  d: 24 + i * 21,
  side: i % 2 ? 1 : -1,
  rock: i % 3 === 1,
}));
export const dragonPhase = (time: number, i: number) => (time + i * 1.37) % 5.6;
export const bombBounds = (time: number) => {
  const x = Math.max(0.9, 8.5 - Math.max(0, time - 35) * 0.23);
  return { x, z: (x * 6.5) / 8.5 };
};
export type Bomb = {
  id: number;
  x: number;
  z: number;
  y: number;
  vx: number;
  vz: number;
  vy: number;
  fuse: number;
  holder: number;
  born: number;
  pickedAt?: number;
};
export type PuzzlePiece = {
  x: number;
  z: number;
  turn: number;
  locked: boolean;
};
export type Kayak = {
  distance: number;
  offset: number;
  heading: number;
  speed: number;
  strokes: number[];
  paired: number;
  stun: number;
  finish: number;
};
export type OverhaulState = {
  revision: 1;
  bombs: Bomb[];
  serial: number;
  spawnAt: number;
  explosions: { x: number; z: number; at: number; radius: number }[];
  boats: Kayak[];
  puzzles: {
    pieces: PuzzlePiece[];
    held: number;
    cursor: { x: number; z: number };
    feedback: number;
  }[];
  taps: number[];
  lastTap: number[];
};
export const puzzleSlot = (id: number) => ({
  x: ((id % 4) - 1.5) * 1.6,
  z: (Math.floor(id / 4) - 0.5) * 1.6 - 1.3,
});
const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
export function startOverhaul(w: Arena) {
  const order = Array.from({ length: 8 }, (_, i) => i).sort(
    (a, b) => randomAt(w.seed, a + 505) - randomAt(w.seed, b + 505),
  );
  w.overhaul = {
    revision: 1,
    bombs: [],
    serial: 0,
    spawnAt: 0.65,
    explosions: [],
    boats: [0, 1].map(() => ({
      distance: 0,
      offset: 0,
      heading: 0,
      speed: 0,
      strokes: [-10, -10],
      paired: -10,
      stun: 0,
      finish: 0,
    })),
    puzzles: w.actors.map(() => ({
      pieces: Array.from({ length: 8 }, (_, id) => {
        const slot = order.indexOf(id);
        return {
          x: ((slot % 4) - 1.5) * 1.8,
          z: 2.3 + Math.floor(slot / 4) * 1.75,
          turn: 1 + Math.floor(randomAt(w.seed, id + 720) * 3),
          locked: false,
        };
      }),
      held: -1,
      cursor: { x: 0, z: 3 },
      feedback: 0,
    })),
    taps: [0, 0, 0, 0],
    lastTap: [-1, -1, -1, -1],
  };
  w.actors.forEach((p, i) => {
    p.x = (i % 2 ? 1 : -1) * 5;
    p.z = (i < 2 ? 1 : -1) * 5;
    p.y = 0;
    p.gear = 0;
    p.distance = 0;
  });
}
function aim(p: { x: number; z: number }, x: number, z: number) {
  const d = Math.hypot(x - p.x, z - p.z);
  return { x: (x - p.x) / Math.max(0.4, d), z: (z - p.z) / Math.max(0.4, d) };
}
function cpu(w: Arena, p: Runner, i: number): Control {
  const s = w.overhaul!,
    c: Control = { x: 0, z: 0, a: false, b: false, seq: 0 };
  if (w.kind === 'mangosluggers') {
    const interval = [0.27, 0.17, 0.115][w.difficulty];
    c.a =
      Math.floor(w.time / interval) !==
      Math.floor((w.time - 1 / 60) / interval);
  } else if (w.kind === 'duos') {
    const boat = s.boats[p.team],
      partner = w.actors[p.team * 2 + (i % 2 ? 0 : 1)];
    const interval =
      [1.2, 0.92, 0.69][w.difficulty] + randomAt(w.seed, 440 + p.team) * 0.16;
    const phase = randomAt(w.seed, 480 + p.team) * 0.4;
    c.a = partner.cpu
      ? Math.floor((w.time + phase) / interval) !==
        Math.floor((w.time + phase - 1 / 60) / interval)
      : boat.strokes[1 - (i % 2)] > boat.paired &&
        w.time - boat.strokes[1 - (i % 2)] > 0.075 &&
        w.time - boat.strokes[1 - (i % 2)] < 0.24;
    const h = riverHazards.find(
      (h) => h.d > boat.distance - 2 && h.d < boat.distance + 17,
    );
    const target = h ? (h.rock ? -h.side * 2.5 : -h.side * 3) : 0;
    c.x = clamp((target - boat.offset) * 0.55 - boat.heading * 2, -1, 1);
  } else if (w.kind === 'bomb') {
    const held = s.bombs.find((b) => b.holder === i);
    const enemy = w.actors
      .filter((a) => a !== p && a.alive)
      .sort(
        (a, b) =>
          Math.hypot(p.x - a.x, p.z - a.z) - Math.hypot(p.x - b.x, p.z - b.z),
      )[0];
    if (held && enemy) {
      Object.assign(c, aim(p, enemy.x, enemy.z));
      c.a = w.time - (held.pickedAt ?? w.time) > 0.3;
    } else {
      const threat = s.bombs
        .filter(
          (b) =>
            b.fuse - w.time < 2.4 && Math.hypot(p.x - b.x, p.z - b.z) < 4.8,
        )
        .sort((a, b) => a.fuse - b.fuse)[0];
      if (threat)
        Object.assign(
          c,
          aim(
            p,
            clamp(p.x + (p.x - threat.x) * 3, -8, 8),
            clamp(p.z + (p.z - threat.z) * 3, -6, 6),
          ),
        );
      else {
        const bomb = s.bombs
          .filter((b) => b.holder < 0 && b.y < 0.7 && b.fuse - w.time > 2)
          .sort(
            (a, b) =>
              Math.hypot(a.x - p.x, a.z - p.z) -
              Math.hypot(b.x - p.x, b.z - p.z),
          )[0];
        if (bomb) {
          Object.assign(c, aim(p, bomb.x, bomb.z));
          c.a = Math.hypot(bomb.x - p.x, bomb.z - p.z) < 1.35;
        } else
          Object.assign(
            c,
            aim(
              p,
              Math.sin(w.time * 0.4 + i * 2) * 5,
              Math.cos(w.time * 0.5 + i * 2) * 4,
            ),
          );
      }
    }
    c.b = !!s.bombs.find(
      (b) => b.fuse - w.time < 1.2 && Math.hypot(b.x - p.x, b.z - p.z) < 3.6,
    );
  } else if (w.kind === 'dig' && w.time >= 5) {
    const puzzle = s.puzzles[i];
    const id =
      puzzle.held >= 0
        ? puzzle.held
        : puzzle.pieces.findIndex((piece) => !piece.locked);
    if (id < 0) return c;
    const piece = puzzle.pieces[id],
      target = puzzle.held >= 0 ? puzzleSlot(id) : piece;
    Object.assign(c, aim(puzzle.cursor, target.x, target.z));
    if (
      Math.hypot(puzzle.cursor.x - target.x, puzzle.cursor.z - target.z) <
        0.23 &&
      p.cooldown <= 0
    ) {
      if (puzzle.held >= 0 && piece.turn !== 0) c.b = true;
      else c.a = true;
    }
  }
  return c;
}
export function stepOverhaul(w: Arena) {
  if (w.done) return;
  const dt = 1 / 60,
    s = w.overhaul!;
  w.tick++;
  w.time = w.tick / 60;
  w.pulse = Math.max(0, w.pulse - dt * 2);
  const inputs = w.actors.map((p, i) => {
    p.cooldown = Math.max(0, p.cooldown - dt);
    p.stun = Math.max(0, p.stun - dt);
    p.flash = Math.max(0, p.flash - dt);
    const c = p.cpu
      ? cpu(w, p, i)
      : w.time - p.inputAt > 0.55
        ? { ...p.input, x: 0, z: 0, a: false, b: false }
        : p.input;
    const ap = c.ap !== undefined ? c.ap > p.seenAP : c.a && !p.wasA;
    const bp = c.bp !== undefined ? c.bp > p.seenBP : c.b && !p.wasB;
    // Drain queued genuine button edges one per fixed step, preserving online taps.
    if (c.ap !== undefined && ap) p.seenAP++;
    if (c.bp !== undefined && bp) p.seenBP++;
    p.wasA = c.a;
    p.wasB = c.b;
    return { c, ap, bp };
  });
  if (w.kind === 'mangosluggers') {
    w.actors.forEach((p, i) => {
      if (w.time <= 10 && inputs[i].ap) s.taps[i]++;
      p.distance = 4 + s.taps[i] * 0.38;
      p.score = Math.round(p.distance * 100);
      const jump = clamp((w.time - 10) / 2.4, 0, 1);
      p.x = (i - 1.5) * 4;
      p.z = w.time < 10 ? 9 - w.time * 0.8 : 1 - p.distance * jump;
      p.y = w.time < 10 ? 0 : Math.sin(jump * Math.PI) * 4;
      p.face = Math.PI;
    });
    if (w.time >= 13) w.done = true;
  } else if (w.kind === 'dig') {
    s.puzzles.forEach((puzzle, i) => {
      const p = w.actors[i],
        { c, ap, bp } = inputs[i];
      if (w.time < 5 || p.finish) return;
      const length = Math.max(1, Math.hypot(c.x, c.z));
      const pace = p.cpu
        ? [0.3, 0.43, 0.64][w.difficulty] *
          (0.92 + randomAt(w.seed, 350 + i) * 0.16)
        : 1;
      puzzle.cursor.x = clamp(
        puzzle.cursor.x + (c.x / length) * 5 * dt * pace,
        -4.4,
        4.4,
      );
      puzzle.cursor.z = clamp(
        puzzle.cursor.z + (c.z / length) * 5 * dt * pace,
        -3.5,
        5.1,
      );
      p.x = puzzle.cursor.x;
      p.z = puzzle.cursor.z;
      if (puzzle.held >= 0) {
        const piece = puzzle.pieces[puzzle.held];
        piece.x = puzzle.cursor.x;
        piece.z = puzzle.cursor.z;
        if (bp && p.cooldown <= 0) {
          piece.turn = (piece.turn + 1) % 4;
          p.cooldown = p.cpu ? [0.3, 0.22, 0.14][w.difficulty] : 0.1;
        }
        if (ap && p.cooldown <= 0) {
          const slot = puzzleSlot(puzzle.held);
          if (
            piece.turn === 0 &&
            Math.hypot(piece.x - slot.x, piece.z - slot.z) < 0.48
          ) {
            Object.assign(piece, slot);
            piece.locked = true;
            puzzle.feedback = w.time;
          }
          puzzle.held = -1;
          p.cooldown = 0.16;
        }
      } else if (ap && p.cooldown <= 0) {
        const id = puzzle.pieces
          .map((piece, id) => ({ piece, id }))
          .filter(
            ({ piece }) =>
              !piece.locked &&
              Math.hypot(piece.x - puzzle.cursor.x, piece.z - puzzle.cursor.z) <
                1.0,
          )
          .sort(
            (a, b) =>
              Math.hypot(
                a.piece.x - puzzle.cursor.x,
                a.piece.z - puzzle.cursor.z,
              ) -
              Math.hypot(
                b.piece.x - puzzle.cursor.x,
                b.piece.z - puzzle.cursor.z,
              ),
          )[0]?.id;
        if (id !== undefined) {
          puzzle.held = id;
          p.cooldown = 0.16;
        }
      }
      const count = puzzle.pieces.filter((piece) => piece.locked).length;
      p.score = count * 1000;
      if (count === 8) {
        p.finish = w.time;
        p.score = 100000 - Math.round(w.time * 100);
      }
    });
    // All actions in the finishing tick count, so simultaneous solves share the win.
    if (w.actors.some((p) => p.finish > 0)) w.done = true;
  } else if (w.kind === 'duos') {
    s.boats.forEach((boat, team) => {
      if (boat.finish) return;
      boat.stun = Math.max(0, boat.stun - dt);
      for (let side = 0; side < 2; side++)
        if (inputs[team * 2 + side].ap && w.time - boat.strokes[side] > 0.25) {
          boat.strokes[side] = w.time;
          boat.speed = Math.min(12, boat.speed + 0.65);
          boat.heading += (side === 0 ? 1 : -1) * 0.09;
        }
      const [left, right] = boat.strokes;
      if (
        left > boat.paired &&
        right > boat.paired &&
        Math.abs(left - right) <= 0.24
      ) {
        boat.paired = Math.max(left, right);
        boat.speed = Math.min(12, boat.speed + 1.6);
        boat.heading *= 0.42;
      }
      const steer = (inputs[team * 2].c.x + inputs[team * 2 + 1].c.x) / 2;
      const brace = inputs[team * 2].c.b || inputs[team * 2 + 1].c.b;
      boat.heading = clamp(boat.heading + steer * dt * 0.8, -0.85, 0.85);
      boat.heading *= Math.exp(-dt * 0.3);
      boat.speed = Math.max(
        brace ? 0.8 : 1.8,
        boat.speed - (brace ? 5 : 0.85) * dt,
      );
      boat.offset += Math.sin(boat.heading) * boat.speed * dt;
      boat.distance +=
        Math.max(0.4, boat.speed * Math.cos(boat.heading)) *
        (boat.stun > 0 ? 0.25 : 1) *
        dt;
      if (Math.abs(boat.offset) > 4.2) {
        boat.offset = clamp(boat.offset, -4.2, 4.2);
        boat.heading *= -0.5;
        boat.speed *= 0.72;
      }
      riverHazards.forEach((h, j) => {
        const hit = h.rock
          ? Math.abs(boat.offset - h.side * 1.5) < 1.55
          : dragonPhase(w.time, j) > 1 &&
            dragonPhase(w.time, j) < 2.35 &&
            (h.side < 0 ? boat.offset < 1.2 : boat.offset > -1.2);
        if (boat.stun <= 0 && Math.abs(boat.distance - h.d) < 1.8 && hit) {
          boat.stun = 1.4;
          boat.speed *= 0.35;
          boat.distance = Math.max(0, boat.distance - 2.5);
        }
      });
      if (boat.distance >= RIVER_LENGTH) boat.finish = w.time;
      w.actors
        .filter((p) => p.team === team)
        .forEach((p, j) => {
          p.distance = boat.distance;
          p.x =
            (team ? 11 : -11) +
            riverCenter(boat.distance) +
            boat.offset +
            (j ? 0.5 : -0.5);
          p.z = -boat.distance;
          p.y = 0.3;
          p.face = Math.PI - boat.heading;
          p.finish = boat.finish;
          p.score = boat.finish
            ? 100000 - Math.round(boat.finish * 100)
            : Math.floor((boat.distance / RIVER_LENGTH) * 89999);
        });
    });
    if (s.boats.some((boat) => boat.finish > 0)) w.done = true;
  } else if (w.kind === 'bomb') {
    if (w.time >= s.spawnAt) {
      const id = ++s.serial,
        living = w.actors.filter((p) => p.alive);
      const target = living[id % living.length] ?? w.actors[0];
      s.bombs.push({
        id,
        x: clamp(target.x + (randomAt(w.seed, id * 7) - 0.5) * 7, -8, 8),
        z: clamp(target.z + (randomAt(w.seed, id * 7 + 1) - 0.5) * 6, -6, 6),
        y: 8,
        vx: 0,
        vz: 0,
        vy: 0,
        fuse: w.time + 5.2,
        holder: -1,
        born: w.time,
      });
      s.spawnAt = w.time + Math.max(0.65, 2.3 - w.time * 0.028);
    }
    const bounds = bombBounds(w.time);
    w.actors.forEach((p, i) => {
      if (!p.alive) return;
      const { c, ap, bp } = inputs[i],
        len = Math.max(1, Math.hypot(c.x, c.z));
      if (Math.hypot(c.x, c.z) > 0.1) p.face = Math.atan2(c.x, c.z);
      if (bp && p.cooldown <= 0) {
        p.stun = 0.22;
        p.cooldown = 1.7;
      }
      const speed = p.stun > 0 ? 10 : 5.7;
      p.vx = (c.x / len) * speed;
      p.vz = (c.z / len) * speed;
      p.x = clamp(p.x + p.vx * dt, -bounds.x, bounds.x);
      p.z = clamp(p.z + p.vz * dt, -bounds.z, bounds.z);
      if (ap) {
        const held = s.bombs.find((b) => b.holder === i);
        if (held) {
          held.holder = -1;
          held.y = 1.3;
          held.vx = Math.sin(p.face) * 10;
          held.vz = Math.cos(p.face) * 10;
          held.vy = 4.5;
          held.x = p.x + Math.sin(p.face) * 0.7;
          held.z = p.z + Math.cos(p.face) * 0.7;
        } else {
          const nearest = s.bombs
            .filter(
              (b) =>
                b.holder < 0 &&
                b.y < 0.7 &&
                Math.hypot(b.x - p.x, b.z - p.z) < 1.5,
            )
            .sort(
              (a, b) =>
                Math.hypot(a.x - p.x, a.z - p.z) -
                Math.hypot(b.x - p.x, b.z - p.z),
            )[0];
          if (nearest) {
            nearest.holder = i;
            nearest.pickedAt = w.time;
            nearest.vx = nearest.vz = nearest.vy = 0;
          }
        }
      }
      p.score = Math.round(w.time * 100);
    });
    const exploding = s.bombs.filter((b) => b.fuse <= w.time);
    s.bombs.forEach((b) => {
      if (b.holder >= 0) {
        const p = w.actors[b.holder];
        b.x = p.x;
        b.z = p.z;
        b.y = 1.4;
        if (!p.alive) b.holder = -1;
      } else {
        b.vy -= 12 * dt;
        b.y += b.vy * dt;
        b.x = clamp(b.x + b.vx * dt, -bounds.x, bounds.x);
        b.z = clamp(b.z + b.vz * dt, -bounds.z, bounds.z);
        if (b.y < 0.3) {
          b.y = 0.3;
          b.vy = Math.abs(b.vy) > 1 ? -b.vy * 0.3 : 0;
          b.vx *= 0.93;
          b.vz *= 0.93;
        }
      }
    });
    exploding.forEach((b) => {
      const radius = 2.7;
      s.explosions.push({ x: b.x, z: b.z, at: w.time, radius });
      w.pulse = 1;
      w.actors.forEach((p) => {
        if (p.alive && Math.hypot(p.x - b.x, p.z - b.z) <= radius) {
          p.alive = false;
          p.outAt = w.time;
          p.score = Math.round(w.time * 100);
        }
      });
    });
    s.bombs = s.bombs.filter((b) => b.fuse > w.time);
    s.explosions = s.explosions.filter((e) => w.time - e.at < 0.7);
    if (w.actors.filter((p) => p.alive).length <= 1) w.done = true;
  }
  if (w.time >= w.duration) w.done = true;
  if (w.done && w.kind === 'bomb')
    w.actors
      .filter((p) => p.alive)
      .forEach((p) => (p.score = 100000 + Math.round(w.time * 100)));
}
export function overhaulReadout(w: Arena, id: string) {
  const i = Math.max(
      0,
      w.actors.findIndex((p) => p.id === id),
    ),
    s = w.overhaul!;
  if (w.kind === 'dig') {
    const puzzle = s.puzzles[i];
    return {
      title:
        w.time < 4
          ? `Remember the picture · ${Math.ceil(4 - w.time)}`
          : w.time < 5
            ? 'Pieces scattering…'
            : `${puzzle.pieces.filter((p) => p.locked).length} / 8 pieces locked`,
      detail:
        w.time < 5
          ? 'The picture will break into eight pieces.'
          : puzzle.held < 0
            ? 'Move the cursor · A / Space picks up a piece'
            : 'Move · B / E rotates · A / Space places; correct pieces lock',
    };
  }
  if (w.kind === 'mangosluggers')
    return {
      title:
        w.time < 10
          ? `${(10 - w.time).toFixed(1)} seconds · ${s.taps[i]} taps`
          : `${w.actors[i].distance.toFixed(2)} m jump`,
      detail:
        w.time < 10
          ? 'Tap A / Space as fast as you can! Holding does not count.'
          : 'Watch the long jump · more taps means more distance',
    };
  if (w.kind === 'duos') {
    const b = s.boats[w.actors[i].team];
    return {
      title: `${Math.floor(b.distance)} / ${RIVER_LENGTH} m · ${w.time - b.paired < 0.4 ? 'IN SYNC!' : 'Match your partner’s stroke'}`,
      detail: `${i % 2 ? 'Right' : 'Left'} paddle · A / Space row · stick lean · B / E brace`,
    };
  }
  const held = s.bombs.find((b) => b.holder === i);
  return {
    title: held
      ? `BOMB IN HAND · ${(held.fuse - w.time).toFixed(1)}s`
      : `${w.actors.filter((p) => p.alive).length} left · dodge the blasts`,
    detail: held
      ? 'Aim with the stick / arrows · A / Space throws'
      : 'A / Space picks up · B / E dashes · blinking speeds up before the blast',
  };
}
