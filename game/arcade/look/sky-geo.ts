import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Deterministic 0..1 hash so every capture of the sky course is identical. */
export const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const hash3 = (x: number, y: number, z: number) =>
  hash(
    Math.round(x * 1000) * 0.0129898 +
      Math.round(y * 1000) * 0.078233 +
      Math.round(z * 1000) * 0.037719,
  );

type Paint =
  | T.ColorRepresentation
  | ((p: T.Vector3, n: T.Vector3, out: T.Color) => void);

/** Collects many small vertex-coloured parts and merges them into one mesh. */
export class Bucket {
  parts: T.BufferGeometry[] = [];
  add(
    src: T.BufferGeometry,
    m: T.Matrix4 | null,
    paint: Paint,
    opts: { worldUv?: number; jitter?: number } = {},
  ) {
    const g = src.index ? src.toNonIndexed() : src.clone();
    src.dispose();
    if (m) g.applyMatrix4(m);
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    const pos = g.getAttribute('position'),
      nor = g.getAttribute('normal'),
      cols = new Float32Array(pos.count * 3),
      p = new T.Vector3(),
      n = new T.Vector3(),
      c = new T.Color(),
      base = typeof paint === 'function' ? null : new T.Color(paint);
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i);
      n.fromBufferAttribute(nor, i);
      if (base) c.copy(base);
      else (paint as (p: T.Vector3, n: T.Vector3, out: T.Color) => void)(p, n, c);
      if (opts.jitter) {
        const j = 1 + (hash3(p.x, p.y, p.z) - 0.5) * opts.jitter;
        c.multiplyScalar(j);
      }
      cols.set([c.r, c.g, c.b], i * 3);
    }
    const out = new T.BufferGeometry();
    out.setAttribute('position', pos);
    out.setAttribute('normal', nor);
    out.setAttribute('color', new T.BufferAttribute(cols, 3));
    if (opts.worldUv) {
      const uv = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++)
        uv.set(
          [pos.getX(i) * opts.worldUv, pos.getZ(i) * opts.worldUv],
          i * 2,
        );
      out.setAttribute('uv', new T.BufferAttribute(uv, 2));
    } else
      out.setAttribute(
        'uv',
        g.getAttribute('uv') ??
          new T.BufferAttribute(new Float32Array(pos.count * 2), 2),
      );
    this.parts.push(out);
  }
  build(material: T.Material, shadows = true) {
    if (!this.parts.length) return null;
    const merged = mergeGeometries(this.parts, false);
    this.parts.forEach((g) => g.dispose());
    this.parts = [];
    if (!merged) return null;
    const mesh = new T.Mesh(merged, material);
    mesh.castShadow = shadows;
    mesh.receiveShadow = true;
    return mesh;
  }
}

export const at = (
  x: number,
  y: number,
  z: number,
  ry = 0,
  sx = 1,
  sy = sx,
  sz = sx,
  rx = 0,
  rz = 0,
) =>
  new T.Matrix4().compose(
    new T.Vector3(x, y, z),
    new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)),
    new T.Vector3(sx, sy, sz),
  );

