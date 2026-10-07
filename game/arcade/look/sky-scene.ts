import * as T from 'three';
import type { Arena } from '../simulation';
import { coursePlatforms, courseBridges, onSkyBridge } from '../expansion';
import {
  Bucket,
  type IslandBuckets,
  addBush,
  addFence,
  addIsland,
  addTree,
  at,
  arrowTexture,
  bannerTexture,
  blobTexture,
  edgeAoTexture,
  glowTexture,
  checkerTexture,
  cloudPuff,
  grassTexture,
  hash,
  starGeometry,
} from './sky-geo';
import {
  Birds,
  Particles,
  SKY,
  Wind,
  cloudMaterial,
  cloudSea,
  raysTexture,
  skyDome,
} from './sky-fx';

/** Signature racer colours: rings, chips, bunting and bursts all share these. */
export const SKY_RACERS = ['#ffbb12', '#ff4a86', '#22adff', '#9a62ff'];
const MOVING = [3, 7, 11, 13];
const GATES: Record<number, [string, string, string]> = {
  0: ['START', '#8be65c', '#2fa94a'],
  5: ['CHECKPOINT', '#ffe24a', '#ff961c'],
  10: ['CHECKPOINT', '#ffe24a', '#ff961c'],
  15: ['FINISH', '#ff7dbb', '#e62f78'],
};
const mixC = (a: string, b: string, t: number, out: T.Color) =>
  out.set(a).lerp(new T.Color(b), Math.max(0, Math.min(1, t)));

/**
 * Skybridge Sprint presentation: lush floating islands over a cloud sea, a
 * low chase camera, warm key sun with a cool rim, and racer-coloured juice.
 */
