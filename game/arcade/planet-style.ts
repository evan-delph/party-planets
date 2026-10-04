import * as T from 'three';
import { getBoard } from '../boards';
import { surfaceTexture } from '../Surfaces';

export function planetStyle(
  scene: T.Scene,
  renderer: T.WebGLRenderer,
  boardId = 'crown',
) {
  const board = getBoard(boardId),
    grain = surfaceTexture(board.terrain),
    done = new WeakSet<T.Material>();
  grain.repeat.set(3, 3);
  const stars = new T.Group();
  scene.add(stars);
  if (board.planet !== 'earth') {
    const pos = new Float32Array(240 * 3);
    for (let i = 0; i < 240; i++) {
      const a = i * 2.4,
        y = 0.15 + (i % 37) / 37,
        r = 85;
      pos.set([Math.sin(a) * r, y * 65, Math.cos(a) * r], i * 3);
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    stars.add(
      new T.Points(geo, new T.PointsMaterial({ color: '#e4eafa', size: 0.16 })),
    );
    scene.add(new T.HemisphereLight(board.accent, board.water, 0.65));
  }
  let styled = false;
  return {
    draw() {
      renderer.setClearColor(board.sky);
      if (scene.fog instanceof T.Fog) scene.fog.color.set(board.sky);
      if (styled) return;
      styled = true;
      scene.traverse((o) => {
        if (!(o instanceof T.Mesh)) return;
        let ancestor: T.Object3D | null = o;
        while (ancestor) {
          if (ancestor.userData.rig || ancestor.userData.gameColor) return;
          ancestor = ancestor.parent;
        }
        for (const material of Array.isArray(o.material)
          ? o.material
          : [o.material]) {
          if (
            !(material instanceof T.MeshStandardMaterial) ||
            done.has(material)
          )
            continue;
          done.add(material);
          if (!material.map) {
            material.bumpMap = grain;
            material.bumpScale = 0.045;
          }
          if (board.planet !== 'earth' && material.emissiveIntensity < 0.5) {
            material.color.lerp(new T.Color(board.ground), 0.34);
            material.roughness = Math.max(0.4, material.roughness);
          }
          material.needsUpdate = true;
        }
      });
    },
  };
}