export function roundRectShape(hw: number, hd: number, r: number) {
  r = Math.min(r, Math.min(hw, hd) * 0.995);
  const s = new T.Shape();
  s.moveTo(-hw + r, -hd);
  s.lineTo(hw - r, -hd);
  s.absarc(hw - r, -hd + r, r, -Math.PI / 2, 0, false);
  s.lineTo(hw, hd - r);
  s.absarc(hw - r, hd - r, r, 0, Math.PI / 2, false);
  s.lineTo(-hw + r, hd);
  s.absarc(-hw + r, hd - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(-hw, -hd + r);
  s.absarc(-hw + r, -hd + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

const mix = (a: string, b: string, t: number, out: T.Color) =>
  out.set(a).lerp(new T.Color(b), Math.max(0, Math.min(1, t)));

export type IslandBuckets = {
  grass: Bucket;
  rock: Bucket;
  leaf: Bucket;
  paint: Bucket;
};

/**
 * A floating island: a bevelled grass slab with mowed stripes, a grass fringe
 * spilling over the lip, and a faceted earth-and-rock body tapering to a
 * point, with hanging roots. Top surface sits at `y`.
 */
export function addIsland(
  b: IslandBuckets,
  o: {
    x: number;
    y: number;
    z: number;
    w: number;
    d: number;
    seed: number;
    round?: boolean;
    depth?: number;
    flowers?: number;
    keepCentre?: boolean;
    /** Spacing of the grass fringe blades; 0 turns the fringe off. */
    fringe?: number;
  },
) {
  const { x, y, z, w, d, seed } = o;
  const hw = w / 2 - 0.1,
    hd = d / 2 - 0.1;
  const slab = new T.ExtrudeGeometry(
    roundRectShape(hw, hd, o.round ? 99 : Math.min(0.6, Math.min(w, d) * 0.3)),
    {
      depth: 0.26,
      bevelEnabled: true,
      bevelThickness: 0.13,
      bevelSize: 0.1,
      bevelSegments: 3,
      curveSegments: o.round ? 10 : 5,
    },
  );
  slab.rotateX(-Math.PI / 2);
  slab.translate(x, y - 0.39, z);
  b.grass.add(
    slab,
    null,
    (p, n, c) => {
      if (n.y > 0.6) c.setRGB(1, 1, 1);
      else {
        const t = Math.max(0, (y - p.y) / 0.5);
        c.setRGB(0.78 - t * 0.2, 0.86 - t * 0.2, 0.68 - t * 0.2);
      }
    },
    { worldUv: 0.2, jitter: 0.08 },
  );
  // Rock body.
  const H = o.depth ?? 1.5 + Math.max(w, d) * 0.55 + hash(seed) * 0.9;
  const body = new T.CylinderGeometry(1, 1, H, o.round ? 18 : 16, 7);
  body.translate(0, -H / 2, 0);
  const pos = body.getAttribute('position');
  const ex = o.round ? 1 : 0.45,
    sq = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), ex),
    tipX = (hash(seed + 3) - 0.5) * w * 0.4,
    tipZ = (hash(seed + 4) - 0.5) * d * 0.3;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i),
      py = pos.getY(i),
      pz = pos.getZ(i);
    const t = Math.min(1, Math.max(0, -py / H)),
      r = Math.hypot(px, pz);
    if (r < 1e-4) {
      pos.setXYZ(i, x + tipX * t * t, y - 0.32 + py, z + tipZ * t * t);
      continue;
    }
    const a = Math.atan2(pz, px),
      jit = t < 0.04 ? 1 : 0.8 + 0.34 * hash3(px + seed, py, pz),
      profile = Math.pow(1 - t, 0.85) * (t < 0.04 ? 1 : 0.94);
    pos.setXYZ(
      i,
      x + sq(Math.cos(a)) * (hw + 0.04) * profile * jit * r + tipX * t * t,
      y - 0.32 + py + (t > 0.05 && t < 0.98 ? (hash3(pz, px, py) - 0.5) * 0.25 : 0),
      z + sq(Math.sin(a)) * (hd + 0.04) * profile * jit * r + tipZ * t * t,
    );
  }
  body.computeVertexNormals();
  const band = seed * 1.7;
  b.rock.add(
    body,
    null,
    (p, _n, c) => {
      const t = (y - 0.32 - p.y) / H;
      if (t < 0.09) mix('#6b4224', '#7a4c2a', t * 10, c);
      else {
        const strata = 0.5 + 0.5 * Math.sin(p.y * 5.5 + band);
        mix('#a57c56', '#86664c', strata, c);
        c.lerp(new T.Color('#5d4f5c'), Math.pow(t, 1.3) * 0.7);
      }
    },
    { jitter: 0.16 },
  );
  // Grass fringe spilling over the lip.
  const perimeter = 2 * (w + d),
    count = o.fringe === 0 ? 0 : Math.floor(perimeter / (o.fringe ?? 0.2));
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + hash(seed + i) * 0.05,
      px = x + sq(Math.cos(a)) * (hw + 0.1),
      pz = z + sq(Math.sin(a)) * (hd + 0.1),
      len = 0.22 + hash(seed * 3 + i) * 0.34;
    const blade = new T.ConeGeometry(0.075, len, 4);
    blade.rotateX(Math.PI);
    b.leaf.add(
      blade,
      at(px, y - 0.36 - len / 2, pz, a, 1, 1, 1, 0, 0),
      (p, _n, c) => mix('#57b83a', '#2f7a25', (y - 0.36 - p.y) / len, c),
    );
  }
  // Hanging roots.
  const roots = 3 + Math.floor(hash(seed + 9) * 3);
  for (let i = 0; i < roots; i++) {
    const a = hash(seed + i * 7) * Math.PI * 2,
      len = 0.6 + hash(seed + i * 11) * 1.4,
      rx = x + sq(Math.cos(a)) * hw * 0.85,
      rz = z + sq(Math.sin(a)) * hd * 0.85;
    const root = new T.CylinderGeometry(0.04, 0.012, len, 5);
    b.rock.add(
      root,
      at(rx, y - 0.6 - len / 2, rz, 0, 1, 1, 1, (hash(i + seed) - 0.5) * 0.4, (hash(i * 3 + seed) - 0.5) * 0.4),
      '#5a3a22',
    );
  }
  // Grass tufts and flowers kept towards the edges so the path reads clean.
  const flowers = o.flowers ?? Math.round(w * d * 0.45);
  for (let i = 0; i < flowers; i++) {
    let fx = (hash(seed * 5 + i) - 0.5) * 2 * (hw - 0.15),
      fz = (hash(seed * 7 + i) - 0.5) * 2 * (hd - 0.15);
    if (o.keepCentre !== false && Math.abs(fx) < hw * 0.55) {
      fx = Math.sign(fx || 1) * (hw * 0.6 + hash(seed + i * 13) * hw * 0.3);
    }
    if (o.round && Math.hypot(fx / hw, fz / hd) > 0.9) continue;
    if (i % 3 === 0) addTuft(b, x + fx, y, z + fz, seed + i);
    else addFlower(b, x + fx, y, z + fz, seed + i);
  }
}

