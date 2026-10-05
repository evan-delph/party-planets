import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  cloudTexture,
  glowTexture,
  sparkleTexture,
  badgeTexture,
  popTexture,
} from './beach-textures';

/**
 * Reef Ring Rally presentation: a sunlit lagoon diorama with a sand beach in
 * the foreground, an animated depth-graded lagoon running to the horizon,
 * palm islands framing the sides, cumulus banks, chunky glowing rings and
 * cheeky jellyfish. Purely visual; the simulation is untouched.
 */

/** Saturated per-player accents for boards, water rings and badges. */
export const BEACH_COLORS = ['#ffc21a', '#ff3f7a', '#1ea7ff', '#9c5cff'];

/** Shoreline of the foreground beach (world z for a given x). */
const shoreZ = (x: number) => 8.6 + x * x * 0.0055;
/** Direction toward the key light (behind the camera, upper left). */
const SUN = new T.Vector3(-0.42, 0.66, 0.62).normalize();
export const BEACH_SUN = SUN;
/** Where the sun's glitter path sits on the water (toward the horizon). */
const GLINT = new T.Vector3(0.18, 0.2, -1).normalize();
/** Islands as x, z, radius (shared by the meshes and the water shader). */
const ISLANDS: [number, number, number][] = [
  [-22, -11, 7.5],
  [23.5, -17, 8.5],
  [-62, -95, 15],
  [48, -120, 13],
  [105, -150, 22],
  [-130, -165, 24],
  [8, -190, 9],
];
const OBJ = 16;
const SKY = {
  zenith: '#1569d8',
  upper: '#2f8fea',
  horizon: '#bfeaff',
  haze: '#d2f1ff',
};

// --- deterministic noise ----------------------------------------------------
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const rng = (seed: number) => {
  let i = seed;
  return () => hash(i++ * 1.618);
};

// --- geometry helpers --------------------------------------------------------
type Paint = (p: T.Vector3, i: number) => T.Color;
/** Non-indexed, uv-free, vertex-coloured copy so everything merges together. */
function prep(geo: T.BufferGeometry, paint: Paint | T.Color | string) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  g.deleteAttribute('uv');
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  const pos = g.getAttribute('position'),
    colors = new Float32Array(pos.count * 3),
    v = new T.Vector3(),
    flat =
      typeof paint === 'function'
        ? null
        : paint instanceof T.Color
          ? paint
          : new T.Color(paint);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const c = flat ?? (paint as Paint)(v, i);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new T.BufferAttribute(colors, 3));
  return g;
}

