import { startGrand, stepGrand, GrandState } from './grand';
import { GRAND_IDS } from './grand-catalog';
import {
  EXPANDED,
  startExpansion,
  stepExpansion,
  ExtraState,
} from './expansion';
import { ArenaKind, arcadeInfo } from './catalog';
import { startRemix, stepRemix, type RemixState } from './remix';
import { remixInfo } from './remix-catalog';
import {
  OVERHAUL,
  startOverhaul,
  stepOverhaul,
  type OverhaulState,
} from './overhaul';
export type Control = {
  x: number;
  z: number;
  a: boolean;
  b: boolean;
  seq: number;
  ap?: number;
  bp?: number;
  ar?: number;
};
export const NEUTRAL: Control = { x: 0, z: 0, a: false, b: false, seq: 0 };
export type Runner = {
  id: string;
  cpu: boolean;
  team: number;
  x: number;
  z: number;
  y: number;
  vx: number;
  vz: number;
  vy: number;
  face: number;
  alive: boolean;
  outAt: number;
  lives: number;
  score: number;
  charge: number;
  cooldown: number;
  flash: number;
  jumps: number;
  gear: number;
  rpm: number;
  distance: number;
  finish: number;
  checkpoint: number;
  stun: number;
  input: Control;
  inputAt: number;
  edgeBudget?: { at: number; ap: number; bp: number; ar: number };
  wasA: boolean;
  wasB: boolean;
  seenAP: number;
  seenBP: number;
  seenAR: number;
  brainAt: number;
  tx: number;
  tz: number;
};
export type Shot = {
  id: number;
  owner: string;
  x: number;
  z: number;
  vx: number;
  vz: number;
  size: number;
  life: number;
};
export type Arena = {
  overhaul?: OverhaulState;
  remix?: RemixState;
  version: 2;
  extra?: ExtraState;
  grand?: GrandState;
  kind: ArenaKind;
  seed: number;
  time: number;
  tick: number;
  duration: number;
  done: boolean;
  endAt: number;
  actors: Runner[];
  shots: Shot[];
  shotId: number;
  holes: { x: number; z: number; r: number }[];
  dropAt: number;
  dropIndex: number;
  dropPeriod: number;
  angle: number;
  angularSpeed: number;
  radius: number;
  pulse: number;
  teams: {
    stage: number;
    work: number;
    turn: number;
    finish: number;
    lastStroke: number;
  }[];
  difficulty: number;
};
export function randomAt(seed: number, n: number) {
  let v = (seed + Math.imul(n + 1, 0x45d9f3b)) | 0;
  v = Math.imul(v ^ (v >>> 16), 0x45d9f3b);
  v = Math.imul(v ^ (v >>> 16), 0x45d9f3b);
  return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
}
const clamp = (n: number, l: number, h: number) => Math.max(l, Math.min(h, n));
function holesFor(w: Arena) {
  const points = [
    [-4, -3],
    [0, -3],
    [4, -3],
    [-4, 0],
    [0, 0],
    [4, 0],
    [-4, 3],
    [0, 3],
    [4, 3],
  ];
  const count = w.dropIndex < 4 ? 3 : w.dropIndex < 8 ? 2 : 1;
  // Readable patterns rotate between rows, corners and a central refuge.
  const patterns = [
    [0, 2, 7, 4],
    [6, 8, 1, 4],
    [3, 4, 5, 1],
    [1, 4, 7, 3],
    [0, 4, 8, 2],
    [2, 4, 6, 0],
  ];
  const pattern =
    patterns[Math.floor(randomAt(w.seed, w.dropIndex * 31) * patterns.length)];
  const pool =
    count === 1
      ? [
          points[
            Math.floor(randomAt(w.seed, w.dropIndex * 31 + 11) * points.length)
          ],
        ]
      : pattern.map((i) => points[i]);
  return pool
    .slice(0, count)
    .map((p) => ({ x: p[0], z: p[1], r: w.dropIndex > 7 ? 1.2 : 1.6 }));
}
// Paper descends throughout the cycle; collision and rendering share this height.
export function canopyHeight(w: Arena) {
  return Math.max(0, (w.dropAt - w.time) / w.dropPeriod) * 7;
}
export function createArena(
  index: number,
  players: { id: string; cpu: boolean }[],
  difficulty = 1,
  seed = 123,
): Arena {
  const kind = arcadeInfo(index).id;
  const actors = players.map((p, i): Runner => {
    const a = ((i + 0.5) * Math.PI) / 2;
    return {
      id: p.id,
      cpu: p.cpu,
      team: Math.floor(i / 2),
      x:
        kind === 'race'
          ? (i - 1.5) * 3
          : kind === 'duos'
            ? (i < 2 ? -4 : 4) + (i % 2 ? 1.2 : -1.2)
            : Math.cos(a) * 4.4,
      z: kind === 'race' ? 0 : kind === 'duos' ? 6 : Math.sin(a) * 4.4,
      y: 0,
      vx: 0,
      vz: 0,
      vy: 0,
      face: Math.atan2(-Math.cos(a), -Math.sin(a)),
      alive: true,
      outAt: 0,
      lives: 3,
      score: 0,
      charge: 0,
      cooldown: 0,
      flash: 0,
      jumps: 0,
      gear: 1,
      rpm: 0,
      distance: 0,
      finish: 0,
      checkpoint: 0,
      stun: 0,
      input: { ...NEUTRAL },
      inputAt: 0,
      wasA: false,
      wasB: false,
      seenAP: 0,
      seenBP: 0,
      seenAR: 0,
      brainAt: 0,
      tx: 0,
      tz: 0,
    };
  });
  const w: Arena = {
    version: 2,
    kind,
    seed,
    time: 0,
    tick: 0,
    duration: arcadeInfo(index).duration,
    done: false,
    endAt: 0,
    actors,
    shots: [],
    shotId: 0,
    holes: [],
    dropAt: 3.25,
    dropIndex: 0,
    dropPeriod: 3.25,
    angle: -Math.PI / 2,
    angularSpeed: 1.05,
    radius: 8,
    pulse: 0,
    teams: [0, 1].map(() => ({
      stage: 0,
      work: 0,
      turn: 0,
      finish: 0,
      lastStroke: -1,
    })),
    difficulty,
  };
  w.holes = holesFor(w);
  if (OVERHAUL.includes(kind)) startOverhaul(w);
  else if (remixInfo(kind)) startRemix(w);
  else if (GRAND_IDS.includes(kind)) startGrand(w);
  else if (EXPANDED.includes(kind)) startExpansion(w);
  return w;
}
export function setControl(w: Arena, id: string, c: Control) {
  const p = w.actors.find((p) => p.id === id);
  if (!p || p.cpu || c.seq <= p.input.seq) return false;
  if (
    !Number.isFinite(c.x) ||
    !Number.isFinite(c.z) ||
    Math.abs(c.x) > 1.01 ||
    Math.abs(c.z) > 1.01 ||
    typeof c.a !== 'boolean' ||
    typeof c.b !== 'boolean' ||
    !Number.isSafeInteger(c.seq) ||
    c.seq < 0
  )
    throw Error('Invalid controls.');
  const previousBudget = p.edgeBudget ?? { at: w.time, ap: 4, bp: 4, ar: 4 };
  const refill = Math.max(0, w.time - previousBudget.at) * 25;
  const budget = { ...previousBudget, at: w.time };
  for (const key of ['ap', 'bp', 'ar'] as const) {
    if (
      c[key] !== undefined &&
      (!Number.isSafeInteger(c[key]) || c[key]! < 0 || c[key]! > 1e9)
    )
      throw Error('Invalid button sequence.');
    const delta = c[key] === undefined ? 0 : c[key]! - (p.input[key] ?? 0);
    budget[key] = Math.min(14, previousBudget[key] + refill);
    if (w.overhaul && (delta < 0 || delta > budget[key] + 1e-9))
      throw Error('Too many button presses. Try releasing the button.');
    budget[key] -= Math.max(0, delta);
  }
  p.edgeBudget = budget;
  p.input = {
    x: clamp(c.x, -1, 1),
    z: clamp(c.z, -1, 1),
    a: c.a,
    b: c.b,
    seq: c.seq,
    ap: c.ap,
    bp: c.bp,
    ar: c.ar,
  };
  p.inputAt = w.time;
  return true;
}
function steer(p: Runner, x: number, z: number): Control {
  const d = Math.hypot(x - p.x, z - p.z);
  return {
    x: d > 0.15 ? (x - p.x) / Math.max(0.7, d) : 0,
    z: d > 0.15 ? (z - p.z) / Math.max(0.7, d) : 0,
    a: false,
    b: false,
    seq: 0,
  };
}
function cpuInput(w: Arena, p: Runner, i: number): Control {
  const skill = w.difficulty,
    reaction = 0.29 - skill * 0.065 + randomAt(w.seed, i * 37) * 0.05;
  if (w.time < p.brainAt) return p.input;
  p.brainAt = w.time + reaction;
  let c = { ...NEUTRAL };
  if (w.kind === 'canopy') {
    const target = [...w.holes].sort((a, b) => {
      const crowd = (h: typeof a) =>
        w.actors.filter(
          (o) => o !== p && o.alive && Math.hypot(o.x - h.x, o.z - h.z) < h.r,
        ).length;
      return (
        Math.hypot(p.x - a.x, p.z - a.z) +
        crowd(a) * 0.6 -
        Math.hypot(p.x - b.x, p.z - b.z) -
        crowd(b) * 0.6
      );
    })[0];
    if (p.checkpoint !== w.dropIndex) {
      p.checkpoint = w.dropIndex;
      p.cooldown = 0.3 + (2 - skill) * 0.1;
    }
    const error = (1 - skill * 0.3) * 0.35;
    c = steer(
      p,
      target.x + Math.sin(i * 3 + w.dropIndex) * error,
      target.z + Math.cos(i * 3) * error,
    );
    if (w.dropAt - w.time > 2.7 - reaction || p.cooldown > 0)
      c = { ...NEUTRAL };
  } else if (w.kind === 'bumper' || w.kind === 'coconut') {
    const enemy = w.actors
      .filter((o) => o !== p && o.alive)
      .sort(
        (a, b) =>
          Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z),
      )[0];
    if (!enemy) return c;
    const d = Math.hypot(enemy.x - p.x, enemy.z - p.z),
      edge = Math.hypot(p.x + p.vx * 0.32, p.z + p.vz * 0.32);
    if (edge > w.radius - 1.8) {
      c = steer(p, 0, 0);
      c.a = false;
    } else if (w.kind === 'bumper') {
      c = steer(p, enemy.x + enemy.vx * 0.15, enemy.z + enemy.vz * 0.15);
      c.a =
        d < 3.8 &&
        d > 1.4 &&
        p.cooldown <= 0 &&
        randomAt(w.seed, w.tick + i) > 0.25;
    } else {
      const aim = Math.atan2(enemy.x - p.x, enemy.z - p.z);
      p.face = aim;
      if (d > 5.8) c = steer(p, enemy.x, enemy.z);
      else if (d < 2.5) c = steer(p, -enemy.x * 0.3, -enemy.z * 0.3);
      else c = { ...NEUTRAL };
      c.a = p.charge < 0.85 + skill * 0.25 + randomAt(w.seed, i * 7) * 0.25;
      const shot = w.shots.find(
        (s) => s.owner !== p.id && Math.hypot(s.x - p.x, s.z - p.z) < 3,
      );
      if (shot) {
        c.x = shot.vz > 0 ? -1 : 1;
        c.z = shot.vx > 0 ? 1 : -1;
      }
    }
  } else if (w.kind === 'rope') {
    const theta = Math.atan2(p.z, p.x);
    let ahead = (theta - w.angle) % Math.PI;
    if (ahead < 0) ahead += Math.PI;
    const pass = Math.floor((w.angle - theta) / Math.PI) + 1;
    const late =
      w.time > 8 && randomAt(w.seed, pass * 19 + i * 137) < 0.25 - skill * 0.09;
    const lead = late
      ? 0.1
      : 0.38 + reaction * 0.6 + randomAt(w.seed, w.tick + i) * 0.05;
    c.a = p.y < 0.05 && ahead / w.angularSpeed < lead;
  } else if (w.kind === 'race') {
    c.a = true;
    c.b =
      p.rpm > 0.81 + (0.11 - skill * 0.035) + randomAt(w.seed, i * 13) * 0.035;
  } else if (w.kind === 'duos') {
    const team = w.teams[p.team],
      center = p.team === 0 ? -4 : 4,
      slot = i % 2 ? 1 : -1;
    if (team.stage === 0) {
      c = steer(p, center + slot * 1.2, 3.5);
      c.b = Math.hypot(p.x - center - slot * 1.2, p.z - 3.5) < 0.75;
    } else if (team.stage === 1) {
      const platform = center + Math.sin(w.time * 1.15) * 1.8;
      if (p.checkpoint >= 1) {
        c = steer(p, center + slot * 1.2, -15);
        c.a = p.y <= 0.01 && p.z > -10.5;
      } else if (p.z > -2.0) c = steer(p, center, -2.5);
      else {
        c = steer(p, platform, -7);
        c.a = p.y <= 0.01 && p.z > -4.2 && Math.abs(p.x - platform) < 1.7;
      }
    } else if (team.stage === 2) {
      c = steer(p, center + slot * 1.2, -15);
      c.b =
        Math.hypot(p.x - center - slot * 1.2, p.z + 15) < 1 &&
        team.turn === i % 2 &&
        w.time - team.lastStroke > 1.3 - skill * 0.3;
    }
  }
  return c;
}
function eliminate(w: Arena, p: Runner) {
  if (!p.alive) return;
  p.alive = false;
  p.outAt = w.time;
  p.score = Math.round(w.time * 100);
  p.vy = -1;
  w.pulse = 1;
}
function collide(w: Arena, r: number, power: number) {
  for (let i = 0; i < w.actors.length; i++)
    for (let j = i + 1; j < w.actors.length; j++) {
      const a = w.actors[i],
        b = w.actors[j];
      if (!a.alive || !b.alive || Math.abs(a.y - b.y) > 0.9) continue;
      const dx = b.x - a.x,
        dz = b.z - a.z,
        d = Math.hypot(dx, dz);
      if (d < r * 2) {
        const nx = d > 0.001 ? dx / d : 1,
          nz = d > 0.001 ? dz / d : 0,
          over = r * 2 - d;
        a.x -= nx * over * 0.5;
        a.z -= nz * over * 0.5;
        b.x += nx * over * 0.5;
        b.z += nz * over * 0.5;
        const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
        if (rel < 0) {
          const impulse = -rel * power;
          a.vx -= nx * impulse;
          a.vz -= nz * impulse;
          b.vx += nx * impulse;
          b.vz += nz * impulse;
          if (impulse > 2) {
            a.flash = 0.15;
            b.flash = 0.15;
            w.pulse = 0.25;
            if (w.kind === 'bumper') {
              a.stun = 0.3;
              b.stun = 0.3;
            }
          }
        }
      }
    }
}
export function stepArena(w: Arena, dt = 1 / 60) {
  if (OVERHAUL.includes(w.kind)) {
    stepOverhaul(w);
    return;
  }
  if (w.done) return;
  if (w.remix) {
    stepRemix(w);
    return;
  }
  if (GRAND_IDS.includes(w.kind)) {
    stepGrand(w);
    return;
  }
  if (EXPANDED.includes(w.kind)) {
    stepExpansion(w);
    return;
  }
  dt = 1 / 60;
  w.tick++;
  w.time = w.tick / 60;
  w.pulse = Math.max(0, w.pulse - dt * 2);
  if (w.kind === 'bumper') w.radius = 8 - Math.max(0, w.time - 18) * 0.15;
  if (w.kind === 'coconut') w.radius = 8 - Math.max(0, w.time - 22) * 0.12;
  if (w.kind === 'rope') {
    w.angularSpeed = 1.05 + w.time * 0.041 + Math.sin(w.time * 0.48) * 0.2;
    w.angle += w.angularSpeed * dt;
  }
  for (let i = 0; i < w.actors.length; i++) {
    const p = w.actors[i];
    p.flash = Math.max(0, p.flash - dt);
    p.cooldown = Math.max(0, p.cooldown - dt);
    p.stun = Math.max(0, p.stun - dt);
    if (!p.alive) {
      p.y -= dt * 4;
      continue;
    }
    if (p.cpu) {
      p.input = cpuInput(w, p, i);
      p.inputAt = w.time;
    } else if (w.time - p.inputAt > 0.55)
      p.input = { ...p.input, x: 0, z: 0, a: false, b: false };
    const c = p.input,
      press = c.ap !== undefined ? c.ap > p.seenAP : c.a && !p.wasA,
      pressB = c.bp !== undefined ? c.bp > p.seenBP : c.b && !p.wasB,
      released = c.ar !== undefined ? c.ar > p.seenAR : !c.a && p.wasA;
    if (c.ap !== undefined && c.ap > p.seenAP) p.seenAP++;
    if (c.bp !== undefined && c.bp > p.seenBP) p.seenBP++;
    if (c.ar !== undefined && c.ar > p.seenAR) p.seenAR++;
    let x = c.x,
      z = c.z;
    const len = Math.hypot(x, z);
    if (len > 1) {
      x /= len;
      z /= len;
    }
    if (w.kind === 'race') {
      if (!p.finish) {
        const limit = [0, 12, 23, 36, 50, 68][p.gear];
        if (pressB && p.gear < 5) {
          const perfect = p.rpm >= 0.74 && p.rpm <= 1;
          const loss = perfect ? 0.2 : p.rpm < 0.74 ? 3.8 : 2.2;
          p.vz = Math.max(0, p.vz - loss);
          p.gear++;
          p.rpm *= 0.56;
          p.flash = perfect ? 0.35 : 0;
          p.stun = perfect ? 0 : 0.3;
        }
        const accel =
          c.a && p.stun <= 0
            ? (17 - p.gear * 1.5) *
              Math.max(0.06, 1 - (p.vz / (limit * 1.15)) ** 3)
            : -7;
        p.vz = clamp(p.vz + accel * dt, 0, 76);
        p.rpm +=
          (clamp(p.vz / limit + (c.a ? 0.17 : 0), 0, 1.2) - p.rpm) *
          Math.min(1, dt * 9);
        p.distance += p.vz * dt;
        p.z = -p.distance * 0.18;
        p.score = Math.floor(p.distance * 10);
        if (p.distance >= 620) {
          p.finish = w.time;
          p.score = 100000 - Math.round(w.time * 100);
          p.flash = 1;
          if (!w.endAt) w.endAt = w.time + 6;
        }
      }
    } else {
      const isRound = w.kind === 'bumper' || w.kind === 'coconut';
      const inertia = w.kind === 'bumper';
      const speed = w.kind === 'duos' ? 5.5 : 6.2;
      if (w.kind !== 'rope') {
        if (inertia) {
          p.vx += (p.stun > 0 ? 0 : x) * 13 * dt;
          p.vz += (p.stun > 0 ? 0 : z) * 13 * dt;
          p.vx *= Math.exp(-1.8 * dt);
          p.vz *= Math.exp(-1.8 * dt);
        } else {
          const slow = w.kind === 'coconut' && c.a ? 0.48 : 1;
          const factor = p.flash > 0.25 && w.kind === 'coconut' ? 2.4 : 12;
          p.vx += (x * speed * slow - p.vx) * Math.min(1, dt * factor);
          p.vz += (z * speed * slow - p.vz) * Math.min(1, dt * factor);
        }
        if (len > 0.13 && !(p.cpu && w.kind === 'coconut'))
          p.face = Math.atan2(x, z);
        if (inertia && press && p.cooldown <= 0) {
          p.vx += Math.sin(p.face) * 13;
          p.vz += Math.cos(p.face) * 13;
          p.cooldown = 2.6;
          p.flash = 0.2;
        }
        if (p.stun <= 0 || isRound) {
          p.x += p.vx * dt;
          p.z += p.vz * dt;
        }
      }
      if (w.kind === 'rope' || w.kind === 'duos') {
        if (press && p.y <= 0.01 && p.stun <= 0) {
          p.vy = 6.6;
          p.jumps++;
        }
        p.vy -= dt * (c.a && p.vy > 0 ? 12 : 23);
        p.y += p.vy * dt;
        if (p.y < 0) {
          p.y = 0;
          p.vy = 0;
        }
      }
      if (w.kind === 'bumper' || w.kind === 'coconut') {
        const obstacles =
          w.kind === 'bumper'
            ? [[0, 0, 1.2]]
            : [
                [2.7, -2.2, 0.85],
                [-2.7, 2.2, 0.85],
              ];
        for (const [ox, oz, r] of obstacles) {
          const dx = p.x - ox,
            dz = p.z - oz,
            d = Math.hypot(dx, dz),
            rr = r + (w.kind === 'bumper' ? 0.8 : 0.46);
          if (d < rr) {
            const nx = dx / (d || 1),
              nz = dz / (d || 1);
            p.x = ox + nx * rr;
            p.z = oz + nz * rr;
            const v = p.vx * nx + p.vz * nz;
            if (v < 0) {
              p.vx -= nx * v * 1.7;
              p.vz -= nz * v * 1.7;
            }
          }
        }
      }
      if (w.kind === 'canopy') {
        p.x = clamp(p.x, -7.4, 7.4);
        p.z = clamp(p.z, -5.4, 5.4);
      }
      if (w.kind === 'rope') {
        const dist =
          Math.abs(Math.sin(Math.atan2(p.z, p.x) - w.angle)) *
          Math.hypot(p.x, p.z);
        if (dist < 0.31 && p.y < 0.58 && p.flash <= 0) {
          p.lives--;
          p.flash = 1.1;
          w.pulse = 0.5;
          if (p.lives <= 0) eliminate(w, p);
        }
      }
      if (w.kind === 'coconut') {
        if (c.a) p.charge = Math.min(1.8, p.charge + dt * 0.9);
        if (released && p.charge > 0.12) {
          const size = 0.25 + p.charge * 0.35;
          w.shots.push({
            id: ++w.shotId,
            owner: p.id,
            x: p.x + Math.sin(p.face) * (size + 0.72),
            z: p.z + Math.cos(p.face) * (size + 0.72),
            vx: Math.sin(p.face) * (12 - p.charge * 2),
            vz: Math.cos(p.face) * (12 - p.charge * 2),
            size,
            life: 3,
          });
          p.charge = 0;
        }
      }
      if (
        isRound &&
        (w.kind === 'coconut'
          ? Math.max(Math.abs(p.x), Math.abs(p.z))
          : Math.hypot(p.x, p.z)) >
          w.radius + 0.05
      )
        eliminate(w, p);
      if (w.kind === 'duos') {
        const team = w.teams[p.team],
          center = p.team === 0 ? -4 : 4;
        p.x = clamp(p.x, center - 3, center + 3);
        p.z = clamp(p.z, -17, 7);
        if (team.stage === 0) p.z = Math.max(2, p.z);
        const onMoving =
          Math.abs(p.x - (center + Math.sin(w.time * 1.15) * 1.8)) < 1.45 &&
          Math.abs(p.z + 7) < 1.4;
        if (p.z < -3.6 && p.z > -10.4 && p.y < 0.04 && !onMoving) {
          p.x = center;
          p.z = -2.25;
          p.y = 0;
          p.vy = 0;
          p.stun = 0.7;
          p.flash = 0.7;
          p.checkpoint = 0;
        }
        if (onMoving && p.y < 0.04) p.checkpoint = 1;
        if (p.z < -12) p.checkpoint = 2;
        if (
          team.stage === 2 &&
          pressB &&
          team.turn === i % 2 &&
          w.time - team.lastStroke > 0.24 &&
          Math.hypot(p.x - center - (i % 2 ? 1.2 : -1.2), p.z + 15) < 1.15
        ) {
          team.work++;
          team.turn = 1 - team.turn;
          team.lastStroke = w.time;
          p.flash = 0.25;
        }
      }
      if (p.alive) p.score = Math.round(w.time * 100);
    }
    p.wasA = c.a;
    p.wasB = c.b;
  }
  if (w.kind === 'canopy' || w.kind === 'bumper' || w.kind === 'coconut')
    collide(
      w,
      w.kind === 'bumper' ? 0.8 : 0.46,
      w.kind === 'bumper' ? 0.94 : 0.55,
    );
  if (w.kind === 'canopy' && canopyHeight(w) <= 1.9) {
    for (const p of w.actors)
      if (
        p.alive &&
        !w.holes.some((h) => Math.hypot(p.x - h.x, p.z - h.z) < h.r - 0.34)
      )
        eliminate(w, p);
  }
  if (w.kind === 'canopy' && w.time >= w.dropAt) {
    w.pulse = 1;
    w.dropIndex++;
    w.holes = holesFor(w);
    const travel = Math.max(
      0,
      ...w.actors
        .filter((p) => p.alive)
        .map(
          (p) =>
            Math.min(...w.holes.map((h) => Math.hypot(p.x - h.x, p.z - h.z))) /
            6.2,
        ),
    );
    w.dropPeriod = Math.max(
      1.6,
      3.25 - w.dropIndex * 0.34,
      (travel + 0.55) / (1 - 1.9 / 7),
    );
    w.dropAt += w.dropPeriod;
  }
  if (w.kind === 'coconut') {
    for (const s of w.shots) {
      s.x += s.vx * dt;
      s.z += s.vz * dt;
      s.life -= dt;
      if (
        [
          [2.7, -2.2],
          [-2.7, 2.2],
        ].some(([x, z]) => Math.hypot(s.x - x, s.z - z) < s.size + 0.85)
      )
        s.life = 0;
      for (const p of w.actors) {
        if (!p.alive || p.id === s.owner || s.life <= 0 || p.flash > 0.25)
          continue;
        if (Math.hypot(p.x - s.x, p.z - s.z) < s.size + 0.47) {
          const n = Math.hypot(s.vx, s.vz),
            power = 7 + s.size * 14;
          p.vx = (s.vx / n) * power;
          p.vz = (s.vz / n) * power;
          p.x += (s.vx / n) * 0.15;
          p.z += (s.vz / n) * 0.15;
          p.flash = 0.75;
          s.life = 0;
          w.pulse = 0.5;
        }
      }
    }
    for (let i = 0; i < w.shots.length; i++)
      for (let j = i + 1; j < w.shots.length; j++) {
        const a = w.shots[i],
          b = w.shots[j];
        if (
          a.owner !== b.owner &&
          Math.hypot(a.x - b.x, a.z - b.z) < a.size + b.size
        ) {
          a.life = 0;
          b.life = 0;
        }
      }
    w.shots = w.shots.filter((s) => s.life > 0 && Math.hypot(s.x, s.z) < 13);
  }
  if (w.kind === 'duos')
    for (let i = 0; i < 2; i++) {
      const t = w.teams[i],
        pair = w.actors.filter((p) => p.team === i),
        center = i === 0 ? -4 : 4;
      if (t.stage === 0) {
        const both = pair.every(
          (p, j) =>
            p.input.b &&
            Math.hypot(p.x - center - (j ? 1.2 : -1.2), p.z - 3.5) < 0.95,
        );
        t.work = both ? t.work + dt : Math.max(0, t.work - dt * 0.5);
        if (t.work >= 1.3) {
          t.stage = 1;
          t.work = 0;
          w.pulse = 0.5;
        }
      } else if (t.stage === 1 && pair.every((p) => p.z < -12)) {
        t.stage = 2;
        t.work = 0;
        w.pulse = 0.5;
      } else if (t.stage === 2 && t.work >= 10) {
        t.stage = 3;
        t.finish = w.time;
        if (!w.endAt) w.endAt = w.time + 3;
        w.pulse = 1;
      }
      const progress =
        t.stage >= 3
          ? 100000 - Math.round(t.finish * 100)
          : t.stage * 1000 +
            Math.floor(t.work * 30) +
            (t.stage === 1
              ? Math.floor(pair.reduce((n, p) => n + Math.max(0, -p.z), 0) * 20)
              : 0);
      pair.forEach((p) => (p.score = progress));
    }
  if (!['race', 'duos'].includes(w.kind)) {
    const alive = w.actors.filter((p) => p.alive);
    if (alive.length <= 1 && !w.endAt) w.endAt = w.time + 2;
  }
  if (w.time >= w.duration || (w.endAt > 0 && w.time >= w.endAt)) {
    w.done = true;
    if (!['race', 'duos'].includes(w.kind))
      for (const p of w.actors)
        if (p.alive) p.score = 100000 + Math.round(w.time * 100);
  }
}
export function advanceArena(w: Arena, targetSeconds: number) {
  const target = Math.min(w.duration, Math.max(0, targetSeconds));
  const targetTick = Math.floor(target * 60);
  while (w.tick < targetTick && !w.done) stepArena(w);
  return w;
}
