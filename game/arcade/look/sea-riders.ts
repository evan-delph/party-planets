import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Bumper Buns rider costumes. Every contestant gets a big, readable hat in
 * their HUD colour plus inflatable water wings, so the four green aliens are
 * told apart by silhouette at a glance. All sizes are in the alien model's
 * own units (head top ≈ 2.28, head half-width ≈ 0.59, face toward +z).
 */

const gloss = (color: T.ColorRepresentation, roughness = 0.3) =>
  new T.MeshStandardMaterial({ color, roughness });

function mesh(g: T.BufferGeometry, m: T.Material, x = 0, y = 0, z = 0) {
  const o = new T.Mesh(g, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  return o;
}

/** Yellow sou'wester: rounded crown and a wide brim that drops at the back. */
function souwester(color: string) {
  const g = new T.Group();
  const m = gloss(color, 0.25);
  const crown = mesh(new T.SphereGeometry(0.5, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, 2.14, -0.04);
  crown.scale.set(1.16, 0.9, 1.0);
  const brim = new T.LatheGeometry(
    [
      [0.55, 0.02],
      [0.68, -0.02],
      [0.8, -0.1],
      [0.84, -0.14],
    ].map(([x, y]) => new T.Vector2(x, y)),
    36,
  );
  const b = mesh(brim, new T.MeshStandardMaterial({ color, roughness: 0.25, side: T.DoubleSide }), 0, 2.16, -0.1);
  b.scale.set(1.0, 1, 0.9);
  b.rotation.x = -0.32; // front brim tips up off the face, back drops to keep the rain off
  const band = mesh(new T.TorusGeometry(0.57, 0.045, 8, 32), gloss('#1b1d3a', 0.5), 0, 2.18, -0.04);
  band.rotation.x = Math.PI / 2;
  band.scale.set(1.0, 0.9, 1);
  g.add(crown, b, band);
  return { group: g, spin: undefined as T.Object3D | undefined };
}

/** Pink floral swim cap with rubber petals and a big flower on the side. */
function swimCap(color: string) {
  const g = new T.Group();
  const cap = mesh(
    new T.SphereGeometry(0.6, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5),
    gloss(color, 0.35),
    0,
    2.02,
    -0.03,
  );
  cap.scale.set(1.08, 0.75, 0.86);
  // Rubber petal bumps scattered over the cap, merged into one mesh.
  const petals: T.BufferGeometry[] = [];
  for (let i = 0; i < 16; i++) {
    const a = i * 2.4,
      el = 0.25 + (i % 4) * 0.28;
    const x = Math.cos(a) * Math.cos(el) * 0.64,
      z = Math.sin(a) * Math.cos(el) * 0.52 - 0.03,
      y = 2.02 + Math.sin(el) * 0.45;
    petals.push(new T.SphereGeometry(0.11, 10, 6).scale(1, 0.55, 1.3).translate(x, y, z));
  }
  const p = mesh(mergeGeometries(petals)!, gloss('#ffb3d1', 0.35));
  petals.forEach((x) => x.dispose());
  // Big daisy over one ear.
  const flower = new T.Group();
  const petalGeo = new T.SphereGeometry(0.13, 10, 6).scale(1.5, 0.45, 0.8);
  const white = gloss('#ffffff', 0.4);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const pm = mesh(petalGeo, white, Math.cos(a) * 0.17, 0, Math.sin(a) * 0.17);
    pm.rotation.y = -a;
    flower.add(pm);
  }
  flower.add(mesh(new T.SphereGeometry(0.11, 12, 8), gloss('#ffc21a', 0.3), 0, 0.03, 0));
  flower.position.set(0.5, 2.28, 0.12);
  flower.rotation.set(0.3, 0, -0.9);
  g.add(cap, p, flower);
  return { group: g, spin: undefined as T.Object3D | undefined };
}

/** Blue-banded skipper's cap with a glossy visor and a gold anchor badge. */
function skipperCap(color: string) {
  const g = new T.Group();
  const white = gloss('#fbfbff', 0.35);
  const crown = mesh(new T.CylinderGeometry(0.62, 0.5, 0.34, 28), white, 0, 2.38, -0.03);
  crown.scale.z = 0.88;
  const top = mesh(new T.CylinderGeometry(0.64, 0.62, 0.07, 28), white, 0, 2.58, -0.03);
  top.scale.z = 0.88;
  top.rotation.x = -0.08;
  const band = mesh(new T.CylinderGeometry(0.52, 0.52, 0.14, 28), gloss(color, 0.3), 0, 2.23, -0.03);
  band.scale.z = 0.88;
  const visor = mesh(
    new T.CylinderGeometry(0.42, 0.42, 0.035, 20, 1, false, -Math.PI / 2, Math.PI),
    gloss('#14183a', 0.15),
    0,
    2.17,
    0.2,
  );
  visor.scale.set(1.05, 1, 0.8);
  visor.rotation.x = 0.28;
  const badge = mesh(new T.TorusGeometry(0.075, 0.025, 6, 14), gloss('#ffc21a', 0.2), 0, 2.34, 0.47);
  const bar = mesh(new T.BoxGeometry(0.03, 0.15, 0.03), gloss('#ffc21a', 0.2), 0, 2.33, 0.48);
  g.add(crown, top, band, visor, badge, bar);
  return { group: g, spin: undefined as T.Object3D | undefined };
}

/** Purple-and-gold propeller beanie; the propeller spins with speed. */
function propellerBeanie(color: string) {
  const g = new T.Group();
  const gold = gloss('#ffc21a', 0.3);
  const purple = gloss(color, 0.35);
  for (let i = 0; i < 6; i++) {
    const seg = mesh(
      new T.SphereGeometry(0.58, 8, 12, (i / 6) * Math.PI * 2, Math.PI / 3, 0, Math.PI / 2),
      i % 2 ? gold : purple,
      0,
      2.04,
      -0.02,
    );
    seg.scale.set(1.1, 0.82, 0.92);
    g.add(seg);
  }
  const visor = mesh(
    new T.CylinderGeometry(0.4, 0.4, 0.03, 18, 1, false, -Math.PI / 2, Math.PI),
    purple,
    0,
    2.08,
    0.3,
  );
  visor.scale.set(1.1, 1, 0.7);
  visor.rotation.x = 0.18;
  const stem = mesh(new T.CylinderGeometry(0.03, 0.03, 0.22, 8), gloss('#ffffff'), 0, 2.58, -0.02);
  const knob = mesh(new T.SphereGeometry(0.06, 10, 8), gloss('#ff3d7f'), 0, 2.69, -0.02);
  const spin = new T.Group();
  spin.position.set(0, 2.68, -0.02);
  const blade = new T.SphereGeometry(0.1, 10, 6).scale(3.2, 0.25, 1);
  spin.add(mesh(blade, gloss('#ff3d7f', 0.3), 0.3, 0, 0), mesh(blade, gloss('#1fa2ff', 0.3), -0.3, 0, 0));
  spin.children.forEach((c, k) => (c.rotation.x = k ? -0.35 : 0.35));
  g.add(stem, knob, spin);
  return { group: g, spin };
}

/** Merge a hat's static parts into one mesh per material (fewer draw calls). */
function bake(group: T.Group) {
  group.updateMatrixWorld(true);
  const buckets = new Map<T.Material, T.BufferGeometry[]>();
  const done: T.Mesh[] = [];
  group.traverse((o) => {
    const m = o as T.Mesh;
    if (!m.isMesh || Array.isArray(m.material)) return;
    // Non-indexed copies so every primitive type merges together.
    const g = m.geometry.toNonIndexed().applyMatrix4(m.matrixWorld);
    if (!buckets.has(m.material)) buckets.set(m.material, []);
    buckets.get(m.material)!.push(g);
    done.push(m);
  });
  for (const m of done) m.removeFromParent();
  for (const [mat, list] of buckets) {
    const merged = mergeGeometries(list);
    list.forEach((g) => g.dispose());
    if (!merged) continue;
    const mesh = new T.Mesh(merged, mat);
    mesh.castShadow = true;
    group.add(mesh);
  }
}

export function makeRiderHat(i: number, color: string) {
  const hat = [souwester, swimCap, skipperCap, propellerBeanie][i % 4](color);
  if (hat.spin) hat.spin.removeFromParent();
  bake(hat.group);
  if (hat.spin) hat.group.add(hat.spin);
  hat.group.name = 'Rider hat';
  return hat;
}

/** Inflatable water wings for each arm (arm-local, pivot at the shoulder). */
export function makeWaterWings(color: string) {
  const geo = new T.TorusGeometry(0.1, 0.075, 10, 20);
  const mat = gloss(color, 0.2);
  return [-1, 1].map((side) => {
    const g = new T.Group();
    const ring = new T.Mesh(geo, mat);
    ring.rotation.x = Math.PI / 2;
    ring.castShadow = true;
    g.add(ring);
    g.position.set(side * 0.04, -0.13, 0);
    g.name = 'Water wing';
    return g;
  });
}
