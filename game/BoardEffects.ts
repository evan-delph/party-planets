import * as T from 'three';
import type { Game } from './engine';
import { getBoard } from './boards';
import { surfaceTexture } from './Surfaces';

export function createBoardEffects(
  parent: T.Object3D,
  board: ReturnType<typeof getBoard>,
) {
  const root = new T.Group();
  parent.add(root);
  const bag = new T.Group();
  root.add(bag);
  const cloth = surfaceTexture('cloth');
  cloth.repeat.set(3, 3);
  const body = new T.Mesh(
    new T.LatheGeometry(
      [
        new T.Vector2(0.08, -0.7),
        new T.Vector2(0.6, -0.6),
        new T.Vector2(0.8, -0.1),
        new T.Vector2(0.65, 0.55),
        new T.Vector2(0.28, 0.85),
        new T.Vector2(0.4, 1),
      ],
      32,
    ),
    new T.MeshStandardMaterial({
      color: '#b47c42',
      map: cloth,
      bumpMap: cloth,
      bumpScale: 0.06,
      roughness: 0.9,
    }),
  );
  bag.add(body);
  const mouth = new T.Mesh(
    new T.TorusGeometry(0.38, 0.08, 8, 32),
    new T.MeshStandardMaterial({ color: '#f6ca75', roughness: 0.6 }),
  );
  mouth.rotation.x = Math.PI / 2;
  mouth.position.y = 0.96;
  bag.add(mouth);
  const hole = new T.Mesh(
    new T.CircleGeometry(0.31, 28),
    new T.MeshBasicMaterial({ color: '#29180c', side: T.DoubleSide }),
  );
  hole.rotation.x = -Math.PI / 2;
  hole.position.y = 0.96;
  bag.add(hole);
  const seal = new T.Mesh(
    new T.OctahedronGeometry(0.29),
    new T.MeshStandardMaterial({
      color: '#ffe38c',
      metalness: 0.65,
      roughness: 0.2,
    }),
  );
  seal.position.set(0, 0, 0.74);
  seal.scale.z = 0.18;
  bag.add(seal);
  const coins = new T.InstancedMesh(
    new T.CylinderGeometry(0.15, 0.15, 0.055, 14),
    new T.MeshStandardMaterial({
      color: '#ffda5a',
      metalness: 0.75,
      roughness: 0.22,
      emissive: '#a36b06',
      emissiveIntensity: 0.15,
    }),
    72,
  );
  root.add(coins);
  const burst = new T.InstancedMesh(
    new T.IcosahedronGeometry(0.32, 0),
    new T.MeshStandardMaterial({
      color: board.globalEvent.color,
      emissive: board.globalEvent.color,
      emissiveIntensity: 0.8,
      roughness: 0.6,
    }),
    64,
  );
  root.add(burst);
  const rings = Array.from({ length: 3 }, () => {
    const r = new T.Mesh(
      new T.TorusGeometry(1, 0.035, 6, 100),
      new T.MeshBasicMaterial({
        color: board.globalEvent.color,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
      }),
    );
    r.rotation.x = Math.PI / 2;
    root.add(r);
    return r;
  });
  const beam = new T.Mesh(
    new T.CylinderGeometry(0.8, 2.4, 12, 20, 1, true),
    new T.MeshBasicMaterial({
      color: board.globalEvent.color,
      transparent: true,
      opacity: 0.16,
      side: T.DoubleSide,
      depthWrite: false,
    }),
  );
  root.add(beam);
  const d = new T.Object3D();
  return {
    draw(effect: Game['effect'], age: number, reduced: boolean) {
      const bank =
        effect?.kind === 'bank' && effect.delta > 0 && age >= 0 && age < 5.5;
      const event = effect?.kind === 'event' && age >= 0 && age < 7;
      root.visible = bank || event;
      bag.visible = coins.visible = bank;
      burst.visible = beam.visible = event;
      rings.forEach((r) => (r.visible = event));
      if (bank) {
        const n = board.spaces[effect!.space];
        bag.position.set(
          n.x,
          4.7 + (reduced ? 0 : Math.sin(age * 2) * 0.13),
          n.z,
        );
        bag.rotation.z = reduced
          ? Math.PI
          : Math.PI * T.MathUtils.smoothstep(age, 0.2, 1.1);
        bag.rotation.y = age * 0.15;
        for (let i = 0; i < 72; i++) {
          const t = Math.max(0, age - 0.9 - i * 0.035),
            cycle = t % 1.7,
            fall = 1 - Math.pow(1 - cycle / 1.7, 2);
          d.position.set(
            n.x + Math.sin(i * 2.4) * fall * 0.8,
            4.1 - fall * 3.1,
            n.z + Math.cos(i * 2.4) * fall * 0.8,
          );
          d.rotation.set(t * 6, i, t * 4);
          d.scale.setScalar(t > 0 ? 1 : 0);
          d.updateMatrix();
          coins.setMatrixAt(i, d.matrix);
        }
        coins.instanceMatrix.needsUpdate = true;
      }
      if (event) {
        const origin = board.landmark,
          kind = board.globalEvent.id,
          fall = kind === 'avalanche' || kind === 'meteor',
          wave = kind === 'prism' || kind === 'temple' || kind === 'tide';
        beam.visible = !fall;
        beam.position.set(
          origin.x,
          (kind === 'eruption' ? (7 * board.radius) / 35 : 0) + 6,
          origin.z,
        );
        beam.scale.setScalar(reduced ? 1 : 1 + Math.sin(age * 5) * 0.1);
        rings.forEach((r, i) => {
          const t = Math.max(0, age - i * 0.5);
          r.position.set(origin.x, 0.8 + i * 0.14, origin.z);
          r.rotation.set(-Math.PI / 2, 0, 0);
          r.scale.setScalar(Math.max(0.1, (t * board.radius) / 3));
          if (kind === 'prism') {
            r.rotation.x = -Math.PI / 2 + i * 0.34;
            r.rotation.y = age * 0.24 + i * 0.6;
          }
          if (kind === 'tide') {
            r.position.y = 1.2 + Math.sin(Math.min(Math.PI, t * 0.6)) * 3;
            r.scale.y = 0.78;
          }
          if (kind === 'geyser') {
            r.position.y = 2 + i * 3 + t;
            r.scale.setScalar(2 + t * 0.8);
          }
          if (kind === 'sandstorm') {
            r.position.y = 1 + i * 2;
            r.scale.setScalar(3 + i * 1.4 + Math.sin(t) * 0.7);
            r.rotation.x = -Math.PI / 2 + i * 0.12;
          }
          (r.material as T.MeshBasicMaterial).opacity = Math.max(
            0,
            0.7 - t * 0.11,
          );
        });
        for (let i = 0; i < 64; i++) {
          const t = Math.max(0, age - (i % 8) * 0.08),
            a = i * 2.39996,
            r = wave
              ? (t * board.radius) / 3
              : Math.min(board.radius * 1.8, t * (8 + (i % 9)));
          d.position.set(
            origin.x + Math.cos(a) * r,
            fall
              ? Math.max(0.8, 18 - t * 4 - (i % 5))
              : wave
                ? 1.4 + Math.sin(i + t) * 2
                : Math.max(
                    0.8,
                    (kind === 'eruption' ? (7 * board.radius) / 35 : 2) +
                      t * 8 -
                      t * t * 2.4,
                  ),
            origin.z + Math.sin(a) * r,
          );
          if (kind === 'meteor') {
            d.position.x += t * 2;
            d.position.y = Math.max(0.8, 26 - t * 9 + (i % 8) * 1.4);
          }
          if (kind === 'avalanche') {
            d.position.y = 1.1 + Math.abs(Math.sin(i + t * 3)) * 2;
            d.position.z = origin.z + t * 12 + (i % 8) * 1.3;
            d.position.x = origin.x + Math.sin(a) * (3 + t * 6);
          }
          if (kind === 'geyser')
            d.position.set(
              origin.x + Math.sin(a + t * 2) * (1 + t * 0.9),
              0.8 + ((t * 7 + i * 0.43) % 17),
              origin.z + Math.cos(a + t * 2) * (1 + t * 0.9),
            );
          if (kind === 'spore') d.position.y = 2.5 + Math.sin(t + i) * 2;
          if (kind === 'tide')
            d.position.y = 1.3 + Math.sin(Math.min(Math.PI, t * 0.6)) * 3;
          if (kind === 'sandstorm') {
            const spiral = a + t * 2.7,
              span = 2 + (i % 9) * 0.65;
            d.position.set(
              origin.x + Math.sin(spiral) * span,
              1 + (i % 7) * 0.9,
              origin.z + Math.cos(spiral) * span,
            );
          }
          d.rotation.set(t, a + t, t * 0.5);
          d.scale.setScalar(
            fall
              ? 1 + (i % 3) * 0.4
              : wave
                ? 0.55
                : kind === 'eruption'
                  ? 1.6
                  : 1,
          );
          d.updateMatrix();
          burst.setMatrixAt(i, d.matrix);
        }
        burst.instanceMatrix.needsUpdate = true;
      }
    },
  };
}
