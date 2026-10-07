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
    // Lush base: sunny centre falling off to a deeper green near the rim.
    const base = ctx.createRadialGradient(c - 60, c - 40, 40, c, c, 520);
    base.addColorStop(0, '#6fd043');
    base.addColorStop(0.55, '#55bd36');
    base.addColorStop(0.9, '#3f9f2c');
    base.addColorStop(1, '#358a28');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 1024, 1024);
    // Large soft patches so the lawn never reads as a flat colour.
    const pr = seaRandom(9);
    for (let i = 0; i < 70; i++) {
      const x = pr() * 1024,
        y = pr() * 1024,
        rad = 50 + pr() * 130;
      const pg = ctx.createRadialGradient(x, y, 0, x, y, rad);
      const col = pr() > 0.5 ? '150,230,80' : '20,95,35';
      pg.addColorStop(0, `rgba(${col},0.2)`);
      pg.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = pg;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    // Grass blades: thousands of short strokes, dark roots and sunlit tips.
    const r = seaRandom(31);
    ctx.lineCap = 'round';
    for (let i = 0; i < 24000; i++) {
      const a = r() * Math.PI * 2,
        d = Math.sqrt(r()) * 508;
      const x = c + Math.cos(a) * d,
        y = c + Math.sin(a) * d;
      const ang = -Math.PI / 2 + (r() - 0.5) * 1.4,
        len = 4 + r() * 7;
      const light = r();
      ctx.strokeStyle =
        light > 0.62
          ? `rgba(190,250,120,${0.3 + r() * 0.3})`
          : light > 0.3
            ? `rgba(20,100,35,${0.25 + r() * 0.25})`
            : `rgba(95,190,55,0.45)`;
      ctx.lineWidth = 1.5 + r() * 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      ctx.stroke();
    }
    // Clover clumps.
    for (let i = 0; i < 90; i++) {
      const a = r() * Math.PI * 2,
        d = Math.sqrt(r()) * 470;
      const x = c + Math.cos(a) * d,
        y = c + Math.sin(a) * d;
      for (let k = 0; k < 7; k++) {
        ctx.fillStyle = k % 2 ? 'rgba(40,130,40,0.55)' : 'rgba(120,210,80,0.5)';
        ctx.beginPath();
        ctx.arc(x + (r() - 0.5) * 22, y + (r() - 0.5) * 22, 3 + r() * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Little flowers.
    for (let i = 0; i < 150; i++) {
      const a = r() * Math.PI * 2,
        d = 100 + Math.sqrt(r()) * 370;
      const x = c + Math.cos(a) * d,
        y = c + Math.sin(a) * d;
      ctx.fillStyle = ['#ffffff', '#ffe066', '#ff9cc8', '#ffffff'][i % 4];
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.arc(x + Math.cos(k * 1.57) * 2.4, y + Math.sin(k * 1.57) * 2.4, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#ffb21a';
      ctx.beginPath();
      ctx.arc(x, y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Worn rim: sun-dried, scuffed grass and bare patches near the edge,
    // where bumper tubs skid before going over.
    for (let i = 0; i < 260; i++) {
      const a = r() * Math.PI * 2,
        d = 430 + r() * 80;
      const x = c + Math.cos(a) * d,
        y = c + Math.sin(a) * d,
        rad = 10 + r() * 30;
      const wg = ctx.createRadialGradient(x, y, 0, x, y, rad);
      const dirt = r() > 0.72;
      wg.addColorStop(0, dirt ? 'rgba(150,110,60,0.5)' : 'rgba(190,200,90,0.3)');
      wg.addColorStop(1, 'rgba(160,170,80,0)');
      ctx.fillStyle = wg;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    // Skid marks: faint curved scuffs left by the tubs.
    ctx.strokeStyle = 'rgba(30,90,30,0.22)';
    ctx.lineWidth = 10;
    for (let i = 0; i < 9; i++) {
      const a0 = r() * Math.PI * 2,
        d = 160 + r() * 280;
      ctx.beginPath();
      ctx.arc(c, c, d, a0, a0 + 0.25 + r() * 0.4);
      ctx.stroke();
    }
    // Rim shade: the turf rolls over the edge.
    const rim = ctx.createRadialGradient(c, c, 430, c, c, 512);
    rim.addColorStop(0, 'rgba(10,60,20,0)');
    rim.addColorStop(1, 'rgba(10,60,20,0.35)');
    ctx.fillStyle = rim;
    ctx.fillRect(0, 0, 1024, 1024);
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
    sg.addColorStop(0, 'rgba(0,40,30,0.45)');
    sg.addColorStop(0.6, 'rgba(0,40,30,0.28)');
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

/** The floating island arena: turf top, rolled sod edge, rocky underside. */
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
  // Rounded turf edge rolling over the rock, slightly lumpy so it reads as sod.
  const lipGeo = new T.TorusGeometry(7.97, 0.17, 10, 160);
  const lp = lipGeo.attributes.position as T.BufferAttribute;
  for (let i = 0; i < lp.count; i++) {
    const a = Math.atan2(lp.getY(i), lp.getX(i));
    const k = 1 + Math.sin(a * 37) * 0.004 + Math.sin(a * 91) * 0.003;
    lp.setXY(i, lp.getX(i) * k, lp.getY(i) * k);
  }
  lipGeo.computeVertexNormals();
  const lip = new T.Mesh(
    lipGeo,
    new T.MeshStandardMaterial({
      color: '#3f9a2b',
      roughness: 0.95,
    }),
  );
  lip.rotation.x = Math.PI / 2;
  lip.position.y = -0.06;
  lip.castShadow = true;
  lip.receiveShadow = true;
  group.add(lip);
  // Rocky underside: a ledged lathe profile, lumped, with a painted rock map.
  // Listed bottom to top so the lathe faces outward.
  const profile = [
    [0.3, -8.2],
    [2.2, -7.4],
    [3.4, -7.0],
    [4.7, -6.1],
    [5.2, -5.9],
    [6.3, -4.8],
    [6.7, -4.65],
    [7.35, -3.7],
    [7.75, -3.45],
    [7.9, -2.8],
    [8.25, -2.55],
    [8.3, -1.95],
    [8.55, -1.6],
    [8.5, -1.15],
    [8.38, -0.72],
    [7.95, -0.42],
  ].map(([r, y]) => new T.Vector2(r, y));
  const rock = new T.LatheGeometry(profile, 72);
  const pos = rock.attributes.position as T.BufferAttribute;
  const uv = rock.attributes.uv as T.BufferAttribute;
  const v = new T.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // World-height V so strata stay level; U wraps 12 times around.
    uv.setXY(i, uv.getX(i) * 12, v.y * 0.42);
    if (v.y > -0.5) continue;
    const a = Math.atan2(v.z, v.x);
    // Big boulder lobes plus finer chips; stays seamless around the circle.
    const n =
      Math.sin(a * 5 + v.y * 0.9) * 0.5 +
      Math.sin(a * 11 - v.y * 1.7) * 0.3 +
      Math.sin(a * 23 + v.y * 3.1) * 0.2 +
      Math.sin(a * 41 - v.y * 2.3) * 0.12;
    const k = 1 + n * 0.07;
    v.x *= k;
    v.z *= k;
    v.y += Math.sin(a * 13 + v.y) * 0.16;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  const rockGeo = rock;
  const cols = new Float32Array(rockGeo.attributes.position.count * 3);
  const rp = rockGeo.attributes.position as T.BufferAttribute;
  const c = new T.Color();
  const rr = seaRandom(19);
  const deep = new T.Color('#3d2c27'),
    warm = new T.Color('#c08a5c'),
    moss = new T.Color('#3f8f3a'),
    wet = new T.Color('#2a2a30'),
    band = new T.Color('#8a5a3e');
  // Per-vertex colour: height gradient, strata bands, mottling, a dark wet
  // band at the waterline and a mossy fringe under the turf.
  for (let i = 0; i < rp.count; i++) {
    const y = rp.getY(i);
    const t = T.MathUtils.clamp((y + 4.2) / 3.6, 0, 1);
    c.copy(deep).lerp(warm, t * t * (3 - 2 * t));
    if (Math.sin(y * 4.2 + rp.getX(i) * 0.3) > 0.6) c.lerp(band, 0.4);
    c.multiplyScalar(0.84 + rr() * 0.22);
    if (y < -1.9) c.lerp(wet, T.MathUtils.clamp((-1.9 - y) / 0.6, 0, 0.6));
    if (y > -0.85) c.lerp(moss, 0.8);
    cols.set([c.r, c.g, c.b], i * 3);
  }
  rockGeo.setAttribute('color', new T.BufferAttribute(cols, 3));
  rockGeo.computeVertexNormals();
  const underside = new T.Mesh(
    rockGeo,
    new T.MeshStandardMaterial({
      vertexColors: true,
      map: rockTexture(),
      roughness: 0.9,
    }),
  );
  underside.castShadow = true;
  underside.receiveShadow = true;
  group.add(underside);
  return group;
}

/** Neutral rock detail (multiplied by the vertex colours): strata, cracks, chips. */
function rockTexture() {
  const t = canvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = '#d6d0ca';
    ctx.fillRect(0, 0, 512, 512);
    const r = seaRandom(41);
    // Mottled light/dark blotches.
    for (let i = 0; i < 260; i++) {
      const x = r() * 512,
        y = r() * 512,
        rad = 8 + r() * 40;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      const dark = r() > 0.45;
      g.addColorStop(0, dark ? 'rgba(90,80,75,0.35)' : 'rgba(255,250,240,0.4)');
      g.addColorStop(1, 'rgba(128,120,115,0)');
      ctx.fillStyle = g;
      for (const ox of [-512, 0, 512]) ctx.fillRect(x - rad + ox, y - rad, rad * 2, rad * 2);
    }
    // Horizontal strata ledges: lit top edge, shadowed underside.
    for (let k = 0; k < 7; k++) {
      let y = 30 + k * 72 + r() * 20;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= 512; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.0245 * (1 + (k % 3))) * 6 + (r() - 0.5) * 4);
      ctx.lineWidth = 7;
      ctx.strokeStyle = 'rgba(60,50,48,0.55)';
      ctx.stroke();
      ctx.translate(0, -5);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,250,240,0.45)';
      ctx.stroke();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      y += 0;
    }
    // Vertical cracks.
    ctx.strokeStyle = 'rgba(50,40,38,0.6)';
    for (let i = 0; i < 40; i++) {
      let x = r() * 512,
        y = r() * 512;
      ctx.lineWidth = 1 + r() * 2.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let s = 0; s < 5; s++) {
        x += (r() - 0.5) * 22;
        y += 10 + r() * 18;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // Pale chips and pebbles.
    for (let i = 0; i < 500; i++) {
      ctx.fillStyle = r() > 0.5 ? 'rgba(255,250,240,0.5)' : 'rgba(70,60,55,0.45)';
      ctx.fillRect(r() * 512, r() * 512, 2 + r() * 3, 2 + r() * 2);
    }
  });
  t.wrapS = t.wrapT = T.RepeatWrapping;
  return t;
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
  // Rigging, bowsprit and jib, crow's nest, railings, portholes and party
  // bunting: all merged into the same few batches.
  const up = new T.Vector3(0, 1, 0);
  const rope = (a: T.Vector3, c: T.Vector3, r: number, color: string) => {
    const dir = c.clone().sub(a);
    const g = new T.CylinderGeometry(r, r, dir.length(), 5);
    const m = new T.Matrix4().compose(
      a.clone().add(c).multiplyScalar(0.5),
      new T.Quaternion().setFromUnitVectors(up, dir.normalize()),
      new T.Vector3(1, 1, 1),
    );
    b.add('matte', g, color, m);
    g.dispose();
  };
  const V = (x: number, y: number, z: number) => new T.Vector3(x, y, z);
  const mainTop = V(0, 9.9, 1.6),
    mizTop = V(0, 8.4, -1.8),
    bowTip = V(0, 2.9, 9.6);
  rope(V(0, 1.5, 6.4), bowTip, 0.11, '#6b4024');
  for (const [top, z] of [
    [mainTop, 1.6],
    [mizTop, -1.8],
  ] as const)
    for (const side of [-1, 1])
      for (const dz of [-0.9, 0.9]) rope(top, V(side * 2.05, 1.05, z + dz), 0.025, '#3a2a20');
  rope(mainTop, bowTip, 0.03, '#3a2a20');
  rope(mainTop, mizTop, 0.03, '#3a2a20');
  rope(mizTop, V(0, 2.9, -5.8), 0.03, '#3a2a20');
  // Jib sail.
  const jib = new T.BufferGeometry();
  jib.setAttribute(
    'position',
    new T.Float32BufferAttribute([0, 9.0, 1.9, 0, 3.0, 9.2, 0, 1.6, 4.0], 3),
  );
  jib.computeVertexNormals();
  // The jib is its own softly self-lit mesh so it never reads as a grey card.
  const jibMesh = new T.Mesh(
    jib,
    new T.MeshLambertMaterial({
      color: '#fff6e4',
      emissive: '#fff1dc',
      emissiveIntensity: 0.55,
      side: T.DoubleSide,
    }),
  );
  ship.add(jibMesh);
  // Crow's nest.
  const nest = new T.CylinderGeometry(0.55, 0.45, 0.45, 12, 1, true);
  b.put('matte', nest, '#8f4b2b', 0, 8.2, 1.6);
  nest.dispose();
  // Deck railing posts and portholes.
  const post = new T.CylinderGeometry(0.05, 0.05, 0.45, 5);
  const port = new T.CylinderGeometry(0.17, 0.17, 0.1, 10);
  for (let k = 0; k < 28; k++) {
    const a = (k / 28) * Math.PI * 2;
    const z = Math.sin(a) * 6.7;
    if (z < -3.2) continue;
    b.put('matte', post, '#fff6e4', Math.cos(a) * 2.08, 1.28, z);
  }
  for (const side of [-1, 1])
    for (let k = 0; k < 5; k++) {
      const z = -2.6 + k * 1.5;
      const x = side * 2.25 * Math.sqrt(1 - (z / 7.2) ** 2);
      b.put('glow', port, '#fff3b0', x, 0.42, z, 0, 0, Math.PI / 2);
    }
  post.dispose();
  port.dispose();
  // Party bunting strung bow to stern over the mast tops.
  const pennant = new T.ConeGeometry(0.2, 0.42, 3).rotateX(Math.PI);
  const bunting = ['#ff3d7f', '#ffc21a', '#1fa2ff', '#8a4dff', '#2fd17a'];
  const string = (a: T.Vector3, c: T.Vector3, n: number) => {
    rope(a, c, 0.018, '#fff6e4');
    for (let k = 1; k < n; k++) {
      const t = k / n;
      const p = a.clone().lerp(c, t);
      p.y -= Math.sin(t * Math.PI) * 0.35 + 0.22;
      b.put('gloss', pennant, bunting[k % bunting.length], p.x, p.y, p.z, 0, 0, 0, 1, 1, 0.25);
    }
  };
  string(mainTop, bowTip, 9);
  string(mainTop, mizTop, 5);
  string(mizTop, V(0, 2.9, -5.8), 6);
  pennant.dispose();
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
