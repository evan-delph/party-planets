/**
 * Rendered character portraits for the HUD. Each crew member's real 3D alien
 * (the same Blender model and Character Studio options the board uses) is
 * rendered once, head-and-shoulders, into a small transparent PNG with studio
 * lighting. The HUD shows these instead of a generic vector head, so every
 * player card reads as that player's character at a glance.
 *
 * One shared offscreen renderer works through a queue and is released after a
 * few idle seconds, so it never holds a WebGL context during play.
 */
import * as T from 'three';
import type { Avatar } from './config';
import { animateAvatar, makeAvatar, preloadAlien } from './avatar';

const SIZE = 256;
type Stage = {
  renderer: T.WebGLRenderer;
  scene: T.Scene;
  camera: T.PerspectiveCamera;
};
let stage: Stage | undefined;
let idle: ReturnType<typeof setTimeout> | undefined;
let queue: Promise<unknown> = Promise.resolve();

function openStage(): Stage {
  if (stage) return stage;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const renderer = new T.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(SIZE, SIZE, false);
  renderer.setClearColor(0x000000, 0);
  // Neutral keeps the alien green and shirt colours saturated.
  renderer.toneMapping = T.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  const scene = new T.Scene();
  // Warm key from upper camera-left, cool rim from behind, soft sky fill and
  // a frontal fill for the eyes. No environment map: it is the slowest part
  // to build on software WebGL and the eyes carry their own glints.
  scene.add(new T.HemisphereLight('#e8f6ff', '#6d8f4a', 1.05));
  const fill = new T.DirectionalLight('#ffffff', 0.7);
  fill.position.set(0.5, 1.2, 4);
  scene.add(fill);
  const key = new T.DirectionalLight('#fff0d8', 2.8);
  key.position.set(-1.6, 3.2, 3.4);
  scene.add(key);
  const rim = new T.DirectionalLight('#a8ecff', 2.6);
  rim.position.set(2.4, 2.6, -2.6);
  scene.add(rim);
  const camera = new T.PerspectiveCamera(22, 1, 0.1, 40);
  stage = { renderer, scene, camera };
  return stage;
}

function closeStageSoon() {
  clearTimeout(idle);
  idle = setTimeout(() => {
    if (!stage) return;
    stage.renderer.dispose();
    stage.renderer.forceContextLoss();
    stage = undefined;
  }, 4000);
}

async function draw(avatar: Avatar): Promise<string> {
  await preloadAlien().catch(() => {});
  const { renderer, scene, camera } = openStage();
  const g = makeAvatar(avatar);
  // A slight three-quarter turn reads as a character, not a mugshot.
  g.rotation.y = -0.25;
  animateAvatar(g, 1, 0, 'neutral', true);
  scene.add(g);
  g.updateMatrixWorld(true);
  // Frame head and shoulders around the eyes, so hats, hair and accessories
  // never shift the crop. Falls back to the figure's bounds without a rig.
  const eyes = (g.userData.rig as { eyes?: T.Object3D[] } | undefined)?.eyes;
  let centerY: number, height: number;
  if (eyes?.length) {
    const p = new T.Vector3();
    centerY =
      eyes.reduce((y, eye) => y + eye.getWorldPosition(p).y, 0) / eyes.length -
      0.01 * avatar.height;
    height = 2.45 * avatar.height;
  } else {
    const box = new T.Box3().setFromObject(g);
    height = box.max.y - box.min.y;
    centerY = box.max.y - height * 0.31;
  }
  const span = height * 0.8;
  const dist = span / 2 / Math.tan(T.MathUtils.degToRad(camera.fov / 2));
  camera.position.set(0.15 * height, centerY + height * 0.05, dist);
  camera.lookAt(0.03 * height, centerY, 0);
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  // Geometry is shared with the board's aliens, so it is not disposed here;
  // this renderer's GPU copies go when the stage closes.
  scene.remove(g);
  return url;
}

/** Render a portrait (queued; one at a time on a shared offscreen renderer). */
export function renderPortrait(avatar: Avatar): Promise<string> {
  const job = queue.then(() => draw(avatar));
  queue = job.catch(() => {}).finally(closeStageSoon);
  return job;
}
