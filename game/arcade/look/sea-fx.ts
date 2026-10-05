import * as T from 'three';
import { canvasTexture } from './sea-kit';

type Particle = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  age: number;
  size: number;
  grow: number;
  gravity: number;
  drag: number;
  r: number;
  g: number;
  b: number;
  floor: number;
  alpha?: number;
};

function softTexture() {
  return canvasTexture(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.62, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.8, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
}

/** Crisp cartoon water droplet: solid disc, highlight, cool rim. */
function dropTexture() {
  return canvasTexture(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(24, 22, 2, 32, 32, 29);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.6, '#f4fcff');
    g.addColorStop(1, '#b9e9fb');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(32, 32, 29, 0, Math.PI * 2);
    ctx.fill();
  });
}

function starTexture() {
  return canvasTexture(128, 128, (ctx) => {
    const path = (r1: number, r2: number) => {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2,
          r = i % 2 ? r2 : r1;
        const x = 64 + Math.cos(a) * r,
          y = 64 + Math.sin(a) * r;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.closePath();
    };
    path(58, 26);
    ctx.fillStyle = '#ff7a00';
    ctx.fill();
    path(46, 20);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  });
}

/** One draw call worth of camera-facing particles with per-particle colour/size. */
function particleSystem(max: number, map: T.Texture, additive: boolean) {
  const geo = new T.BufferGeometry();
  const pos = new Float32Array(max * 3),
    col = new Float32Array(max * 4),
    size = new Float32Array(max);
  geo.setAttribute('position', new T.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new T.BufferAttribute(col, 4));
  geo.setAttribute('aSize', new T.BufferAttribute(size, 1));
  const mat = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: additive ? T.AdditiveBlending : T.NormalBlending,
    uniforms: { map: { value: map }, scale: { value: 600 } },
    vertexShader: /* glsl */ `
      attribute vec4 aColor;
      attribute float aSize;
      uniform float scale;
      varying vec4 vColor;
      void main() {
        vColor = aColor;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * scale / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      varying vec4 vColor;
      void main() {
        vec4 t = texture2D(map, gl_PointCoord);
        gl_FragColor = vec4(t.rgb * vColor.rgb, t.a * vColor.a);
        if (gl_FragColor.a < 0.01) discard;
        #include <colorspace_fragment>
      }`,
  });
  const points = new T.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 20;
  const list: Particle[] = [];
  const c = new T.Color();
  return {
    points,
    mat,
    spawn(p: Omit<Particle, 'age' | 'r' | 'g' | 'b'> & { color: string }) {
      if (list.length >= max) list.shift();
      c.set(p.color);
      list.push({ ...p, age: 0, r: c.r, g: c.g, b: c.b });
    },
    update(dt: number) {
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.age += dt;
        if (p.age >= p.life) {
          list.splice(i, 1);
          continue;
        }
        p.vy -= p.gravity * dt;
        const k = Math.exp(-p.drag * dt);
        p.vx *= k;
        p.vz *= k;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        if (p.y < p.floor) {
          p.y = p.floor;
          p.vy = 0;
        }
      }
      for (let i = 0; i < max; i++) {
        const p = list[i];
        if (!p) {
          size[i] = 0;
          continue;
        }
        const t = p.age / p.life;
        pos[i * 3] = p.x;
        pos[i * 3 + 1] = p.y;
        pos[i * 3 + 2] = p.z;
        col[i * 4] = p.r;
        col[i * 4 + 1] = p.g;
        col[i * 4 + 2] = p.b;
        col[i * 4 + 3] =
          (t < 0.1 ? t * 10 : 1 - Math.pow((t - 0.1) / 0.9, 2)) * (p.alpha ?? 1);
        size[i] = p.size * (1 + p.grow * t);
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aColor.needsUpdate = true;
      geo.attributes.aSize.needsUpdate = true;
    },
  };
}

/** Pooled flat rings for shockwaves and splash foam. */
function ringPool(scene: T.Scene, count: number) {
  const geo = new T.RingGeometry(0.7, 1, 48);
  geo.rotateX(-Math.PI / 2);
  const rings = Array.from({ length: count }, () => {
    const m = new T.Mesh(
      geo,
      new T.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        depthWrite: false,
        side: T.DoubleSide,
      }),
    );
    m.visible = false;
    m.renderOrder = 15;
    scene.add(m);
    return { m, age: 0, life: 1, from: 1, to: 3 };
  });
  let next = 0;
  return {
    spawn(x: number, y: number, z: number, color: string, from: number, to: number, life: number) {
      const r = rings[next++ % rings.length];
      r.m.position.set(x, y, z);
      (r.m.material as T.MeshBasicMaterial).color.set(color);
      r.age = 0;
      r.life = life;
      r.from = from;
      r.to = to;
      r.m.visible = true;
    },
    update(dt: number) {
      for (const r of rings) {
        if (!r.m.visible) continue;
        r.age += dt;
        const t = r.age / r.life;
        if (t >= 1) {
          r.m.visible = false;
          continue;
        }
        const e = 1 - Math.pow(1 - t, 3);
        r.m.scale.setScalar(r.from + (r.to - r.from) * e);
        (r.m.material as T.MeshBasicMaterial).opacity = (1 - t) * 0.9;
      }
    },
  };
}

