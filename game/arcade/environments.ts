import * as T from 'three';
import { WorldKit } from '../visuals';
import { ArenaKind } from './catalog';
export function decorateArena(scene: T.Scene, kind: ArenaKind) {
  const k = new WorldKit(scene);
  if (kind === 'canopy') {
    for (const x of [-10, 10])
      for (const z of [-7, 7]) {
        k.mesh(new T.CylinderGeometry(0.9, 1.5, 9, 10), '#806449', x, 1.5, z);
        k.tree(x, z, 'jungle', 2.7);
      }
    for (let i = 0; i < 8; i++) {
      k.box(-7 + i * 2, -0.8, -6.5, 1.8, 0.5, 0.65, '#79927a');
      k.mesh(
        new T.ConeGeometry(0.25, 0.7, 5),
        '#d6c392',
        -7 + i * 2,
        7.6,
        -6.5,
      );
    }
    k.arch(0, -10, '#a2ab85');
    for (let i = 0; i < 12; i++)
      k.tree(Math.sin(i * 2) * 15, Math.cos(i * 2) * 13, 'mushroom', 0.7);
  }
  // Bumper Buns dresses its own sea arena in look/sea-arena.ts.
  if (kind === 'rope') {
    const lava = k.mesh(new T.PlaneGeometry(120, 120), '#d2764d', 0, -0.72, 0);
    lava.rotation.x = -Math.PI / 2;
    for (let i = 0; i < 4; i++) {
      const a = ((i + 0.5) * Math.PI) / 2,
        x = Math.cos(a) * 4.4,
        z = Math.sin(a) * 4.4;
      k.mesh(new T.CylinderGeometry(1.5, 1.7, 0.5, 20), '#d7a984', x, -0.22, z);
      k.mesh(
        new T.ConeGeometry(1.7, 3.3, 7),
        '#736078',
        x,
        -1.8,
        z,
      ).rotation.x = Math.PI;
      const r = k.mesh(
        new T.TorusGeometry(1.45, 0.09, 6, 28),
        '#ffcf76',
        x,
        0.05,
        z,
      );
      r.rotation.x = Math.PI / 2;
    }
    for (let i = 0; i < 14; i++) {
      const a = i * 0.45,
        x = Math.sin(a) * 13,
        z = Math.cos(a) * 13;
      k.mesh(new T.ConeGeometry(2.4, 6 + (i % 4), 7), '#66566f', x, 1.4, z);
      k.mesh(new T.ConeGeometry(0.4, 1.4, 6), '#ffb45c', x, 4, z);
    }
  }
  if (kind === 'coconut') {
    const sand = k.mesh(new T.PlaneGeometry(150, 150), '#d9bc89', 0, -0.75, 0);
    sand.rotation.x = -Math.PI / 2;
    for (const [x, z] of [
      [2.7, -2.2],
      [-2.7, 2.2],
    ]) {
      k.mesh(new T.CylinderGeometry(0.85, 1, 2.3, 8), '#d9bf8f', x, 1, z);
      k.mesh(new T.CylinderGeometry(1, 1, 0.22, 8), '#ebd6a5', x, 2.2, z);
    }
    for (let i = 0; i < 7; i++) {
      const x = -18 + i * 6,
        z = -13 - (i % 2) * 3;
      k.mesh(
        new T.ConeGeometry(4, 5 + (i % 3), 4),
        '#cda978',
        x,
        1,
        z,
      ).rotation.y = Math.PI / 4;
    }
    k.arch(-12, 0, '#d6bb8d');
    k.arch(12, 0, '#d6bb8d');
    for (let i = 0; i < 8; i++) {
      const x = Math.sin(i) * 13,
        z = Math.cos(i) * 11;
      k.mesh(new T.CapsuleGeometry(0.26, 1.5, 4, 7), '#7b9b79', x, 0.7, z);
      k.rock(x + 0.8, z, 0.5, '#be9c76');
    }
  }
  if (kind === 'race') {
    for (let i = 0; i < 10; i++) {
      const z = 4 - i * 12;
      for (const x of [-13, 13]) {
        k.box(x, 2, z, 0.35, 4, 0.35, '#899aa0');
        k.box(x, 4, z, 4, 0.3, 0.3, '#e2b46b');
        k.mesh(new T.SphereGeometry(0.2, 8, 6), '#fff3bc', x, 4, z + 1.2);
      }
      if (i % 2 === 0) {
        k.hut(-17, z, '#8ebcc3');
        const b = k.mesh(
          new T.SphereGeometry(1, 12, 6),
          '#ddc6a2',
          17,
          -0.15,
          z,
        );
        b.scale.set(1.2, 0.5, 3);
        k.box(17, 1.8, z, 0.1, 4, 0.1, '#c9a37c');
        k.mesh(new T.ConeGeometry(1.5, 3, 3), '#d79988', 17, 2, z).scale.z =
          0.1;
      }
    }
  }
  if (kind === 'duos') {
    for (let i = 0; i < 16; i++) {
      const x = i % 2 ? -12 : 12,
        z = 8 - Math.floor(i / 2) * 4.4;
      k.tree(x, z, i % 3 ? 'jungle' : 'mushroom', 1);
      k.mesh(new T.SphereGeometry(0.18, 7, 5), '#e9eda4', x * 0.78, 1.8, z);
    }
    k.hut(-8, -22, '#839e87');
    k.hut(8, -22, '#9293ad');
    k.arch(0, -23, '#9da98e');
    for (let i = 0; i < 8; i++) {
      const r = k.mesh(
        new T.TorusGeometry(0.6, 0.12, 6, 16),
        '#a2b694',
        Math.sin(i * 2) * 14,
        -0.3,
        -7 + i * 2,
      );
      r.rotation.x = Math.PI / 2;
    }
  }
  k.bake();
  return k;
}
