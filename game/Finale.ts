import * as T from 'three';
import { Avatar, DEFAULT_AVATAR } from './config';
import { makeAvatar, animateAvatar, poseAvatar } from './avatar';
import { makeUfo, animateUfo } from './Ufo';
import { createGlobe } from './PlanetGlobe';
import { surfaceTexture } from './Surfaces';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function mergeStatic(root: T.Group) {
  root.updateMatrixWorld(true);
  const buckets = new Map<T.Material, T.Mesh[]>();
  root.traverse((object) => {
    if (
      !(object instanceof T.Mesh) ||
      object instanceof T.InstancedMesh ||
      Array.isArray(object.material)
    )
      return;
    const bucket = buckets.get(object.material) ?? [];
    bucket.push(object);
    buckets.set(object.material, bucket);
  });
  const inverse = root.matrixWorld.clone().invert();
  for (const [material, objects] of buckets) {
    if (objects.length < 2) continue;
    const pieces = objects.map((object) => {
      const geometry = object.geometry.index
        ? object.geometry.toNonIndexed()
        : object.geometry.clone();
      return geometry.applyMatrix4(
        new T.Matrix4().multiplyMatrices(inverse, object.matrixWorld),
      );
    });
    const geometry = mergeGeometries(pieces, false);
    pieces.forEach((piece) => piece.dispose());
    if (!geometry) continue;
    const joined = new T.Mesh(geometry, material);
    joined.castShadow = joined.receiveShadow = true;
    root.add(joined);
    const disposed = new Set<T.BufferGeometry>();
    objects.forEach((object) => {
      object.removeFromParent();
      if (!disposed.has(object.geometry)) {
        disposed.add(object.geometry);
        object.geometry.dispose();
      }
    });
  }
}

/** A hand-held glass with visible liquid, striped straw, paper umbrella and garnish. */
export function makeCocktail(color: T.ColorRepresentation, pinaColada = false) {
  const drink = new T.Group();
  drink.name = pinaColada
    ? 'Pina colada with umbrella'
    : 'Colored umbrella cocktail';
  const materials = new Map<string, T.MeshStandardMaterial>();
  const solid = (c: T.ColorRepresentation) => {
    const key = new T.Color(c).getHexString();
    if (!materials.has(key))
      materials.set(
        key,
        new T.MeshStandardMaterial({ color: c, roughness: 0.42 }),
      );
    return materials.get(key)!;
  };
  const add = (
    geometry: T.BufferGeometry,
    material: T.Material,
    x: number,
    y: number,
    z: number,
    parent: T.Object3D = drink,
  ) => {
    const mesh = new T.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const glass = new T.MeshPhysicalMaterial({
    color: '#d8f8ff',
    transparent: true,
    opacity: 0.23,
    roughness: 0.08,
    metalness: 0,
    clearcoat: 1,
    side: T.DoubleSide,
    depthWrite: false,
  });
  const profile = (
    pinaColada
      ? [
          [0.095, 0.025],
          [0.073, 0.055],
          [0.032, 0.13],
          [0.04, 0.18],
          [0.1, 0.25],
          [0.125, 0.36],
          [0.116, 0.435],
        ]
      : [
          [0.09, 0.025],
          [0.085, 0.04],
          [0.102, 0.22],
          [0.127, 0.435],
        ]
  ).map(([x, y]) => new T.Vector2(x, y));
  add(new T.LatheGeometry(profile, 24), glass, 0, 0, 0);
  add(new T.CylinderGeometry(0.102, 0.09, 0.023, 20), glass, 0, 0.014, 0);
  const liquidProfile = (
    pinaColada
      ? [
          [0, 0.2],
          [0.042, 0.205],
          [0.09, 0.26],
          [0.114, 0.36],
          [0.11, 0.396],
          [0, 0.396],
        ]
      : [
          [0, 0.04],
          [0.076, 0.04],
          [0.112, 0.385],
          [0, 0.385],
        ]
  ).map(([x, y]) => new T.Vector2(x, y));
  const liquid = add(
    new T.LatheGeometry(liquidProfile, 24),
    solid(pinaColada ? '#fff0bc' : color),
    0,
    0,
    0,
  );
  liquid.userData.liquid = true;
  add(new T.TorusGeometry(0.117, 0.008, 6, 24), glass, 0, 0.43, 0).rotation.x =
    Math.PI / 2;
  for (let i = 0; i < 3; i++) {
    const ice = add(
      new T.BoxGeometry(0.055, 0.04, 0.055),
      glass,
      Math.sin(i * 2.1) * 0.055,
      0.397,
      Math.cos(i * 2.1) * 0.055,
    );
    ice.rotation.y = i;
  }
  const strawCurve = new T.CatmullRomCurve3([
    new T.Vector3(0.035, 0.27, -0.04),
    new T.Vector3(0.025, 0.53, -0.05),
    new T.Vector3(-0.03, 0.6, -0.07),
    new T.Vector3(-0.15, 0.615, -0.075),
  ]);
  add(
    new T.TubeGeometry(strawCurve, 20, 0.013, 6, false),
    solid('#fff5d9'),
    0,
    0,
    0,
  );
  for (let i = 0; i < 5; i++)
    add(
      new T.CylinderGeometry(0.014, 0.014, 0.021, 6),
      solid('#ed788b'),
      0.026 + i * 0.002,
      0.33 + i * 0.036,
      -0.047 + i * 0.001,
    );
  const umbrella = new T.Group();
  umbrella.name = 'Paper umbrella';
  umbrella.position.set(0.105, 0.35, 0.065);
  umbrella.rotation.z = -0.26;
  drink.add(umbrella);
  add(
    new T.CylinderGeometry(0.008, 0.009, 0.4, 6),
    solid('#c9a176'),
    0,
    0.2,
    0,
    umbrella,
  );
  const canopyGeometry = new T.ConeGeometry(
    0.21,
    0.11,
    8,
    1,
    true,
  ).toNonIndexed();
  const positions = canopyGeometry.getAttribute('position'),
    colors = [];
  const bright = new T.Color(pinaColada ? '#ff938b' : color);
  const light = bright.clone().lerp(new T.Color('#fff4d8'), 0.6);
  for (let i = 0; i < positions.count; i++) {
    const triangle = Math.floor(i / 3),
      c = triangle % 2 ? bright : light;
    colors.push(c.r, c.g, c.b);
  }
  canopyGeometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  add(
    canopyGeometry,
    new T.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.82,
      side: T.DoubleSide,
    }),
    0,
    0.39,
    0,
    umbrella,
  );
  add(
    new T.SphereGeometry(0.018, 8, 6),
    solid('#fff3bf'),
    0,
    0.455,
    0,
    umbrella,
  );
  const garnish = new T.Group();
  garnish.position.set(-0.115, 0.43, 0.025);
  garnish.rotation.z = -0.2;
  drink.add(garnish);
  const wedge = add(
    new T.CircleGeometry(0.085, 12, 0, Math.PI * 1.55),
    solid(pinaColada ? '#ffc95d' : '#c7ec7c'),
    0,
    0,
    0,
    garnish,
  );
  (wedge.material as T.MeshStandardMaterial).side = T.DoubleSide;
  if (pinaColada) {
    for (let i = 0; i < 3; i++) {
      const leaf = add(
        new T.ConeGeometry(0.019, 0.11, 4),
        solid('#5f985a'),
        -0.02 + i * 0.017,
        0.075,
        0,
        garnish,
      );
      leaf.rotation.z = (i - 1) * 0.4;
    }
    add(
      new T.SphereGeometry(0.031, 10, 8),
      solid('#f2647b'),
      0.055,
      0.421,
      0.03,
    );
  }
  mergeStatic(drink);
  drink.userData.pinaColada = pinaColada;
  drink.userData.hasUmbrella = drink.userData.hasStraw = true;
  return drink;
}

export type FinaleStage =
  | 'toast'
  | 'dance'
  | 'boarding'
  | 'departure'
  | 'lounge'
  | 'podium';
export type FinaleController = {
  group: T.Group;
  exterior: T.Group;
  interior: T.Group;
  ship: T.Group;
  crew: T.Group[];
  cameraPosition: T.Vector3;
  cameraTarget: T.Vector3;
  cameraFov: number;
  stage: FinaleStage;
  caption: string;
  duration: number;
  complete: boolean;
  winnerIndex: number;
  setWinner: (index: number) => void;
  update: (elapsedSeconds: number, reduced?: boolean) => void;
  dispose: () => void;
};

