import type { Arena, Runner, Control } from './simulation';
import { randomAt } from './simulation';
import { grandInfo, GrandKind } from './grand-catalog';
export type GObject = {
  id: number;
  kind: string;
  x: number;
  z: number;
  y: number;
  vx: number;
  vz: number;
  vy: number;
  r: number;
  life: number;
  owner: number;
  value: number;
  hp: number;
  tag: number;
  age: number;
};
export type GTile = {
  x: number;
  z: number;
  y: number;
  w: number;
  d: number;
  hp: number;
  tag: number;
  owner: number;
  value: number;
};
export type GSeat = {
  energy: number;
  held: number;
  banked: number;
  water: number;
  wobble: number;
  aim: number;
  ammo: number;
  reloadAt: number;
  boosts: number;
  selection: number;
  orientation: number;
  clock: number;
  memory: number[];
  grid: number[];
  coverage: number[];
  trace: { x: number; z: number }[];
  handles: { x: number; z: number }[];
  piece: number[];
};
export type GVehicle = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  vy: number;
  face: number;
  distance: number;
  speed: number;
  heat: number;
  lift: number;
  checkpoint: number;
  finish: number;
  cooldown: number;
};
export type GrandState = {
  objects: GObject[];
  tiles: GTile[];
  seats: GSeat[];
  vehicles: GVehicle[];
  serial: number;
  nextSpawn: number;
  phase: number;
  solo: number;
  target: number;
  teamScore: number[];
  data: number[];
  windX: number;
  windZ: number;
  monster: { x: number; z: number; face: number; at: number; target: number };
  ballContacts: number;
  ballTeam: number;
  lastHit: number;
};
const DT = 1 / 60,
  TAU = Math.PI * 2;
export const clamp = (v: number, a: number, b: number) =>
  Math.max(a, Math.min(b, v));
