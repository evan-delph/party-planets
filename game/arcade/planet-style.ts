import * as T from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { getBoard } from '../boards';
import { surfaceTexture } from '../Surfaces';

/** Zenith and horizon colors for each world's minigame sky. */
const SKIES: Record<string, [string, string]> = {
  earth: ['#4aa9e8', '#d4f2fb'],
  selene: ['#0a1230', '#46588c'],
  ignara: ['#1a0d22', '#7a3240'],
  verdara: ['#7f86d2', '#f6d3ea'],
};

/**
 * Shared minigame lighting: image-based reflections (so the Blender alien and
 * props read as glossy, painted or metallic like on the board) and, unless a
 * game keeps its own backdrop, a gradient sky dome for the board's world.
 */
export function stageLighting(
  scene: T.Scene,
  renderer: T.WebGLRenderer,
  boardId = 'crown',
  sky = true,
) {
  const pmrem = new T.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();
  if (!sky) return;
  const [top, horizon] = SKIES[getBoard(boardId).planet] ?? SKIES.earth;
  const dome = new T.Mesh(
    new T.SphereGeometry(170, 32, 16),
    new T.ShaderMaterial({
      side: T.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new T.Color(top) },
        horizon: { value: new T.Color(horizon) },
      },
      vertexShader: /* glsl */ `
        varying float vHeight;
        void main() {
          vHeight = normalize(position).y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 top;
        uniform vec3 horizon;
        varying float vHeight;
        void main() {
          gl_FragColor = vec4(mix(horizon, top, pow(clamp(vHeight, 0.0, 1.0), 0.6)), 1.0);
          #include <colorspace_fragment>
        }`,
    }),
  );
  dome.name = 'Sky dome';
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  // Centre the dome on the camera so long courses never run out of sky.
  dome.matrixAutoUpdate = false;
  dome.onBeforeRender = (_r, _s, camera) =>
    dome.matrixWorld.makeTranslation(camera.position);
  scene.add(dome);
  // Fog fades distant props into the horizon color rather than a flat tone.
  if (scene.fog instanceof T.Fog) scene.fog.color.set(horizon);
  return dome;
}

export function planetStyle(
  scene: T.Scene,
  renderer: T.WebGLRenderer,
  boardId = 'crown',
) {
  const dome = stageLighting(scene, renderer, boardId);
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
      if (scene.fog instanceof T.Fog && !dome) scene.fog.color.set(board.sky);
      if (styled) return;
      styled = true;
      scene.traverse((o) => {
        if (!(o instanceof T.Mesh) || o === dome) return;
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
