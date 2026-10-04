import * as T from 'three';
import { loadModel } from './models';

/** Three.js landing prop; +Z is the exit and the foot of the open ramp. */
export function makeUfo() {
  const ufo = new T.Group();
  const hull = new T.Group();
  ufo.add(hull);
  const metal = new T.MeshStandardMaterial({
    color: '#c5d9e5',
    metalness: 0.72,
    roughness: 0.26,
  });
  const trim = new T.MeshStandardMaterial({
    color: '#355b74',
    metalness: 0.65,
    roughness: 0.3,
  });
  const dark = new T.MeshStandardMaterial({ color: '#112a34', roughness: 0.7 });
  const lamps = new T.MeshStandardMaterial({
    color: '#a6ffaf',
    emissive: '#75ffad',
    emissiveIntensity: 1.4,
    roughness: 0.24,
  });
  const amber = new T.MeshStandardMaterial({
    color: '#ffe796',
    emissive: '#ffbf55',
    emissiveIntensity: 0.8,
    roughness: 0.26,
  });
  const blueLamps = new T.MeshStandardMaterial({
    color: '#8cd8ff',
    emissive: '#168bff',
    emissiveIntensity: 1.5,
    roughness: 0.18,
  });
  const mesh = (
    geometry: T.BufferGeometry,
    material: T.Material,
    x: number,
    y: number,
    z: number,
    parent: T.Object3D = hull,
  ) => {
    const object = new T.Mesh(geometry, material);
    object.position.set(x, y, z);
    object.castShadow = object.receiveShadow = true;
    parent.add(object);
    return object;
  };
  mesh(new T.SphereGeometry(2.8, 36, 16), metal, 0, 1.55, 0).scale.y = 0.24;
  mesh(new T.CylinderGeometry(2.5, 1.8, 0.43, 36), trim, 0, 1.11, 0);
  const ring = mesh(new T.TorusGeometry(2.58, 0.1, 10, 48), trim, 0, 1.48, 0);
  ring.rotation.x = Math.PI / 2;
  const glass = new T.MeshPhysicalMaterial({
    color: '#73d3db',
    transparent: true,
    opacity: 0.6,
    roughness: 0.12,
    metalness: 0.1,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    depthWrite: false,
  });
  mesh(
    new T.SphereGeometry(1.58, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    glass,
    0,
    1.76,
    0,
  ).scale.y = 0.78;
  const domeTrim = mesh(
    new T.TorusGeometry(1.58, 0.065, 10, 36),
    metal,
    0,
    1.76,
    0,
  );
  domeTrim.rotation.x = Math.PI / 2;
  mesh(new T.CylinderGeometry(0.025, 0.045, 0.48, 8), trim, 0, 3.03, 0);
  mesh(new T.SphereGeometry(0.11, 12, 8), amber, 0, 3.3, 0);
  const lights = new T.InstancedMesh(
    new T.SphereGeometry(0.12, 10, 8),
    new T.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }),
    16,
  );
  const matrix = new T.Matrix4();
  for (let i = 0; i < 16; i++) {
    const angle = (i * Math.PI) / 8;
    matrix.makeTranslation(Math.sin(angle) * 2.8, 1.5, Math.cos(angle) * 2.8);
    lights.setMatrixAt(i, matrix);
    lights.setColorAt(i, new T.Color('#82ffc1'));
  }
  hull.add(lights);
  const blueLights = new T.InstancedMesh(
    new T.SphereGeometry(0.09, 10, 8),
    new T.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }),
    16,
  );
  for (let i = 0; i < 16; i++) {
    const angle = ((i + 0.5) * Math.PI) / 8;
    matrix.makeTranslation(Math.sin(angle) * 2.8, 1.52, Math.cos(angle) * 2.8);
    blueLights.setMatrixAt(i, matrix);
    blueLights.setColorAt(i, new T.Color('#55adff'));
  }
  hull.add(blueLights);
  const panelGeo = new T.BoxGeometry(0.033, 0.014, 0.67);
  const panelLines = new T.InstancedMesh(panelGeo, trim, 20);
  const pose = new T.Object3D();
  for (let i = 0; i < 20; i++) {
    const angle = (i * Math.PI) / 10;
    pose.position.set(Math.sin(angle) * 2.12, 1.99, Math.cos(angle) * 2.12);
    pose.rotation.set(0.3, angle, 0);
    pose.updateMatrix();
    panelLines.setMatrixAt(i, pose.matrix);
  }
  hull.add(panelLines);
  const rivets = new T.InstancedMesh(
    new T.SphereGeometry(0.029, 6, 4),
    metal,
    40,
  );
  for (let i = 0; i < 40; i++) {
    const angle = (i * Math.PI) / 20;
    matrix.makeTranslation(
      Math.sin(angle) * 2.53,
      1.845,
      Math.cos(angle) * 2.53,
    );
    rivets.setMatrixAt(i, matrix);
  }
  hull.add(rivets);
  const portRims = new T.InstancedMesh(
    new T.TorusGeometry(0.16, 0.037, 8, 20),
    metal,
    8,
  );
  const portGlass = new T.InstancedMesh(
    new T.CircleGeometry(0.153, 20),
    blueLamps,
    8,
  );
  for (let i = 0; i < 8; i++) {
    const angle = ((i + 0.5) * Math.PI) / 4;
    pose.position.set(Math.sin(angle) * 2.53, 1.24, Math.cos(angle) * 2.53);
    pose.rotation.set(0, angle, 0);
    pose.updateMatrix();
    portRims.setMatrixAt(i, pose.matrix);
    pose.position.addScaledVector(
      new T.Vector3(Math.sin(angle), 0, Math.cos(angle)),
      0.012,
    );
    pose.updateMatrix();
    portGlass.setMatrixAt(i, pose.matrix);
  }
  hull.add(portRims, portGlass);
  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI * 2) / 3 + Math.PI;
    const x = Math.sin(angle) * 1.64,
      z = Math.cos(angle) * 1.64;
    mesh(new T.CylinderGeometry(0.08, 0.13, 0.79, 10), metal, x, 0.59, z);
    mesh(new T.SphereGeometry(0.33, 12, 8), trim, x, 0.15, z).scale.y = 0.3;
  }
  // A dark entrance remains open behind the ramp. The pivot is the ground hinge.
  mesh(new T.BoxGeometry(1.27, 1.32, 0.1), dark, 0, 1.04, 2.44);
  for (const side of [-1, 1]) {
    mesh(new T.BoxGeometry(0.1, 1.36, 0.15), metal, side * 0.68, 1.04, 2.49);
    mesh(new T.BoxGeometry(0.033, 1.13, 0.04), lamps, side * 0.6, 1.04, 2.57);
  }
  mesh(new T.BoxGeometry(1.44, 0.13, 0.16), metal, 0, 1.76, 2.49);
  const ramp = new T.Group();
  ramp.position.set(0, 0.37, 2.52);
  hull.add(ramp);
  mesh(new T.BoxGeometry(1.28, 1.4, 0.11), metal, 0, 0.7, 0, ramp);
  mesh(new T.BoxGeometry(1.07, 1.21, 0.03), trim, 0, 0.7, 0.073, ramp);
  for (let i = 0; i < 6; i++)
    mesh(
      new T.BoxGeometry(1.02, 0.033, 0.02),
      metal,
      0,
      0.16 + i * 0.21,
      0.098,
      ramp,
    );
  for (const side of [-1, 1])
    mesh(
      new T.BoxGeometry(0.035, 1.26, 0.035),
      amber,
      side * 0.59,
      0.7,
      0.08,
      ramp,
    );
  const engineHalo = mesh(
    new T.TorusGeometry(1.33, 0.085, 8, 40),
    lamps,
    0,
    0.91,
    0,
  );
  engineHalo.rotation.x = Math.PI / 2;
  ufo.userData.ramp = ramp;
  ufo.userData.hull = hull;
  ufo.userData.lights = lamps;
  ufo.userData.engineHalo = engineHalo;
  ufo.userData.blueLights = blueLamps;
  ufo.userData.disco = false;
  ufo.userData.rimLights = [lights, blueLights];
  ufo.userData.rimColor = new T.Color();
  ufo.userData.rimFrame = -1;
  // Board character staging can use this local-space point, transformed by ufo.localToWorld.
  ufo.userData.exit = new T.Vector3(0, 0.05, 3.94);
  upgradeUfo(ufo);
  return ufo;
}

