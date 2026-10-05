import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Water surface height for the Bumper Buns sea arena. */
export const SEA_LEVEL = -2.3;

export const SEA_PALETTE = {
  deep: '#0b3f9c',
  mid: '#0a6ccb',
  shallow: '#2fe0d6',
  sky: '#2f8ff0',
  zenith: '#1a6fe0',
  horizon: '#cdeeff',
};

/**
 * Tileable 256² wave map built from integer-frequency sine waves: slope in
 * RG, height in B. Mipmapped, so distant water stays calm instead of noisy.
 */
function waveTexture(size = 256) {
  const r = rand(11);
  const terms = Array.from({ length: 22 }, (_, i) => {
    const spread = 1.5 + i * 0.55;
    let kx = Math.round((r() * 2 - 1) * spread),
      ky = Math.round((r() * 2 - 1) * spread);
    if (!kx && !ky) kx = 1 + (i % 3);
    return {
      kx,
      ky,
      amp: 1 / (1 + Math.hypot(kx, ky) * 0.55),
      ph: r() * Math.PI * 2,
    };
  });
  const n = size * size;
  const hs = new Float32Array(n),
    dxs = new Float32Array(n),
    dys = new Float32Array(n);
  let hMin = Infinity,
    hMax = -Infinity,
    sMax = 0;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = x / size,
        v = y / size;
      let h = 0,
        dx = 0,
        dy = 0;
      for (const t of terms) {
        const a = Math.PI * 2 * (t.kx * u + t.ky * v) + t.ph;
        const s = Math.sin(a);
        h += t.amp * s;
        const c = Math.cos(a) * t.amp * Math.PI * 2;
        dx += c * t.kx;
        dy += c * t.ky;
      }
      const i = y * size + x;
      hs[i] = h;
      dxs[i] = dx;
      dys[i] = dy;
      hMin = Math.min(hMin, h);
      hMax = Math.max(hMax, h);
      sMax = Math.max(sMax, Math.abs(dx), Math.abs(dy));
    }
  const data = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    data[i * 4] = Math.round((dxs[i] / sMax) * 127.5 + 127.5);
    data[i * 4 + 1] = Math.round((dys[i] / sMax) * 127.5 + 127.5);
    data[i * 4 + 2] = Math.round(((hs[i] - hMin) / (hMax - hMin)) * 255);
    data[i * 4 + 3] = 255;
  }
  const tex = new T.DataTexture(data, size, size, T.RGBAFormat);
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.magFilter = T.LinearFilter;
  tex.minFilter = T.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Stylised shaded ocean: layered directional waves and noise for normals,
 * Fresnel sky reflection, a hot sun glint, turquoise shallows that fall off to
 * deep blue, and animated foam rings around every island (up to 8 circles).
 */
