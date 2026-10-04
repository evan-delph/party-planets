import * as T from 'three';
import { WorldKit } from './visuals';
import { getBoard } from './boards';

/** Decorative motion never consumes game RNG or changes a player's turn. */
export function createPlanetScenery(
  parent: T.Group,
  board: ReturnType<typeof getBoard>,
  low: boolean,
) {
  const staticRoot = new T.Group();
  parent.add(staticRoot);
  const kit = new WorldKit(staticRoot),
    animated: { object: T.Object3D; update: (t: number) => void }[] = [];
  const dynamic = (object: T.Object3D, update: (t: number) => void) => {
    parent.add(object);
    animated.push({ object, update });
  };
  const clearance = (x: number, z: number) =>
    Math.min(
      ...board.spaces.flatMap((a) =>
        a.next.map((id) => {
          const b = board.spaces[id],
            dx = b.x - a.x,
            dz = b.z - a.z,
            t = T.MathUtils.clamp(
              ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz),
              0,
              1,
            );
          return Math.hypot(x - a.x - t * dx, z - a.z - t * dz);
        }),
      ),
    );
  const findClearing = (x: number, z: number, radius = 2.8) => {
    if (clearance(x, z) > radius) return { x, z };
    for (let i = 0; i < 100; i++) {
      const a = i * 2.4,
        r = Math.sqrt(i) * 0.65,
        nx = x + Math.sin(a) * r,
        nz = z + Math.cos(a) * r;
      if (clearance(nx, nz) > radius) return { x: nx, z: nz };
    }
    return undefined;
  };
  for (const district of board.districts) {
    const spot = findClearing(district.x, district.z);
    if (!spot) continue;
    const { x, z } = spot;
    if (district.kind === 'lighthouse') {
      kit.mesh(new T.CylinderGeometry(0.68, 1.1, 6, 20), '#fff2cf', x, 3.5, z);
      for (let j = 0; j < 3; j++)
        kit.mesh(
          new T.CylinderGeometry(0.77 + j * 0.09, 0.83 + j * 0.09, 0.48, 20),
          '#ef8e6c',
          x,
          5 - j * 1.3,
          z,
        );
      kit.mesh(new T.CylinderGeometry(1.05, 1.05, 1, 16), '#4b7183', x, 6.8, z);
      kit.mesh(new T.ConeGeometry(1.4, 1, 16), '#ee8463', x, 7.8, z);
      const beam = new T.Group();
      beam.position.set(x, 6.8, z);
      const ray = new T.Mesh(
        new T.ConeGeometry(2.4, 16, 18, 1, true),
        new T.MeshBasicMaterial({
          color: '#fff4a6',
          transparent: true,
          opacity: 0.1,
          depthWrite: false,
          side: T.DoubleSide,
        }),
      );
      ray.rotation.z = Math.PI / 2;
      ray.position.x = 8;
      beam.add(ray);
      dynamic(beam, (t) => {
        beam.rotation.y = t * 0.32;
      });
    }
    if (
      district.kind === 'temple' &&
      Math.hypot(district.x - board.landmark.x, district.z - board.landmark.z) >
        10
    ) {
      for (let level = 0; level < 5; level++)
        kit.box(
          x,
          0.8 + level * 0.62,
          z,
          4.8 - level * 0.7,
          0.7,
          4.8 - level * 0.7,
          '#c0c6a0',
        );
      kit.arch(x, z, '#dad5ab');
      const relic = new T.Mesh(
        new T.OctahedronGeometry(0.48),
        new T.MeshStandardMaterial({
          color: '#90ffcf',
          emissive: '#45ce9a',
          emissiveIntensity: 0.8,
          metalness: 0.3,
          roughness: 0.2,
        }),
      );
      dynamic(relic, (t) => {
        relic.position.set(x, 4.6 + Math.sin(t * 1.7) * 0.24, z);
        relic.rotation.y = t * 0.7;
      });
    }
    if (district.kind === 'waterfall') {
      for (let i = 0; i < 5; i++)
        kit.rock(x - 2 + i, z, 1.7 + (i % 2) * 0.5, '#718d89');
      const falls = new T.Group();
      falls.position.set(x, 1, z + 1.5);
      for (let i = 0; i < 10; i++) {
        const drop = new T.Mesh(
          new T.BoxGeometry(0.13, 0.7, 0.1),
          new T.MeshBasicMaterial({
            color: i % 2 ? '#d5ffff' : '#73dae2',
            transparent: true,
            opacity: 0.8,
          }),
        );
        falls.add(drop);
        drop.position.x = (i - 4.5) * 0.15;
      }
      dynamic(falls, (t) => {
        falls.children.forEach((drop, i) => {
          drop.position.y = 3.6 - ((t * 2.5 + i * 0.37) % 3.6);
        });
      });
    }
    if (['harbor', 'chalet', 'hot-spring'].includes(district.kind)) {
      if (district.kind !== 'hot-spring')
        kit.hut(x, z, '#e8cda0', false);
      else
        kit.mesh(
          new T.CylinderGeometry(1.8, 2, 0.18, 24),
          '#8ad8dc',
          x,
          0.75,
          z,
        );
      const steam = new T.Group();
      for (let i = 0; i < 5; i++) {
        const puff = new T.Mesh(
          new T.SphereGeometry(0.22, 8, 6),
          new T.MeshBasicMaterial({
            color: '#ffffff',
            transparent: true,
            opacity: 0.35,
            depthWrite: false,
          }),
        );
        steam.add(puff);
      }
      dynamic(steam, (t) => {
        steam.children.forEach((p, i) => {
          const q = (t * 0.45 + i * 0.4) % 2;
          p.position.set(
            x + Math.sin(t + i) * 0.3,
            (district.kind === 'hot-spring' ? 1 : 3.3) + q,
            z,
          );
          p.scale.setScalar(0.7 + q * 0.8);
          ((p as T.Mesh).material as T.MeshBasicMaterial).opacity =
            0.35 * (1 - q / 2);
        });
      });
    }
    if (district.kind === 'grove') {
      for (let i = 0; i < 3; i++)
        kit.tree(
          x + Math.sin(i * 2.1) * 1.6,
          z + Math.cos(i * 2.1) * 1.6,
          'palm',
          0.9 + i * 0.1,
        );
      const critter = new T.Group();
      const ck = new WorldKit(critter);
      ck.mesh(
        new T.SphereGeometry(0.22, 10, 8),
        '#ffb44f',
        0,
        0.4,
        0,
      ).scale.z = 1.5;
      ck.mesh(
        new T.SphereGeometry(0.16, 10, 8),
        '#ffb44f',
        0,
        0.57,
        0.25,
      );
      ck.bake();
      dynamic(critter, (t) => {
        const a = t * 0.6;
        critter.position.set(
          x + Math.sin(a) * 1.1,
          Math.abs(Math.sin(t * 4)) * 0.18,
          z + Math.cos(a) * 1.1,
        );
        critter.rotation.y = a + Math.PI / 2;
      });
    }
  }
  // Slowly turning pinwheels and wind-swept pennants mark the real junctions.
  for (const node of board.spaces.filter((n) => n.next.length > 1)) {
    const spot = findClearing(node.x + 2.3, node.z, 1.6);
    if (!spot) continue;
    kit.box(spot.x, 1.7, spot.z, 0.12, 2.2, 0.12, '#876c63');
    const spinner = new T.Group();
    spinner.position.set(spot.x, 2.6, spot.z);
    const sk = new WorldKit(spinner);
    for (let i = 0; i < 4; i++) {
      const blade = sk.mesh(
        new T.ConeGeometry(0.22, 0.72, 3),
        i % 2 ? '#ffda7d' : '#c1f3d5',
        Math.sin((i * Math.PI) / 2) * 0.35,
        Math.cos((i * Math.PI) / 2) * 0.35,
        0,
      );
      blade.rotation.z = (-i * Math.PI) / 2;
      blade.scale.z = 0.12;
    }
    sk.bake();
    dynamic(spinner, (t) => {
      spinner.rotation.z = -t * 0.8;
      spinner.rotation.y = 0.3;
    });
  }
  // Drifting Earth sky traffic extends beyond the edges of the playable board.
  for (let i = 0; i < (low ? 2 : 4); i++) {
    const balloon = new T.Group(),
      bk = new WorldKit(balloon);
    bk.mesh(
      new T.SphereGeometry(1.1, 16, 12),
      ['#ffc772', '#a2dff0', '#f4adb2', '#b2dd9d'][i],
      0,
      0,
      0,
    ).scale.y = 1.25;
    bk.box(0, -1.8, 0, 0.65, 0.45, 0.65, '#a98865');
    for (const side of [-1, 1])
      bk.box(side * 0.3, -1.2, 0, 0.03, 1, 0.03, '#e4d6b0');
    bk.bake();
    dynamic(balloon, (t) => {
      const a = i * 1.7 + t * 0.013;
      balloon.position.set(
        Math.sin(a) * board.radius * 1.08,
        10 + Math.sin(t * 0.3 + i),
        Math.cos(a) * board.radius * 0.83,
      );
      balloon.rotation.y = Math.sin(t * 0.1) * 0.2;
    });
  }
  kit.bake();
  return {
    draw(time: number, reduced: boolean) {
      for (const entry of animated) entry.update(reduced ? 0 : time);
    },
  };
}
