import * as T from 'three';
import { canvasTexture, seaRandom } from './sea-kit';

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
    g.addColorStop(0.4, 'rgba(255,255,255,0.75)');
    g.addColorStop(0.75, 'rgba(255,255,255,0.25)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
}

/** Sun-catching droplet: a hot core with a soft falloff (no hard bubble rim). */
function dropTexture() {
  return canvasTexture(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(30, 29, 0, 32, 32, 30);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.75, 'rgba(240,250,255,0.35)');
    g.addColorStop(1, 'rgba(240,250,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, Math.PI * 2);
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
    path(60, 27);
    ctx.fillStyle = '#7a2a00';
    ctx.fill();
    path(52, 23);
    ctx.fillStyle = '#ff9d00';
    ctx.fill();
    path(40, 18);
    ctx.fillStyle = '#fff2a8';
    ctx.fill();
  });
}

/** Comic impact burst: spiky white-hot core inside an orange flare. */
function burstTexture() {
  return canvasTexture(256, 256, (ctx) => {
    const r = seaRandom(5);
    const spikes = (n: number, r1: number, r2: number, fill: string) => {
      ctx.beginPath();
      for (let i = 0; i < n * 2; i++) {
        const a = (i / (n * 2)) * Math.PI * 2;
        const rr = i % 2 ? r2 : r1 * (0.8 + r() * 0.35);
        const x = 128 + Math.cos(a) * rr,
          y = 128 + Math.sin(a) * rr;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    };
    spikes(12, 124, 62, 'rgba(255,120,30,0.95)');
    spikes(12, 100, 50, '#ffd23f');
    spikes(10, 70, 38, '#fffbe0');
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 44);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  });
}

/** Foam patch: a lacy ring of bubbles and streaks for the water surface. */
function foamTexture() {
  return canvasTexture(256, 256, (ctx) => {
    const r = seaRandom(23);
    ctx.clearRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) {
      const a = r() * Math.PI * 2;
      // Dense near the ring, thinning inward and outward.
      const d = 70 + (r() - 0.5) * (r() * 110);
      const x = 128 + Math.cos(a) * d,
        y = 128 + Math.sin(a) * d;
      const s = 1.5 + r() * r() * 9;
      ctx.fillStyle = `rgba(255,255,255,${0.25 + r() * 0.6})`;
      ctx.beginPath();
      ctx.arc(x, y, s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath();
      ctx.arc(r() * 256, r() * 256, 2 + r() * 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    const fade = ctx.createRadialGradient(128, 128, 90, 128, 128, 128);
    fade.addColorStop(0, 'rgba(0,0,0,0)');
    fade.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, 256, 256);
    ctx.globalCompositeOperation = 'source-over';
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
          // Droplets that land are absorbed quickly.
          p.age = Math.max(p.age, p.life * 0.85);
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
          (t < 0.08 ? t / 0.08 : 1 - Math.pow((t - 0.08) / 0.92, 2)) * (p.alpha ?? 1);
        size[i] = p.size * (1 + p.grow * t);
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aColor.needsUpdate = true;
      geo.attributes.aSize.needsUpdate = true;
    },
  };
}

/** Pooled flat rings for shockwaves. */
function ringPool(scene: T.Scene, count: number) {
  const geo = new T.RingGeometry(0.78, 1, 56);
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
        (r.m.material as T.MeshBasicMaterial).opacity = (1 - t) * (1 - t) * 0.55;
      }
    },
  };
}

/**
 * Flared, open water sheet: full crowns for things landing in the sea and
 * partial fans for waves slamming into rock. The top edge is eroded into
 * fingers by noise and the sheet dissolves into holes as it collapses.
 */
function sheetGeometry(arc: number) {
  const g = new T.CylinderGeometry(1, 1, 1, arc < 6 ? 28 : 44, 7, true, -arc / 2, arc);
  const p = g.attributes.position as T.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const v = p.getY(i) + 0.5;
    const flare = 0.5 + 0.85 * Math.pow(v, 1.6);
    p.setXYZ(i, p.getX(i) * flare, v, p.getZ(i) * flare);
  }
  g.computeVertexNormals();
  return g;
}

