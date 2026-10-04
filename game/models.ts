import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { assetUrl, assetsEmbedded } from './assets';

/**
 * Shared loader for Blender-built models in public/models/. Geometry is
 * Draco-compressed (decoder in public/draco/); each URL loads once and is
 * cloned by callers. Rejections mean the model is unavailable and callers
 * keep their procedural fallback.
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
    if (assetsEmbedded()) {
      // The offline file carries the decoder inline; there is no /draco/ path.
      const embedded = draco as unknown as {
        _loadLibrary: (url: string, type: string) => Promise<string | ArrayBuffer>;
      };
      embedded._loadLibrary = async (url, type) => {
        const response = await fetch(assetUrl('/draco/' + url));
        return type === 'arraybuffer' ? response.arrayBuffer() : response.text();
      };
    }
    return new GLTFLoader().setDRACOLoader(draco);
  });
  return loader;
}

export function loadModel(url: string): Promise<GLTF> {
  let entry = cache.get(url);
  if (!entry) {
    entry = gltfLoader().then((l) => l.loadAsync(assetUrl(url)));
    cache.set(url, entry);
  }
  return entry;
}