function gridGeometry(
  rows: T.Vector3[][],
  colorOf: (r: number, c: number) => T.Color,
) {
  const positions: number[] = [],
    colors: number[] = [];
  const push = (r: number, c: number) => {
    const p = rows[r][c],
      col = colorOf(r, c);
    positions.push(p.x, p.y, p.z);
    colors.push(col.r, col.g, col.b);
  };
  for (let r = 0; r < rows.length - 1; r++)
    for (let c = 0; c < rows[r].length - 1; c++) {
      push(r, c);
      push(r + 1, c);
      push(r, c + 1);
      push(r, c + 1);
      push(r + 1, c);
      push(r + 1, c + 1);
    }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

/** Segmented, tapering, gently curved palm trunk. */
function trunk(base: T.Vector3, h: number, lean: T.Vector3, r0: number) {
  const top = base.clone().add(new T.Vector3(lean.x, h, lean.z)),
    curve = new T.QuadraticBezierCurve3(
      base,
      base.clone().add(new T.Vector3(lean.x * 0.08, h * 0.55, lean.z * 0.08)),
      top,
    );
  const S = 22,
    R = 9,
    rows: T.Vector3[][] = [],
    dark = new T.Color('#6e4426'),
    light = new T.Color('#c99158'),
    mid = new T.Color('#a2703f');
  for (let i = 0; i <= S; i++) {
    const t = i / S,
      p = curve.getPoint(t),
      tan = curve.getTangent(t).normalize(),
      side = new T.Vector3().crossVectors(tan, new T.Vector3(0, 0, 1)).normalize(),
      fwd = new T.Vector3().crossVectors(side, tan).normalize(),
      r = r0 * (1 - t * 0.42) * (i % 2 ? 1.12 : 0.94) * (i === 0 ? 1.5 : 1);
    const row: T.Vector3[] = [];
    for (let j = 0; j <= R; j++) {
      const a = (j / R) * Math.PI * 2;
      row.push(
        p
          .clone()
          .addScaledVector(side, Math.cos(a) * r)
          .addScaledVector(fwd, Math.sin(a) * r),
      );
    }
    rows.push(row);
  }
  const geo = gridGeometry(rows, (r, c) => {
    const band = r % 2 ? light : dark;
    return mid.clone().lerp(band, 0.6).multiplyScalar(0.85 + 0.15 * Math.sin(c));
  });
  return { geo, top, tangent: curve.getTangent(1).normalize() };
}

/**
 * A leaf blade along an arching, drooping spine. Serrated blades read as palm
 * fronds; smooth wide ones as banana / jungle leaves.
 */
function leaf(
  origin: T.Vector3,
  yaw: number,
  lift: number,
  length: number,
  width: number,
  droop: number,
  base: string,
  tip: string,
  serrate: boolean,
  segments = 18,
) {
  const dir = new T.Vector3(Math.cos(yaw), 0, Math.sin(yaw)),
    side = new T.Vector3(-Math.sin(yaw), 0, Math.cos(yaw)),
    up = new T.Vector3(0, 1, 0),
    rows: T.Vector3[][] = [],
    cBase = new T.Color(base),
    cTip = new T.Color(tip),
    cRib = new T.Color(base).multiplyScalar(0.7);
  for (let i = 0; i <= segments; i++) {
    const s = i / segments,
      spine = origin
        .clone()
        .addScaledVector(dir, length * s * (1 - 0.18 * s))
        .addScaledVector(up, length * (lift * s - droop * s * s)),
      env = Math.pow(Math.sin(Math.PI * Math.min(1, s * 1.04 + 0.02)), 0.7),
      w =
        width *
        length *
        env *
        (serrate ? (i % 2 ? 0.42 : 1) : 1) *
        (i === segments ? 0 : 1),
      fold = w * 0.38;
    rows.push([
      spine.clone().addScaledVector(side, w).addScaledVector(up, -fold),
      spine.clone(),
      spine.clone().addScaledVector(side, -w).addScaledVector(up, -fold),
    ]);
  }
  return gridGeometry(rows, (r, c) => {
    const s = r / segments,
      edge = cBase.clone().lerp(cTip, Math.min(1, s * 1.1));
    return c === 1 ? cRib.clone().lerp(edge, 0.55) : edge;
  });
}

function palm(
  parts: Record<string, T.BufferGeometry[]>,
  base: T.Vector3,
  h: number,
  lean: T.Vector3,
  seed: number,
  scale = 1,
) {
  const r = rng(seed),
    t = trunk(base, h * scale, lean.clone().multiplyScalar(scale), 0.26 * scale);
  parts.trunk.push(t.geo);
  const fronds = 9,
    twist = r() * 6;
  for (let k = 0; k < fronds; k++) {
    const yaw = twist + (k / fronds) * Math.PI * 2 + (r() - 0.5) * 0.35,
      L = (2.7 + r() * 0.8) * scale,
      upper = k % 3 === 0;
    parts.frond.push(
      leaf(
        t.top,
        yaw,
        upper ? 0.75 : 0.42,
        L,
        0.2,
        upper ? 0.95 : 0.85,
        k % 2 ? '#14702d' : '#1b8436',
        k % 2 ? '#7fd544' : '#a4e04a',
        true,
      ),
    );
  }
  for (let k = 0; k < 3; k++) {
    const a = k * 2.1 + seed,
      nut = new T.SphereGeometry(0.17 * scale, 8, 6);
    nut.translate(
      t.top.x + Math.cos(a) * 0.2 * scale,
      t.top.y - 0.22 * scale,
      t.top.z + Math.sin(a) * 0.2 * scale,
    );
    parts.nut.push(prep(nut, '#6b4a22'));
  }
}

function bush(
  parts: Record<string, T.BufferGeometry[]>,
  at: T.Vector3,
  seed: number,
  scale = 1,
  flowers = true,
) {
  const r = rng(seed);
  for (let k = 0; k < 9; k++) {
    const yaw = (k / 9) * Math.PI * 2 + r() * 0.6;
    parts.frond.push(
      leaf(
        at,
        yaw,
        1.1 + r() * 0.5,
        (1.1 + r() * 0.5) * scale,
        0.24,
        1.2,
        '#127034',
        '#55c447',
        false,
        8,
      ),
    );
  }
  if (flowers)
    for (let k = 0; k < 4; k++) {
      const a = r() * 6.28,
        rad = (0.35 + r() * 0.45) * scale,
        f = new T.SphereGeometry(0.13 * scale, 7, 5);
      f.scale(1, 0.6, 1);
      f.translate(
        at.x + Math.cos(a) * rad,
        at.y + (0.55 + r() * 0.4) * scale,
        at.z + Math.sin(a) * rad,
      );
      parts.flower.push(prep(f, k % 2 ? '#ff3b6b' : '#ffb21f'));
    }
}

function island(
  parts: Record<string, T.BufferGeometry[]>,
  x: number,
  z: number,
  r: number,
  seed: number,
  detail: number,
) {
  const rand = rng(seed);
  // Sand skirt diving under the water line.
  const sand = new T.CylinderGeometry(r, r + 3.2, 1.4, 40, 2);
  const sp = sand.getAttribute('position');
  for (let i = 0; i < sp.count; i++) {
    const px = sp.getX(i),
      pz = sp.getZ(i),
      a = Math.atan2(pz, px),
      k = 1 + Math.sin(a * 3 + seed) * 0.08 + Math.sin(a * 7 + seed * 2) * 0.04;
    sp.setX(i, px * k);
    sp.setZ(i, pz * k);
  }
  sand.translate(x, -0.45, z);
  parts.sand.push(prep(sand, (p) => new T.Color(p.y > -0.2 ? '#f8e1a6' : '#e7c07c')));
  // Grassy mound.
  const hill = new T.SphereGeometry(1, 34, 14, 0, Math.PI * 2, 0, Math.PI / 2),
    hp = hill.getAttribute('position');
  for (let i = 0; i < hp.count; i++) {
    const px = hp.getX(i),
      py = hp.getY(i),
      pz = hp.getZ(i),
      a = Math.atan2(pz, px),
      k = 1 + Math.sin(a * 3 + seed) * 0.08 + Math.sin(a * 5 + seed) * 0.05;
    hp.setXYZ(
      i,
      x + px * (r - 1.1) * k,
      0.15 + py * (r * 0.32 + rand() * 0.04) * (1 + Math.sin(a * 2 + seed) * 0.2),
      z + pz * (r - 1.1) * k * 0.92,
    );
  }
  hill.computeVertexNormals();
  const low = new T.Color('#0d5e2a'),
    high = new T.Color('#3cb83a'),
    lime = new T.Color('#7ed957');
  parts.grass.push(
    prep(hill, (p) => {
      const h = Math.min(1, Math.max(0, (p.y - 0.1) / (r * 0.3))),
        mottle = Math.sin(p.x * 1.7 + p.z * 0.9) * Math.sin(p.z * 1.3 - p.x * 0.4);
      return low
        .clone()
        .lerp(high, Math.pow(h, 0.7))
        .lerp(lime, Math.max(0, mottle) * 0.35 * h)
        .multiplyScalar(0.9 + 0.1 * hash(Math.floor(p.x * 3) + Math.floor(p.z * 3) * 57));
    }),
  );
  const palms = Math.round((r / 1.6) * detail),
    s = r > 12 ? 1.6 : 1;
  for (let k = 0; k < palms; k++) {
    const a = rand() * Math.PI * 2,
      d = Math.sqrt(rand()) * (r - 2.2),
      bx = x + Math.cos(a) * d,
      bz = z + Math.sin(a) * d * 0.9,
      out = new T.Vector3(bx - x, 0, bz - z).normalize();
    palm(
      parts,
      new T.Vector3(bx, 0.3 + r * 0.22 * (1 - d / r), bz),
      5.2 + rand() * 2.6,
      out.multiplyScalar(1.4 + rand() * 1.4),
      seed * 13 + k,
      s,
    );
  }
  if (detail >= 1)
    for (let k = 0; k < Math.round(r * 0.9); k++) {
      const a = rand() * Math.PI * 2,
        d = (0.5 + rand() * 0.45) * (r - 1.5);
      bush(
        parts,
        new T.Vector3(x + Math.cos(a) * d, 0.35 + r * 0.12 * (1 - d / r), z + Math.sin(a) * d * 0.9),
        seed * 31 + k,
        0.9 + rand() * 0.6,
      );
    }
}

// --- materials ---------------------------------------------------------------
function waterMaterial(low: boolean) {
  const lin = (c: string) => new T.Color(c);
  return new T.ShaderMaterial({
    defines: { OBJ, ISL: ISLANDS.length, LOW: low ? 1 : 0 },
    uniforms: {
      uTime: { value: 0 },
      uSand: { value: lin('#e9d39a') },
      uShallow: { value: lin('#56f0d8') },
      uTurq: { value: lin('#14c9d4') },
      uTeal: { value: lin('#0a97c6') },
      uDeep: { value: lin('#0a4fa6') },
      uFoam: { value: lin('#ffffff') },
      uHorizon: { value: lin(SKY.horizon) },
      uZenith: { value: lin(SKY.upper) },
      uHaze: { value: lin(SKY.haze) },
      uSun: { value: SUN.clone() },
      uGlint: { value: GLINT.clone() },
      uShadow: {
        value: new T.Vector2(-SUN.x / SUN.y, -SUN.z / SUN.y),
      },
      uIslands: {
        value: ISLANDS.map(([x, z, r]) => new T.Vector4(x, z, r, 0)),
      },
      uObj: { value: Array.from({ length: OBJ }, () => new T.Vector4()) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uSand, uShallow, uTurq, uTeal, uDeep, uFoam, uHorizon, uZenith, uHaze, uSun, uGlint;
      uniform vec2 uShadow;
      uniform vec4 uIslands[ISL];
      uniform vec4 uObj[OBJ];
      varying vec3 vWorld;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
                   mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      float depthAt(vec2 p) {
        float d = (8.6 + p.x * p.x * 0.0055) - p.y;
        float depth = d * 0.055 + smoothstep(14.0, 90.0, d) * 3.6;
        for (int i = 0; i < ISL; i++) {
          vec4 s = uIslands[i];
          float di = length(p - s.xy) - s.z - 1.6;
          depth = min(depth, di * 0.12 + smoothstep(3.0, 26.0, di) * 2.2);
        }
        return depth;
      }
      // Tileable caustic web (after the classic "tileable water caustic").
      float caustic(vec2 uv, float t) {
        vec2 p = mod(uv * 6.28318, 6.28318) - 250.0;
        vec2 i = p;
        float c = 1.0;
        for (int n = 0; n < 4; n++) {
          float tt = t * (1.0 - (3.5 / float(n + 1)));
          i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
          c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / 0.005), p.y / (cos(i.y + tt) / 0.005)));
        }
        c /= 4.0;
        c = 1.17 - pow(c, 1.4);
        return clamp(pow(abs(c), 8.0), 0.0, 1.0);
      }
      vec2 wave(vec2 p, vec2 d, float k, float s, float a, float t) {
        d = normalize(d);
        return d * (a * k * cos(dot(d, p) * k + t * s));
      }
      void main() {
        vec2 p = vWorld.xz;
        float t = uTime;
        vec3 toCam = cameraPosition - vWorld;
        float dist = length(toCam);
        vec3 v = toCam / dist;
        float fade = 1.0 / (1.0 + dist * 0.035);
        float depth = depthAt(p);

        vec2 g = wave(p, vec2(0.25, 1.0), 0.45, 1.2, 0.16, t)
               + wave(p, vec2(-0.7, 0.7), 0.8, 1.6, 0.09, t)
               + wave(p, vec2(1.0, 0.3), 1.5, 2.2, 0.05 * fade, t)
               + wave(p, vec2(-0.3, -1.0), 2.6, 2.9, 0.03 * fade, t)
               + wave(p, vec2(0.6, -0.8), 4.1, 3.8, 0.018 * fade, t);
        #if LOW == 0
        vec2 q = p * 1.3 + vec2(t * 0.32, -t * 0.22);
        float n0 = vnoise(q), nx = vnoise(q + vec2(0.2, 0.0)), nz = vnoise(q + vec2(0.0, 0.2));
        g += vec2(nx - n0, nz - n0) * 1.1 * fade;
        #endif
        vec3 n = normalize(vec3(-g.x, 1.0, -g.y));

        vec3 col = mix(uSand, uShallow, smoothstep(-0.02, 0.28, depth));
        col = mix(col, uTurq, smoothstep(0.25, 1.0, depth));
        col = mix(col, uTeal, smoothstep(1.0, 2.4, depth));
        col = mix(col, uDeep, smoothstep(2.4, 5.2, depth));
        // Sandy ripples on the lagoon floor show through the shallows.
        float floorRipple = vnoise(p * vec2(0.9, 2.4) + vnoise(p * 0.3) * 2.0);
        col *= 1.0 - 0.07 * floorRipple * (1.0 - smoothstep(0.2, 1.6, depth));
        #if LOW == 0
        float cs = (1.0 - smoothstep(0.15, 2.6, depth)) * (0.4 + 0.6 * fade);
        vec2 cuv = p * 0.085 + g * 0.05;
        col += vec3(0.85, 1.0, 0.95) * caustic(cuv, t * 0.55) * 0.55 * cs;
        #endif

        float shade = 1.0, foam = 0.0;
        for (int i = 0; i < OBJ; i++) {
          vec4 o = uObj[i];
          if (o.w < 0.5) continue;
          bool player = o.w > 2.5;
          vec2 sp = o.xy + uShadow * (player ? 0.25 : 1.05);
          float ds = length((p - sp) * vec2(1.0, player ? 0.55 : 1.0));
          shade *= 1.0 - (player ? 0.32 : 0.28) * smoothstep(o.z * 1.05, o.z * 0.2, ds);
          float d0 = length(p - o.xy);
          float wob = o.z * (1.12 + 0.1 * sin(t * 3.3 + float(i) * 1.7));
          float ring = smoothstep(0.17, 0.0, abs(d0 - wob));
          ring += 0.6 * smoothstep(0.12, 0.0, abs(d0 - wob * 1.45 - 0.08 * sin(t * 2.0 + float(i))));
          foam += ring * (player ? 0.85 : 0.5);
        }
        col *= shade;
        col *= 0.82 + 0.3 * max(dot(n, uSun), 0.0);

        vec3 r = reflect(-v, n);
        vec3 sky = mix(uHorizon, uZenith, smoothstep(0.0, 0.45, r.y));
        float F = 0.02 + 0.98 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
        col = mix(col, sky, clamp(F * 0.8, 0.0, 0.62));

        float sp = max(dot(r, uGlint), 0.0);
        col += vec3(1.0, 0.96, 0.86) * (pow(sp, 900.0) * 5.0 + pow(sp, 90.0) * 0.45 + pow(sp, 12.0) * 0.05);
        #if LOW == 0
        float glitter = smoothstep(0.93, 1.0, vnoise(p * vec2(7.0, 11.0) + vec2(t * 1.7, -t * 1.1)));
        col += glitter * (0.25 + 1.6 * pow(sp, 8.0)) * fade * 1.4;
        #endif

        float edge = 1.0 - smoothstep(0.0, 0.42, depth);
        float lines = smoothstep(0.62, 0.95, sin(depth * 40.0 - t * 2.4 + vnoise(p * 0.7) * 4.0) * 0.5 + 0.5);
        float shoreFoam = edge * (0.45 + 0.55 * lines) + smoothstep(0.08, 0.0, depth);
        float breakup = smoothstep(0.25, 0.7, vnoise(p * 2.6 + vec2(t * 0.25, t * 0.1)) * 0.7 + 0.3);
        foam = clamp((foam + shoreFoam) * breakup, 0.0, 1.0);
        col = mix(col, uFoam, foam * 0.92);

        col = mix(col, uHaze, smoothstep(55.0, 330.0, dist) * 0.88);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

function skyDome() {
  const lin = (c: string) => new T.Color(c);
  const dome = new T.Mesh(
    new T.SphereGeometry(400, 32, 16),
    new T.ShaderMaterial({
      side: T.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        zenith: { value: lin(SKY.zenith) },
        upper: { value: lin(SKY.upper) },
        horizon: { value: lin(SKY.horizon) },
        glint: { value: GLINT.clone() },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 zenith, upper, horizon, glint;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y, 0.0, 1.0);
          vec3 c = mix(horizon, upper, smoothstep(0.0, 0.22, h));
          c = mix(c, zenith, smoothstep(0.2, 0.75, h));
          float glow = pow(max(dot(vDir, normalize(vec3(glint.x, 0.06, glint.z))), 0.0), 6.0);
          c += vec3(1.0, 0.95, 0.82) * glow * 0.18 * (1.0 - smoothstep(0.0, 0.3, h));
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    }),
  );
  dome.name = 'Beach sky';
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  dome.matrixAutoUpdate = false;
  dome.onBeforeRender = (_r, _s, camera) =>
    dome.matrixWorld.makeTranslation(camera.position);
  return dome;
}

// --- collectibles -------------------------------------------------------------
type Shared = {
  ringGeo: T.TorusGeometry;
  bigRingGeo: T.TorusGeometry;
  gold: T.MeshStandardMaterial;
  coral: T.MeshStandardMaterial;
  starGeo: T.ExtrudeGeometry;
  starMat: T.MeshStandardMaterial;
  glowGold: T.SpriteMaterial;
  glowPink: T.SpriteMaterial;
  glowJelly: T.SpriteMaterial;
  sparkle: T.SpriteMaterial;
  bell: T.SphereGeometry;
  bellMat: T.MeshStandardMaterial;
  coreMat: T.MeshStandardMaterial;
  frillGeo: T.TorusGeometry;
  frillMat: T.MeshStandardMaterial;
  tentGeo: T.TubeGeometry;
  tentMat: T.MeshStandardMaterial;
  eyeGeo: T.SphereGeometry;
  eyeMat: T.MeshStandardMaterial;
  pupilGeo: T.SphereGeometry;
  pupilMat: T.MeshBasicMaterial;
  browGeo: T.BoxGeometry;
  spotGeo: T.SphereGeometry;
  spotMat: T.MeshStandardMaterial;
  dangerGeo: T.RingGeometry;
  dangerMat: T.MeshBasicMaterial;
  discGeo: T.CircleGeometry;
  discMat: T.MeshBasicMaterial;
  all: (T.BufferGeometry | T.Material)[];
};

function starShape(outer: number, inner: number) {
  const s = new T.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5,
      r = i % 2 ? inner : outer;
    if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return s;
}

function makeShared(): Shared {
  const glow = glowTexture(),
    spark = sparkleTexture();
  const additive = (color: string, map: T.Texture, opacity: number) =>
    new T.SpriteMaterial({
      map,
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: T.AdditiveBlending,
      toneMapped: false,
      fog: false,
    });
  const tentCurve = new T.CatmullRomCurve3(
    Array.from({ length: 6 }, (_, i) =>
      new T.Vector3(Math.sin(i * 1.3) * 0.07, -i * 0.15, Math.cos(i * 1.1) * 0.05),
    ),
  );
  const starGeo = new T.ExtrudeGeometry(starShape(0.42, 0.19), {
    depth: 0.12,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.05,
    bevelSegments: 2,
  });
  starGeo.center();
  const s: Omit<Shared, 'all'> = {
    ringGeo: new T.TorusGeometry(0.86, 0.23, 14, 44),
    bigRingGeo: new T.TorusGeometry(1.02, 0.27, 14, 48),
    gold: new T.MeshStandardMaterial({
      color: '#ffc72e',
      emissive: '#ff8a00',
      emissiveIntensity: 0.42,
      metalness: 0.75,
      roughness: 0.22,
    }),
    coral: new T.MeshStandardMaterial({
      color: '#ff3d8f',
      emissive: '#ff1f6d',
      emissiveIntensity: 0.45,
      metalness: 0.35,
      roughness: 0.25,
    }),
    starGeo,
    starMat: new T.MeshStandardMaterial({
      color: '#ffe14a',
      emissive: '#ffb300',
      emissiveIntensity: 0.6,
      metalness: 0.4,
      roughness: 0.3,
    }),
    glowGold: additive('#ffcf4a', glow, 0.5),
    glowPink: additive('#ff5fae', glow, 0.6),
    glowJelly: additive('#ff4fd8', glow, 0.45),
    sparkle: additive('#ffffff', spark, 1),
    bell: new T.SphereGeometry(0.62, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.56),
    bellMat: new T.MeshStandardMaterial({
      color: '#d60f86',
      emissive: '#8a0a6a',
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.05,
      transparent: true,
      opacity: 0.93,
      toneMapped: false,
    }),
    coreMat: new T.MeshStandardMaterial({
      color: '#ffd2f3',
      emissive: '#ff8de0',
      emissiveIntensity: 0.9,
      roughness: 0.4,
    }),
    frillGeo: new T.TorusGeometry(0.56, 0.085, 8, 30),
    frillMat: new T.MeshStandardMaterial({
      color: '#a64dff',
      emissive: '#6a1bd1',
      emissiveIntensity: 0.45,
      roughness: 0.3,
    }),
    tentGeo: new T.TubeGeometry(tentCurve, 12, 0.05, 5),
    tentMat: new T.MeshStandardMaterial({
      color: '#c27bff',
      emissive: '#8a2be2',
      emissiveIntensity: 0.5,
      roughness: 0.4,
    }),
    eyeGeo: new T.SphereGeometry(0.15, 14, 10),
    eyeMat: new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.2 }),
    pupilGeo: new T.SphereGeometry(0.075, 10, 8),
    pupilMat: new T.MeshBasicMaterial({ color: '#1a0f2e' }),
    browGeo: new T.BoxGeometry(0.22, 0.05, 0.05),
    spotGeo: new T.SphereGeometry(0.075, 8, 6),
    spotMat: new T.MeshStandardMaterial({
      color: '#fff1fb',
      emissive: '#ffffff',
      emissiveIntensity: 0.3,
    }),
    dangerGeo: new T.RingGeometry(0.95, 1.12, 40),
    dangerMat: new T.MeshBasicMaterial({
      color: '#ff2a6d',
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      toneMapped: false,
      side: T.DoubleSide,
    }),
    discGeo: new T.CircleGeometry(0.68, 32),
    discMat: new T.MeshBasicMaterial({
      color: '#fff4b0',
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      blending: T.AdditiveBlending,
      toneMapped: false,
      side: T.DoubleSide,
    }),
  };
  return {
    ...s,
    all: Object.values(s).flatMap((v) =>
      v instanceof T.BufferGeometry || v instanceof T.Material ? [v] : [],
    ),
  };
}

function ringMesh(sh: Shared, value: number) {
  const g = new T.Group(),
    big = value >= 3,
    spin = new T.Group();
  spin.name = 'spin';
  g.add(spin);
  const glow = new T.Sprite(big ? sh.glowPink : sh.glowGold);
  glow.scale.setScalar(big ? 3.6 : 3);
  glow.renderOrder = 2;
  spin.add(glow);
  const torus = new T.Mesh(big ? sh.bigRingGeo : sh.ringGeo, big ? sh.coral : sh.gold);
  torus.castShadow = true;
  spin.add(torus);
  const disc = new T.Mesh(sh.discGeo, sh.discMat);
  disc.scale.setScalar(big ? 1.25 : 1);
  spin.add(disc);
  if (big) {
    const star = new T.Mesh(sh.starGeo, sh.starMat);
    star.name = 'star';
    star.castShadow = true;
    spin.add(star);
    // A gold inner band makes the bonus ring read as "special" at a glance.
    const band = new T.Mesh(sh.ringGeo, sh.gold);
    band.scale.setScalar(0.86);
    band.position.z = 0.02;
    spin.add(band);
  }
  for (let k = 0; k < (big ? 3 : 2); k++) {
    const s = new T.Sprite(sh.sparkle);
    s.name = 'sparkle';
    s.userData.k = k;
    s.renderOrder = 3;
    g.add(s);
  }
  g.userData.beachShared = true;
  g.userData.gameColor = true;
  return g;
}

function jellyMesh(sh: Shared) {
  const g = new T.Group(),
    body = new T.Group();
  body.name = 'body';
  g.add(body);
  const glow = new T.Sprite(sh.glowJelly);
  glow.scale.setScalar(2.6);
  glow.position.y = 0.2;
  body.add(glow);
  const bell = new T.Mesh(sh.bell, sh.bellMat);
  bell.scale.set(1, 0.95, 1);
  bell.castShadow = true;
  body.add(bell);
  const core = new T.Mesh(sh.bell, sh.coreMat);
  core.scale.setScalar(0.55);
  core.position.y = 0.05;
  body.add(core);
  const frill = new T.Mesh(sh.frillGeo, sh.frillMat);
  frill.rotation.x = Math.PI / 2;
  frill.position.y = 0.06;
  frill.scale.z = 0.7;
  body.add(frill);
  for (let k = 0; k < 5; k++) {
    const a = 0.6 + k * 1.15,
      sp = new T.Mesh(sh.spotGeo, sh.spotMat);
    sp.position.set(Math.cos(a) * 0.4, 0.42 + (k % 2) * 0.08, Math.sin(a) * 0.4 - 0.05);
    body.add(sp);
  }
  // Mischievous face toward the beach so the hazard has a personality.
  for (const side of [-1, 1]) {
    const eye = new T.Mesh(sh.eyeGeo, sh.eyeMat);
    eye.position.set(side * 0.2, 0.3, 0.5);
    eye.scale.set(1, 1.15, 0.6);
    body.add(eye);
    const pupil = new T.Mesh(sh.pupilGeo, sh.pupilMat);
    pupil.position.set(side * 0.19, 0.27, 0.6);
    body.add(pupil);
    const brow = new T.Mesh(sh.browGeo, sh.pupilMat);
    brow.position.set(side * 0.2, 0.5, 0.56);
    brow.rotation.z = side * 0.45;
    body.add(brow);
  }
  const tentacles = new T.Group();
  tentacles.name = 'tentacles';
  body.add(tentacles);
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2,
      t = new T.Mesh(sh.tentGeo, sh.tentMat);
    t.position.set(Math.cos(a) * 0.38, 0.05, Math.sin(a) * 0.38);
    t.rotation.y = -a;
    t.scale.y = 1.6 + (k % 3) * 0.35;
    tentacles.add(t);
  }
  const danger = new T.Mesh(sh.dangerGeo, sh.dangerMat);
  danger.name = 'danger';
  danger.rotation.x = -Math.PI / 2;
  g.add(danger);
  g.userData.beachShared = true;
  g.userData.gameColor = true;
  return g;
}

