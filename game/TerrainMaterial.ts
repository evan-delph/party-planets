import * as T from 'three';

/**
 * Splat-blended terrain: three scanned layers (sand, grass, rock) mixed per
 * pixel by vertex weights baked in Blender (art/blender/board.py → the Splat
 * color attribute, R sand · G grass · B rock). Built on MeshStandardMaterial so
 * lighting, shadows and fog stay standard; only the texture fetches change.
 * Textures: public/textures/terrain/<board>/<layer>-{color,normal,arm}.webp.
 */
const LAYERS = ['sand', 'grass', 'rock'] as const;

export function createTerrainMaterial(boardId: string, geometry: T.BufferGeometry) {
  // Move the weights off `color` so three's vertex-color tinting stays off.
  const weights = geometry.getAttribute('color');
  if (weights) {
    geometry.setAttribute('splat', weights);
    geometry.deleteAttribute('color');
  }
  const loader = new T.TextureLoader();
  const load = (layer: string, kind: string, srgb: boolean) => {
    const tex = loader.load(`/textures/terrain/${boardId}/${layer}-${kind}.webp`);
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
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      tSandColor: { value: tex.sand.color },
      tRockColor: { value: tex.rock.color },
      tSandNormal: { value: tex.sand.normal },
      tRockNormal: { value: tex.rock.normal },
      tSandArm: { value: tex.sand.arm },
      tGrassArm: { value: tex.grass.arm },
      tRockArm: { value: tex.rock.arm },
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 splat;\nvarying vec3 vSplat;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSplat = splat;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
varying vec3 vSplat;
uniform sampler2D tSandColor, tRockColor, tSandNormal, tRockNormal, tSandArm, tGrassArm, tRockArm;
vec3 splatWeights(vec4 sand, vec4 grass, vec4 rock) {
  // Height-aware blend: brighter (higher) texels win near boundaries.
  vec3 w = max(vSplat, 0.0);
  vec3 h = vec3(dot(sand.rgb, vec3(0.333)), dot(grass.rgb, vec3(0.333)), dot(rock.rgb, vec3(0.333)));
  w *= 0.35 + h;
  w = pow(w, vec3(3.0));
  return w / max(w.r + w.g + w.b, 1e-4);
}`,
      )
      .replace(
        '#include <map_fragment>',
        /* glsl */ `vec2 rockUv = vMapUv * 0.7;
vec4 sandTexel = texture2D(tSandColor, vMapUv);
vec4 grassTexel = texture2D(map, vMapUv);
vec4 rockTexel = texture2D(tRockColor, rockUv);
vec3 splatW = splatWeights(sandTexel, grassTexel, rockTexel);
vec4 terrainTexel = sandTexel * splatW.r + grassTexel * splatW.g + rockTexel * splatW.b;
vec3 terrainArm = texture2D(tSandArm, vMapUv).rgb * splatW.r + texture2D(tGrassArm, vMapUv).rgb * splatW.g + texture2D(tRockArm, rockUv).rgb * splatW.b;
diffuseColor *= terrainTexel;
diffuseColor.rgb *= mix(1.0, terrainArm.r, 0.6);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        'float roughnessFactor = roughness * terrainArm.g;',
      )
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `vec3 mapN = (texture2D(tSandNormal, vMapUv).xyz * 2.0 - 1.0) * splatW.r
  + (texture2D(normalMap, vMapUv).xyz * 2.0 - 1.0) * splatW.g
  + (texture2D(tRockNormal, rockUv).xyz * 2.0 - 1.0) * splatW.b;
mapN.xy *= normalScale;
normal = normalize(tbn * mapN);`,
      );
  };
  return material;
}