const PETALS = ['#ff3d63', '#ffd02e', '#ffffff', '#ff7ccf', '#5aa8ff', '#ff8a2a'];
export function addFlower(
  b: IslandBuckets,
  x: number,
  y: number,
  z: number,
  seed: number,
  scale = 1,
) {
  const s = scale * (0.85 + hash(seed) * 0.4),
    h = 0.2 * s,
    color = PETALS[Math.floor(hash(seed + 1) * PETALS.length)];
  b.leaf.add(
    new T.CylinderGeometry(0.014 * s, 0.018 * s, h, 4),
    at(x, y + h / 2, z),
    '#3f9a2a',
  );
  // Five-sided petal cup: reads as a flower at play distance for few triangles.
  b.paint.add(
    new T.CylinderGeometry(0.15 * s, 0.05 * s, 0.05 * s, 5),
    at(x, y + h, z, seed),
    color,
  );
  b.paint.add(
    new T.SphereGeometry(0.05 * s, 5, 3),
    at(x, y + h + 0.02 * s, z),
    color === '#ffd02e' ? '#ff8a2a' : '#ffd02e',
  );
}

export function addTuft(
  b: IslandBuckets,
  x: number,
  y: number,
  z: number,
  seed: number,
) {
  for (let k = 0; k < 4; k++) {
    const h = 0.18 + hash(seed + k) * 0.16;
    b.leaf.add(
      new T.ConeGeometry(0.035, h, 3),
      at(
        x + (hash(seed * 2 + k) - 0.5) * 0.14,
        y + h / 2,
        z + (hash(seed * 3 + k) - 0.5) * 0.14,
        k,
        1,
        1,
        1,
        (hash(seed + k * 5) - 0.5) * 0.6,
        (hash(seed + k * 9) - 0.5) * 0.6,
      ),
      (p, _n, c) => mix('#3d9a2c', '#8fe05a', (p.y - y) / h, c),
    );
  }
}