/** All Bumper Buns VFX: impact stars, shockwaves, splashes, dust and spray. */
export function createSeaFx(scene: T.Scene) {
  const soft = particleSystem(420, softTexture(), false);
  const stars = particleSystem(80, starTexture(), false);
  const drops = particleSystem(500, dropTexture(), false);
  const rings = ringPool(scene, 12);
  scene.add(soft.points, stars.points, drops.points);
  const rnd = Math.random;
  return {
    setViewport(height: number, fov: number) {
      const s = height / (2 * Math.tan(T.MathUtils.degToRad(fov) / 2));
      soft.mat.uniforms.scale.value = s;
      stars.mat.uniforms.scale.value = s;
      drops.mat.uniforms.scale.value = s;
    },
    impact(x: number, y: number, z: number, strength = 1) {
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + rnd() * 0.4;
        const sp = 4 + rnd() * 3;
        stars.spawn({
          x,
          y: y + 1.2,
          z,
          vx: Math.cos(a) * sp,
          vy: 3 + rnd() * 3,
          vz: Math.sin(a) * sp,
          life: 0.55 + rnd() * 0.3,
          size: (0.5 + rnd() * 0.45) * strength,
          grow: -0.4,
          gravity: 9,
          drag: 3,
          floor: -50,
          color: i % 3 ? '#ffe14d' : '#ffffff',
        });
      }
      for (let i = 0; i < 8; i++) {
        const a = rnd() * Math.PI * 2;
        soft.spawn({
          x,
          y: y + 0.4,
          z,
          vx: Math.cos(a) * 3,
          vy: 0.6 + rnd(),
          vz: Math.sin(a) * 3,
          life: 0.6,
          size: 0.45 + rnd() * 0.35,
          grow: 1.0,
          alpha: 0.6,
          gravity: 0,
          drag: 4,
          floor: 0.1,
          color: '#fffbe8',
        });
      }
      rings.spawn(x, y + 0.08, z, '#fff6b8', 0.6, 3.2 * strength, 0.45);
    },
    splash(x: number, y: number, z: number, big = 1) {
      const n = Math.round(40 * big);
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2,
          out = rnd() * 2.2;
        drops.spawn({
          x: x + Math.cos(a) * 0.3,
          y,
          z: z + Math.sin(a) * 0.3,
          vx: Math.cos(a) * out * big,
          vy: (4.5 + rnd() * 5.5) * big,
          vz: Math.sin(a) * out * big,
          life: 0.9 + rnd() * 0.6,
          size: (0.16 + rnd() * 0.34) * big,
          grow: -0.5,
          gravity: 15,
          drag: 0.6,
          floor: y - 0.2,
          color: i % 4 ? '#ffffff' : '#bff6ff',
        });
      }
      rings.spawn(x, y + 0.04, z, '#ffffff', 0.5 * big, 3.6 * big, 1.1);
      rings.spawn(x, y + 0.03, z, '#e8fdff', 0.3 * big, 2.0 * big, 0.8);
    },
    /** Waves breaking on the rocks: a sideways sheet of spray. */
    crash(x: number, y: number, z: number, nx: number, nz: number, big = 1) {
      const n = Math.round(16 * big);
      for (let i = 0; i < n; i++) {
        const side = (rnd() - 0.5) * 2;
        drops.spawn({
          x: x - nz * side * 0.9,
          y,
          z: z + nx * side * 0.9,
          vx: nx * (1 + rnd() * 2) - nz * side * 1.2,
          vy: (3 + rnd() * 4) * big,
          vz: nz * (1 + rnd() * 2) + nx * side * 1.2,
          life: 0.8 + rnd() * 0.5,
          size: (0.14 + rnd() * 0.3) * big,
          grow: -0.45,
          gravity: 11,
          drag: 0.8,
          floor: y - 0.3,
          color: '#ffffff',
        });
      }
      // A little mist gives the spray body.
      for (let i = 0; i < 3; i++)
        soft.spawn({
          x: x + nx * 0.4,
          y: y + 0.3,
          z: z + nz * 0.4,
          vx: nx * 0.8,
          vy: (1.2 + rnd()) * big,
          vz: nz * 0.8,
          life: 0.9,
          size: 0.6 * big,
          grow: 1.2,
          alpha: 0.35,
          gravity: 0,
          drag: 1.5,
          floor: y,
          color: '#ffffff',
        });
    },
    dust(x: number, y: number, z: number, vx: number, vz: number) {
      soft.spawn({
        x: x + (rnd() - 0.5) * 0.6,
        y: y + 0.2,
        z: z + (rnd() - 0.5) * 0.6,
        vx: -vx * 0.15 + (rnd() - 0.5),
        vy: 0.6 + rnd() * 0.6,
        vz: -vz * 0.15 + (rnd() - 0.5),
        life: 0.55 + rnd() * 0.3,
        size: 0.3 + rnd() * 0.25,
        grow: 1.2,
        alpha: 0.55,
        gravity: 0,
        drag: 2.5,
        floor: 0,
        color: '#fffbe6',
      });
    },
    sparkle(x: number, y: number, z: number, color: string) {
      stars.spawn({
        x: x + (rnd() - 0.5),
        y: y + rnd(),
        z: z + (rnd() - 0.5),
        vx: 0,
        vy: 1.2,
        vz: 0,
        life: 0.6,
        size: 0.35,
        grow: -0.5,
        gravity: 0,
        drag: 1,
        floor: -50,
        color,
      });
    },
    update(dt: number) {
      soft.update(dt);
      stars.update(dt);
      drops.update(dt);
      rings.update(dt);
    },
  };
}
