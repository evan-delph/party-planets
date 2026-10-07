import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { animateAvatar, makeAvatar } from '../../avatar';
import type { Avatar } from '../../config';
import { performanceMeter } from '../../visuals';
import type { Arena } from '../simulation';
import {
  ISLAND_SHORE,
  buildBuoys,
  buildGulls,
  buildIsland,
  buildScenery,
  buildShip,
  buildStarBumper,
} from './sea-arena';
import { createSeaFx } from './sea-fx';
import { canvasTexture } from './sea-kit';
import { makeRiderHat, makeWaterWings } from './sea-riders';
import {
  SEA_LEVEL,
  SEA_PALETTE,
  createClouds,
  createOcean,
  createSky,
} from './sea-water';

/** Bold, high-chroma rider colours (same hue order as the arcade HUD). */
export const SEA_RIDER_COLORS = ['#ffc21a', '#ff3d7f', '#1fa2ff', '#8a4dff'];
const RIDER_DARK = ['#b06a00', '#a3104a', '#0b4f9e', '#4421a8'];
const OUTLINE = '#1b1d3a';
/** Riders are drawn larger than their collision size so faces read. */
const AV_SCALE = 1.55;
const TUB_SCALE = 1.3;
const SEAT = 0.05;

function youBadge(color: string) {
  const tex = canvasTexture(256, 160, (ctx) => {
    const r = 44;
    ctx.fillStyle = OUTLINE;
    ctx.beginPath();
    ctx.roundRect(18, 10, 220, 100, r);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(100, 104);
    ctx.lineTo(156, 104);
    ctx.lineTo(128, 150);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(28, 20, 200, 80, r - 10);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(110, 98);
    ctx.lineTo(146, 98);
    ctx.lineTo(128, 132);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.roundRect(40, 26, 176, 26, 13);
    ctx.fill();
    ctx.font = '900 62px Fredoka Variable, Fredoka, Trebuchet MS, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 12;
    ctx.strokeStyle = OUTLINE;
    ctx.strokeText('YOU', 128, 64);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('YOU', 128, 64);
  });
  const s = new T.Sprite(
    new T.SpriteMaterial({ map: tex, depthTest: false, transparent: true }),
  );
  s.scale.set(1.7, 1.06, 1);
  s.renderOrder = 60;
  return s;
}

