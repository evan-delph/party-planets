import * as T from 'three';
import { assetUrl } from './assets';
import type { Field } from './BoardWorld';

/**
 * Splat-blended terrain: three scanned layers (sand, grass, rock) mixed per
 * pixel by vertex weights baked in Blender (art/blender/board.py → the Splat
 * color attribute, R sand · G grass · B rock). Built on MeshStandardMaterial so
 * lighting, shadows and fog stay standard; only the texture fetches change.
 * Textures: public/textures/terrain/<board>/<layer>-{color,normal,arm}.webp.
 *
 * Optional extras: a calm painterly turf tint over the scanned grass, and
 * contact shading from the baked field (darker beside the raised roads and in
 * hollows, so the route and props sit into the ground).
 */
const LAYERS = ['sand', 'grass', 'rock'] as const;

export type TerrainExtras = {
  field?: Field;
  turf?: { color: string; calm: number };
  /** Flat stand-in colours shown (and faded out) while the scans download. */
  flats?: { sand: string; grass: string; rock: string };
};

export function createTerrainMaterial(boardId: string, geometry: T.BufferGeometry, extras: TerrainExtras = {}) {
  // Move the weights off `color` so three's vertex-color tinting stays off.
  const weights = geometry.getAttribute('color');
  if (weights) {
    geometry.setAttribute('splat', weights);
    geometry.deleteAttribute('color');
  }
  const loader = new T.TextureLoader();
  // Until every scan has arrived the shader shows flat colours and a flat
  // normal, so a slow download never shows black or mottled ground.
  const ready = { value: 0 };
  let pending = LAYERS.length * 3;
  const loaded = () => {
    if (--pending <= 0) ready.value = 1;
  };
  const load = (layer: string, kind: string, srgb: boolean) => {
    const tex = loader.load(assetUrl(`/textures/terrain/${boardId}/${layer}-${kind}.webp`), loaded, undefined, loaded);
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.colorSpace = srgb ? T.SRGBColorSpace : T.NoColorSpace;
    tex.anisotropy = 8;
    return tex;
  };
  const tex = Object.fromEntries(
    LAYERS.map((layer) => [
      layer,
      {
        color: load(layer, 'color', true),
        normal: load(layer, 'normal', false),
        arm: load(layer, 'arm', false),
      },
    ]),
  ) as Record<(typeof LAYERS)[number], { color: T.Texture; normal: T.Texture; arm: T.Texture }>;

  const material = new T.MeshStandardMaterial({
    map: tex.grass.color,
    normalMap: tex.grass.normal,
    normalScale: new T.Vector2(0.9, 0.9),
    roughness: 1,
  });
  material.name = 'TerrainSplat';
  const turf = extras.turf ?? { color: '#ffffff', calm: 0 };
  const field = extras.field;
  const flats = extras.flats ?? { sand: '#e2cfae', grass: turf.calm ? turf.color : '#7fae6a', rock: '#857a72' };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      tSandColor: { value: tex.sand.color },
      tRockColor: { value: tex.rock.color },
      tSandNormal: { value: tex.sand.normal },
      tRockNormal: { value: tex.rock.normal },
      tSandArm: { value: tex.sand.arm },
      tGrassArm: { value: tex.grass.arm },
      tRockArm: { value: tex.rock.arm },
      turfColor: { value: new T.Color(turf.color) },
      turfCalm: { value: turf.calm },
      tField: { value: field?.texture ?? null },
      fieldBox: { value: field?.box ?? new T.Vector4(0, 0, 1, -99) },
      useField: { value: field ? 1 : 0 },
      texReady: ready,
      flatSand: { value: new T.Color(flats.sand) },
      flatGrass: { value: new T.Color(flats.grass) },
      flatRock: { value: new T.Color(flats.rock) },
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 splat;\nvarying vec3 vSplat;\nvarying vec3 vTerrainWorld;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvSplat = splat;\nvTerrainWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
varying vec3 vSplat;
varying vec3 vTerrainWorld;
uniform sampler2D tSandColor, tRockColor, tSandNormal, tRockNormal, tSandArm, tGrassArm, tRockArm;
uniform vec3 turfColor;
uniform float turfCalm;
uniform sampler2D tField;
uniform vec4 fieldBox;
uniform float useField;
uniform float texReady;
uniform vec3 flatSand, flatGrass, flatRock;
vec3 splatWeights(vec4 sand, vec4 grass, vec4 rock) {
  // Height-aware blend: brighter (higher) texels win near boundaries.
  vec3 w = max(vSplat, 0.0);
  vec3 h = vec3(dot(sand.rgb, vec3(0.333)), dot(grass.rgb, vec3(0.333)), dot(rock.rgb, vec3(0.333)));
  w *= 0.35 + h;
  w = pow(w, vec3(3.0));
  return w / max(w.r + w.g + w.b, 1e-4);
}
vec4 fieldAt(vec2 p) { return texture2D(tField, clamp((p - fieldBox.xy) / fieldBox.z, 0.0, 1.0)); }`,
      )
      .replace(
        '#include <map_fragment>',
        /* glsl */ `vec2 rockUv = vMapUv * 0.7;
vec4 sandTexel = texture2D(tSandColor, vMapUv);
vec4 grassTexel = texture2D(map, vMapUv);
vec4 rockTexel = texture2D(tRockColor, rockUv);
sandTexel = mix(vec4(flatSand, 1.0), sandTexel, texReady);
grassTexel = mix(vec4(flatGrass * 1.15, 1.0), grassTexel, texReady);
rockTexel = mix(vec4(flatRock, 1.0), rockTexel, texReady);
if (turfCalm > 0.0) {
  // Painterly turf: keep the scan's light and shade, swap its busy colour for
  // one tint with broad, soft variation.
  float fine = dot(grassTexel.rgb, vec3(0.299, 0.587, 0.114));
  float broad = mix(0.5, dot(texture2D(map, vMapUv * 0.09 + 0.31).rgb, vec3(0.299, 0.587, 0.114)), texReady);
  vec3 painted = turfColor * (0.84 + (fine - 0.5) * 0.12 + (broad - 0.5) * 0.5);
  grassTexel.rgb = mix(grassTexel.rgb, painted, turfCalm);
}
vec3 splatW = splatWeights(sandTexel, grassTexel, rockTexel);
vec4 terrainTexel = sandTexel * splatW.r + grassTexel * splatW.g + rockTexel * splatW.b;
vec3 terrainArm = texture2D(tSandArm, vMapUv).rgb * splatW.r + texture2D(tGrassArm, vMapUv).rgb * splatW.g + texture2D(tRockArm, rockUv).rgb * splatW.b;
terrainArm = mix(vec3(1.0, 0.9, 0.0), terrainArm, texReady);
diffuseColor *= terrainTexel;
diffuseColor.rgb *= mix(1.0, terrainArm.r, 0.6 * (1.0 - splatW.g * turfCalm * 0.7));
if (useField > 0.5) {
  vec2 wp = vTerrainWorld.xz;
  vec4 here = fieldAt(wp);
  // Contact shadow hugging the road rims.
  float road = here.g;
  float contact = smoothstep(1.35, 1.75, road) * (1.0 - smoothstep(1.75, 3.0, road));
  // Hollows and cliff feet read darker than ridges.
  float around = (fieldAt(wp + vec2(1.6, 0.0)).r + fieldAt(wp - vec2(1.6, 0.0)).r
    + fieldAt(wp + vec2(0.0, 1.6)).r + fieldAt(wp - vec2(0.0, 1.6)).r) * 0.25;
  float cavity = clamp((around - vTerrainWorld.y) * 0.35, 0.0, 0.45);
  diffuseColor.rgb *= (1.0 - contact * 0.32) * (1.0 - cavity);
}`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        'float roughnessFactor = roughness * terrainArm.g;',
      )
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `vec3 mapN = (texture2D(tSandNormal, vMapUv).xyz * 2.0 - 1.0) * splatW.r
  + (texture2D(normalMap, vMapUv).xyz * 2.0 - 1.0) * splatW.g * vec3(1.0 - turfCalm * 0.55, 1.0 - turfCalm * 0.55, 1.0)
  + (texture2D(tRockNormal, rockUv).xyz * 2.0 - 1.0) * splatW.b;
mapN = mix(vec3(0.0, 0.0, 1.0), mapN, texReady);
mapN.xy *= normalScale;
normal = normalize(tbn * mapN);`,
      );
  };
  return material;
}