const rand = (w: Arena, n: number) => randomAt(w.seed, n);
const distance = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  Math.hypot(a.x - b.x, a.z - b.z);
export const lane = (i: number, width = 8) => (i - 1.5) * width;
const zero = (): Control => ({ x: 0, z: 0, a: false, b: false, seq: 0 });
const steer = (p: Runner, x: number, z: number) => {
  const d = Math.max(1, Math.hypot(x - p.x, z - p.z));
  return { ...zero(), x: (x - p.x) / d, z: (z - p.z) / d };
};
function object(w: Arena, o: Partial<GObject> & { kind: string }) {
  const g = w.grand!;
  if (g.objects.length >= 100) return;
  const value = {
    id: ++g.serial,
    x: 0,
    z: 0,
    y: 0,
    vx: 0,
    vz: 0,
    vy: 0,
    r: 0.45,
    life: 8,
    owner: -1,
    value: 1,
    hp: 1,
    tag: 0,
    age: 0,
    ...o,
  };
  g.objects.push(value);
  return value;
}
function tile(
  x: number,
  z: number,
  w = 3,
  d = w,
  y = 0,
  tag = 0,
  owner = -1,
  hp = 1,
  value = 1,
): GTile {
  return { x, z, w, d, y, tag, owner, hp, value };
}
function move(p: Runner, c: Control, speed = 5.8, grip = 13) {
  const d = Math.max(1, Math.hypot(c.x, c.z)),
    f = p.stun > 0 ? 0 : 1;
  p.vx += ((c.x / d) * speed * f - p.vx) * Math.min(1, DT * grip);
  p.vz += ((c.z / d) * speed * f - p.vz) * Math.min(1, DT * grip);
  p.x += p.vx * DT;
  p.z += p.vz * DT;
  if (Math.hypot(c.x, c.z) > 0.15) p.face = Math.atan2(c.x, c.z);
}
function gravity(p: Runner, press: boolean, power = 6.5) {
  if (press && p.y <= 0.015 && p.stun <= 0) {
    p.vy = power;
    p.jumps++;
  }
  p.vy -= 18 * DT;
  p.y += p.vy * DT;
  if (p.y < 0) {
    p.y = 0;
    p.vy = 0;
  }
}
function bounds(p: Runner, x = 7, z = x) {
  p.x = clamp(p.x, -x, x);
  p.z = clamp(p.z, -z, z);
}
function block(p: Runner, t: GTile) {
  if (t.hp <= 0 || p.y > t.y + 1) return;
  const dx = p.x - t.x,
    dz = p.z - t.z,
    hx = t.w / 2 + 0.35,
    hz = t.d / 2 + 0.35;
  if (Math.abs(dx) < hx && Math.abs(dz) < hz) {
    if (hx - Math.abs(dx) < hz - Math.abs(dz))
      p.x = t.x + Math.sign(dx || 1) * hx;
    else p.z = t.z + Math.sign(dz || 1) * hz;
  }
}
function hit(w: Arena, p: Runner, loss = 1) {
  if (p.flash > 0) return false;
  p.flash = 0.85;
  p.lives -= loss;
  p.stun = 0.18;
  if (p.lives <= 0) {
    p.alive = false;
    p.outAt = w.time;
    p.score = Math.round(w.time * 100);
  }
  return true;
}
function eliminate(w: Arena, p: Runner) {
  if (p.alive) {
    p.alive = false;
    p.outAt = w.time;
    p.score = Math.round(w.time * 100);
    p.flash = 0.7;
  }
}
function finish(w: Arena, p: Runner) {
  if (!p.finish) {
    p.finish = w.time;
    p.score = 100000 - Math.round(w.time * 100);
    if (!w.endAt) w.endAt = w.time + 5;
  }
}
function progress(w: Arena, p: Runner, amount: number) {
  if (!p.finish)
    p.score = Math.min(89999, Math.max(0, Math.floor(amount * 89999)));
}
function vehicle(): GVehicle {
  return {
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vz: 0,
    vy: 0,
    face: 0,
    distance: 0,
    speed: 0,
    heat: 0,
    lift: 0.6,
    checkpoint: 0,
    finish: 0,
    cooldown: 0,
  };
}
export function fossilOutline(seed: number) {
  return Array.from({ length: 40 }, (_, i) => {
    const a = (i / 40) * TAU,
      r = 2.1 + Math.sin(a * 3 + (seed % 5)) * 0.42;
    return { x: Math.cos(a) * r, z: Math.sin(a) * r * 0.8 };
  });
}
export function doughTarget(seed: number) {
  return Array.from({ length: 6 }, (_, i) => ({
    x: ((i % 3) - 1) * 1.2 + (randomAt(seed, i * 13) - 0.5) * 0.65,
    z: (i < 3 ? -1 : 1) * 0.9 + (randomAt(seed, i * 19 + 5) - 0.5) * 0.55,
  }));
}
export function startGrand(w: Arena) {
  w.grand = {
    objects: [],
    tiles: [],
    seats: w.actors.map(() => ({
      energy: 1,
      held: -1,
      banked: 0,
      water: 0,
      wobble: 0,
      aim: 0.5,
      ammo: 3,
      reloadAt: 0,
      boosts: 2,
      selection: 0,
      orientation: 0,
      clock: 0,
      memory: [],
      grid: [],
      coverage: [],
      trace: [],
      handles: [],
      piece: [],
    })),
    vehicles: [vehicle(), vehicle()],
    serial: 0,
    nextSpawn: 1,
    phase: -1,
    solo: 0,
    target: 0,
    teamScore: [0, 0],
    data: [],
    windX: 0,
    windZ: 0,
    monster: { x: 0, z: -5, face: 0, at: 1, target: 0 },
    ballContacts: 0,
    ballTeam: -1,
    lastHit: -1,
  };
  setupGrand(w);
}
function setupGrand(w: Arena, heat = false) {
  const g = w.grand!,
    kind = w.kind;
  g.objects = [];
  g.tiles = [];
  g.nextSpawn = w.time + 0.8;
  g.target = 0;
  w.actors.forEach((p, i) => {
    const angle = ((i + 0.5) * Math.PI) / 2;
    p.x = Math.cos(angle) * 4.2;
    p.z = Math.sin(angle) * 4.2;
    p.y = 0;
    p.vx = p.vz = p.vy = 0;
    p.alive = true;
    p.lives = ['prickleice', 'lanternlurk'].includes(kind) ? 2 : 3;
    p.flash = p.stun = p.cooldown = 0;
    p.finish = 0;
    p.charge = 0;
    p.gear = 0;
    p.rpm = 1;
    p.distance = 0;
    p.checkpoint = 0;
    p.brainAt = 0;
    const s = g.seats[i];
    s.energy = 1;
    s.held = -1;
    s.ammo = 3;
    s.boosts = kind === 'mangrovemotors' ? 2 : 3;
    s.clock = 0;
    p.tx = 0;
    p.tz = -3;
    if (!heat) {
      p.score = 0;
      s.memory = [];
      s.grid = [];
      s.coverage = [];
      s.trace = [];
      s.handles = [];
      s.piece = [];
    }
    if (
      [
        'vinevault',
        'mangosluggers',
        'hooklinelunch',
        'coconutcompass',
        'fossilfillet',
        'lostluggage',
        'doughdouble',
        'bentoblocks',
      ].includes(kind)
    ) {
      p.x = lane(i);
      p.z = kind === 'mangosluggers' ? 5 : kind === 'hooklinelunch' ? 6 : 0;
    }
    if (['mangrovemotors', 'bubbletrouble'].includes(kind)) {
      p.x = (i - 1.5) * 1.6;
      p.z = 0;
      p.gear = 1;
      p.face = Math.PI;
    }
    if (['frostyfreight', 'pelicanpilots', 'rubblerunners'].includes(kind)) {
      p.x = lane(p.team, 13) + 13;
      p.z = 3;
    }
    if (kind === 'pelicanpilots') g.vehicles[p.team].y = 3;
    if (kind === 'hotelhiccup') {
      p.x = (i - 1.5) * 1.8;
      p.z = 4;
      s.memory = Array(20).fill(-1);
    }
    if (kind === 'geckograffiti') {
      p.x = i % 2 ? 3 : -3;
      p.z = p.team === 0 ? 7 : -7;
      p.face = p.team === 0 ? Math.PI : 0;
    }
    if (kind === 'returnsender') {
      p.x = p.team === 0 ? -6 : 6;
      p.z = i % 2 ? 3 : -3;
    }
    if (kind === 'parasolpearls') {
      p.x = (i - 1.5) * 2;
      p.y = 35;
      p.z = 0;
    }
    if (kind === 'lostluggage') {
      s.memory = Array.from({ length: 9 }, (_, j) => (j + (w.seed % 9)) % 9);
      s.orientation = 0;
    }
    if (kind === 'doughdouble')
      s.handles = Array.from({ length: 6 }, (_, j) => ({
        x: ((j % 3) - 1) * 1.2,
        z: (j < 3 ? -1 : 1) * 0.9,
      }));
    if (kind === 'bentoblocks') {
      s.grid = Array(60).fill(0);
      s.piece = [
        2,
        -1,
        1 + Math.floor(rand(w, 1) * 4),
        1 + Math.floor(rand(w, 2) * 4),
        0,
      ];
      s.clock = 0;
    }
    if (kind === 'picnicpartition') {
      p.x = (p.team === 0 ? -8 : 8) + (i % 2 ? 2 : -2);
      p.z = 2;
    }
    if (['volleybuns', 'puckpicnic', 'pineapplestrikers'].includes(kind)) {
      p.x = i % 2 ? 2.5 : -2.5;
      p.z = p.team === 0 ? 5 : -5;
      p.face = p.team === 0 ? Math.PI : 0;
    }
    if (kind === 'paddleplunder') {
      g.vehicles[p.team].x = p.team === 0 ? -5 : 5;
      g.vehicles[p.team].z = 0;
    }
    if (heat) {
      const solo = i === g.solo;
      p.x = solo ? 0 : ((i % 3) - 1) * 4;
      p.z = solo
        ? kind === 'touchdowntiki'
          ? 8
          : kind === 'goalguava'
            ? -7
            : kind === 'crateescape'
              ? 0
              : 7
        : kind === 'touchdowntiki'
          ? i * 3 - 5
          : kind === 'goalguava'
            ? 4
            : -3 + (i % 2) * 4;
      if (kind === 'boulderbuffet') {
        p.z = solo ? -8 : 8;
        p.y = solo ? 5 : 0;
      }
      s.boosts = kind === 'boulderbuffet' ? 1 : 3;
    }
  });
  if (kind === 'skewergallery')
    g.tiles = [tile(0, -1, 3, 1), tile(0, -4, 3, 1)];
  if (kind === 'tidetiles') {
    g.tiles.push(tile(0, 0, 4.3, 4.3, 0, 0));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      g.tiles.push(tile(Math.cos(a) * 5, Math.sin(a) * 5, 4.3, 4.3, 0, i + 1));
    }
    w.actors.forEach((p, i) => {
      p.x = g.tiles[i + 1].x;
      p.z = g.tiles[i + 1].z;
    });
  }
  if (kind === 'prickleice')
    for (let j = 0; j < 3; j++)
      object(w, {
        kind: 'urchin',
        x: (j - 1) * 3,
        z: 0,
        vx: 2.8 * (j % 2 ? 1 : -1),
        vz: 2.2,
        r: j === 2 ? 0.75 : 0.45,
        life: 100,
        value: j === 2 ? 2 : 1,
      });
  if (kind === 'crumbleclock')
    for (let z = 0; z < 4; z++)
      for (let x = 0; x < 4; x++)
        g.tiles.push(
          tile(
            (x - 1.5) * 3.5,
            (z - 1.5) * 3.5,
            3.4,
            3.4,
            0,
            z * 4 + x,
            -1,
            24 + rand(w, z * 4 + x) * 18,
          ),
        );
  if (['lanternlurk', 'picklepatrol', 'raingarden'].includes(kind))
    for (const x of [-3, 3])
      for (const z of [-2.5, 2.5])
        g.tiles.push(
          tile(x, z, 1.6, 2.2, 0, 0, -1, kind === 'picklepatrol' ? 3 : 100),
        );
  if (kind === 'vinevault')
    for (let i = 0; i < 4; i++)
      for (let n = 0; n <= 20; n++)
        g.tiles.push(
          tile(
            lane(i) + (n === 0 ? 0 : n % 2 ? 1.25 : -1.25),
            0,
            2.7,
            2.4,
            n * 2,
            n,
            i,
          ),
        );
  if (['mangrovemotors', 'bubbletrouble', 'frostyfreight'].includes(kind))
    for (let j = 0; j < 12; j++) {
      const d = 16 + j * 13;
      g.tiles.push(tile(Math.sin(j * 1.8) * 3, -d, 2.6, 1.4, 0, j % 3));
    }
  if (kind === 'pelicanpilots')
    for (let j = 0; j < 14; j++)
      g.tiles.push(
        tile(
          Math.sin(j * 1.4) * 3.3,
          -(j + 1) * 10,
          4.4,
          1,
          3 + Math.sin(j * 0.8) * 1.6,
          j,
        ),
      );
  if (kind === 'hotelhiccup') {
    g.data = Array.from({ length: 4 }, (_, j) =>
      Math.floor(rand(w, j * 37) * 5),
    );
    for (let f = 0; f < 4; f++)
      for (let j = 0; j < 5; j++)
        g.tiles.push(tile((j - 2) * 3, -5, 1.7, 1, f * 3, j, f));
  }
  if (kind === 'geckograffiti')
    for (let j = 0; j < 12; j++)
      object(w, {
        kind: 'gecko',
        x: Math.sin(j * 2) * 5,
        z: Math.cos(j * 2) * 4,
        vx: Math.sin(j) * 1.5,
        vz: Math.cos(j) * 1.2,
        life: 100,
        r: j % 4 === 0 ? 0.75 : 0.45,
        value: j % 4 === 0 ? 3 : 1,
        hp: j % 4 === 0 ? 2 : 1,
        tag: 0,
      });
  if (kind === 'returnsender') g.data = Array(6).fill(0);
  if (kind === 'postcardpanic') {
    for (let j = 0; j < 15; j++)
      object(w, {
        kind: 'letter',
        x: (rand(w, j * 8) - 0.5) * 13,
        z: (rand(w, j * 9 + 1) - 0.5) * 11,
        life: 60,
        tag: j % 3,
        value: j % 3 ? 3 : 1,
      });
    for (let j = 0; j < 2; j++)
      object(w, {
        kind: 'mailcart',
        x: j ? 5 : -5,
        z: 0,
        life: 100,
        tag: j + 1,
        r: 1,
      });
  }
  if (kind === 'parasolpearls')
    for (let j = 0; j < 42; j++)
      object(w, {
        kind: j % 9 === 0 ? 'jelly' : 'pearl',
        x: Math.sin(j * 1.8) * 6,
        y: 2 + j * 0.75,
        z: 0,
        r: 0.5,
        life: 100,
        value: j % 5 === 0 ? 3 : 1,
      });
  if (kind === 'coconutcompass')
    for (let i = 0; i < 4; i++) {
      g.seats[i].coverage = Array(36).fill(0);
      for (let z = 0; z < 6; z++)
        for (let x = 0; x < 6; x++)
          g.tiles.push(
            tile(lane(i) + (x - 2.5), z - 2.5, 0.96, 0.96, 0, z * 6 + x, i),
          );
    }
  if (kind === 'fossilfillet')
    g.seats.forEach((s) => (s.coverage = Array(40).fill(0)));
  if (kind === 'lostluggage')
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 9; j++)
        object(w, {
          kind: 'case',
          x: lane(i) + (rand(w, i * 100 + j) * 5.2 - 2.6),
          z: rand(w, i * 100 + j + 70) * 3.5 + 1,
          life: 100,
          owner: i,
          tag: j,
          value: Math.floor(rand(w, j * 13 + 8) * 4),
        });
  if (kind === 'picnicpartition')
    for (let team = 0; team < 2; team++)
      for (let z = 0; z < 9; z++)
        for (let x = 0; x < 9; x++)
          if (Math.hypot(x - 4, z - 4) < 4.6)
            g.tiles.push(
              tile(
                (team === 0 ? -8 : 8) + (x - 4) * 1.2,
                (z - 4) * 1.2,
                1.16,
                1.16,
                0,
                0,
                team,
                Math.hypot(x - 4, z - 4) > 3.5 ? 1.5 : 0.65,
              ),
            );
  if (['volleybuns', 'puckpicnic', 'pineapplestrikers'].includes(kind)) {
    object(w, {
      kind: 'ball',
      y: kind === 'volleybuns' ? 3 : 0.3,
      z: 0,
      vy: kind === 'volleybuns' ? 3 : 0,
      vz: kind === 'volleybuns' ? 3 : 1.5,
      r: 0.38,
      life: 200,
    });
    if (kind === 'pineapplestrikers')
      for (let team = 0; team < 2; team++)
        for (let j = 0; j < 5; j++)
          g.tiles.push(
            tile((j - 2) * 2.4, team === 0 ? 8 : -8, 0.8, 0.8, 0, j, team),
          );
  }
  if (kind === 'paddleplunder')
    for (let j = 0; j < 32; j++)
      object(w, {
        kind: 'pearl',
        x: Math.sin(j * 2.4) * (3 + (j % 6)),
        z: Math.cos(j * 2.4) * (3 + (j % 6)),
        life: 100,
        r: 0.5,
      });
  if (kind === 'rubblerunners')
    for (let team = 0; team < 2; team++)
      for (let j = 0; j < 8; j++)
        for (let k = 0; k < 2; k++)
          g.tiles.push(
            tile(
              (team === 0 ? -8 : 8) + (k ? 1.2 : -1.2),
              -10 - j * 11,
              2.2,
              2,
              0,
              j % 3 === 0 ? 1 : 0,
              team,
              j % 3 === 0 ? 6 : 2,
            ),
          );
  if (kind === 'crateescape')
    for (const x of [-4, 4])
      for (const z of [-4, 4]) g.tiles.push(tile(x, z, 1.6, 1.6, 0, 0));
}
function inputs(w: Arena) {
  const g = w.grand!;
  return w.actors.map((p, i) => {
    p.flash = Math.max(0, p.flash - DT);
    p.stun = Math.max(0, p.stun - DT);
    p.cooldown = Math.max(0, p.cooldown - DT);
    if (p.cpu) {
      p.input = grandCPU(w, p, i);
      p.inputAt = w.time;
    } else if (w.time - p.inputAt > 0.55) {
      p.input = { ...p.input, x: 0, z: 0, a: false, b: false };
      p.seenAP = p.input.ap ?? p.seenAP;
      p.seenBP = p.input.bp ?? p.seenBP;
      p.seenAR = p.input.ar ?? p.seenAR;
    }
    const c = p.input;
    const a = c.ap !== undefined ? c.ap > p.seenAP : c.a && !p.wasA,
      b = c.bp !== undefined ? c.bp > p.seenBP : c.b && !p.wasB,
      release = c.ar !== undefined ? c.ar > p.seenAR : !c.a && p.wasA;
    if (a && c.ap !== undefined) p.seenAP = c.ap;
    if (b && c.bp !== undefined) p.seenBP = c.bp;
    if (release && c.ar !== undefined) p.seenAR = c.ar;
    return { c, a, b, release, releaseB: !c.b && p.wasB };
  });
}
export function stepGrand(w: Arena) {
  if (w.done) return;
  w.tick++;
  w.time = w.tick / 60;
  w.pulse = Math.max(0, w.pulse - DT * 2);
  const g = w.grand!,
    info = grandInfo(w.kind)!;
  if (info.heats) {
    const phase = Math.min(3, Math.floor(w.time / 13));
    if (phase !== g.phase) {
      g.phase = phase;
      g.solo = phase;
      setupGrand(w, true);
    }
    if (w.time % 13 > 12) {
      if (w.time >= w.duration) w.done = true;
      return;
    }
  }
  const controls = inputs(w);
  if (info.family === 'survival' || w.kind === 'picklepatrol')
    survival(w, controls);
  else if (info.family === 'course') course(w, controls);
  else if (info.family === 'target') targeting(w, controls);
  else if (info.family === 'collect') collecting(w, controls);
  else if (info.family === 'puzzle') puzzles(w, controls);
  else if (info.family === 'sport') sports(w, controls);
  else tactics(w, controls);
  if (
    [
      'tidetiles',
      'cannoncay',
      'prickleice',
      'crabtraffic',
      'crumbleclock',
      'lanternlurk',
      'picklepatrol',
      'sundaesummit',
      'postcardpanic',
      'raingarden',
      'coinquake',
      'touchdowntiki',
    ].includes(w.kind)
  ) {
    for (let i = 0; i < w.actors.length; i++)
      for (let j = i + 1; j < w.actors.length; j++) {
        const a = w.actors[i],
          b = w.actors[j];
        if (!a.alive || !b.alive || Math.abs(a.y - b.y) > 0.5) continue;
        let dx = a.x - b.x,
          dz = a.z - b.z,
          d = Math.hypot(dx, dz);
        if (d < 0.78) {
          if (d < 0.001) {
            dx = 0.01;
            dz = 0.01;
            d = Math.hypot(dx, dz);
          }
          const push = (0.78 - d) * 0.5;
          a.x += (dx / d) * push;
          a.z += (dz / d) * push;
          b.x -= (dx / d) * push;
          b.z -= (dz / d) * push;
        }
      }
  }
  for (const [i, p] of w.actors.entries()) {
    p.wasA = controls[i].c.a;
    p.wasB = controls[i].c.b;
    p.score = Math.round(clamp(p.score, 0, 200000));
  }
  g.objects = g.objects.filter((o) => o.life > 0).slice(-100);
  if (info.policy === 'survival') {
    for (const p of w.actors) if (p.alive) p.score = Math.round(w.time * 100);
    if (w.time > 3 && w.actors.filter((p) => p.alive).length <= 1 && !w.endAt)
      w.endAt = w.time + 1.5;
  }
  if (w.time >= w.duration || (w.endAt > 0 && w.time >= w.endAt)) {
    w.done = true;
    if (info.policy === 'survival')
      for (const p of w.actors)
        if (p.alive) p.score = 100000 + Math.round(w.time * 100);
  }
}
type Inputs = ReturnType<typeof inputs>;
function survival(w: Arena, cs: Inputs) {
  const g = w.grand!,
    kind = w.kind;
  if (kind === 'tidetiles') {
    let cycle = 5.5,
      round = 0,
      phase = w.time;
    while (phase >= cycle - 1e-7) {
      phase = Math.max(0, phase - cycle);
      round++;
      cycle = Math.max(4, 5.5 - round * 0.18);
    }
    g.target = Math.floor(rand(w, round * 37) * 7);
    g.tiles.forEach(
      (t, i) => (t.hp = phase < cycle - 1.3 || i === g.target ? 1 : 0),
    );
  }
  if (kind === 'cannoncay' && w.time >= g.nextSpawn) {
    const a = rand(w, w.tick) * TAU,
      r = rand(w, w.tick + 3) * 4.5;
    object(w, {
      kind: 'cannonball',
      x: Math.sin(a) * r,
      z: Math.cos(a) * r,
      y: 9,
      vy: -10,
      life: 0.9,
      r: 2.4,
    });
    g.nextSpawn = w.time + Math.max(0.65, 1.9 - w.time * 0.02);
  }
  if (kind === 'crabtraffic' && w.time >= g.nextSpawn) {
    const gap = Math.floor(rand(w, w.tick) * 5);
    for (let j = 0; j < 5; j++)
      if (j !== gap)
        object(w, {
          kind: 'crab',
          x: 9 + j * 0.35,
          z: (j - 2) * 2.1,
          vx: -3.5 - w.time * 0.035,
          r: j === gap + 1 ? 1.05 : 0.62,
          value: j === gap + 1 ? 2 : 1,
          life: 6,
        });
    g.nextSpawn = w.time + 1.8;
  }
  if (
    kind === 'prickleice' &&
    w.time > 12 &&
    g.objects.length < 5 &&
    w.time >= g.nextSpawn
  ) {
    object(w, {
      kind: 'urchin',
      x: 0,
      z: -5,
      vx: 3.5,
      vz: 2.3,
      r: 0.6,
      life: 100,
    });
    g.nextSpawn = w.time + 10;
  }
  if (kind === 'crumbleclock')
    for (const t of g.tiles) t.hp = Math.max(0, t.hp - DT * 0.45);
  if (kind === 'lanternlurk') {
    const m = g.monster;
    const targets = w.actors.filter((p, i) => p.alive && !cs[i].c.b),
      pool = targets.length ? targets : w.actors.filter((p) => p.alive);
    const target = pool.sort((a, b) => distance(a, m) - distance(b, m))[0];
    if (target) {
      const dx = target.x - m.x,
        dz = target.z - m.z,
        phase = w.time - m.at;
      if (phase > 2.3) {
        m.at = w.time;
        m.face = Math.atan2(dx, dz);
        m.target = w.actors.indexOf(target);
      } else if (phase < 1.2) {
        const d = Math.max(0.1, Math.hypot(dx, dz));
        m.x += (dx / d) * DT * (targets.length ? 2.3 : 1.1);
        m.z += (dz / d) * DT * (targets.length ? 2.3 : 1.1);
        m.face = Math.atan2(dx, dz);
      } else if (phase > 1.95) {
        m.x += Math.sin(m.face) * DT * 7;
        m.z += Math.cos(m.face) * DT * 7;
      }
      m.x = clamp(m.x, -6, 6);
      m.z = clamp(m.z, -6, 6);
    }
  }
  w.actors.forEach((p, i) => {
    if (!p.alive) return;
    const { c, a, b } = cs[i],
      s = g.seats[i];
    move(
      p,
      c,
      c.b ? 2.8 : kind === 'prickleice' ? 7 : 5.8,
      kind === 'prickleice' ? 2.2 : kind === 'cannoncay' ? 3 : 12,
    );
    gravity(p, a);
    if (kind === 'prickleice' && b && p.cooldown <= 0) {
      p.vx *= 0.15;
      p.vz *= 0.15;
      p.cooldown = 1.2;
    }
    if (kind === 'cannoncay') {
      p.x += g.windX * DT * (c.b ? 0.3 : 1);
      p.z += g.windZ * DT * (c.b ? 0.3 : 1);
      if (Math.hypot(p.x, p.z) > 6.2 && p.y < 0.3) eliminate(w, p);
    } else if (kind === 'tidetiles') {
      const safe = g.tiles.some(
        (t) => t.hp > 0 && Math.hypot(p.x - t.x, p.z - t.z) < 2.22,
      );
      if (!safe && p.y < 0.02) eliminate(w, p);
      if (b && p.cooldown <= 0) {
        p.cooldown = 1.5;
        for (const o of w.actors)
          if (o !== p && o.y < 0.15 && distance(p, o) < 2) o.stun = 0.25;
      }
    } else if (kind === 'crumbleclock') {
      const t = g.tiles.find(
        (t) => Math.abs(t.x - p.x) < 1.75 && Math.abs(t.z - p.z) < 1.75,
      );
      if (p.y < 0.02) {
        if (!t || t.hp <= 0) eliminate(w, p);
        else t.hp = Math.max(0, t.hp - DT * 1.6);
      }
      if (b && p.cooldown <= 0) {
        p.cooldown = 1;
        for (const o of w.actors)
          if (o !== p && distance(p, o) < 1.7) {
            o.vx += Math.sin(p.face) * 12;
            o.vz += Math.cos(p.face) * 12;
          }
      }
    } else if (kind === 'crabtraffic') {
      if (Math.abs(p.x) > 8 || Math.abs(p.z) > 5.8) eliminate(w, p);
    } else {
      bounds(p, 7.5);
      for (const t of g.tiles) block(p, t);
    }
    if (kind === 'lanternlurk') {
      const m = g.monster,
        phase = w.time - m.at,
        dx = p.x - m.x,
        dz = p.z - m.z,
        d = Math.hypot(dx, dz),
        dot =
          (dx * Math.sin(m.face) + dz * Math.cos(m.face)) / Math.max(0.1, d);
      const covered = g.tiles.some((t) => {
        const dx = p.x - m.x,
          dz = p.z - m.z,
          len = dx * dx + dz * dz,
          u = clamp(
            ((t.x - m.x) * dx + (t.z - m.z) * dz) / Math.max(0.01, len),
            0,
            1,
          );
        return (
          u > 0 &&
          u < 1 &&
          Math.abs(m.x + u * dx - t.x) < t.w / 2 + 0.1 &&
          Math.abs(m.z + u * dz - t.z) < t.d / 2 + 0.1
        );
      });
      if (!covered && phase > 1.95 && (d < 1.1 || (d < 4.8 && dot > 0.85)))
        hit(w, p);
    }
    if (kind === 'picklepatrol') {
      if (s.ammo === 0 && w.time >= s.reloadAt) s.ammo = 3;
      if (a && p.cooldown <= 0 && s.ammo > 0) {
        p.cooldown = 0.65;
        s.ammo--;
        if (s.ammo === 0) s.reloadAt = w.time + 1.4;
        object(w, {
          kind: 'bolt',
          owner: i,
          x: p.x + Math.sin(p.face) * 0.8,
          z: p.z + Math.cos(p.face) * 0.8,
          y: 0.7,
          vx: Math.sin(p.face) * 12,
          vz: Math.cos(p.face) * 12,
          life: 3,
          r: 0.25,
          tag: 1,
        });
      }
      if (c.b) {
        p.x -= p.vx * DT;
        p.z -= p.vz * DT;
      }
    }
  });
  for (const o of g.objects) {
    o.age += DT;
    o.life -= DT;
    o.x += o.vx * DT;
    o.z += o.vz * DT;
    o.y += o.vy * DT;
    if (o.kind === 'cannonball' && o.life <= 0) {
      w.pulse = 1;
      g.windX = o.x * 0.32;
      g.windZ = o.z * 0.32;
      for (const [i, p] of w.actors.entries())
        if (p.alive) {
          const d = distance(p, o);
          if (d < 3) {
            const f = (cs[i].c.b ? 0.35 : 1) * (p.y > 0.5 ? 0.5 : 1);
            p.vx += ((p.x - o.x) / Math.max(0.3, d)) * 15 * f;
            p.vz += ((p.z - o.z) / Math.max(0.3, d)) * 15 * f;
          }
        }
    }
    if (o.kind === 'urchin') {
      if (Math.abs(o.x) > 6.7) {
        o.x = clamp(o.x, -6.7, 6.7);
        o.vx *= -1;
      }
      if (Math.abs(o.z) > 6.7) {
        o.z = clamp(o.z, -6.7, 6.7);
        o.vz *= -1;
      }
      for (const p of w.actors)
        if (
          p.alive &&
          distance(p, o) < o.r + 0.4 &&
          (p.y < 0.75 || o.value === 2)
        )
          hit(w, p);
    }
    if (o.kind === 'crab')
      for (const [i, p] of w.actors.entries())
        if (
          p.alive &&
          distance(p, o) < o.r + 0.45 &&
          (p.y < 0.9 || o.value === 2)
        ) {
          p.x -= DT * 8 * (cs[i].c.b ? 0.28 : 1);
          p.vx -= DT * 5;
        }
    if (o.kind === 'bolt') {
      if (Math.abs(o.x) > 7.6 || Math.abs(o.z) > 7.6) {
        if (o.tag-- <= 0) o.life = 0;
        else {
          if (Math.abs(o.x) > 7.6) o.vx *= -1;
          if (Math.abs(o.z) > 7.6) o.vz *= -1;
          o.x = clamp(o.x, -7.6, 7.6);
          o.z = clamp(o.z, -7.6, 7.6);
        }
      }
      for (const t of g.tiles)
        if (
          t.hp > 0 &&
          Math.abs(o.x - t.x) < t.w / 2 + 0.2 &&
          Math.abs(o.z - t.z) < t.d / 2 + 0.2
        ) {
          t.hp--;
          o.life = 0;
          break;
        }
      if (o.life > 0)
        for (const [i, p] of w.actors.entries())
          if (i !== o.owner && p.alive && distance(p, o) < 0.65 && hit(w, p)) {
            o.life = 0;
            break;
          }
    }
  }
  g.windX *= 0.992;
  g.windZ *= 0.992;
}
function course(w: Arena, cs: Inputs) {
  const g = w.grand!,
    kind = w.kind;
  if (['frostyfreight', 'pelicanpilots'].includes(kind)) {
    for (let team = 0; team < 2; team++) {
      const v = g.vehicles[team],
        driver = cs[team * 2],
        rear = cs[team * 2 + 1];
      if (v.finish) continue;
      v.cooldown = Math.max(0, v.cooldown - DT);
      if (kind === 'frostyfreight') {
        v.speed =
          v.cooldown > 0
            ? 2
            : driver.c.b || rear.c.b
              ? 4
              : 8 + (driver.c.a ? 3 : 0);
        v.x +=
          (driver.c.x * 4 +
            rear.c.x * 1.8 +
            Math.sin(v.distance * 0.07) * 1.2) *
          DT;
        v.x = clamp(v.x, -5, 5);
        if (rear.a && v.y <= 0.02) {
          v.vy = 5;
          w.actors[team * 2 + 1].jumps++;
        }
        v.vy -= 18 * DT;
        v.y = Math.max(0, v.y + v.vy * DT);
        const old = v.distance;
        v.distance += v.speed * DT;
        for (const t of g.tiles)
          if (
            old < -t.z &&
            v.distance >= -t.z &&
            Math.abs(v.x - t.x) < 1.7 &&
            v.y < 0.6
          )
            v.cooldown = 1.2;
        v.checkpoint = Math.floor(v.distance / 20);
      } else {
        v.heat = clamp(
          v.heat + (rear.c.a ? 0.3 : -0.45) * DT - (rear.b ? 0.25 : 0),
          0,
          1.2,
        );
        v.lift = clamp(
          v.lift +
            (rear.c.a && v.heat < 1 ? 0.42 : -0.22) * DT -
            (rear.b ? 0.12 : 0),
          0,
          1,
        );
        v.y = clamp(
          v.y + (-driver.c.z * 2 - rear.c.z * 0.4 + (v.lift - 0.5) * 2) * DT,
          0.3,
          7,
        );
        v.x = clamp(v.x + driver.c.x * 4 * DT, -6, 6);
        v.speed = driver.c.b ? 3 : 7 + (driver.c.a && v.lift > 0.3 ? 2 : 0);
        v.distance += v.speed * DT;
        const target = g.tiles[Math.min(13, v.checkpoint)];
        if (v.distance >= -target.z) {
          if (Math.hypot(v.x - target.x, v.y - target.y) < 2.3) v.checkpoint++;
          else {
            v.distance = Math.max(0, v.checkpoint * 10);
            v.x += (target.x - v.x) * 0.4;
            v.y += (target.y - v.y) * 0.4;
            v.cooldown = 0.4;
          }
        }
      }
      const total = kind === 'frostyfreight' ? 160 : 140;
      for (let j = 0; j < 2; j++) {
        const p = w.actors[team * 2 + j];
        p.x = (team === 0 ? -8 : 8) + v.x + (j ? -0.45 : 0.45);
        p.z = -v.distance;
        p.y = v.y + 0.4;
        p.distance = v.distance;
        p.face = Math.PI;
        p.gear = v.checkpoint;
        progress(w, p, v.distance / total);
        if (
          (kind === 'frostyfreight' && v.distance >= total) ||
          (kind === 'pelicanpilots' && v.checkpoint >= 14)
        ) {
          finish(w, p);
          v.finish = p.finish;
        }
      }
    }
    return;
  }
  w.actors.forEach((p, i) => {
    if (p.finish) return;
    const { c, a, b } = cs[i],
      s = g.seats[i];
    if (kind === 'vinevault') {
      const before = p.y;
      if (a && p.stun <= 0) {
        const leaf = g.tiles.find(
          (t) =>
            t.owner === i &&
            Math.abs(t.y - p.y) < 0.08 &&
            Math.abs(t.x - p.x) < 1.5,
        );
        if (leaf) {
          p.vy = 7.1;
          p.jumps++;
        }
      }
      p.vx += (c.x * 5 - p.vx) * DT * 12;
      p.x = clamp(p.x + p.vx * DT, lane(i) - 3.2, lane(i) + 3.2);
      p.vy -= 10.5 * DT;
      if (c.b && s.energy > 0) {
        p.vy = Math.max(-1, p.vy);
        s.energy = Math.max(0, s.energy - DT * 0.4);
      } else s.energy = Math.min(1, s.energy + DT * 0.2);
      p.y += p.vy * DT;
      if (p.vy < 0) {
        const leaf = g.tiles
          .filter(
            (t) =>
              t.owner === i &&
              t.y <= before + 0.04 &&
              t.y >= p.y &&
              Math.abs(t.x - p.x) < 1.4,
          )
          .sort((a, b) => b.y - a.y)[0];
        if (leaf) {
          p.y = leaf.y;
          p.vy = 0;
          p.checkpoint = Math.max(p.checkpoint, leaf.tag);
        }
      }
      if (p.y < Math.floor(p.checkpoint / 4) * 8 - 3 || p.y < 0) {
        const cp = Math.floor(p.checkpoint / 4) * 4;
        p.checkpoint = cp;
        p.y = cp * 2;
        p.x = lane(i) + (cp === 0 ? 0 : cp % 2 ? 1.25 : -1.25);
        p.vy = 0;
        p.stun = 0.5;
      }
      p.distance = Math.max(p.distance, p.checkpoint * 2);
      progress(w, p, p.distance / 40);
      if (p.checkpoint >= 20) finish(w, p);
    } else if (kind === 'hotelhiccup') {
      move(p, c, 5.8);
      bounds(p, 7, 5.5);
      p.y = p.gear * 3;
      const door = g.tiles
        .filter((t) => t.owner === p.gear)
        .sort((a, b) => distance(p, a) - distance(p, b))[0];
      if (b && door && distance(p, door) < 1.3) s.selection = door.tag;
      if (a && door && distance(p, door) < 1.4 && p.cooldown <= 0) {
        p.cooldown = 0.5;
        const level = p.gear,
          correct = g.data[level] === door.tag;
        s.memory[level * 5 + door.tag] = correct ? 1 : 0;
        if (correct) {
          for (const [j, other] of w.actors.entries())
            if (other.gear === level)
              g.seats[j].memory[level * 5 + door.tag] = 1;
          p.gear++;
          p.z = 4;
          p.x = (i - 1.5) * 1.3;
        } else {
          p.z = 3;
          p.flash = 0.3;
        }
      }
      progress(w, p, p.gear / 4);
      if (p.gear >= 4) finish(w, p);
    } else {
      if (a && kind === 'mangrovemotors') p.gear = Math.min(3, p.gear + 1);
      if (b && kind === 'mangrovemotors' && s.boosts > 0) {
        s.boosts--;
        p.gear = 1;
      }
      const old = p.distance;
      const speed =
        kind === 'mangrovemotors'
          ? p.stun > 0
            ? 2
            : 5 + p.gear * 2
          : Math.max(0.2, -c.z) * (c.a && s.energy > 0 ? 9 : 6);
      if (kind === 'bubbletrouble') {
        s.energy = clamp(s.energy + (c.a ? -0.32 : 0.22) * DT, 0, 1);
        p.rpm = clamp(p.rpm + (c.b ? -0.7 : 0.9) * DT, 0, 1);
        p.y = c.b && p.rpm > 0 ? -0.8 : 0;
      }
      p.distance += speed * DT;
      if (kind === 'mangrovemotors' && Math.abs(p.x) > 4.5)
        p.distance -= speed * DT * 0.55;
      p.x = clamp(p.x + c.x * 5 * DT, -5.5, 5.5);
      p.z = -p.distance;
      for (const t of g.tiles)
        if (
          old < -t.z &&
          p.distance >= -t.z &&
          Math.abs(p.x - t.x) < 1.8 &&
          !(
            kind === 'bubbletrouble' && (t.tag === 0 ? p.y < -0.5 : p.y >= -0.5)
          )
        ) {
          p.stun = 0.9;
          p.flash = 0.6;
          p.gear = Math.max(1, p.gear - 1);
          p.distance = Math.max(0, p.distance - 2);
        }
      p.checkpoint = Math.floor(p.distance / 20);
      progress(w, p, p.distance / (kind === 'mangrovemotors' ? 180 : 120));
      if (p.distance >= (kind === 'mangrovemotors' ? 180 : 120)) finish(w, p);
    }
  });
}
function targeting(w: Arena, cs: Inputs) {
  const g = w.grand!,
    kind = w.kind;
  if (kind === 'mangosluggers' && w.time >= g.nextSpawn && g.target < 20) {
    const pitch = g.target++;
    for (let i = 0; i < 4; i++)
      object(w, {
        kind: 'pitch',
        owner: i,
        x: lane(i) + (rand(w, pitch * 13) - 0.5) * 2.8,
        z: -8,
        y: 1,
        vz: 8 + rand(w, pitch * 29 + 2) * 3,
        life: 5,
        r: 0.24,
        tag: 0,
      });
    g.nextSpawn = w.time + 1.45;
  }
  if (kind === 'returnsender' && w.time >= g.nextSpawn) {
    const row = Math.floor(rand(w, w.tick) * 6);
    object(w, { kind: 'parcel', x: 0, z: (row - 2.5) * 2, tag: row, life: 12 });
    g.nextSpawn = w.time + 0.7;
  }
  if (kind === 'skewergallery') {
    if (!g.tiles.length) g.tiles = [tile(0, -1, 3, 1), tile(0, -4, 3, 1)];
    g.tiles.forEach(
      (t, j) => (t.x = Math.sin(w.time * (0.8 + j * 0.2) + j * 2) * 4),
    );
  }
  w.actors.forEach((p, i) => {
    const { c, a, b, release } = cs[i],
      s = g.seats[i];
    if (!p.alive) return;
    if (kind === 'mangosluggers') {
      p.x = clamp(p.x + c.x * DT * 4, lane(i) - 2.3, lane(i) + 2.3);
      s.aim = clamp(s.aim - c.z * DT, 0, 1);
      if ((a || b) && p.cooldown <= 0) {
        p.cooldown = 0.42;
        p.jumps++;
        for (const o of g.objects)
          if (
            o.kind === 'pitch' &&
            o.owner === i &&
            o.tag === 0 &&
            Math.abs(o.z - 5) < 1.2 &&
            Math.abs(o.x - p.x) < 1.4
          ) {
            const timing = Math.max(0, 1 - Math.abs(o.z - 5) / 1.25);
            o.tag = 1;
            o.vz = -(b ? 5 : 9 + timing * 12);
            o.vy = b ? 3 : 6 + s.aim * 6;
            o.vx = (o.x - p.x) * 3;
            o.life = 6;
            break;
          }
      }
    } else if (kind === 'geckograffiti') {
      p.x = clamp(p.x + c.x * DT * 4, -6, 6);
      s.aim = clamp(s.aim + c.z * DT, -1, 1);
      p.face = (p.team === 0 ? Math.PI : 0) + s.aim * 0.9;
      if (b) s.selection = 1 - s.selection;
      if (a && p.cooldown <= 0) {
        p.cooldown = s.selection ? 0.75 : 0.42;
        const speed = s.selection ? 6 : 10;
        object(w, {
          kind: 'paintshot',
          owner: p.team,
          x: p.x,
          z: p.z,
          y: 0.55,
          vx: Math.sin(p.face) * speed,
          vz: Math.cos(p.face) * speed,
          r: s.selection ? 0.55 : 0.22,
          life: 3,
        });
      }
    } else if (kind === 'skewergallery') {
      if (i === g.solo) {
        p.tx = clamp(p.tx + c.x * DT * 6, -6.5, 6.5);
        p.tz = clamp(p.tz + c.z * DT * 6, -6, 2);
        p.face = Math.atan2(p.tx - p.x, p.tz - p.z);
        if (a && p.cooldown <= 0) {
          p.cooldown = c.b ? 0.65 : 0.45;
          object(w, {
            kind: 'skewer',
            owner: i,
            x: p.x,
            z: p.z,
            y: 0.7,
            vx: Math.sin(p.face) * 13,
            vz: Math.cos(p.face) * 13,
            r: 0.23,
            life: 2,
          });
        }
      } else {
        move(p, c, c.b ? 3 : 5.4);
        p.x = clamp(p.x, -6.6, 6.6);
        p.z = clamp(p.z, -6, 2);
        for (const t of g.tiles) block(p, t);
        if (a && p.cooldown <= 0) {
          p.vx += c.x * 12;
          p.vz += c.z * 12;
          p.cooldown = 2;
        }
        const tick = Math.floor((w.time % 13) / 3);
        if (tick > s.clock) {
          p.score += tick - s.clock;
          s.clock = tick;
        }
      }
    } else if (kind === 'boulderbuffet') {
      if (i === g.solo) {
        p.x = clamp(p.x + c.x * DT * 4, -6, 6);
        if (c.a) p.charge = Math.min(1.4, p.charge + DT);
        if ((release && p.charge > 0.05) || (b && s.boosts > 0)) {
          if (b) s.boosts--;
          object(w, {
            kind: 'melon',
            owner: i,
            x: p.x,
            z: -7,
            y: 5,
            vx: c.x * 3,
            vz: 5 + p.charge * 4,
            r: b ? 0.95 : 0.6,
            life: 6,
            value: b ? 2 : 1,
          });
          p.charge = 0;
        }
      } else {
        const ground = (8 - p.z) * 0.31;
        move(p, c, c.b ? 2.5 : 5);
        p.x = clamp(p.x, -6, 6);
        p.z = clamp(p.z, -7.5, 8);
        if (a && p.y <= ground + 0.1) {
          p.vy = 6.8;
          p.jumps++;
        }
        p.vy -= 18 * DT;
        p.y = Math.max((8 - p.z) * 0.31, p.y + p.vy * DT);
        const level = Math.max(0, Math.floor((8 - p.z) / 3));
        if (level > p.checkpoint) {
          p.score += level - p.checkpoint;
          p.checkpoint = level;
        }
        if (p.z < -7) {
          p.z = 8;
          p.y = 0;
          p.checkpoint = 0;
        }
      }
    } else if (kind === 'returnsender') {
      move(p, c);
      p.x = clamp(p.x, p.team === 0 ? -7 : -0 + 3, p.team === 0 ? -3 : 7);
      p.z = clamp(p.z, -5.7, 5.7);
      const row = Math.round(p.z / 2 + 2.5),
        switchX = p.team === 0 ? -5 : 5;
      if (
        row >= 0 &&
        row < 6 &&
        Math.hypot(p.x - switchX, p.z - (row - 2.5) * 2) < 1.3 &&
        p.cooldown <= 0 &&
        (a || b)
      ) {
        const locked = g.data[row + 12] ?? 0;
        if (locked < w.time || g.data[row] === (p.team === 0 ? 1 : -1)) {
          g.data[row] = p.team === 0 ? 1 : -1;
          g.data[row + 6] = w.time + 1.2;
          if (b) g.data[row + 12] = w.time + 0.6;
          p.cooldown = b ? 3 : 0.25;
        }
      }
    }
  });
  for (const o of g.objects) {
    o.age += DT;
    o.life -= DT;
    if (o.kind === 'parcel') {
      const row = o.tag,
        active = (g.data[row + 6] ?? 0) > w.time,
        dir = active ? g.data[row] : row % 2 ? 1 : -1;
      o.x += dir * 3.1 * DT;
      if (Math.abs(o.x) > 8) {
        g.teamScore[o.x > 0 ? 0 : 1]++;
        o.life = 0;
        w.pulse = 0.5;
      }
      continue;
    }
    if (o.kind === 'gecko') {
      o.x += o.vx * DT;
      o.z += o.vz * DT;
      if (Math.abs(o.x) > 5.8) o.vx *= -1;
      if (Math.abs(o.z) > 4.8) o.vz *= -1;
      continue;
    }
    o.x += o.vx * DT;
    o.z += o.vz * DT;
    if (o.kind === 'pitch') {
      if (o.tag === 1) {
        o.vy -= 8 * DT;
        o.y += o.vy * DT;
        if (o.y < 0.15) {
          const d = Math.hypot(o.x - lane(o.owner), o.z - 5);
          w.actors[o.owner].score += d > 19 ? 5 : d > 11 ? 3 : 1;
          o.life = 0;
          w.actors[o.owner].flash = 0.2;
        }
      } else if (o.z > 7) o.life = 0;
    }
    if (o.kind === 'paintshot') {
      for (const t of g.objects)
        if (t.kind === 'gecko' && distance(t, o) < t.r + o.r) {
          if (t.tag === o.owner) t.hp--;
          else {
            t.tag = o.owner;
            t.hp = t.value === 3 ? 1 : 0;
          }
          if (t.hp <= 0) {
            t.owner = o.owner;
            t.hp = t.value === 3 ? 2 : 1;
          }
          o.life = 0;
          break;
        }
    }
    if (o.kind === 'skewer') {
      if (
        g.tiles.some(
          (t) => Math.abs(t.x - o.x) < t.w / 2 && Math.abs(t.z - o.z) < 0.65,
        )
      )
        o.life = 0;
      if (o.life > 0)
        for (const [i, p] of w.actors.entries())
          if (i !== g.solo && p.alive && distance(o, p) < 0.65) {
            p.alive = false;
            w.actors[g.solo].score += 4;
            o.life = 0;
            p.flash = 0.5;
            break;
          }
    }
    if (o.kind === 'melon') {
      o.vz += DT * 0.8;
      o.y = (8 - o.z) * 0.31 + 0.6;
      for (const [i, p] of w.actors.entries())
        if (
          i !== g.solo &&
          distance(o, p) < o.r + 0.45 &&
          p.y < (8 - p.z) * 0.31 + 1 &&
          p.flash <= 0
        ) {
          p.z = Math.min(8, p.z + (cs[i].c.b ? 1 : 2.5));
          p.flash = 0.8;
          w.actors[g.solo].score += 2;
        }
      if (o.z > 9) o.life = 0;
    }
  }
  if (kind === 'geckograffiti') {
    g.teamScore = [0, 1].map((team) =>
      g.objects
        .filter((o) => o.kind === 'gecko' && o.owner === team)
        .reduce((v, o) => v + o.value, 0),
    );
  }
  if (kind === 'geckograffiti' || kind === 'returnsender')
    w.actors.forEach((p) => (p.score = g.teamScore[p.team]));
}
function collecting(w: Arena, cs: Inputs) {
  const g = w.grand!,
    kind = w.kind;
  if (['sundaesummit', 'coinquake'].includes(kind) && w.time >= g.nextSpawn) {
    const a = rand(w, w.tick) * TAU,
      r = Math.sqrt(rand(w, w.tick + 9)) * (kind === 'coinquake' ? 5 : 6.5);
    object(w, {
      kind:
        kind === 'coinquake'
          ? rand(w, w.tick + 7) > 0.7
            ? 'metal'
            : 'coin'
          : 'scoop',
      x: Math.sin(a) * r,
      z: Math.cos(a) * r,
      y: 8,
      vy: -3.8,
      r: 0.48,
      life: 4,
    });
    g.nextSpawn = w.time + (kind === 'coinquake' ? 0.42 : 0.65);
  }
  if (
    kind === 'postcardpanic' &&
    w.time >= g.nextSpawn &&
    g.objects.filter((o) => o.kind === 'letter').length < 14
  ) {
    object(w, {
      kind: 'letter',
      x: (rand(w, w.tick) - 0.5) * 13,
      z: (rand(w, w.tick + 2) - 0.5) * 11,
      tag: Math.floor(rand(w, w.tick + 3) * 3),
      value: 3,
      life: 35,
    });
    g.nextSpawn = w.time + 1.2;
  }
  if (kind === 'raingarden') {
    g.windX = Math.sin(w.time * 0.55) * 4.8;
    g.windZ = Math.cos(w.time * 0.38) * 4;
    if (!g.objects.length)
      for (let j = 0; j < 2; j++)
        object(w, { kind: 'beetle', x: 0, z: j ? 4 : -4, life: 100, tag: j });
  }
  if (kind === 'hooklinelunch') {
    for (let i = 0; i < 4; i++)
      for (let row = 0; row < 3; row++)
        if (
          !g.objects.some(
            (o) => o.kind === 'snackraft' && o.owner === i && o.tag === row,
          )
        )
          object(w, {
            kind: 'snackraft',
            owner: i,
            tag: row,
            x: lane(i),
            z: -2 - row * 4,
            life: 100,
            value: 1 + row * 2,
            r: 0.7,
          });
  }
  w.actors.forEach((p, i) => {
    const { c, a, b, release } = cs[i],
      s = g.seats[i];
    if (kind === 'parasolpearls') {
      if (p.finish) return;
      p.x = clamp(
        p.x +
          (c.x * 5.5 +
            Math.sin(Math.floor(p.y / 7) * 2 + w.time * 0.4) *
              (c.a ? 1.7 : 0.3)) *
            DT,
        -7,
        7,
      );
      p.y = Math.max(0, p.y - DT * (c.b ? 3.5 : c.a ? 0.75 : 1.6));
      if (p.y === 0) p.finish = w.time;
    } else if (kind === 'hooklinelunch') {
      s.aim = clamp(s.aim + c.x * DT, -1, 1);
      p.face = Math.PI - s.aim * 0.3;
      if (c.a && s.held < 0) p.charge = Math.min(1.5, p.charge + DT);
      if (release && s.held < 0 && p.charge > 0.05) {
        const x = lane(i) + s.aim * 3.4,
          z = 6 - (4 + p.charge * 8);
        object(w, { kind: 'hook', owner: i, x, z, y: 0.1, life: 3, r: 0.15 });
        const caught = g.objects.find(
          (o) =>
            o.kind === 'snackraft' &&
            o.owner === i &&
            Math.hypot(o.x - x, o.z - z) < 1.2,
        );
        if (caught) {
          s.held = caught.id;
          s.energy = 0.4;
        }
        p.charge = 0;
      }
      if (b) {
        s.held = -1;
        g.objects
          .filter((o) => o.kind === 'hook' && o.owner === i)
          .forEach((o) => (o.life = 0));
      }
      const held = g.objects.find((o) => o.id === s.held);
      if (held) {
        s.energy = clamp(
          s.energy +
            (c.z < -0.1 ? 0.36 : c.z > 0.1 ? -0.75 : -0.4) * DT +
            Math.sin(w.time * 3 + i) * DT * 0.08,
          0,
          1.1,
        );
        if (c.z < -0.1) held.z += DT * 4;
        else if (c.z > 0.1) held.z -= DT;
        const hook = g.objects.find((o) => o.kind === 'hook' && o.owner === i);
        if (hook) {
          hook.life = 2;
          hook.x = held.x;
          hook.z = held.z;
        }
        if (s.energy >= 1) {
          s.held = -1;
          held.life = 0;
          p.flash = 0.4;
        } else if (held.z >= 5) {
          p.score += held.value;
          held.life = 0;
          s.held = -1;
          p.flash = 0.3;
        }
      }
      return;
    } else {
      const beforeX = p.vx,
        beforeZ = p.vz;
      move(
        p,
        c,
        c.b ? 3 : 5.7,
        kind === 'sundaesummit' ? 10 / (1 + p.score * 0.08) : 12,
      );
      gravity(p, a);
      if (kind === 'coinquake') {
        if (Math.hypot(p.x, p.z) > 6.2 && p.y < 0.1) {
          p.x = Math.cos((i * Math.PI) / 2) * 3;
          p.z = Math.sin((i * Math.PI) / 2) * 3;
          p.stun = 1;
          s.water = 0;
          p.flash = 0.6;
        }
      } else bounds(p, 6.9);
      if (kind === 'sundaesummit') {
        s.wobble = Math.max(
          0,
          s.wobble +
            Math.hypot(p.vx - beforeX, p.vz - beforeZ) * p.score * 0.045 -
            DT * (c.b ? 1.1 : 0.17),
        );
        if (s.wobble > 1 && p.score > 0) {
          p.score--;
          s.wobble = 0.25;
          object(w, {
            kind: 'scoop',
            x: p.x - Math.sin(p.face) * 1.3,
            z: p.z - Math.cos(p.face) * 1.3,
            y: 1.4,
            vy: 1,
            owner: i,
            life: 4,
            tag: 1,
          });
        }
      }
      if (kind === 'postcardpanic') {
        const held = g.objects.find((o) => o.id === s.held);
        if (held) {
          held.x = p.x;
          held.z = p.z;
          held.y = 1.8;
          if (b) {
            held.owner = -1;
            held.y = 0.15;
            s.held = -1;
          } else if (a) {
            const cart = g.objects.find(
              (o) =>
                o.kind === 'mailcart' &&
                distance(o, p) < 1.4 &&
                (held.tag === 0 || held.tag === o.tag),
            );
            if (cart) {
              p.score += held.tag === 0 || held.age > 20 ? 1 : 3;
              held.life = 0;
              held.owner = -1;
              s.held = -1;
              p.flash = 0.25;
            }
          }
        } else if (a) {
          const letter = g.objects
            .filter(
              (o) =>
                o.kind === 'letter' &&
                o.owner < 0 &&
                o.life > 0 &&
                distance(o, p) < 1.3,
            )
            .sort((a, b) => distance(a, p) - distance(b, p))[0];
          if (letter) {
            letter.owner = i;
            s.held = letter.id;
          }
        }
      }
      if (kind === 'raingarden') {
        const gust = w.time % 8 < 1.3;
        if (c.a && !c.b && Math.hypot(p.x - g.windX, p.z - g.windZ) < 2.6)
          s.water += DT * 3;
        if (gust && c.a && !c.b) s.water = Math.max(0, s.water - DT * 5);
        for (const t of g.tiles) {
          const touching =
            Math.abs(p.x - t.x) < t.w / 2 + 0.4 &&
            Math.abs(p.z - t.z) < t.d / 2 + 0.4;
          if (touching && p.cooldown <= 0) {
            s.water = Math.max(0, s.water - 2);
            p.cooldown = 0.8;
          }
          block(p, t);
        }
        p.score = Math.floor(s.water);
      }
      if (kind === 'coinquake') {
        if (c.b && Math.hypot(Math.abs(p.x) - 4.5, p.z) < 1.3) {
          s.clock += DT;
          if (s.clock > 0.5) {
            p.score += Math.floor(s.water);
            s.water = 0;
            s.clock = 0;
            p.flash = 0.2;
          }
        } else s.clock = 0;
      }
    }
  });
  for (const o of g.objects) {
    o.age += DT;
    o.life -= DT;
    if (o.kind === 'scoop' || o.kind === 'coin' || o.kind === 'metal') {
      if (o.tag === 1) o.vy -= 8 * DT;
      o.y += o.vy * DT;
      for (const [i, p] of w.actors.entries()) {
        if (
          distance(p, o) > 0.85 ||
          p.stun > 0 ||
          (o.owner === i && o.age < 0.6)
        )
          continue;
        const catchY =
          p.y + 1.8 + (kind === 'sundaesummit' ? p.score * 0.2 : 0);
        if (o.y <= catchY && o.y >= p.y - 0.1) {
          if (o.kind === 'metal') {
            if (p.flash > 0) continue;
            p.flash = 0.8;
            shedCoins(w, p, i);
            p.stun = 0.3;
          } else if (o.kind === 'coin') g.seats[i].water += o.value;
          else p.score++;
          o.life = 0;
          p.flash = 0.18;
          break;
        }
      }
      if (o.y < 0) o.life = 0;
    }
    if (o.kind === 'mailcart') {
      o.x = (o.tag === 1 ? -4.5 : 4.5) + Math.sin(w.time * 0.4 + o.tag) * 1.3;
      o.z = Math.sin(w.time * 0.7 + o.tag) * 4;
    }
    if (
      o.kind === 'letter' &&
      o.life > 0 &&
      g.seats.some((s) => s.held === o.id)
    )
      o.life = Math.max(2, o.life);
    if (o.kind === 'beetle') {
      o.x = Math.sin(w.time * 0.8 + o.tag * 3) * 5;
      o.z = Math.cos(w.time * 0.5 + o.tag) * 4;
      for (const [i, p] of w.actors.entries())
        if (distance(o, p) < 0.8 && p.cooldown <= 0) {
          g.seats[i].water = Math.max(0, g.seats[i].water - 2);
          p.cooldown = 0.8;
        }
    }
    if (o.kind === 'pearl' || o.kind === 'jelly') {
      if (kind === 'parasolpearls') {
        o.x += Math.sin(w.time + o.id) * DT * 0.2;
        for (const p of w.actors)
          if (!p.finish && Math.hypot(p.x - o.x, (p.y - o.y) * 0.8) < 0.85) {
            if (o.kind === 'pearl') {
              p.score += o.value;
              o.life = 0;
              break;
            }
            if (p.flash <= 0) {
              p.score = Math.max(0, p.score - 1);
              p.flash = 1;
            }
          }
      }
    }
    if (o.kind === 'snackraft' && !g.seats.some((s) => s.held === o.id))
      o.x =
        lane(o.owner) +
        Math.sin(w.time * (0.5 + o.tag * 0.13) + o.tag * 2) * 2.5;
  }
}
function shedCoins(w: Arena, p: Runner, i: number) {
  const s = w.grand!.seats[i],
    count = Math.floor(s.water);
  s.water = 0;
  if (count)
    object(w, {
      kind: 'coin',
      x: p.x + 1.4,
      z: p.z,
      y: 1.2,
      vy: 1,
      tag: 1,
      value: count,
      owner: i,
      life: 4,
    });
}
function puzzles(w: Arena, cs: Inputs) {
  const g = w.grand!,
    kind = w.kind;
  w.actors.forEach((p, i) => {
    const { c, a, b } = cs[i],
      s = g.seats[i],
      cx = lane(i);
    if (p.finish) return;
    if (kind === 'coconutcompass') {
      p.vx += c.x * DT * 6;
      p.vz += c.z * DT * 6;
      const damping = c.a ? 0.91 : 0.995;
      p.vx *= damping;
      p.vz *= damping;
      if (b && p.cooldown <= 0) {
        p.vx += c.x * 2;
        p.vz += c.z * 2;
        p.cooldown = 1;
      }
      p.x += p.vx * DT;
      p.z += p.vz * DT;
      if (Math.abs(p.x - cx) > 3.25 || Math.abs(p.z) > 3.25) {
        p.x = cx;
        p.z = 0;
        p.vx = p.vz = 0;
        p.flash = 0.6;
      }
      const x = Math.floor(p.x - cx + 3),
        z = Math.floor(p.z + 3);
      if (x >= 0 && x < 6 && z >= 0 && z < 6) s.coverage[z * 6 + x] = 1;
      const n = s.coverage.reduce((a, b) => a + b, 0);
      progress(w, p, n / 36);
      if (n === 36) finish(w, p);
    } else if (kind === 'fossilfillet') {
      p.x = clamp(p.x + c.x * DT * 3.5, cx - 3.1, cx + 3.1);
      p.z = clamp(p.z + c.z * DT * 3.5, -2.6, 2.6);
      if (c.a && !c.b) {
        const points = fossilOutline(w.seed),
          relative = { x: p.x - cx, z: p.z },
          nearest = points
            .map((v, j) => ({ d: distance(v, relative), j }))
            .sort((a, b) => a.d - b.d)[0];
        if (nearest.d < 0.34) s.coverage[nearest.j] = 1;
        else s.water += DT;
        if (w.tick % 6 === 0) s.trace.push(relative);
        s.trace = s.trace.slice(-350);
      }
      const n = s.coverage.reduce((a, b) => a + b, 0);
      p.score = Math.round(Math.max(0, (n / 40) * 100 - s.water * 1.2));
    } else if (kind === 'lostluggage') {
      if (w.time < 5) return;
      move(p, c, 4.2);
      p.x = clamp(p.x, cx - 3.2, cx + 3.2);
      p.z = clamp(p.z, -3.8, 5.3);
      const held = g.objects.find((o) => o.id === s.held);
      if (held) {
        held.x = p.x;
        held.z = p.z;
        held.y = 1.5;
        if (b) held.value = (held.value + 1) % 4;
        if (a && p.cooldown <= 0) {
          const col = Math.round((p.x - cx) / 1.6) + 1,
            row = Math.round((p.z + 3) / 1.4);
          if (col >= 0 && col < 3 && row >= 0 && row < 3) {
            const pos = row * 3 + col,
              old = g.objects.find(
                (o) =>
                  o.owner === i &&
                  o.kind === 'case' &&
                  o.id !== held.id &&
                  o.hp === pos + 2,
              );
            if (old) {
              old.hp = 1;
              old.x = cx + (col - 1) * 1.5;
              old.z = 3.5;
            }
            held.x = cx + (col - 1) * 1.6;
            held.z = -3 + row * 1.4;
            held.y = 0.25;
            held.hp = pos + 2;
            s.held = -1;
            p.cooldown = 0.25;
          }
        }
      } else if (a && p.cooldown <= 0) {
        const obj = g.objects
          .filter(
            (o) => o.owner === i && o.kind === 'case' && distance(o, p) < 1,
          )
          .sort((a, b) => distance(a, p) - distance(b, p))[0];
        if (obj) {
          s.held = obj.id;
          obj.hp = 1;
          p.cooldown = 0.25;
        }
      }
      let correct = 0;
      for (const o of g.objects)
        if (o.owner === i && o.hp >= 2) {
          const pos = o.hp - 2;
          if (s.memory[pos] === o.tag) {
            correct += 1;
            if (o.value === Math.floor(rand(w, o.tag * 17 + 7) * 4))
              correct += 1;
          }
        }
      p.score = Math.round((correct / 18) * 100);
    } else if (kind === 'doughdouble') {
      if (!c.a) {
        if (Math.abs(c.x) > 0.3 && p.cooldown <= 0) {
          s.selection = (s.selection + (c.x > 0 ? 1 : 5)) % 6;
          p.cooldown = 0.2;
        }
        s.held = -1;
      } else {
        const h = s.handles[s.selection];
        s.held = s.selection;
        h.x = clamp(h.x + c.x * DT * 1.5, -2.8, 2.8);
        h.z = clamp(h.z + c.z * DT * 1.5, -2, 2);
      }
      if (b) {
        s.handles[s.selection] = {
          x: ((s.selection % 3) - 1) * 1.2,
          z: (s.selection < 3 ? -1 : 1) * 0.9,
        };
      }
      const target = doughTarget(w.seed),
        error =
          s.handles.reduce((sum, h, j) => sum + distance(h, target[j]), 0) / 6;
      p.score = Math.round(Math.max(0, 100 - error * 95));
      p.x = cx + s.handles[s.selection].x;
      p.z = s.handles[s.selection].z;
    } else if (kind === 'bentoblocks') {
      const piece = s.piece;
      if (!piece.length) return;
      const cells = (x = piece[0], y = piece[1], rot = piece[4]) => [
        { x, y, c: piece[2] },
        {
          x: x + (rot === 1 ? 1 : rot === 3 ? -1 : 0),
          y: y + (rot === 0 ? -1 : rot === 2 ? 1 : 0),
          c: piece[3],
        },
      ];
      const fits = (x: number, y: number, r: number) =>
        cells(x, y, r).every(
          (v) =>
            v.x >= 0 &&
            v.x < 6 &&
            v.y < 10 &&
            (v.y < 0 || s.grid[v.y * 6 + v.x] === 0),
        );
      if (Math.abs(c.x) > 0.4 && p.cooldown <= 0) {
        const x = piece[0] + Math.sign(c.x);
        if (fits(x, piece[1], piece[4])) piece[0] = x;
        p.cooldown = 0.15;
      }
      if (a) {
        const rot = (piece[4] + 1) % 4;
        if (fits(piece[0], piece[1], rot)) piece[4] = rot;
      }
      s.water += DT * (c.z > 0.3 ? 7 : 1);
      if (b && w.time >= s.reloadAt) {
        s.reloadAt = w.time + 0.2;
        while (fits(piece[0], piece[1] + 1, piece[4])) piece[1]++;
        s.water = 1;
      }
      if (s.water > 0.65) {
        s.water = 0;
        if (fits(piece[0], piece[1] + 1, piece[4])) piece[1]++;
        else {
          let overflow = false;
          for (const v of cells())
            if (v.y < 0) overflow = true;
            else s.grid[v.y * 6 + v.x] = v.c;
          if (overflow) {
            s.grid.fill(0);
            p.score = Math.max(0, p.score - 10);
            p.flash = 0.7;
          } else {
            let chain = 1;
            for (let repeat = 0; repeat < 10; repeat++) {
              const seen = new Set<number>(),
                clear: number[] = [];
              for (let j = 0; j < 60; j++)
                if (s.grid[j] && !seen.has(j)) {
                  const q = [j],
                    cluster: number[] = [];
                  seen.add(j);
                  while (q.length) {
                    const n = q.pop()!;
                    cluster.push(n);
                    for (const k of [
                      n - 6,
                      n + 6,
                      ...(n % 6 ? [n - 1] : []),
                      ...(n % 6 < 5 ? [n + 1] : []),
                    ])
                      if (
                        k >= 0 &&
                        k < 60 &&
                        !seen.has(k) &&
                        s.grid[k] === s.grid[n]
                      ) {
                        seen.add(k);
                        q.push(k);
                      }
                  }
                  if (cluster.length >= 3) clear.push(...cluster);
                }
              if (!clear.length) break;
              for (const j of clear) s.grid[j] = 0;
              p.score += clear.length * chain;
              chain++;
              for (let x = 0; x < 6; x++) {
                const values = [];
                for (let y = 9; y >= 0; y--)
                  if (s.grid[y * 6 + x]) values.push(s.grid[y * 6 + x]);
                for (let y = 9; y >= 0; y--)
                  s.grid[y * 6 + x] = values[9 - y] ?? 0;
              }
              p.flash = 0.25;
            }
            s.banked = chain - 1;
          }
          s.clock++;
          s.piece = [
            2,
            -1,
            1 + Math.floor(rand(w, s.clock * 17 + 1) * 4),
            1 + Math.floor(rand(w, s.clock * 17 + 2) * 4),
            0,
          ];
        }
      }
    } else if (kind === 'picnicpartition') {
      const center = p.team === 0 ? -8 : 8;
      move(p, c, 4.2);
      p.x = clamp(p.x, center - 5.8, center + 5.8);
      p.z = clamp(p.z, -5.8, 6.7);
      const t = g.tiles.find(
        (t) =>
          t.owner === p.team &&
          t.hp > 0 &&
          Math.abs(t.x - p.x) < 0.8 &&
          Math.abs(t.z - p.z) < 0.8,
      );
      if (c.a && t && s.energy > 0) {
        t.hp = Math.max(0, t.hp - DT * 2);
        s.energy = Math.max(0, s.energy - DT * 0.18);
        if (t.hp === 0) {
          g.teamScore[p.team]++;
          p.flash = 0.2;
        }
      } else s.energy = Math.min(1, s.energy + DT * 0.07);
      if (c.b && Math.hypot(p.x - center, p.z - 6) < 1.6)
        s.energy = Math.min(1, s.energy + DT * 0.85);
      p.score = g.teamScore[p.team];
    }
  });
  if (kind === 'picnicpartition')
    w.actors.forEach((p) => (p.score = g.teamScore[p.team]));
}
function resetBall(w: Arena, team: number, volley = false) {
  const g = w.grand!,
    o = g.objects.find((o) => o.kind === 'ball')!;
  o.x = team === 0 ? -2 : 2;
  o.z = team === 0 ? 3 : -3;
  o.y = volley ? 3 : 0.3;
  o.vx = 0;
  o.vz = volley ? (team === 0 ? -2 : 2) : 0;
  o.vy = volley ? 5 : 0;
  o.owner = -1;
  o.tag = 0;
  g.ballTeam = -1;
  g.ballContacts = 0;
  g.lastHit = -1;
  w.pulse = 0.7;
}
function sports(w: Arena, cs: Inputs) {
  const g = w.grand!,
    kind = w.kind;
  if (kind === 'paddleplunder') {
    for (let team = 0; team < 2; team++) {
      const v = g.vehicles[team],
        l = cs[team * 2].c,
        r = cs[team * 2 + 1].c,
        left = l.a ? 1 : l.b ? -0.65 : 0,
        right = r.a ? 1 : r.b ? -0.65 : 0;
      v.face += (left - right) * DT * 1.5 + (l.x + r.x) * DT * 0.3;
      const force = (left + right) * 1.8;
      v.vx += (Math.sin(v.face) * force - v.vx * 0.8) * DT;
      v.vz += (Math.cos(v.face) * force - v.vz * 0.8) * DT;
      v.x += v.vx * DT + Math.sin(v.z * 0.3) * DT * 0.25;
      v.z += v.vz * DT - Math.cos(v.x * 0.3) * DT * 0.25;
      const d = Math.hypot(v.x, v.z);
      if (d > 9) {
        v.x *= 9 / d;
        v.z *= 9 / d;
        v.vx *= 0.5;
        v.vz *= 0.5;
      }
      for (const o of g.objects)
        if (o.life > 0 && distance(v, o) < 1.25) {
          g.teamScore[team] += o.value;
          o.life = 0;
          w.pulse = 0.3;
        }
      for (let j = 0; j < 2; j++) {
        const p = w.actors[team * 2 + j];
        p.x = v.x + Math.cos(v.face) * (j ? 0.5 : -0.5);
        p.z = v.z - Math.sin(v.face) * (j ? 0.5 : -0.5);
        p.face = v.face;
        p.score = g.teamScore[team];
      }
    }
    if (
      g.objects.filter((o) => o.life > 0).length < 6 &&
      w.time >= g.nextSpawn
    ) {
      for (let j = 0; j < 12; j++) {
        const a = rand(w, w.tick + j) * TAU;
        object(w, {
          kind: 'pearl',
          x: Math.cos(a) * 7,
          z: Math.sin(a) * 7,
          life: 80,
          r: 0.4,
          value: j % 4 === 0 ? 3 : 1,
        });
      }
      g.nextSpawn = w.time + 10;
    }
    return;
  }
  if (kind === 'touchdowntiki') {
    const runner = w.actors[g.solo];
    w.actors.forEach((p, i) => {
      if (!p.alive) return;
      const { c, a, b } = cs[i],
        s = g.seats[i];
      move(p, c, i === g.solo ? 5.8 : 5.2);
      bounds(p, 7, 8);
      if (i === g.solo) {
        if (a && s.boosts > 0 && p.cooldown <= 0) {
          s.boosts--;
          p.cooldown = 0.9;
          p.vx += c.x * 15;
          p.vz += c.z * 15;
          p.flash = 0.25;
        }
        if (b && p.cooldown <= 0) {
          p.x = clamp(p.x + (c.x >= 0 ? 1.6 : -1.6), -7, 7);
          p.cooldown = 1.4;
        }
        if (p.z < -7 && [-5, 0, 5].some((x) => Math.abs(x - p.x) < 1.35)) {
          p.score += 5;
          p.x = 0;
          p.z = 8;
          p.flash = 0.8;
        }
      } else if (a && p.cooldown <= 0) {
        p.cooldown = 1;
        p.vx += c.x * 8;
        p.vz += c.z * 8;
        if (distance(p, runner) < 1.65 && runner.flash <= 0) {
          p.score += 3;
          runner.z = 8;
          runner.x = 0;
          runner.stun = 0.4;
          runner.flash = 1;
        }
      } else if (b && distance(p, runner) < 1.2 && runner.flash <= 0) {
        runner.vx *= 0.8;
        runner.vz *= 0.8;
      }
    });
    return;
  }
  if (kind === 'goalguava') {
    w.actors.forEach((p, i) => {
      const { c, a, b, release } = cs[i],
        s = g.seats[i];
      if (i === g.solo) {
        p.x = clamp(p.x + c.x * DT * 6, -6, 6);
        gravity(p, a, 5);
        if (b && p.cooldown <= 0) {
          p.vx = c.x * 13;
          p.cooldown = 1.2;
          p.flash = 0.25;
        }
        p.x = clamp(p.x + p.vx * DT, -6, 6);
        p.vx *= 0.9;
        p.z = -7;
      } else {
        p.x = clamp(p.x + c.x * DT * 3, -6, 6);
        s.aim = clamp(s.aim - c.z * DT, -1, 1);
        if (c.a) p.charge = Math.min(1.2, p.charge + DT);
        if (release && p.charge > 0.06 && p.cooldown <= 0) {
          p.cooldown = 1.15;
          const target = p.x + s.aim * 3,
            dx = target - p.x,
            dz = -12,
            d = Math.hypot(dx, dz),
            speed = 9 + p.charge * 5;
          object(w, {
            kind: 'guava',
            owner: i,
            x: p.x,
            z: 5,
            y: 0.45,
            vx: (dx / d) * speed,
            vz: (dz / d) * speed,
            vy: c.b ? 2 : 0,
            life: 3,
            r: 0.35,
          });
          p.charge = 0;
        }
      }
    });
    for (const o of g.objects) {
      o.x += o.vx * DT;
      o.z += o.vz * DT;
      o.y = Math.max(0.35, o.y + o.vy * DT);
      o.vy -= DT * 2;
      o.life -= DT;
      const keeper = w.actors[g.solo];
      if (
        Math.abs(o.z + 7) < 0.65 &&
        Math.abs(o.x - keeper.x) < (cs[g.solo].c.b ? 1.5 : 0.95) &&
        Math.abs(o.y - (keeper.y + 0.8)) < 1.2
      ) {
        keeper.score++;
        o.life = 0;
        keeper.flash = 0.2;
      } else if (o.z < -7.7) {
        if (Math.abs(o.x) < 6) w.actors[o.owner].score++;
        o.life = 0;
      }
    }
    return;
  }
  const ball = g.objects.find((o) => o.kind === 'ball')!;
  ball.life = 200;
  const volley = kind === 'volleybuns';
  w.actors.forEach((p, i) => {
    const { c, a, b, release } = cs[i];
    move(
      p,
      c,
      kind === 'puckpicnic' ? 6.5 : 5.8,
      kind === 'puckpicnic' ? 3.5 : 12,
    );
    bounds(p, 7, 7.5);
    if (volley) {
      p.z = clamp(p.z, p.team === 0 ? 0.7 : -7.5, p.team === 0 ? 7.5 : -0.7);
      gravity(p, a, 6);
      if (
        (a || b || p.y > 0.6) &&
        distance(p, ball) < 1.7 &&
        Math.abs(ball.y - (p.y + 1.4)) < 2 &&
        p.cooldown <= 0
      ) {
        p.cooldown = 0.4;
        if (g.ballTeam !== p.team) {
          g.ballTeam = p.team;
          g.ballContacts = 0;
        }
        if (g.lastHit !== i || ball.age > 0.4) {
          g.ballContacts++;
          g.lastHit = i;
          ball.age = 0;
          const partner = w.actors[p.team * 2 + (i % 2 ? 0 : 1)],
            toX = b ? partner.x : clamp(p.x + c.x * 4, -6, 6),
            toZ = b ? partner.z : p.team === 0 ? -5 : 5;
          ball.vx = (toX - ball.x) / (b ? 1.1 : 1.5);
          ball.vz = (toZ - ball.z) / (b ? 1.1 : 1.5);
          ball.vy = b ? 8 : 7;
          ball.owner = p.team;
          if (g.ballContacts > 3) {
            g.teamScore[1 - p.team]++;
            resetBall(w, 1 - p.team, true);
          }
        }
      }
    } else {
      if (c.a) p.charge = Math.min(1.4, p.charge + DT);
      const near = distance(p, ball) < 1.25;
      if (near && b && p.cooldown <= 0) {
        ball.vx *= 0.15;
        ball.vz *= 0.15;
        ball.x = p.x + Math.sin(p.face) * 0.7;
        ball.z = p.z + Math.cos(p.face) * 0.7;
        ball.owner = i;
        p.cooldown = 0.4;
      }
      if (
        near &&
        ((kind === 'pineapplestrikers' && a) ||
          (kind === 'puckpicnic' && release)) &&
        p.cooldown <= 0
      ) {
        const face =
            Math.hypot(c.x, c.z) > 0.3
              ? Math.atan2(c.x, c.z)
              : p.team === 0
                ? Math.PI
                : 0,
          speed = kind === 'puckpicnic' ? 8 + p.charge * 7 : 13;
        ball.vx = Math.sin(face) * speed;
        ball.vz = Math.cos(face) * speed;
        ball.owner = i;
        p.charge = 0;
        p.cooldown = 0.35;
        p.jumps++;
      } else if (near && Math.hypot(ball.vx, ball.vz) < 3) {
        ball.vx += p.vx * DT * 5;
        ball.vz += p.vz * DT * 5;
      }
    }
  });
  const oldZ = ball.z;
  ball.x += ball.vx * DT;
  ball.z += ball.vz * DT;
  ball.age += DT;
  if (volley) {
    ball.vy -= 7.5 * DT;
    ball.y += ball.vy * DT;
    if (oldZ * ball.z < 0) {
      if (ball.y < 2) {
        ball.vz *= -0.6;
        ball.z = Math.sign(oldZ) * 0.15;
      } else {
        g.ballContacts = 0;
        g.ballTeam = -1;
        g.lastHit = -1;
      }
    }
    if (ball.y < 0.1) {
      const winner = ball.z > 0 ? 1 : 0;
      g.teamScore[winner]++;
      resetBall(w, winner, true);
    } else if (Math.abs(ball.x) > 7.7 || Math.abs(ball.z) > 8) {
      const winner = ball.owner >= 0 ? 1 - ball.owner : ball.z > 0 ? 1 : 0;
      g.teamScore[winner]++;
      resetBall(w, winner, true);
    }
  } else {
    ball.vx *= 0.997;
    ball.vz *= 0.997;
    if (Math.abs(ball.x) > 7.5) {
      ball.x = clamp(ball.x, -7.5, 7.5);
      ball.vx *= -0.85;
    }
    if (
      kind === 'puckpicnic' &&
      Math.abs(ball.z) > 8 &&
      Math.abs(ball.x) < 2.2
    ) {
      const winner = ball.z > 0 ? 1 : 0;
      g.teamScore[winner]++;
      resetBall(w, winner);
    } else if (kind === 'pineapplestrikers') {
      for (const t of g.tiles)
        if (t.hp > 0 && distance(ball, t) < 0.95) {
          t.hp = 0;
          g.teamScore[1 - t.owner]++;
          resetBall(w, 1 - t.owner);
          break;
        }
      if (g.teamScore.some((v) => v >= 5) && !w.endAt) w.endAt = w.time + 1;
    }
    if (Math.abs(ball.z) > 8.3) {
      ball.z = clamp(ball.z, -8.3, 8.3);
      ball.vz *= -0.8;
    }
  }
  w.actors.forEach((p) => (p.score = g.teamScore[p.team]));
}
function tactics(w: Arena, cs: Inputs) {
  const g = w.grand!;
  if (w.kind === 'crateescape') {
    const solo = w.actors[g.solo];
    w.actors.forEach((p, i) => {
      if (!p.alive) return;
      const { c, a } = cs[i],
        s = g.seats[i];
      if (p.stun > 0) return;
      if (p.cooldown > 0) {
        const blend = Math.min(1, DT * 12);
        p.x += (p.tx - p.x) * blend;
        p.z += (p.tz - p.z) * blend;
      } else if (Math.hypot(c.x, c.z) > 0.3) {
        const size = i === g.solo ? 1 : 2,
          step = a && s.boosts > 0 ? 2 : 1;
        if (step === 2) s.boosts--;
        const x =
            Math.round(p.x) +
            (Math.abs(c.x) > Math.abs(c.z) ? Math.sign(c.x) * step : 0),
          z =
            Math.round(p.z) +
            (Math.abs(c.z) >= Math.abs(c.x) ? Math.sign(c.z) * step : 0),
          valid =
            Math.abs(x) < 7 &&
            Math.abs(z) < 7 &&
            !g.tiles.some(
              (t) =>
                Math.abs(t.x - x) < t.w / 2 + size * 0.4 &&
                Math.abs(t.z - z) < t.d / 2 + size * 0.4,
            );
        if (valid) {
          p.tx = x;
          p.tz = z;
          p.cooldown = i === g.solo ? 0.2 : 0.4;
          p.face = Math.atan2(x - p.x, z - p.z);
          p.jumps++;
        }
      }
      if (i !== g.solo && distance(p, solo) < 1.25 && solo.flash <= 0) {
        p.score += 3;
        solo.x = solo.tx = (rand(w, w.tick) * 2 - 1) * 5;
        solo.z = solo.tz = (rand(w, w.tick + 1) * 2 - 1) * 5;
        solo.flash = 1.2;
        solo.stun = 0.25;
      }
      if (i === g.solo) {
        const n = Math.floor((w.time % 13) / 2);
        if (n > s.clock) {
          p.score += n - s.clock;
          s.clock = n;
        }
      }
    });
    return;
  }
  for (let team = 0; team < 2; team++) {
    const v = g.vehicles[team],
      center = team === 0 ? -8 : 8;
    if (v.finish) continue;
    const obstacle = g.tiles
      .filter((t) => t.owner === team && t.hp > 0 && -t.z >= v.distance - 1)
      .sort((a, b) => b.z - a.z)[0];
    const blocked = obstacle && -obstacle.z - v.distance < 4;
    v.speed = blocked ? 0 : 6;
    v.distance += v.speed * DT;
    for (let j = 0; j < 2; j++) {
      const i = team * 2 + j,
        p = w.actors[i],
        { c, a, releaseB } = cs[i],
        s = g.seats[i];
      move(p, c, 6);
      p.x = clamp(p.x, center - 3.4, center + 3.4);
      p.z = clamp(p.z, -v.distance - 5, -v.distance + 4);
      if (c.b) p.charge = Math.min(1.2, p.charge + DT);
      const rock = g.tiles
        .filter((t) => t.owner === team && t.hp > 0 && distance(t, p) < 2.2)
        .sort((a, b) => distance(p, a) - distance(p, b))[0];
      if (p.cooldown <= 0 && rock && (a || (releaseB && p.charge > 0.3))) {
        const heavy = releaseB && p.charge > 0.3;
        rock.hp = Math.max(0, rock.hp - (heavy ? 3 : rock.tag === 1 ? 0.3 : 1));
        p.cooldown = heavy ? 0.55 : 0.32;
        p.charge = 0;
        p.jumps++;
        p.flash = 0.12;
      }
      s.selection = blocked ? 1 : 0;
      p.distance = v.distance;
      progress(w, p, v.distance / 98);
      if (v.distance >= 98) {
        finish(w, p);
        v.finish = p.finish;
      }
    }
  }
}
function grandCPU(w: Arena, p: Runner, i: number): Control {
  const g = w.grand!,
    s = g.seats[i],
    kind = w.kind,
    level = clamp(w.difficulty, 0, 2),
    period = Math.round(32 - level * 5),
    tap = (w.tick + i * 7) % period === 0;
  let c = zero();
  if (!p.alive || p.finish) return c;
  const go = (x: number, z: number) => {
    c = steer(p, x, z);
  };
  const nearest = (objects: { x: number; z: number }[]) =>
    objects.slice().sort((a, b) => distance(p, a) - distance(p, b))[0];
  if (kind === 'tidetiles') {
    const t = g.tiles[g.target],
      from = g.tiles.slice().sort((a, b) => distance(p, a) - distance(p, b))[0],
      via =
        from.tag !== 0 &&
        t.tag !== 0 &&
        distance(from, t) > 5.1 &&
        distance(p, g.tiles[0]) > 1.8
          ? g.tiles[0]
          : t;
    go(via.x + (i % 2 ? 0.25 : -0.25), via.z + (i < 2 ? 0.25 : -0.25));
    c.a = p.y < 0.01 && distance(p, from) > 1.35 && distance(p, via) > 2;
    c.b = tap && distance(p, t) < 1.8;
  } else if (
    [
      'cannoncay',
      'prickleice',
      'crabtraffic',
      'crumbleclock',
      'lanternlurk',
    ].includes(kind)
  ) {
    let x = -p.x * 0.4,
      z = -p.z * 0.4;
    for (const o of g.objects) {
      const dx = p.x - (o.x + o.vx * 0.4),
        dz = p.z - (o.z + o.vz * 0.4),
        d = Math.max(0.2, Math.hypot(dx, dz));
      if (d < 3) {
        x += (dx / d) * (3 - d) * 2;
        z += (dz / d) * (3 - d) * 2;
      }
    }
    if (kind === 'lanternlurk') {
      const m = g.monster,
        dx = p.x - m.x,
        dz = p.z - m.z,
        d = Math.max(0.2, Math.hypot(dx, dz));
      x += (dx / d) * 5;
      z += (dz / d) * 5;
      c.b = w.time - m.at > 1.1;
    }
    if (kind === 'crumbleclock') {
      const t = g.tiles
        .filter((t) => t.hp > 4)
        .sort(
          (a, b) => b.hp - distance(p, b) * 2 - (a.hp - distance(p, a) * 2),
        )[0];
      if (t) {
        x = t.x - p.x;
        z = t.z - p.z;
      }
    }
    const d = Math.max(1, Math.hypot(x, z));
    c.x = x / d;
    c.z = z / d;
    c.a =
      tap &&
      (kind === 'crabtraffic' ||
        kind === 'prickleice' ||
        kind === 'crumbleclock');
    if (kind === 'cannoncay')
      c.b = g.objects.some((o) => o.life < 0.3 && distance(p, o) < 3);
    if (kind === 'crabtraffic' && p.x < -5) c.x = 1;
  } else if (kind === 'picklepatrol') {
    const rival = nearest(w.actors.filter((o) => o !== p && o.alive));
    if (rival) {
      go(rival.x, rival.z);
      c.b = distance(p, rival) < 5;
      c.a = tap;
    }
  } else if (kind === 'vinevault') {
    const next = g.tiles.find(
      (t) => t.owner === i && t.tag === Math.min(20, p.checkpoint + 1),
    );
    if (next) {
      c.x = clamp((next.x - p.x) * 2, -1, 1);
      c.a = p.vy === 0 && p.stun <= 0;
      c.b = p.vy < 0 && Math.abs(next.x - p.x) > 1.1;
    }
  } else if (kind === 'mangrovemotors' || kind === 'bubbletrouble') {
    const t = g.tiles.find((t) => -t.z > p.distance && -t.z < p.distance + 16);
    const x = t ? (t.x > 0 ? -3.5 : 3.5) : Math.sin(i * 2) * 1.6;
    c.x = clamp(x - p.x, -1, 1);
    c.z = -1;
    c.a = kind === 'mangrovemotors' ? tap : s.energy > 0.3;
    c.b =
      kind === 'bubbletrouble'
        ? !!t && t.tag === 0 && -t.z - p.distance < 7
        : !!t &&
          Math.abs(t.x - p.x) < 1.8 &&
          -t.z - p.distance < 3 &&
          p.gear > 1;
  } else if (kind === 'frostyfreight') {
    const v = g.vehicles[p.team],
      t = g.tiles.find((t) => -t.z > v.distance && -t.z < v.distance + 12);
    c.x = clamp((t ? (t.x > 0 ? -3.5 : 3.5) : 0) - v.x, -1, 1);
    c.a = i % 2 ? !!t && -t.z - v.distance < 3 && v.y === 0 : true;
    c.b =
      !!t && Math.abs(v.x - t.x) < 1.7 && -t.z - v.distance < 2 && v.y < 0.3;
  } else if (kind === 'pelicanpilots') {
    const v = g.vehicles[p.team],
      t = g.tiles[Math.min(13, v.checkpoint)];
    c.x = clamp(t.x - v.x, -1, 1);
    c.z = clamp(v.y - t.y, -1, 1);
    c.a = i % 2 ? v.heat < 0.85 && v.lift < 0.75 : true;
    c.b = i % 2 ? v.heat > 0.9 : false;
  } else if (kind === 'hotelhiccup') {
    const known = s.memory.slice(p.gear * 5, p.gear * 5 + 5),
      correct = known.indexOf(1),
      unknown = Array.from({ length: 5 }, (_, j) => (j + i + p.gear) % 5).find(
        (j) => known[j] !== 0,
      );
    const door = g.tiles.find(
      (t) =>
        t.owner === p.gear &&
        t.tag === (correct >= 0 ? correct : (unknown ?? 0)),
    );
    if (door) {
      go(door.x, door.z + 0.8);
      c.a = distance(p, door) < 1.4 && tap;
    }
  } else if (kind === 'mangosluggers') {
    const ball = g.objects.find(
      (o) => o.owner === i && o.kind === 'pitch' && o.tag === 0,
    );
    if (ball) {
      c.x = clamp((ball.x - p.x) * 3, -1, 1);
      c.a =
        Math.abs(ball.z - 5) < 0.6 + level * 0.15 &&
        p.cooldown <= 0 &&
        rand(w, Math.floor(w.time / 1.45) * 83 + i * 31) > 0.32 - level * 0.1;
      c.z = -0.2;
    }
  } else if (kind === 'geckograffiti') {
    const target = g.objects
      .filter((o) => o.kind === 'gecko' && o.owner !== p.team)
      .sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
    if (target) {
      c.x = clamp(target.x + target.vx * 0.5 - p.x, -1, 1);
      c.z = clamp(-s.aim * 3, -1, 1);
      c.a = tap;
    }
  } else if (kind === 'skewergallery') {
    if (i === g.solo) {
      const target = nearest(w.actors.filter((p, j) => j !== i && p.alive));
      if (target) {
        c.x = clamp((target.x - p.tx) * 2, -1, 1);
        c.z = clamp((target.z - p.tz) * 2, -1, 1);
        c.a = tap;
      }
    } else {
      const cover = g.tiles[i % 2];
      go(cover.x, -4.8 + (i % 2) * 2);
      const shot = nearest(g.objects.filter((o) => o.kind === 'skewer'));
      if (shot && distance(p, shot) < 2.3) {
        c.x = p.x > shot.x ? 1 : -1;
        c.a = tap;
      }
    }
  } else if (kind === 'boulderbuffet') {
    if (i === g.solo) {
      const target = nearest(w.actors.filter((p, j) => j !== i));
      if (target) c.x = clamp(target.x - p.x, -1, 1);
      c.a = w.tick % 100 < 65;
      c.b = w.tick % 360 === 0;
    } else {
      go(Math.sin(i * 2 + w.time * 0.4) * 4, -8);
      const melon = nearest(g.objects.filter((o) => o.kind === 'melon'));
      c.a = !!melon && distance(p, melon) < 2 && p.y <= (8 - p.z) * 0.31 + 0.05;
      if (melon && Math.abs(melon.x - p.x) < 1.3) c.x = p.x > melon.x ? 1 : -1;
    }
  } else if (kind === 'returnsender') {
    const incoming = g.objects
        .filter(
          (o) => o.kind === 'parcel' && (p.team === 0 ? o.x < 2 : o.x > -2),
        )
        .sort((a, b) => (p.team === 0 ? a.x - b.x : b.x - a.x)),
      target = incoming.find((o) => o.tag % 2 === i % 2) ?? incoming[0];
    if (target) {
      go(p.team === 0 ? -5 : 5, target.z);
      c.a = distance(p, { x: p.team === 0 ? -5 : 5, z: target.z }) < 1.2 && tap;
    }
  } else if (kind === 'sundaesummit' || kind === 'coinquake') {
    if (kind === 'coinquake' && s.water >= 3) {
      go(p.x > 0 ? 4.5 : -4.5, 0);
      c.b = Math.hypot(Math.abs(p.x) - 4.5, p.z) < 1.2;
    } else {
      const target = nearest(
        g.objects.filter(
          (o) =>
            (o.kind === 'scoop' || o.kind === 'coin') && o.y > 1 && o.life > 0,
        ),
      );
      if (target) go(target.x, target.z);
      c.b = kind === 'sundaesummit' && s.wobble > 0.4;
      const hazard = nearest(g.objects.filter((o) => o.kind === 'metal'));
      if (
        hazard &&
        distance(p, hazard) < 1.4 &&
        'y' in hazard &&
        (hazard as GObject).y < 4
      ) {
        c.x = p.x > hazard.x ? 1 : -1;
        c.z = p.z > hazard.z ? 1 : -1;
      }
    }
  } else if (kind === 'postcardpanic') {
    const held = g.objects.find((o) => o.id === s.held),
      target = held
        ? nearest(
            g.objects.filter(
              (o) =>
                o.kind === 'mailcart' && (held.tag === 0 || held.tag === o.tag),
            ),
          )
        : nearest(
            g.objects.filter(
              (o) => o.kind === 'letter' && o.owner < 0 && o.life > 0,
            ),
          );
    if (target) {
      go(target.x, target.z);
      c.a = distance(p, target) < 1.2 && tap;
    }
  } else if (kind === 'raingarden') {
    go(g.windX + (i % 2 ? 0.6 : -0.6), g.windZ + (i < 2 ? 0.6 : -0.6));
    c.a = w.time % 8 > 1.3;
    c.b = !c.a;
    for (const t of g.tiles)
      if (Math.abs(p.x - t.x) < 1.4 && Math.abs(p.z - t.z) < 1.8)
        c.x = p.x > t.x ? 1 : -1;
  } else if (kind === 'parasolpearls') {
    const target = g.objects
      .filter((o) => o.kind === 'pearl' && o.life > 0 && o.y < p.y)
      .sort(
        (a, b) =>
          Math.abs(p.y - a.y) +
          Math.abs(p.x - a.x) * 0.35 -
          (Math.abs(p.y - b.y) + Math.abs(p.x - b.x) * 0.35),
      )[0];
    if (target) {
      c.x = clamp(target.x - p.x, -1, 1);
      c.a = p.y - target.y < 4;
    }
    c.b = !target;
  } else if (kind === 'hooklinelunch') {
    if (s.held >= 0) {
      c.z = s.energy > 0.78 || (p.input.z > 0 && s.energy > 0.28) ? 1 : -1;
    } else {
      const row = level === 0 ? 0 : 1,
        t = g.objects.find(
          (o) => o.kind === 'snackraft' && o.owner === i && o.tag === row,
        ),
        charge = row === 0 ? 0.5 : 1,
        phase = ((w.tick + i * 30) % 210) / 60;
      c.a = phase < charge;
      c.x = t
        ? clamp(
            ((Math.sin(
              (w.time + Math.max(0, charge - phase)) * (0.5 + row * 0.13) +
                row * 2,
            ) *
              2.5) /
              3.4 -
              s.aim) *
              4,
            -1,
            1,
          )
        : 0;
    }
  } else if (kind === 'coconutcompass') {
    const j = s.coverage.findIndex((v) => v === 0);
    if (j >= 0) {
      const target = { x: lane(i) + (j % 6) - 2.5, z: Math.floor(j / 6) - 2.5 };
      c.x = clamp((target.x - p.x) * 1.8 - p.vx * 0.9, -1, 1);
      c.z = clamp((target.z - p.z) * 1.8 - p.vz * 0.9, -1, 1);
      c.a = distance(p, target) < 0.8;
    }
  } else if (kind === 'fossilfillet') {
    const outline = fossilOutline(w.seed),
      point = outline[s.selection % 40];
    go(lane(i) + point.x, point.z);
    if (distance(p, { x: lane(i) + point.x, z: point.z }) < 0.14)
      s.selection = (s.selection + 1) % 40;
    const nearest = outline
      .map((v, j) => ({ j, d: distance({ x: p.x - lane(i), z: p.z }, v) }))
      .sort((a, b) => a.d - b.d)[0];
    c.a =
      nearest.d < 0.36 &&
      rand(w, nearest.j * 37 + i * 71) > 0.26 - level * 0.095;
  } else if (kind === 'lostluggage') {
    if (w.time < 5) return c;
    const held = g.objects.find((o) => o.id === s.held);
    if (held) {
      const pos = s.memory.indexOf(held.tag);
      go(lane(i) + ((pos % 3) - 1) * 1.6, -3 + Math.floor(pos / 3) * 1.4);
      const orientation = Math.floor(rand(w, held.tag * 17 + 7) * 4);
      c.b = held.value !== orientation && tap;
      c.a =
        held.value === orientation &&
        distance(p, {
          x: lane(i) + ((pos % 3) - 1) * 1.6,
          z: -3 + Math.floor(pos / 3) * 1.4,
        }) < 0.5 &&
        tap;
    } else {
      const target = nearest(
        g.objects.filter(
          (o) =>
            o.owner === i &&
            o.kind === 'case' &&
            o.tag < (level === 0 ? 6 : level === 1 ? 8 : 9) &&
            (o.hp < 2 ||
              s.memory[o.hp - 2] !== o.tag ||
              o.value !== Math.floor(rand(w, o.tag * 17 + 7) * 4)),
        ),
      );
      if (target) {
        go(target.x, target.z);
        c.a = distance(p, target) < 0.9 && tap;
      }
    }
  } else if (kind === 'doughdouble') {
    const target = doughTarget(w.seed)[s.selection],
      h = s.handles[s.selection],
      dx = target.x - h.x,
      dz = target.z - h.z;
    if (Math.hypot(dx, dz) > 0.025 + (2 - level) * 0.045) {
      c.a = true;
      c.x = clamp(dx * 6, -1, 1);
      c.z = clamp(dz * 6, -1, 1);
    } else c.x = 1;
  } else if (kind === 'bentoblocks') {
    const heights = Array.from({ length: 6 }, (_, x) => {
        let h = 0;
        for (let y = 0; y < 10; y++)
          if (s.grid[y * 6 + x]) h = Math.max(h, 10 - y);
        return h;
      }),
      color = s.piece[2],
      cost = heights.map(
        (h, x) => h - (h > 0 && s.grid[(10 - h) * 6 + x] === color ? 3 : 0),
      ),
      column = cost.indexOf(Math.min(...cost));
    c.x = Math.sign(column - s.piece[0]);
    c.b = s.piece[0] === column && tap;
    c.z = 1;
  } else if (kind === 'picnicpartition') {
    const center = p.team === 0 ? -8 : 8;
    if (s.energy < 0.15 || (p.input.b && s.energy < 0.9)) {
      go(center, 6);
      c.b = true;
    } else {
      const target =
        nearest(
          g.tiles.filter(
            (t) =>
              t.owner === p.team &&
              t.hp > 0 &&
              (i % 2 ? t.x >= center : t.x < center),
          ),
        ) ?? nearest(g.tiles.filter((t) => t.owner === p.team && t.hp > 0));
      if (target) {
        go(target.x, target.z);
        c.a = distance(p, target) < 0.8;
      }
    }
  } else if (kind === 'volleybuns') {
    const ball = g.objects.find((o) => o.kind === 'ball')!,
      onSide = p.team === 0 ? ball.z > -0.5 : ball.z < 0.5;
    const z = clamp(
      ball.z + ball.vz * 0.35,
      p.team === 0 ? 1 : -7,
      p.team === 0 ? 7 : -1,
    );
    go(
      onSide ? clamp(ball.x + ball.vx * 0.3, -6, 6) : i % 2 ? 3 : -3,
      onSide ? z : p.team === 0 ? 4 : -4,
    );
    c.a = distance(p, ball) < 1.7 && ball.y < 4.5 && tap;
  } else if (kind === 'puckpicnic' || kind === 'pineapplestrikers') {
    const ball = g.objects.find((o) => o.kind === 'ball')!,
      dir = p.team === 0 ? -1 : 1;
    go(ball.x, ball.z - dir * 0.65);
    if (distance(p, ball) < 1.3) {
      c.x = clamp(-ball.x * 0.2, -0.6, 0.6);
      c.z = dir;
      c.a = kind === 'pineapplestrikers' ? tap : w.tick % 45 < 26;
    }
  } else if (kind === 'goalguava') {
    if (i === g.solo) {
      const shot = g.objects
        .filter((o) => o.kind === 'guava')
        .sort((a, b) => a.z - b.z)[0];
      if (shot) {
        c.x = clamp(
          shot.x + shot.vx * Math.max(0, (shot.z + 7) / -shot.vz) - p.x,
          -1,
          1,
        );
        c.b = Math.abs(shot.x - p.x) > 1 && shot.z < -4;
        c.a = shot.y > 1.6 && shot.z < -4;
      }
    } else {
      const keeper = w.actors[g.solo];
      c.z = keeper.x > p.x ? 1 : -1;
      c.a = (w.tick + i * 15) % 100 < 45;
      c.x = clamp((i % 2 ? 4 : -4) - p.x, -1, 1);
    }
  } else if (kind === 'touchdowntiki') {
    if (i === g.solo) {
      const arch = [-5, 0, 5].sort((a, b) => {
        const danger = (x: number) =>
          w.actors
            .filter((_, j) => j !== i)
            .reduce(
              (v, p) => v + 1 / Math.max(1, Math.hypot(p.x - x, p.z + 4)),
              0,
            );
        return danger(a) - danger(b);
      })[0];
      go(arch, -8);
      c.a = tap && w.actors.some((o, j) => j !== i && distance(p, o) < 2.5);
    } else {
      const runner = w.actors[g.solo];
      go(runner.x + runner.vx * 0.25, runner.z + runner.vz * 0.25);
      c.a = distance(p, runner) < 1.6 && tap;
    }
  } else if (kind === 'paddleplunder') {
    const v = g.vehicles[p.team],
      target = g.objects
        .filter((o) => o.life > 0)
        .sort((a, b) => distance(a, v) - distance(b, v))[0];
    if (target) {
      let angle = Math.atan2(target.x - v.x, target.z - v.z) - v.face;
      angle = Math.atan2(Math.sin(angle), Math.cos(angle));
      c.a = Math.abs(angle) < 0.35 || (i % 2 ? angle < 0 : angle > 0);
      c.b = Math.abs(angle) > 1.8 && !c.a;
      c.x = clamp(angle, -1, 1);
    }
  } else if (kind === 'crateescape') {
    if (i === g.solo) {
      let x = -p.x * 0.35,
        z = -p.z * 0.35;
      for (const o of w.actors)
        if (o !== p) {
          const d = Math.max(0.4, distance(o, p));
          x += ((p.x - o.x) / d ** 2) * 4;
          z += ((p.z - o.z) / d ** 2) * 4;
        }
      c.x = clamp(x, -1, 1);
      c.z = clamp(z, -1, 1);
      c.a = tap;
    } else {
      go(w.actors[g.solo].x, w.actors[g.solo].z);
      c.a = tap;
    }
    for (const t of g.tiles)
      if (Math.abs(t.x - p.x - c.x) < 1.7 && Math.abs(t.z - p.z - c.z) < 1.7) {
        const x = c.x;
        c.x = -c.z || 1;
        c.z = x;
      }
  } else if (kind === 'rubblerunners') {
    const center = p.team === 0 ? -8 : 8,
      rock = g.tiles
        .filter(
          (t) =>
            t.owner === p.team &&
            t.hp > 0 &&
            (i % 2 ? t.x > center : t.x < center),
        )
        .sort((a, b) => b.z - a.z)[0];
    if (rock) {
      go(rock.x, rock.z + 1.3);
      if (distance(p, rock) < 2.2) {
        c.b = rock.tag === 1 && w.tick % 80 < 60;
        c.a = rock.tag !== 1 && tap;
      }
    } else go(center, -100);
  }
  const reaction = (w.tick + i * 31 + Math.floor(rand(w, i) * 70)) % 180;
  const lapse = level === 0 ? 25 : level === 1 ? 9 : 2;
  if (reaction < lapse && kind !== 'tidetiles') {
    c.x *= 0.25;
    c.z *= 0.25;
    c.a = false;
    c.b = false;
  }
  return c;
}
export function grandReadout(w: Arena, id: string) {
  const g = w.grand!,
    p = w.actors.find((p) => p.id === id) ?? w.actors[0],
    i = w.actors.indexOf(p),
    s = g.seats[i],
    info = grandInfo(w.kind)!;
  let title = info.action,
    detail = info.controls;
  if (info.heats) {
    title = `Heat ${g.phase + 1}/4 · ${i === g.solo ? 'SOLO ROLE' : 'CHASER / TEAM ROLE'}`;
    detail = `${Math.ceil(12 - (w.time % 13))}s · Solo role: player ${g.solo + 1} · ${info.controls}`;
  }
  if (w.kind === 'tidetiles') {
    title = `SAFE PAD: ${['SUN', 'LEAF', 'WAVE', 'SHELL', 'STAR', 'MOON', 'FLOWER'][g.target]}`;
    detail =
      'Follow the symbol beacon. Jump across gaps before the other pads sink.';
  }
  if (w.kind === 'picklepatrol') {
    title = `${p.lives} hearts · ${s.ammo}/3 shots`;
    detail = s.ammo === 0 ? 'Reloading… use cover' : info.controls;
  }
  if (w.kind === 'coconutcompass')
    title = `${s.coverage.filter(Boolean).length}/36 tiles uncovered`;
  if (
    w.kind === 'fossilfillet' ||
    w.kind === 'doughdouble' ||
    w.kind === 'lostluggage'
  )
    title =
      w.kind === 'lostluggage' && w.time < 5
        ? `MEMORIZE · ${Math.ceil(5 - w.time)}s`
        : `${p.score}% accuracy${w.kind === 'doughdouble' ? ` · Handle ${s.selection + 1}/6` : ''}`;
  if (w.kind === 'bentoblocks')
    title = `${p.score} ingredients · ${s.banked > 1 ? `${s.banked}× chain` : 'Match groups of 3'}`;
  if (w.kind === 'hooklinelunch')
    title =
      s.held >= 0
        ? `TENSION ${Math.round(s.energy * 100)}% · W reel / S slack`
        : `CAST POWER ${Math.round((p.charge / 1.5) * 100)}% · aim with A/D`;
  if (w.kind === 'coinquake')
    title = `Carrying ${Math.floor(s.water)} · Banked ${p.score}`;
  if (w.kind === 'postcardpanic') {
    const held = g.objects.find((o) => o.id === s.held);
    title = held
      ? `Deliver to ${held.tag === 0 ? 'ANY' : held.tag === 1 ? 'SUN' : 'MOON'} cart`
      : 'Pick up a letter with Space';
  }
  if (w.kind === 'raingarden')
    title =
      w.time % 8 < 1.3
        ? 'GUST! Close your planter with E'
        : `${Math.floor(s.water)} water · follow the rain cloud`;
  if (w.kind === 'sundaesummit')
    title = `${p.score} scoops · Wobble ${Math.round(s.wobble * 100)}%`;
  if (info.teams) {
    const partner = w.actors[p.team * 2 + (i % 2 ? 0 : 1)];
    detail = `Team ${p.team + 1} · Partner: player ${w.actors.indexOf(partner) + 1} · ${info.controls}`;
  }
  if (w.kind === 'frostyfreight' || w.kind === 'pelicanpilots')
    title = `${i % 2 ? 'REAR: ' + (w.kind === 'pelicanpilots' ? 'Space flap / E vent' : 'Space hop / steer & brake') : 'DRIVER: steer / Space boost / E brake'} · ${Math.floor(g.vehicles[p.team].distance)}m`;
  return { title, detail };
}
