import * as T from 'three';
import { WorldKit } from './visuals';
import { getBoard } from './boards';

export function createAlienScenery(
  parent: T.Group,
  board: ReturnType<typeof getBoard>,
  low = false,
) {
  const kit = new WorldKit(parent),
    animated: {
      object: T.Object3D;
      base: number;
      phase: number;
      kind: string;
    }[] = [];
  const safe = (x: number, z: number, r = 3) =>
    board.spaces.every((n) => Math.hypot(x - n.x, z - n.z) > r) &&
    board.spaces.every((a) =>
      a.next.every((id) => {
        const b = board.spaces[id],
          dx = b.x - a.x,
          dz = b.z - a.z,
          t = T.MathUtils.clamp(
            ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz),
            0,
            1,
          );
        return Math.hypot(x - a.x - t * dx, z - a.z - t * dz) > r * 0.65;
      }),
    );
  const glow = (mesh: T.Mesh) => {
    const m = (mesh.material as T.MeshStandardMaterial).clone();
    m.emissive.set(board.accent);
    m.emissiveIntensity = 0.45;
    mesh.material = m;
    return mesh;
  };
  function crystal(x: number, z: number, size = 1) {
    for (let j = 0; j < 4; j++) {
      const c = kit.mesh(
        new T.ConeGeometry(0.4, 2.5 + j * 0.4, 5),
        j % 2 ? board.accent : board.water,
        x + Math.sin(j * 2) * 0.5,
        0.65 + (2.5 + j * 0.4) * size * 0.5,
        z + Math.cos(j * 2) * 0.5,
      );
      c.rotation.z = (j - 1.5) * 0.16;
      c.scale.setScalar(size);
    }
    kit.mesh(new T.CylinderGeometry(1.1, 1.3, 0.3, 9), board.edge, x, 0.7, z);
  }
  function crater(x: number, z: number, size = 2.6) {
    const rim = kit.mesh(
      new T.TorusGeometry(size, 0.3, 8, 32),
      board.edge,
      x,
      0.8,
      z,
    );
    rim.rotation.x = Math.PI / 2;
    rim.scale.y = 0.75;
    const bowl = kit.mesh(
      new T.LatheGeometry(
        [
          new T.Vector2(0, 0.01),
          new T.Vector2(size * 0.4, 0.03),
          new T.Vector2(size * 0.8, 0.16),
          new T.Vector2(size, 0.25),
        ],
        32,
      ),
      board.ground,
      x,
      0.62,
      z,
    );
    (bowl.material as T.MeshStandardMaterial).side = T.DoubleSide;
    const center = kit.mesh(
      new T.CylinderGeometry(size * 0.65, size * 0.65, 0.05, 24),
      '#454758',
      x,
      0.66,
      z,
    );
    center.scale.z = 0.85;
    for (let j = 0; j < 5; j++)
      kit.rock(
        x + Math.sin(j * 1.4) * size * 1.15,
        z + Math.cos(j * 1.4) * size,
        0.24,
        board.edge,
      );
  }
  function coral(x: number, z: number, size = 1) {
    for (let j = 0; j < 5; j++) {
      const c = kit.mesh(
        new T.CapsuleGeometry(0.16, 0.8 + j * 0.3, 4, 8),
        j % 2 ? board.accent : '#aa74c5',
        x + Math.sin(j * 1.2) * 0.6,
        0.65 + (0.8 + j * 0.3 + 0.32) * size * 0.5,
        z + Math.cos(j * 1.2) * 0.6,
      );
      c.rotation.z = (j - 2) * 0.25;
      c.scale.setScalar(size);
    }
    kit.mesh(
      new T.SphereGeometry(0.8, 12, 6),
      board.water,
      x,
      0.75,
      z,
    ).scale.y = 0.2;
  }
  function pod(x: number, z: number, size = 1) {
    const g = new T.Group();
    parent.add(g);
    const base = 0.65 + 1.65 * size;
    g.position.set(x, base, z);
    g.scale.setScalar(size);
    const k = new WorldKit(g);
    const cap = k.mesh(new T.SphereGeometry(1, 16, 8), board.accent);
    cap.scale.set(1.1, 0.3, 1.1);
    glow(cap);
    k.mesh(new T.CylinderGeometry(0.1, 0.2, 1.7, 8), board.edge, 0, -0.8, 0);
    for (let j = 0; j < 5; j++)
      k.mesh(
        new T.SphereGeometry(0.11, 6, 5),
        '#ebf9ae',
        Math.sin(j * 1.26) * 0.65,
        0.24,
        Math.cos(j * 1.26) * 0.65,
      );
    animated.push({ object: g, base, phase: x, kind: 'pod' });
  }
  for (let i = 0; i < (low ? 75 : 155); i++) {
    const a = i * 2.4,
      r = Math.sqrt((i * 0.61803) % 1) * (board.radius - 4),
      x = Math.sin(a) * r,
      z = Math.cos(a) * r * 0.8;
    if (!safe(x, z, board.id === 'crater' ? 4 : 2.6)) continue;
    if (board.id === 'crater') {
      if (i % 5 === 0) crater(x, z, 1.6 + (i % 3));
      else kit.rock(x, z, 0.3 + (i % 4) * 0.16, board.edge);
    }
    if (board.id === 'fissure') {
      kit.rock(x, z, 1 + (i % 3) * 0.35, board.edge);
      if (i % 4 === 0) {
        const vent = kit.mesh(
          new T.ConeGeometry(0.55, 1.6, 8),
          board.accent,
          x,
          1.1,
          z,
        );
        glow(vent);
      }
    }
    if (board.id === 'coral') {
      coral(x, z, 0.6 + (i % 3) * 0.3);
      if (i % 12 === 0) pod(x, z, 0.6);
    }
  }
  for (const [i, district] of board.districts.entries()) {
    let x = district.x,
      z = district.z;
    for (let attempt = 0; attempt < 30 && !safe(x, z, 3.7); attempt++) {
      x = district.x + Math.sin(attempt * 2.4) * Math.sqrt(attempt) * 0.7;
      z = district.z + Math.cos(attempt * 2.4) * Math.sqrt(attempt) * 0.7;
    }
    if (!safe(x, z, 2.8)) continue;
    kit.mesh(new T.CylinderGeometry(2, 2.3, 0.65, 12), board.edge, x, 0.9, z);
    if (/crater|basin|impact/.test(district.kind)) {
      crater(x, z, 3.2);
      continue;
    }
    if (/crystal|prism|ice/.test(district.kind)) {
      crystal(x, z, 2);
      continue;
    }
    if (/coral|reef|garden|grove/.test(district.kind)) {
      coral(x, z, 2);
      pod(x, z, 1.3);
      continue;
    }
    const dome = kit.mesh(
      new T.SphereGeometry(1.8, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      board.accent,
      x,
      1.3,
      z,
    );
    (dome.material as T.MeshStandardMaterial).roughness = 0.4;
    kit.box(x, 1.3, z + 1.9, 0.7, 1.1, 0.15, '#172339');
    for (let j = 0; j < 8; j++) {
      const a = (j * Math.PI) / 4;
      kit.mesh(
        new T.SphereGeometry(0.14, 6, 5),
        '#c5ffe9',
        x + Math.sin(a) * 1.9,
        1.6,
        z + Math.cos(a) * 1.9,
      );
    }
    kit.mesh(new T.CylinderGeometry(0.07, 0.07, 3, 8), '#94a8c7', x + 2, 2, z);
    const radar = new T.Group();
    parent.add(radar);
    radar.position.set(x + 2, 3.7, z);
    const dish = new T.Mesh(
      new T.SphereGeometry(0.8, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.42),
      new T.MeshStandardMaterial({
        color: '#b3d6e9',
        metalness: 0.5,
        roughness: 0.4,
        side: T.DoubleSide,
      }),
    );
    dish.rotation.z = 0.8;
    radar.add(dish);
    animated.push({ object: radar, base: 3.7, phase: i, kind: 'radar' });
  }
  const lm = board.landmark;
  if (board.id === 'crater') crater(lm.x, lm.z, 5);
  else if (board.id === 'fissure')
    for (let j = 0; j < 5; j++) {
      const p = kit.mesh(
        new T.ConeGeometry(1.1, 6 + j, 7),
        j % 2 ? board.edge : board.accent,
        lm.x + Math.sin(j * 1.3) * 2,
        3,
        lm.z + Math.cos(j * 1.3) * 2,
      );
      p.rotation.z = (j - 2) * 0.12;
    }
  else if (board.id === 'coral') {
    coral(lm.x, lm.z, 3.4);
    const ring = kit.mesh(
      new T.TorusGeometry(3, 0.25, 8, 40),
      board.accent,
      lm.x,
      4,
      lm.z,
    );
    ring.rotation.y = 0.3;
  } else {
    for (let j = 0; j < 3; j++)
      kit.arch(lm.x + (j - 1) * 2.6, lm.z + j * 0.8, board.edge);
    crystal(lm.x, lm.z, 2.5);
  }
  // Satellite scenery makes the space beyond the route a place too.
  for (let i = 0; i < 16; i++) {
    const a = i * 2.4,
      r = board.radius * (1.1 + (i % 3) * 0.08),
      x = Math.sin(a) * r,
      z = Math.cos(a) * r * 0.85;
    if (board.planet === 'selene') {
      kit.rock(x, z, 2 + (i % 4), board.edge);
      if (i % 3 === 0) crystal(x, z, 1.2);
    } else {
      kit.mesh(new T.ConeGeometry(3, 5, 7), board.edge, x, 1, z).rotation.z =
        Math.PI;
      coral(x, z, 1.4);
    }
  }
  kit.bake();
  const motes = new T.InstancedMesh(
    new T.SphereGeometry(0.07, 5, 4),
    new T.MeshBasicMaterial({ color: board.accent }),
    48,
  );
  parent.add(motes);
  const dummy = new T.Object3D();
  return {
    draw(time: number, reduced: boolean) {
      animated.forEach(({ object, base, phase, kind }) => {
        object.rotation.y = reduced
          ? 0
          : time * (kind === 'radar' ? 0.4 : 0.12) + phase;
        object.position.y =
          base + (reduced ? 0 : Math.sin(time + phase) * 0.15);
        if (kind === 'pod' && !reduced) {
          const pulse = Math.max(0, Math.sin(((time % 60) / 5) * Math.PI));
          object.rotation.z = pulse * 0.08 * Math.sin(time);
        }
      });
      for (let i = 0; i < 48; i++) {
        const a = i * 2.4,
          r = (0.2 + (i % 7) * 0.12) * board.radius;
        dummy.position.set(
          Math.sin(a + time * 0.005) * r,
          1.2 + (reduced ? 0 : Math.sin(time * 0.5 + i)) * 1.1,
          Math.cos(a + time * 0.005) * r * 0.8,
        );
        dummy.updateMatrix();
        motes.setMatrixAt(i, dummy.matrix);
      }
      motes.instanceMatrix.needsUpdate = true;
    },
  };
}
