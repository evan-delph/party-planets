import * as T from 'three';
const pixels = new Map<string, Uint8Array>();

// Deterministic, tileable material data; no external texture downloads.
export function surfaceTexture(kind = 'stone', size = 256) {
  const snow = /snow|ice|crystal/.test(kind),
    grass = /grass|jungle|lumen|moss|coral/.test(kind);
  const key = `${snow ? 'snow' : grass ? 'grass' : 'stone'}:${size}`,
    cached = pixels.get(key);
  const data = cached ?? new Uint8Array(size * size * 4);
  const hash = (x: number, y: number) => {
    let n = Math.imul((x & 255) + Math.imul(y & 255, 131), 1597334677);
    n = Math.imul(n ^ (n >>> 15), 2246822519);
    return ((n ^ (n >>> 13)) >>> 0) / 4294967295;
  };
  const noise = (x: number, y: number, scale: number) => {
    const gx = (x / size) * scale,
      gy = (y / size) * scale,
      ix = Math.floor(gx),
      iy = Math.floor(gy);
    let fx = gx - ix,
      fy = gy - iy;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    const a = hash(ix % scale, iy % scale),
      b = hash((ix + 1) % scale, iy % scale),
      c = hash(ix % scale, (iy + 1) % scale),
      d = hash((ix + 1) % scale, (iy + 1) % scale);
    return a + (b - a) * fx + (c - a + (d - c - b + a) * fx) * fy;
  };
  if (!cached)
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const grain = hash(x, y),
          broad = (noise(x, y, 7) * 0.65 + noise(x, y, 19) * 0.35 - 0.5) * 2;
        const blades = grass
          ? Math.pow(
              Math.max(0, Math.sin(x * 0.8 + Math.sin(y * 0.09) * 3)),
              14,
            ) * 0.25
          : 0;
        const ripple = !grass && !snow ? (noise(x, y, 31) - 0.5) * 0.08 : 0;
        const v = T.MathUtils.clamp(
          0.75 +
            (grain - 0.5) * (snow ? 0.13 : 0.26) +
            broad * 0.18 -
            blades +
            ripple,
          0.25,
          1,
        );
        const k = (y * size + x) * 4;
        data[k] = data[k + 1] = data[k + 2] = Math.round(v * 255);
        data[k + 3] = 255;
      }
  if (!cached) pixels.set(key, data);
  const texture = new T.DataTexture(data, size, size, T.RGBAFormat);
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.magFilter = T.LinearFilter;
  texture.minFilter = T.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

export function terrainMaterial(color: string, terrain: string, repeats = 28) {
  const texture = surfaceTexture(terrain, 512);
  texture.repeat.set(repeats, repeats);
  return new T.MeshStandardMaterial({
    color,
    map: texture,
    bumpMap: texture,
    bumpScale: /snow|ice/.test(terrain) ? 0.1 : 0.19,
    roughness: /ice|crystal/.test(terrain) ? 0.42 : 0.92,
    metalness: /crystal/.test(terrain) ? 0.12 : 0,
  });
}

export function addGroundDetail(
  parent: T.Object3D,
  board: {
    id: string;
    radius: number;
    ground: string;
    planet: string;
    terrain: string;
    spaces: { x: number; z: number; next: number[] }[];
    waterFeatures: { x: number; z: number; rx: number; rz: number }[];
  },
  low = false,
) {
  const grass = /grass|moss|jungle|lumen|coral/.test(board.terrain),
    snow = /snow|ice|crystal/.test(board.terrain);
  const count = low ? 360 : 1400;
  const geometry = grass
    ? new T.ConeGeometry(0.055, 0.27, 3)
    : new T.IcosahedronGeometry(snow ? 0.045 : 0.13, 0);
  geometry.translate(0, grass ? 0.13 : 0, 0);
  const mat = new T.MeshStandardMaterial({
    color: grass
      ? new T.Color(board.ground).multiplyScalar(0.72)
      : snow
        ? '#f5fcff'
        : '#827888',
    roughness: 0.92,
  });
  const tufts = new T.InstancedMesh(geometry, mat, count),
    d = new T.Object3D();
  let placed = 0;
  for (let i = 0; i < count * 3 && placed < count; i++) {
    const a = i * 2.39996,
      r = Math.sqrt((i * 0.6180339) % 1) * (board.radius - 2),
      x = Math.cos(a) * r,
      z = Math.sin(a) * r * 0.8;
    if (board.spaces.some((n) => Math.hypot(x - n.x, z - n.z) < 1.65)) continue;
    if (
      board.waterFeatures.some(
        (w) => Math.hypot((x - w.x) / (w.rx + 1), (z - w.z) / (w.rz + 1)) < 1,
      )
    )
      continue;
    d.position.set(x, 0.6, z);
    d.rotation.set(0, a, grass ? Math.sin(i) * 0.25 : 0);
    d.scale.setScalar(0.6 + (i % 7) * 0.13);
    d.updateMatrix();
    tufts.setMatrixAt(placed++, d.matrix);
  }
  tufts.count = placed;
  tufts.receiveShadow = true;
  parent.add(tufts);
  return tufts;
}
