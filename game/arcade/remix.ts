import type { Arena, Runner, Control } from './simulation';
import { randomAt } from './simulation';
import { remixInfo } from './remix-catalog';
export type RObject = {
  id: number;
  kind: string;
  x: number;
  z: number;
  y: number;
  vx: number;
  vz: number;
  vy: number;
  r: number;
  owner: number;
  value: number;
  life: number;
};
export type RSeat = {
  points: number;
  selected: number;
  held: number;
  grid: number[];
  rot: number[];
  next: number;
  fired: boolean;
  falseStart?: boolean;
  stopped: number;
  lift: number;
  carrying: number;
  skiSpeed: number;
  cleanSince?: number;
  tumbleUntil: number;
  lastPole: number;
  best: number;
  aim: number;
  target: number;
  shotPitch: number;
  anchored: boolean;
};
export type RemixState = {
  revision: 1;
  objects: RObject[];
  seats: RSeat[];
  serial: number;
  spawn: number;
  heat: number;
  signal: number;
  signalAt: number;
  claimed: number;
  claimedAt?: number;
  teamPoints: number[];
  shields: number[];
  beast: { x: number; z: number; dx: number; dz: number; phase: number };
  avalanche: number;
  lean: { x: number; z: number };
  lastGust: number;
  gustTeams: number[];
  hoopBusy: number[];
};
export const BUOYS = [
  [-7, -5],
  [5, -7],
  [10, 0],
  [5, 7],
  [-4, 6],
  [-10, 0],
  [0, -2],
  [0, 8],
] as const;
export const MAZE_WALLS = [
  [-8, -3, 4, 0.7],
  [-1, -3, 5, 0.7],
  [7, -3, 3, 0.7],
  [-7, 3, 3, 0.7],
  [1, 3, 5, 0.7],
  [8, 3, 4, 0.7],
  [-4, 0, 0.7, 3],
  [4, 0, 0.7, 3],
] as const;
export const skiCenter = (d: number) =>
  Math.sin(d / 24) * 2.2 + Math.sin(d / 11);
export const skiHeight = (d: number) => -d * 0.15 + Math.sin(d * 0.045) * 0.55;
export function pitchAt(seed: number, time: number) {
  const pitch = Math.floor(time / 1.45),
    type = Math.floor(randomAt(seed, 8100 + pitch) * 3);
  return { pitch, type, contact: [0.78, 1.06, 0.92][type], cycle: time % 1.45 };
}
/** The critter grows through a free-for-all; a ridden critter stays compact. */
export const critterScale = (time: number, ridden = false) =>
  ridden ? 1.1 : 1 + Math.min(0.9, time * 0.025);
export function spotlightApproach(seed: number, heat: number, time: number) {
  const arrival = 3.9 + randomAt(seed, 9400 + heat) * 3.1;
  const hesitation = 0.25 + randomAt(seed, 9500 + heat) * 1.5;
  const burst = 0.25 + randomAt(seed, 9600 + heat) * 0.55;
  const u = Math.max(0, (time - hesitation) / (arrival - hesitation));
  return {
    gap: 12 * (1 - (burst * u + (1 - burst) * u ** 3)),
    speed:
      time < hesitation
        ? 0
        : (12 * (burst + 3 * (1 - burst) * u ** 2)) / (arrival - hesitation),
  };
}
const rockCache = new Map<number, { x: number; d: number; r: number }[]>();
export const skiRocks = (seed: number) => {
  if (rockCache.has(seed)) return rockCache.get(seed)!;
  if (rockCache.size > 12) rockCache.clear();
  const rocks = Array.from({ length: 34 }, (_, i) => ({
    x: (randomAt(seed, i + 500) * 2 - 1) * 5.2,
    d: 17 + i * 6.3,
    r: 0.65 + (i % 3) * 0.12,
  }));
  rockCache.set(seed, rocks);
  return rocks;
};
export const leafSide = (seed: number, n: number) =>
  randomAt(seed, n + 120) > 0.5 ? 1 : -1;
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const dt = 1 / 60;
function add(
  w: Arena,
  kind: string,
  x: number,
  z: number,
  options: Partial<RObject> = {},
) {
  const r = w.remix!;
  r.objects.push({
    id: r.serial++,
    kind,
    x,
    z,
    y: 0,
    vx: 0,
    vz: 0,
    vy: 0,
    r: 0.5,
    owner: -1,
    value: 1,
    life: 15,
    ...options,
  });
}
function out(w: Arena, p: Runner) {
  if (!p.alive) return;
  p.alive = false;
  p.outAt = w.time;
  p.score = Math.round(w.time * 100);
  p.flash = 1;
}
function finished(w: Arena, p: Runner) {
  if (p.finish) return;
  p.finish = w.time;
  p.score = 100000 - Math.round(w.time * 100);
  if (!w.endAt) w.endAt = w.time + (w.kind === 'prickleice' ? 8 : 6);
}
function aim(x: number, z: number, p: Runner): Control {
  const d = Math.hypot(x - p.x, z - p.z);
  return {
    x: (x - p.x) / Math.max(0.4, d),
    z: (z - p.z) / Math.max(0.4, d),
    a: false,
    b: false,
    seq: 0,
  };
}
function movement(p: Runner, c: Control, speed = 5, drag = 10) {
  p.vx += (c.x * speed - p.vx) * Math.min(1, dt * drag);
  p.vz += (c.z * speed - p.vz) * Math.min(1, dt * drag);
  p.x += p.vx * dt;
  p.z += p.vz * dt;
  if (Math.hypot(p.vx, p.vz) > 0.1) p.face = Math.atan2(p.vx, p.vz);
}
function bounds(p: Runner, x = 11, z = 8) {
  p.x = clamp(p.x, -x, x);
  p.z = clamp(p.z, -z, z);
}
function jump(p: Runner, press: boolean) {
  if (press && p.y <= 0.01 && p.cooldown <= 0) {
    p.vy = 6;
    p.cooldown = 0.6;
  }
  p.vy -= 18 * dt;
  p.y = Math.max(0, p.y + p.vy * dt);
  if (!p.y) p.vy = 0;
}
function mazeMove(p: Runner, c: Control) {
  const x = p.x,
    z = p.z;
  movement(p, c, 4.8);
  bounds(p);
  for (const [wx, wz, w, d] of MAZE_WALLS)
    if (Math.abs(p.x - wx) < w / 2 + 0.4 && Math.abs(p.z - wz) < d / 2 + 0.4) {
      p.x = x;
      p.z = z;
      p.vx = p.vz = 0;
    }
}

const navigation = new Map<string, { x: number; z: number }>();
export function mazeWaypoint(x: number, z: number, tx: number, tz: number) {
  const sx = Math.round(x),
    sz = Math.round(z),
    gx = Math.round(tx),
    gz = Math.round(tz),
    key = [sx, sz, gx, gz].join(':');
  if (navigation.has(key)) return navigation.get(key)!;
  const clear = (x: number, z: number) =>
    Math.abs(x) <= 11 &&
    Math.abs(z) <= 8 &&
    MAZE_WALLS.every(
      ([wx, wz, w, d]) =>
        Math.abs(x - wx) >= w / 2 + 0.45 || Math.abs(z - wz) >= d / 2 + 0.45,
    );
  const queue = [{ x: sx, z: sz }],
    prev = new Map<string, string>(),
    coords = new Map<string, { x: number; z: number }>([
      [sx + ',' + sz, queue[0]],
    ]);
  let end = '';
  for (let n = 0; n < queue.length; n++) {
    const p = queue[n],
      id = p.x + ',' + p.z;
    if (p.x === gx && p.z === gz) {
      end = id;
      break;
    }
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const q = { x: p.x + dx, z: p.z + dz },
        k = q.x + ',' + q.z;
      if (clear(q.x, q.z) && !coords.has(k)) {
        coords.set(k, q);
        prev.set(k, id);
        queue.push(q);
      }
    }
  }
  const start = sx + ',' + sz;
  let next = end;
  if (next)
    while (prev.get(next) && prev.get(next) !== start) next = prev.get(next)!;
  const result = coords.get(next) ?? { x: tx, z: tz };
  navigation.set(key, result);
  return result;
}

