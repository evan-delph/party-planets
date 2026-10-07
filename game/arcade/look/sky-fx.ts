import * as T from 'three';

const NOISE = /* glsl */ `
  float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x),
               mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * vnoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
    return v;
  }`;

export const SKY = {
  zenith: '#1258cf',
  mid: '#3d95ee',
  horizon: '#c4e7ff',
  below: '#e9f4ff',
  // Low in the upper-right of the chase view, so the bloom and rays frame
  // the course instead of hiding behind the HUD.
  sunDir: new T.Vector3(0.36, 0.13, -0.92).normalize(),
  haze: '#d3e8fb',
};

/**
 * Soft cumulus shading for the instanced cloud puffs: warm sunlit tops,
 * lavender-blue undersides, a bright silver lining at the silhouette and
 * aerial haze with distance.
 */
export function cloudMaterial() {
  return new T.ShaderMaterial({
    fog: false,
    uniforms: {
      sunDir: { value: SKY.sunDir },
      lit: { value: new T.Color('#ffffff') },
      warm: { value: new T.Color('#fbf8ff') },
      shade: { value: new T.Color('#9aaee2') },
      haze: { value: new T.Color(SKY.haze) },
      camPos: { value: new T.Vector3() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vW;
      varying float vH;
      void main() {
        mat4 m = modelMatrix;
        #ifdef USE_INSTANCING
          m = m * instanceMatrix;
        #endif
        vec4 w = m * vec4(position, 1.0);
        vW = w.xyz;
        vN = normalize(mat3(m) * normal);
        vH = position.y;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 sunDir, lit, warm, shade, haze, camPos;
      varying vec3 vN;
      varying vec3 vW;
      varying float vH;
      void main() {
        vec3 n = normalize(vN);
        vec3 v = normalize(camPos - vW);
        float sun = dot(n, normalize(vec3(0.5, 0.75, 0.2))) * 0.5 + 0.5;
        float up = n.y * 0.5 + 0.5;
        float l = smoothstep(0.2, 0.95, sun * 0.55 + up * 0.35 + clamp(vH, -0.2, 0.9) * 0.35);
        vec3 col = mix(shade, mix(warm, lit, up), l);
        float rim = pow(1.0 - max(dot(n, v), 0.0), 2.5);
        col += vec3(1.0, 0.97, 0.9) * rim * 0.4 * smoothstep(-0.1, 0.6, n.y + 0.3);
        float d = length(vW - camPos);
        col = mix(col, haze, smoothstep(30.0, 190.0, d) * 0.85);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

/** Radial god-ray fan for the sun corner (additive, slowly turning). */
export function raysTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d')!;
  x.translate(256, 256);
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + rnd() * 0.2,
      w = 0.025 + rnd() * 0.06,
      len = 160 + rnd() * 96;
    const g = x.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
    const s = 0.18 + rnd() * 0.3;
    g.addColorStop(0, `rgba(255,246,220,${s})`);
    g.addColorStop(0.5, `rgba(255,236,200,${s * 0.35})`);
    g.addColorStop(1, 'rgba(255,236,200,0)');
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(0, 0);
    x.arc(0, 0, len, a - w, a + w);
    x.closePath();
    x.fill();
  }
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

/** Saturated gradient sky with a warm sun glow and high wispy clouds. */
export function skyDome() {
  const mat = new T.ShaderMaterial({
    side: T.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      zenith: { value: new T.Color(SKY.zenith) },
      mid: { value: new T.Color(SKY.mid) },
      horizon: { value: new T.Color(SKY.horizon) },
      below: { value: new T.Color(SKY.below) },
      sunDir: { value: SKY.sunDir },
      time: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 zenith, mid, horizon, below, sunDir;
      uniform float time;
      varying vec3 vDir;
      ${NOISE}
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.2, h));
        col = mix(col, zenith, smoothstep(0.16, 0.7, h));
        col = mix(col, below, smoothstep(0.0, -0.18, h));
        float s = max(dot(d, sunDir), 0.0);
        col += vec3(1.0, 0.86, 0.6) * (pow(s, 5.0) * 0.3 + pow(s, 40.0) * 0.6);
        col = mix(col, vec3(1.0, 0.99, 0.93), smoothstep(0.9972, 0.9986, s));
        if (h > 0.0) {
          vec2 uv = d.xz / (h + 0.12);
          float c = fbm(uv * 1.1 + vec2(time * 0.012, 0.0));
          float m = smoothstep(0.5, 0.82, c) * smoothstep(0.02, 0.18, h) * (1.0 - smoothstep(0.45, 0.85, h));
          col = mix(col, vec3(1.0), m * 0.8);
        }
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const dome = new T.Mesh(new T.SphereGeometry(300, 40, 20), mat);
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  dome.matrixAutoUpdate = false;
  dome.onBeforeRender = (_r, _s, camera) =>
    dome.matrixWorld.makeTranslation(camera.position);
  return { dome, mat };
}

/** Endless cloud floor far below the course. Follows the camera. */
export function cloudSea(y: number) {
  const mat = new T.ShaderMaterial({
    fog: false,
    uniforms: {
      time: { value: 0 },
      camPos: { value: new T.Vector3() },
      horizon: { value: new T.Color(SKY.horizon) },
      shadow: { value: new T.Color('#79a3e2') },
      lit: { value: new T.Color('#ffffff') },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float time;
      uniform vec3 camPos, horizon, shadow, lit;
      varying vec3 vWorld;
      ${NOISE}
      void main() {
        vec2 p = vWorld.xz * 0.05 + vec2(time * 0.02, time * 0.008);
        float c = fbm(p);
        float dens = smoothstep(0.42, 0.72, c);
        float l = fbm(p + vec2(0.06, -0.08));
        float shade = clamp(0.62 + (c - l) * 5.0, 0.0, 1.0);
        vec3 col = mix(shadow, lit, dens * (0.55 + 0.45 * shade));
        float dist = length(vWorld.xz - camPos.xz);
        col = mix(col, horizon, smoothstep(30.0, 220.0, dist));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const g = new T.PlaneGeometry(700, 700, 1, 1);
  g.rotateX(-Math.PI / 2);
  const mesh = new T.Mesh(g, mat);
  mesh.position.y = y;
  mesh.renderOrder = -5;
  mesh.frustumCulled = false;
  return { mesh, mat };
}

/** CPU-driven point particles: soft dust puffs or additive star sparkles. */
export class Particles {
  points: T.Points;
  private pos: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private alpha: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private base: Float32Array;
  private next = 0;
  mat: T.ShaderMaterial;
  constructor(
    private max: number,
    sparkle: boolean,
    private gravity = 0,
    private drag = 1.6,
  ) {
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.base = new Float32Array(max);
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(this.pos, 3));
    g.setAttribute('pcolor', new T.BufferAttribute(this.col, 3));
    g.setAttribute('psize', new T.BufferAttribute(this.size, 1));
    g.setAttribute('palpha', new T.BufferAttribute(this.alpha, 1));
    this.mat = new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: T.NormalBlending,
      uniforms: { scale: { value: 400 } },
      vertexShader: /* glsl */ `
        attribute vec3 pcolor;
        attribute float psize;
        attribute float palpha;
        uniform float scale;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = pcolor;
          vAlpha = palpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = psize * scale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec2 p = gl_PointCoord - 0.5;
          float d = length(p);
          ${
            sparkle
              ? `float core = smoothstep(0.5, 0.0, d);
                 float cross = max(0.0, 1.0 - abs(p.x) * 16.0) * max(0.0, 1.0 - abs(p.y) * 2.0)
                             + max(0.0, 1.0 - abs(p.y) * 16.0) * max(0.0, 1.0 - abs(p.x) * 2.0);
                 float a = min(1.0, core * core * 1.6 + cross) * vAlpha;`
              : `float a = smoothstep(0.5, 0.3, d) * vAlpha;
                 vec3 shade = vColor * (1.0 - 0.25 * smoothstep(0.0, 0.5, p.y + 0.2));`
          }
          if (a < 0.01) discard;
          gl_FragColor = vec4(${sparkle ? 'mix(vColor, vec3(1.0), core * core * 0.6)' : 'shade'}, a);
          #include <colorspace_fragment>
        }`,
    });
    this.points = new T.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }
  spawn(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    color: T.Color,
    size: number,
    life: number,
  ) {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.col.set([color.r, color.g, color.b], i * 3);
    this.base[i] = size;
    this.life[i] = life;
    this.maxLife[i] = life;
  }
  update(dt: number) {
    const k = Math.exp(-this.drag * dt);
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      const t = 1 - Math.max(0, this.life[i]) / this.maxLife[i];
      this.vel[i * 3 + 1] -= this.gravity * dt;
      for (let a = 0; a < 3; a++) {
        this.vel[i * 3 + a] *= k;
        this.pos[i * 3 + a] += this.vel[i * 3 + a] * dt;
      }
      this.alpha[i] = Math.min(1, t * 8) * (1 - t);
      this.size[i] = this.base[i] * (0.6 + t * 0.9);
    }
    const g = this.points.geometry;
    for (const name of ['position', 'pcolor', 'psize', 'palpha'])
      g.getAttribute(name).needsUpdate = true;
  }
}

/** Faint wind streaks rushing past the camera to sell height and speed. */
export class Wind {
  lines: T.LineSegments;
  private seeds: number[][] = [];
  constructor(private count = 26) {
    const pos = new Float32Array(count * 6),
      col = new Float32Array(count * 6);
    for (let i = 0; i < count; i++) {
      col.set([0.55, 0.62, 0.7, 0, 0, 0], i * 6);
      this.seeds.push([
        Math.sin(i * 12.9) * 0.5 + 0.5,
        Math.sin(i * 7.3) * 0.5 + 0.5,
        Math.sin(i * 3.1) * 0.5 + 0.5,
      ]);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.setAttribute('color', new T.BufferAttribute(col, 3));
    this.lines = new T.LineSegments(
      g,
      new T.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        blending: T.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    this.lines.frustumCulled = false;
  }
  update(t: number, cam: T.Vector3) {
    const pos = this.lines.geometry.getAttribute('position') as T.BufferAttribute;
    for (let i = 0; i < this.count; i++) {
      const [a, b, c] = this.seeds[i];
      const span = 36,
        z = cam.z - 30 + ((c * span + t * (14 + a * 10)) % span),
        x = cam.x + (a - 0.5) * 30,
        y = cam.y - 4 + b * 9,
        len = 1.6 + a * 2.4;
      pos.setXYZ(i * 2, x, y, z);
      pos.setXYZ(i * 2 + 1, x, y, z - len);
    }
    pos.needsUpdate = true;
  }
}

/** A small flock of white birds gliding in loose circles. */
export class Birds {
  mesh: T.InstancedMesh;
  private dummy = new T.Object3D();
  constructor(
    private flock: { x: number; y: number; z: number; r: number; s: number }[],
  ) {
    const g = new T.BufferGeometry();
    g.setAttribute(
      'position',
      new T.BufferAttribute(
        new Float32Array([0, 0, 0.18, 0.75, 0, -0.05, 0, 0, -0.22]),
        3,
      ),
    );
    g.computeVertexNormals();
    this.mesh = new T.InstancedMesh(
      g,
      new T.MeshStandardMaterial({
        color: '#fbf7ee',
        side: T.DoubleSide,
        roughness: 0.9,
        emissive: '#6f7f99',
        emissiveIntensity: 0.25,
      }),
      flock.length * 2,
    );
    this.mesh.frustumCulled = false;
  }
  update(t: number) {
    this.flock.forEach((b, i) => {
      const a = t * b.s + i * 1.7,
        x = b.x + Math.cos(a) * b.r,
        z = b.z + Math.sin(a) * b.r,
        y = b.y + Math.sin(t * 0.7 + i) * 0.6,
        flap = Math.sin(t * 9 + i * 2) * 0.55;
      for (const side of [0, 1]) {
        const d = this.dummy;
        d.position.set(x, y, z);
        d.rotation.set(0, -a + (b.s > 0 ? Math.PI : 0), 0);
        d.rotateZ(side ? Math.PI - flap : flap);
        d.scale.setScalar(1.3);
        d.updateMatrix();
        this.mesh.setMatrixAt(i * 2 + side, d.matrix);
      }
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