// ── Standings ───────────────────────────────────────────────────────────────
let standingsHint: number[] | undefined;
/** Player indexes from first to last place, for the podium order. */
export function setFinaleStandings(order: number[]) {
  standingsHint = order.slice();
}
/**
 * Render-only helper for Party.tsx: keeps the podium order in sync with the
 * results card (diamonds, then points). Renders nothing.
 */
export function FinaleStandings({
  players,
}: {
  players: { pearls: number; shells: number }[];
}) {
  setFinaleStandings(
    players
      .map((_, i) => i)
      .sort(
        (a, b) =>
          players[b].pearls - players[a].pearls ||
          players[b].shells - players[a].shells ||
          a - b,
      ),
  );
  return null;
}

/** The finale's champion: the announced winner, else the standings leader. */
export function championOf<P extends { id: string; pearls: number; shells: number }>(game: {
  players: P[];
  finale?: { winner?: string };
}): P {
  return (
    game.players.find((p) => p.id === game.finale?.winner) ??
    [...game.players].sort((a, b) => b.pearls - a.pearls || b.shells - a.shells)[0]
  );
}

// ── Podium layout (rank 0 = champion) ──────────────────────────────────────
const DAIS_TOP = 0.3;
const SLOTS = [
  { x: 0, z: 0, h: 1.55 },
  { x: -2.1, z: 0.3, h: 1.08 },
  { x: 2.1, z: 0.3, h: 0.74 },
  { x: -4.05, z: 0.75, h: 0.34 },
];
const PODIUM_COLORS = [
  { body: '#ffbf2e', cap: '#ffd95a', trim: '#b8730c', label: '#ffe680' },
  { body: '#6fa6ff', cap: '#e4eeff', trim: '#3f62b8', label: '#d9e8ff' },
  { body: '#ff8a4c', cap: '#ffc59a', trim: '#b24d22', label: '#ffd2b0' },
  { body: '#9584c8', cap: '#cfc4ee', trim: '#5f4f94', label: '#e2dcf6' },
];
const CREW_SCALE = 1.42;
const Z_AXIS = new T.Vector3(0, 0, 1);
const UFO_HOVER = new T.Vector3(0, 6.75, -0.45);
const UFO_SCALE = 0.56;

function canvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d')!);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Star badge with the place number, wrapped around a pedestal's front. */
function rankTexture(rank: number, fill: string) {
  return canvasTexture(384, 256, (ctx) => {
    ctx.translate(192, 128);
    ctx.beginPath();
    for (let i = 0; i < 24; i++) {
      const r = i % 2 ? 92 : 116,
        a = (i / 24) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * r * 1.35, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = '#1b1142';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 0, 112, 82, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.font = '900 150px "Arial Black", "Segoe UI Black", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 22;
    ctx.strokeStyle = '#1b1142';
    ctx.strokeText(String(rank + 1), 0, 10);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(rank + 1), 0, 10);
  });
}

/** Festival stage top: candy rays, a gold ring and a star. */
function daisTexture() {
  return canvasTexture(1024, 1024, (ctx) => {
    ctx.translate(512, 512);
    const rays = 28;
    for (let i = 0; i < rays; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 512, (i / rays) * Math.PI * 2, ((i + 1) / rays) * Math.PI * 2);
      ctx.closePath();
      ctx.fillStyle = i % 2 ? '#5b2fb0' : '#7a3fd0';
      ctx.fill();
    }
    const glow = ctx.createRadialGradient(0, 0, 40, 0, 0, 512);
    glow.addColorStop(0, '#ff9be6cc');
    glow.addColorStop(0.55, '#c25bff33');
    glow.addColorStop(1, '#1d0b4a99');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 512, 0, Math.PI * 2);
    ctx.fill();
    for (const [r, w, c] of [
      [470, 26, '#ffd34d'],
      [432, 8, '#fff3b0'],
      [300, 6, '#ffd34d'],
    ] as const) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.lineWidth = w;
      ctx.strokeStyle = c;
      ctx.stroke();
    }
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 452, Math.sin(a) * 452, 7, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 ? '#ffffff' : '#ff8fd0';
      ctx.fill();
    }
  });
}

const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p;
  }