// --- bursts -------------------------------------------------------------------
type Burst = {
  group: T.Group;
  ring: T.Mesh;
  sparks: T.Sprite[];
  pop: T.Sprite;
  start: number;
  value: number;
};

export type BeachObject = {
  id: number;
  kind: string;
  x: number;
  y: number;
  z: number;
  owner: number;
  value: number;
};

export function createBeachLook(
  scene: T.Scene,
  low: boolean,
  playerCount: number,
) {
  const root = new T.Group();
  root.name = 'Reef Ring Rally set';
  root.userData.gameColor = true;
  scene.add(root);
  const disposables: { dispose(): void }[] = [];
  const own = <X extends { dispose(): void }>(x: X) => {
    disposables.push(x);
    return x;
  };

  // Sky, clouds and haze.
  const dome = skyDome();
  root.add(dome);
  scene.fog = new T.Fog(SKY.haze, 110, 420);
  const cloudTex = [0, 1, 2].map((k) => own(cloudTexture(k)));
  const cloudSpots: [number, number, number, number][] = [
    [-150, 18, -250, 95],
    [-60, 22, -300, 120],
    [55, 16, -270, 100],
    [160, 20, -240, 110],
    [250, 15, -150, 90],
    [-250, 14, -160, 90],
    [-10, 34, -330, 70],
    [110, 42, -310, 60],
    [-120, 46, -290, 55],
  ];
  cloudSpots.forEach(([x, y, z, w], k) => {
    const m = own(
      new T.SpriteMaterial({
        map: cloudTex[k % 3],
        transparent: true,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
    );
    const s = new T.Sprite(m);
    s.position.set(x, y, z);
    s.scale.set(w, w * 0.5, 1);
    s.renderOrder = -9;
    root.add(s);
  });

  // Lagoon.
  const water = new T.Mesh(
    own(new T.PlaneGeometry(1000, 760, 1, 1)),
    own(waterMaterial(low)),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0, -280);
  water.name = 'Lagoon';
  root.add(water);
  const uniforms = (water.material as T.ShaderMaterial).uniforms;

  // Static set pieces, merged into a handful of draw calls.
  const parts: Record<string, T.BufferGeometry[]> = {
    trunk: [],
    frond: [],
    nut: [],
    sand: [],
    grass: [],
    flower: [],
    rock: [],
    near: [],
  };
  ISLANDS.forEach(([x, z, r], k) => island(parts, x, z, r, k + 3, k < 2 ? (low ? 0.7 : 1) : 0.45));
  // A big hazy jungle isle on the horizon for scale.
  {
    const isle = new T.SphereGeometry(1, 48, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    const pp = isle.getAttribute('position');
    for (let i = 0; i < pp.count; i++) {
      const x = pp.getX(i),
        y = pp.getY(i),
        z = pp.getZ(i),
        ridge =
          0.45 +
          0.35 * Math.pow(Math.abs(Math.sin(x * 3.1 + 0.9)), 1.3) +
          0.08 * Math.sin(x * 11 + z * 4);
      pp.setXYZ(i, -50 + x * 90, -1 + y * 17 * ridge, -340 + z * 24);
    }
    isle.computeVertexNormals();
    parts.grass.push(
      prep(isle, (p) => new T.Color('#1d7a3e').lerp(new T.Color('#57b85a'), Math.min(1, p.y / 24))),
    );
  }
  // Foreground beach: a curved sand bank dipping under the shore line.
  {
    const W = 150,
      D = 36,
      geo = new T.PlaneGeometry(W, D, low ? 75 : 150, low ? 24 : 48);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, 4 + D / 2);
    const pos = geo.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        z = pos.getZ(i),
        s = z - shoreZ(x),
        dune = Math.sin(x * 0.21) * 0.12 + Math.sin(x * 0.07 + z * 0.3) * 0.18,
        y =
          s > 0
            ? Math.min(0.75, 0.07 + s * 0.11) + Math.max(0, s - 3) * 0.04 + dune * Math.min(1, s / 4)
            : 0.07 + s * 0.22;
      pos.setY(i, y);
    }
    geo.computeVertexNormals();
    const wet = new T.Color('#c99b5c'),
      dry = new T.Color('#f9e2a8'),
      warm = new T.Color('#f2c98a');
    parts.near.push(
      prep(geo, (p) => {
        const s = p.z - shoreZ(p.x),
          c = wet.clone().lerp(dry, T.MathUtils.smoothstep(s, 0.1, 1.8));
        const speck = hash(Math.floor(p.x * 7) + Math.floor(p.z * 7) * 97);
        return c.lerp(warm, 0.25 * Math.sin(p.x * 0.4 + p.z * 0.9) + 0.2).multiplyScalar(0.94 + speck * 0.08);
      }),
    );
    // Starfish, shells and mossy rocks dotted along the sand.
    const star = new T.ExtrudeGeometry(starShape(0.32, 0.13), {
      depth: 0.06,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.04,
      bevelSegments: 1,
    });
    star.rotateX(-Math.PI / 2);
    for (const [x, z, c, a] of [
      [-6.5, 10.3, '#ff6a3d', 0.4],
      [5.2, 10.6, '#ff3f6e', 1.3],
      [9.8, 10.2, '#ffa31a', 2.2],
      [-11.5, 10.8, '#ff6a3d', 0.9],
    ] as [number, number, string, number][]) {
      const g = star.clone();
      g.rotateY(a);
      g.translate(x, 0.3 + (z - shoreZ(x)) * 0.11, z);
      parts.flower.push(prep(g, c));
    }
    star.dispose();
    for (const [x, z, r] of [
      [-14, 11, 1.2],
      [-16.5, 12.5, 0.8],
      [15, 11.5, 1.1],
      [17, 10.5, 0.7],
    ]) {
      const rock = new T.DodecahedronGeometry(r, 1);
      rock.scale(1, 0.6, 0.9);
      rock.translate(x, 0.45, z);
      parts.rock.push(prep(rock, (p) => new T.Color(p.y > 0.6 ? '#7aa35a' : '#8c8378')));
    }
    // Palms and jungle plants framing the beach edges.
    palm(parts, new T.Vector3(-13.5, 0.6, 12.5), 7.5, new T.Vector3(3.2, 0, -1.6), 91);
    palm(parts, new T.Vector3(-17, 0.7, 10.5), 6.6, new T.Vector3(1.6, 0, -2.6), 92);
    palm(parts, new T.Vector3(14.5, 0.6, 12.2), 7.8, new T.Vector3(-3.3, 0, -1.4), 93);
    palm(parts, new T.Vector3(18.5, 0.7, 10), 6.2, new T.Vector3(-1.2, 0, -2.8), 94);
    for (const [x, z, sc] of [
      [-12, 13.5, 1.6],
      [12.5, 13.8, 1.7],
      [-16, 9.8, 1.3],
      [17, 9.6, 1.2],
      [-9, 14.2, 1.2],
      [9.5, 14.4, 1.1],
    ])
      bush(parts, new T.Vector3(x, 0.5, z), x * 7 + z, sc);
    // Big glossy foreground leaves pushing into the bottom corners.
    for (const side of [-1, 1])
      for (let k = 0; k < 7; k++) {
        const r = rng(k * 17 + (side > 0 ? 5 : 0));
        parts.frond.push(
          leaf(
            new T.Vector3(side * (8.6 + r() * 1.4), 0.2, 13.4 + r() * 1.2),
            (side > 0 ? Math.PI : 0) + (r() - 0.5) * 1.6 - side * 0.5,
            0.9 + r() * 0.6,
            2.4 + r() * 1.2,
            0.3,
            1.25,
            k % 2 ? '#0d5a2a' : '#10692f',
            '#3fb24a',
            k % 3 === 0,
            12,
          ),
        );
      }
  }
  // Little sailboats out on the lagoon for life and scale.
  for (const [x, z, c, a] of [
    [-34, -58, '#ff4f5e', 0.4],
    [38, -82, '#1ea7ff', -0.5],
    [-8, -140, '#ffc21a', 0.2],
  ] as [number, number, string, number][]) {
    const s = z < -100 ? 3 : 2.2;
    const hull = new T.SphereGeometry(1, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    hull.scale(0.9 * s, 0.6 * s, 2.4 * s);
    hull.rotateY(a);
    hull.translate(x, 0.25 * s, z);
    parts.flower.push(prep(hull, (p) => new T.Color(p.y > 0.05 ? c : '#f4f4f4')));
    const mast = new T.CylinderGeometry(0.06 * s, 0.07 * s, 4.2 * s, 6);
    mast.translate(x, 2.3 * s, z);
    parts.trunk.push(prep(mast, '#e9e2d0'));
    const sail = new T.BufferGeometry().setFromPoints([
      new T.Vector3(0, 0.6, 0.1),
      new T.Vector3(0, 4.3, 0.1),
      new T.Vector3(0, 0.6, 2.0),
      new T.Vector3(0, 0.7, -0.1),
      new T.Vector3(0, 3.6, -0.1),
      new T.Vector3(0, 0.7, -1.3),
    ]);
    sail.scale(s, s, s);
    sail.rotateY(a);
    sail.translate(x, 0, z);
    sail.computeVertexNormals();
    parts.frond.push(prep(sail, (p) => new T.Color(p.y > 2.6 * s ? c : '#ffffff')));
  }
  const matFor = (name: string) => {
    const m = own(
      new T.MeshStandardMaterial({
        vertexColors: true,
        roughness:
          name === 'frond'
            ? 0.55
            : name === 'nut' || name === 'flower'
              ? 0.4
              : name === 'trunk'
                ? 0.85
                : 0.95,
        side: name === 'frond' ? T.DoubleSide : T.FrontSide,
      }),
    );
    return m;
  };
  for (const [name, geos] of Object.entries(parts)) {
    if (!geos.length) continue;
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    own(merged);
    const m = new T.Mesh(merged, matFor(name));
    m.castShadow = name !== 'near' && name !== 'sand';
    m.receiveShadow = true;
    m.name = 'Beach ' + name;
    root.add(m);
  }

  // Collectibles and bursts.
  const sh = makeShared();
  disposables.push(...sh.all);
  const popTex = [own(popTexture('+1', '#ffd22e')), own(popTexture('+3', '#ff4f9e'))];
  const bursts: Burst[] = Array.from({ length: 6 }, () => {
    const group = new T.Group();
    group.visible = false;
    root.add(group);
    const ring = new T.Mesh(
      own(new T.RingGeometry(0.7, 1, 40)),
      own(
        new T.MeshBasicMaterial({
          color: '#ffffff',
          transparent: true,
          depthWrite: false,
          side: T.DoubleSide,
          toneMapped: false,
        }),
      ),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    group.add(ring);
    const sparkMat = own(sh.sparkle.clone());
    const sparks = Array.from({ length: 9 }, () => {
      const s = new T.Sprite(sparkMat);
      group.add(s);
      return s;
    });
    const pop = new T.Sprite(
      own(
        new T.SpriteMaterial({
          map: popTex[0],
          transparent: true,
          depthWrite: false,
          depthTest: false,
          toneMapped: false,
        }),
      ),
    );
    pop.renderOrder = 6;
    group.add(pop);
    return { group, ring, sparks, pop, start: -99, value: 1 };
  });

  // A few gulls wheeling over the lagoon.
  const gullMat = own(new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 })),
    wingGeo = own(new T.BoxGeometry(0.9, 0.04, 0.28).translate(0.45, 0, 0)),
    gulls = Array.from({ length: 5 }, (_, k) => {
      const g = new T.Group();
      for (const side of [-1, 1]) {
        const w = new T.Mesh(wingGeo, gullMat);
        w.scale.x = side;
        w.name = 'wing';
        g.add(w);
      }
      g.userData.k = k;
      g.scale.setScalar(1.8);
      root.add(g);
      return g;
    });

  // Player dressing: colour-coded paddle boards, water rings and badges.
  const badges: T.Sprite[] = [];
  const boards: T.Group[] = [];
  function dressPlayer(group: T.Group, i: number) {
    const color = BEACH_COLORS[i % BEACH_COLORS.length];
    const board = new T.Group();
    board.name = 'Surf board';
    group.add(board);
    const deck = new T.Mesh(
      own(new T.SphereGeometry(1, 24, 10)),
      own(new T.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.05 })),
    );
    deck.scale.set(0.42, 0.075, 1.2);
    deck.castShadow = true;
    board.add(deck);
    const stripe = new T.Mesh(
      own(new T.BoxGeometry(0.1, 0.02, 1.9)),
      own(new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 })),
    );
    stripe.position.y = 0.07;
    board.add(stripe);
    const nose = new T.Mesh(
      own(new T.SphereGeometry(0.12, 10, 8)),
      own(new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 })),
    );
    nose.position.set(0, 0.06, 0.95);
    nose.scale.set(1.4, 0.4, 1);
    board.add(nose);
    const halo = new T.Mesh(
      own(new T.RingGeometry(1.05, 1.28, 44)),
      own(
        new T.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.85,
          depthWrite: false,
          toneMapped: false,
          side: T.DoubleSide,
        }),
      ),
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = -0.12;
    halo.name = 'Player ring';
    board.add(halo);
    boards.push(board);
    const badge = new T.Sprite(
      own(
        new T.SpriteMaterial({
          map: own(badgeTexture(`P${i + 1}`, color)),
          depthTest: false,
          depthWrite: false,
          toneMapped: false,
          transparent: true,
        }),
      ),
    );
    badge.scale.set(0.95, 0.95, 1);
    badge.renderOrder = 7;
    scene.add(badge);
    badges.push(badge);
  }

  const last = new Map<number, BeachObject>();
  function objectMesh(kind: string, value: number) {
    if (kind === 'ring') return ringMesh(sh, value);
    if (kind === 'jelly') return jellyMesh(sh);
    return null;
  }

  function burst(x: number, y: number, z: number, value: number, time: number) {
    const b = bursts.reduce((a, c) => (c.start < a.start ? c : a));
    b.start = time;
    b.value = value;
    b.group.position.set(x, 0, z);
    b.group.userData.y = y;
    (b.pop.material as T.SpriteMaterial).map = popTex[value >= 3 ? 1 : 0];
    b.group.visible = true;
  }

  const objSlots = uniforms.uObj.value as T.Vector4[];
  return {
    root,
    dressPlayer,
    objectMesh,
    /** Pose a surfing alien: board bob, lean into turns, arms out for balance. */
    poseActor(
      group: T.Group,
      avatar: T.Group,
      i: number,
      p: { vx: number; vz: number; flash: number; alive: boolean },
      time: number,
    ) {
      const bob = Math.sin(time * 2.3 + i * 1.7) * 0.05;
      group.position.y = 0.2 + bob;
      const board = boards[i];
      if (board) {
        board.scale.setScalar(1.3);
        board.position.y = -0.08;
        board.rotation.x = Math.sin(time * 1.9 + i) * 0.04;
        board.rotation.z = Math.sin(time * 1.6 + i * 2) * 0.05;
      }
      avatar.position.y = 0.06;
      avatar.rotation.z = T.MathUtils.clamp(-p.vx * 0.03, -0.18, 0.18) + Math.sin(time * 1.6 + i * 2) * 0.04;
      const rig = avatar.userData.rig;
      if (rig && p.flash < 0.05) {
        rig.arms.forEach((arm: T.Group, j: number) => {
          arm.rotation.x = Math.sin(time * 2.4 + j + i) * 0.15;
          arm.rotation.z = (j ? -1 : 1) * (1.05 + Math.sin(time * 2.3 + i + j * 2) * 0.12);
        });
        rig.legs.forEach((leg: T.Group, j: number) => {
          leg.rotation.x = 0;
          leg.rotation.z = (j ? -1 : 1) * 0.12;
        });
      }
      const badge = badges[i];
      if (badge) {
        badge.position.copy(group.position);
        badge.position.y += 3.35 + Math.sin(time * 3 + i) * 0.06;
        badge.visible = group.visible;
      }
    },
    /** Pose rings/jellies, fire collect bursts and feed the water shader. */
    update(
      objects: BeachObject[],
      meshes: Map<number, T.Object3D>,
      actors: { x: number; z: number; visible: boolean }[],
      time: number,
    ) {
      uniforms.uTime.value = time;
      for (const g of gulls) {
        const k = g.userData.k as number,
          a = time * (0.18 + k * 0.03) + k * 1.3,
          rad = 14 + k * 5;
        g.position.set(Math.cos(a) * rad + (k - 2) * 6, 11 + k * 1.6 + Math.sin(time + k) * 0.6, -38 - k * 9 + Math.sin(a) * rad * 0.4);
        g.rotation.y = -a;
        const flap = Math.sin(time * 6 + k * 2) * 0.45;
        g.children.forEach((w) => (w.rotation.z = w.scale.x * flap));
      }
      const seen = new Set<number>();
      let slot = 0;
      for (const o of objects) {
        seen.add(o.id);
        last.set(o.id, { ...o });
        const g = meshes.get(o.id);
        if (!g) continue;
        const fadeIn = T.MathUtils.clamp((o.z + 16.5) / 2, 0, 1),
          fadeOut = T.MathUtils.clamp((8.6 - o.z) / 1.6, 0, 1),
          s = Math.max(0.001, Math.min(fadeIn, fadeOut));
        if (o.kind === 'ring') {
          const big = o.value >= 3;
          g.position.set(o.x, 1.2 + Math.sin(time * 2.4 + o.id) * 0.16, o.z);
          g.rotation.set(0, 0, 0);
          g.scale.setScalar(s * (big ? 1.08 : 1));
          const spin = g.getObjectByName('spin');
          if (spin) {
            spin.rotation.y = Math.sin(time * 1.6 + o.id) * 0.55;
            spin.rotation.z = Math.sin(time * 1.1 + o.id * 2) * 0.08;
          }
          const star = g.getObjectByName('star');
          if (star) star.rotation.y = time * 2.2;
          g.children.forEach((c) => {
            if (c.name !== 'sparkle') return;
            const k = c.userData.k as number,
              ph = (time * 1.3 + k * 0.37 + o.id * 0.21) % 1,
              a = k * 2.2 + o.id;
            c.position.set(Math.cos(a) * 0.95, 0.15 + Math.sin(a) * 0.85, 0.2);
            c.scale.setScalar(Math.sin(ph * Math.PI) * (big ? 0.9 : 0.7));
          });
        } else if (o.kind === 'jelly') {
          const pulse = Math.sin(time * 4 + o.id);
          g.position.set(o.x, 0.55 + pulse * 0.12, o.z);
          g.rotation.set(0, 0, 0);
          g.scale.setScalar(s);
          const body = g.getObjectByName('body');
          if (body) body.scale.set(1 + pulse * 0.06, 1 - pulse * 0.08, 1 + pulse * 0.06);
          const tents = g.getObjectByName('tentacles');
          if (tents) tents.rotation.y = Math.sin(time * 1.3 + o.id) * 0.4;
          const danger = g.getObjectByName('danger');
          if (danger) {
            danger.position.y = -g.position.y + 0.04;
            danger.scale.setScalar(1 + 0.08 * Math.sin(time * 6 + o.id));
          }
        }
        if ((o.kind === 'ring' || o.kind === 'jelly') && slot < OBJ - playerCount && s > 0.2)
          objSlots[slot++].set(o.x, o.z, o.kind === 'ring' ? 0.75 * s : 0.85 * s, o.kind === 'ring' ? 1 : 2);
      }
      for (const [id, o] of last)
        if (!seen.has(id)) {
          if (o.kind === 'ring' && o.owner >= 0) burst(o.x, 1.2, o.z, o.value, time);
          last.delete(id);
        }
      for (const a of actors)
        if (slot < OBJ && a.visible) objSlots[slot++].set(a.x, a.z, 0.95, 3);
      for (; slot < OBJ; slot++) objSlots[slot].set(0, 0, 0, 0);
      for (const b of bursts) {
        const age = time - b.start;
        if (age < 0 || age > 1.1) {
          b.group.visible = false;
          continue;
        }
        const k = age / 1.1;
        b.ring.scale.setScalar(0.6 + k * 2.4);
        (b.ring.material as T.MeshBasicMaterial).opacity = (1 - k) * 0.85;
        const y = (b.group.userData.y as number) ?? 1.2;
        b.sparks.forEach((s, j) => {
          const a = (j / b.sparks.length) * Math.PI * 2;
          s.position.set(Math.cos(a) * k * 2, y + Math.sin(a) * k * 1.6 + k * 0.8, Math.sin(a) * 0.3);
          s.scale.setScalar((1 - k) * (b.value >= 3 ? 1 : 0.75));
        });
        b.pop.position.set(0, y + 1 + k * 1.4, 0);
        b.pop.scale.set(1.6, 0.8, 1).multiplyScalar(k < 0.15 ? k / 0.15 : 1);
        (b.pop.material as T.SpriteMaterial).opacity = k > 0.7 ? (1 - k) / 0.3 : 1;
      }
    },
    dispose() {
      for (const b of badges) b.removeFromParent();
      disposables.forEach((d) => d.dispose());
    },
  };
}
