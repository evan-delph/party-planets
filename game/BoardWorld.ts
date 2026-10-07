import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { getBoard } from './boards';

/**
 * The world around and under the play route: a sky dome, an animated ocean
 * shaded from a baked shore-distance field, raised paver roads with bevelled
 * rims, direction chevrons at forks and player rings. Board art (terrain,
 * props, landmarks) still comes from the Blender GLB; this file frames it.
 */
type Board = ReturnType<typeof getBoard>;

export type WorldStyle = {
  /** Sky dome gradient; boards without one keep the plain clear colour. */
  sky?: { zenith: string; horizon: string; haze: string };
  /** Opaque animated ocean replacing the GLB's flat sea plane. */
  ocean?: { deep: string; mid: string; shallow: string; foam: string };
  path: { top: string; rim: string; branch: string; arrow: string; outline: string };
  /** Calm painterly turf blended over the scanned grass layer. */
  turf?: { color: string; calm: number; tone?: number };
  /** Terrain stand-in colours while the scanned textures download. */
  flats?: { sand: string; grass: string; rock: string };
  fog?: { color: string; near: number; far: number };
};

export const WORLD_STYLE: Record<string, WorldStyle> = {
  coral: {
    sky: { zenith: '#2c7fe0', horizon: '#bdeeff', haze: '#e9fbff' },
    ocean: { deep: '#0a3d8f', mid: '#0f74c4', shallow: '#38e0d6', foam: '#ffffff' },
    path: { top: '#fff3dd', rim: '#2e5f86', branch: '#bcd9f5', arrow: '#ffffff', outline: '#173a63' },
    turf: { color: '#47b874', calm: 0.93 },
    flats: { sand: '#f2dbd0', grass: '#47b874', rock: '#9b8a82' },
    fog: { color: '#bfe9ff', near: 3.2, far: 8 },
  },
  crown: {
    sky: { zenith: '#3a92e6', horizon: '#c9f1ff', haze: '#f0fcff' },
    ocean: { deep: '#0a4f8a', mid: '#0e8fb8', shallow: '#4fe6d0', foam: '#ffffff' },
    path: { top: '#f7e5bd', rim: '#7a5532', branch: '#b07a4f', arrow: '#ffffff', outline: '#4a2e14' },
    turf: { color: '#5aa845', calm: 0.45 },
    fog: { color: '#c9f1ff', near: 3.2, far: 8 },
  },
  crater: {
    path: { top: '#d4d9e6', rim: '#3a4058', branch: '#8c93a8', arrow: '#ffffff', outline: '#1d2236' },
    // Calm painted regolith hides the scan's tiling across the open plain.
    turf: { color: '#c4c9d6', calm: 0.6, tone: 0.3 },
    flats: { sand: '#6a7186', grass: '#a3aaba', rock: '#7d8496' },
    // Night haze kept beyond the board so the regolith stays crisp.
    fog: { color: '#2a3558', near: 3.4, far: 9 },
  },
  fissure: {
    path: { top: '#5a4a50', rim: '#1a1214', branch: '#6e5a52', arrow: '#ffd27a', outline: '#2a0f08' },
    // Warm the near-black ash scan toward a readable cinder brown.
    turf: { color: '#8a6a5e', calm: 0.55, tone: 0.5 },
    flats: { sand: '#3a3036', grass: '#7a5e54', rock: '#2e2529' },
    fog: { color: '#3a2438', near: 3.4, far: 9 },
  },
};

export const worldStyle = (id: string) => WORLD_STYLE[id] ?? WORLD_STYLE.crown;

/** Road surface height; BoardTiles' plinths (base 0.71) sit on top. */
export const ROAD_TOP = 0.735;
export const ROAD_HALF = 1.42;

// ── Baked field: height, distance to the route, distance to the shore ──────
export type Field = {
  texture: T.DataTexture;
  /** minX, minZ, size, sea level */
  box: T.Vector4;
  height(x: number, z: number): number;
};

