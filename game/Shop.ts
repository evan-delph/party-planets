import * as T from 'three';
import { WorldKit } from './visuals';

export function createShop(
  parent: T.Object3D,
  x: number,
  z: number,
  tileX: number,
  tileZ: number,
  accent: string,
  label = 'SHOP',
) {
  const group = new T.Group();
  group.name = 'Item shop';
  group.position.set(x, 0, z);
  group.rotation.y = Math.atan2(tileX - x, tileZ - z);
  parent.add(group);
  const kit = new WorldKit(group);
  kit.box(0, 0.75, 0, 2.5, 0.25, 2.1, '#d6dfdf');
  kit.box(0, 1.65, -0.35, 2.3, 1.6, 1.15, '#f8f9ee');
  kit.box(0, 1.6, 0.26, 1.85, 0.85, 0.05, '#183349');
  kit.box(0, 1.13, 0.82, 2.3, 0.68, 0.65, accent);
  kit.box(0, 1.52, 0.82, 2.55, 0.12, 0.85, '#faf5dd');
  for (let i = 0; i < 6; i++) {
    kit.box(
      (i - 2.5) * 0.44,
      2.59,
      0.2,
      0.44,
      0.17,
      2.35,
      i % 2 ? '#fff8ef' : accent,
    );
    kit.box(
      (i - 2.5) * 0.44,
      2.43,
      1.32,
      0.44,
      0.25,
      0.1,
      i % 2 ? '#fff8ef' : accent,
    );
  }
  for (const side of [-1, 1])
    kit.box(side * 1.15, 1.69, 1.1, 0.09, 1.8, 0.09, '#eaf3f5');
  for (let i = 0; i < 3; i++)
    kit.mesh(
      new T.OctahedronGeometry(0.17),
      ['#ffc658', '#8df3ca', '#aa9cff'][i],
      (i - 1) * 0.52,
      1.75,
      0.8,
    );
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#16354b';
  ctx.fillRect(0, 0, 256, 96);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 54px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 128, 50);
  const sign = new T.Mesh(
    new T.PlaneGeometry(2.1, 0.78),
    new T.MeshBasicMaterial({
      map: new T.CanvasTexture(canvas),
      side: T.DoubleSide,
    }),
  );
  sign.position.set(0, 3.05, 0.15);
  group.add(sign);
  const distance = Math.hypot(tileX - x, tileZ - z);
  if (distance > 2.4)
    kit.box(
      0,
      0.65,
      (distance + 1.3) / 2,
      0.95,
      0.05,
      distance - 1.3,
      '#e0e5d8',
    );
  kit.bake();
}