/** A chunky stylised tree: tapered trunk and a cluster of soft canopy blobs. */
export function addTree(
  b: IslandBuckets,
  x: number,
  y: number,
  z: number,
  s: number,
  seed: number,
) {
  const trunkH = 1.25 * s;
  b.rock.add(
    new T.CylinderGeometry(0.13 * s, 0.22 * s, trunkH, 7),
    at(x, y + trunkH / 2, z, seed),
    (p, _n, c) => mix('#5a3519', '#8a5a32', (p.y - y) / trunkH, c),
  );
  const blobs = 3 + Math.floor(hash(seed) * 3),
    cy = y + trunkH + 0.45 * s,
    hue = hash(seed + 2);
  const top = hue < 0.33 ? '#a6ea5c' : hue < 0.66 ? '#8fe04e' : '#b5ee6a',
    low = hue < 0.5 ? '#2b7d2e' : '#33862a';
  for (let k = 0; k < blobs; k++) {
    const a = (k / blobs) * Math.PI * 2 + seed,
      r = (0.62 + hash(seed + k) * 0.32) * s,
      off = k === 0 ? 0 : 0.5 * s;
    const bx = x + Math.cos(a) * off,
      by = cy + (k === 0 ? 0.35 * s : (hash(seed + k * 3) - 0.3) * 0.4 * s),
      bz = z + Math.sin(a) * off;
    b.leaf.add(
      new T.SphereGeometry(r, 11, 8),
      at(bx, by, bz, a, 1, 0.9, 1),
      (p, n, c) => {
        const t = 0.5 + 0.5 * n.y * 0.8 + (p.y - cy) * 0.25 / s;
        mix(low, top, t, c);
      },
      { jitter: 0.06 },
    );
  }
}

/** Round topiary bush on the ground. */
export function addBush(
  b: IslandBuckets,
  x: number,
  y: number,
  z: number,
  s: number,
  seed: number,
) {
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + seed,
      r = (0.32 + hash(seed + k) * 0.16) * s;
    b.leaf.add(
      new T.IcosahedronGeometry(r, 1),
      at(x + Math.cos(a) * 0.22 * s, y + r * 0.7, z + Math.sin(a) * 0.22 * s),
      (_p, n, c) => mix('#2e7f2c', '#8ddc55', 0.5 + n.y * 0.5, c),
    );
  }
}

/** Wooden fence run between two points, with posts and two rails. */
export function addFence(
  wood: Bucket,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  y: number,
) {
  const len = Math.hypot(bx - ax, bz - az),
    ang = Math.atan2(bx - ax, bz - az),
    posts = Math.max(2, Math.round(len / 1.1) + 1);
  for (let i = 0; i < posts; i++) {
    const t = i / (posts - 1);
    wood.add(
      new T.CylinderGeometry(0.11, 0.13, 0.7, 7),
      at(ax + (bx - ax) * t, y + 0.33, az + (bz - az) * t),
      (p, n, c) => mix('#7a4d28', n.y > 0.5 ? '#e0b27a' : '#b07a45', (p.y - y) / 0.7 + 0.2, c),
    );
  }
  for (const h of [0.28, 0.52])
    wood.add(
      new T.BoxGeometry(0.07, 0.1, len),
      at((ax + bx) / 2, y + h, (az + bz) / 2, ang),
      '#b98149',
      { jitter: 0.1 },
    );
}