export function buildField(terrain: T.Mesh, board: Board, seaLevel: number, res = 224): Field {
  terrain.updateWorldMatrix(true, false);
  const geometry = terrain.geometry,
    pos = geometry.getAttribute('position'),
    v = new T.Vector3();
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox!.clone().applyMatrix4(terrain.matrixWorld);
  const size = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z),
    minX = (bb.min.x + bb.max.x) / 2 - size / 2,
    minZ = (bb.min.z + bb.max.z) / 2 - size / 2,
    cell = size / (res - 1),
    floor = bb.min.y;
  const sum = new Float32Array(res * res),
    count = new Float32Array(res * res);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(terrain.matrixWorld);
    const cx = Math.round((v.x - minX) / cell),
      cz = Math.round((v.z - minZ) / cell);
    if (cx < 0 || cz < 0 || cx >= res || cz >= res) continue;
    sum[cz * res + cx] += v.y;
    count[cz * res + cx]++;
  }
  const h = new Float32Array(res * res).fill(NaN);
  for (let i = 0; i < h.length; i++) if (count[i]) h[i] = sum[i] / count[i];
  // Fill cells no vertex landed in from their neighbours.
  for (let pass = 0; pass < 6; pass++) {
    const copy = h.slice();
    let missing = 0;
    for (let z = 0; z < res; z++)
      for (let x = 0; x < res; x++) {
        const i = z * res + x;
        if (!Number.isNaN(copy[i])) continue;
        let s = 0,
          c = 0;
        for (let dz = -1; dz <= 1; dz++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx,
              nz = z + dz;
            if (nx < 0 || nz < 0 || nx >= res || nz >= res) continue;
            const q = copy[nz * res + nx];
            if (!Number.isNaN(q)) {
              s += q;
              c++;
            }
          }
        if (c) h[i] = s / c;
        else missing++;
      }
    if (!missing) break;
  }
  for (let i = 0; i < h.length; i++) if (Number.isNaN(h[i])) h[i] = floor;

  // Distance to the shore for water cells (two-pass chamfer transform).
  const INF = 1e6,
    shore = new Float32Array(res * res);
  for (let i = 0; i < h.length; i++) shore[i] = h[i] > seaLevel ? 0 : INF;
  const D = Math.SQRT2;
  for (let z = 0; z < res; z++)
    for (let x = 0; x < res; x++) {
      const i = z * res + x;
      let d = shore[i];
      if (x > 0) d = Math.min(d, shore[i - 1] + 1);
      if (z > 0) {
        d = Math.min(d, shore[i - res] + 1);
        if (x > 0) d = Math.min(d, shore[i - res - 1] + D);
        if (x < res - 1) d = Math.min(d, shore[i - res + 1] + D);
      }
      shore[i] = d;
    }
  for (let z = res - 1; z >= 0; z--)
    for (let x = res - 1; x >= 0; x--) {
      const i = z * res + x;
      let d = shore[i];
      if (x < res - 1) d = Math.min(d, shore[i + 1] + 1);
      if (z < res - 1) {
        d = Math.min(d, shore[i + res] + 1);
        if (x < res - 1) d = Math.min(d, shore[i + res + 1] + D);
        if (x > 0) d = Math.min(d, shore[i + res - 1] + D);
      }
      shore[i] = d;
    }

  // Distance to the nearest stretch of road.
  const nodes = board.spaces,
    segs: number[][] = [];
  for (const a of nodes) for (const n of a.next) segs.push([a.x, a.z, nodes[n].x, nodes[n].z]);
  const road = new Float32Array(res * res);
  for (let z = 0; z < res; z++)
    for (let x = 0; x < res; x++) {
      const px = minX + x * cell,
        pz = minZ + z * cell;
      let best = 99;
      for (const [ax, az, bx, bz] of segs) {
        const dx = bx - ax,
          dz = bz - az,
          t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
        const d = Math.hypot(px - ax - t * dx, pz - az - t * dz);
        if (d < best) best = d;
      }
      road[z * res + x] = best;
    }

  const data = new Uint16Array(res * res * 4);
  for (let i = 0; i < res * res; i++) {
    data[i * 4] = T.DataUtils.toHalfFloat(h[i]);
    data[i * 4 + 1] = T.DataUtils.toHalfFloat(Math.min(road[i], 60));
    data[i * 4 + 2] = T.DataUtils.toHalfFloat(Math.min(shore[i] * cell, 500));
    data[i * 4 + 3] = T.DataUtils.toHalfFloat(1);
  }
  const texture = new T.DataTexture(data, res, res, T.RGBAFormat, T.HalfFloatType);
  texture.magFilter = texture.minFilter = T.LinearFilter;
  texture.wrapS = texture.wrapT = T.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return {
    texture,
    box: new T.Vector4(minX, minZ, size, seaLevel),
    height(x, z) {
      const fx = T.MathUtils.clamp((x - minX) / cell, 0, res - 1.001),
        fz = T.MathUtils.clamp((z - minZ) / cell, 0, res - 1.001);
      const ix = Math.floor(fx),
        iz = Math.floor(fz),
        tx = fx - ix,
        tz = fz - iz;
      const a = h[iz * res + ix],
        b = h[iz * res + ix + 1],
        c = h[(iz + 1) * res + ix],
        d = h[(iz + 1) * res + ix + 1];
      return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
    },
  };
}

/**
 * One tileable 256² noise texture shared by the sky and ocean shaders, so the
 * per-pixel cost is a few texture reads instead of procedural noise (cheap on
 * laptop GPUs and in software rendering).
 * R: soft fbm · G: finer fbm · B: ridged web (caustics) · A: billowy fbm
 */
