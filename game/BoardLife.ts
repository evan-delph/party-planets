import * as T from 'three';
import { WorldKit } from './visuals';
import { getBoard } from './boards';
/** Each scenic vignette repeats once per minute; it never changes game rules. */
export function scenicPhase(seconds: number, offset: number, duration = 11) {
  const phase = (((seconds - offset) % 60) + 60) % 60;
  return phase < duration ? phase / duration : -1;
}
export function createBoardLife(
  parent: T.Group,
  board: ReturnType<typeof getBoard>,
  landmark: { x: number; z: number },
  low = false,
) {
  const radius = board.radius,
    scale = radius / 35,
    staticKit = new WorldKit(parent),
    events: {
      name: string;
      offset: number;
      duration: number;
      group: T.Group;
      tick: (t: number) => void;
    }[] = [];
  for (let i = 0; i < (low ? 8 : 14); i++) {
    const a = i * 2.39996,
      r = radius * (1.13 + (i % 3) * 0.12),
      x = Math.sin(a) * r,
      z = Math.cos(a) * r * 0.83,
      small = 2.4 + (i % 4);
    staticKit.mesh(
      new T.CylinderGeometry(small, small + 1, 0.75, 14),
      board.edge,
      x,
      -0.4,
      z,
    ).scale.z = 0.7;
    staticKit.mesh(
      new T.CylinderGeometry(small * 0.83, small, 0.15, 14),
      board.ground,
      x,
      0.08,
      z,
    ).scale.z = 0.7;
    staticKit.rock(x + small * 0.4, z, 0.75, '#d0b287');
    if (i % 2 === 0)
      staticKit.tree(x - small * 0.35, z, 'palm', 0.8 + (i % 3) * 0.2);
    if (i % 4 === 1) staticKit.hut(x, z, '#efc981', false);
  }
  {
    const x = radius * 0.72,
      z = -radius * 0.79;
    staticKit.mesh(new T.CylinderGeometry(4, 6, 2, 18), '#ba9f84', x, -0.5, z);
    staticKit.mesh(new T.CylinderGeometry(1, 1.4, 8, 16), '#fff2d1', x, 4, z);
    for (let j = 0; j < 3; j++)
      staticKit.mesh(
        new T.CylinderGeometry(1.04 + j * 0.08, 1.1 + j * 0.08, 0.8, 16),
        '#d76553',
        x,
        2 + j * 2,
        z,
      );
    staticKit.mesh(new T.ConeGeometry(1.6, 1.4, 12), '#357782', x, 8.9, z);
    staticKit.mesh(
      new T.CylinderGeometry(1.25, 1.25, 1.1, 12),
      '#ffe18b',
      x,
      7.7,
      z,
    );
  }
  staticKit.bake();
  function event(
    name: string,
    offset: number,
    duration: number,
    build: (kit: WorldKit, g: T.Group) => (t: number) => void,
  ) {
    const g = new T.Group();
    g.name = name;
    parent.add(g);
    const k = new WorldKit(g),
      tick = build(k, g);
    events.push({ name, offset, duration, group: g, tick });
  }
  function boat(k: WorldKit, sail: boolean) {
    k.mesh(
      new T.SphereGeometry(1, 12, 8),
      sail ? '#c78855' : '#806249',
      0,
      0,
      0,
    ).scale.set(0.9, 0.45, 2.4);
    k.box(0, 0.3, 0, 1.3, 0.2, 3, '#e4cba0');
    if (sail) {
      k.box(0, 2, 0, 0.1, 4, 0.1, '#9d7350');
      k.mesh(new T.ConeGeometry(1.6, 3, 3), '#fff6d9', 0, 2.2, 0.05).scale.z =
        0.05;
    } else {
      k.box(1, 0.7, 0, 0.09, 0.1, 3.2, '#ddbb83').rotation.y = 0.4;
      k.mesh(new T.SphereGeometry(0.3, 9, 6), '#bd845a', 0, 1, 0);
    }
  }
  function bird(k: WorldKit, color: string) {
    const g = new T.Group();
    k.root.add(g);
    k.mesh(new T.SphereGeometry(0.18, 8, 6), color, 0, 0, 0, g).scale.z = 1.5;
    const wings = [-1, 1].map((s) => {
      const wing = k.box(s * 0.38, 0, 0, 0.75, 0.055, 0.3, color, g);
      return wing;
    });
    return { g, wings };
  }
  if (board.id === 'crown') {
    event('Harbor merchant', 0, 12, (k, g) => {
      boat(k, true);
      return (t) => {
        const a = 0.65 + t * 0.65;
        g.position.set(
          Math.sin(a) * radius * 1.14,
          -0.05 + Math.sin(t * 20) * 0.12,
          Math.cos(a) * radius * 0.96,
        );
        g.rotation.y = a + Math.PI / 2;
      };
    });
    event('Gulls over the palms', 15, 11, (k) => {
      const birds = Array.from({ length: low ? 4 : 7 }, () =>
        bird(k, '#fff9e5'),
      );
      return (t) =>
        birds.forEach((v, i) => {
          const a = t * 6 + i * 0.7;
          v.g.position.set(
            Math.sin(a) * (8 + i * 0.5),
            9 + Math.sin(t * 8 + i),
            Math.cos(a) * 6,
          );
          v.g.rotation.y = a;
          v.wings.forEach(
            (w, j) =>
              (w.rotation.z = (j ? 1 : -1) * Math.sin(t * 60 + i) * 0.5),
          );
        });
    });
    event('Dolphin cove', 30, 10, (k, g) => {
      const dolphins = Array.from({ length: 3 }, (_, i) => {
        const d = k.mesh(
          new T.CapsuleGeometry(0.3, 1.2, 5, 10),
          '#68a4ac',
          i * 2,
          0,
          0,
        );
        const fin = k.mesh(
          new T.ConeGeometry(0.3, 0.65, 3),
          '#68a4ac',
          i * 2,
          0.2,
          0,
        );
        return { d, fin };
      });
      return (t) => {
        g.position.set(radius * 1.12, -0.4, radius * 0.1);
        dolphins.forEach(({ d, fin }, i) => {
          const p = Math.max(0, Math.sin((t * 2 - i * 0.18) * Math.PI));
          d.position.set(i * 2, p * 2.6 - 0.2, (t - 0.5) * 12);
          d.rotation.x = t * 6;
          fin.position.copy(d.position).add(new T.Vector3(0, 0.2, 0));
        });
      };
    });
    event('Caldera steam', 45, 11, (k, g) => {
      const clouds = Array.from({ length: low ? 10 : 18 }, () =>
        k.mesh(new T.SphereGeometry(0.5, 8, 6), '#ead3c1'),
      );
      g.position.set(landmark.x, 7, landmark.z);
      return (t) =>
        clouds.forEach((m, i) => {
          const p = (t + i / clouds.length) % 1;
          m.position.set(
            Math.sin(i * 3) * p * 3,
            p * 7,
            Math.cos(i * 3) * p * 3,
          );
          m.scale.setScalar(0.5 + p * 1.8);
        });
    });
  } else {
    event('Temple awakening', 0, 11, (k, g) => {
      const beam = k.mesh(
        new T.CylinderGeometry(0.12, 1, 10, 16),
        '#95ffd0',
        0,
        5,
        0,
      );
      const halo = k.mesh(
        new T.TorusGeometry(1.5, 0.13, 6, 24),
        '#daff8a',
        0,
        0.7,
        0,
      );
      halo.rotation.x = Math.PI / 2;
      g.position.set(landmark.x, 5, landmark.z);
      return (t) => {
        beam.scale.x = beam.scale.z = 0.5 + Math.sin(t * Math.PI);
        halo.scale.setScalar(1 + t * 3);
        halo.rotation.z = t * 3;
      };
    });
    event('Firefly gathering', 15, 11, (k, g) => {
      const bugs = Array.from({ length: low ? 16 : 30 }, () =>
        k.mesh(new T.SphereGeometry(0.09, 5, 4), '#efff83'),
      );
      return (t) =>
        bugs.forEach((m, i) => {
          const a = i * 2.4 + t * 5,
            r = 2 + Math.sin(t * Math.PI) * 4;
          m.position.set(
            -5 * scale + Math.sin(a) * r,
            2 + (i % 5) * 0.35,
            -4 * scale + Math.cos(a) * r,
          );
        });
    });
    event('Marsh frog chorus', 30, 10, (k, g) => {
      const frogs = Array.from({ length: 4 }, (_, i) => {
        const a = new T.Group();
        k.root.add(a);
        k.mesh(
          new T.SphereGeometry(0.38, 9, 6),
          '#98ca64',
          0,
          0.22,
          0,
          a,
        ).scale.set(1, 0.6, 1);
        for (const x of [-0.2, 0.2])
          k.mesh(new T.SphereGeometry(0.12, 7, 5), '#fff6c4', x, 0.48, 0.18, a);
        return a;
      });
      return (t) =>
        frogs.forEach((v, i) => {
          const p = (t * 3 + i * 0.2) % 1;
          v.position.set(
            -radius * 1.1 + i * 1.7,
            Math.sin(p * Math.PI) * 1.3,
            3 + p * 2,
          );
        });
    });
    event('Ruins canoe', 45, 12, (k, g) => {
      boat(k, false);
      return (t) => {
        const a = 2.1 + t * 0.7;
        g.position.set(
          Math.sin(a) * radius * 1.08,
          -0.1 + Math.sin(t * 20) * 0.08,
          Math.cos(a) * radius * 0.91,
        );
        g.rotation.y = a + Math.PI / 2;
      };
    });
  }
  return {
    draw(seconds: number, reduced = false) {
      for (const e of events) {
        const t = scenicPhase(seconds, e.offset, e.duration);
        e.group.visible = t >= 0;
        if (e.group.visible) e.tick(reduced ? 0.5 : t);
      }
    },
    events: events.map((e) => ({
      name: e.name,
      offset: e.offset,
      duration: e.duration,
    })),
  };
}