export function createOcean(sun: T.Vector3) {
  const islands = Array.from({ length: 8 }, () => new T.Vector3(0, 0, -99));
  const uniforms = {
    uTime: { value: 0 },
    uSun: { value: sun.clone().normalize() },
    uDeep: { value: new T.Color(SEA_PALETTE.deep) },
    uMid: { value: new T.Color(SEA_PALETTE.mid) },
    uShallow: { value: new T.Color(SEA_PALETTE.shallow) },
    uSky: { value: new T.Color(SEA_PALETTE.sky) },
    uHorizon: { value: new T.Color(SEA_PALETTE.horizon) },
    uIslands: { value: islands },
    uFogNear: { value: 90 },
    uFogFar: { value: 520 },
    uWaves: { value: waveTexture() },
  };
  const material = new T.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uSun, uDeep, uMid, uShallow, uSky, uHorizon;
      uniform vec3 uIslands[8];
      uniform float uFogNear, uFogFar;
      uniform sampler2D uWaves;
      varying vec3 vWorld;
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
      void wave(inout vec3 r, vec2 p, vec2 d, float f, float a, float s) {
        float ph = dot(normalize(d), p) * f + uTime * s;
        r.x += a * sin(ph);
        r.yz += a * f * cos(ph) * normalize(d);
      }
      // Tileable wave normal map: rg = slope, b = height.
      vec3 wv(vec2 uv) {
        vec4 t = texture2D(uWaves, uv);
        return vec3(t.rg * 2.0 - 1.0, t.b);
      }
      void main() {
        vec2 p = vWorld.xz;
        float camDist = length(vWorld - cameraPosition);
        float far = smoothstep(25.0, 160.0, camDist);
        vec3 w = vec3(0.0);
        wave(w, p, vec2(1.0, 0.35), 0.42, 0.20, 1.25);
        wave(w, p, vec2(-0.6, 1.0), 0.61, 0.13, 1.55);
        wave(w, p, vec2(0.25, -1.0), 0.93, 0.08, 2.0);
        vec3 wa = wv(p * 0.035 + uTime * vec2(0.010, 0.005));
        vec3 wb = wv(p * 0.09 + uTime * vec2(-0.012, 0.016));
        vec3 wc = wv(p * 0.23 + uTime * vec2(0.022, -0.02));
        vec2 grad = w.yz * 1.1 * (1.0 - far * 0.75)
                  + (wa.xy * 0.42 + wb.xy * 0.3 + wc.xy * 0.18) * (1.0 - far * 0.55);
        vec3 N = normalize(vec3(-grad.x, 1.0, -grad.y));
        vec3 V = normalize(cameraPosition - vWorld);

        // Distance to the nearest island shoreline.
        float d = 1e4;
        for (int i = 0; i < 8; i++) {
          if (uIslands[i].z > 0.0) d = min(d, length(p - uIslands[i].xy) - uIslands[i].z);
        }
        float shallow = exp(-max(d, 0.0) * 0.32);
        // Broad patches of darker and lighter water (depth, cloud shadow).
        float patchy = noise(p * 0.045 + uTime * 0.01) * 0.65 + wa.z * 0.35;
        vec3 water = mix(uMid, uDeep, clamp(far * 0.9 + 0.1 + (patchy - 0.5) * 0.7, 0.0, 1.0));
        water = mix(water, uShallow, shallow * 0.9);
        // Light through the wave crests.
        water += uShallow * 0.22 * clamp(w.x * 2.2 + 0.2, 0.0, 1.0) * (1.0 - far);
        // Shallow-water caustics.
        float c = wb.z + wc.z;
        float caustic = pow(1.0 - abs(c - 1.0), 8.0);
        water += vec3(0.75, 1.0, 0.95) * caustic * shallow * 0.45;

        float fres = 0.03 + 0.97 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        vec3 R = reflect(-V, N);
        vec3 sky = mix(uHorizon, uSky, smoothstep(0.0, 0.45, R.y));
        vec3 col = mix(water, sky, clamp(fres * 0.85, 0.0, 1.0));
        float sd = max(dot(R, normalize(uSun)), 0.0);
        col += vec3(1.0, 0.94, 0.8) * (pow(sd, 380.0) * 7.0 + pow(sd, 40.0) * 0.35);
        // Sun-glint sparkles.
        float sp = wc.z * wb.z;
        col += vec3(1.0) * smoothstep(0.6, 0.8, sp) * (0.7 - far * 0.6) * (0.15 + sd * 2.0);

        // Foam: a broken band hugging each shore plus rings pulsing outward.
        float fn = noise(p * 2.4 + vec2(uTime * 0.45, -uTime * 0.3));
        float fn2 = wv(p * 0.6 - uTime * 0.05).z;
        float edge = 1.0 - smoothstep(0.05, 0.5 + fn * 0.8, d);
        float rings = smoothstep(0.55, 0.95, sin(d * 2.6 - uTime * 2.1 + fn * 2.5))
                    * exp(-max(d, 0.0) * 0.55) * smoothstep(0.35, 0.65, fn2);
        float caps = smoothstep(0.82, 0.95, wb.z * 0.7 + w.x * 1.1)
                   * (1.0 - far) * 0.7;
        float foam = clamp(edge + rings * 0.8 + caps * smoothstep(0.4, 0.7, fn2), 0.0, 1.0);
        col = mix(col, vec3(0.97, 1.0, 1.0), foam);

        col = mix(col, uHorizon, smoothstep(uFogNear, uFogFar, camDist));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new T.Mesh(new T.PlaneGeometry(1400, 1400, 1, 1), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = SEA_LEVEL;
  mesh.receiveShadow = false;
  mesh.name = 'Sea ocean';
  return {
    mesh,
    setIsland(i: number, x: number, z: number, r: number) {
      islands[i].set(x, z, r);
    },
    update(time: number) {
      uniforms.uTime.value = time;
    },
  };
}

/** Bright gradient sky dome with a soft sun halo, centred on the camera. */
export function createSky(sun: T.Vector3) {
  const dome = new T.Mesh(
    new T.SphereGeometry(600, 32, 16),
    new T.ShaderMaterial({
      side: T.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uZenith: { value: new T.Color(SEA_PALETTE.zenith) },
        uHorizon: { value: new T.Color(SEA_PALETTE.horizon) },
        uSun: { value: sun.clone().normalize() },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uZenith, uHorizon, uSun;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y, 0.0, 1.0);
          vec3 c = mix(uHorizon, uZenith, pow(h, 0.45));
          float s = max(dot(vDir, normalize(uSun)), 0.0);
          c += vec3(1.0, 0.9, 0.7) * (pow(s, 12.0) * 0.25 + pow(s, 300.0) * 1.5);
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  dome.matrixAutoUpdate = false;
  dome.onBeforeRender = (_r, _s, camera) =>
    dome.matrixWorld.makeTranslation(camera.position);
  dome.name = 'Sea sky';
  return dome;
}

function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Big fluffy cumulus banks sitting on the horizon, merged into one mesh. */
export function createClouds(seed = 7) {
  const r = rand(seed);
  const parts: T.BufferGeometry[] = [];
  const puff = new T.SphereGeometry(1, 20, 14);
  const banks: [number, number, number, number][] = [
    // angle (radians from -z), distance, scale, height
    [-0.95, 360, 34, 6],
    [-0.62, 420, 28, 4],
    [-0.28, 380, 24, 10],
    [0.05, 460, 30, 2],
    [0.36, 400, 36, 6],
    [0.7, 370, 26, 8],
    [1.05, 340, 30, 4],
    [-1.3, 320, 26, 2],
    [1.4, 330, 24, 3],
  ];
  for (const [a, dist, s, h] of banks) {
    const cx = Math.sin(a) * dist,
      cz = -Math.cos(a) * dist;
    const count = 9 + Math.floor(r() * 5);
    for (let i = 0; i < count; i++) {
      const g = puff.clone();
      const t = i / (count - 1) - 0.5;
      const size = s * (0.42 + (1 - Math.abs(t) * 1.6) * 0.5 + r() * 0.2);
      // Flatten the bottom of each puff so banks sit on a level base.
      const pos = g.attributes.position as T.BufferAttribute;
      for (let k = 0; k < pos.count; k++)
        if (pos.getY(k) < -0.35) pos.setY(k, -0.35 - (pos.getY(k) + 0.35) * 0.35);
      g.computeVertexNormals();
      g.scale(size * (1.1 + r() * 0.3), size * (0.85 + r() * 0.25), size * 0.8);
      const along = t * s * 4.2;
      g.translate(
        cx + Math.cos(a) * along + (r() - 0.5) * s,
        h + size * (0.25 + r() * 0.35) + (1 - Math.abs(t) * 2) * s * 0.55,
        cz + Math.sin(a) * along + (r() - 0.5) * s * 0.6,
      );
      parts.push(g);
    }
  }
  const merged = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  puff.dispose();
  const mesh = new T.Mesh(
    merged,
    new T.MeshLambertMaterial({
      color: '#ffffff',
      emissive: '#8ec4f2',
      emissiveIntensity: 0.55,
      fog: false,
    }),
  );
  mesh.name = 'Sea clouds';
  return mesh;
}