let noiseTexture: T.DataTexture | undefined;
export function sharedNoise() {
  if (noiseTexture) return noiseTexture;
  const N = 256,
    data = new Uint8Array(N * N * 4);
  const lattice = (period: number, seed: number) => {
    const g = new Float32Array(period * period);
    let s = seed;
    for (let i = 0; i < g.length; i++) {
      s = (s * 16807) % 2147483647;
      g[i] = s / 2147483647;
    }
    return (x: number, y: number) => {
      const fx = (x / N) * period,
        fy = (y / N) * period,
        ix = Math.floor(fx),
        iy = Math.floor(fy),
        tx = fx - ix,
        ty = fy - iy,
        ux = tx * tx * (3 - 2 * tx),
        uy = ty * ty * (3 - 2 * ty);
      const at = (a: number, b: number) => g[((b % period) * period + (a % period)) | 0];
      return (
        (at(ix, iy) * (1 - ux) + at(ix + 1, iy) * ux) * (1 - uy) +
        (at(ix, iy + 1) * (1 - ux) + at(ix + 1, iy + 1) * ux) * uy
      );
    };
  };
  const octaves = (base: number, count: number, seed: number) => {
    const layers = Array.from({ length: count }, (_, i) => lattice(base << i, seed + i * 101));
    return (x: number, y: number) => {
      let sum = 0,
        amp = 0.5,
        norm = 0;
      for (const l of layers) {
        sum += l(x, y) * amp;
        norm += amp;
        amp *= 0.5;
      }
      return sum / norm;
    };
  };
  const soft = octaves(4, 4, 11),
    fine = octaves(16, 3, 37),
    webA = lattice(12, 71),
    webB = lattice(12, 97),
    billow = octaves(6, 4, 131);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const i = (y * N + x) * 4;
      const web = Math.pow(Math.max(0, 1 - Math.abs(webA(x, y) - webB(x, y)) * 4), 5);
      data[i] = soft(x, y) * 255;
      data[i + 1] = fine(x, y) * 255;
      data[i + 2] = web * 255;
      data[i + 3] = billow(x, y) * 255;
    }
  noiseTexture = new T.DataTexture(data, N, N, T.RGBAFormat);
  noiseTexture.wrapS = noiseTexture.wrapT = T.RepeatWrapping;
  noiseTexture.magFilter = T.LinearFilter;
  noiseTexture.minFilter = T.LinearMipmapLinearFilter;
  noiseTexture.generateMipmaps = true;
  noiseTexture.needsUpdate = true;
  return noiseTexture;
}