// Blender-built saucer (art/blender/ufo.py → public/models/ufo.glb). The
// procedural ship above renders immediately and remains the offline fallback.
let ufoModel: Promise<T.Object3D> | undefined;
function upgradeUfo(ufo: T.Group) {
  ufoModel ??= loadModel('/models/ufo.glb').then((gltf) => gltf.scene);
  ufoModel
    .then((model) => {
      const rig = ufo.userData,
        hull = rig.hull as T.Group;
      if (!hull.parent) return; // ship was disposed while loading
      const ship = model.clone(true);
      const lamps = new Map<string, T.MeshStandardMaterial>();
      ship.traverse((o) => {
        const mesh = o as T.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = mesh.receiveShadow = true;
        const swap = (m: T.Material) => {
          if (!m.name.startsWith('Lamp')) return m;
          if (!lamps.has(m.name))
            lamps.set(m.name, (m as T.MeshStandardMaterial).clone());
          return lamps.get(m.name)!;
        };
        mesh.material = Array.isArray(mesh.material)
          ? mesh.material.map(swap)
          : swap(mesh.material);
        if (!Array.isArray(mesh.material) && mesh.material.name === 'Glass')
          mesh.renderOrder = 2;
      });
      const ramp = ship.getObjectByName('Ramp');
      if (!ramp) return;
      // Keep the code-driven rim lights and engine halo; hide the old body.
      const keep = new Set<T.Object3D>([...rig.rimLights, rig.engineHalo]);
      for (const child of [...hull.children])
        if (!keep.has(child)) child.visible = false;
      hull.add(ship);
      rig.ramp = ramp;
      rig.lights = lamps.get('LampGreen') ?? rig.lights;
      rig.blueLights = lamps.get('LampBlue') ?? rig.blueLights;
      rig.amber = lamps.get('LampAmber');
    })
    .catch(() => {
      // Missing model (e.g. the offline file): keep the procedural ship.
    });
}

