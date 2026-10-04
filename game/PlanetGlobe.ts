import * as T from 'three';
import { assetUrl } from './assets';

/**
 * Cinematic menu planets built from Blender-baked maps
 * (art/blender/planets.py → public/textures/planets/<id>-<pass>.webp):
 * a lit surface with bump and roughness, a drifting cloud shell, an
 * atmosphere rim that glows toward the sun, and optional rings.
 */
type GlobeSpec = {
  fallback: string;
  atmosphere: string;
  /** Outer halo strength. */
  halo: number;
  bump: number;
  roughness: number;
  roughMap?: boolean;
  clouds?: { color: string; opacity: number; speed: number };
  glow?: number;
  rings?: { inner: number; outer: number; tilt: number; colors: string[] };
  spin: number;
};
export const GLOBES: Record<string, GlobeSpec> = {
  earth: {
    fallback: '#1b5f9e',
    atmosphere: '#6cc4ff',
    halo: 1.1,
    bump: 2.2,
    roughness: 0.7,
    roughMap: true,
    clouds: { color: '#ffffff', opacity: 0.8, speed: 0.012 },
    spin: 0.02,
  },
  selene: {
    fallback: '#8c93a3',
    atmosphere: '#b8c7ee',
    halo: 0.35,
    bump: 3.5,
    roughness: 0.95,
    spin: 0.012,
  },
  ignara: {
    fallback: '#3a2226',
    atmosphere: '#ff7a2e',
    halo: 1.0,
    bump: 2.6,
    roughness: 0.8,
    clouds: { color: '#3b2622', opacity: 0.7, speed: 0.02 },
    glow: 2.2,
    spin: 0.016,
  },
  verdara: {
    fallback: '#b9a6f0',
    atmosphere: '#ffc4ec',
    halo: 1.2,
    bump: 1.2,
    roughness: 0.65,
    clouds: { color: '#ffffff', opacity: 0.55, speed: -0.008 },
    rings: {
      inner: 1.38,
      outer: 2.15,
      tilt: 0.42,
      colors: ['#ff9fd6', '#6fd3e6', '#a58cf0', '#ffe2a8'],
    },
    spin: 0.024,
  },
};

const loader = new T.TextureLoader();
function load(id: string, pass: string, color = false) {
  const tex = loader.load(assetUrl(`/textures/planets/${id}-${pass}.webp`));
  tex.colorSpace = color ? T.SRGBColorSpace : T.NoColorSpace;
  tex.anisotropy = 8;
  return tex;
}

