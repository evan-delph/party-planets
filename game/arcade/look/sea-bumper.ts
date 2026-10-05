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
  s.scale.set(1.9, 1.19, 1);
  s.renderOrder = 60;
  return s;
}

/** Bumper tub: glossy inflatable skirt in the rider's colour, ink outline, pennant. */
function makeTub(i: number) {
  const color = SEA_RIDER_COLORS[i % 4],
    dark = RIDER_DARK[i % 4];
  const tub = new T.Group();
  const skirtMat = new T.MeshStandardMaterial({
    color,
    roughness: 0.22,
    emissive: color,
    emissiveIntensity: 0,
  });
  const skirt = new T.Mesh(new T.TorusGeometry(0.66, 0.27, 16, 44), skirtMat);
  skirt.rotation.x = Math.PI / 2;
  skirt.position.y = 0.34;
  const outline = new T.MeshBasicMaterial({ color: OUTLINE, side: T.BackSide });
  const skirtLine = new T.Mesh(skirt.geometry, outline);
  skirtLine.scale.setScalar(1.07);
  skirt.add(skirtLine);
  const body = new T.Mesh(
    new T.CylinderGeometry(0.62, 0.5, 0.62, 28),
    new T.MeshStandardMaterial({ color: '#fff8ec', roughness: 0.35 }),
  );
  body.position.y = 0.52;
  const bodyLine = new T.Mesh(body.geometry, outline);
  bodyLine.scale.set(1.06, 1.02, 1.06);
  body.add(bodyLine);
  const rim = new T.Mesh(
    new T.TorusGeometry(0.6, 0.075, 8, 32),
    new T.MeshStandardMaterial({ color: dark, roughness: 0.4 }),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.84;
  // Stripe dots around the skirt make the spin readable.
  const dotGeos = Array.from({ length: 6 }, (_, k) => {
    const a = (k / 6) * Math.PI * 2;
    return new T.SphereGeometry(0.09, 8, 6)
      .scale(1, 1.4, 1)
      .translate(Math.cos(a) * 0.92, 0.36, Math.sin(a) * 0.92);
  });
  const dotGroup = new T.Mesh(
    mergeGeometries(dotGeos)!,
    new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 }),
  );
  dotGeos.forEach((g) => g.dispose());
  const pole = new T.Mesh(
    new T.CylinderGeometry(0.035, 0.035, 1.9, 6),
    new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 }),
  );
  pole.position.set(0, 1.45, -0.55);
  const flagShape = new T.Shape();
  flagShape.moveTo(0, 0);
  flagShape.lineTo(0.85, -0.22);
  flagShape.lineTo(0, -0.48);
  flagShape.closePath();
  const flag = new T.Mesh(
    new T.ShapeGeometry(flagShape),
    new T.MeshStandardMaterial({ color, roughness: 0.5, side: T.DoubleSide }),
  );
  flag.position.set(0, 2.38, -0.55);
  const ball = new T.Mesh(
    new T.SphereGeometry(0.09, 8, 6),
    new T.MeshStandardMaterial({ color: '#ffd23f', roughness: 0.3 }),
  );
  ball.position.set(0, 2.42, -0.55);
  tub.add(skirt, body, rim, dotGroup, pole, flag, ball);
  tub.traverse((o) => {
    if (o instanceof T.Mesh && o.material !== outline) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return { tub, skirtMat, flag, dotGroup };
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
  renderer.toneMappingExposure = 1.08;
  root.appendChild(renderer.domElement);
  // Gentle lens vignette focuses the eye on the island.
  const vignette = document.createElement('div');
  vignette.style.cssText =
    'position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 75% 70% at 50% 55%,rgba(0,0,0,0) 55%,rgba(4,22,70,0.32) 100%)';
  root.appendChild(vignette);
  const perf = performanceMeter(renderer, root, 'bumper');
  let lastPerf = performance.now();

  const scene = new T.Scene();
  // No PMREM environment here: hemisphere + key + rim lights give stronger
  // shape contrast and the scene starts much faster on weak GPUs.
  void boardId;
  scene.fog = new T.Fog(SEA_PALETTE.horizon, 120, 520);
  const camera = new T.PerspectiveCamera(46, 1, 0.3, 1400);

  // Lighting: warm key from the left so cast shadows fall across the turf
  // toward the right, cool sky fill, and a rim light from behind.
  const sunDir = new T.Vector3(-0.72, 0.66, 0.12).normalize();
  scene.add(new T.HemisphereLight('#cfeaff', '#2f6a4a', 1.4));
  const sun = new T.DirectionalLight('#ffe4b8', 4.1);
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
  sun.shadow.radius = 3;
  scene.add(sun);
  const rimLight = new T.DirectionalLight('#9fd6ff', 1.6);
  rimLight.position.set(6, 10, -24);
  scene.add(rimLight);

  // World.
  const glintDir = new T.Vector3(-0.35, 0.25, -0.9).normalize();
  const ocean = createOcean(glintDir);
  scene.add(ocean.mesh, createSky(glintDir), createClouds());
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
  ship.position.set(-30, SEA_LEVEL + 0.1, -64);
  ship.rotation.y = -0.75;
  ship.scale.setScalar(1.7);
  scene.add(ship);
  const buoys = buildBuoys(scene);
  const gulls = buildGulls(scene);
  const fx = createSeaFx(scene);
  // Soft contact shadows: they keep everything grounded even when the
  // adaptive quality drops real shadow maps on slow machines.
  const blobTex = canvasTexture(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(5,30,25,0.78)');
    g.addColorStop(0.5, 'rgba(5,30,25,0.5)');
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
  const shadowOffset = new T.Vector3(-sunDir.x, 0, -sunDir.z).multiplyScalar(0.35);
  
  // Riders.
  const riders = players.map((p, i) => {
    const group = new T.Group();
    scene.add(group);
    const body = new T.Group();
    group.add(body);
    const { tub, skirtMat, dotGroup } = makeTub(i);
    body.add(tub);
    const avatar = makeAvatar(p.avatar);
    avatar.scale.multiplyScalar(1.2);
    avatar.position.set(0, 0.3, 0.05);
    tub.scale.setScalar(1.12);
    body.add(avatar);
    avatar.traverse((o) => {
      if (o instanceof T.Mesh) o.castShadow = true;
    });
    const ring = new T.Mesh(
      new T.RingGeometry(1.02, 1.24, 40),
      new T.MeshBasicMaterial({
        color: SEA_RIDER_COLORS[i % 4],
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.renderOrder = 5;
    scene.add(ring);
    const shadow = blob(2.4);
    shadow.scale.x = 3.1; // stretched away from the low sun
    const you = youBadge(SEA_RIDER_COLORS[i % 4]);
    you.visible = false;
    scene.add(you);
    return {
      group,
      body,
      avatar,
      skirtMat,
      dotGroup,
      ring,
      shadow,
      you,
      prevStun: 0,
      prevCooldown: 0,
      stretch: 0,
      squash: 0,
      spin: 0,
      splashed: false,
      seenAlive: false,
      dustAt: 0,
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
    distScale = T.MathUtils.clamp(1.55 / aspect, 1, 2.4);
    camera.updateProjectionMatrix();
    fx.setViewport(height * renderer.getPixelRatio(), camera.fov);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(root);
  resize();

  const camTarget = new T.Vector3();
  const camPos = new T.Vector3();
  let camReady = false;
  let shake = 0;
  let lastCrash = 0,
    lastBreaker = -2.2,
    breakerSide = 1;
  let clock = 0;
  const crashRandom = () => Math.random();

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

    // Waves breaking on the island's rocks.
    if (!reduced && clock - lastCrash > 0.45) {
      lastCrash = clock;
      // Favour the camera-facing shore, where breaking waves are seen.
      const a = Math.PI * 0.5 + (crashRandom() - 0.5) * Math.PI * 1.6;
      const nx = Math.cos(a),
        nz = Math.sin(a);
      const big = crashRandom() < 0.25 ? 1.6 : 0.8;
      fx.crash(nx * ISLAND_SHORE * s, SEA_LEVEL + 0.1, nz * ISLAND_SHORE * s, nx, nz, big);
    }
    // Every few seconds a big breaker slams the front-left or front-right shore.
    if (!reduced && clock - lastBreaker > 2.2) {
      lastBreaker = clock;
      breakerSide = -breakerSide;
      const a = Math.PI * (breakerSide > 0 ? 0.22 : 0.8);
      const nx = Math.cos(a),
        nz = Math.sin(a);
      for (let k = -1; k <= 1; k++) {
        const b = a + k * 0.07;
        fx.crash(
          Math.cos(b) * ISLAND_SHORE * s,
          SEA_LEVEL + 0.1,
          Math.sin(b) * ISLAND_SHORE * s,
          nx,
          nz,
          2.1,
        );
      }
    }

    let maxScore = -Infinity;
    for (const a of w.actors) maxScore = Math.max(maxScore, a.score);
    riders.forEach((v, i) => {
      const p = w.actors[i];
      if (!p) return;
      const speed = Math.hypot(p.vx, p.vz);
      const mood = !p.alive
        ? 'sad'
        : w.done
          ? p.score === maxScore
            ? 'happy'
            : 'sad'
          : p.stun > 0
            ? 'sad'
            : 'neutral';
      if (p.alive) {
        v.seenAlive = true;
        const target = new T.Vector3(p.x, 0, p.z);
        v.group.position.lerp(target, Math.min(1, dt * 22));
        if (t < 0.05) v.group.position.copy(target);
        v.group.rotation.y = p.face;
        // Riders glance toward the camera so faces stay readable; the tub and
        // its pennant still show the true heading.
        const toCam = Math.atan2(camera.position.x - p.x, camera.position.z - p.z);
        let turn = toCam - p.face;
        turn = Math.atan2(Math.sin(turn), Math.cos(turn));
        v.avatar.rotation.y = turn * 0.4;
        v.group.rotation.z = 0;
        v.group.rotation.x = 0;
        // Dash: stretch along travel; impact: squash and spin.
        if (p.cooldown > v.prevCooldown + 1) {
          v.stretch = 1;
          for (let k = 0; k < 6; k++) fx.dust(p.x, 0, p.z, p.vx, p.vz);
        }
        if (p.stun > 0 && v.prevStun <= 0) {
          v.squash = 1;
          v.spin = 1;
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
            fx.impact((p.x + best.x) / 2, 0.4, (p.z + best.z) / 2, 1.1);
          else if (!best) fx.impact(p.x, 0.4, p.z, 0.8);
        }
        v.stretch = Math.max(0, v.stretch - dt * 2.6);
        v.squash = Math.max(0, v.squash - dt * 3.2);
        v.spin = Math.max(0, v.spin - dt * 1.8);
        const wob = Math.sin(clock * 30) * v.squash;
        const st = reduced ? 0 : v.stretch;
        v.body.scale.set(
          1 - st * 0.16 + wob * 0.18,
          1 - st * 0.12 - wob * 0.2,
          1 + st * 0.32 + wob * 0.12,
        );
        v.body.rotation.x = reduced ? 0 : Math.min(0.22, speed * 0.025) + st * 0.15;
        v.body.rotation.y = v.spin * v.spin * Math.PI * 2;
        v.body.position.y = reduced ? 0 : Math.abs(Math.sin(clock * 9 + i)) * Math.min(0.08, speed * 0.012);
        if (!reduced && speed > 6.5 && clock - v.dustAt > 0.12) {
          v.dustAt = clock;
          fx.dust(p.x, 0, p.z, p.vx, p.vz);
        }
        v.dotGroup.rotation.y += speed * dt * 0.8;
        v.skirtMat.emissiveIntensity = p.stun > 0 ? 0.6 : 0;
        v.ring.visible = true;
        v.ring.position.set(v.group.position.x, 0.025, v.group.position.z);
        v.ring.scale.setScalar(1 + Math.sin(clock * 4 + i) * 0.04);
        v.shadow.visible = true;
        v.shadow.position.set(
          v.group.position.x + shadowOffset.x,
          0.03,
          v.group.position.z + shadowOffset.z,
        );
      } else {
        v.shadow.visible = false;
        // Knocked off: arc out over the edge, splash down, then bob in the sea.
        const out = Math.max(0, t - p.outAt);
        const len = Math.hypot(p.x, p.z) || 1;
        const nx = p.x / len,
          nz = p.z / len;
        const edge = Math.max(len, w.radius);
        let x: number, y: number, z: number;
        const fall = 0.62;
        if (out < fall) {
          const k = out / fall;
          x = nx * (edge + k * 2.4);
          z = nz * (edge + k * 2.4);
          y = 1.6 * Math.sin(k * Math.PI * 0.7) + (SEA_LEVEL - 0.6) * k * k;
          v.body.rotation.x = k * 2.2;
          v.splashed = !v.seenAlive || v.splashed;
        } else {
          const drift = Math.min(3.6, 2.4 + (out - fall) * 0.25);
          x = nx * (edge + drift);
          z = nz * (edge + drift);
          y = SEA_LEVEL - 0.25 + Math.sin(clock * 2.2 + i) * 0.1;
          v.body.rotation.x = Math.sin(clock * 1.7 + i) * 0.12;
          v.body.rotation.z = Math.cos(clock * 1.3 + i) * 0.1;
          if (!v.splashed) {
            v.splashed = true;
            // Riders already out when the view opened just float.
            if (v.seenAlive) {
              fx.splash(x, SEA_LEVEL + 0.05, z, 1.3);
              shake = Math.max(shake, 0.5);
            }
          }
        }
        v.group.position.set(x, y, z);
        v.group.rotation.y = Math.atan2(-nx, -nz);
        v.body.scale.setScalar(1);
        v.body.position.y = 0;
        v.ring.visible = false;
        v.skirtMat.emissiveIntensity = 0;
      }
      v.prevStun = p.stun;
      v.prevCooldown = p.cooldown;
      animateAvatar(v.avatar, t, p.alive ? speed : 0, mood, reduced);
      if (p.alive && w.done && mood === 'happy' && Math.random() < 0.2)
        fx.sparkle(v.group.position.x, 2.6, v.group.position.z, '#ffe14d');
      v.you.visible = p.id === localId && p.alive;
      v.you.position.set(
        v.group.position.x,
        3.75 + Math.sin(clock * 3) * 0.12,
        v.group.position.z,
      );
    });
    fx.update(dt);

    // Camera: a low, dramatic three-quarter view showing the horizon. It eases
    // in as the island shrinks and shakes on big hits.
    const zoom = 0.78 + 0.22 * s;
    const d = distScale * zoom;
    camTarget.set(0, 0.6 * d, -6 * d);
    camPos.set(Math.sin(clock * 0.13) * 0.8, 9.4 * d, 21 * d);
    if (!camReady) camReady = true;
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
      scene.environment?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      vignette.remove();
    },
  };
}