/** Openness is 0 closed / 1 open; the owner controls arrival/landing position. */
export function animateUfo(
  ufo: T.Group,
  time: number,
  openness = 1,
  reduced = false,
) {
  const rig = ufo.userData;
  if (!rig.ramp) return;
  rig.ramp.rotation.x =
    T.MathUtils.clamp(openness, 0, 1) * (Math.PI / 2 + 0.23);
  rig.lights.emissiveIntensity = reduced
    ? 1.2
    : 1.25 + Math.sin(time * 2.4) * 0.3;
  if (rig.disco && !reduced) {
    rig.lights.emissiveIntensity = 1.2 + (Math.sin(time * 8) * 0.5 + 0.5) * 1.8;
    rig.blueLights.emissiveIntensity =
      1.2 + (Math.sin(time * 8 + Math.PI) * 0.5 + 0.5) * 1.8;
  } else if (rig.blueLights)
    rig.blueLights.emissiveIntensity = reduced
      ? 1.3
      : 1.3 + Math.sin(time * 2.4 + Math.PI) * 0.3;
  const chase = rig.disco && !reduced ? Math.floor(time * 10) : -2;
  if (chase !== rig.rimFrame && rig.rimLights) {
    rig.rimFrame = chase;
    rig.rimLights.forEach((mesh: T.InstancedMesh, row: number) => {
      for (let i = 0; i < 16; i++) {
        const phase = (i * 2 + row - (chase % 32) + 32) % 32;
        rig.rimColor
          .set(row ? '#168dff' : '#62ff20')
          .multiplyScalar(chase === -2 ? 0.72 : phase < 7 ? 1 : 0.18);
        mesh.setColorAt(i, rig.rimColor);
      }
      mesh.instanceColor!.needsUpdate = true;
    });
  }
  rig.engineHalo.scale.setScalar(
    reduced ? 1 : 1 + Math.sin(time * 3.2) * 0.025,
  );
  if (rig.amber)
    rig.amber.emissiveIntensity = reduced
      ? 2.2
      : 1.6 + (Math.sin(time * 5) > 0.6 ? 2.4 : 0);
}
