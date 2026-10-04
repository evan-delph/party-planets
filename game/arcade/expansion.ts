import type { Arena, Control, Runner } from './simulation';
import { randomAt } from './simulation';
export const EXPANDED = ['sky', 'bomb', 'paint', 'dig', 'skate', 'factory'];
export type Cell = {
  x: number;
  z: number;
  owner: number;
  depth: number;
  prize: number;
  claimed: boolean;
};
export type Tray = {
  id: number;
  team: number;
  x: number;
  z: number;
  stage: number;
};
export type ExtraState = {
  cells: Cell[];
  holder: number;
  previous: number;
  fuse: number;
  passAt: number;
  trays: Tray[];
  trayId: number;
  spawnAt: number;
  orders: number[];
  explosions: number;
  explosionAt?: { x: number; z: number };
  target: number;
};
export function coursePlatforms(time = 0) {
  return Array.from({ length: 16 }, (_, i) => ({
    x:
      Math.sin(i * 0.82) * 3 +
      ([3, 7, 11, 13].includes(i) ? Math.sin(time * 1.05 + i) * 1.25 : 0),
    z: 6 - i * 4.1,
    w: i % 5 === 0 ? 5 : [4, 8, 12].includes(i) ? 1.25 : 2.65,
    d: [4, 8, 12].includes(i) ? 4 : 3.25,
    checkpoint: i % 5 === 0,
  }));
}
export function courseBridges(time = 0) {
  const pads = coursePlatforms(time);
  return [
    [1, 2],
    [8, 9],
  ].map(([from, to]) => ({ a: pads[from], b: pads[to], width: 0.85 }));
}
export function onSkyBridge(x: number, z: number, time: number) {
  return courseBridges(time).some(({ a, b, width }) => {
    const dx = b.x - a.x,
      dz = b.z - a.z,
      t = ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz);
    return (
      t >= 0 &&
      t <= 1 &&
      Math.hypot(x - a.x - t * dx, z - a.z - t * dz) < width / 2 - 0.1
    );
  });
}
export function startExpansion(w: Arena) {
  w.extra = {
    cells: [],
    holder: Math.floor(randomAt(w.seed, 21) * 4),
    previous: -1,
    fuse: 11,
    passAt: -2,
    trays: [],
    trayId: 0,
    spawnAt: 1,
    orders: [0, 0],
    explosions: 0,
    target: 0,
  };
  const e = w.extra;
  if (w.kind === 'paint' || w.kind === 'dig') {
    const cols = w.kind === 'paint' ? 10 : 12,
      rows = 10;
    for (let z = 0; z < rows; z++)
      for (let x = 0; x < cols; x++) {
        const i = z * cols + x;
        e.cells.push({
          x: (x - (cols - 1) / 2) * 1.5,
          z: (z - 4.5) * 1.5,
          owner: -1,
          depth: w.kind === 'dig' ? (randomAt(w.seed, i) > 0.75 ? 2 : 1) : 0,
          prize:
            w.kind === 'dig' ? (randomAt(w.seed, i + 900) > 0.9 ? 1 : 0) : 0,
          claimed: false,
        });
      }
    if (w.kind === 'dig') {
      e.cells[65].prize = 5;
      for (const idx of [0, 11, 108, 119]) {
        e.cells[idx].depth = 0;
        e.cells[idx].prize = 0;
        e.cells[idx + (idx % 12 === 0 ? 1 : -1)].prize = 1;
      }
    }
  }
  w.actors.forEach((p, i) => {
    p.gear = 0;
    p.distance = 0;
    p.checkpoint = 0;
    if (w.kind === 'sky') {
      p.x = (i - 1.5) * 0.8;
      p.z = 6;
    }
    if (w.kind === 'bomb') {
      p.x = (i < 2 ? -1 : 1) * 5;
      p.z = (i % 2 ? -1 : 1) * 5;
    }
    if (w.kind === 'dig') {
      const c = e.cells[[0, 11, 108, 119][i]];
      p.x = c.x;
      p.z = c.z;
      p.tx = p.x;
      p.tz = p.z;
    }
    if (w.kind === 'skate') {
      p.x = 7.2 + i * 0.65;
      p.z = 0;
      p.face = 0;
      p.gear = 0;
    }
    if (w.kind === 'factory') {
      p.x = (p.team === 0 ? -5 : 5) + (i % 2 ? 2.8 : -2.8);
      p.z = i % 2 ? 0 : -4;
    }
  });
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
function aim(p: Runner, x: number, z: number): Control {
  const dx = x - p.x,
    dz = z - p.z,
    d = Math.hypot(dx, dz);
  return {
    x: dx / Math.max(0.5, d),
    z: dz / Math.max(0.5, d),
    a: false,
    b: false,
    seq: 0,
  };
}
function wrapped(n: number) {
  return Math.atan2(Math.sin(n), Math.cos(n));
}
function cpu(w: Arena, p: Runner, i: number): Control {
  const e = w.extra!,
    c = { x: 0, z: 0, a: false, b: false, seq: 0 };
  if (w.kind === 'sky') {
    if (w.time < p.brainAt) return c;
    const pads = coursePlatforms(
        w.time +
          (p.y > 0.03
            ? Math.max(0, (p.vy + Math.sqrt(p.vy * p.vy + 46 * p.y)) / 23)
            : 0.8),
      ),
      dest = pads[Math.min(15, p.checkpoint + 1)];
    Object.assign(c, aim(p, dest.x, dest.z));
    c.a =
      p.stun <= 0 &&
      ((p.y < 0.03 && Math.hypot(p.x - dest.x, p.z - dest.z) > 1.5) ||
        p.vy > 0);
  }
  if (w.kind === 'bomb') {
    const holder = w.actors[e.holder];
    const enemy = w.actors
      .filter((o) => o.alive && o !== p)
      .sort(
        (a, b) =>
          Math.hypot(p.x - a.x, p.z - a.z) - Math.hypot(p.x - b.x, p.z - b.z),
      )[0];
    if (!enemy) return c;
    const chase = e.holder === i;
    let x = chase ? enemy.x + enemy.vx * 0.2 : p.x + (p.x - holder.x),
      z = chase ? enemy.z + enemy.vz * 0.2 : p.z + (p.z - holder.z);
    x = clamp(x, -7, 7);
    z = clamp(z, -7, 7);
    if (Math.sign(p.x) !== Math.sign(x) && Math.abs(p.z) < 3.5) {
      x = p.x;
      z = (p.z >= 0 ? 1 : -1) * 4;
    }
    Object.assign(c, aim(p, x, z));
    c.a =
      chase &&
      w.time - e.passAt > 0.5 &&
      w.actors.some(
        (a, j) =>
          a !== p &&
          a.alive &&
          !(j === e.previous && w.time - e.passAt < 1) &&
          Math.hypot(p.x - a.x, p.z - a.z) < 2.5,
      );
    c.b =
      Math.hypot(p.x - holder.x, p.z - holder.z) < 3 &&
      !chase &&
      p.cooldown <= 0;
  }
  if (w.kind === 'paint') {
    if (p.y <= 0.01 && w.time > p.brainAt) {
      const cells = e.cells
        .filter(
          (t) =>
            t.owner !== i &&
            Math.hypot(t.x, t.z) > 1.6 &&
            Math.hypot(t.x - p.x, t.z - p.z) < 5,
        )
        .sort(
          (a, b) =>
            randomAt(w.seed, w.tick + e.cells.indexOf(a) * 13 + i) -
            randomAt(w.seed, w.tick + e.cells.indexOf(b) * 13 + i),
        );
      const cell = cells[0] ?? e.cells[(w.tick + i * 23) % e.cells.length];
      p.tx = cell.x;
      p.tz = cell.z;
      p.brainAt = w.time + 1.5;
    }
    Object.assign(c, aim(p, p.tx, p.tz));
    c.a =
      p.y <= 0.01 &&
      p.charge < 0.55 + randomAt(w.seed, i * 17 + Math.floor(w.time)) * 0.65;
  }
  if (w.kind === 'dig') {
    let target = e.cells.find((t) => Math.hypot(t.x - p.tx, t.z - p.tz) < 0.1);
    if (!target || Math.hypot(p.x - target.x, p.z - target.z) < 0.2) {
      const current = e.cells.reduce((a, b) =>
        Math.hypot(p.x - a.x, p.z - a.z) < Math.hypot(p.x - b.x, p.z - b.z)
          ? a
          : b,
      );
      const neighbors = e.cells.filter(
        (t) =>
          Math.abs(t.x - current.x) + Math.abs(t.z - current.z) < 1.6 &&
          t !== current,
      );
      neighbors.sort(
        (a, b) =>
          (a.depth === 0 ? 2 : 0) +
          randomAt(w.seed, w.tick + e.cells.indexOf(a) * 71 + i) -
          (b.depth === 0 ? 2 : 0) -
          randomAt(w.seed, w.tick + e.cells.indexOf(b) * 71 + i),
      );
      target = neighbors[0] ?? current;
      p.tx = target.x;
      p.tz = target.z;
    }
    Object.assign(c, aim(p, target.x, target.z));
    c.a = target.depth > 0;
  }
  if (w.kind === 'skate') {
    const angle = Math.atan2(p.z / 0.72, p.x),
      r = 8.0 + randomAt(w.seed, i * 91) * 0.8,
      targetX = Math.cos(angle + 0.36) * r,
      targetZ = Math.sin(angle + 0.36) * r * 0.72;
    const desired = Math.atan2(targetX - p.x, targetZ - p.z);
    c.x = clamp(wrapped(desired - p.face) * 2.7, -1, 1);
    c.a = p.charge < 9.7 + w.difficulty * 0.7 + randomAt(w.seed, i * 41) * 0.8;
    c.b = Math.abs(wrapped(desired - p.face)) > 0.95 && p.charge > 7;
  }
  if (w.kind === 'factory') {
    if (w.time < p.brainAt) return p.input;
    p.brainAt = w.time + 0.18 + (2 - w.difficulty) * 0.12;
    const center = p.team === 0 ? -5 : 5,
      role = i % 2,
      ingredient = role + 1,
      supply = { x: center + (role ? 2.8 : -2.8), z: role ? 0 : -4 };
    if (p.gear === 0) {
      Object.assign(c, aim(p, supply.x, supply.z));
      c.a = Math.hypot(p.x - supply.x, p.z - supply.z) < 1;
    } else {
      const tray = e.trays
        .filter(
          (t) =>
            t.team === p.team &&
            t.stage === ingredient - 1 &&
            t.z < 5.2 &&
            randomAt(w.seed, t.id * 41 + i * 13) > 0.3 - w.difficulty * 0.135,
        )
        .sort((a, b) => b.z - a.z)[0];
      if (tray) {
        const eta = Math.hypot(p.x - tray.x, p.z - tray.z) / 5.7;
        Object.assign(c, aim(p, tray.x, tray.z + Math.min(1.6, eta * 1.7)));
        c.a = Math.hypot(p.x - tray.x, p.z - tray.z) < 1.3;
      } else
        Object.assign(c, aim(p, center + (role ? 1.5 : -1.5), role ? 1 : -3));
    }
  }
  return c;
}
export function stepExpansion(w: Arena) {
  if (w.done) return;
  const dt = 1 / 60;
  w.tick++;
  w.time = w.tick / 60;
  w.pulse = Math.max(0, w.pulse - dt * 2);
  const e = w.extra!,
    pads = coursePlatforms(w.time);
  for (let i = 0; i < w.actors.length; i++) {
    const p = w.actors[i];
    p.flash = Math.max(0, p.flash - dt);
    p.cooldown = Math.max(0, p.cooldown - dt);
    p.stun = Math.max(0, p.stun - dt);
    if (!p.alive) {
      p.y -= dt * 3;
      continue;
    }
    if (p.cpu) {
      p.input = cpu(w, p, i);
      p.inputAt = w.time;
    } else if (w.time - p.inputAt > 0.55)
      p.input = { ...p.input, x: 0, z: 0, a: false, b: false };
    const c = p.input,
      press = c.ap !== undefined ? c.ap > p.seenAP : c.a && !p.wasA,
      pressB = c.bp !== undefined ? c.bp > p.seenBP : c.b && !p.wasB,
      release = c.ar !== undefined ? c.ar > p.seenAR : !c.a && p.wasA;
    if (c.ap !== undefined && c.ap > p.seenAP) p.seenAP++;
    if (c.bp !== undefined && c.bp > p.seenBP) p.seenBP++;
    if (c.ar !== undefined && c.ar > p.seenAR) p.seenAR++;
    let x = c.x,
      z = c.z;
    const l = Math.max(1, Math.hypot(x, z));
    x /= l;
    z /= l;
    if (Math.hypot(x, z) > 0.1 && w.kind !== 'skate') p.face = Math.atan2(x, z);
    if (w.kind === 'skate') {
      if (!p.finish) {
        p.face += x * 2.3 * dt;
        p.charge = clamp(
          p.charge + (c.b ? -17 : c.a ? 6.5 : -2.8) * dt,
          0,
          11.5,
        );
        p.vx += (Math.sin(p.face) * p.charge - p.vx) * dt * 3;
        p.vz += (Math.cos(p.face) * p.charge - p.vz) * dt * 3;
        p.x += p.vx * dt;
        p.z += p.vz * dt;
        const r = Math.hypot(p.x, p.z / 0.72);
        if (r < 6.3 || r > 10.5) {
          const limit = clamp(r, 6.4, 10.4);
          p.x *= limit / r;
          p.z *= limit / r;
          p.charge *= 0.65;
          p.flash = 0.18;
        }
        const a = (Math.atan2(p.z / 0.72, p.x) + Math.PI * 2) % (Math.PI * 2),
          sector = Math.floor(a / (Math.PI / 2));
        if (sector === (p.checkpoint + 1) % 4) {
          p.checkpoint = sector;
          if (sector === 0) p.gear++;
        }
        p.distance = p.gear + p.checkpoint / 4;
        p.score =
          p.gear * 1000 +
          p.checkpoint * 250 +
          Math.floor((a / (Math.PI * 2)) * 200);
        if (p.gear >= 4) {
          p.finish = w.time;
          p.score = 100000 - Math.round(w.time * 100);
          if (!w.endAt) w.endAt = w.time + 5;
        }
      }
    } else if (w.kind === 'paint') {
      if (p.y <= 0.01 && c.a) p.charge = Math.min(1.3, p.charge + dt);
      if (release && p.y <= 0.01 && p.charge > 0.04) {
        p.vx = Math.sin(p.face) * (2.6 + p.charge * 3);
        p.vz = Math.cos(p.face) * (2.6 + p.charge * 3);
        p.vy = 4.6 + p.charge * 2;
        p.distance = 1 + p.charge * 0.3;
        p.charge = 0;
        p.jumps++;
      }
      const wasAir = p.y > 0 || p.vy > 0;
      p.vy -= 18 * dt;
      p.y += p.vy * dt;
      if (wasAir) {
        p.x = clamp(p.x + p.vx * dt, -7.2, 7.2);
        p.z = clamp(p.z + p.vz * dt, -7.2, 7.2);
      }
      if (p.y <= 0) {
        p.y = 0;
        p.vy = 0;
        if (Math.hypot(p.x, p.z) < 1.5) {
          const a = p.face;
          p.x = Math.sin(a) * 1.6;
          p.z = Math.cos(a) * 1.6;
        }
        if (wasAir) {
          for (const cell of e.cells)
            if (
              Math.hypot(
                Math.max(0, Math.abs(cell.x - p.x) - 0.72),
                Math.max(0, Math.abs(cell.z - p.z) - 0.72),
              ) <= p.distance &&
              Math.hypot(cell.x, cell.z) > 1.6
            )
              cell.owner = i;
          w.pulse = 0.4;
          p.flash = 0.15;
          p.gear++;
        }
      }
      p.score = e.cells.filter((t) => t.owner === i).length;
    } else {
      const speed =
        w.kind === 'bomb'
          ? e.holder === i
            ? 6.8
            : 6.1
          : w.kind === 'sky' && p.cpu
            ? 6 * (0.9 + w.difficulty * 0.04)
            : w.kind === 'sky' && c.b
              ? 2.5
              : 6;
      const slowed =
        w.kind === 'bomb' &&
        Math.abs(p.z) < 1.4 &&
        Math.abs(Math.abs(p.x) - 5) < 1.2 &&
        w.time % 7 < 1.4;
      p.vx += (x * speed * (slowed ? 0.4 : 1) - p.vx) * dt * 12;
      p.vz += (z * speed * (slowed ? 0.4 : 1) - p.vz) * dt * 12;
      if (w.kind === 'bomb' && pressB && p.cooldown <= 0) {
        p.vx += Math.sin(p.face) * 15;
        p.vz += Math.cos(p.face) * 15;
        p.cooldown = 3;
        p.flash = 0.15;
      }
      if (p.stun <= 0) {
        if (w.kind === 'sky' && p.y <= 0.02) {
          const beforePads = coursePlatforms(w.time - dt);
          const support = beforePads.findIndex(
            (t) =>
              Math.abs(p.x - t.x) < t.w / 2 && Math.abs(p.z - t.z) < t.d / 2,
          );
          if (support >= 0) p.x += pads[support].x - beforePads[support].x;
        }
        const nx = p.x + p.vx * dt,
          nz = p.z + p.vz * dt;
        if (w.kind === 'dig') {
          const cell = e.cells.reduce((a, b) =>
            Math.hypot(nx - a.x, nz - a.z) < Math.hypot(nx - b.x, nz - b.z)
              ? a
              : b,
          );
          if (cell.depth === 0) {
            p.x = clamp(nx, -8.5, 8.5);
            p.z = clamp(nz, -7, 7);
          }
        } else {
          p.x = nx;
          p.z = nz;
        }
      }
      if (w.kind === 'sky') {
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
        const standing = pads.findIndex(
          (t) =>
            Math.abs(p.x - t.x) < t.w / 2 - 0.15 &&
            Math.abs(p.z - t.z) < t.d / 2 - 0.12,
        );
        if (p.y <= 0.02) {
          if (standing < 0 && !onSkyBridge(p.x, p.z, w.time)) {
            const cp = Math.floor(p.checkpoint / 5) * 5;
            p.x = pads[cp].x;
            p.z = pads[cp].z;
            p.checkpoint = cp;
            p.vy = 0;
            p.stun = 0.6;
            p.flash = 0.6;
          } else if (standing > p.checkpoint && standing <= p.checkpoint + 1) {
            p.checkpoint = standing;
            if (p.cpu)
              p.brainAt =
                w.time +
                0.12 +
                (2 - w.difficulty) * 0.12 +
                randomAt(w.seed, i * 23 + standing * 71) * 0.2;
          }
        }
        p.score = p.finish
          ? 100000 - Math.round(p.finish * 100)
          : p.checkpoint * 500;
        if (p.checkpoint === 15 && !p.finish) {
          p.finish = w.time;
          p.score = 100000 - Math.round(w.time * 100);
          if (!w.endAt) w.endAt = w.time + 5;
        }
      } else if (w.kind === 'bomb') {
        p.x = clamp(p.x, -7.6, 7.6);
        p.z = clamp(p.z, -7.6, 7.6);
        if (Math.abs(p.x) < 1.9 && Math.abs(p.z) < 2.8) {
          if (Math.abs(p.x) / 1.9 > Math.abs(p.z) / 2.8)
            p.x = Math.sign(p.x || 1) * 1.91;
          else p.z = Math.sign(p.z || 1) * 2.81;
        }
        if (e.holder === i && press && w.time - e.passAt > 0.5) {
          const other = w.actors
            .map((a, j) => ({ a, j }))
            .filter(
              (o) =>
                o.j !== i &&
                o.a.alive &&
                !(o.j === e.previous && w.time - e.passAt < 1) &&
                Math.hypot(p.x - o.a.x, p.z - o.a.z) < 2.65,
            )
            .sort(
              (a, b) =>
                Math.hypot(p.x - a.a.x, p.z - a.a.z) -
                Math.hypot(p.x - b.a.x, p.z - b.a.z),
            )[0];
          if (other) {
            e.previous = i;
            e.holder = other.j;
            e.passAt = w.time;
            p.flash = 0.2;
          }
        }
        p.score = Math.round(w.time * 100);
      } else if (w.kind === 'dig') {
        if (c.a) {
          const tx = p.x + Math.sin(p.face) * 1.0,
            tz = p.z + Math.cos(p.face) * 1.0;
          const cell = e.cells.reduce((a, b) =>
            Math.hypot(tx - a.x, tz - a.z) < Math.hypot(tx - b.x, tz - b.z)
              ? a
              : b,
          );
          if (cell.depth > 0 && Math.hypot(cell.x - p.x, cell.z - p.z) < 2.1) {
            const index = e.cells.indexOf(cell);
            if (p.checkpoint !== index) {
              p.checkpoint = index;
              p.charge = 0;
            }
            p.charge += dt * (cell.depth === 2 ? 0.8 : 1.8);
            if (p.charge >= 1) {
              cell.depth = 0;
              p.charge = 0;
              p.gear++;
              if (!cell.claimed) {
                cell.claimed = true;
                p.score += cell.prize;
                p.flash = cell.prize ? 0.4 : 0.1;
              }
            }
          } else p.charge = 0;
        } else p.charge = 0;
      } else if (w.kind === 'factory') {
        const center = p.team === 0 ? -5 : 5;
        p.x = clamp(p.x, center - 4.2, center + 4.2);
        p.z = clamp(p.z, -7, 7);
        if (pressB) p.gear = 0;
        if (press) {
          if (p.gear === 0) {
            if (Math.hypot(p.x - (center - 2.8), p.z + 4) < 1.25) p.gear = 1;
            else if (Math.hypot(p.x - (center + 2.8), p.z) < 1.25) p.gear = 2;
          } else {
            const tray = e.trays
              .filter(
                (t) =>
                  t.team === p.team && Math.hypot(t.x - p.x, t.z - p.z) < 1.45,
              )
              .sort(
                (a, b) =>
                  Math.hypot(a.x - p.x, a.z - p.z) -
                  Math.hypot(b.x - p.x, b.z - p.z),
              )[0];
            if (tray) {
              tray.stage = p.gear === tray.stage + 1 ? tray.stage + 1 : -1;
              p.gear = 0;
              p.flash = 0.2;
            }
          }
        }
        p.score = e.orders[p.team];
      }
    }
    p.wasA = c.a;
    p.wasB = c.b;
  }
  if (w.kind === 'paint')
    w.actors.forEach(
      (p, i) => (p.score = e.cells.filter((t) => t.owner === i).length),
    );
  if (w.kind === 'bomb' && !w.endAt && w.time >= e.fuse) {
    const p = w.actors[e.holder];
    p.alive = false;
    p.outAt = w.time;
    p.score = Math.round(w.time * 100);
    e.explosions++;
    e.explosionAt = { x: p.x, z: p.z };
    w.pulse = 1;
    const live = w.actors.map((a, i) => ({ a, i })).filter((o) => o.a.alive);
    if (live.length <= 1) {
      w.endAt = w.time + 2;
      if (live.length) live[0].a.score = 100000 + Math.round(w.time * 100);
    } else {
      e.holder =
        live[Math.floor(randomAt(w.seed, e.explosions) * live.length)].i;
      e.fuse = w.time + 9 + randomAt(w.seed, e.explosions + 77) * 3;
      e.previous = -1;
    }
  }
  if (w.kind === 'factory') {
    if (w.time >= e.spawnAt) {
      for (let team = 0; team < 2; team++)
        e.trays.push({
          id: ++e.trayId,
          team,
          x: team === 0 ? -5 : 5,
          z: -6,
          stage: 0,
        });
      e.spawnAt += 3.2;
    }
    for (const t of e.trays) {
      t.z += dt * (1.25 + w.time * 0.008);
      if (t.z > 6 && t.stage === 2) {
        e.orders[t.team]++;
        w.pulse = 0.3;
        t.stage = 3;
      }
    }
    e.trays = e.trays.filter((t) => t.z <= 6);
    w.actors.forEach((p) => (p.score = e.orders[p.team]));
  }
  if (w.time >= w.duration || (w.endAt > 0 && w.time >= w.endAt)) {
    w.done = true;
    if (w.kind === 'bomb')
      for (const p of w.actors)
        if (p.alive) p.score = 100000 + Math.round(w.time * 100);
  }
}
