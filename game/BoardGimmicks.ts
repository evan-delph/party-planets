import * as T from 'three';
import type { Game } from './engine';
import { assetUrl } from './assets';
import type { getBoard } from './boards';
import type { createBoardTiles } from './BoardTiles';

/**
 * The moving parts of each board's signature mechanic:
 * - the gimmick road (tide water, lava overflow or the cloud ferry) plus a
 *   crossing barrier that drops while the road is closed,
 * - Moonwake's jump pads, with the explorer's arc from pad to pad,
 * - Shrink Ray wormholes, which swallow tiny explorers and spit them out.
 * Everything keys off authoritative game state, so online peers agree.
 */
type Board = ReturnType<typeof getBoard>;
type Frame = {
  game?: Game;
  serverNow: number;
  dt: number;
  meshes: T.Group[];
  reduced: boolean;
};
const sound = (kind: string) =>
  window.dispatchEvent(new CustomEvent('sp-sound', { detail: { kind, delta: 0 } }));
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const smooth = (t: number) => t * t * (3 - 2 * t);
const TOP = 0.955;

const RIBBON_VERTEX = /* glsl */ `
  uniform float time;
  uniform float wave;
  varying vec2 vUv;
  varying vec3 vPos;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    world.y += (sin(world.x * 1.4 + time * 1.8) + cos(world.z * 1.1 + time * 1.3)) * wave;
    vPos = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }`;