`;
const skyFragment = /* glsl */ `
  uniform float uTime;
  varying vec3 vDir;
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x),
          mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
          mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  float fbm(vec3 p) {
    float a = 0.5, s = 0.0;
    for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.07; a *= 0.5; }
    return s;
  }
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 top = vec3(0.04, 0.03, 0.16);
    vec3 mid = vec3(0.3, 0.14, 0.55);
    vec3 low = vec3(1.0, 0.6, 0.5);
    vec3 col = mix(mid, top, smoothstep(0.08, 0.75, h));
    col = mix(low, col, smoothstep(-0.04, 0.32, h));
    float n = fbm(d * 2.4 + vec3(0.0, 0.0, uTime * 0.008));
    float n2 = noise(d * 6.0 + 3.0);
    float cloud = smoothstep(0.42, 0.86, n) * smoothstep(-0.05, 0.25, h);
    vec3 nebula = mix(vec3(0.12, 0.72, 0.9), vec3(1.0, 0.36, 0.78), smoothstep(0.3, 0.7, n2));
    col += nebula * cloud * 0.62;
    col += vec3(1.0, 0.72, 0.45) * pow(max(0.0, 1.0 - abs(h - 0.03) * 4.0), 3.0) * 0.35;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const sparkVertex = /* glsl */ `
  attribute float size;
  attribute float alpha;
  attribute vec3 tint;
  uniform float uHalfHeight;
  varying float vAlpha;
  varying vec3 vTint;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(size * projectionMatrix[1][1] * uHalfHeight / -mv.z, 1.0, 96.0);
    vAlpha = alpha;
    vTint = tint;
  }
`;
const sparkFragment = /* glsl */ `
  varying float vAlpha;
  varying vec3 vTint;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d) * 2.0;
    float core = clamp(1.0 - r, 0.0, 1.0);
    float glow = pow(core, 2.2);
    float star = max(0.0, 1.0 - abs(d.x * d.y) * 90.0) * core;
    gl_FragColor = vec4(vTint * (glow * 1.6 + star * 0.9) * vAlpha, 1.0);
  }
`;
function makeSparks(count: number) {
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('tint', new T.Float32BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('size', new T.Float32BufferAttribute(new Float32Array(count), 1));
  geometry.setAttribute('alpha', new T.Float32BufferAttribute(new Float32Array(count), 1));
  const material = new T.ShaderMaterial({
    uniforms: { uHalfHeight: { value: 400 } },
    vertexShader: sparkVertex,
    fragmentShader: sparkFragment,
    blending: T.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  const points = new T.Points(geometry, material);
  points.frustumCulled = false;
  return points;
}

const beamVertex = /* glsl */ `
  varying vec2 vUv;
  varying float vEdge;
  void main() {
    vUv = uv;
    vec3 n = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vEdge = abs(dot(n, normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv;
  }
`;
const beamFragment = /* glsl */ `
  uniform float uTime;
  uniform float uPower;
  uniform vec3 uColor;
  varying vec2 vUv;
  varying float vEdge;
  void main() {
    float body = pow(vEdge, 1.4);
    float fade = mix(0.3, 1.0, smoothstep(0.1, 0.95, vUv.y));
    float rings = 0.82 + 0.18 * sin(vUv.y * 46.0 + uTime * 7.0);
    gl_FragColor = vec4(uColor * body * fade * rings * uPower, 1.0);
  }
`;
const raysFragment = /* glsl */ `
  uniform float uTime;
  uniform float uPower;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv - 0.5;
    float r = length(p) * 2.0;
    float a = atan(p.y, p.x);
    float rays = smoothstep(0.15, 0.5, sin(a * 14.0 + uTime * 0.35) * 0.5 + 0.5);
    float fall = smoothstep(1.0, 0.12, r) * smoothstep(0.0, 0.18, r);
    vec3 warm = mix(vec3(1.0, 0.86, 0.45), vec3(1.0, 0.45, 0.75), r);
    gl_FragColor = vec4(warm * (rays * 0.75 + 0.25) * fall * uPower, 1.0);
  }
`;
const flatVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

function goldMaterial(color = '#ffcf3f') {
  return new T.MeshStandardMaterial({
    color,
    metalness: 0.92,
    roughness: 0.22,
    emissive: '#6b3d00',
    emissiveIntensity: 0.35,
  });
}

/** A chunky gold crown with five gem-tipped points. */
function makeCrown() {
  const crown = new T.Group();
  crown.name = 'Champion crown';
  const gold = goldMaterial();
  const band = new T.Mesh(new T.CylinderGeometry(0.31, 0.28, 0.17, 36, 1, true), gold);
  (band.material as T.MeshStandardMaterial).side = T.DoubleSide;
  crown.add(band);
  const rim = new T.Mesh(new T.TorusGeometry(0.3, 0.03, 8, 36), gold);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = -0.085;
  crown.add(rim);
  const gems = ['#ff4f7b', '#4fd4ff', '#7dff6a', '#b06bff', '#ffe14f'];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const spike = new T.Mesh(new T.ConeGeometry(0.075, 0.24, 12), gold);
    spike.position.set(Math.sin(a) * 0.29, 0.19, Math.cos(a) * 0.29);
    crown.add(spike);
    const tip = new T.Mesh(new T.SphereGeometry(0.042, 12, 8), gold);
    tip.position.set(Math.sin(a) * 0.29, 0.32, Math.cos(a) * 0.29);
    crown.add(tip);
    const gem = new T.Mesh(
      new T.SphereGeometry(0.045, 12, 8),
      new T.MeshStandardMaterial({
        color: gems[i],
        emissive: gems[i],
        emissiveIntensity: 0.55,
        roughness: 0.08,
        metalness: 0.2,
      }),
    );
    gem.scale.z = 0.55;
    gem.position.set(Math.sin(a) * 0.315, 0, Math.cos(a) * 0.315);
    gem.rotation.y = a;
    crown.add(gem);
  }
  crown.traverse((o) => (o.castShadow = true));
  mergeStatic(crown);
  return crown;
}

/** Gold victory cup with handles and a star finial; origin at the base. */
function makeTrophy() {
  const trophy = new T.Group();
  trophy.name = 'Victory trophy';
  const gold = goldMaterial('#ffd04a');
  const cup = new T.Mesh(
    new T.LatheGeometry(
      [
        [0.0, 0.0],
        [0.17, 0.0],
        [0.17, 0.05],
        [0.11, 0.07],
        [0.05, 0.12],
        [0.045, 0.24],
        [0.08, 0.28],
        [0.2, 0.34],
        [0.25, 0.48],
        [0.26, 0.6],
        [0.23, 0.6],
        [0.21, 0.5],
        [0.0, 0.4],
      ].map(([x, y]) => new T.Vector2(x, y)),
      32,
    ),
    gold,
  );
  trophy.add(cup);
  for (const side of [-1, 1]) {
    const handle = new T.Mesh(new T.TorusGeometry(0.1, 0.025, 8, 18, Math.PI * 1.3), gold);
    handle.position.set(side * 0.25, 0.47, 0);
    handle.rotation.z = side > 0 ? -Math.PI * 0.65 : Math.PI * 0.35;
    trophy.add(handle);
  }
  const plinth = new T.Mesh(
    new T.CylinderGeometry(0.15, 0.19, 0.09, 24),
    new T.MeshStandardMaterial({ color: '#4a2389', roughness: 0.35, metalness: 0.2 }),
  );
  plinth.position.y = -0.04;
  trophy.add(plinth);
  const starShape = new T.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.06 : 0.13,
      a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    if (i) starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    else starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const star = new T.Mesh(
    new T.ExtrudeGeometry(starShape, { depth: 0.05, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2 }),
    gold,
  );
  star.position.set(0, 0.76, -0.025);
  trophy.add(star);
  trophy.traverse((o) => (o.castShadow = true));
  mergeStatic(trophy);
  return trophy;
}

/** A sulky little raincloud for last place. */
function makeRainCloud() {
  const cloud = new T.Group();
  cloud.name = 'Last-place raincloud';
  const puff = new T.MeshStandardMaterial({ color: '#8f93b8', roughness: 0.9 });
  [
    [0, 0, 0, 0.24],
    [0.22, -0.03, 0.02, 0.19],
    [-0.23, -0.04, 0, 0.18],
    [0.08, 0.12, -0.02, 0.18],
    [-0.1, 0.09, 0.04, 0.15],
  ].forEach(([x, y, z, r]) => {
    const m = new T.Mesh(new T.SphereGeometry(r, 16, 12), puff);
    m.position.set(x, y, z);
    cloud.add(m);
  });
  mergeStatic(cloud);
  const drops = new T.InstancedMesh(
    new T.CapsuleGeometry(0.016, 0.07, 3, 6),
    new T.MeshStandardMaterial({ color: '#8ad8ff', emissive: '#3a9bd8', emissiveIntensity: 0.5, roughness: 0.1 }),
    9,
  );
  drops.frustumCulled = false;
  cloud.add(drops);
  cloud.userData.drops = drops;
  return cloud;
}

/** Approximate top of an alien's head (or hat) in its own units. */
function headTop(a: Avatar) {
  const hat = a.hair === 5 ? 0.16 : [2, 4, 7].includes(a.hair) ? 0.1 : a.hair ? 0.05 : 0;
  return 2.26 * a.height + hat + (a.accessory === 3 ? 0.12 : 0);
}

/** Deterministic cinematic. All coordinates are local to group; caller owns camera and render loop. */
export function createFinale(
  parent: T.Object3D,
  avatars: Avatar[],
  winnerIndex: number,
  mode: 'winner' | 'bonus',
): FinaleController {
  const group = new T.Group(),
    exterior = new T.Group(),
    interior = new T.Group();
  group.name = 'Party Planets finale';
  group.add(exterior, interior);
  parent.add(group);
  const source = avatars.length ? avatars.slice(0, 4) : [DEFAULT_AVATAR];
  let champion = T.MathUtils.clamp(
    Math.trunc(winnerIndex),
    0,
    source.length - 1,
  );
  const materials = new Map<string, T.MeshStandardMaterial>();
  const mat = (c: string, glow = false) => {
    const key = `${c}:${glow}`;
    if (!materials.has(key))
      materials.set(
        key,
        new T.MeshStandardMaterial({
          color: c,
          roughness: glow ? 0.26 : 0.63,
          metalness: glow ? 0.25 : 0,
          emissive: glow ? c : '#000000',
          emissiveIntensity: glow ? 0.6 : 0,
        }),
      );
    return materials.get(key)!;
  };
  const add = (
    target: T.Object3D,
    geometry: T.BufferGeometry,
    c: string,
    x: number,
    y: number,
    z: number,
    glow = false,
  ) => {
    const mesh = new T.Mesh(geometry, mat(c, glow));
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    target.add(mesh);
    return mesh;
  };

  // ── Backdrop: nebula sky, stars, a ringed hero planet and a moon ─────────
  const skyUniforms = { uTime: { value: 0 } };
  const sky = new T.Mesh(
    new T.SphereGeometry(400, 48, 24),
    new T.ShaderMaterial({
      uniforms: skyUniforms,
      vertexShader: skyVertex,
      fragmentShader: skyFragment,
      side: T.BackSide,
      depthWrite: false,
    }),
  );
  sky.name = 'finale-sky';
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  exterior.add(sky);
  const stars = makeSparks(700);
  {
    const p = stars.geometry.getAttribute('position') as T.BufferAttribute,
      c = stars.geometry.getAttribute('tint') as T.BufferAttribute,
      s = stars.geometry.getAttribute('size') as T.BufferAttribute,
      a = stars.geometry.getAttribute('alpha') as T.BufferAttribute;
    const tint = new T.Color();
    for (let i = 0; i < 700; i++) {
      const u = ((i * 0.618034) % 1) * Math.PI * 2,
        v = 0.04 + Math.pow((i * 0.7548777) % 1, 0.8) * 0.96;
      const y = v,
        r = Math.sqrt(1 - y * y);
      p.setXYZ(i, Math.cos(u) * r * 320, y * 320, Math.sin(u) * r * 320);
      tint.set(['#ffffff', '#cfe6ff', '#ffe6c4', '#ffd0f0'][i % 4]);
      c.setXYZ(i, tint.r, tint.g, tint.b);
      s.setX(i, 0.7 + ((i * 7) % 11) * 0.16 + (i % 37 === 0 ? 2.2 : 0));
      a.setX(i, 0.35 + ((i * 13) % 10) * 0.065);
    }
  }
  exterior.add(stars);
  const sunMarker = new T.Object3D();
  sunMarker.position.set(-160, 110, 140);
  exterior.add(sunMarker);
  const heroPlanet = createGlobe('verdara', 30, true);
  heroPlanet.group.position.set(-120, 52, -230);
  heroPlanet.group.rotation.set(0.3, 0.4, 0.18);
  exterior.add(heroPlanet.group);
  const moon = createGlobe('selene', 9, true);
  moon.group.position.set(95, 70, -260);
  exterior.add(moon.group);
  heroPlanet.group.name = moon.group.name = 'finale-planet';

  // ── Planet surface: a small curved world with craters and crystals ───────
  const ground = (() => {
    const R = 34;
    const geometry = new T.PlaneGeometry(170, 170, 140, 140);
    geometry.rotateX(-Math.PI / 2);
    const pos = geometry.getAttribute('position') as T.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const base = new T.Color('#9e83e2'),
      pink = new T.Color('#f39bd8'),
      teal = new T.Color('#6ed8d2'),
      deep = new T.Color('#4d3596'),
      c = new T.Color();
    const craters = [
      [-11, -9, 3.2],
      [9, -14, 4.2],
      [16, -4, 2.4],
      [-19, -2, 3.6],
      [3, -22, 5],
      [-7, -26, 3],
      [22, -18, 3.4],
      [-24, -16, 4],
    ];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        z = pos.getZ(i);
      let y = -(x * x + z * z) / (2 * R);
      let shade = 0;
      for (const [cx, cz, cr] of craters) {
        const d = Math.hypot(x - cx, z - cz) / cr;
        if (d < 1.5) {
          const bowl = d < 1 ? -(1 - d * d) * 0.55 : 0;
          const rim = Math.exp(-((d - 1) * (d - 1)) * 18) * 0.22;
          y += (bowl + rim) * cr * 0.5;
          shade += d < 1 ? (1 - d) * 0.75 : 0;
        }
      }
      pos.setY(i, y);
      const n1 = Math.sin(x * 0.21 + Math.sin(z * 0.13) * 2.2) * 0.5 + 0.5,
        n2 = Math.sin(z * 0.17 - Math.cos(x * 0.11) * 2.6) * 0.5 + 0.5;
      c.copy(base)
        .lerp(pink, Math.pow(n1 * n2, 2) * 0.85)
        .lerp(teal, Math.pow((1 - n1) * n2, 3) * 0.7)
        .lerp(deep, Math.min(0.8, shade));
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geometry.setAttribute('color', new T.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const grain = surfaceTexture('stone', 256);
    grain.repeat.set(26, 26);
    const mesh = new T.Mesh(
      geometry,
      new T.MeshStandardMaterial({
        vertexColors: true,
        map: grain,
        bumpMap: grain,
        bumpScale: 0.8,
        roughness: 0.93,
      }),
    );
    mesh.receiveShadow = true;
    return mesh;
  })();
  ground.name = 'finale-ground';
  exterior.add(ground);
  const groundY = (x: number, z: number) => -(x * x + z * z) / (2 * 34);
  const decor = new T.Group();
  decor.name = 'finale-decor';
  exterior.add(decor);
  {
    const crystals = new T.InstancedMesh(
      new T.OctahedronGeometry(0.5, 0),
      new T.MeshStandardMaterial({
        color: '#ffffff',
        roughness: 0.15,
        metalness: 0.1,
        emissive: '#5a2a8a',
        emissiveIntensity: 0.6,
      }),
      44,
    );
    const puffs = new T.InstancedMesh(
      new T.IcosahedronGeometry(0.6, 2),
      new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 }),
      30,
    );
    const pose = new T.Object3D(),
      tint = new T.Color();
    let placedCrystals = 0,
      placedPuffs = 0;
    for (let i = 0; i < 120; i++) {
      // Keep the sightline from the camera (front, +Z) to the podium clear.
      const angle = Math.PI * 0.86 + ((i * 0.618034) % 1) * Math.PI * 1.28;
      const radius = 7.2 + ((i * 0.7548777) % 1) * 17;
      const x = Math.sin(angle) * radius,
        z = Math.cos(angle) * radius;
      const cluster = i % 3 === 0;
      if (cluster && placedCrystals < 44) {
        for (let k = 0; k < 3 && placedCrystals < 44; k++) {
          pose.position.set(x + (k - 1) * 0.45, groundY(x, z) + 0.35, z + (k % 2) * 0.3);
          pose.rotation.set((k - 1) * 0.35, i + k, (k - 1) * 0.25);
          pose.scale.set(0.55, 1.4 + ((i + k) % 3) * 0.55, 0.55);
          pose.updateMatrix();
          crystals.setMatrixAt(placedCrystals, pose.matrix);
          crystals.setColorAt(placedCrystals, tint.set(['#ff8fd8', '#7fe8ff', '#b991ff'][(i + k) % 3]));
          placedCrystals++;
        }
      } else if (!cluster && placedPuffs < 30 && i % 2) {
        pose.position.set(x, groundY(x, z) + 0.25, z);
        pose.rotation.set(0, i, 0);
        pose.scale.setScalar(0.7 + (i % 5) * 0.22);
        pose.updateMatrix();
        puffs.setMatrixAt(placedPuffs, pose.matrix);
        puffs.setColorAt(placedPuffs, tint.set(['#5fd6b6', '#ff9ccf', '#ffd36b', '#7fb6ff'][i % 4]));
        placedPuffs++;
      }
    }
    crystals.count = placedCrystals;
    puffs.count = placedPuffs;
    crystals.castShadow = puffs.castShadow = true;
    puffs.receiveShadow = true;
    decor.add(crystals, puffs);
  }

  // ── Stage: festival dais with chasing marquee bulbs ─────────────────────
  const stage = new T.Group();
  exterior.add(stage);
  const dais = new T.Mesh(
    new T.CylinderGeometry(5.6, 5.95, 0.42, 72),
    new T.MeshStandardMaterial({ color: '#f4ecff', roughness: 0.3 }),
  );
  dais.position.y = DAIS_TOP - 0.21;
  dais.receiveShadow = dais.castShadow = true;
  stage.add(dais);
  const daisTop = new T.Mesh(
    new T.CircleGeometry(5.45, 72),
    new T.MeshStandardMaterial({ map: daisTexture(), roughness: 0.22 }),
  );
  daisTop.rotation.x = -Math.PI / 2;
  daisTop.position.y = DAIS_TOP + 0.004;
  daisTop.receiveShadow = true;
  stage.add(daisTop);
  const bulbs = new T.InstancedMesh(
    new T.SphereGeometry(0.075, 10, 8),
    new T.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }),
    72,
  );
  {
    const m = new T.Matrix4();
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      m.makeTranslation(Math.sin(a) * 5.82, DAIS_TOP - 0.2, Math.cos(a) * 5.82);
      bulbs.setMatrixAt(i, m);
      bulbs.setColorAt(i, new T.Color('#ffe7a0'));
    }
  }
  stage.add(bulbs);

  // ── Podium: four tiered pedestals with place badges ─────────────────────
  const podium = new T.Group();
  podium.name = 'Victory podium';
  stage.add(podium);
  const pedestals = SLOTS.map((slot, rank) => {
    const colors = PODIUM_COLORS[rank];
    const p = new T.Group();
    p.position.set(slot.x, DAIS_TOP, slot.z);
    const body = new T.Mesh(
      new T.CylinderGeometry(0.86, 0.92, slot.h, 48),
      new T.MeshStandardMaterial({ color: colors.body, roughness: 0.2 }),
    );
    body.position.y = slot.h / 2;
    const cap = new T.Mesh(
      new T.CylinderGeometry(0.97, 0.95, 0.15, 48),
      rank === 0
        ? goldMaterial('#ffd75a')
        : new T.MeshStandardMaterial({ color: colors.cap, metalness: rank === 3 ? 0.1 : 0.75, roughness: 0.25 }),
    );
    cap.position.y = slot.h + 0.075;
    const foot = new T.Mesh(
      new T.TorusGeometry(0.93, 0.07, 10, 48),
      new T.MeshStandardMaterial({ color: colors.trim, roughness: 0.4, metalness: 0.3 }),
    );
    foot.rotation.x = Math.PI / 2;
    foot.position.y = 0.06;
    const band = new T.Mesh(
      new T.TorusGeometry(0.885, 0.035, 8, 48),
      new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 }),
    );
    band.rotation.x = Math.PI / 2;
    band.position.y = Math.max(0.16, slot.h - 0.1);
    const labelHeight = Math.min(0.78, slot.h * 0.82);
    const label = new T.Mesh(
      new T.CylinderGeometry(0.925, 0.925, labelHeight, 24, 1, true, -0.62, 1.24),
      new T.MeshStandardMaterial({
        map: rankTexture(rank, colors.label),
        transparent: true,
        roughness: 0.4,
      }),
    );
    label.position.y = slot.h * 0.47;
    for (const m of [body, cap, foot, band]) m.castShadow = m.receiveShadow = true;
    p.add(body, cap, foot, band, label);
    podium.add(p);
    return { group: p, top: DAIS_TOP + slot.h + 0.15 };
  });

  // Light rays behind the champion, a spotlight beam and its pool of light.
  const raysUniforms = { uTime: { value: 0 }, uPower: { value: 0 } };
  const rays = new T.Mesh(
    new T.PlaneGeometry(20, 20),
    new T.ShaderMaterial({
      uniforms: raysUniforms,
      vertexShader: flatVertex,
      fragmentShader: raysFragment,
      blending: T.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    }),
  );
  rays.position.set(0, 3.4, -3.6);
  exterior.add(rays);
  const beamUniforms = {
    uTime: { value: 0 },
    uPower: { value: 0 },
    uColor: { value: new T.Color('#ffe7a6') },
  };
  const beamTop = UFO_HOVER.y - 0.05,
    beamBottom = pedestals[0].top;
  const beam = new T.Mesh(
    new T.CylinderGeometry(0.42, 1.18, beamTop - beamBottom, 40, 1, true),
    new T.ShaderMaterial({
      uniforms: beamUniforms,
      vertexShader: beamVertex,
      fragmentShader: beamFragment,
      blending: T.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      side: T.DoubleSide,
    }),
  );
  beam.position.set(0, (beamTop + beamBottom) / 2, 0);
  beam.renderOrder = 5;
  exterior.add(beam);
  const poolUniforms = { uTime: { value: 0 }, uPower: { value: 0 } };
  const pool = new T.Mesh(
    new T.CircleGeometry(1.25, 48),
    new T.ShaderMaterial({
      uniforms: poolUniforms,
      vertexShader: flatVertex,
      fragmentShader: /* glsl */ `
        uniform float uPower;
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          float r = length(vUv - 0.5) * 2.0;
          float ring = smoothstep(0.08, 0.0, abs(r - 0.8 - 0.06 * sin(uTime * 3.0)));
          float fill = smoothstep(1.0, 0.0, r) * 0.55;
          gl_FragColor = vec4(vec3(1.0, 0.9, 0.6) * (fill + ring) * uPower, 1.0);
        }
      `,
      blending: T.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(0, pedestals[0].top + 0.012, 0);
  exterior.add(pool);

  // ── Lighting: warm key, warm + cool rims, the saucer's spotlight ────────
  const key = new T.DirectionalLight('#fff1dc', 1.5);
  key.position.set(4, 9, 11);
  const rimWarm = new T.DirectionalLight('#ffad66', 2.8);
  rimWarm.position.set(8, 5, -8);
  const rimCool = new T.DirectionalLight('#78c6ff', 2.6);
  rimCool.position.set(-9, 6, -7);
  const spotTarget = new T.Object3D();
  spotTarget.position.set(0, pedestals[0].top, 0);
  const spot = new T.SpotLight('#ffeec4', 0, 18, 0.34, 0.55, 1.1);
  spot.position.copy(UFO_HOVER);
  spot.target = spotTarget;
  const lights = new T.Group();
  lights.add(key, rimWarm, rimCool, spot, spotTarget);
  exterior.add(lights);

  // ── The saucer (lands for the bonus boarding, hovers over the podium) ───
  const ship = makeUfo();
  ship.position.set(0, DAIS_TOP, -3.4);
  ship.userData.disco = true;
  exterior.add(ship);

  // ── The crew ────────────────────────────────────────────────────────────
  const holders = source.map(() => Object.assign(new T.Group(), { name: 'finale-crew' }));
  const crew = source.map((a) => makeAvatar(a));
  crew.forEach((alien, i) => {
    holders[i].add(alien);
    exterior.add(holders[i]);
  });
  const crown = makeCrown();
  exterior.add(crown);
  const trophy = makeTrophy();
  trophy.scale.setScalar(1.15);
  const cloud = makeRainCloud();
  exterior.add(cloud);
  const drinks = source.map((_, i) =>
    makeCocktail(['#ff87ae', '#69d9f1', '#bc8cff', '#ffd269'][i], false),
  );
  drinks.forEach((d) => d.scale.setScalar(0.82));
  const lineup = crew.map(
    (_, i) => new T.Vector3((i - (crew.length - 1) / 2) * 1.65, DAIS_TOP, 1.4),
  );

  // ── FX: confetti, cannon bursts, fireworks, champion sparkles ───────────
  const CONFETTI = 220;
  const confetti = new T.InstancedMesh(
    new T.PlaneGeometry(0.09, 0.15),
    new T.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.45,
      side: T.DoubleSide,
      emissive: '#ffffff',
      emissiveIntensity: 0.18,
    }),
    CONFETTI,
  );
  confetti.frustumCulled = false;
  {
    const palette = ['#ffd23f', '#ff5fa2', '#4fd8ff', '#7dff7a', '#b47cff', '#ff8a3d', '#ffffff'];
    const tint = new T.Color();
    for (let i = 0; i < CONFETTI; i++) confetti.setColorAt(i, tint.set(palette[i % palette.length]));
  }
  exterior.add(confetti);
  const fireworks = makeSparks(4 * 56);
  const sparkles = makeSparks(26);
  exterior.add(fireworks, sparkles);
  const FIREWORK_COLORS = ['#ffd84a', '#ff6fc0', '#62e6ff', '#9dff6a'].map((c) => new T.Color(c));
  const burstDirs: T.Vector3[] = [];
  for (let k = 0; k < 56; k++) {
    const y = 1 - ((k + 0.5) / 56) * 2,
      r = Math.sqrt(1 - y * y),
      a = k * 2.399963;
    burstDirs.push(new T.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
  }

  // ── The ship lounge (bonus diamonds are awarded inside) ─────────────────
  const interiorScenery = new T.Group();
  interior.add(interiorScenery);
  add(interiorScenery, new T.CylinderGeometry(6.1, 6.1, 0.25, 48), '#253e61', 0, -0.17, 0);
  const wall = add(
    interiorScenery,
    new T.CylinderGeometry(6, 6, 3.9, 40, 1, true, Math.PI / 2, Math.PI),
    '#334e77',
    0,
    1.8,
    0,
  );
  (wall.material as T.MeshStandardMaterial).side = T.DoubleSide;
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 2 + ((i + 0.5) * Math.PI) / 6,
      x = Math.sin(angle) * 5.78,
      z = Math.cos(angle) * 5.78;
    const windowGroup = new T.Group();
    windowGroup.position.set(x, 2.25, z);
    windowGroup.rotation.y = angle + Math.PI;
    interiorScenery.add(windowGroup);
    add(windowGroup, new T.CircleGeometry(0.66, 24), '#11203e', 0, 0, 0);
    add(windowGroup, new T.TorusGeometry(0.67, 0.065, 8, 24), '#8dacce', 0, 0, 0.03);
    for (let star = 0; star < 5; star++)
      add(
        windowGroup,
        new T.SphereGeometry(0.022 + (star % 2) * 0.008, 5, 4),
        '#e9f7ff',
        Math.sin(star * 2.4) * 0.43,
        Math.cos(star * 2.4) * 0.45,
        0.015,
        true,
      );
  }
  for (const side of [-1, 1]) {
    add(interiorScenery, new T.BoxGeometry(2.6, 0.45, 0.94), '#a97cbd', side * 3.9, 0.38, -1.3);
    add(interiorScenery, new T.BoxGeometry(2.6, 0.78, 0.25), '#bb94d1', side * 3.9, 0.9, -1.8);
    add(interiorScenery, new T.BoxGeometry(2.6, 0.035, 0.88), '#d7b4e4', side * 3.9, 0.625, -1.3);
  }
  add(interiorScenery, new T.BoxGeometry(4.7, 1.1, 0.8), '#7a9fb4', 0, 0.55, -4.4);
  add(interiorScenery, new T.BoxGeometry(5, 0.12, 1.02), '#f7dfb1', 0, 1.13, -4.4);
  for (let i = 0; i < 7; i++)
    add(
      interiorScenery,
      new T.CylinderGeometry(0.07, 0.095, 0.32 + (i % 2) * 0.1, 10),
      ['#83dba3', '#ffb3c1', '#72c8fa'][i % 3],
      -2 + i * 0.64,
      1.36,
      -4.4,
      true,
    );
  const floorLights = new T.InstancedMesh(
    new T.BoxGeometry(0.75, 0.025, 0.75),
    new T.MeshStandardMaterial({
      color: '#ffffff',
      emissive: '#80c8df',
      emissiveIntensity: 0.5,
      roughness: 0.25,
    }),
    36,
  );
  {
    const matrix = new T.Matrix4(),
      cyan = new T.Color('#6cbfff'),
      green = new T.Color('#9ef5ae');
    for (let i = 0; i < 36; i++) {
      matrix.makeTranslation(((i % 6) - 2.5) * 0.88, 0.003, (Math.floor(i / 6) - 2.5) * 0.88);
      floorLights.setMatrixAt(i, matrix);
      floorLights.setColorAt(i, i % 2 ? cyan : green);
    }
  }
  interior.add(floorLights);
  const discoBall = add(interior, new T.IcosahedronGeometry(0.45, 1), '#c6f5ff', 0, 3.45, 0, true);
  add(interiorScenery, new T.CylinderGeometry(0.016, 0.016, 0.65, 6), '#9eb5d7', 0, 4.0, 0);
  mergeStatic(interiorScenery);

  const pose = new T.Object3D(),
    hand = new T.Vector3(),
    tmp = new T.Vector3(),
    tint = new T.Color(),
    shipLookOffset = new T.Vector3(0, 1.5, 0),
    drinkOffset = new T.Vector3(0, -0.16, -0.07);
  let disposed = false,
    winnerAnnounced = false,
    bulbFrame = -1;
  const blend = (value: number) => {
    const x = T.MathUtils.clamp(value, 0, 1);
    return x * x * (3 - 2 * x);
  };
  const boardingAt = mode === 'winner' ? Infinity : 1.5;
  const takeoffAt = boardingAt + 7.3;
  const loungeAt = takeoffAt + 5.4;
  const celebrateAt = 31;
  const holdAt = mode === 'winner' ? 10.4 : 2.6;
  const rankOrder = () => {
    const n = source.length;
    const hint =
      standingsHint &&
      standingsHint.length === n &&
      standingsHint.every((i) => Number.isInteger(i) && i >= 0 && i < n)
        ? standingsHint
        : [...Array(n).keys()];
    return [champion, ...hint.filter((i) => i !== champion)];
  };
  // Camera beats for the podium: crane in, push in on the champion, drift,
  // then settle on a composition that leaves room for the results card.
  const camA = { pos: new T.Vector3(3.5, 8.5, 23), target: new T.Vector3(-0.6, 3.0, 0), fov: 46 };
  const camB = { pos: new T.Vector3(0.7, 4.3, 8.6), target: new T.Vector3(0, 3.6, 0), fov: 34 };
  const camC = { pos: new T.Vector3(1.4, 4.4, 13.2), target: new T.Vector3(-0.9, 2.9, 0), fov: 40 };
  const holdShot = () => {
    const w = typeof window === 'undefined' ? 1280 : window.innerWidth,
      h = typeof window === 'undefined' ? 800 : window.innerHeight;
    const aspect = Math.max(0.3, w / Math.max(1, h));
    const fov = 38,
      half = Math.tan(T.MathUtils.degToRad(fov / 2));
    const centerX = -1.0;
    if (aspect >= 1.15) {
      const dist = 13.4;
      const shift = 0.285 * half * dist * aspect;
      return {
        pos: new T.Vector3(centerX + shift - 0.9, 4.1, dist),
        target: new T.Vector3(centerX + shift, 3.55, 0),
        fov,
      };
    }
    // Portrait screens: the card fills the lower half, so the whole podium
    // must fit in the band between the top bar and the card.
    const tall = Math.tan(T.MathUtils.degToRad(22));
    const dist = T.MathUtils.clamp(4.3 / (tall * aspect), 13, 27);
    const targetY = 2.7 - 0.47 * tall * dist;
    return {
      pos: new T.Vector3(centerX + 0.3, targetY + 2.2, dist),
      target: new T.Vector3(centerX, targetY, 0),
      fov: 44,
    };
  };
  const shot = (a: typeof camA, b: typeof camA, k: number) => {
    controller.cameraPosition.lerpVectors(a.pos, b.pos, k);
    controller.cameraTarget.lerpVectors(a.target, b.target, k);
    controller.cameraFov = T.MathUtils.lerp(a.fov, b.fov, k);
  };

  const controller: FinaleController = {
    group,
    exterior,
    interior,
    ship,
    crew,
    cameraPosition: new T.Vector3(),
    cameraTarget: new T.Vector3(),
    cameraFov: 42,
    stage: 'toast',
    caption: 'Cheers to our visitor of honor!',
    duration: mode === 'winner' ? 28 : 42,
    complete: false,
    winnerIndex: champion,
    setWinner(index: number) {
      champion = T.MathUtils.clamp(Math.trunc(index), 0, source.length - 1);
      controller.winnerIndex = champion;
      winnerAnnounced = true;
    },
    update(elapsedSeconds: number, reduced = false) {
      if (disposed) return;
      const t = Math.max(0, Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0);
      const celebration = mode === 'bonus' && winnerAnnounced && t >= celebrateAt;
      const onPodium = mode === 'winner' || celebration;
      const pt = mode === 'winner' ? t : t - celebrateAt;
      const inside = !onPodium && t >= loungeAt;
      exterior.visible = !inside;
      interior.visible = inside;
      controller.complete = t >= controller.duration;
      controller.stage = onPodium
        ? 'podium'
        : inside
          ? 'lounge'
          : t >= takeoffAt
            ? 'departure'
            : t >= boardingAt
              ? 'boarding'
              : 'toast';
      controller.caption = onPodium
        ? `${source[champion].name} is the Party Planets champion!`
        : inside
          ? 'A little Earth hospitality, all the way home.'
          : t >= takeoffAt
            ? 'Next stop: another party planet.'
            : 'Umbrellas up. All aboard!';
      const motion = reduced ? 0 : 1;
      skyUniforms.uTime.value = t;
      const halfHeight =
        (typeof window === 'undefined' ? 800 : window.innerHeight) *
        Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, 1.5) *
        0.5;
      for (const points of [stars, fireworks, sparkles])
        (points.material as T.ShaderMaterial).uniforms.uHalfHeight.value = halfHeight;
      heroPlanet.update(t, reduced, sunMarker);
      moon.update(t, reduced, sunMarker);
      heroPlanet.group.rotation.y = 0.4 + t * 0.01 * motion;

      // Marquee bulbs chase around the dais.
      const frame = reduced ? -2 : Math.floor(t * 8);
      if (frame !== bulbFrame) {
        bulbFrame = frame;
        for (let i = 0; i < 72; i++) {
          const lit = reduced || (i + frame) % 6 < 3;
          tint.set(i % 2 ? '#ffe28a' : '#ff9ad8').multiplyScalar(lit ? 1.6 : 0.35);
          bulbs.setColorAt(i, tint);
        }
        bulbs.instanceColor!.needsUpdate = true;
      }

      podium.visible = onPodium;
      const order = rankOrder();
      const intro = onPodium ? blend((pt - 1.1) / 0.7) : 0;
      raysUniforms.uTime.value = t;
      raysUniforms.uPower.value = onPodium ? blend((pt - 0.6) / 1.2) * 0.42 : 0;
      beamUniforms.uTime.value = poolUniforms.uTime.value = t;
      beamUniforms.uPower.value = intro * (0.24 + 0.04 * Math.sin(t * 5) * motion);
      poolUniforms.uPower.value = intro * 0.45;
      beam.visible = pool.visible = rays.visible = onPodium;
      spot.intensity = intro * 9;
      rimWarm.intensity = onPodium ? 2.8 : 1.4;
      rimCool.intensity = onPodium ? 2.6 : 1.2;

      // ── Saucer ──
      if (onPodium) {
        ship.scale.setScalar(UFO_SCALE);
        const arrive = blend(pt / 1.4);
        ship.position.set(
          UFO_HOVER.x,
          UFO_HOVER.y + (1 - arrive) * 9 + Math.sin(t * 1.6) * 0.08 * motion,
          UFO_HOVER.z,
        );
        ship.rotation.set(0.1, t * 0.35 * motion, Math.sin(t * 1.1) * 0.03 * motion);
        ship.userData.disco = true;
        animateUfo(ship, t, 0, reduced);
      } else {
        ship.scale.setScalar(1);
        const lift = blend((t - takeoffAt) / 5);
        ship.position.set(
          Math.sin(lift * 1.6) * lift * 5,
          DAIS_TOP + lift * lift * 18,
          -3.4 - lift * 14,
        );
        ship.rotation.set(lift * -0.1, lift * 0.38, reduced ? 0 : Math.sin(t * 2) * 0.015 * lift);
        const rampOpen = 1 - blend((t - (takeoffAt - 1.15)) / 1.15);
        ship.userData.disco = t >= takeoffAt - 1.15;
        animateUfo(ship, t, rampOpen, reduced);
      }

      // ── Crew ──
      let championTop = 0;
      crew.forEach((alien, i) => {
        const holder = holders[i];
        const parentGroup = inside ? interior : exterior;
        if (holder.parent !== parentGroup) parentGroup.add(holder);
        const a = source[i];
        const rig = alien.userData.rig;
        holder.visible = true;
        alien.position.set(0, 0, 0);
        alien.rotation.set(0, 0, 0);
        alien.scale.set(a.width, a.height, a.width);
        const holdsDrink = drinks[i].parent === (rig?.arms?.[1] ?? null);
        if (onPodium) {
          if (drinks[i].parent) drinks[i].removeFromParent();
          const rank = order.indexOf(i);
          const slot = SLOTS[Math.min(rank, SLOTS.length - 1)];
          const top = pedestals[Math.min(rank, 3)].top;
          holder.position.set(slot.x, top, slot.z);
          holder.scale.setScalar(CREW_SCALE);
          // Everyone turns a little toward the champion; the champion faces us.
          holder.rotation.set(0, rank === 0 ? 0.08 : slot.x < 0 ? 0.34 : -0.34, 0);
          // Staggered drop-in with a squash on landing (last place first).
          const arrive = (3 - rank) * 0.22 + 0.15;
          const fall = T.MathUtils.clamp((pt - arrive) / 0.5, 0, 1);
          const landed = pt - arrive - 0.5;
          holder.visible = pt >= arrive || reduced;
          let drop = reduced ? 0 : (1 - fall * fall) * 4.5;
          const squash =
            !reduced && landed > 0 && landed < 0.35
              ? Math.sin((landed / 0.35) * Math.PI) * 0.16
              : 0;
          const local = pt - arrive + i * 0.37;
          if (rank === 0) {
            const party = pt >= 2.9;
            animateAvatar(alien, t + i * 0.21, 0, party ? 'cheer' : 'happy', reduced);
            const hop = party ? poseAvatar(alien, 'trophy', local, reduced) : 0;
            drop += hop;
            championTop = top + (headTop(a) + hop) * CREW_SCALE;
          } else if (rank === 3) {
            animateAvatar(alien, t + i * 0.21, 0, 'sulk', reduced);
            poseAvatar(alien, 'sulk', local, reduced);
            alien.rotation.x = 0.2 + Math.sin(t * 1.3) * 0.02 * motion;
            alien.position.z = -0.12;
          } else {
            animateAvatar(alien, t + i * 0.21, 0, 'happy', reduced);
            drop += poseAvatar(alien, rank === 1 ? 'clap' : 'wave', local, reduced);
          }
          alien.position.y = drop;
          alien.scale.set(
            a.width * (1 + squash * 0.5),
            a.height * (1 - squash),
            a.width * (1 + squash * 0.5),
          );
          return;
        }
        holder.scale.setScalar(1);
        holder.rotation.set(0, 0, 0);
        if (!holdsDrink && rig?.arms?.[1]) rig.arms[1].add(drinks[i]);
        const boarding = blend((t - boardingAt - i * 0.76) / 3.8);
        let walk = 0;
        if (inside) {
          holder.position.set((i - (crew.length - 1) / 2) * 1.35, 0, 0.35 + Math.sin(i * 1.5) * 0.35);
          holder.rotation.y = Math.sin(t * 0.6 + i) * 0.22;
        } else if (t < boardingAt) {
          holder.position.copy(lineup[i]);
        } else {
          const join = blend(Math.min(1, boarding * 1.75));
          const laneZ = T.MathUtils.lerp(lineup[i].z, -1.9, boarding);
          holder.position.set(
            T.MathUtils.lerp(lineup[i].x, 0, join),
            DAIS_TOP + T.MathUtils.clamp((0.54 - laneZ) / 1.42, 0, 1) * 0.37,
            laneZ,
          );
          holder.rotation.y = Math.PI;
          walk = boarding > 0 && boarding < 1 ? 3.6 : 0;
          holder.visible = boarding < 1 && t < takeoffAt;
        }
        animateAvatar(alien, t + i * 0.21, walk, walk ? 'neutral' : 'happy', reduced);
        if (inside && !reduced) {
          alien.position.y = Math.abs(Math.sin(t * 5.4 + i)) * 0.11;
          alien.rotation.z = Math.sin(t * 4.8 + i) * 0.11;
          rig.legs[0].rotation.x = Math.sin(t * 5.4 + i) * 0.24;
          rig.legs[1].rotation.x = -Math.sin(t * 5.4 + i) * 0.24;
          rig.arms[0].rotation.z = -1.2 - Math.sin(t * 3.5 + i) * 0.75;
        }
        const sip = inside ? Math.max(0, Math.sin(t * 0.55 + i * 1.6)) * 0.65 : 0;
        if (rig?.arms?.[1]) {
          rig.arms[1].rotation.set(-0.25 - sip * 1.22, 0, -0.1 - sip * 0.22);
          hand.set(0.06, -0.45, 0.015);
          drinks[i].position.copy(hand).add(drinkOffset);
          drinks[i].rotation.set(-sip * 0.09, 0, -0.04);
        }
      });

      // ── Champion props: trophy in hand, crown drop, raincloud ──
      const winner = crew[champion],
        winnerHolder = holders[champion],
        winnerRig = winner.userData.rig;
      const trophyArm: T.Object3D | undefined = winnerRig?.arms?.[1];
      trophy.visible = onPodium && pt >= 2.9;
      if (trophy.visible && trophyArm) {
        if (trophy.parent !== trophyArm) trophyArm.add(trophy);
        const angle = trophyArm.rotation.z;
        trophy.rotation.set(0, 0, -angle);
        tmp.set(0, 0.16 * 1.15, 0).applyAxisAngle(Z_AXIS, -angle);
        trophy.position.set(0.06, -0.47, 0.03).sub(tmp);
      } else if (trophy.parent) trophy.removeFromParent();
      crown.visible = onPodium && pt >= 1.7;
      if (crown.visible) {
        const fallT = T.MathUtils.clamp((pt - 1.7) / 0.9, 0, 1);
        const land = championTop - 0.08 * CREW_SCALE;
        const start = UFO_HOVER.y - 0.3;
        const bounce =
          fallT >= 1 && !reduced
            ? Math.max(0, Math.sin((pt - 2.6) * 9) * Math.exp(-(pt - 2.6) * 5)) * 0.25
            : 0;
        crown.position.set(
          winnerHolder.position.x,
          reduced ? land : T.MathUtils.lerp(start, land, fallT * fallT) + bounce,
          winnerHolder.position.z + 0.02,
        );
        crown.rotation.set(-0.12, (1 - fallT) * 9 * motion + 0.3, 0.14);
        crown.scale.setScalar(CREW_SCALE * 0.95);
      }
      const loser = order[3];
      cloud.visible = onPodium && loser !== undefined && pt >= 1.2;
      if (cloud.visible) {
        const h = holders[loser];
        cloud.position.set(
          h.position.x + Math.sin(t * 0.8) * 0.06 * motion,
          h.position.y + (headTop(source[loser]) + 0.55) * CREW_SCALE,
          h.position.z - 0.05,
        );
        cloud.scale.setScalar(CREW_SCALE * 0.95);
        const drops = cloud.userData.drops as T.InstancedMesh;
        for (let k = 0; k < 9; k++) {
          const f = ((t * 1.4 + k * 0.37) % 1) * (reduced ? 0 : 1);
          pose.position.set(((k % 5) - 2) * 0.09, -0.12 - f * 0.55, ((k % 3) - 1) * 0.07);
          pose.rotation.set(0, 0, 0);
          pose.scale.setScalar(1 - f * 0.4);
          pose.updateMatrix();
          drops.setMatrixAt(k, pose.matrix);
        }
        drops.instanceMatrix.needsUpdate = true;
      }

      // ── Confetti: cannon blasts from both sides, then a steady fall ──
      const confettiOn = onPodium && pt >= 2.6 && !reduced;
      confetti.visible = confettiOn;
      if (confettiOn) {
        const since = pt - 2.6;
        for (let i = 0; i < CONFETTI; i++) {
          const seed = i * 0.618034,
            fallSpeed = 0.9 + ((i * 0.37) % 1) * 0.7;
          const x0 = -7.2 + ((seed * 13.1) % 1) * 12.5,
            z0 = -2.6 + ((seed * 7.3) % 1) * 6.2;
          let x: number, y: number, z: number;
          if (i < 90 && since < 2.6) {
            // Cannon piece: launched from a side cannon on a ballistic arc.
            const side = i % 2 ? 1 : -1;
            const vx = -side * (2.2 + ((seed * 5.7) % 1) * 2.2),
              vy = 7.5 + ((seed * 3.1) % 1) * 3,
              vz = -1 + ((seed * 9.7) % 1) * 2.4;
            const age = since;
            x = side * 5.4 + vx * age;
            y = 0.6 + vy * age - 4.9 * age * age * 0.62;
            z = 1.2 + vz * age;
            if (y < 0.4) y = -50;
          } else {
            const cycle = 11;
            const yy = (since * fallSpeed + ((seed * 3.7) % 1) * cycle) % cycle;
            x = x0 + Math.sin(t * 1.3 + i) * 0.35;
            y = 11.2 - yy;
            z = z0 + Math.cos(t * 1.1 + i * 0.7) * 0.25;
          }
          pose.position.set(x, y, z);
          pose.rotation.set(t * 3.1 + i, t * 2.3 + i * 0.5, t * 1.7 + i * 0.3);
          pose.scale.setScalar(1);
          pose.updateMatrix();
          confetti.setMatrixAt(i, pose.matrix);
        }
        confetti.instanceMatrix.needsUpdate = true;
      }

      // ── Fireworks over the horizon ──
      fireworks.visible = onPodium && pt >= 3 && !reduced;
      if (fireworks.visible) {
        const p = fireworks.geometry.getAttribute('position') as T.BufferAttribute,
          c = fireworks.geometry.getAttribute('tint') as T.BufferAttribute,
          s = fireworks.geometry.getAttribute('size') as T.BufferAttribute,
          al = fireworks.geometry.getAttribute('alpha') as T.BufferAttribute;
        for (let b = 0; b < 4; b++) {
          const period = 2.9 + b * 0.35;
          const local = pt - 3 - b * 0.8;
          const cycleIndex = Math.floor(local / period);
          const age = local - cycleIndex * period;
          const seed = (cycleIndex * 4 + b) * 0.618034;
          const cx = -15 + ((seed * 11.3) % 1) * 26,
            cy = 10 + ((seed * 5.1) % 1) * 6,
            cz = -24 - ((seed * 3.7) % 1) * 10;
          const color = FIREWORK_COLORS[(b + Math.max(0, cycleIndex)) % 4];
          const spread = 4.2 * (1 - Math.exp(-age * 3.2));
          const fade = local < 0 ? 0 : Math.max(0, 1 - age / 1.9);
          for (let k = 0; k < 56; k++) {
            const j = b * 56 + k,
              d = burstDirs[k];
            p.setXYZ(j, cx + d.x * spread, cy + d.y * spread - age * age * 0.9, cz + d.z * spread);
            tint.copy(color).lerp(new T.Color('#ffffff'), Math.max(0, 0.6 - age));
            c.setXYZ(j, tint.r, tint.g, tint.b);
            s.setX(j, 0.55 + (k % 3) * 0.12);
            al.setX(j, fade * fade * (k % 4 === 0 ? 1 : 0.75));
          }
        }
        p.needsUpdate = c.needsUpdate = s.needsUpdate = al.needsUpdate = true;
      }
      // Sparkles orbit the champion once the crown is on.
      sparkles.visible = onPodium && pt >= 2.6 && !reduced;
      if (sparkles.visible) {
        const p = sparkles.geometry.getAttribute('position') as T.BufferAttribute,
          c = sparkles.geometry.getAttribute('tint') as T.BufferAttribute,
          s = sparkles.geometry.getAttribute('size') as T.BufferAttribute,
          al = sparkles.geometry.getAttribute('alpha') as T.BufferAttribute;
        const wx = winnerHolder.position.x,
          wy = winnerHolder.position.y,
          wz = winnerHolder.position.z;
        for (let k = 0; k < 26; k++) {
          const a = k * 2.399963 + t * (0.6 + (k % 3) * 0.2);
          const r = 0.95 + (k % 4) * 0.22;
          const y = wy + 0.2 + ((k * 0.37 + t * 0.25) % 1) * 3.6;
          p.setXYZ(k, wx + Math.cos(a) * r, y, wz + Math.sin(a) * r * 0.7);
          tint.set(k % 3 ? '#fff2b0' : '#ffd1f2');
          c.setXYZ(k, tint.r, tint.g, tint.b);
          s.setX(k, 0.12 + (k % 3) * 0.05);
          al.setX(k, 0.5 + 0.5 * Math.sin(t * 6 + k * 1.7));
        }
        p.needsUpdate = c.needsUpdate = s.needsUpdate = al.needsUpdate = true;
      }

      discoBall.rotation.y = reduced ? 0 : t * 0.4;
      (floorLights.material as T.MeshStandardMaterial).emissiveIntensity = reduced
        ? 0.55
        : 0.45 + Math.sin(t * 4) * 0.2;

      // ── Camera ──
      if (onPodium) {
        const hold = holdShot();
        if (pt < 3.2) shot(camA, camB, blend(pt / 3.2));
        else if (pt < holdAt) {
          shot(camB, camC, blend((pt - 4.6) / 4.2));
          controller.cameraPosition.x += Math.sin((pt - 3.2) * 0.45) * 0.5 * motion;
        } else {
          shot(camC, hold, blend((pt - holdAt) / 1.6));
          controller.cameraPosition.x += Math.sin((pt - holdAt) * 0.22) * 0.25 * motion;
        }
      } else if (inside) {
        controller.cameraPosition.set(Math.sin(t * 0.1) * 0.6, 2.55, 8.3);
        controller.cameraTarget.set(0, 1.35, -0.45);
        controller.cameraFov = 46;
      } else if (t < takeoffAt) {
        controller.cameraPosition.set(6.2, 4.6, 9.5);
        controller.cameraTarget.set(0, 1.5, -0.6);
        controller.cameraFov = 47;
      } else {
        const lift = blend((t - takeoffAt) / 5);
        controller.cameraPosition.set(8 + lift * 6, 5 + lift * 10, 9 - lift * 4);
        controller.cameraTarget.copy(ship.position).add(shipLookOffset);
        controller.cameraFov = 47;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (host && host.onBeforeRender === directCamera) host.onBeforeRender = hostHook!;
      group.removeFromParent();
      const geometries = new Set<T.BufferGeometry>(),
        ownedMaterials = new Set<T.Material>(),
        textures = new Set<T.Texture>();
      for (const extra of [trophy, ...drinks]) group.add(extra);
      // Crew materials are shared with every other alien in the game: only
      // their per-avatar geometry is ours to release.
      const shared = new Set<T.Object3D>();
      crew.forEach((alien) => alien.traverse((o) => shared.add(o)));
      group.traverse((object) => {
        const mesh = object as T.Mesh;
        if (!mesh.isMesh && !(object as T.Points).isPoints) return;
        geometries.add(mesh.geometry);
        if (shared.has(object)) return;
        (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) => {
          ownedMaterials.add(material);
          for (const value of Object.values(material))
            if (value instanceof T.Texture) textures.add(value);
        });
      });
      geometries.forEach((geometry) => geometry.dispose());
      ownedMaterials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
    },
  };
  // The ceremony is cut like a film: the camera sits exactly on each beat's
  // (already eased) framing instead of drifting in from the board view, so a
  // slow device never shows a half-way, top-down frame. The host's smoothing
  // still runs; this simply lands on the target for the on-screen pass.
  const host = (parent as T.Scene).isScene ? (parent as T.Scene) : undefined;
  const hostHook = host?.onBeforeRender;
  const lookAt = new T.Vector3();
  // WebGLRenderer calls scene.onBeforeRender(renderer, scene, camera, renderTarget).
  const directCamera = function (
    this: T.Scene,
    ...args: Parameters<T.Scene['onBeforeRender']>
  ) {
    hostHook?.apply(this, args);
    const camera = args[2],
      target = args[3] as unknown;
    const view = camera as T.PerspectiveCamera;
    if (disposed || target || !view.isPerspectiveCamera || !group.visible) return;
    if (Math.abs(view.fov - controller.cameraFov) > 0.01) return;
    view.position.copy(controller.cameraPosition);
    group.localToWorld(view.position);
    group.localToWorld(lookAt.copy(controller.cameraTarget));
    view.lookAt(lookAt);
    view.updateMatrixWorld();
  };
  if (host) host.onBeforeRender = directCamera;
  controller.update(0);
  return controller;
}