/** A soft cumulus puff: a cluster of spheres with a flattened, cool-shaded base. */
export function cloudPuff() {
  const parts: T.BufferGeometry[] = [];
  const blobs: [number, number, number, number][] = [
    [0, 0.25, 0, 1],
    [0.85, 0.05, 0.1, 0.72],
    [-0.85, 0.02, -0.05, 0.75],
    [0.35, 0.05, 0.62, 0.66],
    [-0.4, 0.0, -0.6, 0.62],
    [0.4, 0.55, -0.15, 0.62],
    [-0.35, 0.5, 0.25, 0.58],
  ];
  for (const [x, y, z, r] of blobs) {
    const g = new T.SphereGeometry(r, 16, 10);
    g.translate(x, y, z);
    parts.push(g);
  }
  const g = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  const pos = g.getAttribute('position'),
    cols = new Float32Array(pos.count * 3),
    c = new T.Color(),
    lo = new T.Color('#9fb2e2'),
    hi = new T.Color('#ffffff');
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < -0.2) pos.setY(i, -0.2 + (y + 0.2) * 0.25);
    c.copy(lo).lerp(hi, Math.max(0, Math.min(1, (y + 0.25) / 0.8)));
    cols.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new T.BufferAttribute(cols, 3));
  g.computeVertexNormals();
  return g;
}

/** Five-point star gem used for the jump-arc guide. */
export function starGeometry() {
  const s = new T.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.11 : 0.25,
      a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  const g = new T.ExtrudeGeometry(s, {
    depth: 0.05,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.03,
    bevelSegments: 2,
  });
  g.translate(0, 0, -0.025);
  return g;
}

/** Tileable lawn: diagonal mowing stripes plus thousands of blade strokes. */
export function grassTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d')!;
  x.fillStyle = '#3d9a2b';
  x.fillRect(0, 0, 512, 512);
  // Diagonal stripes: period 256 along (u + v) so the tile wraps cleanly.
  x.fillStyle = '#69c23e';
  for (let k = -4; k <= 4; k++) {
    const o = k * 256;
    x.beginPath();
    x.moveTo(o, 0);
    x.lineTo(o + 128, 0);
    x.lineTo(o + 128 + 512, 512);
    x.lineTo(o + 512, 512);
    x.closePath();
    x.fill();
  }
  const blades = ['#79cf4c', '#3f9628', '#8fdc5c', '#337f22', '#5fb83a'];
  let seed = 1;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  x.lineCap = 'round';
  for (let i = 0; i < 14000; i++) {
    const px = rnd() * 512,
      py = rnd() * 512,
      len = 3 + rnd() * 7,
      a = -Math.PI / 2 + (rnd() - 0.5) * 1.1;
    x.strokeStyle = blades[Math.floor(rnd() * blades.length)];
    x.globalAlpha = 0.35 + rnd() * 0.4;
    x.lineWidth = 1 + rnd() * 1.4;
    x.beginPath();
    x.moveTo(px, py);
    x.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len);
    x.stroke();
  }
  x.globalAlpha = 1;
  const tex = new T.CanvasTexture(c);
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Banner art for the course gates. */
export function bannerTexture(text: string, from: string, to: string) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 20, 0, 236);
  g.addColorStop(0, from);
  g.addColorStop(1, to);
  x.fillStyle = '#2b1d4a';
  x.beginPath();
  x.roundRect(8, 14, 1008, 228, 70);
  x.fill();
  x.fillStyle = g;
  x.beginPath();
  x.roundRect(26, 30, 972, 194, 56);
  x.fill();
  x.fillStyle = 'rgba(255,255,255,.35)';
  x.beginPath();
  x.roundRect(52, 42, 920, 60, 30);
  x.fill();
  let size = 150;
  const font = (s: number) =>
    `900 ${s}px "Arial Black", "Arial Rounded MT Bold", "Trebuchet MS", sans-serif`;
  x.font = font(size);
  while (x.measureText(text).width > 860 && size > 40) x.font = font((size -= 4));
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.lineJoin = 'round';
  x.lineWidth = 26;
  x.strokeStyle = '#2b1d4a';
  x.strokeText(text, 512, 134);
  x.fillStyle = '#ffffff';
  x.fillText(text, 512, 134);
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Racer name chip used above each alien. */
export function chipTexture(text: string, color: string) {
  const c = document.createElement('canvas');
  c.width = 320;
  c.height = 104;
  const x = c.getContext('2d')!;
  x.fillStyle = '#ffffff';
  x.beginPath();
  x.roundRect(4, 4, 312, 84, 42);
  x.fill();
  x.fillStyle = color;
  x.beginPath();
  x.roundRect(14, 14, 292, 64, 32);
  x.fill();
  // Little pointer under the chip.
  x.fillStyle = '#ffffff';
  x.beginPath();
  x.moveTo(140, 86);
  x.lineTo(180, 86);
  x.lineTo(160, 102);
  x.fill();
  let size = 48;
  const font = (s: number) => `900 ${s}px "Arial Black", "Trebuchet MS", sans-serif`;
  x.font = font(size);
  while (x.measureText(text).width > 260 && size > 20) x.font = font((size -= 2));
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.lineJoin = 'round';
  x.lineWidth = 10;
  x.strokeStyle = 'rgba(30,20,60,.85)';
  x.strokeText(text, 160, 48);
  x.fillStyle = '#ffffff';
  x.fillText(text, 160, 48);
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

/** Chunky down arrow with a white and navy outline, marking the local racer. */
export function arrowTexture(color: string) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 160;
  const x = c.getContext('2d')!;
  const path = () => {
    x.beginPath();
    x.moveTo(40, 14);
    x.lineTo(88, 14);
    x.lineTo(88, 70);
    x.lineTo(114, 70);
    x.lineTo(64, 138);
    x.lineTo(14, 70);
    x.lineTo(40, 70);
    x.closePath();
  };
  x.lineJoin = 'round';
  path();
  x.lineWidth = 22;
  x.strokeStyle = '#231b46';
  x.stroke();
  x.lineWidth = 12;
  x.strokeStyle = '#ffffff';
  x.stroke();
  const g = x.createLinearGradient(0, 14, 0, 138);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.25, color);
  g.addColorStop(1, color);
  x.fillStyle = g;
  path();
  x.fill();
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