const atmosphereVertex = /* glsl */ `
  varying vec3 vNormalView;
  varying vec3 vNormalWorld;
  void main() {
    vNormalView = normalize(normalMatrix * normal);
    vNormalWorld = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const haloFragment = /* glsl */ `
  uniform vec3 color;
  uniform vec3 sunDir;
  uniform float strength;
  varying vec3 vNormalView;
  varying vec3 vNormalWorld;
  void main() {
    float rim = pow(clamp(0.78 - dot(vNormalView, vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 2.4);
    float lit = 0.25 + 0.75 * smoothstep(-0.45, 0.6, dot(vNormalWorld, sunDir));
    gl_FragColor = vec4(color * rim * lit * strength, 1.0);
  }
`;
const rimFragment = /* glsl */ `
  uniform vec3 color;
  uniform vec3 sunDir;
  uniform float strength;
  varying vec3 vNormalView;
  varying vec3 vNormalWorld;
  void main() {
    float rim = pow(1.0 - abs(dot(vNormalView, vec3(0.0, 0.0, 1.0))), 5.0);
    float lit = 0.2 + 0.8 * smoothstep(-0.3, 0.5, dot(vNormalWorld, sunDir));
    gl_FragColor = vec4(color * rim * lit * strength, 1.0);
  }
`;

function ringTexture(colors: string[]) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 4;
  const ctx = c.getContext('2d')!;
  for (let x = 0; x < 512; x++) {
    const t = x / 511;
    const band = Math.sin(t * 61) * 0.5 + Math.sin(t * 23 + 1.3) * 0.35 + Math.sin(t * 7) * 0.15;
    const gap = t > 0.58 && t < 0.63 ? 0.08 : 1;
    const edge = Math.min(1, t * 8, (1 - t) * 6);
    const alpha = Math.max(0, (0.45 + band * 0.35) * gap * edge);
    ctx.fillStyle = colors[Math.floor(t * colors.length * 2.999) % colors.length];
    ctx.globalAlpha = alpha;
    ctx.fillRect(x, 0, 1, 4);
  }
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}

export function createGlobe(id: string, radius: number, low = false) {
  const spec = GLOBES[id] ?? GLOBES.earth;
  const group = new T.Group();
  const detail = low ? 64 : 128;
  const surfaceMaterial = new T.MeshStandardMaterial({
    color: '#ffffff',
    map: load(id, 'color', true),
    bumpMap: load(id, 'height'),
    bumpScale: spec.bump,
    roughness: spec.roughness,
    metalness: 0,
  });
  if (spec.roughMap) surfaceMaterial.roughnessMap = load(id, 'rough');
  if (spec.glow) {
    surfaceMaterial.emissiveMap = load(id, 'glow', true);
    surfaceMaterial.emissive = new T.Color('#ffffff');
    surfaceMaterial.emissiveIntensity = spec.glow;
  }
  const surface = new T.Mesh(
    new T.SphereGeometry(radius, detail, detail / 2),
    surfaceMaterial,
  );
  group.add(surface);

  let clouds: T.Mesh | undefined;
  if (spec.clouds) {
    clouds = new T.Mesh(
      new T.SphereGeometry(radius * 1.014, detail, detail / 2),
      new T.MeshStandardMaterial({
        color: spec.clouds.color,
        alphaMap: load(id, 'clouds'),
        transparent: true,
        opacity: spec.clouds.opacity,
        depthWrite: false,
        roughness: 1,
      }),
    );
    group.add(clouds);
  }

  const uniforms = (strength: number) => ({
    color: { value: new T.Color(spec.atmosphere) },
    sunDir: { value: new T.Vector3(1, 0, 0) },
    strength: { value: strength },
  });
  const haloUniforms = uniforms(spec.halo * 0.8),
    rimUniforms = uniforms(spec.halo * 0.5);
  const halo = new T.Mesh(
    new T.SphereGeometry(radius * 1.1, 64, 32),
    new T.ShaderMaterial({
      uniforms: haloUniforms,
      vertexShader: atmosphereVertex,
      fragmentShader: haloFragment,
      side: T.BackSide,
      blending: T.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    }),
  );
  const rim = new T.Mesh(
    new T.SphereGeometry(radius * 1.02, 64, 32),
    new T.ShaderMaterial({
      uniforms: rimUniforms,
      vertexShader: atmosphereVertex,
      fragmentShader: rimFragment,
      blending: T.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    }),
  );
  group.add(halo, rim);

  if (spec.rings) {
    const r = spec.rings;
    const geometry = new T.RingGeometry(radius * r.inner, radius * r.outer, 160, 1);
    const pos = geometry.getAttribute('position'),
      uv = geometry.getAttribute('uv');
    for (let i = 0; i < pos.count; i++) {
      const d = Math.hypot(pos.getX(i), pos.getY(i));
      uv.setXY(i, (d / radius - r.inner) / (r.outer - r.inner), 0.5);
    }
    const ring = new T.Mesh(
      geometry,
      // Unlit: rings seen edge-on to the star would otherwise turn grey.
      new T.MeshBasicMaterial({
        map: ringTexture(r.colors),
        color: '#ffffff',
        transparent: true,
        side: T.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = Math.PI / 2 - r.tilt;
    ring.rotation.y = 0.3;
    group.add(ring);
  }

  const sunWorld = new T.Vector3(),
    center = new T.Vector3();
  return {
    group,
    /** Spin the surface and clouds; point the atmosphere glow at the star. */
    update(time: number, reduced: boolean, sun: T.Object3D) {
      surface.rotation.y = reduced ? 0 : time * spec.spin;
      if (clouds && spec.clouds)
        clouds.rotation.y = reduced ? 0 : time * (spec.spin + spec.clouds.speed);
      sun.getWorldPosition(sunWorld);
      group.getWorldPosition(center);
      const dir = sunWorld.sub(center).normalize();
      haloUniforms.sunDir.value.copy(dir);
      rimUniforms.sunDir.value.copy(dir);
    },
  };
}
