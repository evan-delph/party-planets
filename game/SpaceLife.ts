import * as T from 'three';
import { makeUfo, animateUfo } from './Ufo';
import { makeAvatar } from './avatar';
import { DEFAULT_AVATAR } from './config';

export function createSpaceLife(parent: T.Object3D) {
  const root = new T.Group();
  parent.add(root);
  const rocks: T.Mesh[] = [];
  const geometry = new T.IcosahedronGeometry(1, 0);
  const material = new T.MeshStandardMaterial({
    color: '#98a2ba',
    roughness: 1,
    flatShading: true,
  });
  for (let i = 0; i < 46; i++) {
    const rock = new T.Mesh(geometry, material);
    rock.scale.set(3 + (i % 7), 2 + (i % 5), 3 + (i % 4));
    root.add(rock);
    rocks.push(rock);
  }
  const ufo = makeUfo();
  ufo.scale.setScalar(8);
  root.add(ufo);
  const dude = makeAvatar({
    ...DEFAULT_AVATAR,
    name: 'Space drifter',
    accessory: 3,
    shirt: '#ffbd59',
  });
  dude.scale.setScalar(12);
  root.add(dude);
  root.traverse((obj) => {
    obj.castShadow = false;
    obj.receiveShadow = false;
  });
  return {
    root,
    draw(time: number, reduced = false) {
      const t = reduced ? 0 : time;
      rocks.forEach((rock, i) => {
        const a = i * 2.39996 + t * (0.012 + (i % 4) * 0.002),
          radius = 620 + (i % 11) * 32;
        rock.position.set(
          Math.cos(a) * radius,
          35 + Math.sin(i * 4.2 + t * 0.06) * 115,
          Math.sin(a) * radius,
        );
        rock.rotation.set(t * 0.1 + i, t * 0.07 - i, i * 0.4);
      });
      // One eight-second flyby at the start of each thirty-second cycle.
      const pass = t % 30;
      ufo.visible = !reduced && pass < 8;
      ufo.position.set(
        -1050 + pass * 260,
        155 + Math.sin(pass * 0.7) * 35,
        160 - pass * 25,
      );
      ufo.rotation.z = Math.sin(pass) * 0.07;
      animateUfo(ufo, t, 0, reduced);
      dude.position.set(
        Math.sin(t * 0.028 + 0.6) * 760,
        95 + Math.sin(t * 0.07) * 85,
        400 + Math.cos(t * 0.025) * 130,
      );
      dude.rotation.set(t * 0.15, t * 0.11, t * 0.19 + 0.7);
    },
  };
}

export function createBoardSky(parent: T.Object3D, earth: boolean) {
  const root = new T.Group();
  parent.add(root);
  const disk = new T.Mesh(
    new T.SphereGeometry(24, 24, 16),
    new T.MeshBasicMaterial({
      color: '#ffe4a1',
      fog: false,
      toneMapped: false,
    }),
  );
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 128;
  const c = glowCanvas.getContext('2d')!,
    g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, '#ffecb3aa');
  g.addColorStop(0.3, '#ffcb6655');
  g.addColorStop(1, '#ffc14d00');
  c.fillStyle = g;
  c.fillRect(0, 0, 128, 128);
  const corona = new T.Sprite(
    new T.SpriteMaterial({
      map: new T.CanvasTexture(glowCanvas),
      transparent: true,
      depthWrite: false,
      fog: false,
      toneMapped: false,
      blending: T.AdditiveBlending,
    }),
  );
  corona.scale.set(240, 240, 1);
  root.add(disk, corona);
  const asteroids: T.Mesh[] = [];
  if (!earth)
    for (let i = 0; i < 18; i++) {
      const rock = new T.Mesh(
        new T.IcosahedronGeometry(2 + (i % 4), 0),
        new T.MeshBasicMaterial({ color: '#a8b5d4', fog: false }),
      );
      root.add(rock);
      asteroids.push(rock);
    }
  return {
    root,
    draw(camera: T.Camera, time: number, brightness: number, reduced: boolean) {
      // A faraway sun follows the backdrop, never the board/player coordinates.
      const sunOffset = new T.Vector3(270, 270, -850).applyQuaternion(
        camera.quaternion,
      );
      disk.position.copy(camera.position).add(sunOffset);
      corona.position.copy(disk.position);
      disk.material.color.setRGB(
        0.7 + brightness * 2,
        0.56 + brightness * 1.3,
        0.3 + brightness * 0.6,
      );
      corona.material.opacity = brightness * 0.85;
      asteroids.forEach((rock, i) => {
        const t = reduced ? 0 : time;
        rock.position.set(
          ((i * 113 + t * 1.4) % 960) - 480,
          130 + (i % 4) * 34,
          -950,
        );
        rock.position.applyQuaternion(camera.quaternion).add(camera.position);
        rock.rotation.set(i + t * 0.03, i + t * 0.04, i);
      });
    },
  };
}
