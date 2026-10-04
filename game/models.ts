import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Shared loader for Blender-built models in public/models/. Geometry is
 * Draco-compressed (decoder in public/draco/); each URL loads once and is
 * cloned by callers. Rejections mean the model is unavailable (for example in
 * the offline single-file build) and callers keep their procedural fallback.
 */
const cache = new Map<string, Promise<GLTF>>();
let loader: Promise<import('three/addons/loaders/GLTFLoader.js').GLTFLoader> | undefined;

function gltfLoader() {
  loader ??= Promise.all([
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/loaders/DRACOLoader.js'),
  ]).then(([{ GLTFLoader }, { DRACOLoader }]) => {
    const draco = new DRACOLoader();
    draco.setDecoderPath('/draco/');
    return new GLTFLoader().setDRACOLoader(draco);
  });
  return loader;
}

export function loadModel(url: string): Promise<GLTF> {
  let entry = cache.get(url);
  if (!entry) {
    entry = gltfLoader().then((l) => l.loadAsync(url));
    cache.set(url, entry);
  }
  return entry;
}