/** Soft additive sun bloom with a hot core. */
export function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.06, 'rgba(255,250,225,0.95)');
  g.addColorStop(0.18, 'rgba(255,226,160,0.42)');
  g.addColorStop(0.45, 'rgba(255,214,150,0.12)');
  g.addColorStop(1, 'rgba(255,214,150,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

/** Radial falloff used as an alpha map for soft contact shadows. */
export function blobTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.45, '#bbbbbb');
  g.addColorStop(1, '#000000');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  return new T.CanvasTexture(c);
}

/**
 * Baked ambient occlusion for an island top: clear in the middle, darkening
 * towards the lip, so every lawn reads as a lit dome instead of a flat card.
 * Rounded rectangles use a box falloff, round islands an elliptical one.
 */
export function edgeAoTexture(round: boolean) {
  const n = 128,
    c = document.createElement('canvas');
  c.width = c.height = n;
  const x = c.getContext('2d')!,
    img = x.createImageData(n, n);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n - 0.5,
        v = (j + 0.5) / n - 0.5;
      const d = round
        ? Math.hypot(u, v) * 2
        : Math.pow(Math.pow(Math.abs(u) * 2, 5) + Math.pow(Math.abs(v) * 2, 5), 0.2);
      const t = Math.max(0, Math.min(1, (d - 0.4) / 0.55)),
        a = Math.pow(t, 1.8) * Math.max(0, Math.min(1, (1 - d) / 0.04)) * 255;
      const k = (j * n + i) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = a;
      img.data[k + 3] = 255;
    }
  x.putImageData(img, 0, 0);
  return new T.CanvasTexture(c);
}

export function checkerTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const x = c.getContext('2d')!;
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      x.fillStyle = (i + j) % 2 ? '#1d1b2e' : '#ffffff';
      x.fillRect(i * 16, j * 16, 16, 16);
    }
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  tex.magFilter = T.NearestFilter;
  return tex;
}