function resetHeat(w: Arena, heat: number) {
  const r = w.remix!;
  r.heat = heat;
  r.objects = [];
  r.lean = { x: 0, z: 0 };
  w.actors.forEach((p, i) => {
    p.alive = true;
    p.lives = 3;
    p.y = 0;
    p.vx = p.vz = 0;
    p.x = i === heat ? 0 : Math.sin(i * 2.1) * 8;
    p.z = i === heat ? 0 : Math.cos(i * 2.1) * 6;
    p.flash = 0;
    p.score = r.seats[i].points;
  });
}
/**
 * Board 1 vs 3 versions of free-for-all survival games: the solo alien in
 * seat 0 rides the lava critter or commands the snow sentries, and wins by
 * catching all three runners within 30 seconds.
 */
export const SOLO_DRIVEN = ['tidetiles', 'cannoncay'];
export const soloDriven = (w: Arena) =>
  w.mode === '1v3' && SOLO_DRIVEN.includes(w.kind);
/** Snow sentries ring the pond; the commander throws from the one that's loaded. */
export const sentrySpot = (index: number) => {
  const a = (index * Math.PI) / 3;
  return { x: Math.cos(a) * 12, z: Math.sin(a) * 8 };
};
export const COMMANDER = { x: 0, z: -10.4, y: 2.2 };
/** Showdown tuning (see the 1 vs 3 balance check in tests/party-rules). */
const SENTRY_LIVES = 1,
  CHARGE = { speed: 9, time: 0.55, cooldown: 2.1, walk: 3.5 };