/** Bumper tub: glossy inflatable skirt in the rider's colour with a white body. */
function makeTub(i: number) {
  const color = SEA_RIDER_COLORS[i % 4],
    dark = RIDER_DARK[i % 4];
  const tub = new T.Group();
  const skirtMat = new T.MeshStandardMaterial({
    color,
    roughness: 0.18,
    emissive: color,
    emissiveIntensity: 0,
  });
  const skirt = new T.Mesh(new T.TorusGeometry(0.66, 0.29, 18, 44), skirtMat);
  skirt.rotation.x = Math.PI / 2;
  skirt.position.y = 0.34;
  const outline = new T.MeshBasicMaterial({ color: OUTLINE, side: T.BackSide });
  const skirtLine = new T.Mesh(skirt.geometry, outline);
  skirtLine.scale.setScalar(1.06);
  skirt.add(skirtLine);
  const body = new T.Mesh(
    new T.CylinderGeometry(0.62, 0.5, 0.62, 28),
    new T.MeshStandardMaterial({ color: '#fff8ec', roughness: 0.3 }),
  );
  body.position.y = 0.52;
  const rim = new T.Mesh(
    new T.TorusGeometry(0.6, 0.085, 10, 32),
    new T.MeshStandardMaterial({ color: dark, roughness: 0.35 }),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.84;
  // Stripe dots around the skirt make the spin readable.
  const dotGeos = Array.from({ length: 8 }, (_, k) => {
    const a = (k / 8) * Math.PI * 2;
    return new T.SphereGeometry(0.085, 8, 6)
      .scale(1, 1.3, 1)
      .translate(Math.cos(a) * 0.94, 0.38, Math.sin(a) * 0.94);
  });
  const dotGroup = new T.Mesh(
    mergeGeometries(dotGeos)!,
    new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.25 }),
  );
  dotGeos.forEach((g) => g.dispose());
  // Twin headlights on the nose show which way the tub is heading.
  const lampGeo = new T.SphereGeometry(0.1, 10, 8);
  const lampMat = new T.MeshStandardMaterial({
    color: '#fffbe0',
    emissive: '#ffe58a',
    emissiveIntensity: 1.2,
  });
  const lamps = [-0.24, 0.24].map((x) => {
    const l = new T.Mesh(lampGeo, lampMat);
    l.position.set(x, 0.62, 0.55);
    return l;
  });
  tub.add(skirt, body, rim, dotGroup, ...lamps);
  tub.traverse((o) => {
    if (o instanceof T.Mesh && o.material !== outline) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return { tub, skirtMat, dotGroup };
}

/** Small gradient environment so glossy tubs and hats pick up sky and sea. */
function seaEnvironment(renderer: T.WebGLRenderer, sun: T.Vector3) {
  const env = new T.Scene();
  env.add(createSky(sun));
  const sea = new T.Mesh(
    new T.CircleGeometry(400, 24).rotateX(-Math.PI / 2),
    new T.MeshBasicMaterial({ color: SEA_PALETTE.mid }),
  );
  sea.position.y = -6;
  env.add(sea);
  const pmrem = new T.PMREMGenerator(renderer);
  const target = pmrem.fromScene(env, 0.02, 0.1, 1000, { size: 64 });
  pmrem.dispose();
  env.traverse((o) => {
    if (o instanceof T.Mesh) {
      o.geometry.dispose();
      (o.material as T.Material).dispose();
    }
  });
  return target;
}

/** Set both arms (rig order: left, right). raise lifts outward, swing tips back. */
function poseArms(
  avatar: T.Object3D,
  raise: [number, number],
  swing: [number, number],
) {
  const rig = avatar.userData.rig;
  if (!rig) return;
  rig.arms.forEach((arm: T.Object3D, i: number) => {
    arm.rotation.z = (i ? -1 : 1) * raise[i];
    arm.rotation.x = swing[i];
  });
}

export function createSeaBumperRenderer(
  root: HTMLDivElement,
  players: { id: string; avatar: Avatar }[],
  low = false,
  boardId = 'crown',
) {
  const renderer = new T.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1 : 1.6));
  renderer.setClearColor(SEA_PALETTE.horizon);
  renderer.shadowMap.enabled = !low;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.toneMapping = T.NeutralToneMapping;
  renderer.toneMappingExposure = 1.06;
  root.appendChild(renderer.domElement);
  // Gentle lens vignette focuses the eye on the island.
  const vignette = document.createElement('div');
  vignette.style.cssText =
    'position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 80% 72% at 50% 52%,rgba(0,0,0,0) 58%,rgba(3,18,60,0.3) 100%)';
  root.appendChild(vignette);
  const perf = performanceMeter(renderer, root, 'bumper');
  let lastPerf = performance.now();

  const scene = new T.Scene();
  void boardId;
  scene.fog = new T.Fog(SEA_PALETTE.horizon, 140, 560);
  const camera = new T.PerspectiveCamera(38, 1, 0.3, 1400);

  // Lighting: a warm, fairly low late-morning sun from the upper left so
  // long shadows rake across the turf, cool sky fill, and a strong cool rim
  // from behind that separates the riders from the green field.
  const sunDir = new T.Vector3(-0.74, 0.52, 0.3).normalize();
  const glintDir = new T.Vector3(-0.35, 0.22, -0.91).normalize();
  const envTarget = seaEnvironment(renderer, glintDir);
  scene.environment = envTarget.texture;
  scene.environmentIntensity = 0.5;
  scene.add(new T.HemisphereLight('#d4ebff', '#2c6a46', 1.0));
  const sun = new T.DirectionalLight('#ffdcaa', 4.3);
  sun.position.copy(sunDir).multiplyScalar(40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {
    left: -14,
    right: 14,
    top: 14,
    bottom: -14,
    near: 5,
    far: 90,
  });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 4;
  scene.add(sun);
  const rimLight = new T.DirectionalLight('#bfe2ff', 2.6);
  rimLight.position.set(10, 12, -22);
  scene.add(rimLight);

  // World.
  const ocean = createOcean(glintDir);
  scene.add(ocean.mesh, createSky(glintDir), createClouds(7, glintDir));
  const island = buildIsland();
  scene.add(island);
  const bumper = buildStarBumper();
  scene.add(bumper.group);
  const scenery = buildScenery(scene);
  ocean.setIsland(0, 0, 0, ISLAND_SHORE);
  scenery.islands
    .slice(0, 7)
    .forEach(([x, z, r], i) => ocean.setIsland(i + 1, x, z, r));
  const ship = buildShip();
  ship.position.set(-26, SEA_LEVEL + 0.1, -60);
  ship.rotation.y = -0.75;
  ship.scale.setScalar(1.7);
  scene.add(ship);
  const buoys = buildBuoys(scene);
  const gulls = buildGulls(scene);
  const fx = createSeaFx(scene);
  // Ambient water (shore breakers, swimmers' splashing) has its own pool so
  // it can be pre-warmed: the sea is already alive when the round opens.
  const ambient = createSeaFx(scene);
  // Soft contact shadows / occlusion: they keep everything grounded even when
  // the adaptive quality drops real shadow maps on slow machines.
  const blobTex = canvasTexture(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(5,30,25,0.85)');
    g.addColorStop(0.45, 'rgba(5,30,25,0.55)');
    g.addColorStop(1, 'rgba(10,30,20,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });
  const blobGeo = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const blob = (size: number) => {
    const m = new T.Mesh(
      blobGeo,
      new T.MeshBasicMaterial({
        map: blobTex,
        transparent: true,
        depthWrite: false,
        color: '#ffffff',
      }),
    );
    m.scale.set(size, 1, size);
    m.renderOrder = 4;
    scene.add(m);
    return m;
  };
  const shadowOffset = new T.Vector3(-sunDir.x, 0, -sunDir.z).multiplyScalar(0.3);

  // Riders.
  const riders = players.map((p, i) => {
    const color = SEA_RIDER_COLORS[i % 4];
    const group = new T.Group();
    scene.add(group);
    const body = new T.Group();
    group.add(body);
    const { tub, skirtMat, dotGroup } = makeTub(i);
    tub.scale.setScalar(TUB_SCALE);
    body.add(tub);
    const avatar = makeAvatar(p.avatar);
    avatar.scale.multiplyScalar(AV_SCALE);
    avatar.position.set(0, SEAT, 0.05);
    body.add(avatar);
    avatar.traverse((o) => {
      if (o instanceof T.Mesh) o.castShadow = true;
    });
    // The hat rides on an anchor that mirrors the avatar's transform, so it
    // survives the avatar swapping in its modeled body.
    const hatAnchor = new T.Group();
    body.add(hatAnchor);
    const hat = makeRiderHat(i, color);
    hatAnchor.add(hat.group);
    const wings = makeWaterWings(color);
    const ring = new T.Mesh(
      new T.RingGeometry(1.2, 1.44, 48),
      new T.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.renderOrder = 5;
    scene.add(ring);
    const shadow = blob(2.9);
    const you = youBadge(color);
    you.visible = false;
    scene.add(you);
    return {
      group,
      body,
      tub,
      avatar,
      hatAnchor,
      hat,
      wings,
      rig: undefined as unknown,
      skirtMat,
      dotGroup,
      ring,
      shadow,
      you,
      prevStun: 0,
      prevCooldown: 0,
      stretch: 0,
      squash: 0,
      hop: 0,
      hitSide: 1,
      spin: 0,
      splashed: false,
      seenAlive: false,
      dustAt: 0,
      paddleAt: i * 0.13,
      paddleSide: 1,
      outAngle: NaN,
    };
  });

  let width = 1,
    height = 1,
    distScale = 1;
  function resize() {
    width = root.clientWidth || 1;
    height = root.clientHeight || 1;
    renderer.setSize(width, height);
    const aspect = width / height;
    camera.aspect = aspect;
    // Narrow screens pull the camera back so the whole island stays in frame.
    distScale = T.MathUtils.clamp(1.6 / aspect, 1, 2.4);
    camera.updateProjectionMatrix();
    fx.setViewport(height * renderer.getPixelRatio(), camera.fov);
    ambient.setViewport(height * renderer.getPixelRatio(), camera.fov);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(root);
  resize();

  const camTarget = new T.Vector3();
  const camPos = new T.Vector3();
  const focus = new T.Vector3(),
    focusNow = new T.Vector3();
  let focusReady = false;
  const tmp = new T.Vector3();
  let shake = 0;
  let lastCrash = 0,
    lastBreaker = -1.25,
    breakerSide = 1;
  let clock = 0,
    aclock = 0,
    warmed = false;
  const rnd = () => Math.random();

  /** Waves slapping the rock on the left and right shores, where the
   * waterline is in view (the front is hidden under the rock's bulge). */
  function shoreWaves(s: number) {
    if (aclock - lastCrash > 0.7) {
      lastCrash = aclock;
      const a = (rnd() < 0.5 ? 0 : Math.PI) + (rnd() - 0.4) * Math.PI * 0.32;
      const nx = Math.cos(a),
        nz = Math.sin(a);
      ambient.crash(nx * ISLAND_SHORE * s, SEA_LEVEL + 0.1, nz * ISLAND_SHORE * s, nx, nz, 0.75 + rnd() * 0.4);
    }
    // Every couple of seconds a big breaker slams the left or right shore.
    if (aclock - lastBreaker > 2.2) {
      lastBreaker = aclock;
      breakerSide = -breakerSide;
      const a = Math.PI * (breakerSide > 0 ? 0.06 : 0.93);
      const nx = Math.cos(a),
        nz = Math.sin(a);
      ambient.crash(nx * ISLAND_SHORE * s, SEA_LEVEL + 0.1, nz * ISLAND_SHORE * s, nx, nz, 2.1);
    }
  }
  /** A swimmer's flailing kicks up little splashes on alternating sides. */
  function swimSplash(v: (typeof riders)[number]) {
    if (aclock - v.paddleAt < 0.32) return;
    v.paddleAt = aclock;
    v.paddleSide = -v.paddleSide;
    const yaw = v.group.rotation.y;
    const sx = v.paddleSide * 0.95 - 0.35;
    ambient.paddle(
      v.group.position.x + Math.cos(yaw) * sx,
      SEA_LEVEL + 0.05,
      v.group.position.z - Math.sin(yaw) * sx,
    );
  }

  function draw(w: Arena, localId: string, dt: number, reduced = false) {
    dt = Number.isFinite(dt) ? T.MathUtils.clamp(dt, 0, 0.1) : 0;
    clock += dt;
    const t = w.time;
    const s = Math.max(0.25, w.radius / 8);
    island.scale.set(s, 1, s);
    ocean.setIsland(0, 0, 0, ISLAND_SHORE * s);
    ocean.update(clock);
    bumper.update(clock, Math.min(1, w.pulse * 2));
    buoys.update(clock);
    gulls.update(clock);
    ship.position.y = SEA_LEVEL + 0.1 + Math.sin(clock * 0.9) * 0.18;
    ship.rotation.z = Math.sin(clock * 0.7) * 0.04;
    ship.rotation.x = Math.sin(clock * 0.55 + 1) * 0.025;

    aclock += dt;
    if (!reduced) shoreWaves(s);

    let maxScore = -Infinity;
    for (const a of w.actors) maxScore = Math.max(maxScore, a.score);
    riders.forEach((v, i) => {
      const p = w.actors[i];
      if (!p) return;
      // Water wings go onto the rig's arms whenever the avatar (re)builds.
      const rig = v.avatar.userData.rig;
      if (rig && rig !== v.rig) {
        v.rig = rig;
        rig.arms.forEach((arm: T.Object3D, k: number) => v.wings[k] && arm.add(v.wings[k]));
      }
      const speed = Math.hypot(p.vx, p.vz);
      let mood = !p.alive
        ? 'sad'
        : w.done
          ? p.score === maxScore
            ? 'happy'
            : 'sad'
          : p.stun > 0
            ? 'sad'
            : v.stretch > 0.2
              ? 'happy'
              : 'neutral';
      const toCamYaw = (x: number, z: number) =>
        Math.atan2(camera.position.x - x, camera.position.z - z);
      if (p.alive) {
        v.seenAlive = true;
        v.outAngle = NaN;
        v.splashed = false;
        tmp.set(p.x, 0, p.z);
        v.group.position.lerp(tmp, Math.min(1, dt * 22));
        if (t < 0.05) v.group.position.copy(tmp);
        v.group.rotation.set(0, p.face, 0);
        // Riders turn their heads toward the camera so faces stay readable;
        // the tub and its headlights still show the true heading.
        let turn = toCamYaw(p.x, p.z) - p.face;
        turn = Math.atan2(Math.sin(turn), Math.cos(turn));
        // Dash: stretch along travel; impact: squash, hop and spin.
        if (p.cooldown > v.prevCooldown + 1) {
          v.stretch = 1;
          for (let k = 0; k < 6; k++) fx.dust(p.x, 0, p.z, p.vx, p.vz);
        }
        if (p.stun > 0 && v.prevStun <= 0) {
          v.squash = 1;
          v.hop = 1;
          v.spin = 1;
          v.hitSide = rnd() < 0.5 ? -1 : 1;
          shake = Math.max(shake, 0.35);
          // Burst between this rider and the nearest other rider.
          let best: (typeof w.actors)[number] | undefined,
            bd = 9;
          for (const o of w.actors)
            if (o !== p && o.alive) {
              const d = Math.hypot(o.x - p.x, o.z - p.z);
              if (d < bd) {
                bd = d;
                best = o;
              }
            }
          if (best && w.actors.indexOf(best) > i)
            fx.impact((p.x + best.x) / 2, 0.6, (p.z + best.z) / 2, 0.9);
          else if (!best) fx.impact(p.x, 0.6, p.z, 0.8);
        }
        v.stretch = Math.max(0, v.stretch - dt * 2.4);
        v.squash = Math.max(0, v.squash - dt * 3.0);
        v.hop = Math.max(0, v.hop - dt * 1.7);
        v.spin = Math.max(0, v.spin - dt * 1.8);
        const wob = reduced ? 0 : Math.sin(clock * 30) * v.squash;
        const st = reduced ? 0 : v.stretch;
        const hop = reduced ? 0 : Math.sin(Math.PI * (1 - v.hop)) * (v.hop > 0 ? 1 : 0);
        v.body.scale.set(
          1 - st * 0.14 + wob * 0.2,
          1 - st * 0.1 - wob * 0.22 + hop * 0.08,
          1 + st * 0.3 + wob * 0.14,
        );
        // Lean into the drive, rock on bumps.
        v.body.rotation.x = reduced ? 0 : Math.min(0.26, speed * 0.03) + st * 0.18 + hop * 0.12;
        v.body.rotation.z = reduced ? 0 : hop * 0.45 * v.hitSide + Math.sin(clock * 5 + i) * 0.03;
        v.body.rotation.y = 0;
        v.body.position.y = reduced
          ? 0
          : hop * 0.75 + Math.abs(Math.sin(clock * 9 + i)) * Math.min(0.1, speed * 0.015);
        // The tub spins under a hit; the rider keeps facing the action.
        v.tub.position.set(0, 0, 0);
        v.tub.rotation.set(0, v.spin * v.spin * Math.PI * 2, 0);
        v.avatar.position.set(0, SEAT + hop * 0.2, 0.05);
        v.avatar.rotation.set(-0.06 + st * 0.1, turn * 0.85, 0);
        if (!reduced && speed > 6.5 && clock - v.dustAt > 0.12) {
          v.dustAt = clock;
          fx.dust(p.x, 0, p.z, p.vx, p.vz);
        }
        v.dotGroup.rotation.y += speed * dt * 0.8;
        v.skirtMat.emissiveIntensity = p.stun > 0 ? 0.5 : 0;
        v.ring.visible = true;
        v.ring.position.set(v.group.position.x, 0.025, v.group.position.z);
        v.ring.scale.setScalar(1 + Math.sin(clock * 4 + i) * 0.04);
        v.shadow.visible = true;
        const sh = 1 / (1 + hop * 0.6);
        v.shadow.scale.set(2.9 * sh, 1, 2.9 * sh);
        v.shadow.position.set(
          v.group.position.x + shadowOffset.x,
          0.03,
          v.group.position.z + shadowOffset.z,
        );
        animateAvatar(v.avatar, t, speed, mood, reduced);
        if (!reduced) {
          const f = Math.sin(clock * 26 + i);
          if (v.hop > 0.05)
            // Bounced: arms fly up, flailing.
            poseArms(v.avatar, [2.3 + f * 0.5, 2.3 - f * 0.5], [f * 0.6, -f * 0.6]);
          else if (st > 0.15)
            // Dashing: arms swept back like a sprinter.
            poseArms(v.avatar, [0.55, 0.55], [1.15, 1.15]);
          else if (Math.hypot(p.x, p.z) > w.radius - 1.3 && !w.done)
            // Teetering at the edge: arms windmill.
            poseArms(
              v.avatar,
              [1.6 + Math.sin(clock * 14 + i) * 0.9, 1.6 + Math.sin(clock * 14 + i + Math.PI) * 0.9],
              [Math.cos(clock * 14 + i) * 1.2, Math.cos(clock * 14 + i + Math.PI) * 1.2],
            );
          else if (w.done && mood === 'happy')
            poseArms(v.avatar, [2.5 + f * 0.15, 2.5 - f * 0.15], [0, 0]);
          else
            // Driving: hands forward on the rim, elbows out.
            poseArms(v.avatar, [0.5, 0.5], [-0.75 + Math.sin(clock * 3 + i) * 0.1, -0.75]);
        }
      } else {
        v.shadow.visible = false;
        v.ring.visible = false;
        v.skirtMat.emissiveIntensity = 0;
        mood = 'sad';
        // Knocked off: rider and tub are flung out over the edge and part ways
        // in the air, then the rider splashes down and flails in the sea
        // beside the capsized tub.
        const out = Math.max(0, t - p.outAt);
        const len = Math.hypot(p.x, p.z) || 1;
        const edge = Math.max(len, w.radius);
        const ex = (p.x / len) * edge,
          ez = (p.z / len) * edge;
        // The launch arcs outward and a little toward the camera so the
        // tumble plays out in view.
        let fdx = p.x / len,
          fdz = p.z / len + 0.45;
        const fl = Math.hypot(fdx, fdz) || 1;
        fdx /= fl;
        fdz /= fl;
        const REACH = 3.4;
        if (!Number.isFinite(v.outAngle))
          v.outAngle = Math.atan2(ez + fdz * REACH, ex + fdx * REACH);
        const FLY = 0.9;
        let x: number, y: number, z: number;
        if (out < FLY && v.seenAlive) {
          const k = out / FLY;
          x = ex + fdx * REACH * k;
          z = ez + fdz * REACH * k;
          y = 4.2 * Math.sin(k * Math.PI) + (SEA_LEVEL - 0.3) * k * k;
          v.group.position.set(x, y, z);
          v.group.rotation.set(0, Math.atan2(-fdx, -fdz), 0);
          v.body.scale.setScalar(1);
          v.body.position.set(0, 0, 0);
          v.body.rotation.set(0, 0, 0);
          // Rider pops out of the tub, somersaulting; the tub tumbles away.
          v.avatar.position.set(0, SEAT + Math.sin(k * Math.PI) * 1.8, -k * 0.8);
          v.avatar.rotation.set(-k * 4.2, Math.sin(k * 9) * 0.4, Math.sin(k * 13) * 0.5);
          v.tub.position.set(0, -k * 0.6, k * 0.9);
          v.tub.rotation.set(k * 3.3, 0, k * 1.2);
          animateAvatar(v.avatar, t, 0, mood, reduced);
          const f = Math.sin(clock * 30 + i);
          poseArms(v.avatar, [2.4 + f * 0.6, 2.2 - f * 0.6], [f, -f]);
        } else {
          if (!v.splashed) {
            v.splashed = true;
            // Riders already out when the view opened just float.
            if (v.seenAlive) {
              fx.splash(ex + fdx * REACH, SEA_LEVEL + 0.05, ez + fdz * REACH, 1.5);
              shake = Math.max(shake, 0.55);
            }
          }
          // Swimmers drift round to the left or right of the island on
          // screen, so the knockout stays in view and clear of the HUD.
          const right = Math.cos(v.outAngle) >= 0;
          // Right side works in (-π, π]; left side in (0, 2π) so it is continuous.
          let cur = Math.atan2(Math.sin(v.outAngle), Math.cos(v.outAngle));
          if (!right && cur < 0) cur += Math.PI * 2;
          const target = right
            ? T.MathUtils.clamp(cur, Math.PI * 0.04, Math.PI * 0.14)
            : T.MathUtils.clamp(cur, Math.PI * 0.86, Math.PI * 0.96);
          v.outAngle = cur + (target - cur) * Math.min(1, dt * 0.35);
          // Riders already out when the view opened start in view.
          if (!v.seenAlive) v.outAngle = target;
          const ring = ISLAND_SHORE * s + 2.3;
          x = Math.cos(v.outAngle) * ring;
          z = Math.sin(v.outAngle) * ring;
          y = SEA_LEVEL;
          v.group.position.set(x, y, z);
          v.group.rotation.set(0, toCamYaw(x, z), 0);
          v.body.scale.setScalar(1);
          v.body.position.set(0, 0, 0);
          v.body.rotation.set(
            Math.sin(clock * 1.7 + i) * 0.08,
            0,
            Math.cos(clock * 1.3 + i) * 0.08,
          );
          // Chest-deep, arms waving for rescue.
          const bob = Math.sin(clock * 2.4 + i) * 0.12;
          v.avatar.position.set(-0.35, -1.0 + bob, 0.1);
          v.avatar.rotation.set(0.12, -0.15, Math.sin(clock * 3 + i) * 0.1);
          // The tub floats upside down beside them.
          v.tub.position.set(0.9, 0.62 + bob * 0.6, -1.5);
          v.tub.rotation.set(Math.PI + Math.sin(clock * 1.9 + i) * 0.12, 0.6, Math.cos(clock * 1.5) * 0.1);
          animateAvatar(v.avatar, t, 0, mood, reduced);
          if (!reduced) {
            const f = Math.sin(clock * 9 + i * 2);
            poseArms(v.avatar, [2.5 + f * 0.45, 2.5 - f * 0.45], [f * 0.5, -f * 0.5]);
            swimSplash(v);
          }
        }
      }
      // Hats and propellers follow the head.
      v.hatAnchor.position.copy(v.avatar.position);
      v.hatAnchor.quaternion.copy(v.avatar.quaternion);
      v.hatAnchor.scale.copy(v.avatar.scale);
      if (v.hat.spin) v.hat.spin.rotation.y += dt * (6 + speed * 3);
      v.prevStun = p.stun;
      v.prevCooldown = p.cooldown;
      if (p.alive && w.done && mood === 'happy' && Math.random() < 0.2)
        fx.sparkle(v.group.position.x, 3.4, v.group.position.z, '#ffe14d');
      v.you.visible = p.id === localId && p.alive;
      v.you.position.set(
        v.group.position.x,
        v.body.position.y + 5.0 + Math.sin(clock * 3) * 0.12,
        v.group.position.z,
      );
    });
    fx.update(dt);
    // First frame: run the ambient water for a moment so breakers and
    // splashing are already in full swing.
    if (!warmed) {
      warmed = true;
      if (!reduced)
        for (let k = 0; k < 26; k++) {
          aclock += 0.05;
          shoreWaves(s);
          riders.forEach((v, i) => {
            if (w.actors[i] && !w.actors[i].alive && v.splashed) swimSplash(v);
          });
          ambient.update(0.05);
        }
    }
    ambient.update(dt);

    // Camera: a low, long-lens three-quarter view with the horizon high in
    // frame. It eases in as the island shrinks and shakes on big hits.
    // An action cam drifts toward the riders and pushes in when they bunch
    // up, but never far enough to lose sight of the island's edge.
    let cx = 0,
      cz = 0,
      n = 0,
      spread = 0;
    for (const a of w.actors)
      if (a.alive) {
        cx += a.x;
        cz += a.z;
        n++;
      }
    if (n) {
      cx /= n;
      cz /= n;
      for (const a of w.actors)
        if (a.alive) spread = Math.max(spread, Math.hypot(a.x - cx, a.z - cz));
    }
    const push = n > 1 ? T.MathUtils.clamp(1 - spread / 9, 0, 1) : 0.3;
    focus.set(
      T.MathUtils.clamp(cx * 0.4, -2.2, 2.2),
      push,
      T.MathUtils.clamp(cz * 0.3, -1.8, 1.8),
    );
    if (!focusReady) {
      focusNow.copy(focus);
      focusReady = true;
    } else focusNow.lerp(focus, Math.min(1, dt * 1.6));
    const zoom = (0.8 + 0.2 * s) * (1 - focusNow.y * 0.16);
    const d = distScale * zoom;
    // Horizon sits high in frame; the island fills the lower two thirds.
    camTarget.set(0.3 + focusNow.x, 3.0 * zoom, focusNow.z);
    camPos.set(0.8 + focusNow.x * 0.7 + Math.sin(clock * 0.13) * 0.6, 8.4 * d, 21.8 * d + focusNow.z);
    shake = Math.max(0, shake - dt * 1.8);
    if (!reduced && shake > 0) {
      camPos.x += (Math.random() - 0.5) * shake * 0.5;
      camPos.y += (Math.random() - 0.5) * shake * 0.4;
    }
    camera.position.copy(camPos);
    camera.lookAt(camTarget);

    const renderStart = performance.now();
    renderer.render(scene, camera);
    const pn = performance.now();
    perf.frame(pn, pn - lastPerf, pn - renderStart);
    lastPerf = pn;
  }

  const ray = new T.Raycaster(),
    plane = new T.Plane(new T.Vector3(0, 1, 0), 0);
  return {
    draw,
    groundPoint(clientX: number, clientY: number) {
      const rect = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(
        new T.Vector2(
          ((clientX - rect.left) / rect.width) * 2 - 1,
          (-(clientY - rect.top) / rect.height) * 2 + 1,
        ),
        camera,
      );
      return ray.ray.intersectPlane(plane, new T.Vector3());
    },
    dispose() {
      observer.disconnect();
      perf.dispose();
      scene.traverse((o) => {
        if (o instanceof T.Mesh || o instanceof T.Sprite || o instanceof T.Points) {
          if (!(o instanceof T.Sprite)) o.geometry.dispose();
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
            for (const v of Object.values(m))
              if (v instanceof T.Texture) v.dispose();
            if (m instanceof T.ShaderMaterial)
              for (const u of Object.values(m.uniforms))
                if (u.value instanceof T.Texture) u.value.dispose();
            m.dispose();
          }
        }
      });
      envTarget.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      vignette.remove();
    },
  };
}
