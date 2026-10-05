import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  SeaBatch,
  canvasTexture,
  lumpy,
  seaMaterials,
  seaPalm,
  seaRandom,
  seaRock,
} from './sea-kit';
import { SEA_LEVEL } from './sea-water';

/** Radius of the rocky base where it meets the water, at full arena size. */
export const ISLAND_SHORE = 7.95;

function grassTexture() {
  return canvasTexture(1024, 1024, (ctx) => {
    const c = 512;
    // Mown rings: alternating bands that read like a sports field.
    for (let i = 14; i >= 0; i--) {
      const r = (i / 14) * 512;
      ctx.beginPath();
      ctx.arc(c, c, r, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 ? '#35b553' : '#2aa148';
      ctx.fill();
    }
    // Large soft patches so the lawn is not a flat colour.
    const pr = seaRandom(9);
    for (let i = 0; i < 46; i++) {
      const x = pr() * 1024,
        y = pr() * 1024,
        rad = 40 + pr() * 110;
      const pg = ctx.createRadialGradient(x, y, 0, x, y, rad);
      const col = pr() > 0.5 ? '120,220,90' : '10,90,50';
      pg.addColorStop(0, `rgba(${col},0.22)`);
      pg.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = pg;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    // Soft radial light falloff toward the rim.
    const g = ctx.createRadialGradient(c, c, 60, c, c, 512);
    g.addColorStop(0, 'rgba(255,255,190,0.18)');
    g.addColorStop(0.75, 'rgba(255,255,190,0)');
    g.addColorStop(1, 'rgba(10,60,10,0.28)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 1024);
    // Grass speckle and little flowers.
    const r = seaRandom(31);
    for (let i = 0; i < 9000; i++) {
      const a = r() * Math.PI * 2,
        d = Math.sqrt(r()) * 500;
      ctx.fillStyle = r() > 0.5 ? 'rgba(8,80,40,0.4)' : 'rgba(170,250,150,0.3)';
      ctx.fillRect(c + Math.cos(a) * d, c + Math.sin(a) * d, 2, 6);
    }
    for (let i = 0; i < 160; i++) {
      const a = r() * Math.PI * 2,
        d = 120 + Math.sqrt(r()) * 340;
      ctx.fillStyle = ['#ffffff', '#ffe066', '#ff8fc0'][i % 3];
      ctx.beginPath();
      ctx.arc(c + Math.cos(a) * d, c + Math.sin(a) * d, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Painted field lines: a centre circle and a warning ring near the edge.
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(c, c, 150, 0, Math.PI * 2);
    ctx.stroke();
    // Hazard band: chunky wedges in sunny yellow and deep navy.
    const inner = 452,
      outer = 506;
    for (let i = 0; i < 64; i++) {
      const a0 = (i / 64) * Math.PI * 2,
        a1 = ((i + 1) / 64) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(c, c, outer, a0, a1);
      ctx.arc(c, c, inner, a1 - 0.05, a0 - 0.05, true);
      ctx.closePath();
      ctx.fillStyle = i % 2 ? '#ffd23f' : '#253070';
      ctx.fill();
    }
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(c, c, inner - 4, 0, Math.PI * 2);
    ctx.stroke();
    // Baked light: the star bumper's cast shadow (sun from the left, so it
    // falls toward +x) and soft occlusion around its base. On the cap,
    // canvas x follows world z and canvas y follows -world x.
    const at = (x: number, z: number) =>
      [(z / 16 + 0.5) * 1024, (0.5 - x / 16) * 1024] as const;
    const [sx, sy] = at(1.9, -0.25);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(1, 1.7);
    const sg = ctx.createRadialGradient(0, 0, 10, 0, 0, 120);
    sg.addColorStop(0, 'rgba(0,40,30,0.5)');
    sg.addColorStop(0.6, 'rgba(0,40,30,0.32)');
    sg.addColorStop(1, 'rgba(0,40,30,0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(0, 0, 120, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    const ao = ctx.createRadialGradient(c, c, 90, c, c, 150);
    ao.addColorStop(0, 'rgba(0,40,30,0.45)');
    ao.addColorStop(1, 'rgba(0,40,30,0)');
    ctx.fillStyle = ao;
    ctx.beginPath();
    ctx.arc(c, c, 150, 0, Math.PI * 2);
    ctx.fill();
    // Inner shade just inside the hazard band so the rim reads as raised.
    const rim = ctx.createRadialGradient(c, c, inner - 40, c, c, inner - 6);
    rim.addColorStop(0, 'rgba(0,40,30,0)');
    rim.addColorStop(1, 'rgba(0,40,30,0.25)');
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.arc(c, c, inner - 6, 0, Math.PI * 2);
    ctx.fill();
  });
}

function turfSideTexture() {
  const t = canvasTexture(512, 128, (ctx) => {
    ctx.fillStyle = '#9b5f34';
    ctx.fillRect(0, 0, 512, 128);
    const r = seaRandom(5);
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = r() > 0.5 ? '#7c4826' : '#b77a45';
      ctx.beginPath();
      ctx.ellipse(r() * 512, 50 + r() * 78, 8 + r() * 14, 5 + r() * 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Grass overhang with scalloped drips.
    ctx.fillStyle = '#4fbf31';
    ctx.fillRect(0, 0, 512, 34);
    for (let x = 0; x < 512; x += 32) {
      ctx.beginPath();
      ctx.ellipse(x + 16, 34, 16, 14 + ((x / 32) % 3) * 6, 0, 0, Math.PI);
      ctx.fill();
    }
    ctx.fillStyle = '#7fe05a';
    ctx.fillRect(0, 0, 512, 7);
  });
  t.wrapS = T.RepeatWrapping;
  t.repeat.set(10, 1);
  return t;
}

/** The floating island arena: turf top, striped lip, rocky underside. */
export function buildIsland() {
  const group = new T.Group();
  group.name = 'Bumper island';
  const top = new T.Mesh(new T.CylinderGeometry(8, 8, 0.5, 96, 1), [
    new T.MeshStandardMaterial({ map: turfSideTexture(), roughness: 0.85 }),
    new T.MeshStandardMaterial({ map: grassTexture(), roughness: 0.82 }),
    new T.MeshStandardMaterial({ color: '#6d4a2f' }),
  ]);
  top.position.y = -0.25;
  top.receiveShadow = true;
  top.castShadow = true;
  group.add(top);
  const lip = new T.Mesh(
    new T.TorusGeometry(8, 0.2, 10, 160),
    new T.MeshStandardMaterial({
      color: '#fff6e6',
      roughness: 0.25,
    }),
  );
  lip.rotation.x = Math.PI / 2;
  lip.position.y = 0.0;
  lip.castShadow = true;
  lip.receiveShadow = true;
  group.add(lip);
  // Rocky underside: a lathe profile, lumped and flat shaded.
  // Listed bottom to top so the lathe faces outward.
  const profile = [
    [0.3, -8.2],
    [2.4, -7.2],
    [4.6, -6.0],
    [6.3, -4.7],
    [7.3, -3.6],
    [7.8, -2.7],
    [8.2, -1.9],
    [8.45, -1.2],
    [8.35, -0.7],
    [7.95, -0.42],
  ].map(([r, y]) => new T.Vector2(r, y));
  const rock = new T.LatheGeometry(profile, 44);
  const pos = rock.attributes.position as T.BufferAttribute;
  const v = new T.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    if (v.y > -0.5) continue;
    const a = Math.atan2(v.z, v.x);
    // Big boulder lobes plus finer chips; stays seamless around the circle.
    const n =
      Math.sin(a * 5 + v.y * 0.9) * 0.5 +
      Math.sin(a * 11 - v.y * 1.7) * 0.3 +
      Math.sin(a * 23 + v.y * 3.1) * 0.2;
    const k = 1 + n * 0.075;
    v.x *= k;
    v.z *= k;
    v.y += Math.sin(a * 13 + v.y) * 0.18;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  const rockGeo = rock;
  const cols = new Float32Array(rockGeo.attributes.position.count * 3);
  const rp = rockGeo.attributes.position as T.BufferAttribute;
  const c = new T.Color();
  const rr = seaRandom(19);
  const deep = new T.Color('#4a3934'),
    warm = new T.Color('#d4a273'),
    moss = new T.Color('#3a9a43'),
    band = new T.Color('#9a6748');
  // Per-vertex colour: height gradient, strata bands, mottling and a mossy
  // fringe under the turf.
  for (let i = 0; i < rp.count; i++) {
    const y = rp.getY(i);
    const t = T.MathUtils.clamp((y + 5.2) / 4.6, 0, 1);
    c.copy(deep).lerp(warm, t * t * (3 - 2 * t));
    if (Math.sin(y * 4.2 + rp.getX(i) * 0.3) > 0.6) c.lerp(band, 0.4);
    c.multiplyScalar(0.86 + rr() * 0.2);
    if (y > -0.8) c.lerp(moss, 0.85);
    cols.set([c.r, c.g, c.b], i * 3);
  }
  rockGeo.setAttribute('color', new T.BufferAttribute(cols, 3));
  rockGeo.computeVertexNormals();
  const underside = new T.Mesh(
    rockGeo,
    new T.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.92,
    }),
  );
  underside.castShadow = true;
  underside.receiveShadow = true;
  group.add(underside);
  return group;
}

/** Centre obstacle: a chunky pinball-style star bumper with chase lights. */
export function buildStarBumper() {
  const group = new T.Group();
  group.name = 'Star bumper';
  const add = (g: T.BufferGeometry, m: T.Material, y: number) => {
    const mesh = new T.Mesh(g, m);
    mesh.position.y = y;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  add(
    new T.CylinderGeometry(1.42, 1.55, 0.36, 40),
    new T.MeshStandardMaterial({ color: '#222c6e', roughness: 0.45 }),
    0.18,
  );
  const skirt = add(
    new T.TorusGeometry(1.12, 0.32, 18, 48),
    new T.MeshStandardMaterial({
      color: '#ff2f7d',
      roughness: 0.22,
    }),
    0.62,
  );
  skirt.rotation.x = Math.PI / 2;
  add(
    new T.CylinderGeometry(1.0, 1.08, 0.55, 40),
    new T.MeshStandardMaterial({ color: '#fff7ea', roughness: 0.3 }),
    0.95,
  );
  const cap = add(
    new T.CylinderGeometry(0.82, 0.98, 0.16, 40),
    new T.MeshStandardMaterial({
      color: '#ffce2e',
      roughness: 0.3,
      emissive: '#ff9d00',
      emissiveIntensity: 0.25,
    }),
    1.3,
  );
  cap.receiveShadow = true;
  // Chase-light bulbs around the base, in two alternating sets.
  const bulbs: T.Mesh[] = [];
  for (let set = 0; set < 2; set++) {
    const geos: T.BufferGeometry[] = [];
    for (let i = set; i < 16; i += 2) {
      const a = (i / 16) * Math.PI * 2;
      geos.push(
        new T.SphereGeometry(0.11, 10, 8).translate(
          Math.cos(a) * 1.48,
          0.3,
          Math.sin(a) * 1.48,
        ),
      );
    }
    const merged = mergeGeometries(geos)!;
    geos.forEach((g) => g.dispose());
    const mesh = new T.Mesh(
      merged,
      new T.MeshStandardMaterial({
        color: '#fff6c8',
        emissive: set ? '#ffd23f' : '#ff7ab0',
        emissiveIntensity: 1.6,
        roughness: 0.3,
      }),
    );
    group.add(mesh);
    bulbs.push(mesh);
  }
  // A big spinning star on top.
  const shape = new T.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2,
      r = i % 2 ? 0.34 : 0.78;
    const x = Math.cos(a) * r,
      y = Math.sin(a) * r;
    if (i) shape.lineTo(x, y);
    else shape.moveTo(x, y);
  }
  shape.closePath();
  const starGeo = new T.ExtrudeGeometry(shape, {
    depth: 0.22,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.07,
    bevelSegments: 3,
  });
  starGeo.center();
  const star = new T.Mesh(
    starGeo,
    new T.MeshStandardMaterial({
      color: '#ffd83a',
      emissive: '#ffae00',
      emissiveIntensity: 0.45,
      roughness: 0.25,
      metalness: 0.1,
    }),
  );
  star.position.y = 2.15;
  star.castShadow = true;
  group.add(star);
  const outline = new T.Mesh(
    starGeo,
    new T.MeshBasicMaterial({ color: '#7a3b00', side: T.BackSide }),
  );
  outline.scale.setScalar(1.08);
  star.add(outline);
  return {
    group,
    update(t: number, hit: number) {
      // Sway rather than spin so the star always reads face-on.
      star.rotation.y = Math.sin(t * 1.4) * 0.55;
      star.rotation.z = Math.sin(t * 2.1) * 0.12;
      star.position.y = 2.15 + Math.sin(t * 2.4) * 0.1;
      const s = 1 + hit * 0.18;
      skirt.scale.set(s, s, 1 + hit * 0.4);
      const on = Math.floor(t * 4) % 2;
      (bulbs[0].material as T.MeshStandardMaterial).emissiveIntensity = on ? 0.3 : 1.8;
      (bulbs[1].material as T.MeshStandardMaterial).emissiveIntensity = on ? 1.8 : 0.3;
    },
  };
}

/** Background islands, lighthouse, distant hills: static, batched. */
export function buildScenery(parent: T.Object3D) {
  const mats = seaMaterials();
  const b = new SeaBatch(mats);
  const r = seaRandom(77);
  const islands: [number, number, number][] = [];
  const sandIsland = (x: number, z: number, s: number, palms: number) => {
    const g = new T.SphereGeometry(1, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    b.put('matte', g, '#ffe2a3', x, SEA_LEVEL - 0.45 * s, z, 0, 0, 0, s * 2.2, s * 0.9, s * 2.2);
    g.dispose();
    const grass = new T.SphereGeometry(1, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    b.put('matte', grass, '#56c23a', x - s * 0.2, SEA_LEVEL - 0.1 * s, z - s * 0.2, 0, 0, 0, s * 1.5, s * 0.62, s * 1.4);
    grass.dispose();
    islands.push([x, z, s * 2.2]);
    for (let i = 0; i < palms; i++)
      seaPalm(
        b,
        x + (i - (palms - 1) / 2) * s * 1.1,
        SEA_LEVEL + s * 0.35,
        z - s * 0.3 + (i % 2) * s * 0.5,
        s * 0.62,
        0.5,
        (i % 2 ? -0.8 : 0.9) + r() * 0.4,
      );
    for (let i = 0; i < 3; i++)
      seaRock(
        b,
        x + (r() - 0.5) * s * 3.4,
        SEA_LEVEL + 0.05,
        z + s * 1.4 + r() * s * 0.6,
        s * (0.25 + r() * 0.25),
        '#b8a08a',
        i + x,
      );
  };
  sandIsland(-25, -24, 2.1, 2);
  sandIsland(27, -32, 2.4, 3);
  sandIsland(-12, -46, 1.4, 1);
  // Lighthouse on a rock stack.
  const lx = 38,
    lz = -66;
  const stack = lumpy(new T.CylinderGeometry(3.4, 4.6, 4, 9, 3), 0.12, 3);
  b.put('rock', stack, '#9a8a7c', lx, SEA_LEVEL + 0.9, lz);
  stack.dispose();
  islands.push([lx, lz, 4.4]);
  for (let i = 0; i < 6; i++) {
    const seg = new T.CylinderGeometry(1.35 - i * 0.12, 1.47 - i * 0.12, 1.4, 20);
    b.put('gloss', seg, i % 2 ? '#ffffff' : '#ff3b5c', lx, SEA_LEVEL + 3.6 + i * 1.4, lz);
    seg.dispose();
  }
  const balcony = new T.CylinderGeometry(1.25, 1.25, 0.2, 20);
  b.put('matte', balcony, '#263170', lx, SEA_LEVEL + 11.9, lz);
  const lamp = new T.CylinderGeometry(0.7, 0.7, 1.1, 14);
  b.put('glow', lamp, '#fff1a8', lx, SEA_LEVEL + 12.55, lz);
  const roof = new T.ConeGeometry(1.0, 1.3, 14);
  b.put('gloss', roof, '#ff3b5c', lx, SEA_LEVEL + 13.75, lz);
  balcony.dispose();
  lamp.dispose();
  roof.dispose();
  // Distant hilly islands on the horizon.
  const hill = new T.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  const hills: [number, number, number, number, string][] = [
    [-120, -230, 40, 22, '#4e9e78'],
    [-80, -250, 26, 14, '#5aa982'],
    [140, -260, 46, 18, '#4e9e78'],
    [95, -240, 22, 10, '#62b18a'],
    [-190, -150, 36, 16, '#5aa982'],
  ];
  for (const [x, z, w, h, col] of hills)
    b.put('matte', hill, col, x, SEA_LEVEL - 1, z, 0, 0, 0, w, h, w * 0.6);
  hill.dispose();
  // Rocks poking out of the water near the arena.
  const rocks: [number, number, number][] = [
    [-11.5, 4, 0.9],
    [12.5, 2, 1.1],
    [-10.2, -6.5, 0.7],
    [10.8, -8.5, 0.8],
  ];
  for (const [x, z, s] of rocks) {
    seaRock(b, x, SEA_LEVEL + 0.2, z, s, '#a58f7c', x * z);
    islands.push([x, z, s * 1.1]);
  }
  // Scenery sits in open water outside the sun's shadow frustum.
  const meshes = b.build(parent, false);
  return { islands, meshes };
}

/** A cheerful two-masted party ship with our green alien emblem on the sails. */
export function buildShip() {
  const ship = new T.Group();
  ship.name = 'Party ship';
  const mats = seaMaterials();
  const b = new SeaBatch(mats);
  // Hull: a lower half-ellipsoid with a tall stern castle.
  const hull = new T.SphereGeometry(1, 28, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const hp = hull.attributes.position as T.BufferAttribute;
  for (let i = 0; i < hp.count; i++) {
    const z = hp.getZ(i);
    if (z > 0) hp.setX(i, hp.getX(i) * (1 - z * 0.35));
  }
  hull.computeVertexNormals();
  b.put('gloss', hull, '#8f4b2b', 0, 0.9, 0, 0, 0, 0, 2.3, 1.7, 7.2);
  const stripe = new T.CylinderGeometry(1, 1, 0.32, 28, 1, true);
  b.put('gloss', stripe, '#23c4b4', 0, 0.62, 0, 0, 0, 0, 2.18, 1, 7.05);
  b.put('gloss', stripe, '#ffd23f', 0, 0.98, 0, 0, 0, 0, 2.3, 0.5, 7.2);
  const deck = new T.CylinderGeometry(1, 1, 0.15, 28);
  b.put('matte', deck, '#d9a46a', 0, 1.0, 0, 0, 0, 0, 2.15, 1, 6.9);
  const box = new T.BoxGeometry(1, 1, 1);
  b.put('gloss', box, '#8f4b2b', 0, 1.9, -4.6, 0, 0, 0, 3.6, 1.8, 2.6);
  b.put('gloss', box, '#ffd23f', 0, 2.85, -4.6, 0, 0, 0, 3.8, 0.18, 2.8);
  for (let i = 0; i < 3; i++)
    b.put('glow', box, '#fff3b0', 1.82, 1.9, -5.4 + i * 0.75, 0, 0, 0, 0.05, 0.45, 0.4);
  const mast = new T.CylinderGeometry(0.13, 0.17, 1, 10);
  for (const [z, h] of [
    [1.6, 9],
    [-1.8, 7.6],
  ] as const) {
    b.put('matte', mast, '#6b4024', 0, 1 + h / 2, z, 0, 0, 0, 1, h, 1);
    b.put('matte', mast, '#6b4024', 0, 1 + h * 0.86, z, 0, 0, Math.PI / 2, 0.8, 4.4, 0.8);
    b.put('matte', mast, '#6b4024', 0, 1 + h * 0.45, z, 0, 0, Math.PI / 2, 0.8, 5.2, 0.8);
  }
  hull.dispose();
  stripe.dispose();
  deck.dispose();
  box.dispose();
  mast.dispose();
  b.build(ship);
  // Billowing sails with the emblem.
  const sailTex = canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#fff6e4';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#ffd6e2';
    for (let i = 0; i < 4; i++) ctx.fillRect(i * 64 + 28, 0, 8, 256);
    ctx.fillStyle = '#7fd856';
    ctx.strokeStyle = '#1f3a2a';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.ellipse(128, 132, 62, 70, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1f2a3a';
    for (const x of [100, 156]) {
      ctx.beginPath();
      ctx.ellipse(x, 126, 17, 24, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    for (const x of [106, 162]) {
      ctx.beginPath();
      ctx.arc(x, 116, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#1f2a3a';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(128, 160, 20, 0.2, Math.PI - 0.2);
    ctx.stroke();
  });
  const sailMat = new T.MeshLambertMaterial({
    map: sailTex,
    side: T.DoubleSide,
  });
  for (const [z, h, w] of [
    [1.6, 9, 4.2],
    [-1.8, 7.6, 3.6],
  ] as const) {
    const g = new T.PlaneGeometry(w, h * 0.42, 8, 6);
    const p = g.attributes.position as T.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) / (w / 2);
      const v = p.getY(i) / (h * 0.21);
      p.setZ(i, (1 - u * u) * 0.9 * (1 - v * v * 0.3));
    }
    g.computeVertexNormals();
    const sail = new T.Mesh(g, sailMat);
    sail.position.set(0, 1 + h * 0.655, z + 0.15);
    sail.castShadow = true;
    ship.add(sail);
  }
  const flag = new T.Mesh(
    new T.ConeGeometry(0.5, 1.6, 3),
    new T.MeshStandardMaterial({ color: '#ff3d7f', roughness: 0.5 }),
  );
  flag.rotation.z = -Math.PI / 2;
  flag.scale.z = 0.1;
  flag.position.set(0.8, 10.4, 1.6);
  ship.add(flag);
  ship.traverse((o) => {
    if (o instanceof T.Mesh) o.castShadow = false;
  });
  return ship;
}

/** Floating red/white buoys and inflatable rings. */
export function buildBuoys(parent: T.Object3D) {
  const items: { obj: T.Object3D; phase: number; x: number; z: number }[] = [];
  const mats = seaMaterials();
  const list: [number, number, string][] = [
    [-12.5, -1.5, '#ff3b5c'],
    [13.2, -4.5, '#ffd23f'],
    [-8.5, -13.5, '#ffd23f'],
    [8.5, -14.5, '#ff3b5c'],
  ];
  list.forEach(([x, z, col], i) => {
    const b = new SeaBatch(mats);
    const body = new T.SphereGeometry(0.55, 16, 10);
    b.put('gloss', body, col, 0, 0.1, 0, 0, 0, 0, 1, 1.15, 1);
    const band = new T.CylinderGeometry(0.58, 0.58, 0.22, 16, 1, true);
    b.put('gloss', band, '#ffffff', 0, 0.2, 0);
    const pole = new T.CylinderGeometry(0.06, 0.06, 1.3, 6);
    b.put('matte', pole, '#ffffff', 0, 1.1, 0);
    const lamp = new T.SphereGeometry(0.16, 8, 6);
    b.put('glow', lamp, '#fff1a8', 0, 1.8, 0);
    body.dispose();
    band.dispose();
    pole.dispose();
    lamp.dispose();
    const g = new T.Group();
    g.position.set(x, SEA_LEVEL, z);
    b.build(g, false);
    parent.add(g);
    items.push({ obj: g, phase: i * 1.7, x, z });
  });
  return {
    items,
    update(t: number) {
      for (const it of items) {
        it.obj.position.y = SEA_LEVEL + Math.sin(t * 1.6 + it.phase) * 0.12;
        it.obj.rotation.z = Math.sin(t * 1.3 + it.phase) * 0.12;
        it.obj.rotation.x = Math.cos(t * 1.1 + it.phase) * 0.1;
      }
    },
  };
}

/** A few seagulls circling above the sea. */
export function buildGulls(parent: T.Object3D) {
  const wing = new T.BufferGeometry();
  // Two wing triangles and a body wedge; flapping is done by scaling y.
  wing.setAttribute(
    'position',
    new T.Float32BufferAttribute(
      [
        0, 0, 0.3, -1.1, 0.35, -0.1, 0, 0, -0.35,
        0, 0, 0.3, 0, 0, -0.35, 1.1, 0.35, -0.1,
        -1.1, 0.35, -0.1, -1.7, 0.1, -0.35, -0.6, 0.18, -0.25,
        1.1, 0.35, -0.1, 0.6, 0.18, -0.25, 1.7, 0.1, -0.35,
      ],
      3,
    ),
  );
  wing.computeVertexNormals();
  const mat = new T.MeshLambertMaterial({
    color: '#ffffff',
    side: T.DoubleSide,
    emissive: '#8fb8d8',
    emissiveIntensity: 0.3,
  });
  const gulls = Array.from({ length: 4 }, (_, i) => {
    const m = new T.Mesh(wing, mat);
    m.scale.setScalar(0.55);
    parent.add(m);
    return { m, r: 14 + i * 4, h: 7 + (i % 2) * 2.5, s: 0.25 + i * 0.04, p: i * 1.9, cx: (i - 1.5) * 6, cz: -20 - i * 3 };
  });
  return {
    update(t: number) {
      for (const g of gulls) {
        const a = t * g.s + g.p;
        g.m.position.set(g.cx + Math.cos(a) * g.r, g.h + Math.sin(t * 0.8 + g.p) * 0.6, g.cz + Math.sin(a) * g.r * 0.5);
        g.m.rotation.y = -a;
        g.m.scale.y = 0.55 * (0.4 + Math.abs(Math.sin(t * 5 + g.p)));
      }
    },
  };
}