export function buildSkyScene(o: {
  scene: T.Scene;
  renderer: T.WebGLRenderer;
  camera: T.PerspectiveCamera;
  sun: T.DirectionalLight;
  hemi: T.HemisphereLight;
  low: boolean;
  names: string[];
}) {
  const { scene, renderer, camera, sun, hemi, low } = o;
  renderer.toneMapping = T.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  const shared = scene.getObjectByName('Sky dome');
  if (shared) shared.visible = false;
  scene.environmentIntensity = 0.2;
  // Aerial perspective: everything past the next few islands drifts into a
  // pale blue haze, so the course in front of the racer pops.
  scene.fog = new T.Fog(SKY.haze, 16, 125);
  hemi.color.set('#b4d4ff');
  hemi.groundColor.set('#5d6d84');
  hemi.intensity = 0.6;
  sun.color.set('#ffe8c2');
  sun.intensity = 4.6;
  sun.castShadow = !low;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 3.5;
  sun.shadow.intensity = 0.9;
  // Software rasterisers (SwiftShader, llvmpipe) stall for many seconds when
  // the adaptive meter toggles shadows and every shader recompiles, so the
  // renderer keeps one fixed setup for them (see `software`).
  const gl = renderer.getContext(),
    gpuInfo = gl.getExtension('WEBGL_debug_renderer_info'),
    gpu = gpuInfo ? String(gl.getParameter(gpuInfo.UNMASKED_RENDERER_WEBGL)) : '';
  const software = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(gpu);
  if (software) renderer.setPixelRatio(Math.min(renderer.getPixelRatio(), 0.75));
  Object.assign(sun.shadow.camera, {
    left: -30,
    right: 30,
    top: 30,
    bottom: -30,
    near: 1,
    far: 110,
  });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.035;
  const rim = new T.DirectionalLight('#cfe4ff', 1.4);
  scene.add(rim, rim.target);

  const root = new T.Group();
  root.userData.gameColor = true; // keep the shared planet grain off our art
  scene.add(root);
  const { dome, mat: domeMat } = skyDome();
  // Warm sun bloom hanging over the far clouds.
  const sunGlow = new T.Sprite(
    new T.SpriteMaterial({
      map: glowTexture(),
      color: '#fff1cf',
      blending: T.AdditiveBlending,
      depthWrite: false,
      fog: false,
      toneMapped: false,
      opacity: 0.85,
    }),
  );
  sunGlow.scale.setScalar(150);
  sunGlow.renderOrder = -4;
  scene.add(sunGlow);
  // Slow-turning god rays fanning out of the sun corner.
  const rays = new T.Sprite(
    new T.SpriteMaterial({
      map: raysTexture(),
      color: '#fff3d6',
      blending: T.AdditiveBlending,
      depthWrite: false,
      fog: false,
      toneMapped: false,
      opacity: 0.55,
    }),
  );
  rays.scale.setScalar(420);
  rays.renderOrder = -3;
  scene.add(rays);
  scene.add(dome);
  const sea = cloudSea(-12);
  scene.add(sea.mesh);

  const grassTex = grassTexture();
  const M = {
    grass: new T.MeshStandardMaterial({
      map: grassTex,
      vertexColors: true,
      roughness: 0.95,
    }),
    rock: new T.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      flatShading: true,
    }),
    leaf: new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 }),
    paint: new T.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.5,
      side: T.DoubleSide,
    }),
    wood: new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }),
  };
  const buckets = (): IslandBuckets => ({
    grass: new Bucket(),
    rock: new Bucket(),
    leaf: new Bucket(),
    paint: new Bucket(),
  });
  const flush = (b: IslandBuckets, parent: T.Object3D) => {
    for (const k of ['grass', 'rock', 'leaf', 'paint'] as const) {
      const m = b[k].build(M[k], k !== 'paint');
      if (m) parent.add(m);
    }
  };
  const stat = buckets(),
    wood = new Bucket(),
    blobs = new Bucket();
  // Soft contact shadows: ground every prop even when the shadow map is off.
  const blobMat = new T.MeshBasicMaterial({
    color: '#14331a',
    alphaMap: blobTexture(),
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const blob = (x: number, y: number, z: number, r: number) =>
    blobs.add(
      new T.PlaneGeometry(r * 2, r * 2).rotateX(-Math.PI / 2),
      // Stretched away from the sun so the blobs read as cast shadows.
      at(x - r * 0.38, y + 0.012, z + r * 0.06, 0, 1.4, 1, 1),
      '#000000',
    );
  // Baked edge occlusion on every lawn (one merged decal mesh per shape).
  const aoMat = (round: boolean) =>
    new T.MeshBasicMaterial({
      color: '#0f3a14',
      alphaMap: edgeAoTexture(round),
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
  const aoRect = new Bucket(),
    aoRound = new Bucket();
  const ao = (b: Bucket, x: number, y: number, z: number, w: number, d: number) =>
    b.add(new T.PlaneGeometry(w, d).rotateX(-Math.PI / 2), at(x, y + 0.008, z), '#ffffff');

  // ── Course islands ────────────────────────────────────────────────────
  const pads = coursePlatforms(0);
  const movers: { group: T.Group; i: number }[] = [];
  pads.forEach((p, i) => {
    const moving = MOVING.includes(i),
      b = moving ? buckets() : stat,
      x = moving ? 0 : p.x,
      z = moving ? 0 : p.z;
    addIsland(b, {
      x,
      y: 0,
      z,
      w: p.w,
      d: p.d,
      seed: i * 13 + 5,
      flowers: p.checkpoint ? 18 : p.w < 2 ? 3 : 7,
      depth: moving ? 1.3 : undefined,
    });
    if (!moving) ao(aoRect, x, 0, z, p.w, p.d);
    if (moving) {
      // Chevrons telling the player this island slides side to side.
      for (const side of [-1, 1]) {
        const tri = new T.ShapeGeometry(
          new T.Shape([
            new T.Vector2(0, 0.28),
            new T.Vector2(0, -0.28),
            new T.Vector2(0.32 * side, 0),
          ]),
        );
        tri.rotateX(-Math.PI / 2);
        for (const k of [0, 1])
          b.paint.add(
            tri.clone(),
            at(side * (p.w / 2 - 0.75 + k * 0.28), 0.012, 0),
            '#fff6cf',
          );
        tri.dispose();
      }
      const g = new T.Group();
      flush(b, g);
      const gAo = new Bucket();
      ao(gAo, 0, 0, 0, p.w, p.d);
      const gAoMesh = gAo.build(aoMat(false), false);
      if (gAoMesh) {
        gAoMesh.receiveShadow = false;
        gAoMesh.renderOrder = 1;
        g.add(gAoMesh);
      }
      g.position.set(p.x, 0, p.z);
      root.add(g);
      movers.push({ group: g, i });
    }
    if (p.checkpoint) {
      const half = p.w / 2 - 0.3;
      for (const side of [-1, 1]) {
        addFence(
          wood,
          p.x + side * half,
          p.z + p.d / 2 - 0.35,
          p.x + side * half,
          p.z - p.d / 2 + 1.0,
          0,
        );
        addBush(stat, p.x + side * (half - 0.15), 0, p.z + p.d / 2 - 0.2, 1.1, i + side);
        blob(p.x + side * (half - 0.15), 0, p.z + p.d / 2 - 0.2, 0.75);
      }
    }
  });

  // ── Rope bridges ──────────────────────────────────────────────────────
  const planks = ['#cf8f4c', '#bb7a3d', '#dca263'];
  for (const { a, b, width } of courseBridges(0)) {
    const dx = b.x - a.x,
      dz = b.z - a.z,
      L = Math.hypot(dx, dz),
      ang = Math.atan2(dx, dz);
    const inside = (px: number, pz: number, p: typeof a) =>
      Math.abs(px - p.x) < p.w / 2 - 0.3 && Math.abs(pz - p.z) < p.d / 2 - 0.3;
    let first = -1,
      last = -1;
    for (let s = 0; s <= L; s += 0.25) {
      const t = s / L,
        px = a.x + dx * t,
        pz = a.z + dz * t;
      if (inside(px, pz, a) || inside(px, pz, b)) continue;
      if (first < 0) first = t;
      last = t;
      const col = planks[Math.floor(hash(s * 7 + a.z) * 3)];
      wood.add(
        new T.BoxGeometry(width + 0.2, 0.08, 0.21),
        at(px, -0.03, pz, ang + (hash(s * 3) - 0.5) * 0.1),
        (_p, n, c) => mixC(col, '#8a5428', n.y > 0.5 ? 0 : 0.6, c),
        { jitter: 0.14 },
      );
    }
    const perp = [Math.cos(ang), -Math.sin(ang)];
    for (const side of [-1, 1]) {
      const off = side * (width / 2 + 0.12);
      const P = [first, (first + last) / 2, last].map(
        (t) =>
          new T.Vector3(
            a.x + dx * t + perp[0] * off,
            0,
            a.z + dz * t + perp[1] * off,
          ),
      );
      for (const q of P)
        wood.add(
          new T.CylinderGeometry(0.06, 0.075, 1.0, 6),
          at(q.x, 0.4, q.z),
          '#7d4e29',
        );
      // Under-beam along each side.
      wood.add(
        new T.BoxGeometry(0.09, 0.12, (last - first) * L + 0.3),
        at((P[0].x + P[2].x) / 2, -0.1, (P[0].z + P[2].z) / 2, ang),
        '#6e4424',
      );
      for (let k = 0; k < 2; k++) {
        const s = P[k].clone().setY(0.82),
          e = P[k + 1].clone().setY(0.82),
          m = s.clone().lerp(e, 0.5).setY(0.6);
        wood.add(
          new T.TubeGeometry(new T.QuadraticBezierCurve3(s, m, e), 14, 0.03, 5),
          null,
          '#ecd09a',
        );
      }
    }
  }

  // ── Gates: arches, banners, bunting, flags and glow rings ─────────────
  const flags: { mesh: T.Mesh; base: Float32Array; phase: number }[] = [];
  const rings: { mesh: T.Mesh; i: number }[] = [];
  const gates: { group: T.Group; z: number; mats: T.Material[] }[] = [];
  const checker = checkerTexture();
  for (const key of Object.keys(GATES)) {
    const i = Number(key),
      p = pads[i],
      [text, from, to] = GATES[i],
      za = p.z - p.d / 2 + 0.5,
      half = p.w / 2 - 0.35;
    // Each gate is its own group so it can fade once the racer runs through.
    const gate = new T.Group(),
      gw = new Bucket(),
      gp = new Bucket();
    root.add(gate);
    for (const side of [-1, 1]) {
      const px = p.x + side * half;
      blob(px, 0, za, 0.5);
      stat.rock.add(
        new T.CylinderGeometry(0.3, 0.38, 0.4, 8),
        at(px, 0.2, za),
        (_p, n, c) => c.set(n.y > 0.5 ? '#d8cfc0' : '#a99c8c'),
      );
      gw.add(
        new T.CylinderGeometry(0.15, 0.17, 3.6, 10),
        at(px, 1.95, za),
        (p2, _n, c) => mixC('#8a5730', '#c88a4e', p2.y / 3.6, c),
      );
      gw.add(new T.SphereGeometry(0.2, 10, 8), at(px, 3.8, za), '#ffd54a');
      gw.add(
        new T.CylinderGeometry(0.025, 0.025, 1.0, 5),
        at(px, 4.35, za),
        '#f2e6cf',
      );
      // Flag on top of each post.
      const fg = new T.PlaneGeometry(0.85, 0.52, 10, 2);
      fg.translate(0.425 * side, 0, 0);
      const flag = new T.Mesh(
        fg,
        new T.MeshStandardMaterial({
          color: i === 15 || i === 0 ? '#ffffff' : SKY_RACERS[(i / 5 + (side > 0 ? 1 : 0)) % 4],
          map: i === 15 || i === 0 ? checker : null,
          side: T.DoubleSide,
          roughness: 0.6,
        }),
      );
      flag.position.set(px, 4.6, za);
      flag.castShadow = true;
      gate.add(flag);
      flags.push({
        mesh: flag,
        base: Float32Array.from(fg.getAttribute('position').array),
        phase: i + side,
      });
    }
    // Top beam and sign board.
    gw.add(
      new T.CylinderGeometry(0.11, 0.11, half * 2 + 0.5, 8),
      at(p.x, 3.55, za, 0, 1, 1, 1, 0, Math.PI / 2),
      '#9a6236',
    );
    const bw = half * 2 - 0.2,
      bh = bw / 4;
    const banner = new T.Mesh(
      new T.PlaneGeometry(bw, bh),
      new T.MeshStandardMaterial({
        map: bannerTexture(text, from, to),
        emissive: '#ffffff',
        emissiveIntensity: 0.0,
        roughness: 0.55,
        transparent: true,
        alphaTest: 0.4,
        side: T.DoubleSide,
      }),
    );
    (banner.material as T.MeshStandardMaterial).emissiveMap = (
      banner.material as T.MeshStandardMaterial
    ).map;
    (banner.material as T.MeshStandardMaterial).emissiveIntensity = 0.35;
    banner.position.set(p.x, 3.0, za + 0.05);
    banner.castShadow = true;
    gate.add(banner);
    // Bunting in racer colours.
    const s = new T.Vector3(p.x - half, 2.35, za),
      e = new T.Vector3(p.x + half, 2.35, za),
      curve = new T.QuadraticBezierCurve3(
        s,
        new T.Vector3(p.x, 1.95, za),
        e,
      );
    gw.add(new T.TubeGeometry(curve, 16, 0.02, 4), null, '#f4e4c2');
    const n = 11;
    for (let k = 1; k < n; k++) {
      const q = curve.getPoint(k / n),
        tri = new T.BufferGeometry();
      tri.setAttribute(
        'position',
        new T.BufferAttribute(
          new Float32Array([-0.14, 0, 0, 0.14, 0, 0, 0, -0.32, 0]),
          3,
        ),
      );
      tri.computeVertexNormals();
      gp.add(tri, at(q.x, q.y, q.z + 0.02), SKY_RACERS[k % 4]);
    }
    const gwm = gw.build(M.wood.clone()),
      gpm = gp.build(M.paint.clone());
    if (gwm) gate.add(gwm);
    if (gpm) gate.add(gpm);
    const mats: T.Material[] = [];
    gate.traverse((m) => {
      if (m instanceof T.Mesh) mats.push(m.material as T.Material);
    });
    gates.push({ group: gate, z: za, mats });
    // Glowing ring on the island floor.
    const ring = new T.Mesh(
      new T.RingGeometry(1.25, 1.5, 56).rotateX(-Math.PI / 2),
      new T.MeshBasicMaterial({
        color: '#ffe066',
        transparent: true,
        opacity: 0.7,
        blending: T.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    ring.position.set(p.x, 0.03, p.z + 0.35);
    root.add(ring);
    rings.push({ mesh: ring, i });
  }

  // ── Scenery islands, trees and windmills ──────────────────────────────
  // A few hero islands with clear silhouettes, kept well off the racing line
  // and stepping down into the haze, rather than a crowd at course height.
  const DECOR: [number, number, number, number][] = [
    [-13, -2.6, 2, 4.2],
    [14, -3.4, -12, 4.6],
    [-14.5, -1.2, -30, 5.2],
    [15.5, -2.2, -47, 5],
    [-15, -3, -64, 4.8],
    [14, -1.5, -80, 5.2],
    [-36, 1, -70, 10],
    [40, 3, -96, 12],
    [-40, -1, -118, 12],
    [30, -2, -135, 10],
    [-4, 2, -150, 14],
  ];
  const FAR = 6;
  const blades: T.Mesh[] = [];
  const bladeGeo = new Bucket();
  for (let k = 0; k < 4; k++)
    bladeGeo.add(
      new T.BoxGeometry(0.34, 2.1, 0.05),
      at(0, 0, 0, 0, 1, 1, 1, 0, (k * Math.PI) / 2).multiply(at(0, 1.1, 0)),
      (p, _n, c) => c.set(p.y > 1.7 || p.y < -1.7 || Math.abs(p.x) > 1.7 ? '#ff5a4a' : '#fff5e0'),
    );
  const bladeMesh = bladeGeo.build(M.paint);
  DECOR.forEach(([x, y, z, r], i) => {
    const far = i >= FAR,
      seed = 100 + i * 17;
    addIsland(stat, {
      x,
      y,
      z,
      w: r * 2,
      d: r * 1.7,
      seed,
      round: true,
      keepCentre: false,
      flowers: far ? 0 : Math.round(r * 2.5),
      fringe: far ? 0.7 : 0.32,
      depth: r * (far ? 1.6 : 1.3),
    });
    if (!far) ao(aoRound, x, y, z, r * 2, r * 1.7);
    const trees = far ? 3 : 1 + Math.floor(r / 1.6);
    for (let k = 0; k < trees; k++) {
      const a = hash(seed + k) * Math.PI * 2,
        d = (k === 0 ? 0.15 : 0.55) * r;
      const ts = (far ? 2.4 : 1.05) * (0.85 + hash(seed + k * 3) * 0.45),
        tx = x + Math.cos(a) * d,
        tz = z + Math.sin(a) * d * 0.8;
      addTree(stat, tx, y, tz, ts, seed + k);
      blob(tx, y, tz, 1.25 * ts);
    }
    if (!far)
      for (let k = 0; k < 2; k++) {
        const a = hash(seed + k * 9) * Math.PI * 2;
        addBush(stat, x + Math.cos(a) * r * 0.65, y, z + Math.sin(a) * r * 0.5, 1, seed + k);
        blob(x + Math.cos(a) * r * 0.65, y, z + Math.sin(a) * r * 0.5, 0.7);
      }
    if ((i === 2 || i === 5) && bladeMesh) {
      const wx = x + r * 0.35,
        wz = z - r * 0.2;
      stat.rock.add(
        new T.CylinderGeometry(0.38, 0.62, 3.4, 8),
        at(wx, y + 1.7, wz),
        (p, _n, c) => mixC('#e9d9bd', '#fff6e4', (p.y - y) / 3.4, c),
      );
      stat.paint.add(
        new T.ConeGeometry(0.62, 1.0, 8),
        at(wx, y + 3.9, wz),
        '#e8483a',
      );
      const bl = bladeMesh.clone();
      bl.position.set(wx, y + 3.3, wz + 0.6);
      root.add(bl);
      blades.push(bl);
    }
  });
  if (bladeMesh && !blades.length) bladeMesh.geometry.dispose();

  flush(stat, root);
  for (const [bk, round] of [[aoRect, false], [aoRound, true]] as const) {
    const m = bk.build(aoMat(round), false);
    if (m) {
      m.receiveShadow = false;
      m.renderOrder = 1;
      root.add(m);
    }
  }
  const blobMesh = blobs.build(blobMat, false);
  if (blobMesh) {
    blobMesh.receiveShadow = false;
    blobMesh.renderOrder = 1;
    root.add(blobMesh);
  }
  const woodMesh = wood.build(M.wood);
  if (woodMesh) root.add(woodMesh);

  // ── Cumulus clouds ────────────────────────────────────────────────────
  const puffs: number[][] = [];
  for (let i = 0; i < 18; i++) {
    const side = i % 2 ? 1 : -1;
    puffs.push([
      side * (6 + hash(i) * 12),
      -10.5 + hash(i + 50) * 2,
      18 - i * 4.6,
      2.4 + hash(i + 90) * 2,
    ]);
  }
  for (let i = 0; i < (low ? 8 : 16); i++) {
    const side = i % 2 ? 1 : -1;
    puffs.push([
      side * (19 + hash(i + 200) * 12),
      -8 + hash(i + 210) * 2.5,
      12 - i * 6.5,
      5 + hash(i + 220) * 3,
    ]);
  }
  for (let i = 0; i < (low ? 8 : 18); i++)
    puffs.push([
      (hash(i + 300) - 0.5) * 240,
      -11 + hash(i + 310) * 5,
      -95 - hash(i + 320) * 90,
      12 + hash(i + 330) * 14,
    ]);
  const clouds = new T.InstancedMesh(
    cloudPuff(),
    cloudMaterial(),
    puffs.length,
  );
  const cloudMat = clouds.material as T.ShaderMaterial;
  puffs.forEach(([x, y, z, s], i) =>
    clouds.setMatrixAt(i, at(x, y, z, hash(i + 7) * 6, s, s * 0.62, s * 0.8)),
  );
  clouds.frustumCulled = false;
  root.add(clouds);

  // ── Star trail marking each jump arc ──────────────────────────────────
  const starPos: T.Vector3[] = [];
  for (let i = 0; i < 15; i++) {
    const a = pads[i],
      b = pads[i + 1],
      bridged = (i === 1 || i === 8);
    for (const t of [0.32, 0.5, 0.68]) {
      starPos.push(
        new T.Vector3(
          a.x + (b.x - a.x) * t,
          bridged ? 0.6 : 0.75 + Math.sin(Math.PI * t) * 0.8,
          a.z + (b.z - a.z) * t,
        ),
      );
    }
  }
  const stars = new T.InstancedMesh(
    starGeometry(),
    new T.MeshStandardMaterial({
      color: '#ffd23a',
      emissive: '#ff9d00',
      emissiveIntensity: 0.55,
      metalness: 0.35,
      roughness: 0.3,
    }),
    starPos.length,
  );
  stars.castShadow = true;
  stars.frustumCulled = false;
  root.add(stars);
  const starHidden = new Float32Array(starPos.length).fill(-99);

  // ── Racer markers ─────────────────────────────────────────────────────
  const racers = o.names.map((_name, i) => {
    const color = SKY_RACERS[i % 4];
    const ring = new T.Mesh(
      new T.RingGeometry(0.42, 0.6, 40).rotateX(-Math.PI / 2),
      new T.MeshBasicMaterial({
        color,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    const disc = new T.Mesh(
      new T.CircleGeometry(0.42, 32).rotateX(-Math.PI / 2),
      new T.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    ring.renderOrder = disc.renderOrder = 2;
    // One small chevron in the racer's colour instead of stacked name tags.
    const chip = new T.Sprite(
      new T.SpriteMaterial({
        map: arrowTexture(color),
        depthTest: false,
        toneMapped: false,
      }),
    );
    chip.center.set(0.5, 0);
    chip.scale.set(0.3, 0.375, 1);
    chip.renderOrder = 30;
    const shade = new T.Mesh(
      new T.PlaneGeometry(1.5, 1.5).rotateX(-Math.PI / 2),
      blobMat.clone(),
    );
    (shade.material as T.MeshBasicMaterial).opacity = 0.6;
    root.add(ring, disc, chip, shade);
    return {
      ring,
      disc,
      chip,
      shade,
      air: false,
      cp: -1,
      color: new T.Color(color),
    };
  });
  // Bouncing 'you' arrow in the local racer's colour.
  const arrowMaps = o.names.map((_, i) => arrowTexture(SKY_RACERS[i % 4]));
  const arrow = new T.Sprite(
    new T.SpriteMaterial({ map: arrowMaps[0], depthTest: false, toneMapped: false }),
  );
  arrow.center.set(0.5, 0);
  arrow.scale.set(0.46, 0.58, 1);
  arrow.renderOrder = 31;
  root.add(arrow);

  const dust = new Particles(low ? 120 : 260, false, -0.8, 2.6);
  const sparks = new Particles(low ? 160 : 360, true, 3.2, 1.3);
  root.add(dust.points, sparks.points);
  const wind = new Wind(low ? 12 : 26);
  root.add(wind.lines);
  const birds = new Birds([
    { x: -6, y: 7, z: -14, r: 5, s: 0.35 },
    { x: -4, y: 7.6, z: -15, r: 5.5, s: 0.35 },
    { x: 8, y: 6.2, z: -30, r: 6, s: -0.3 },
    { x: 9, y: 6.8, z: -31, r: 5.2, s: -0.3 },
    { x: -3, y: 8, z: -46, r: 7, s: 0.28 },
  ]);
  root.add(birds.mesh);

  const camPos = new T.Vector3(),
    look = new T.Vector3(),
    want = new T.Vector3(),
    wantLook = new T.Vector3(),
    gold = new T.Color('#ffd84a'),
    dustColor = new T.Color('#f3e6c8'),
    dummy = new T.Object3D();
  let first = true,
    clock = 0,
    lastWall = 0;

  function burst(x: number, y: number, z: number, c: T.Color, n: number, power = 3) {
    for (let k = 0; k < n; k++) {
      const a = hash(clock * 13 + k) * Math.PI * 2,
        v = power * (0.5 + hash(clock * 7 + k * 3) * 0.7);
      sparks.spawn(
        x,
        y,
        z,
        Math.cos(a) * v,
        2 + hash(k + clock) * power * 1.2,
        Math.sin(a) * v,
        k % 3 ? c : gold,
        0.2 + hash(k * 5 + clock) * 0.18,
        0.7 + hash(k * 2 + clock) * 0.5,
      );
    }
  }
  function puff(x: number, y: number, z: number, n: number, spread: number) {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + clock;
      dust.spawn(
        x + Math.cos(a) * 0.2,
        y + 0.08,
        z + Math.sin(a) * 0.2,
        Math.cos(a) * spread,
        0.4 + hash(k + clock) * 0.5,
        Math.sin(a) * spread,
        dustColor,
        0.28 + hash(k * 3 + clock) * 0.16,
        0.4 + hash(k * 7 + clock) * 0.2,
      );
    }
  }

  function update(w: Arena, localId: string, dt: number, reduced: boolean) {
    const t = w.time;
    dt = Math.min(0.1, Math.max(0, dt));
    clock += dt;
    // Particles age on the wall clock so slow frames never pile them up.
    const wall = performance.now(),
      fxDt = lastWall ? Math.min(1, (wall - lastWall) / 1000) : dt;
    lastWall = wall;
    const meIndex = Math.max(
        0,
        w.actors.findIndex((a) => a.id === localId),
      ),
      me = w.actors[meIndex];
    // Chase camera: low 3/4 view behind the local racer.
    const gy = Math.max(-2, Math.min(me.y, 3));
    // Low and close behind the racer, so the current island and the next
    // jump target fill the frame.
    want.set(me.x * 0.8, 3.0 + gy * 0.45, me.z + 6.3);
    wantLook.set(me.x * 0.9, 0.55 + gy * 0.35, me.z - 9);
    const k = first ? 1 : 1 - Math.exp(-dt * 4.5);
    camPos.lerp(want, k);
    look.lerp(wantLook, k);
    camera.position.copy(camPos);
    camera.lookAt(look);
    sun.target.position.set(me.x * 0.5, 0, me.z - 12);
    sun.position.copy(sun.target.position).add(new T.Vector3(20, 28, -14));
    rim.target.position.copy(sun.target.position);
    rim.position.copy(sun.target.position).add(new T.Vector3(-10, 6, -8));

    const live = coursePlatforms(t);
    movers.forEach((m) => (m.group.position.x = live[m.i].x));
    domeMat.uniforms.time.value = t;
    sunGlow.position.copy(camera.position).addScaledVector(SKY.sunDir, 260);
    rays.position.copy(camera.position).addScaledVector(SKY.sunDir, 255);
    rays.material.rotation = reduced ? 0 : t * 0.025;
    cloudMat.uniforms.camPos.value.copy(camera.position);
    sea.mat.uniforms.time.value = reduced ? 0 : t;
    sea.mat.uniforms.camPos.value.copy(camera.position);
    sea.mesh.position.x = camera.position.x;
    sea.mesh.position.z = camera.position.z;

    for (const f of flags) {
      const pos = f.mesh.geometry.getAttribute('position') as T.BufferAttribute;
      for (let v = 0; v < pos.count; v++) {
        const bx = f.base[v * 3],
          by = f.base[v * 3 + 1],
          reach = Math.abs(bx) / 0.85;
        pos.setXYZ(
          v,
          bx,
          by - reach * 0.06,
          reduced ? 0 : Math.sin(Math.abs(bx) * 6 - t * 7 + f.phase) * 0.13 * reach,
        );
      }
      pos.needsUpdate = true;
      f.mesh.geometry.computeVertexNormals();
    }
    for (const r of rings) {
      const passed = me.checkpoint >= r.i;
      const mat = r.mesh.material as T.MeshBasicMaterial;
      mat.color.set(passed ? '#6dffb4' : '#ffe066');
      mat.opacity = 0.5 + 0.35 * Math.sin(t * 3.2 + r.i);
      r.mesh.scale.setScalar(1 + (reduced ? 0 : Math.sin(t * 3.2 + r.i) * 0.04));
    }
    // Gates the racer has run through fade so they never block the chase cam.
    for (const g of gates) {
      const d = g.z - me.z,
        alpha = 1 - T.MathUtils.smoothstep(d, 0.4, 2.6);
      g.group.visible = alpha > 0.02;
      for (const m of g.mats) {
        m.transparent = alpha < 0.99;
        m.opacity = alpha;
      }
    }
    blades.forEach((b, i) => (b.rotation.z = reduced ? 0.4 : t * (1.1 + i * 0.2)));
    if (!reduced) {
      birds.update(t);
      wind.update(t, camera.position);
    }
    wind.lines.visible = !reduced;

    // Stars: spin, and pop when a racer sweeps through them.
    starPos.forEach((s, i) => {
      if (t - starHidden[i] > 0 && t - starHidden[i] < 6) {
        dummy.scale.setScalar(0.0001);
      } else {
        for (const a of w.actors)
          if (
            a.alive &&
            Math.abs(a.x - s.x) < 0.75 &&
            Math.abs(a.z - s.z) < 0.75 &&
            Math.abs(a.y + 0.6 - s.y) < 0.95 &&
            !first
          ) {
            starHidden[i] = t;
            burst(s.x, s.y, s.z, gold, 5, 1.8);
            break;
          }
        const since = t - starHidden[i] - 6,
          pop = since > 0 && since < 0.4 ? 1 + Math.sin((since / 0.4) * Math.PI) * 0.4 : 1;
        dummy.scale.setScalar(starHidden[i] === t ? 0.0001 : pop);
      }
      dummy.position.set(s.x, s.y + (reduced ? 0 : Math.sin(t * 2.5 + i) * 0.06), s.z);
      dummy.rotation.set(0, reduced ? 0 : t * 2.6 + i * 0.4, 0);
      dummy.updateMatrix();
      stars.setMatrixAt(i, dummy.matrix);
    });
    stars.instanceMatrix.needsUpdate = true;

    // Racer rings, chips, bursts and dust.
    w.actors.forEach((a, i) => {
      const r = racers[i];
      if (!r) return;
      const supported =
        a.alive &&
        a.y > -0.4 &&
        (live.some(
          (p) => Math.abs(a.x - p.x) < p.w / 2 && Math.abs(a.z - p.z) < p.d / 2,
        ) ||
          onSkyBridge(a.x, a.z, t));
      const lift = Math.max(0, a.y);
      r.ring.visible = r.disc.visible = supported;
      r.ring.position.set(a.x, 0.035, a.z);
      r.disc.position.set(a.x, 0.03, a.z);
      const s = 1 / (1 + lift * 0.35);
      r.ring.scale.setScalar(s);
      r.disc.scale.setScalar(s);
      r.shade.visible = supported;
      r.shade.position.set(a.x, 0.02, a.z);
      r.shade.scale.setScalar(s);
      (r.ring.material as T.MeshBasicMaterial).opacity = 0.95 * s;
      r.chip.visible = a.alive && i !== meIndex;
      r.chip.position.set(
        a.x,
        a.y + 1.62 + (reduced ? 0 : Math.abs(Math.sin(t * 4.5 + i * 1.3)) * 0.1),
        a.z,
      );
      const air = a.y > 0.06;
      if (!first) {
        if (!r.air && air && a.vy > 0) puff(a.x, 0, a.z, 5, 1.2);
        if (r.air && !air && a.y > -0.25) puff(a.x, 0, a.z, 9, 2.0);
        if (r.cp >= 0 && a.checkpoint > r.cp)
          burst(a.x, a.y + 1, a.z, r.color, live[a.checkpoint]?.checkpoint ? 34 : 14, 3.2);
      }
      r.air = air;
      r.cp = a.checkpoint;
    });
    arrow.visible = me.alive;
    const map = arrowMaps[meIndex] ?? arrowMaps[0];
    if (arrow.material.map !== map) arrow.material.map = map;
    arrow.position.set(
      me.x,
      me.y + 1.75 + (reduced ? 0 : Math.abs(Math.sin(t * 4.5)) * 0.28),
      me.z,
    );
    dust.update(fxDt);
    sparks.update(fxDt);
    first = false;
  }
  return {
    software,
    update,
    resize(height: number) {
      const scale = height / (2 * Math.tan(T.MathUtils.degToRad(camera.fov / 2)));
      dust.mat.uniforms.scale.value = scale;
      sparks.mat.uniforms.scale.value = scale;
    },
  };
}