const WATER_FRAGMENT = /* glsl */ `
  uniform float time;
  uniform float opacity;
  uniform vec3 deep;
  uniform vec3 shallow;
  varying vec2 vUv;
  varying vec3 vPos;
  void main() {
    float edge = min(vUv.x, 1.0 - vUv.x);
    float ripple = sin(vPos.x * 2.6 + time * 2.0) * sin(vPos.z * 2.9 - time * 1.6);
    vec3 col = mix(deep, shallow, 0.5 + 0.35 * ripple);
    float foam = smoothstep(0.17, 0.05, edge) + smoothstep(0.86, 1.0, ripple) * 0.5;
    col = mix(col, vec3(1.0), clamp(foam, 0.0, 1.0) * 0.85);
    float alpha = smoothstep(0.0, 0.05, edge) * (0.62 + foam * 0.35) * opacity;
    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
const LAVA_FRAGMENT = /* glsl */ `
  uniform float time;
  uniform float opacity;
  uniform float heat;
  uniform sampler2D crust;
  uniform sampler2D glow;
  varying vec2 vUv;
  varying vec3 vPos;
  void main() {
    float edge = min(vUv.x, 1.0 - vUv.x);
    vec2 uv = vPos.xz * 0.06 + vec2(time * 0.01, time * 0.006);
    vec3 base = texture2D(crust, uv).rgb * 0.55;
    vec3 hot = texture2D(glow, uv).rgb;
    float pulse = 0.8 + 0.2 * sin(time * 2.3 + vPos.x * 0.6);
    vec3 col = base + hot * (0.9 + heat * 1.2) * pulse + vec3(1.0, 0.3, 0.05) * heat * 0.12;
    float alpha = smoothstep(0.0, 0.08, edge) * opacity;
    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
const SWIRL_FRAGMENT = /* glsl */ `
  uniform float time;
  uniform vec3 tint;
  uniform float opacity;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    if (r > 1.0) discard;
    float a = atan(p.y, p.x);
    float arms = sin(a * 3.0 + r * 9.0 - time * 5.0);
    float core = smoothstep(0.55, 0.0, r);
    float rim = smoothstep(0.75, 0.98, r) * smoothstep(1.0, 0.95, r);
    vec3 col = tint * (0.35 + 0.65 * smoothstep(-0.2, 1.0, arms)) + vec3(1.0) * (core * 0.8 + rim);
    gl_FragColor = vec4(col, (0.55 + 0.45 * arms * (1.0 - r)) * opacity * smoothstep(1.0, 0.9, r));
    #include <colorspace_fragment>
  }`;
const BEAM_FRAGMENT = /* glsl */ `
  uniform vec3 tint;
  uniform float opacity;
  uniform float time;
  varying vec2 vUv;
  void main() {
    float fade = pow(1.0 - vUv.y, 2.2);
    float bands = 0.75 + 0.25 * sin(vUv.y * 26.0 - time * 7.0);
    gl_FragColor = vec4(tint, fade * bands * opacity);
    #include <colorspace_fragment>
  }`;
const SIMPLE_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

/** A flat strip following a smooth curve through `points`, uv.x across, uv.y along. */
function ribbon(points: T.Vector3[], width: number, samples = 96) {
  const curve = new T.CatmullRomCurve3(points, false, 'centripetal');
  const positions: number[] = [],
    uvs: number[] = [],
    index: number[] = [];
  const side = new T.Vector3();
  for (let i = 0; i <= samples; i++) {
    const t = i / samples,
      p = curve.getPointAt(t),
      tangent = curve.getTangentAt(t);
    side.set(-tangent.z, 0, tangent.x).normalize().multiplyScalar(width / 2);
    positions.push(p.x - side.x, 0, p.z - side.z, p.x + side.x, 0, p.z + side.z);
    uvs.push(0, t, 1, t);
    if (i < samples) {
      const a = i * 2;
      index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return { geometry, curve };
}

function labelSprite(text: string, color: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const c = canvas.getContext('2d')!;
  c.fillStyle = color;
  c.strokeStyle = '#1b2440';
  c.lineWidth = 6;
  c.beginPath();
  c.roundRect(4, 6, 248, 52, 26);
  c.fill();
  c.stroke();
  c.fillStyle = '#fff';
  c.font = '900 30px "Trebuchet MS", Arial, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, 128, 34);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  const sprite = new T.Sprite(new T.SpriteMaterial({ map: texture, depthTest: false, fog: false }));
  sprite.scale.set(2.4, 0.6, 1);
  sprite.renderOrder = 15;
  return sprite;
}

export function createBoardGimmicks(
  world: T.Object3D,
  board: Board,
  tiles: ReturnType<typeof createBoardTiles>,
) {
  const root = new T.Group();
  world.add(root);
  const nodes = board.spaces;
  const time = { value: 0 };
  const updaters: ((frame: Frame, openness: number) => void)[] = [];
  const at = (id: number, y = 0) => new T.Vector3(nodes[id].x, y, nodes[id].z);

  // ── Gimmick road ─────────────────────────────────────────────────────────
  const gate = board.gateRoad;
  let openness = 1,
    knownOpen: boolean | undefined;
  if (gate) {
    const ids = gate.spaceIds;
    const start = at(gate.from).lerp(at(ids[0]), 0.55),
      end = at(gate.to).lerp(at(ids[ids.length - 1]), 0.55);
    const path = [start, ...ids.map((id) => at(id)), end];

    if (board.gimmick === 'tide' || board.gimmick === 'eruption') {
      const lava = board.gimmick === 'eruption';
      const { geometry } = ribbon(path, lava ? 3.4 : 4.2);
      let material: T.ShaderMaterial;
      if (lava) {
        const loader = new T.TextureLoader();
        const tex = (url: string) => {
          const t = loader.load(assetUrl(url));
          t.wrapS = t.wrapT = T.RepeatWrapping;
          t.colorSpace = T.SRGBColorSpace;
          return t;
        };
        material = new T.ShaderMaterial({
          uniforms: {
            time,
            wave: { value: 0.02 },
            opacity: { value: 0 },
            heat: { value: 0 },
            crust: { value: tex('/textures/planets/ignara-color.webp') },
            glow: { value: tex('/textures/planets/ignara-glow.webp') },
          },
          vertexShader: RIBBON_VERTEX,
          fragmentShader: LAVA_FRAGMENT,
          transparent: true,
          depthWrite: false,
          side: T.DoubleSide,
        });
      } else
        material = new T.ShaderMaterial({
          uniforms: {
            time,
            wave: { value: 0.035 },
            opacity: { value: 0 },
            deep: { value: new T.Color('#0f8fa6') },
            shallow: { value: new T.Color('#62d9df') },
          },
          vertexShader: RIBBON_VERTEX,
          fragmentShader: WATER_FRAGMENT,
          transparent: true,
          depthWrite: false,
          side: T.DoubleSide,
        });
      const flood = new T.Mesh(geometry, material);
      flood.renderOrder = 3;
      root.add(flood);
      const glow = lava ? new T.PointLight('#ff7a2e', 0, 16, 1.6) : undefined;
      if (glow) {
        glow.position.copy(path[Math.floor(path.length / 2)]).setY(2.5);
        root.add(glow);
      }
      // Embers (lava) or spray (tide) drifting up from the closed road.
      const motes = new T.InstancedMesh(
        new T.IcosahedronGeometry(lava ? 0.09 : 0.07, 0),
        new T.MeshBasicMaterial({ color: lava ? '#ffb347' : '#e8ffff', transparent: true }),
        40,
      );
      motes.frustumCulled = false;
      root.add(motes);
      const curve = new T.CatmullRomCurve3(path);
      const dummy = new T.Object3D();
      updaters.push(({ reduced }, open) => {
        const closed = 1 - open;
        flood.visible = closed > 0.01;
        material.uniforms.opacity.value = smooth(clamp01(closed * 1.6));
        flood.position.y = T.MathUtils.lerp(0.35, lava ? 1.0 : 1.06, smooth(closed));
        if (lava) material.uniforms.heat.value = closed;
        if (glow) glow.intensity = closed * (reduced ? 6 : 6 + Math.sin(time.value * 3) * 1.5);
        motes.visible = !reduced && closed > 0.5;
        if (!motes.visible) return;
        for (let i = 0; i < 40; i++) {
          const life = (time.value * (lava ? 0.45 : 0.6) + i * 0.618) % 1;
          const p = curve.getPointAt((i * 0.137) % 1);
          dummy.position.set(
            p.x + Math.sin(i * 7.3) * 1.4,
            flood.position.y + life * (lava ? 3.2 : 1.1),
            p.z + Math.cos(i * 3.1) * 1.4,
          );
          dummy.scale.setScalar((1 - life) * closed);
          dummy.updateMatrix();
          motes.setMatrixAt(i, dummy.matrix);
        }
        motes.instanceMatrix.needsUpdate = true;
      });
    }

    if (board.gimmick === 'ferry') {
      // A cloud-balloon gondola that docks beside the first ferry stop.
      const ferry = new T.Group();
      const wood = new T.MeshStandardMaterial({ color: '#b07a4f', roughness: 0.6 });
      const trim = new T.MeshStandardMaterial({ color: '#ffd36b', metalness: 0.6, roughness: 0.3 });
      const cloud = new T.MeshStandardMaterial({
        color: '#ffffff',
        roughness: 0.95,
        emissive: '#ffd6f2',
        emissiveIntensity: 0.25,
      });
      const hull = new T.Mesh(
        new T.LatheGeometry(
          [
            [0, -0.55],
            [0.55, -0.48],
            [0.85, -0.2],
            [0.95, 0.15],
            [0.9, 0.2],
          ].map(([r, y]) => new T.Vector2(r, y)),
          24,
        ),
        wood,
      );
      hull.scale.set(1.7, 1, 1);
      hull.castShadow = true;
      const rail = new T.Mesh(new T.TorusGeometry(0.92, 0.05, 6, 32), trim);
      rail.rotation.x = Math.PI / 2;
      rail.position.y = 0.2;
      rail.scale.set(1.7, 1, 1);
      ferry.add(hull, rail);
      const puffs = [
        [0, 2.6, 0, 1.25],
        [1.2, 2.4, 0.1, 0.95],
        [-1.2, 2.45, -0.1, 1],
        [0.5, 3.2, 0.2, 0.85],
        [-0.6, 3.15, -0.2, 0.8],
        [2.1, 2.3, 0, 0.6],
        [-2.05, 2.35, 0, 0.62],
      ];
      for (const [x, y, z, r] of puffs) {
        const puff = new T.Mesh(new T.IcosahedronGeometry(r, 2), cloud);
        puff.position.set(x, y, z);
        puff.castShadow = true;
        ferry.add(puff);
      }
      for (const x of [-0.9, 0.9]) {
        const rope = new T.Mesh(new T.CylinderGeometry(0.025, 0.025, 1.9, 5), trim);
        rope.position.set(x, 1.15, 0);
        ferry.add(rope);
      }
      const prop = new T.Group();
      for (let i = 0; i < 3; i++) {
        const blade = new T.Mesh(new T.BoxGeometry(0.08, 0.7, 0.16), trim);
        blade.position.y = 0.35;
        const arm = new T.Group();
        arm.rotation.x = (i * Math.PI * 2) / 3;
        arm.add(blade);
        prop.add(arm);
      }
      prop.position.set(-1.75, 0.05, 0);
      ferry.add(prop);
      const flag = new T.Mesh(
        new T.PlaneGeometry(0.6, 0.35),
        new T.MeshStandardMaterial({ color: '#ff8fd0', side: T.DoubleSide }),
      );
      flag.position.set(1.55, 0.7, 0);
      ferry.add(flag);
      root.add(ferry);

      const first = at(ids[0]),
        second = at(ids[1] ?? gate.to),
        along = second.clone().sub(first).normalize(),
        across = new T.Vector3(-along.z, 0, along.x);
      // Dock on whichever side of the road has more room.
      const clearance = (p: T.Vector3) =>
        Math.min(...nodes.map((n) => Math.hypot(n.x - p.x, n.z - p.z)));
      const left = first.clone().addScaledVector(across, 3),
        right = first.clone().addScaledVector(across, -3);
      const dock = clearance(left) > clearance(right) ? left : right;
      dock.y = 1.1;
      const outward = dock.clone().sub(first).setY(0).normalize();
      const away = dock.clone().addScaledVector(outward, 34).setY(16);
      ferry.rotation.y = Math.atan2(-along.z, along.x);

      // Cloud puffs flank the ferry road and thin out while it's away.
      const flank = new T.InstancedMesh(new T.IcosahedronGeometry(0.55, 2), cloud, ids.length * 2);
      flank.castShadow = true;
      root.add(flank);
      const dummy = new T.Object3D();
      updaters.push(({ reduced }, open) => {
        const e = smooth(open);
        ferry.visible = e > 0.01;
        ferry.position.lerpVectors(away, dock, e);
        if (!reduced) {
          ferry.position.y += Math.sin(time.value * 1.3) * 0.18;
          ferry.rotation.z = Math.sin(time.value * 0.9) * 0.04;
          prop.rotation.x = time.value * (8 + (1 - e) * 10);
          flag.rotation.y = Math.sin(time.value * 4) * 0.3;
        }
        ferry.scale.setScalar(0.6 + e * 0.4);
        ids.forEach((id, i) => {
          for (const s of [-1, 1]) {
            const n = nodes[id];
            const next = nodes[ids[i + 1] ?? gate.to];
            const dx = next.x - n.x,
              dz = next.z - n.z,
              len = Math.hypot(dx, dz) || 1;
            dummy.position.set(
              n.x + (-dz / len) * 1.35 * s,
              0.75 + (reduced ? 0 : Math.sin(time.value + id + s) * 0.08),
              n.z + (dx / len) * 1.35 * s,
            );
            dummy.scale.set(1.2, 0.55, 1.2).multiplyScalar(0.15 + e * 0.85);
            dummy.updateMatrix();
            flank.setMatrixAt(i * 2 + (s > 0 ? 1 : 0), dummy.matrix);
          }
        });
        flank.instanceMatrix.needsUpdate = true;
      });
    }

    // Crossing barrier where the gimmick road leaves its junction.
    {
      const j = at(gate.from),
        f = at(ids[0]),
        dir = f.clone().sub(j).normalize(),
        across = new T.Vector3(-dir.z, 0, dir.x);
      const spot = j.clone().lerp(f, 0.5);
      const barrier = new T.Group();
      barrier.position.copy(spot);
      barrier.rotation.y = Math.atan2(across.x, across.z) - Math.PI / 2;
      const metal = new T.MeshStandardMaterial({ color: '#39424f', metalness: 0.7, roughness: 0.35 });
      const stripes = document.createElement('canvas');
      stripes.width = 128;
      stripes.height = 16;
      const sc = stripes.getContext('2d')!;
      for (let i = 0; i < 8; i++) {
        sc.fillStyle = i % 2 ? '#ffffff' : '#e8413c';
        sc.fillRect(i * 16, 0, 16, 16);
      }
      const stripeTex = new T.CanvasTexture(stripes);
      stripeTex.colorSpace = T.SRGBColorSpace;
      const armMat = new T.MeshStandardMaterial({ map: stripeTex, roughness: 0.4 });
      for (const s of [-1, 1]) {
        const post = new T.Mesh(new T.CylinderGeometry(0.09, 0.12, 1.5, 10), metal);
        post.position.set(s * 1.25, 1.35, 0);
        post.castShadow = true;
        barrier.add(post);
      }
      const pivot = new T.Group();
      pivot.position.set(-1.25, 1.85, 0);
      const arm = new T.Mesh(new T.BoxGeometry(2.6, 0.14, 0.1), armMat);
      arm.position.x = 1.3;
      arm.castShadow = true;
      pivot.add(arm);
      barrier.add(pivot);
      const lampMat = new T.MeshStandardMaterial({ color: '#222', emissive: '#40ff7a', emissiveIntensity: 2 });
      const lamp = new T.Mesh(new T.SphereGeometry(0.16, 12, 8), lampMat);
      lamp.position.set(1.25, 2.2, 0);
      barrier.add(lamp);
      root.add(barrier);
      updaters.push(({ reduced }, open) => {
        pivot.rotation.z = smooth(open) * Math.PI * 0.47;
        const closedNow = open < 0.5;
        lampMat.emissive.set(closedNow ? '#ff3b2f' : '#40ff7a');
        lampMat.emissiveIntensity =
          closedNow && !reduced ? (Math.sin(time.value * 8) > 0 ? 3 : 0.3) : 2;
      });
    }
    updaters.push((_, open) => tiles.setDim(ids, 1 - open));
  }

  // ── Jump pads ────────────────────────────────────────────────────────────
  const pads = nodes.filter((n) => n.type === 'portal');
  const padTint = new T.Color('#7fe3ff');
  const beamGeo = new T.CylinderGeometry(0.72, 0.86, 3.4, 28, 1, true);
  beamGeo.translate(0, 1.7, 0);
  const beamMat = new T.ShaderMaterial({
    uniforms: { tint: { value: padTint }, opacity: { value: 0.55 }, time },
    vertexShader: SIMPLE_VERTEX,
    fragmentShader: BEAM_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
    side: T.DoubleSide,
  });
  const ringMat = new T.MeshStandardMaterial({
    color: '#dff8ff',
    emissive: '#5fdcff',
    emissiveIntensity: 2,
    metalness: 0.4,
    roughness: 0.3,
  });
  const chevronMat = new T.MeshBasicMaterial({ color: '#eaffff', transparent: true });
  const padParts: { ring: T.Mesh; chevrons: T.Group; beam: T.Mesh }[] = [];
  pads.forEach((n, i) => {
    const next = pads[(i + 1) % pads.length];
    const ring = new T.Mesh(new T.TorusGeometry(0.9, 0.06, 8, 40), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(n.x, TOP + 0.04, n.z);
    const beam = new T.Mesh(beamGeo, beamMat);
    beam.position.set(n.x, TOP, n.z);
    // Chevrons point toward the pad this one launches to.
    const chevrons = new T.Group();
    chevrons.position.set(n.x, TOP + 0.6, n.z);
    chevrons.rotation.y = Math.atan2(next.x - n.x, next.z - n.z);
    for (let k = 0; k < 3; k++) {
      const c = new T.Mesh(new T.ConeGeometry(0.22, 0.34, 3), chevronMat);
      c.rotation.x = Math.PI / 2;
      c.position.z = (k - 1) * 0.36;
      chevrons.add(c);
    }
    root.add(ring, beam, chevrons);
    padParts.push({ ring, chevrons, beam });
  });
  updaters.push(({ reduced }) => {
    padParts.forEach((p, i) => {
      const pulse = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(time.value * 3 + i);
      p.ring.scale.setScalar(1 + pulse * 0.06);
      p.chevrons.position.y = TOP + 0.55 + (reduced ? 0 : ((time.value * 0.9 + i * 0.3) % 1) * 0.9);
      p.chevrons.children.forEach((c, k) => {
        (c as T.Mesh).scale.setScalar(0.7 + 0.3 * Math.sin(time.value * 6 - k));
      });
    });
    ringMat.emissiveIntensity = 1.6 + Math.sin(time.value * 3) * 0.5;
  });

  // Launch arcs, keyed by event id.
  type Launch = { player: string; from: number; to: number; at: number; landed: boolean; launched: boolean };
  const launches = new Map<number, Launch>();
  let seenEvent: number | undefined;

  // ── Shrink Ray wormholes ─────────────────────────────────────────────────
  const swirlGeo = new T.CircleGeometry(0.85, 40);
  const swirlMat = new T.ShaderMaterial({
    uniforms: { time, tint: { value: new T.Color('#b06cff') }, opacity: { value: 1 } },
    vertexShader: SIMPLE_VERTEX,
    fragmentShader: SWIRL_FRAGMENT,
    transparent: true,
    depthWrite: false,
    side: T.DoubleSide,
  });
  const frameMat = new T.MeshStandardMaterial({
    color: '#3a2a5c',
    emissive: '#a35cff',
    emissiveIntensity: 1.4,
    metalness: 0.6,
    roughness: 0.3,
  });
  const gateways = new Map<number, T.Vector3>();
  const wormholeGroups: T.Group[] = [];
  for (const pair of board.wormholes)
    pair.forEach((id, k) => {
      if (gateways.has(id)) return;
      const n = nodes[id];
      // Stand beside the tile, facing it, on the side with more room.
      const out = new T.Vector3(n.x, 0, n.z).normalize();
      const candidates = [0, 1, 2, 3, 4, 5, 6, 7].map((a) => {
        const angle = Math.atan2(out.x, out.z) + (a * Math.PI) / 4;
        return new T.Vector3(n.x + Math.sin(angle) * 1.9, 0, n.z + Math.cos(angle) * 1.9);
      });
      const room = (p: T.Vector3) =>
        Math.min(
          ...nodes.filter((m) => m.id !== id).map((m) => Math.hypot(m.x - p.x, m.z - p.z)),
        );
      const spot = candidates.reduce((a, b) => (room(b) > room(a) + 0.3 ? b : a));
      const g = new T.Group();
      g.position.set(spot.x, 1.95, spot.z);
      g.rotation.y = Math.atan2(n.x - spot.x, n.z - spot.z);
      const swirl = new T.Mesh(swirlGeo, swirlMat);
      const rim = new T.Mesh(new T.TorusGeometry(0.9, 0.09, 10, 40), frameMat);
      const stand = new T.Mesh(new T.CylinderGeometry(0.08, 0.14, 1.1, 8), frameMat);
      stand.position.y = -1.35;
      const label = labelSprite(k === 0 ? 'MINI WARP' : 'WARP EXIT', '#8b55e8');
      label.position.y = 1.35;
      g.add(swirl, rim, stand, label);
      root.add(g);
      wormholeGroups.push(g);
      gateways.set(id, new T.Vector3(spot.x, 0.96, spot.z));
    });
  const wormholePairs = new Set(board.wormholes.map(([a, b]) => `${a}>${b}`));
  let warpKey = -1;

  /** Returns true while an explorer is mid-launch or mid-warp (camera should follow). */
  function frame(f: Frame): boolean {
    const { game, serverNow, dt, meshes, reduced } = f;
    let busy = false;
    if (!reduced) time.value += dt;
    root.visible = true;
    // Ease the gimmick road toward the authoritative open state.
    const open = game ? game.routesOpen !== false : true;
    if (knownOpen === undefined) openness = open ? 1 : 0;
    else if (open !== knownOpen && gate) sound('gate');
    knownOpen = open;
    openness = reduced ? (open ? 1 : 0) : T.MathUtils.lerp(openness, open ? 1 : 0, 1 - Math.exp(-dt * 1.6));
    for (const u of updaters) u(f, openness);
    for (const g of wormholeGroups) g.children[0].rotation.z = reduced ? 0 : -time.value * 0.6;
    if (!game) return false;

    // New launch events (fresh ones only).
    const lastId = game.events?.at(-1)?.id ?? 0;
    if (seenEvent === undefined) seenEvent = lastId;
    if (lastId > seenEvent) {
      for (const ev of game.events!)
        if (ev.id > seenEvent && ev.kind === 'launch' && ev.to !== undefined && serverNow - ev.at < 2000)
          launches.set(ev.id, { player: ev.player, from: ev.space, to: ev.to, at: ev.at, landed: false, launched: false });
      seenEvent = lastId;
    }
    for (const [id, l] of launches) {
      const index = game.players.findIndex((p) => p.id === l.player),
        m = meshes[index];
      const t = (serverNow - l.at - 350) / 1250;
      if (!m || t > 1.35) {
        if (m) m.rotation.x = 0;
        launches.delete(id);
        continue;
      }
      busy = true;
      const from = nodes[l.from],
        to = nodes[l.to];
      if (t < 0) {
        // Crouch on the pad before take-off.
        m.position.set(from.x, 0.96, from.z);
        const crouch = clamp01((t + 0.28) / 0.28);
        m.scale.y *= 1 - crouch * 0.3;
        continue;
      }
      if (!l.launched) {
        l.launched = true;
        sound('launch');
      }
      const k = clamp01(t);
      const distance = Math.hypot(to.x - from.x, to.z - from.z);
      m.position.set(
        T.MathUtils.lerp(from.x, to.x, k),
        0.96 + Math.sin(k * Math.PI) * (3.2 + distance * 0.08),
        T.MathUtils.lerp(from.z, to.z, k),
      );
      m.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
      m.rotation.x = reduced ? 0 : smooth(k) * Math.PI * 2;
      if (t >= 1) {
        m.rotation.x = 0;
        if (!l.landed) {
          l.landed = true;
          sound('land');
        }
        const squash = Math.sin(clamp01((t - 1) / 0.35) * Math.PI) * 0.3;
        m.scale.y *= 1 - squash;
        m.scale.x *= 1 + squash * 0.5;
        m.scale.z *= 1 + squash * 0.5;
      }
    }

    // Wormhole crossings: shrink into the entrance, glide hidden, pop out.
    const mv = game.movement;
    if (game.phase === 'moving' && mv && wormholePairs.has(`${mv.from}>${mv.to}`)) {
      const m = meshes[game.active];
      const t = clamp01((serverNow - mv.startedAt) / Math.max(1, mv.arrivesAt - mv.startedAt));
      if (warpKey !== mv.startedAt) {
        warpKey = mv.startedAt;
        if (serverNow - mv.startedAt < 600) sound('warp');
      }
      const enter = gateways.get(mv.from)!,
        exit = gateways.get(mv.to)!,
        from = at(mv.from, 0.96),
        to = at(mv.to, 0.96);
      if (m) {
        let scale = 1;
        if (t < 0.3) {
          const k = smooth(t / 0.3);
          m.position.lerpVectors(from, enter, k).setY(0.96 + k * 1.0);
          scale = 1 - k;
        } else if (t > 0.7) {
          const k = smooth((t - 0.7) / 0.3);
          m.position.lerpVectors(exit, to, k).setY(1.96 - k * 1.0);
          scale = k;
        } else {
          m.position.lerpVectors(enter, exit, (t - 0.3) / 0.4).setY(1.96);
          scale = 0;
        }
        m.visible = scale > 0.02;
        m.scale.multiplyScalar(Math.max(0.001, scale));
        if (!reduced) m.rotation.y += time.value * 12 * (1 - scale);
      }
    }
    return busy;
  }

  return {
    frame,
    dispose() {
      root.removeFromParent();
      root.traverse((o) => {
        const mesh = o as T.Mesh;
        mesh.geometry?.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
        for (const mat of mats) {
          for (const v of Object.values(mat)) if (v instanceof T.Texture) v.dispose();
          if (mat instanceof T.ShaderMaterial)
            for (const u of Object.values(mat.uniforms)) if (u.value instanceof T.Texture) u.value.dispose();
          mat.dispose();
        }
      });
    },
  };
}