function driveSolo(w: Arena, { c, ap }: { c: Control; ap: boolean }) {
  const r = w.remix!,
    solo = w.actors[0];
  solo.alive = true;
  if (w.kind === 'tidetiles') {
    // Steer the critter; Space launches a short charge.
    const b = r.beast,
      steer = Math.hypot(c.x, c.z);
    if (ap && solo.cooldown <= 0) {
      b.phase = w.time + CHARGE.time;
      solo.cooldown = CHARGE.cooldown;
    }
    const charging = w.time < b.phase;
    if (steer > 0.15 && !charging) {
      b.dx += (c.x / steer - b.dx) * Math.min(1, dt * 8);
      b.dz += (c.z / steer - b.dz) * Math.min(1, dt * 8);
      const n = Math.hypot(b.dx, b.dz) || 1;
      b.dx /= n;
      b.dz /= n;
    }
    if (charging || steer > 0.15) {
      const speed = charging ? CHARGE.speed : CHARGE.walk;
      b.x = clamp(b.x + b.dx * speed * dt, -9, 9);
      b.z = clamp(b.z + b.dz * speed * dt, -6.5, 6.5);
    }
    const size = critterScale(w.time, true);
    solo.x = b.x;
    solo.z = b.z;
    solo.y = 0.95 * size;
    solo.vx = charging ? b.dx * CHARGE.speed : 0;
    solo.vz = charging ? b.dz * CHARGE.speed : 0;
    solo.face = Math.atan2(b.dx, b.dz);
    return;
  }
  // Snow sentries: move the reticle across the pond and throw from the
  // loaded sentry, which rotates after every throw.
  r.lean.x = clamp(r.lean.x + c.x * 9.5 * dt, -10, 10);
  r.lean.z = clamp(r.lean.z + c.z * 9.5 * dt, -7, 7);
  const from = sentrySpot(r.serial % 6);
  if (ap && solo.cooldown <= 0) {
    const d = Math.hypot(r.lean.x - from.x, r.lean.z - from.z) || 1;
    add(w, 'snowball', from.x, from.z, {
      vx: ((r.lean.x - from.x) / d) * 8.5,
      vz: ((r.lean.z - from.z) / d) * 8.5,
      r: 0.48,
      life: 5,
      y: 0.45,
      owner: 0,
    });
    solo.cooldown = 0.7;
  }
  r.spawn = w.time + solo.cooldown;
  solo.x = COMMANDER.x;
  solo.z = COMMANDER.z;
  solo.y = COMMANDER.y;
  solo.vx = solo.vz = 0;
  solo.face = Math.atan2(r.lean.x - solo.x, r.lean.z - solo.z);
}
function cpuSolo(w: Arena, p: Runner): Control {
  const r = w.remix!,
    c: Control = { x: 0, z: 0, a: false, b: false, seq: 0 },
    alive = w.actors.slice(1).filter((q) => q.alive);
  const from =
    w.kind === 'tidetiles' ? { x: r.beast.x, z: r.beast.z } : { x: r.lean.x, z: r.lean.z };
  const target = alive.sort(
    (a, b) =>
      Math.hypot(a.x - from.x, a.z - from.z) - Math.hypot(b.x - from.x, b.z - from.z),
  )[0];
  if (!target) return c;
  // Lead by the snowball's flight time; easier CPUs lead less and wobble more.
  const sentry = sentrySpot(r.serial % 6),
    flight =
      w.kind === 'cannoncay'
        ? Math.hypot(target.x - sentry.x, target.z - sentry.z) / 8.5
        : 0.3;
  const lead = flight * [0.35, 0.7, 0.95][w.difficulty],
    wobble = [1.6, 0.9, 0.45][w.difficulty],
    tx = target.x + target.vx * lead + Math.sin(w.time * 1.7) * wobble,
    tz = target.z + target.vz * lead + Math.cos(w.time * 1.3) * wobble,
    d = Math.hypot(tx - from.x, tz - from.z);
  const gain = [0.8, 0.9, 1][w.difficulty];
  c.x = clamp(((tx - from.x) / Math.max(0.5, d)) * gain, -1, 1);
  c.z = clamp(((tz - from.z) / Math.max(0.5, d)) * gain, -1, 1);
  // Alternate the button so each throw/charge is a fresh press.
  const ready = p.cooldown <= 0 && w.tick % 2 === 0;
  c.a = w.kind === 'tidetiles' ? ready && d < 4.2 : ready && d < 1.3;
  return c;
}
export function startRemix(w: Arena) {
  const meta = remixInfo(w.kind)!;
  // A board 1 vs 3 plays one long heat with a fixed solo alien in seat 0.
  w.duration =
    w.mode === '1v3' && (meta.heats || SOLO_DRIVEN.includes(w.kind))
      ? 30
      : meta.duration;
  w.remix = {
    revision: 1,
    objects: [],
    serial: 0,
    spawn: 1,
    heat: -1,
    signal: 0,
    signalAt: 2,
    claimed: -1,
    teamPoints: [0, 0],
    shields: [10, 10],
    beast: { x: 0, z: -6, dx: 0, dz: 1, phase: -1 },
    avalanche: -18,
    lean: { x: 0, z: 0 },
    lastGust: -1,
    gustTeams: [-1, -1],
    hoopBusy: Array(21).fill(0),
    seats: w.actors.map(() => ({
      points: 0,
      selected: 0,
      held: -1,
      grid: [3, 5, 1, 4, 0, 2],
      rot: [1, 2, 3, 1, 2, 3],
      next: 0,
      fired: false,
      stopped: -1,
      lift: 0,
      carrying: -1,
      skiSpeed: 7,
      tumbleUntil: 0,
      lastPole: -1,
      best: 0,
      aim: 0,
      target: 0,
      shotPitch: -1,
      anchored: false,
    })),
  };
  w.actors.forEach((p, i) => {
    p.x = (i - 1.5) * 3;
    p.z = 4;
    p.gear = 0;
    p.distance = 0;
    p.checkpoint = 0;
    if (w.kind === 'prickleice') {
      p.x = (i - 1.5) * 1.4;
      p.z = 0;
    }
    if (w.kind === 'mangrovemotors') {
      p.x = -10 + i * 1.2;
      p.z = 3;
    }
    if (w.kind === 'frostyfreight') {
      p.x = (i < 2 ? -4 : 4) + (i % 2 ? 1 : -1);
      p.z = 0;
    }
    if (w.kind === 'vinevault') {
      p.x = (i - 1.5) * 5;
      p.z = 0;
    }
    if (w.kind === 'geckograffiti') {
      p.x = i % 2 ? 9 : -9;
      p.z = p.team ? -6 : 6;
    }
    if (w.kind === 'returnsender') {
      p.x = p.team ? 8 : -8;
      p.z = i % 2 ? 4 : -4;
    }
    if (w.kind === 'pelicanpilots') {
      p.x = p.team ? 5 : -5;
      p.z = i % 2 ? -2 : 4;
      p.y = i % 2 ? 4 : 0;
    }
  });
  if (meta.heats) resetHeat(w, 0);
  if (soloDriven(w)) {
    // Runners start spread across the far side, away from the solo alien.
    w.actors.forEach((p, i) => {
      if (!i) return;
      p.x = (i - 2) * 5 + (randomAt(w.seed, 70 + i) - 0.5) * 3;
      p.z = (w.kind === 'cannoncay' ? 3 : 4.5) + (randomAt(w.seed, 90 + i) - 0.5) * 2;
      if (w.kind === 'cannoncay') p.lives = SENTRY_LIVES;
    });
    w.remix.beast = { x: 0, z: -4.5, dx: 0, dz: 1, phase: -1 };
    w.remix.lean = { x: 0, z: 0 };
    driveSolo(w, { c: { x: 0, z: 0, a: false, b: false, seq: 0 }, ap: false });
  }
  if (w.kind === 'hotelhiccup') {
    const permutation = [0, 1, 2, 3, 4, 5];
    for (let i = 5; i > 0; i--) {
      const j = Math.floor(randomAt(w.seed, 800 + i) * (i + 1));
      [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
    }
    w.remix.seats.forEach((s) => {
      s.grid = [...permutation];
      s.rot = Array.from(
        { length: 6 },
        (_, i) => 1 + Math.floor(randomAt(w.seed, 820 + i) * 3),
      );
    });
  }
  if (w.kind === 'geckograffiti')
    for (let i = 0; i < 4; i++)
      add(w, 'relic', i % 2 ? 8 : -8, i < 2 ? -6 : 6, {
        owner: Math.floor(i / 2),
        value: i % 2,
        r: 0.55,
        life: 100,
      });
}
function cpu(w: Arena, p: Runner, i: number): Control {
  const r = w.remix!,
    s = r.seats[i],
    k = w.kind,
    c: Control = { x: 0, z: 0, a: false, b: false, seq: 0 },
    reaction = [0.3, 0.15, 0.07][w.difficulty];
  if (i === 0 && soloDriven(w)) return cpuSolo(w, p);
  if (w.time < s.next) return c;
  if (k === 'prickleice') {
    const rock = skiRocks(w.seed).find(
      (o) =>
        o.d > p.distance && o.d < p.distance + 10 && Math.abs(o.x - p.x) < 1.7,
    );
    c.x = rock ? Math.sign(p.x - rock.x || i - 1.5) : clamp(-p.x * 0.15, -1, 1);
    c.a =
      randomAt(w.seed, i * 1000 + Math.floor(w.time * 2)) >
      [0.3, 0.14, 0.03][w.difficulty];
    c.b = Math.abs(p.x) > 5.7;
    return c;
  }
  if (k === 'lanternlurk') {
    const { gap, speed } = spotlightApproach(
      w.seed,
      Math.min(2, Math.floor(w.time / 10)),
      w.time % 10,
    );
    c.a = gap < 0.12 + speed * (0.18 + reaction);
    c.x = 0;
    return c;
  }
  if (k === 'vinevault') {
    c.x = leafSide(w.seed, p.checkpoint);
    c.a = p.cooldown <= 0;
    return c;
  }
  if (k === 'mangrovemotors') {
    const b = BUOYS[Math.min(7, p.checkpoint)];
    Object.assign(c, aim(b[0], b[1], p));
    c.a = true;
    c.b = Math.hypot(b[0] - p.x, b[1] - p.z) < 2.5;
    return c;
  }
  if (k === 'frostyfreight') {
    c.z = -1;
    c.b = w.time % 7 > 4.1 - reaction;
    c.a = !c.b && p.cooldown <= 0;
    return c;
  }
  if (k === 'hotelhiccup') {
    let target = s.grid.findIndex((v, j) => v !== j || s.rot[j] !== 0);
    if (target < 0) return c;
    if (s.held >= 0) target = s.grid[s.held];
    else if (s.grid[target] !== target) target = s.grid.indexOf(target);
    if (s.selected !== target) {
      const row = Math.floor(target / 3) - Math.floor(s.selected / 3);
      if (row) c.z = Math.sign(row);
      else c.x = Math.sign(target - s.selected);
    } else if (s.held >= 0 || s.grid[target] !== target) c.a = true;
    else c.b = true;
    s.next = w.time + 0.18 + reaction;
    return c;
  }
  if (k === 'crumbleclock') {
    c.x = Math.sin(w.time * 1.6 + i) * 0.3;
    c.a = p.y <= 0 || p.vy < 1.6;
    return c;
  }
  if (k === 'picklepatrol') {
    // The hidden beacon is not knowledge a CPU opponent is allowed to use.
    if (w.time < r.signalAt + reaction) return c;
    const target = r.signal;
    Object.assign(c, aim((target - 2) * 3, -3, p));
    c.a =
      w.time - r.signalAt > reaction &&
      Math.hypot(p.x - (target - 2) * 3, p.z + 3) < 0.65;
    return c;
  }
  if (k === 'mangosluggers') {
    const { pitch, contact: speed, cycle: phase } = pitchAt(w.seed, w.time);
    const error =
      (randomAt(w.seed, pitch * 17 + i * 151) - 0.5) *
      [0.44, 0.23, 0.07][w.difficulty];
    c.a = phase >= speed + error && phase < speed + error + 0.045;
    return c;
  }
  if (k === 'returnsender') {
    const incoming = r.objects
      .filter(
        (o) => o.kind === 'parcel' && Math.sign(o.vx) === (p.team ? 1 : -1),
      )
      .sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x));
    const obj = incoming.find((o) => o.z < 0 === (i % 2 === 0)) ?? incoming[0];
    if (obj) {
      Object.assign(c, aim(p.team ? 8 : -8, obj.z, p));
      c.a = Math.abs(obj.x - p.x) < 2.1 && Math.abs(obj.z - p.z) < 0.8;
    }
    return c;
  }
  if (k === 'geckograffiti') {
    const dest =
      s.carrying < 0
        ? (r.objects.find(
            (o) =>
              o.kind === 'relic' && o.owner === p.team && o.value === i % 2,
          ) ?? r.objects.find((o) => o.kind === 'relic' && o.owner === p.team))
        : undefined;
    const waypoint = mazeWaypoint(p.x, p.z, dest?.x ?? 0, dest?.z ?? 0);
    Object.assign(c, aim(waypoint.x, waypoint.z, p));
    c.a =
      s.carrying < 0 && !!dest && Math.hypot(p.x - dest.x, p.z - dest.z) < 1.2;
    return c;
  }
  if (k === 'pelicanpilots' || k === 'bubbletrouble') {
    const pool = r.objects.filter(
      (o) =>
        (o.kind === 'ring' || o.kind === 'token') && o.z > -14 && o.owner < 0,
    );
    const o = (
      pool.filter((o) => o.id % 4 === i).length
        ? pool.filter((o) => o.id % 4 === i)
        : pool
    ).sort(
      (a, b) =>
        Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z),
    )[0];
    if (o) Object.assign(c, aim(o.x, o.z, p));
    c.a = true;
    if (k === 'pelicanpilots' && i % 2) c.b = p.y < (o?.y ?? 4);
    return c;
  }
  if (k === 'boulderbuffet') {
    if (i === r.heat) {
      c.x = clamp(-r.lean.x * 3 - p.x, -1, 1);
      c.z = clamp(-r.lean.z * 3 - p.z, -1, 1);
      c.b = Math.hypot(r.lean.x, r.lean.z) > 0.9;
    } else {
      c.x = Math.sin(w.time + i);
      c.z = Math.cos(w.time + i);
      c.a = p.cooldown <= 0 && (p.y <= 0 || p.vy < 0);
    }
    return c;
  }
  if (k === 'skewergallery') {
    const carrier = w.actors[r.heat];
    if (i === r.heat) {
      c.x = Math.sin(w.time * 0.9 + i);
      c.z = Math.cos(w.time * 0.7 + i);
      c.a = p.cooldown <= 0;
    } else {
      Object.assign(c, aim(carrier.x, carrier.z, p));
      c.a = p.cooldown <= 0;
    }
    return c;
  }
  const danger = r.objects
    .filter((o) => o.kind !== 'warning')
    .sort(
      (a, b) =>
        Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z),
    )[0];
  if (k === 'tidetiles') {
    const b = r.beast,
      bd = Math.hypot(p.x - b.x, p.z - b.z) || 1;
    // Score a ring of directions: room from the critter, out of its charge
    // lane, away from walls/corners and glowing fissures. A little noise
    // (more for easier CPUs) keeps runners from moving as one.
    const beat = Math.floor(w.time * 3),
      noise = [2.2, 1.3, 0.6][w.difficulty];
    let best = -Infinity;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2,
        dx = Math.sin(a),
        dz = Math.cos(a),
        nx = p.x + dx * 2.2,
        nz = p.z + dz * 2.2;
      let score = Math.min(7, Math.hypot(nx - b.x, nz - b.z));
      const ahead = (nx - b.x) * b.dx + (nz - b.z) * b.dz,
        lateral = Math.abs((nx - b.x) * b.dz - (nz - b.z) * b.dx);
      if (ahead > 0 && ahead < 7 && lateral < 1.8) score -= 3;
      score -= Math.max(0, Math.abs(nx) - 7) * 2.5 + Math.max(0, Math.abs(nz) - 4.5) * 2.5;
      for (let j = 0; j < 4; j++) {
        const x = (j % 2 ? 1 : -1) * 4,
          z = (j < 2 ? -1 : 1) * 3;
        if ((w.time + j * 0.9) % 5 > 3.2 - reaction && Math.hypot(nx - x, nz - z) < 2.1)
          score -= 5;
      }
      score += (randomAt(w.seed, i * 997 + k * 13 + beat * 131) - 0.5) * noise;
      if (score > best) {
        best = score;
        c.x = dx;
        c.z = dz;
      }
    }
    c.a = p.cooldown <= 0 && bd < 2.4;
  } else if (k === 'cannoncay' && soloDriven(w)) {
    // Score directions by clearance from snowballs in flight and from the
    // commander's reticle; easier runners sometimes misread a throw.
    const beat = Math.floor(w.time * 3),
      misread = randomAt(w.seed, i * 577 + beat) < [0.35, 0.2, 0.08][w.difficulty];
    let best = -Infinity;
    for (let k2 = 0; k2 < 12; k2++) {
      const a = (k2 / 12) * Math.PI * 2,
        dx = Math.sin(a),
        dz = Math.cos(a),
        nx = p.x + dx * 1.6,
        nz = p.z + dz * 1.6;
      let score = Math.min(4, Math.hypot(nx - r.lean.x, nz - r.lean.z)) * 0.6;
      if (!misread)
        for (const o of r.objects) {
          if (o.kind !== 'snowball') continue;
          const ox = o.x + o.vx * 0.3,
            oz = o.z + o.vz * 0.3,
            d = Math.hypot(nx - ox, nz - oz);
          if (d < 1.8) score -= (1.8 - d) * 4;
        }
      score -= Math.max(0, Math.abs(nx) - 8) * 2 + Math.max(0, Math.abs(nz) - 5.5) * 2;
      score += (randomAt(w.seed, i * 991 + k2 * 17 + beat * 137) - 0.5) * 0.8;
      if (score > best) {
        best = score;
        c.x = dx;
        c.z = dz;
      }
    }
  } else if (danger && Math.hypot(danger.x - p.x, danger.z - p.z) < 4) {
    c.x = clamp(p.x - danger.x, -1, 1);
    c.z = clamp(p.z - danger.z, -1, 1);
  } else {
    c.x = clamp(-p.x * 0.2 + Math.sin(w.time + i) * 0.3, -1, 1);
    c.z = clamp(-p.z * 0.2, -1, 1);
  }
  return c;
}
export function stepRemix(w: Arena) {
  if (w.done) return;
  w.tick++;
  w.time = w.tick / 60;
  w.pulse = Math.max(0, w.pulse - dt);
  const r = w.remix!,
    kind = w.kind,
    meta = remixInfo(kind)!,
    driven = soloDriven(w);
  if (meta.heats) {
    const heat =
      w.mode === '1v3' ? 0 : Math.min(3, Math.floor((w.tick - 1) / 780));
    if (heat !== r.heat) resetHeat(w, heat);
  }
  if (kind === 'picklepatrol') {
    const round = Math.floor(w.time / 4);
    if (round !== r.heat) {
      r.heat = round;
      r.signal = Math.floor(randomAt(w.seed, round + 41) * 5);
      r.signalAt = round * 4 + 1.4 + randomAt(w.seed, round + 61) * 0.8;
      r.claimed = -1;
      r.claimedAt = -1;
      r.seats.forEach((s) => {
        s.fired = false;
        s.falseStart = false;
      });
    }
  }
  const inputs = w.actors.map((p, i) => {
    const c = p.cpu
      ? cpu(w, p, i)
      : w.time - p.inputAt > 0.55
        ? { x: 0, z: 0, a: false, b: false, seq: p.input.seq }
        : p.input;
    const ap = (c.a && !p.wasA) || (c.ap ?? 0) > p.seenAP,
      bp = (c.b && !p.wasB) || (c.bp ?? 0) > p.seenBP;
    p.wasA = c.a;
    p.wasB = c.b;
    p.seenAP = Math.max(p.seenAP, c.ap ?? 0);
    p.seenBP = Math.max(p.seenBP, c.bp ?? 0);
    p.cooldown = Math.max(0, p.cooldown - dt);
    p.flash = Math.max(0, p.flash - dt);
    p.stun = Math.max(0, p.stun - dt);
    return { c, ap, bp };
  });
  if (kind === 'tidetiles' && !driven) {
    const cycle = Math.floor(w.time / 2.6),
      q = w.time % 2.6,
      b = r.beast;
    if (cycle !== b.phase) {
      b.phase = cycle;
      const alive = w.actors.filter((p) => p.alive),
        target = alive[cycle % Math.max(1, alive.length)];
      if (target) {
        const d = Math.hypot(target.x - b.x, target.z - b.z);
        b.dx = (target.x - b.x) / Math.max(0.1, d);
        b.dz = (target.z - b.z) / Math.max(0.1, d);
      }
    }
    if (q > 0.34 && q < 1.19) {
      b.x += b.dx * 11 * dt;
      b.z += b.dz * 11 * dt;
    }
    b.x = clamp(b.x, -9, 9);
    b.z = clamp(b.z, -6.5, 6.5);
  }
  if (kind === 'cannoncay' && !driven && w.time >= r.spawn) {
    const index = r.serial % 6,
      a = (index * Math.PI) / 3,
      x = Math.cos(a) * 12,
      z = Math.sin(a) * 8,
      p = w.actors[r.serial % 4],
      d = Math.hypot(p.x - x, p.z - z);
    add(w, 'snowball', x, z, {
      vx: ((p.x - x) / d) * 7,
      vz: ((p.z - z) / d) * 7,
      r: 0.48,
      life: 5,
      y: 0.45,
    });
    r.spawn = w.time + Math.max(0.3, 1.1 - w.time * 0.018);
  }
  if (kind === 'crabtraffic' && w.time >= r.spawn) {
    const gap = Math.floor(randomAt(w.seed, r.serial + 70) * 6);
    for (let lane = 0; lane < 7; lane++)
      if (lane !== gap && lane !== gap + 1)
        add(w, 'crab', -10 + lane * 3, -10, {
          vz: 2.7 + w.time * 0.035,
          r: lane % 3 === 0 ? 0.95 : 0.62,
          life: 10,
        });
    r.spawn = w.time + 2.5;
  }
  if (
    (kind === 'bubbletrouble' || kind === 'pelicanpilots') &&
    w.time >= r.spawn
  ) {
    const lane = randomAt(w.seed, r.serial + 30) * 18 - 9;
    add(w, kind === 'bubbletrouble' ? 'ring' : 'token', lane, -16, {
      vz: 4,
      y: kind === 'bubbletrouble' ? 1 : 3 + randomAt(w.seed, r.serial + 80) * 3,
      r: 0.9,
      life: 10,
      value: r.serial % 5 === 0 ? 3 : 1,
    });
    if (r.serial % 3 === 0)
      add(w, kind === 'bubbletrouble' ? 'jelly' : 'crate', -lane, -17, {
        vz: 4,
        r: 0.8,
        life: 10,
      });
    r.spawn = w.time + 0.75;
  }
  if (kind === 'returnsender' && w.time >= r.spawn) {
    add(w, 'parcel', 0, ((r.serial % 6) - 2.5) * 2.3, {
      vx: r.serial % 2 ? 3.4 : -3.4,
      r: 0.4,
      life: 12,
    });
    r.spawn = w.time + 0.68;
  }
  if (kind === 'prickleice')
    r.avalanche = -18 + 6.2 * w.time + 0.029 * w.time * w.time;
  if (driven) driveSolo(w, inputs[0]);
  w.actors.forEach((p, i) => {
    const s = r.seats[i],
      { c, ap, bp } = inputs[i];
    if (p.finish || (!p.alive && !meta.heats)) return;
    // The solo driver is placed by driveSolo, never by the runner rules.
    if (driven && i === 0) return;
    if (kind === 'prickleice') {
      const tumbling = w.time < s.tumbleUntil;
      if (c.a && !tumbling && w.time - s.lastPole >= 1 / 6) {
        s.skiSpeed = Math.min(13.5, s.skiSpeed + 0.12);
        s.lastPole = w.time;
      }
      const clean = Math.max(0, w.time - (s.cleanSince ?? 0));
      const straight = 1 - Math.min(1, Math.abs(c.x)) * 0.8;
      if (c.b) s.skiSpeed += (4.8 - s.skiSpeed) * dt * 2;
      else if (!tumbling)
        s.skiSpeed = Math.min(
          13.5,
          s.skiSpeed + dt * (0.8 + Math.min(6, clean) * 0.22) * straight,
        );
      p.vx += (c.x * (c.b ? 6 : 7.5) - p.vx) * dt * (c.b ? 7 : 3.5);
      if (tumbling) p.vx *= 0.93;
      p.x += p.vx * dt;
      if (Math.abs(p.x) > 6) {
        p.x = clamp(p.x, -6.8, 6.8);
        s.skiSpeed *= 1 - dt * 0.8;
        s.cleanSince = w.time;
      }
      p.distance += Math.max(1, s.skiSpeed) * dt;
      p.z = -p.distance;
      p.face = Math.PI - p.vx * 0.055;
      const rock = skiRocks(w.seed).find(
        (o) =>
          Math.abs(o.d - p.distance) < 0.7 && Math.abs(o.x - p.x) < o.r + 0.35,
      );
      if (rock && p.flash <= 0) {
        s.skiSpeed *= 0.35;
        s.cleanSince = w.time;
        s.tumbleUntil = w.time + 0.65;
        p.flash = 1.15;
      }
      s.best = Math.max(s.best, p.distance);
      p.score = Math.floor((s.best / 240) * 89999);
      if (p.distance <= r.avalanche) {
        p.alive = false;
        p.outAt = w.time;
      } else if (p.distance >= 240) finished(w, p);
    } else if (kind === 'lanternlurk') {
      const heat = Math.min(2, Math.floor(w.time / 10)),
        t = w.time % 10;
      if (s.target !== heat) {
        s.target = heat;
        s.fired = false;
        s.stopped = -1;
        s.lift = 0;
      }
      const { gap } = spotlightApproach(w.seed, heat, t);
      p.x = (i - 1.5) * 4;
      p.z = 5;
      if (ap && !s.fired) {
        s.fired = true;
        s.lift = w.time + 0.18;
      }
      if (s.fired && s.stopped < 0 && w.time >= s.lift) {
        s.stopped = Math.max(0, gap);
        if (gap > 0) s.points += Math.round(Math.max(0, 1000 - gap * 100));
      }
      if (gap <= 0 && !s.fired) {
        s.fired = true;
        s.stopped = 0;
        p.flash = 0.8;
      }
      p.score = s.points;
    } else if (kind === 'vinevault') {
      const side = leafSide(w.seed, p.checkpoint);
      s.aim = c.x || s.aim;
      if ((ap || (p.cpu && c.a)) && p.cooldown <= 0) {
        if (Math.sign(s.aim) === side) {
          p.checkpoint++;
          s.best = Math.max(s.best, p.checkpoint);
          p.vy = 5;
          p.cooldown = 0.35;
        } else {
          p.checkpoint = Math.max(0, p.checkpoint - 2);
          p.cooldown = 0.65;
          p.flash = 0.5;
        }
        if (p.cpu)
          s.next =
            w.time +
            [0.72, 0.55, 0.41][w.difficulty] +
            randomAt(w.seed, p.checkpoint * 11 + i) * 0.05;
      }
      p.y =
        p.checkpoint * 0.8 +
        Math.max(0, Math.sin(((0.35 - p.cooldown) / 0.35) * Math.PI)) * 0.8;
      p.x =
        (i - 1.5) * 5 + leafSide(w.seed, Math.max(0, p.checkpoint - 1)) * 1.2;
      p.score = p.checkpoint;
    } else if (kind === 'mangrovemotors') {
      movement(p, c, c.a ? (c.b ? 3.2 : 7.2) : 1.2, c.b ? 6 : 2.2);
      bounds(p, 13, 10);
      const b = BUOYS[Math.min(7, p.checkpoint)];
      if (Math.hypot(p.x - b[0], p.z - b[1]) < 1.25) {
        p.checkpoint++;
        p.flash = 0.3;
        if (p.checkpoint === 8) finished(w, p);
      }
      if (!p.finish)
        p.score = Math.floor(
          (p.checkpoint +
            Math.max(0, 1 - Math.hypot(p.x - b[0], p.z - b[1]) / 24)) *
            (89999 / 8),
        );
    } else if (kind === 'frostyfreight') {
      s.anchored = c.b;
      const gust = w.time % 7 > 4.4 && w.time % 7 < 6.4;
      if (!gust && !c.b) {
        p.distance += Math.max(0, -c.z) * 2.1 * dt;
        if (ap && p.cooldown <= 0) {
          p.distance += 0.35;
          p.cooldown = 0.5;
        }
      }
      p.z = -p.distance;
      p.y = p.distance * 0.25;
      p.checkpoint = Math.floor(p.distance / 10);
      p.score = Math.floor((Math.min(49.9, p.distance) / 50) * 89999);
    } else if (kind === 'hotelhiccup') {
      if (w.time >= s.next || p.cpu) {
        if (Math.abs(c.x) > 0.4 || Math.abs(c.z) > 0.4) {
          s.selected = clamp(
            s.selected +
              (Math.abs(c.z) > 0.4 ? Math.sign(c.z) * 3 : Math.sign(c.x)),
            0,
            5,
          );
          if (!p.cpu) s.next = w.time + 0.18;
        }
      }
      if ((ap || (p.cpu && c.a)) && p.cooldown <= 0) {
        if (s.held < 0) s.held = s.selected;
        else {
          [s.grid[s.held], s.grid[s.selected]] = [
            s.grid[s.selected],
            s.grid[s.held],
          ];
          [s.rot[s.held], s.rot[s.selected]] = [
            s.rot[s.selected],
            s.rot[s.held],
          ];
          s.held = -1;
        }
        p.cooldown = 0.13;
      }
      if ((bp || (p.cpu && c.b)) && p.cooldown <= 0) {
        s.rot[s.selected] = (s.rot[s.selected] + 1) % 4;
        p.cooldown = 0.13;
      }
      const correct = s.grid.filter((n, j) => n === j && s.rot[j] === 0).length;
      p.score = correct * 10000;
      if (correct === 6) finished(w, p);
    } else if (kind === 'crumbleclock') {
      s.aim = clamp(s.aim + c.x * dt * 4, -4.7, 4.7);
      if ((ap || (p.cpu && c.a)) && p.cooldown <= 0) {
        if (p.y < 0.02) {
          p.vy = 6.4;
          p.cooldown = 0.16;
          s.fired = false;
        } else if (!s.fired) {
          add(w, 'ball', (i - 1.5) * 4.7 + s.aim, 5, {
            owner: i,
            vz: -12,
            vy: 5,
            y: p.y + 1,
            r: 0.2,
            life: 3,
          });
          s.fired = true;
          p.cooldown = 0.2;
        }
      }
      jump(p, false);
      p.x = (i - 1.5) * 4.7;
      p.z = 5;
      p.score = s.points;
    } else if (kind === 'picklepatrol') {
      movement(p, c, 5.6);
      bounds(p, 8, 5);
      if (ap && !s.fired && w.time < r.signalAt) {
        s.fired = true;
        s.falseStart = true;
        p.flash = 0.8;
      } else if (ap && !s.fired && w.time >= r.signalAt) {
        s.fired = true;
        const target = Math.round(p.x / 3) + 2,
          correct =
            target === r.signal &&
            Math.abs(p.z + 3) < 1.4 &&
            Math.abs(p.x - (target - 2) * 3) < 1.1;
        add(w, 'laser', p.x, p.z, {
          owner: i,
          y: 1,
          vy: 7,
          life: 0.25,
          r: 0.12,
        });
        if (correct) {
          s.points += r.claimed < 0 || r.claimedAt === w.tick ? 3 : 1;
          if (r.claimed < 0) {
            r.claimed = i;
            r.claimedAt = w.tick;
          }
          p.flash = 0.4;
        } else p.flash = 0.8;
      }
      p.score = s.points;
    } else if (kind === 'mangosluggers') {
      const { pitch, contact, cycle: t } = pitchAt(w.seed, w.time);
      if (ap && p.cooldown <= 0 && pitch < 30 && s.shotPitch !== pitch) {
        p.cooldown = 0.28;
        s.lift = w.time;
        s.shotPitch = pitch;
        if (Math.abs(t - contact) <= 0.13) {
          s.points += Math.abs(t - contact) <= 0.045 ? 3 : 1;
          p.flash = 0.35;
          add(w, 'homerun', (i - 1.5) * 4, 4, {
            vx: (i - 1.5) * 2,
            vz: -18,
            vy: 10,
            y: 1,
            r: 0.17,
            life: 2,
          });
        }
      }
      p.score = s.points;
    } else if (kind === 'geckograffiti') {
      mazeMove(p, c);
      if (c.b) s.lift = w.time + 0.3;
      if (ap && s.carrying < 0) {
        const relic = r.objects.find(
          (o) =>
            o.kind === 'relic' &&
            o.owner === p.team &&
            o.life > 0 &&
            Math.hypot(o.x - p.x, o.z - p.z) < 1.3,
        );
        if (relic) {
          s.carrying = relic.value;
          relic.life = 0;
          p.flash = 0.4;
        }
      }
    } else if (kind === 'returnsender') {
      movement(p, c, 6);
      p.x = clamp(p.x, p.team ? 6 : -10, p.team ? 10 : -6);
      p.z = clamp(p.z, -6.5, 6.5);
      if (ap && p.cooldown <= 0) {
        const target = r.objects
          .filter(
            (o) =>
              o.kind === 'parcel' &&
              Math.abs(o.z - p.z) < 0.8 &&
              Math.abs(o.x - p.x) < 2.4 &&
              Math.sign(o.vx) === (p.team ? 1 : -1),
          )
          .sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
        if (target) {
          target.vx = p.team ? -4.3 : 4.3;
          target.owner = i;
          p.flash = 0.2;
        }
        p.cooldown = 0.15;
      }
    } else if (kind === 'bubbletrouble') {
      movement(p, c, c.a && p.cooldown <= 0 ? 7.5 : 5);
      bounds(p, 10, 7);
      p.y = 1;
      for (const o of r.objects)
        if (o.life > 0 && Math.hypot(o.x - p.x, o.z - p.z) < o.r + 0.3) {
          if (o.kind === 'ring') {
            const eligible = w.actors
              .filter(
                (a) => a.alive && Math.hypot(o.x - a.x, o.z - a.z) < o.r + 0.3,
              )
              .sort(
                (a, b) =>
                  Math.hypot(o.x - a.x, o.z - a.z) -
                    Math.hypot(o.x - b.x, o.z - b.z) ||
                  randomAt(w.seed, o.id + w.actors.indexOf(a) * 131) -
                    randomAt(w.seed, o.id + w.actors.indexOf(b) * 131),
              );
            if (eligible[0] === p) {
              s.points += o.value;
              o.owner = i;
              o.life = 0;
              p.flash = 0.3;
            }
          } else if (o.kind === 'jelly' && p.flash <= 0) {
            s.points = Math.max(0, s.points - 1);
            p.z += 1;
            p.flash = 0.8;
          }
        }
      p.score = s.points;
    } else if (kind === 'pelicanpilots') {
      if (i % 2 === 0) {
        movement(p, c, p.stun > 0 ? 1 : c.a ? (c.b ? 2 : 5) : 2, 4);
        p.x = clamp(p.x, p.team ? 1 : -11, p.team ? 11 : -1);
        p.z = clamp(p.z, 2, 6);
        for (const o of r.objects)
          if (
            o.kind === 'crate' &&
            p.flash <= 0 &&
            Math.hypot(o.x - p.x, o.z - p.z) < 1.1
          ) {
            p.stun = 1.1;
            p.flash = 1.1;
          }
      } else {
        const boat = w.actors[i - 1];
        movement(p, c, 4);
        p.x = clamp(p.x, boat.x - 3, boat.x + 3);
        p.z = clamp(p.z, -7, boat.z - 2);
        p.y = clamp(p.y + (c.b ? 2 : c.a ? -1.8 : -c.z) * dt, 2, 6);
        if (boat.stun > 0) p.y = Math.max(2, p.y - dt * 3);
        for (const o of r.objects)
          if (
            o.kind === 'token' &&
            o.life > 0 &&
            Math.hypot(o.x - p.x, o.z - p.z) < 1.1 &&
            Math.abs(o.y - p.y) < 1.4
          ) {
            o.life = 0;
            r.teamPoints[p.team] += o.value;
            p.flash = 0.3;
          }
      }
    } else if (kind === 'skewergallery') {
      if (p.lives <= 0 && i === r.heat) return;
      movement(p, c, i === r.heat ? 5.6 : c.b ? 2 : 4.5);
      bounds(p, 10, 7);
      for (const [x, z] of [
        [-4, 0],
        [4, 0],
        [0, -4],
      ]) {
        const d = Math.hypot(p.x - x, p.z - z);
        if (d < 1.6) {
          p.x = x + ((p.x - x) / Math.max(0.1, d)) * 1.6;
          p.z = z + ((p.z - z) / Math.max(0.1, d)) * 1.6;
        }
      }
      if (i === r.heat) {
        s.points += dt;
        if (ap && p.cooldown <= 0) {
          p.x += c.x * 1.5;
          p.z += c.z * 1.5;
          p.cooldown = 1.4;
        }
      } else if (ap && p.cooldown <= 0) {
        add(w, 'water', p.x, p.z, {
          vx: Math.sin(p.face) * 10,
          vz: Math.cos(p.face) * 10,
          owner: i,
          life: 2,
          y: 0.8,
          r: 0.28,
        });
        p.cooldown = 0.48;
      }
      p.score = Math.floor(s.points);
    } else if (kind === 'boulderbuffet') {
      if (i === r.heat) {
        if (p.alive) {
          movement(p, c, c.b ? 1.7 : 3.2);
          p.x += r.lean.x * dt * (c.b ? 0.4 : 1);
          p.z += r.lean.z * dt * (c.b ? 0.4 : 1);
          if (Math.hypot(p.x, p.z) > 3.5) {
            p.alive = false;
            w.actors.forEach((a, j) => {
              if (j !== r.heat) r.seats[j].points += 3;
            });
          } else s.points += dt;
        }
      } else {
        movement(p, c, 3);
        const a = Math.atan2(p.z, p.x);
        p.x = Math.cos(a) * 8;
        p.z = Math.sin(a) * 8;
        if (ap && p.cooldown <= 0) {
          if (p.y <= 0.01) {
            p.vy = 7;
            p.cooldown = 0.18;
          } else {
            add(w, 'wave', p.x, p.z, {
              r: 0.2,
              value: 1 + p.y * 0.3,
              owner: i,
              life: 5,
            });
            p.y = 0;
            p.vy = 0;
            p.cooldown = 0.8;
          }
        }
        jump(p, false);
      }
      p.score = Math.floor(s.points);
    } else {
      movement(
        p,
        c,
        kind === 'crabtraffic' ? 4.9 : 5.6,
        kind === 'cannoncay' ? (c.b ? 12 : 3) : 10,
      );
      if (kind !== 'crabtraffic') bounds(p, 10, 7);
      jump(p, kind === 'tidetiles' && ap);
      if (kind === 'tidetiles') {
        const b = r.beast;
        const size = critterScale(w.time, driven);
        // A ridden critter is low enough to hop clean over.
        if (Math.hypot(p.x - b.x, p.z - b.z) < size + 0.3 && p.y < (driven ? 0.55 : 0.7) * size)
          out(w, p);
        for (let j = 0; j < 4; j++) {
          const x = (j % 2 ? 1 : -1) * 4,
            z = (j < 2 ? -1 : 1) * 3,
            t = (w.time + j * 0.9) % 5;
          if (t > 4.1 && Math.hypot(p.x - x, p.z - z) < 1.65 && p.y < 0.6)
            out(w, p);
        }
      }
      if (
        kind === 'crabtraffic' &&
        (Math.abs(p.x) > 11 || p.z > 7.5 || p.z < -7.5)
      )
        out(w, p);
      if (meta.policy === 'survival' && p.alive)
        p.score = Math.round(w.time * 100);
    }
  });
  for (const o of r.objects) {
    const oldZ = o.z;
    o.x += o.vx * dt;
    o.z += o.vz * dt;
    o.y += o.vy * dt;
    o.life -= dt;
    if (o.kind === 'ball') {
      o.vy -= 9 * dt;
      for (let row = 0; row < 3; row++) {
        const z = -1 - row * 2.1;
        if (oldZ > z && o.z <= z && o.y > 0.6 && o.y < 3.2) {
          const centers = Array.from(
            { length: 7 },
            (_, j) => -10 + j * 3.3 + Math.sin(w.time * 1.2 + row) * 1.7,
          );
          const hit = centers.findIndex(
            (x, j) =>
              Math.abs(x - o.x) < 0.8 && r.hoopBusy[row * 7 + j] <= w.time,
          );
          if (hit >= 0) {
            r.hoopBusy[row * 7 + hit] = w.time + 0.8;
            r.seats[o.owner].points += row === 1 ? 2 : 1;
            o.life = 0;
            w.actors[o.owner].flash = 0.4;
            break;
          }
        }
      }
    }
    if (o.kind === 'parcel' && Math.abs(o.x) > 10.5) {
      const team = o.x > 0 ? 1 : 0;
      if (r.shields.every((n) => n > 0)) {
        r.shields[team]--;
        r.teamPoints[1 - team]++;
        if (r.shields[team] === 0 && !w.endAt) w.endAt = w.time + 1;
      }
      o.life = 0;
    }
    if (o.kind === 'wave') {
      const old = o.r;
      o.r += 5 * dt;
      const distance = Math.hypot(o.x, o.z);
      if (old < distance && o.r >= distance) {
        r.lean.x += (-o.x / distance) * o.value * 2;
        r.lean.z += (-o.z / distance) * o.value * 2;
      }
    }
    if (o.kind === 'water') {
      if (
        [
          [-4, 0],
          [4, 0],
          [0, -4],
        ].some(([x, z]) => Math.hypot(o.x - x, o.z - z) < 1.5)
      )
        o.life = 0;
      const carrier = w.actors[r.heat];
      if (
        o.life > 0 &&
        carrier.lives > 0 &&
        Math.hypot(o.x - carrier.x, o.z - carrier.z) < 0.75
      ) {
        carrier.lives--;
        carrier.flash = 0.5;
        r.seats[o.owner].points += 3;
        o.life = 0;
      }
    }
    if (o.kind === 'snowball' || o.kind === 'crab')
      w.actors.forEach((p, i) => {
        if (
          !p.alive ||
          o.life <= 0 ||
          (driven && i === 0) ||
          Math.hypot(o.x - p.x, o.z - p.z) > o.r + 0.42
        )
          return;
        if (o.kind === 'snowball') {
          o.life = 0;
          // Showdown runners take two hits, with a moment of grace between.
          if (driven) {
            if (p.stun > 0) return;
            p.lives--;
            p.flash = 0.6;
            p.stun = 1.2;
            if (p.lives <= 0) out(w, p);
          } else out(w, p);
        } else {
          p.z += dt * (o.r > 0.8 ? 14 : 9);
          p.x += Math.sign(p.x - o.x) * dt * 2;
          p.flash = 0.1;
        }
      });
  }
  r.objects = r.objects.filter((o) => o.life > 0).slice(-180);
  r.lean.x *= 0.98;
  r.lean.z *= 0.98;
  if (kind === 'frostyfreight') {
    const gust = Math.floor(w.time / 7),
      active = w.time % 7 > 4.4 && w.time % 7 < 6.4;
    for (let team = 0; team < 2; team++) {
      const pair = w.actors.filter((p) => p.team === team);
      if (
        active &&
        r.gustTeams[team] !== gust &&
        pair.some((p) => !r.seats[w.actors.indexOf(p)].anchored)
      ) {
        r.gustTeams[team] = gust;
        const floor = Math.max(
          0,
          Math.floor(Math.min(...pair.map((p) => p.distance)) / 10) * 10,
        );
        pair.forEach((p) => {
          p.distance = floor;
          p.flash = 0.3;
        });
      }
      if (pair.every((p) => p.distance >= 50))
        pair.forEach((p) => finished(w, p));
      const score = Math.min(...pair.map((p) => p.score));
      pair.forEach((p) => (p.score = score));
    }
    r.lastGust = gust;
  }
  if (kind === 'geckograffiti')
    for (let team = 0; team < 2; team++) {
      const pair = w.actors.filter((p) => p.team === team),
        carrying = pair.filter(
          (p) => r.seats[w.actors.indexOf(p)].carrying >= 0,
        ).length;
      if (carrying === 2 && pair.every((p) => Math.hypot(p.x, p.z) < 2))
        pair.forEach((p) => finished(w, p));
      else
        pair.forEach(
          (p) =>
            (p.score =
              carrying * 30000 +
              Math.floor(
                Math.max(
                  0,
                  20 - pair.reduce((s, p) => s + Math.hypot(p.x, p.z), 0),
                ) * 500,
              )),
        );
    }
  if (kind === 'pelicanpilots' || kind === 'returnsender')
    w.actors.forEach((p) => (p.score = r.teamPoints[p.team]));
  if (
    [
      'crumbleclock',
      'skewergallery',
      'boulderbuffet',
      'bubbletrouble',
    ].includes(kind)
  )
    w.actors.forEach(
      (p, i) => (p.score = Math.floor(r.seats[i].points + 1e-7)),
    );
  if (
    meta.policy === 'survival' &&
    w.actors.filter((p) => p.alive).length <= 1 &&
    !w.endAt
  )
    w.endAt = w.time + 2;
  if (kind === 'prickleice' && w.actors.every((p) => !p.alive || p.finish))
    w.endAt = w.time;
  const soloHeld =
    kind === 'skewergallery' ? w.actors[0].lives > 0 : w.actors[0].alive;
  if (w.mode === '1v3' && meta.heats && !soloHeld && !w.endAt)
    w.endAt = w.time + 1.5;
  if (w.time >= w.duration || (w.endAt > 0 && w.time >= w.endAt)) {
    w.done = true;
    // The solo alien wins by keeping the beacon lit / staying on the saucer,
    // or, when driving the critter or sentries, by catching all three.
    if (w.mode === '1v3' && (meta.heats || driven)) {
      const soloWon = driven
        ? w.actors.slice(1).every((p) => !p.alive)
        : soloHeld;
      w.actors.forEach((p, i) => (p.score = (i === 0) === soloWon ? 1 : 0));
    } else if (meta.policy === 'survival')
      w.actors
        .filter((p) => p.alive)
        .forEach((p) => (p.score = 100000 + Math.round(w.time * 100)));
  }
}
export function remixReadout(w: Arena, id: string) {
  const r = w.remix!,
    i = Math.max(
      0,
      w.actors.findIndex((p) => p.id === id),
    ),
    p = w.actors[i],
    s = r.seats[i];
  if (soloDriven(w)) {
    const left = w.actors.slice(1).filter((q) => q.alive).length,
      clock = Math.max(0, Math.ceil(w.duration - w.time)),
      critter = w.kind === 'tidetiles';
    if (w.done) return { title: 'Showdown complete', detail: `${left} of 3 runners survived` };
    return i === 0
      ? {
          title: `YOU ${critter ? 'RIDE THE CRITTER' : 'COMMAND THE SENTRIES'} · ${left} left · ${clock}s`,
          detail: critter
            ? 'WASD steer · Space charge (recharges in 2s)'
            : 'WASD aim the reticle · Space throw from the glowing sentry',
        }
      : {
          title: `SURVIVE ${clock}s · ${left} of 3 still standing`,
          detail: critter
            ? 'Hop (Space) and keep moving — one survivor wins it for the team'
            : `Dodge the glowing sentry's aim · ${p.alive ? `${p.lives} hit${p.lives === 1 ? '' : 's'} left` : 'out'}`,
        };
  }
  if (w.kind === 'prickleice')
    return {
      title: `${Math.floor(p.distance)} / 240 m · Avalanche ${Math.max(0, Math.floor(p.distance - r.avalanche))} m behind`,
      detail: `${s.skiSpeed.toFixed(1)} m/s · A/D carve · Space poles · E brake`,
    };
  if (w.kind === 'lanternlurk')
    return {
      title: `Heat ${Math.min(3, 1 + Math.floor(w.time / 10))} / 3`,
      detail:
        s.stopped >= 0
          ? `Stopped ${s.stopped.toFixed(2)} m away`
          : 'Raise the flashlight before the beast reaches you',
    };
  if (w.kind === 'vinevault')
    return {
      title: `Leaf ${p.checkpoint} · Next ${leafSide(w.seed, p.checkpoint) > 0 ? 'RIGHT →' : '← LEFT'}`,
      detail: `Then ${leafSide(w.seed, p.checkpoint + 1) > 0 ? 'right' : 'left'} · Choose direction and jump`,
    };
  if (w.kind === 'picklepatrol')
    return {
      title:
        w.time < r.signalAt
          ? 'Wait for the beacon…'
          : `Shoot ${['● Circle', '▲ Triangle', '◆ Diamond', '■ Square', '★ Star'][r.signal]}`,
      detail: s.falseStart
        ? 'False start! Wait for the next signal.'
        : s.fired
          ? 'Cannon fired · wait for next signal'
          : 'Aim at the matching shape, then press Space',
    };
  if (w.kind === 'frostyfreight')
    return {
      title:
        w.time % 7 > 4.4 && w.time % 7 < 6.4
          ? 'BLIZZARD · HOLD E'
          : w.time % 7 > 3.5 && w.time % 7 < 4.4
            ? 'Wind rising · prepare to anchor'
            : 'Climb toward the next ledge',
      detail: 'Both partners must anchor during the gust',
    };
  if (w.kind === 'hotelhiccup')
    return {
      title: `${s.grid.filter((n, j) => n === j && s.rot[j] === 0).length} / 6 pieces correct`,
      detail:
        s.held >= 0
          ? 'Choose a destination and press Space to swap'
          : 'Arrows select · Space pick/swap · E rotate',
    };
  if (w.kind === 'mangrovemotors')
    return {
      title: `Gate ${Math.min(8, p.checkpoint + 1)} / 8`,
      detail: 'Cross the glowing numbered gates in order',
    };
  if (w.kind === 'mangosluggers')
    return {
      title:
        w.time >= 43.5
          ? 'All 30 pitches complete'
          : `Pitch ${Math.min(30, 1 + pitchAt(w.seed, w.time).pitch)} / 30 · ${['FAST', 'SLOW', 'CURVE'][pitchAt(w.seed, w.time).type]}`,
      detail:
        s.shotPitch === pitchAt(w.seed, w.time).pitch
          ? 'Swing used · watch the next wind-up'
          : 'One swing per pitch · contact 1 / perfect timing 3',
    };
  if (w.kind === 'returnsender')
    return {
      title: `Depot shields ${r.shields[0]} — ${r.shields[1]}`,
      detail: 'Cover your lanes · reverse parcels close to your switch',
    };
  if (remixInfo(w.kind)!.heats) {
    // Older saves can have heat=-1 until the first simulation step.
    const heat = Math.max(0, Math.min(w.actors.length - 1, r.heat));
    const solo = w.actors[heat];
    if (w.mode === '1v3')
      return {
        title: w.done
          ? 'Showdown complete'
          : solo?.id === id
            ? `YOU ARE SOLO · hold out ${Math.max(0, Math.ceil(w.duration - w.time))}s`
            : 'TEAM OF THREE · take the solo alien down',
        detail:
          w.kind === 'skewergallery'
            ? `Beacon ${solo?.lives ?? 3} / 3`
            : 'Waves knock the solo alien off the saucer',
      };
    return {
      title: w.done
        ? 'All heats complete'
        : `Heat ${heat + 1} / ${w.actors.length} · ${solo?.id === id ? 'YOU ARE SOLO' : 'YOU ARE ON THE TEAM'}`,
      detail:
        w.kind === 'skewergallery'
          ? `Beacon ${solo?.lives ?? 3} / 3`
          : 'Jump then splash; solo player counters the waves',
    };
  }
  return { title: remixInfo(w.kind)!.name, detail: remixInfo(w.kind)!.tip };
}
