import * as T from 'three';
import {
  mergeGeometries,
  mergeVertices,
} from 'three/addons/utils/BufferGeometryUtils.js';

/** Small seeded random generator so the dressing is identical every run. */
export function seaRandom(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const tmpColor = new T.Color();

/**
 * Collects many small vertex-coloured primitives and merges them into one
 * mesh per material, so the whole set dressing costs a handful of draw calls.
 */
export class SeaBatch {
  private parts = new Map<string, T.BufferGeometry[]>();
  constructor(private materials: Record<string, T.Material>) {}
  add(
    key: string,
    geometry: T.BufferGeometry,
    color: T.ColorRepresentation,
    matrix: T.Matrix4,
    shade?: (g: T.BufferGeometry) => void,
  ) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    for (const name of Object.keys(g.attributes))
      if (name !== 'position' && name !== 'normal' && name !== 'uv')
        g.deleteAttribute(name);
    if (!g.attributes.uv)
      g.setAttribute(
        'uv',
        new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2),
      );
    g.applyMatrix4(matrix);
    const n = g.attributes.position.count,
      colors = new Float32Array(n * 3);
    tmpColor.set(color);
    for (let i = 0; i < n; i++) colors.set([tmpColor.r, tmpColor.g, tmpColor.b], i * 3);
    g.setAttribute('color', new T.BufferAttribute(colors, 3));
    shade?.(g);
    if (!this.parts.has(key)) this.parts.set(key, []);
    this.parts.get(key)!.push(g);
    return g;
  }
  /** Convenience: add with position / rotation / scale. */
  put(
    key: string,
    geometry: T.BufferGeometry,
    color: T.ColorRepresentation,
    x: number,
    y: number,
    z: number,
    rx = 0,
    ry = 0,
    rz = 0,
    sx = 1,
    sy = sx,
    sz = sx,
  ) {
    const m = new T.Matrix4().compose(
      new T.Vector3(x, y, z),
      new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)),
      new T.Vector3(sx, sy, sz),
    );
    return this.add(key, geometry, color, m);
  }
  build(parent: T.Object3D, shadows = true) {
    const meshes: T.Mesh[] = [];
    for (const [key, list] of this.parts) {
      const merged = mergeGeometries(list);
      list.forEach((g) => g.dispose());
      if (!merged) continue;
      const mesh = new T.Mesh(merged, this.materials[key]);
      mesh.castShadow = shadows;
      mesh.receiveShadow = shadows;
      mesh.name = `Sea batch ${key}`;
      parent.add(mesh);
      meshes.push(mesh);
    }
    this.parts.clear();
    return meshes;
  }
}

/** Shared vertex-coloured materials for the sea set dressing. */
export function seaMaterials() {
  return {
    // Background dressing uses cheap Lambert shading (fewer, lighter shader
    // programs); only glossy props pay for PBR.
    matte: new T.MeshLambertMaterial({ vertexColors: true }),
    gloss: new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.32 }),
    rock: new T.MeshLambertMaterial({ vertexColors: true }),
    leaf: new T.MeshLambertMaterial({
      vertexColors: true,
      side: T.DoubleSide,
    }),
    glow: new T.MeshLambertMaterial({
      vertexColors: true,
      emissive: '#ffd36b',
      emissiveIntensity: 0.9,
    }),
  };
}

/** Displace a geometry's vertices with seeded lumpy noise (for rocks). */
export function lumpy(g: T.BufferGeometry, amount: number, seed: number) {
  const pos = g.attributes.position as T.BufferAttribute;
  const v = new T.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n =
      Math.sin(v.x * 2.1 + seed) * Math.cos(v.z * 1.7 - seed * 0.7) * 0.6 +
      Math.sin(v.y * 3.3 + v.x * 1.3 + seed * 1.9) * 0.4;
    v.multiplyScalar(1 + n * amount);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/** Darken vertices toward the bottom (cheap baked occlusion). */
export function gradeByHeight(
  g: T.BufferGeometry,
  low: number,
  high: number,
  dark = 0.55,
) {
  const pos = g.attributes.position as T.BufferAttribute;
  const col = g.attributes.color as T.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const t = T.MathUtils.clamp((pos.getY(i) - low) / (high - low), 0, 1);
    const k = dark + (1 - dark) * t;
    col.setXYZ(i, col.getX(i) * k, col.getY(i) * k, col.getZ(i) * k);
  }
}

/** One tropical palm, curved trunk and drooping fronds, into a batch. */
export function seaPalm(
  b: SeaBatch,
  x: number,
  y: number,
  z: number,
  scale = 1,
  lean = 0.25,
  turn = 0,
) {
  const seg = new T.CylinderGeometry(0.17, 0.22, 0.75, 9);
  let px = x,
    py = y,
    pz = z;
  const dir = new T.Vector3(Math.sin(turn), 0, Math.cos(turn));
  for (let i = 0; i < 7; i++) {
    const bend = lean * (i / 6) * (i / 6);
    const s = scale * (1 - i * 0.04);
    b.put(
      'matte',
      seg,
      i % 2 ? '#9a6a3c' : '#b98249',
      px,
      py + 0.37 * scale,
      pz,
      dir.z * bend,
      0,
      -dir.x * bend,
      s,
      scale,
      s,
    );
    px += dir.x * bend * 0.7 * scale;
    pz += dir.z * bend * 0.7 * scale;
    py += 0.68 * scale;
  }
  const leaf = new T.PlaneGeometry(0.75, 3.1, 2, 8);
  const lp = leaf.attributes.position as T.BufferAttribute;
  for (let i = 0; i < lp.count; i++) {
    const v = (lp.getY(i) + 1.55) / 3.1;
    const u = lp.getX(i);
    lp.setXYZ(
      i,
      u * (1 - v * 0.75) * (0.55 + Math.sin(v * Math.PI) * 0.6),
      v * 3.1,
      -v * v * 1.7 + Math.abs(u) * 0.35,
    );
  }
  leaf.rotateX(-Math.PI / 2 + 0.55);
  leaf.computeVertexNormals();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + turn;
    b.put(
      'leaf',
      leaf,
      i % 2 ? '#2fa64a' : '#4cc75a',
      px,
      py,
      pz,
      0,
      a,
      0,
      scale,
    );
  }
  const nut = new T.SphereGeometry(0.2, 8, 6);
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + turn;
    b.put(
      'gloss',
      nut,
      '#6b4224',
      px + Math.cos(a) * 0.2 * scale,
      py - 0.15 * scale,
      pz + Math.sin(a) * 0.2 * scale,
      0,
      0,
      0,
      scale,
    );
  }
  seg.dispose();
  leaf.dispose();
  nut.dispose();
}

/** A seeded lumpy rock. */
export function seaRock(
  b: SeaBatch,
  x: number,
  y: number,
  z: number,
  s: number,
  color: string,
  seed: number,
) {
  const base = lumpy(new T.IcosahedronGeometry(1, 2), 0.28, seed);
  base.deleteAttribute('normal');
  base.deleteAttribute('uv');
  const g = mergeVertices(base);
  base.dispose();
  g.computeVertexNormals();
  b.put('rock', g, color, x, y, z, seed, seed * 2, 0, s * 1.2, s * 0.8, s);
  g.dispose();
}

/** Canvas texture helper. */
export function canvasTexture(
  w: number,
  h: number,
  paint: (ctx: CanvasRenderingContext2D) => void,
) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d')!);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