// ── Sky dome ────────────────────────────────────────────────────────────────
export function createSkyDome(style: NonNullable<WorldStyle['sky']>, sunDir: T.Vector3) {
  const material = new T.ShaderMaterial({
    uniforms: {
      zenith: { value: new T.Color(style.zenith) },
      horizon: { value: new T.Color(style.horizon) },
      haze: { value: new T.Color(style.haze) },
      sunDir: { value: sunDir.clone().normalize() },
      time: { value: 0 },
      noise: { value: sharedNoise() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 p = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * p;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 zenith, horizon, haze, sunDir;
      uniform float time;
      uniform sampler2D noise;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(horizon, zenith, pow(smoothstep(0.0, 0.75, h), 0.8));
        col = mix(haze, col, smoothstep(-0.02, 0.16, h));
        float s = max(dot(d, normalize(sunDir)), 0.0);
        col += vec3(1.0, 0.92, 0.75) * (pow(s, 6.0) * 0.22 + pow(s, 400.0) * 1.5);
        vec2 uv = d.xz / max(h + 0.08, 0.04);
        float c = texture2D(noise, uv * 0.12 + vec2(time * 0.0006, 0.0)).a;
        c = smoothstep(0.5, 0.72, c) * smoothstep(0.0, 0.08, h) * (1.0 - smoothstep(0.35, 0.8, h));
        col = mix(col, vec3(1.0, 0.99, 0.97), c * 0.85);
        col = mix(col, haze, smoothstep(0.0, -0.25, h));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: T.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new T.Mesh(new T.SphereGeometry(1500, 48, 24), material);
  mesh.renderOrder = -100;
  mesh.frustumCulled = false;
  return {
    mesh,
    update(time: number, camera: T.Camera) {
      material.uniforms.time.value = time;
      mesh.position.copy(camera.position);
    },
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}

// ── Ocean ───────────────────────────────────────────────────────────────────
export function createOcean(
  style: NonNullable<WorldStyle['ocean']>,
  field: Field,
  sunDir: T.Vector3,
  horizon: string,
  radius: number,
) {
  const material = new T.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      field: { value: field.texture },
      box: { value: field.box },
      deep: { value: new T.Color(style.deep) },
      mid: { value: new T.Color(style.mid) },
      shallow: { value: new T.Color(style.shallow) },
      foam: { value: new T.Color(style.foam) },
      horizon: { value: new T.Color(horizon) },
      sunDir: { value: sunDir.clone().normalize() },
      fogRange: { value: new T.Vector2(radius * 3.4, radius * 9) },
      noise: { value: sharedNoise() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float time;
      uniform sampler2D field;
      uniform vec4 box;
      uniform vec3 deep, mid, shallow, foam, horizon, sunDir;
      uniform vec2 fogRange;
      uniform sampler2D noise;
      varying vec3 vWorld;
      float shoreDist(vec2 p) {
        vec2 uv = (p - box.xy) / box.z;
        float outside = max(max(-uv.x, uv.x - 1.0), max(-uv.y, uv.y - 1.0));
        float d = texture2D(field, clamp(uv, 0.0, 1.0)).b;
        return d + max(outside, 0.0) * box.z;
      }
      void main() {
        vec2 p = vWorld.xz;
        float t = time;
        // Wobbly lookup so foam lines breathe.
        vec4 n0 = texture2D(noise, p * 0.018 + vec2(t * 0.004, t * 0.003));
        float d = shoreDist(p + (n0.rg - 0.5) * 1.2);
        // Depth bands: bright lagoon shelf, a clear turquoise step, then deep blue.
        vec3 col = mix(shallow, mid, smoothstep(0.6, 7.0, d));
        col = mix(col, deep, smoothstep(6.0, 30.0, d));
        // Broad, slow value drift (cloud shade on the water), never busy.
        float broad = texture2D(noise, p * 0.0045 + vec2(t * 0.0008, 0.0)).a;
        col *= 0.92 + 0.16 * broad;
        // Soft caustic light over the shelf only.
        float shelf = 1.0 - smoothstep(0.5, 8.0, d);
        float c = texture2D(noise, p * 0.05 + vec2(t * 0.012, t * 0.008)).b
          * texture2D(noise, p * 0.041 - vec2(t * 0.009, -t * 0.011) + 0.37).b;
        col += vec3(0.8, 1.0, 0.95) * smoothstep(0.03, 0.3, c) * shelf * 0.2;
        // Sky sheen toward the horizon from a gentle, low-frequency swell.
        vec2 wuv = p * 0.006 + vec2(t * 0.0012, t * 0.0009);
        float h0 = texture2D(noise, wuv).r;
        float hx = texture2D(noise, wuv + vec2(0.012, 0.0)).r;
        float hz = texture2D(noise, wuv + vec2(0.0, 0.012)).r;
        vec3 n = normalize(vec3((h0 - hx) * 3.0, 1.0, (h0 - hz) * 3.0));
        vec3 view = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(n, view), 0.0), 5.0);
        col = mix(col, horizon, fres * 0.3);
        vec3 r = reflect(-view, n);
        col += vec3(1.0, 0.96, 0.85) * pow(max(dot(r, normalize(sunDir)), 0.0), 12.0) * 0.08 * (1.0 - shelf);
        // Surf: a solid lip at the shore, a soft wet band, and slow rings rolling in.
        float lip = 1.0 - smoothstep(0.12, 0.5 + n0.g * 0.45, d);
        float wet = (1.0 - smoothstep(0.4, 2.2, d)) * 0.18;
        float phase = fract(d * 0.32 - t * 0.22);
        float rings = smoothstep(0.0, 0.07, phase) * (1.0 - smoothstep(0.07, 0.24, phase));
        rings *= (1.0 - smoothstep(0.6, 4.2, d)) * smoothstep(0.42, 0.62, n0.a);
        float f = clamp(lip + rings * 0.55 + wet, 0.0, 1.0);
        col = mix(col, foam, f * 0.92);
        float dist = length(cameraPosition - vWorld);
        col = mix(col, horizon, smoothstep(fogRange.x, fogRange.y, dist));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new T.Mesh(new T.PlaneGeometry(radius * 16, radius * 16, 1, 1), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = field.box.w;
  mesh.renderOrder = -5;
  mesh.receiveShadow = false;
  return {
    mesh,
    update(time: number) {
      material.uniforms.time.value = time;
    },
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}

// ── Molten sea ──────────────────────────────────────────────────────────────
/**
 * Ember lava sea: drifting dark crust plates split by glowing seams (two
 * scales of the shared noise's ridged web), melting to bright molten lava
 * along the shore. Seamless at any distance, unlike a tiled photo map.
 */
export function createLavaSea(field: Field, horizon: string, radius: number) {
  const material = new T.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      field: { value: field.texture },
      box: { value: field.box },
      horizon: { value: new T.Color(horizon) },
      fogRange: { value: new T.Vector2(radius * 3.2, radius * 8) },
      noise: { value: sharedNoise() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float time;
      uniform sampler2D field;
      uniform vec4 box;
      uniform vec3 horizon;
      uniform vec2 fogRange;
      uniform sampler2D noise;
      varying vec3 vWorld;
      float shoreDist(vec2 p) {
        vec2 uv = (p - box.xy) / box.z;
        float outside = max(max(-uv.x, uv.x - 1.0), max(-uv.y, uv.y - 1.0));
        return texture2D(field, clamp(uv, 0.0, 1.0)).b + max(outside, 0.0) * box.z;
      }
      void main() {
        vec2 p = vWorld.xz;
        float t = time;
        vec4 n0 = texture2D(noise, p * 0.017 + vec2(t * 0.003, t * 0.002));
        float d = shoreDist(p + (n0.rg - 0.5) * 1.5);
        vec2 warp = (n0.rg - 0.5) * 0.06;
        float web1 = texture2D(noise, p * 0.016 + warp + vec2(t * 0.0025, -t * 0.0018)).b;
        float web2 = texture2D(noise, p * 0.043 - warp + vec2(-t * 0.004, t * 0.0015) + 0.41).b;
        float crack = max(web1, web2 * 0.55);
        vec3 crust = mix(vec3(0.075, 0.04, 0.045), vec3(0.24, 0.11, 0.08), smoothstep(0.3, 0.8, n0.a));
        vec3 hot = mix(vec3(1.0, 0.26, 0.04), vec3(1.0, 0.78, 0.28), smoothstep(0.55, 1.0, crack));
        // Seams glow brightest near the island and cool off across the open field.
        float glow = smoothstep(0.3, 0.75, crack) * mix(1.0, 0.55, smoothstep(8.0, 40.0, d));
        // Crust melts into a bright molten band along the shore.
        float melt = 1.0 - smoothstep(0.15, 2.6, d);
        glow = max(glow, melt * (0.5 + 0.35 * n0.r + 0.25 * crack));
        float pulse = 0.88 + 0.14 * sin(t * 1.6 + n0.r * 11.0);
        vec3 col = mix(crust, hot * 1.7 * pulse, glow);
        col += vec3(0.5, 0.12, 0.02) * (1.0 - smoothstep(0.0, 9.0, d)) * 0.35;
        float dist = length(cameraPosition - vWorld);
        col = mix(col, horizon, smoothstep(fogRange.x, fogRange.y, dist));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new T.Mesh(new T.PlaneGeometry(radius * 16, radius * 16, 1, 1), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = field.box.w;
  mesh.renderOrder = -5;
  return {
    mesh,
    update(time: number) {
      material.uniforms.time.value = time;
    },
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}

// ── Roads ───────────────────────────────────────────────────────────────────
function paverTexture() {
  const size = 512,
    canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#cfc6bb';
  c.fillRect(0, 0, size, size);
  // Irregular rounded flagstones on a jittered grid (orientation-free, tiles).
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const n = 5,
    step = size / n;
  for (let gy = -1; gy <= n; gy++)
    for (let gx = -1; gx <= n; gx++) {
      const jx = (rnd() - 0.5) * step * 0.25,
        jy = (rnd() - 0.5) * step * 0.25,
        w = step * (0.84 + rnd() * 0.1),
        h = step * (0.84 + rnd() * 0.1),
        x = gx * step + (gy % 2 ? step / 2 : 0) + jx,
        y = gy * step + jy,
        tone = 236 + Math.floor(rnd() * 19);
      for (const ox of [-size, 0, size])
        for (const oy of [-size, 0, size]) {
          const g = c.createLinearGradient(x + ox, y + oy, x + ox + w, y + oy + h);
          g.addColorStop(0, `rgb(${tone},${tone},${tone})`);
          g.addColorStop(1, `rgb(${tone - 14},${tone - 14},${tone - 12})`);
          c.fillStyle = g;
          c.beginPath();
          c.roundRect(x + ox, y + oy, w, h, step * 0.22);
          c.fill();
        }
    }
  const texture = new T.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export function createRoads(board: Board, style: WorldStyle['path']) {
  const root = new T.Group();
  const nodes = board.spaces;
  const half = ROAD_HALF;
  const pavers = paverTexture();
  const topMat = new T.MeshStandardMaterial({
    color: style.top,
    map: pavers,
    bumpMap: pavers,
    bumpScale: 1.2,
    roughness: 0.72,
  });
  const branchMat = new T.MeshStandardMaterial({
    color: style.branch,
    map: pavers,
    bumpMap: pavers,
    bumpScale: 1.2,
    roughness: 0.8,
  });
  const rimMat = new T.MeshStandardMaterial({ color: style.rim, roughness: 0.55 });
  // Cross-section, left to right: [offset, height] (top strip, then rims).
  const topProfile: [number, number][] = [
    [-half, 0],
    [-half * 0.5, 0.012],
    [0, 0.016],
    [half * 0.5, 0.012],
    [half, 0],
  ];
  const rimProfile: [number, number][] = [
    [0, 0],
    [0.07, -0.025],
    [0.13, -0.08],
    [0.17, -0.2],
    [0.2, -0.42],
  ];
  const tops: number[][] = [[], []],
    topUv: number[][] = [[], []],
    topIdx: number[][] = [[], []],
    rims: number[] = [],
    rimIdx: number[] = [];
  const uvScale = 1 / 3.2;
  board.districtRoads.forEach((road, r) => {
    const ids = [road.from, ...road.spaceIds, road.to];
    const curve = new T.CatmullRomCurve3(
      ids.map((id) => new T.Vector3(nodes[id].x, 0, nodes[id].z)),
      false,
      'centripetal',
    );
    const samples = Math.max(8, Math.ceil(curve.getLength() / 0.3));
    const y0 = ROAD_TOP + r * 0.0016;
    const branch = road === board.gateRoad ? 1 : 0;
    const P = tops[branch],
      U = topUv[branch],
      I = topIdx[branch];
    const topBase = P.length / 3,
      rimBase = rims.length / 3;
    const side = new T.Vector3();
    for (let i = 0; i <= samples; i++) {
      const t = i / samples,
        p = curve.getPointAt(t),
        tan = curve.getTangentAt(t);
      side.set(-tan.z, 0, tan.x).normalize();
      for (const [o, y] of topProfile) {
        const x = p.x + side.x * o,
          z = p.z + side.z * o;
        P.push(x, y0 + y, z);
        U.push(x * uvScale, z * uvScale);
      }
      for (const s of [-1, 1])
        for (const [o, y] of rimProfile) {
          const off = s * (half + o);
          rims.push(p.x + side.x * off, y0 + y, p.z + side.z * off);
        }
    }
    const tw = topProfile.length,
      rw = rimProfile.length;
    for (let i = 0; i < samples; i++) {
      for (let k = 0; k < tw - 1; k++) {
        const a = topBase + i * tw + k,
          b = a + tw;
        I.push(a, a + 1, b, a + 1, b + 1, b);
      }
      for (let s = 0; s < 2; s++)
        for (let k = 0; k < rw - 1; k++) {
          const a = rimBase + i * rw * 2 + s * rw + k,
            b = a + rw * 2;
          if (s === 0) rimIdx.push(a, b, a + 1, a + 1, b, b + 1);
          else rimIdx.push(a, a + 1, b, a + 1, b + 1, b);
        }
    }
  });
  const geos: T.BufferGeometry[] = [];
  [topMat, branchMat].forEach((mat, k) => {
    if (!topIdx[k].length) return;
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(tops[k], 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(topUv[k], 2));
    g.setIndex(topIdx[k]);
    g.computeVertexNormals();
    const m = new T.Mesh(g, mat);
    m.receiveShadow = true;
    m.castShadow = true;
    root.add(m);
    geos.push(g);
  });
  const rimGeo = new T.BufferGeometry();
  rimGeo.setAttribute('position', new T.Float32BufferAttribute(rims, 3));
  rimGeo.setIndex(rimIdx);
  rimGeo.computeVertexNormals();
  const rimMesh = new T.Mesh(rimGeo, rimMat);
  rimMesh.castShadow = rimMesh.receiveShadow = true;
  root.add(rimMesh);
  geos.push(rimGeo);

  // Round plazas cap every junction so meeting roads join cleanly.
  const incoming = new Map<number, number>();
  for (const a of nodes) for (const n of a.next) incoming.set(n, (incoming.get(n) ?? 0) + 1);
  const hubs = nodes.filter((n) => n.next.length > 1 || (incoming.get(n.id) ?? 0) > 1);
  const plazaGeo = new T.CircleGeometry(half + 0.35, 40);
  plazaGeo.rotateX(-Math.PI / 2);
  const plazaUv = plazaGeo.getAttribute('uv') as T.BufferAttribute;
  const plazaPos = plazaGeo.getAttribute('position') as T.BufferAttribute;
  const skirtGeo = new T.CylinderGeometry(half + 0.35, half + 0.6, 0.45, 40, 1, true);
  skirtGeo.deleteAttribute('uv');
  geos.push(plazaGeo, skirtGeo);
  if (hubs.length) {
    // One merged draw for all plazas and one for their rims.
    const plazas = hubs.map((hub) => {
      const g = plazaGeo.clone();
      const uv = g.getAttribute('uv') as T.BufferAttribute;
      for (let i = 0; i < plazaUv.count; i++)
        uv.setXY(i, (plazaPos.getX(i) + hub.x) * uvScale, (plazaPos.getZ(i) + hub.z) * uvScale);
      return g.translate(hub.x, ROAD_TOP + 0.03, hub.z);
    });
    const skirts = hubs.map((hub) => skirtGeo.clone().translate(hub.x, ROAD_TOP + 0.03 - 0.225, hub.z));
    const plazaAll = mergeGeometries(plazas)!,
      skirtAll = mergeGeometries(skirts)!;
    [...plazas, ...skirts].forEach((g) => g.dispose());
    const plaza = new T.Mesh(plazaAll, topMat);
    plaza.receiveShadow = true;
    const skirt = new T.Mesh(skirtAll, rimMat);
    skirt.castShadow = skirt.receiveShadow = true;
    root.add(plaza, skirt);
    geos.push(plazaAll, skirtAll);
  }

  // Chevrons on every road leaving a fork, plus a few along long stretches.
  const shape = new T.Shape();
  shape.moveTo(0, 0.55);
  shape.lineTo(0.55, 0.0);
  shape.lineTo(0.55, -0.32);
  shape.lineTo(0, 0.22);
  shape.lineTo(-0.55, -0.32);
  shape.lineTo(-0.55, 0.0);
  shape.closePath();
  const arrowGeo = new T.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.02, bevelSegments: 1 });
  arrowGeo.rotateX(-Math.PI / 2);
  const outlineGeo = new T.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.01, bevelSegments: 1 });
  outlineGeo.rotateX(-Math.PI / 2);
  geos.push(arrowGeo, outlineGeo);
  const arrowMat = new T.MeshStandardMaterial({
    color: style.arrow,
    emissive: style.arrow,
    emissiveIntensity: 0.25,
    roughness: 0.35,
  });
  const outlineMat = new T.MeshStandardMaterial({ color: style.outline, roughness: 0.6 });
  const spots: { x: number; z: number; a: number; s: number }[] = [];
  const TILE = 1.24;
  const addArrow = (from: number, to: number) => {
    const a = nodes[from],
      b = nodes[to],
      dist = Math.hypot(b.x - a.x, b.z - a.z),
      gap = dist - TILE * 2;
    const s = T.MathUtils.clamp(gap / 1.05, 0.55, 1);
    const along = TILE + Math.max(gap, 0) / 2;
    spots.push({
      x: a.x + ((b.x - a.x) / dist) * along,
      z: a.z + ((b.z - a.z) / dist) * along,
      a: Math.atan2(b.x - a.x, b.z - a.z),
      s,
    });
  };
  for (const n of nodes) if (n.next.length > 1) for (const to of n.next) addArrow(n.id, to);
  board.districtRoads.forEach((road) => {
    const ids = [road.from, ...road.spaceIds, road.to];
    for (let i = 2; i < ids.length - 2; i += 3) addArrow(ids[i], ids[i + 1]);
  });
  const arrows = new T.InstancedMesh(arrowGeo, arrowMat, spots.length),
    outlines = new T.InstancedMesh(outlineGeo, outlineMat, spots.length);
  const dummy = new T.Object3D();
  spots.forEach((s, i) => {
    dummy.position.set(s.x, ROAD_TOP + 0.03, s.z);
    dummy.rotation.set(0, s.a, 0);
    dummy.scale.setScalar(s.s);
    dummy.updateMatrix();
    outlines.setMatrixAt(i, dummy.matrix);
    dummy.position.y += 0.025;
    dummy.updateMatrix();
    arrows.setMatrixAt(i, dummy.matrix);
  });
  arrows.castShadow = true;
  outlines.receiveShadow = true;
  root.add(outlines, arrows);

  return {
    root,
    dispose() {
      root.removeFromParent();
      geos.forEach((g) => g.dispose());
      [topMat, branchMat, rimMat, arrowMat, outlineMat, pavers].forEach((d) => d.dispose());
    },
  };
}

// ── Player rings ────────────────────────────────────────────────────────────
export function createPlayerRings() {
  const root = new T.Group();
  const ringGeo = new T.RingGeometry(0.7, 1.0, 48);
  ringGeo.rotateX(-Math.PI / 2);
  const haloGeo = new T.RingGeometry(1.06, 1.36, 48);
  haloGeo.rotateX(-Math.PI / 2);
  const beamGeo = new T.CylinderGeometry(1.0, 1.15, 4, 32, 1, true);
  beamGeo.translate(0, 2, 0);
  const beamMat = new T.ShaderMaterial({
    uniforms: { color: { value: new T.Color('#ffffff') }, time: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 color; uniform float time; varying vec2 vUv;
      void main() {
        float a = pow(1.0 - vUv.y, 3.0) * (0.55 + 0.15 * sin(vUv.y * 30.0 - time * 6.0));
        gl_FragColor = vec4(color, a * 0.45);
      }`,
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
    // Only the far wall: a glow column behind the pawn that never veils it.
    side: T.BackSide,
  });
  const beam = new T.Mesh(beamGeo, beamMat);
  beam.renderOrder = 6;
  root.add(beam);
  const rings: { ring: T.Mesh; halo: T.Mesh }[] = [];
  const ensure = (n: number) => {
    while (rings.length < n) {
      const ring = new T.Mesh(
        ringGeo,
        new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, depthWrite: false }),
      );
      const halo = new T.Mesh(
        haloGeo,
        new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false }),
      );
      ring.renderOrder = halo.renderOrder = 4;
      root.add(ring, halo);
      rings.push({ ring, halo });
    }
  };
  return {
    root,
    update(
      meshes: T.Object3D[],
      colors: string[],
      active: number,
      time: number,
      reduced: boolean,
      show: boolean,
    ) {
      ensure(meshes.length);
      root.visible = show;
      beamMat.uniforms.time.value = time;
      rings.forEach((r, i) => {
        const m = meshes[i];
        const on = !!m && m.visible && show;
        r.ring.visible = r.halo.visible = on;
        if (!on) return;
        const ground = 0.975;
        const lift = Math.max(0, m.position.y - 0.96);
        const fade = 1 - Math.min(1, lift / 2.5);
        (r.ring.material as T.MeshBasicMaterial).color.set(colors[i] ?? '#ffffff');
        (r.ring.material as T.MeshBasicMaterial).opacity = 0.95 * fade;
        r.ring.position.set(m.position.x, ground + i * 0.002, m.position.z);
        const isActive = i === active;
        r.halo.visible = isActive;
        if (isActive) {
          const pulse = reduced ? 0 : (Math.sin(time * 4) + 1) / 2;
          r.halo.position.copy(r.ring.position).setY(ground + 0.01);
          r.halo.scale.setScalar(1 + pulse * 0.18);
          (r.halo.material as T.MeshBasicMaterial).color.set('#fff6c2');
          (r.halo.material as T.MeshBasicMaterial).opacity = (0.95 - pulse * 0.5) * fade;
          beam.position.set(m.position.x, ground, m.position.z);
          beamMat.uniforms.color.value.set(colors[i] ?? '#ffffff').lerp(new T.Color('#ffffff'), 0.35);
        }
      });
      beam.visible = show && !!meshes[active]?.visible;
    },
    dispose() {
      root.removeFromParent();
      ringGeo.dispose();
      haloGeo.dispose();
      beamGeo.dispose();
      beamMat.dispose();
      rings.forEach((r) => {
        (r.ring.material as T.Material).dispose();
        (r.halo.material as T.Material).dispose();
      });
    },
  };
}

// ── Prop thinning ───────────────────────────────────────────────────────────
/**
 * Thins the Blender scatter into deliberate clumps: instances survive where a
 * low-frequency cluster field is high (and a few become oversized heroes);
 * rocks that floated over the old cloud sea settle into the water as stacks.
 */
export function tidyInstances(
  island: T.Object3D,
  seaLevel: number,
  ground: (x: number, z: number) => number,
  keepRatio: (name: string) => number,
) {
  const m = new T.Matrix4(),
    p = new T.Vector3(),
    q = new T.Quaternion(),
    s = new T.Vector3();
  const cluster = (x: number, z: number) =>
    0.5 +
    0.28 * Math.sin(x * 0.21 + 1.3) * Math.cos(z * 0.19 - 0.7) +
    0.22 * Math.sin(x * 0.083 - z * 0.071 + 2.1);
  island.traverse((o) => {
    const mesh = o as T.InstancedMesh;
    if (!mesh.isInstancedMesh || mesh.userData.tidied) return;
    mesh.userData.tidied = true;
    const name = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material).name;
    const ratio = keepRatio(name);
    let kept = 0;
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, m);
      m.decompose(p, q, s);
      const islet = ground(p.x, p.z) < seaLevel + 0.2 && p.y > seaLevel + 0.3;
      if (islet) {
        // Former sky islets: sink into the sea as surf-ringed stacks.
        p.y = seaLevel - 0.25 * s.y;
        s.multiplyScalar(1.15);
      } else if (ratio < 1) {
        const c = cluster(p.x, p.z),
          jitter = (Math.sin(p.x * 12.9898 + p.z * 78.233) * 43758.5453) % 1;
        if (c + Math.abs(jitter) * 0.18 < 1 - ratio) continue;
        if (c > 0.86 && Math.abs(jitter) > 0.55) s.multiplyScalar(1.7);
        else if (c > 0.72) s.multiplyScalar(1.2);
      }
      m.compose(p, q, s);
      mesh.setMatrixAt(kept++, m);
    }
    mesh.count = kept;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  });
}