function sheetMaterial() {
  return new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: T.DoubleSide,
    uniforms: {
      uAge: { value: 0 },
      uSeed: { value: 0 },
      uArc: { value: 0 },
      uOpacity: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vW;
      void main() {
        vUv = uv;
        vN = normalize(mat3(modelMatrix) * normal);
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uAge, uSeed, uArc, uOpacity;
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vW;
      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
                   mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
      }
      void main() {
        float arcK = mix(1.0, 0.45, uArc);
        // Crown points: a few big fingers plus fine ragged detail.
        float n = noise(vec2(vUv.x * 13.0 * arcK + uSeed, uSeed * 0.3));
        float n2 = noise(vec2(vUv.x * 41.0 * arcK - uSeed, vUv.y * 5.0 + uAge * 2.0));
        float fingers = n * 0.7 + n2 * 0.3;
        // Ragged top edge that sinks as the sheet collapses.
        float edgeY = 0.62 + (fingers - 0.5) * 0.7 - uAge * 0.18;
        float top = 1.0 - smoothstep(edgeY - 0.06, edgeY, vUv.y);
        float lip = smoothstep(edgeY - 0.22, edgeY - 0.04, vUv.y);
        // Holes open up from the top down as it ages.
        float holes = smoothstep(uAge * 1.2 - 0.1, uAge * 1.2 + 0.1, n2 * 0.75 + (1.0 - vUv.y) * 0.45);
        float side = mix(1.0, smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x), uArc);
        float base = smoothstep(0.0, 0.06, vUv.y);
        vec3 V = normalize(cameraPosition - vW);
        float fres = pow(1.0 - abs(dot(normalize(vN), V)), 1.5);
        float streak = noise(vec2(vUv.x * 70.0 * arcK + uSeed, vUv.y * 1.3));
        // Translucent aqua body, foamy white lip and silhouette.
        vec3 body = mix(vec3(0.62, 0.88, 0.98), vec3(0.95, 0.99, 1.0), streak * 0.6);
        vec3 col = mix(body, vec3(1.0), clamp(lip + fres * 0.7, 0.0, 1.0));
        float a = top * holes * side * base * uOpacity
                * clamp(0.62 + 0.38 * max(fres, lip) + streak * 0.15, 0.0, 1.0);
        if (a < 0.02) discard;
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
      }`,
  });
}

type Sheet = {
  m: T.Mesh;
  mat: T.ShaderMaterial;
  age: number;
  life: number;
  radius: number;
  height: number;
  grow: number;
};

function sheetPool(scene: T.Scene, count: number, arc: number) {
  const geo = sheetGeometry(arc);
  const list: Sheet[] = Array.from({ length: count }, () => {
    const mat = sheetMaterial();
    mat.uniforms.uArc.value = arc < 6 ? 1 : 0;
    const m = new T.Mesh(geo, mat);
    m.visible = false;
    m.renderOrder = 18;
    m.frustumCulled = false;
    scene.add(m);
    return { m, mat, age: 0, life: 1, radius: 1, height: 1, grow: 1 };
  });
  let next = 0;
  return {
    spawn(x: number, y: number, z: number, yaw: number, radius: number, height: number, life: number, grow = 1) {
      const s = list[next++ % list.length];
      s.m.position.set(x, y, z);
      s.m.rotation.set(0, yaw, 0);
      s.age = 0;
      s.life = life;
      s.radius = radius;
      s.height = height;
      s.grow = grow;
      s.mat.uniforms.uSeed.value = Math.random() * 50;
      s.m.visible = true;
      s.m.scale.set(radius * 0.4, 0.01, radius * 0.4);
    },
    update(dt: number) {
      for (const s of list) {
        if (!s.m.visible) continue;
        s.age += dt;
        const t = s.age / s.life;
        if (t >= 1) {
          s.m.visible = false;
          continue;
        }
        // Shoots up fast, hangs, then slumps back into the sea.
        const rise = Math.sin(Math.min(1, t * 1.25) * Math.PI);
        const h = s.height * Math.pow(Math.max(0, rise), 0.6) * (t < 0.4 ? 1 : 1 - (t - 0.4) * 0.6);
        const r = s.radius * (0.5 + s.grow * 0.75 * (1 - Math.pow(1 - t, 3)));
        s.m.scale.set(r, Math.max(0.01, h), r);
        s.mat.uniforms.uAge.value = t;
        s.mat.uniforms.uOpacity.value = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
      }
    },
  };
}

/** Foam decals that spread and fade on the water surface. */
function foamPool(scene: T.Scene, count: number) {
  const tex = foamTexture();
  const geo = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const list = Array.from({ length: count }, () => {
    const mat = new T.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    const m = new T.Mesh(geo, mat);
    m.visible = false;
    m.renderOrder = 6;
    scene.add(m);
    return { m, mat, age: 0, life: 2, from: 1, to: 3 };
  });
  let next = 0;
  return {
    spawn(x: number, y: number, z: number, from: number, to: number, life: number) {
      const f = list[next++ % list.length];
      f.m.position.set(x, y, z);
      f.m.rotation.y = Math.random() * Math.PI * 2;
      f.age = 0;
      f.life = life;
      f.from = from;
      f.to = to;
      f.m.visible = true;
    },
    update(dt: number) {
      for (const f of list) {
        if (!f.m.visible) continue;
        f.age += dt;
        const t = f.age / f.life;
        if (t >= 1) {
          f.m.visible = false;
          continue;
        }
        const e = 1 - Math.pow(1 - t, 2.5);
        f.m.scale.setScalar(f.from + (f.to - f.from) * e);
        f.mat.opacity = Math.min(1, t * 8) * (1 - t) * 0.95;
      }
    },
  };
}

/** Pooled camera-facing comic bursts for hits. */
function burstPool(scene: T.Scene, count: number) {
  const tex = burstTexture();
  const list = Array.from({ length: count }, () => {
    const mat = new T.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const s = new T.Sprite(mat);
    s.visible = false;
    s.renderOrder = 40;
    scene.add(s);
    return { s, mat, age: 0, life: 0.4, size: 1 };
  });
  let next = 0;
  return {
    spawn(x: number, y: number, z: number, size: number) {
      const b = list[next++ % list.length];
      b.s.position.set(x, y, z);
      b.age = 0;
      b.size = size;
      b.mat.rotation = Math.random() * Math.PI;
      b.s.visible = true;
    },
    update(dt: number) {
      for (const b of list) {
        if (!b.s.visible) continue;
        b.age += dt;
        const t = b.age / b.life;
        if (t >= 1) {
          b.s.visible = false;
          continue;
        }
        const k = b.size * (0.55 + 0.6 * (1 - Math.pow(1 - t, 3)));
        b.s.scale.set(k, k, 1);
        b.mat.opacity = t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45;
      }
    },
  };
}

/** All Bumper Buns VFX: impact bursts, water crowns and sheets, spray, foam. */
export function createSeaFx(scene: T.Scene) {
  const soft = particleSystem(360, softTexture(), false);
  const stars = particleSystem(80, starTexture(), false);
  const drops = particleSystem(700, dropTexture(), false);
  const rings = ringPool(scene, 10);
  const crowns = sheetPool(scene, 8, Math.PI * 2);
  const fans = sheetPool(scene, 6, 1.9);
  const foam = foamPool(scene, 10);
  const bursts = burstPool(scene, 4);
  scene.add(soft.points, stars.points, drops.points);
  const rnd = Math.random;
  const spray = (
    x: number,
    y: number,
    z: number,
    n: number,
    up: number,
    out: number,
    size: number,
    floor: number,
    dir?: [number, number],
  ) => {
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2,
        o = (0.3 + rnd()) * out;
      let vx = Math.cos(a) * o,
        vz = Math.sin(a) * o;
      if (dir) {
        vx = vx * 0.45 + dir[0] * out * (0.6 + rnd());
        vz = vz * 0.45 + dir[1] * out * (0.6 + rnd());
      }
      drops.spawn({
        x: x + Math.cos(a) * 0.25,
        y,
        z: z + Math.sin(a) * 0.25,
        vx,
        vy: up * (0.45 + rnd() * 0.75),
        vz,
        life: 0.8 + rnd() * 0.6,
        size: size * (0.25 + rnd() * rnd() * 0.9),
        grow: -0.35,
        gravity: 14,
        drag: 0.5,
        floor,
        alpha: 0.95,
        color: i % 6 ? '#ffffff' : '#e6f8ff',
      });
    }
  };
  const mist = (x: number, y: number, z: number, n: number, size: number, alpha: number, vx = 0, vz = 0) => {
    for (let i = 0; i < n; i++)
      soft.spawn({
        x: x + (rnd() - 0.5) * size,
        y: y + rnd() * size * 0.5,
        z: z + (rnd() - 0.5) * size,
        vx: vx + (rnd() - 0.5) * 1.2,
        vy: 0.6 + rnd() * 1.2,
        vz: vz + (rnd() - 0.5) * 1.2,
        life: 1.1 + rnd() * 0.5,
        size: size * (0.7 + rnd() * 0.6),
        grow: 1.4,
        alpha,
        gravity: 0,
        drag: 1.6,
        floor: y,
        color: '#f4fbff',
      });
  };
  return {
    setViewport(height: number, fov: number) {
      const s = height / (2 * Math.tan(T.MathUtils.degToRad(fov) / 2));
      soft.mat.uniforms.scale.value = s;
      stars.mat.uniforms.scale.value = s;
      drops.mat.uniforms.scale.value = s;
    },
    impact(x: number, y: number, z: number, strength = 1) {
      bursts.spawn(x, y + 1.6, z, 2.6 * strength);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + rnd() * 0.4;
        const sp = 4 + rnd() * 3;
        stars.spawn({
          x,
          y: y + 1.5,
          z,
          vx: Math.cos(a) * sp,
          vy: 3 + rnd() * 3,
          vz: Math.sin(a) * sp,
          life: 0.6 + rnd() * 0.3,
          size: (0.55 + rnd() * 0.4) * strength,
          grow: -0.4,
          gravity: 9,
          drag: 3,
          floor: -50,
          color: '#ffffff',
        });
      }
      for (let i = 0; i < 6; i++) {
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
    /** Something big lands in the sea: crown, jet of spray, mist and foam. */
    splash(x: number, y: number, z: number, big = 1) {
      crowns.spawn(x, y - 0.1, z, 0, 1.25 * big, 1.9 * big, 1.25, 1.0);
      crowns.spawn(x, y - 0.1, z, 0.7, 0.55 * big, 2.6 * big, 0.9, 0.5);
      spray(x, y + 0.3, z, Math.round(40 * big), 6.5 * big, 2.4 * big, 0.26 * big, y - 0.3);
      // Central jet.
      spray(x, y + 0.3, z, Math.round(12 * big), 9 * big, 0.45, 0.22 * big, y - 0.3);
      mist(x, y + 0.4, z, 5, 1.4 * big, 0.35);
      foam.spawn(x, y + 0.03, z, 1.2 * big, 5.5 * big, 3.2);
      rings.spawn(x, y + 0.04, z, '#e8fbff', 1.0 * big, 3.6 * big, 0.9);
    },
    /** Small splashes kicked up by a swimmer's flailing arms. */
    paddle(x: number, y: number, z: number) {
      crowns.spawn(x, y - 0.05, z, rnd() * 6, 0.6, 1.2, 0.8, 0.9);
      spray(x, y + 0.2, z, 12, 5.5, 1.3, 0.2, y - 0.2);
      mist(x, y + 0.3, z, 1, 0.8, 0.3);
      foam.spawn(x, y + 0.02, z, 0.8, 2.8, 1.8);
    },
    /** Waves breaking on the island's rock: a curved sheet that fans outward. */
    crash(x: number, y: number, z: number, nx: number, nz: number, big = 1) {
      const yaw = Math.atan2(nx, nz);
      fans.spawn(x - nx * 0.15, y - 0.15, z - nz * 0.15, yaw, 1.0 * big, 2.0 * big, 1.15, 0.7);
      spray(x + nx * 0.6, y + 0.4, z + nz * 0.6, Math.round(16 * big), 6.5 * big, 1.5 * big, 0.24 * big, y - 0.3, [nx, nz]);
      mist(x + nx * 0.6, y + 0.4, z + nz * 0.6, 2, 1.2 * big, 0.28, nx * 0.8, nz * 0.8);
      if (big > 1.2) foam.spawn(x + nx * 0.8, y + 0.03, z + nz * 0.8, 1.4, 4.2 * big, 2.4);
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
        alpha: 0.5,
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
      crowns.update(dt);
      fans.update(dt);
      foam.update(dt);
      bursts.update(dt);
    },
  };
}
