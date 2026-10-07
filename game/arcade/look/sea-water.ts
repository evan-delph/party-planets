import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Water surface height for the Bumper Buns sea arena. */
export const SEA_LEVEL = -2.3;

export const SEA_PALETTE = {
  deep: '#05286a',
  mid: '#0a57c2',
  shallow: '#1fd3c4',
  sky: '#4a9cf0',
  zenith: '#1663d4',
  horizon: '#d6ecff',
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
      // Long, slow swell: height in x, slope in yz.
      void swell(inout vec3 r, vec2 p, vec2 d, float f, float a, float s) {
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
        float far = smoothstep(18.0, 180.0, camDist);
        float nearK = 1.0 - far;
        vec3 w = vec3(0.0);
        swell(w, p, vec2(1.0, 0.3), 0.15, 0.62, 0.7);
        swell(w, p, vec2(-0.5, 1.0), 0.22, 0.38, 0.9);
        swell(w, p, vec2(0.3, -1.0), 0.36, 0.2, 1.25);
        swell(w, p, vec2(-1.0, -0.25), 0.58, 0.08, 1.7);
        vec3 wa = wv(p * 0.021 + uTime * vec2(0.006, 0.003));
        vec3 wb = wv(p * 0.058 + uTime * vec2(-0.008, 0.011));
        vec3 wc = wv(p * 0.15 + uTime * vec2(0.014, -0.012));
        vec2 grad = w.yz * (1.0 - far * 0.5)
                  + wa.xy * 0.2 + wb.xy * 0.11 * (1.0 - far * 0.6) + wc.xy * 0.05 * nearK;
        vec3 N = normalize(vec3(-grad.x, 1.0, -grad.y));
        vec3 V = normalize(cameraPosition - vWorld);
        vec3 L = normalize(uSun);

        // Distance to the nearest island shoreline.
        float d = 1e4;
        for (int i = 0; i < 8; i++) {
          if (uIslands[i].z > 0.0) d = min(d, length(p - uIslands[i].xy) - uIslands[i].z);
        }
        float dd = max(d, 0.0);
        float shallow = exp(-dd * 0.42);
        // Depth falloff: teal shallows, saturated mid blue, navy toward the horizon.
        float patchy = noise(p * 0.028 + uTime * 0.007) * 0.6 + wa.z * 0.4;
        vec3 water = mix(uMid, uDeep, clamp(far * 1.15 + (patchy - 0.5) * 0.55 + 0.08, 0.0, 1.0));
        water = mix(water, uShallow, shallow * 0.88);
        // Sun shining through the swell crests.
        float crest = clamp(w.x * 0.9 + (wb.z - 0.5) * 0.7 + 0.15, 0.0, 1.0);
        water += vec3(0.02, 0.26, 0.3) * crest * crest * nearK;
        // Troughs and the far sides of waves are darker.
        water *= 0.82 + 0.3 * clamp(dot(N, normalize(vec3(L.x, 1.4, L.z))), 0.0, 1.0);
        // Shallow-water caustics.
        float c = wb.z + wc.z;
        float caustic = pow(1.0 - abs(c - 1.0), 8.0);
        water += vec3(0.7, 1.0, 0.92) * caustic * shallow * 0.4;

        float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        vec3 R = reflect(-V, N);
        R.y = abs(R.y);
        vec3 sky = mix(uHorizon, uSky, smoothstep(0.0, 0.32, R.y));
        vec3 col = mix(water, sky, clamp(fres * 0.75, 0.0, 1.0));
        // Sun glint: a hot core, a broad sheen and a glitter path toward the viewer.
        float sd = max(dot(R, L), 0.0);
        vec3 sunCol = vec3(1.0, 0.95, 0.82);
        col += sunCol * (pow(sd, 900.0) * 10.0 + pow(sd, 90.0) * 0.7 + pow(sd, 10.0) * 0.07);
        float glit = noise(p * 3.1 + uTime * vec2(0.7, -0.45)) * noise(p * 4.7 - uTime * vec2(0.35, 0.6));
        col += sunCol * smoothstep(0.42, 0.56, glit) * pow(sd, 60.0) * 3.0;

        // Whitecaps scattered over open water.
        float capN = noise(p * 0.8 + vec2(uTime * 0.18, uTime * 0.09));
        float caps = smoothstep(0.9, 0.98, wb.z * 0.5 + capN * 0.45 + w.x * 0.18)
                   * (1.0 - far * 0.6) * (1.0 - shallow * 0.5);
        // Foam: a broken band hugging each shore, rings pulsing outward, lace behind.
        float fn = noise(p * 2.2 + vec2(uTime * 0.4, -uTime * 0.3));
        float fn2 = wv(p * 0.5 - uTime * 0.04).z;
        float edge = 1.0 - smoothstep(0.0, 0.4 + fn * 0.75, d);
        float rings = smoothstep(0.6, 0.95, sin(d * 2.2 - uTime * 1.8 + fn * 2.2))
                    * exp(-dd * 0.5) * smoothstep(0.3, 0.7, fn2);
        float lace = smoothstep(0.55, 0.8, noise(p * 1.3 + uTime * 0.08) * 0.6 + fn2 * 0.4)
                   * exp(-dd * 0.6);
        float foam = clamp(edge + rings * 0.55 + lace * 0.2 + caps * 0.6, 0.0, 1.0);
        vec3 foamCol = mix(vec3(0.78, 0.9, 0.96), vec3(1.0), clamp(N.y * 2.0 - 1.0 + crest * 0.5, 0.0, 1.0));
        col = mix(col, foamCol, foam);

        col = mix(col, uHorizon, smoothstep(uFogNear, uFogFar, camDist) * 0.85);
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
          vec3 c = mix(uHorizon, uZenith, pow(h, 0.5));
          // Late-morning warmth: a creamy band on the horizon toward the sun.
          float s = max(dot(vDir, normalize(uSun)), 0.0);
          c = mix(c, vec3(1.0, 0.94, 0.82), pow(s, 4.0) * 0.45 * (1.0 - smoothstep(0.0, 0.35, h)));
          c += vec3(1.0, 0.9, 0.7) * (pow(s, 24.0) * 0.3 + pow(s, 400.0) * 1.6);
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

/** Big towering cumulus banks on the horizon, merged into one shaded mesh. */
export function createClouds(seed = 7, sun = new T.Vector3(-0.5, 0.5, -0.7)) {
  const r = rand(seed);
  const parts: T.BufferGeometry[] = [];
  const puff = new T.SphereGeometry(1, 18, 12);
  // Flatten the bottom of each puff so banks sit on a level base.
  const fp = puff.attributes.position as T.BufferAttribute;
  for (let k = 0; k < fp.count; k++)
    if (fp.getY(k) < -0.3) fp.setY(k, -0.3 - (fp.getY(k) + 0.3) * 0.3);
  puff.computeVertexNormals();
  const banks: [number, number, number, number][] = [
    // angle (radians from -z), distance, scale, height
    [-0.95, 360, 34, 6],
    [-0.62, 430, 30, 4],
    [-0.3, 390, 26, 8],
    [0.05, 470, 32, 2],
    [0.36, 400, 38, 6],
    [0.7, 370, 28, 8],
    [1.05, 340, 30, 4],
    [-1.3, 320, 26, 2],
    [1.4, 330, 24, 3],
  ];
  const add = (x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
    const g = puff.clone();
    g.scale(sx, sy, sz);
    g.translate(x, y, z);
    parts.push(g);
  };
  for (const [a, dist, s, h] of banks) {
    const cx = Math.sin(a) * dist,
      cz = -Math.cos(a) * dist;
    const count = 8 + Math.floor(r() * 4);
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1) - 0.5;
      const tall = 1 - Math.abs(t) * 1.7;
      const size = s * (0.4 + tall * 0.5 + r() * 0.18);
      const along = t * s * 4.4;
      const x = cx + Math.cos(a) * along + (r() - 0.5) * s,
        z = cz + Math.sin(a) * along + (r() - 0.5) * s * 0.6;
      const y = h + size * 0.3 + tall * s * 0.6;
      add(x, y, z, size * (1.1 + r() * 0.3), size * (0.8 + r() * 0.2), size * 0.8);
      // Cauliflower billows on the upper surface.
      const billows = 2 + Math.floor(r() * 3);
      for (let k = 0; k < billows; k++) {
        const bs = size * (0.35 + r() * 0.25);
        const ba = r() * Math.PI - Math.PI / 2;
        add(
          x + Math.cos(a) * Math.sin(ba) * size * 0.7,
          y + size * (0.35 + r() * 0.35),
          z + Math.sin(a) * Math.sin(ba) * size * 0.7 + size * 0.15,
          bs * 1.1,
          bs,
          bs,
        );
      }
    }
  }
  const merged = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  puff.dispose();
  const mesh = new T.Mesh(
    merged,
    new T.ShaderMaterial({
      fog: false,
      uniforms: {
        uSun: { value: sun.clone().normalize() },
        uHorizon: { value: new T.Color(SEA_PALETTE.horizon) },
        uBase: { value: SEA_LEVEL },
      },
      vertexShader: /* glsl */ `
        varying vec3 vN;
        varying vec3 vP;
        void main() {
          vN = normalize(mat3(modelMatrix) * normal);
          vec4 w = modelMatrix * vec4(position, 1.0);
          vP = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uSun, uHorizon;
        uniform float uBase;
        varying vec3 vN;
        varying vec3 vP;
        void main() {
          vec3 N = normalize(vN);
          vec3 V = normalize(cameraPosition - vP);
          float up = N.y * 0.5 + 0.5;
          // Sunlit tops, cool blue-grey bellies, warm light on the sun side.
          vec3 c = mix(vec3(0.6, 0.7, 0.86), vec3(1.0, 0.995, 0.98), smoothstep(0.2, 0.85, up));
          c += vec3(1.0, 0.9, 0.74) * pow(max(dot(N, normalize(uSun)), 0.0), 1.5) * 0.18;
          // Silver lining on the silhouettes.
          c += vec3(1.0) * pow(1.0 - abs(dot(N, V)), 3.0) * 0.22;
          // Haze: the base of each bank melts into the horizon.
          c = mix(uHorizon, c, smoothstep(0.0, 34.0, vP.y - uBase) * 0.75 + 0.25);
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  mesh.name = 'Sea clouds';
  return mesh;
}
