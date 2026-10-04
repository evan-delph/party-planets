import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Avatar } from './config';
import { loadModel } from './models';

/** Kept constant even when a visitor loads an older, colored character save. */
export const ALIEN_GREEN = '#86da62';

// ── Blender alien (art/blender/alien.py → public/models/alien.glb) ──────────
let alienModel: T.Object3D | undefined;
let alienLoading: Promise<void> | undefined;
const waiting = new Set<() => void>();
/** Start loading the modeled alien; avatars built earlier upgrade in place. */
export function preloadAlien() {
  alienLoading ??= loadModel('/models/alien.glb')
    .then((gltf) => {
      alienModel = gltf.scene;
      for (const upgrade of waiting) upgrade();
      waiting.clear();
    })
    .catch(() => {
      // Offline single-file build: keep the procedural aliens.
      waiting.clear();
    });
  return alienLoading;
}

export function makeAvatar(a: Avatar) {
  const g = new T.Group();
  g.userData.species = 'green-alien';
  if (alienModel) buildModeled(g, a, alienModel);
  else {
    const fallback = makeProceduralAvatar(a);
    g.add(...fallback.children);
    g.userData.rig = fallback.userData.rig;
    const upgrade = () => {
      if (!g.parent) return; // discarded before the model arrived
      for (const child of [...g.children]) {
        child.removeFromParent();
        disposeTree(child);
      }
      buildModeled(g, a, alienModel!);
    };
    waiting.add(upgrade);
    void preloadAlien();
  }
  g.scale.set(a.width, a.height, a.width);
  return g;
}

function disposeTree(o: T.Object3D) {
  o.traverse((x) => {
    const mesh = x as T.Mesh;
    if (mesh.isMesh) mesh.geometry.dispose();
  });
}

/** Clone the modeled alien and apply every Character Studio option. */
function buildModeled(g: T.Group, a: Avatar, model: T.Object3D) {
  const root = model.clone(true);
  const shirt = new T.Color(a.shirt);
  const recolor: Record<string, T.Color> = {
    Shirt: shirt,
    ShirtSeam: shirt.clone().lerp(new T.Color('#23334b'), 0.24),
    ShirtThread: shirt.clone().lerp(new T.Color('#fff2ce'), 0.6),
    Hair: new T.Color(a.hairColor ?? '#344552'),
    Eye: new T.Color(a.eyeColor ?? '#294d5d').lerp(new T.Color('#040d14'), 0.8),
    Shoe: new T.Color(a.shoeColor ?? '#183e47'),
  };
  const own = new Map<string, T.Material>();
  root.traverse((o) => {
    const mesh = o as T.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = mesh.receiveShadow = true;
    const swap = (m: T.Material) => {
      const color = recolor[m.name];
      if (!color) return m;
      if (!own.has(m.name)) {
        const copy = (m as T.MeshStandardMaterial).clone();
        copy.color.copy(color);
        own.set(m.name, copy);
      }
      return own.get(m.name)!;
    };
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(swap)
      : swap(mesh.material);
  });
  const part = (name: string) => root.getObjectByName(name);
  const show = (name: string, visible: boolean) => {
    const o = part(name);
    if (o) o.visible = visible;
  };
  for (let i = 1; i <= 7; i++) show('Hair' + i, a.hair === i);
  for (let i = 1; i <= 2; i++) show('Beard' + i, a.beard === i);
  for (let i = 1; i <= 6; i++) show('Acc' + i, a.accessory === i);
  const pattern = a.pattern ?? 4;
  show('Collar', pattern !== 4);
  show('Placket', pattern !== 4 && pattern !== 3);
  show('Stripes', pattern === 1);
  show('Dots', pattern === 2);
  show('Overalls', pattern === 3);
  show('Aloha', pattern === 4);
  show('Freckles', !!a.freckles);
  const gloves = a.gloves !== false;
  const spacing = T.MathUtils.clamp((a.eyeSpacing ?? 0.155) + 0.055, 0.18, 0.27);
  const eyes: T.Object3D[] = [],
    eyeBases: number[] = [],
    eyelids: T.Object3D[] = [],
    arms: T.Object3D[] = [],
    legs: T.Object3D[] = [];
  [-1, 1].forEach((side, i) => {
    show('Hand' + i, !gloves);
    show('Glove' + i, gloves);
    const eye = part('Eye' + i)!;
    eye.position.x = side * spacing;
    if (a.eyes === 2) eye.scale.x = 0.17;
    if (a.eyes === 1) eye.scale.y = 0.205;
    eyes.push(eye);
    eyeBases.push(eye.scale.y);
    // The animation rolls lids about Z; a pivot keeps that roll separate from
    // the mesh's fixed upright tilt (Blender and three compose Euler XYZ differently).
    const lidMesh = part('Lid' + i)!,
      lid = new T.Group();
    lid.position.set(side * spacing, lidMesh.position.y, lidMesh.position.z);
    lid.rotation.z = side * -0.23;
    lid.scale.y = a.eyes === 1 ? 1.1 : 1.36;
    lidMesh.parent!.add(lid);
    lid.add(lidMesh);
    lidMesh.position.set(0, 0, 0);
    lidMesh.rotation.set(Math.PI / 2, 0, 0);
    eyelids.push(lid);
    const brow = part('Brow' + i)!;
    brow.visible = (a.brows ?? 0) > 0 || a.eyes === 3;
    brow.position.x = side * spacing;
    brow.rotation.z = Math.PI / 2 + side * (a.brows === 3 ? 0.3 : -0.13);
    if (a.brows === 2) brow.scale.set(1.5, 1, 1.5);
    arms.push(part('Arm' + i)!);
    legs.push(part('Leg' + i)!);
  });
  const nose = part('Nose')!;
  nose.scale.multiplyScalar(a.nose === 1 ? 1.45 : a.nose === 3 ? 0.64 : 1);
  if (a.nose === 2) nose.scale.y *= 1.625;
  // Separate mouth objects per mood so toggling one never hides another.
  const face = part('Face')!;
  face.scale.setScalar(a.mouthScale ?? 1);
  const smile = part('MouthSmile')!,
    frown = part('MouthFrown')!,
    grin = part('MouthGrin')!;
  const neutral = (a.mouth === 2 ? grin : a.mouth === 1 ? frown : smile).clone();
  const happy = grin.clone(),
    sad = frown.clone();
  sad.position.y -= 0.055;
  for (const m of [smile, frown, grin]) m.visible = false;
  for (const m of [neutral, happy, sad]) {
    m.visible = true;
    face.add(m);
  }
  happy.visible = sad.visible = false;
  // Few draw calls: merge each rigid group's visible static parts by material.
  const animated = new Set<T.Object3D>([
    ...arms,
    ...legs,
    ...eyes,
    ...eyelids,
    face,
    nose,
    part('Brow0')!,
    part('Brow1')!,
  ]);
  mergeByMaterial(root, animated, true);
  for (const limb of [...arms, ...legs]) mergeByMaterial(limb, new Set(), true);
  for (const o of animated)
    o.traverse((x) => {
      if ((x as T.Mesh).isMesh) x.castShadow = false;
    });
  g.add(root);
  g.userData.rig = { arms, legs, neutral, happy, sad, eyes, eyeBases, eyelids };
}

/** Merge visible meshes under `group` (excluding `skip` subtrees) per material. */
function mergeByMaterial(group: T.Object3D, skip: Set<T.Object3D>, shadows: boolean) {
  group.updateMatrixWorld(true);
  const toLocal = group.matrixWorld.clone().invert();
  const buckets = new Map<T.Material, T.BufferGeometry[]>();
  const done: T.Object3D[] = [];
  const visit = (o: T.Object3D) => {
    if (o !== group && skip.has(o)) return;
    if (!o.visible) {
      done.push(o); // hidden option parts are dropped entirely
      return;
    }
    const mesh = o as T.Mesh;
    if (mesh.isMesh && !Array.isArray(mesh.material)) {
      const geometry = mesh.geometry.clone();
      for (const name of Object.keys(geometry.attributes))
        if (!['position', 'normal', 'uv'].includes(name)) geometry.deleteAttribute(name);
      if (!geometry.attributes.uv)
        geometry.setAttribute(
          'uv',
          new T.BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2),
        );
      geometry.applyMatrix4(toLocal.clone().multiply(mesh.matrixWorld));
      const list = buckets.get(mesh.material) ?? [];
      list.push(geometry.index ? geometry : geometry);
      buckets.set(mesh.material, list);
      done.push(mesh);
    }
    for (const child of [...o.children]) visit(child);
  };
  for (const child of [...group.children]) visit(child);
  for (const [material, list] of buckets) {
    const indexed = list.filter((g) => g.index),
      plain = list.filter((g) => !g.index);
    for (const set of [indexed, plain]) {
      if (!set.length) continue;
      const merged = mergeGeometries(set, false);
      set.forEach((g) => g.dispose());
      if (!merged) continue;
      const mesh = new T.Mesh(merged, material);
      mesh.castShadow = shadows;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  }
  // Remove merged sources (keeping any subtree that still holds animated parts).
  for (const o of done) {
    let keepsAnimated = false;
    o.traverse((x) => {
      if (x !== o && skip.has(x)) keepsAnimated = true;
    });
    if (keepsAnimated) {
      if ((o as T.Mesh).isMesh) (o as T.Mesh).visible = false;
      continue;
    }
    o.removeFromParent();
  }
}

function makeProceduralAvatar(a: Avatar) {
  const g = new T.Group();
  const materials = new Map<string, T.MeshStandardMaterial>();
  const mat = (c: string, glossy = false) => {
    const key = `${c}:${glossy}`;
    if (!materials.has(key))
      materials.set(
        key,
        new T.MeshStandardMaterial({
          color: c,
          roughness: glossy ? 0.14 : 0.48,
          metalness: glossy ? 0.12 : 0,
        }),
      );
    return materials.get(key)!;
  };
  const add = (
    geometry: T.BufferGeometry,
    color: string,
    x: number,
    y: number,
    z: number,
    parent: T.Object3D = g,
    glossy = false,
  ) => {
    const mesh = new T.Mesh(geometry, mat(color, glossy));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const sphere = (
    radius: number,
    c: string,
    x: number,
    y: number,
    z: number,
    parent: T.Object3D = g,
  ) => add(new T.SphereGeometry(radius, 14, 10), c, x, y, z, parent);

  // Earth clothes sit on a narrow, long-limbed visitor rather than hiding its face.
  add(new T.CapsuleGeometry(0.235, 0.4, 6, 14), ALIEN_GREEN, 0, 0.99, 0);
  add(new T.CylinderGeometry(0.125, 0.17, 0.24, 12), ALIEN_GREEN, 0, 1.32, 0);
  const head = sphere(0.46, ALIEN_GREEN, 0, 1.76, 0);
  head.scale.set(1.1, 1.14, 0.91);
  sphere(0.27, ALIEN_GREEN, 0, 1.42, 0.04).scale.set(0.9, 0.82, 0.95);
  add(new T.CylinderGeometry(0.277, 0.244, 0.43, 18), a.shirt, 0, 0.93, 0);
  add(new T.CylinderGeometry(0.282, 0.282, 0.035, 18), a.shirt, 0, 0.73, 0);
  mat(a.shirt).roughness = 0.82;
  const seamColor = `#${new T.Color(a.shirt).lerp(new T.Color('#23334b'), 0.24).getHexString()}`;
  const threadColor = `#${new T.Color(a.shirt).lerp(new T.Color('#fff2ce'), 0.6).getHexString()}`;
  // Rolled cloth edges, shoulder tailoring and embroidered hems catch the light.
  add(
    new T.TorusGeometry(0.253, 0.012, 6, 24),
    seamColor,
    0,
    0.737,
    0,
  ).rotation.x = Math.PI / 2;
  for (let stitch = 0; stitch < 24; stitch++) {
    const angle = (stitch * Math.PI) / 12;
    const thread = add(
      new T.CapsuleGeometry(0.004, 0.018, 3, 4),
      threadColor,
      Math.sin(angle) * 0.263,
      0.754,
      Math.cos(angle) * 0.263,
    );
    thread.rotation.z = 0.3;
  }
  if (a.pattern !== 4) {
    for (const side of [-1, 1]) {
      const collar = add(
        new T.BoxGeometry(0.092, 0.102, 0.025),
        threadColor,
        side * 0.069,
        1.106,
        0.274,
      );
      collar.rotation.z = side * 0.58;
    }
    if (a.pattern !== 3) {
      add(new T.BoxGeometry(0.028, 0.32, 0.016), seamColor, 0, 0.942, 0.273);
      for (let button = 0; button < 3; button++)
        sphere(0.012, '#fff2ce', 0, 0.835 + button * 0.103, 0.29);
      add(new T.BoxGeometry(0.098, 0.093, 0.02), a.shirt, -0.132, 1.01, 0.239);
      add(
        new T.BoxGeometry(0.1, 0.012, 0.018),
        threadColor,
        -0.132,
        1.046,
        0.253,
      );
    }
  }
  for (const side of [-1, 1]) {
    const ear = sphere(0.135, ALIEN_GREEN, side * 0.475, 1.785, -0.01);
    ear.scale.set(0.78, 1.36, 0.45);
    ear.rotation.z = side * -0.36;
    const innerEar = sphere(0.093, '#66b84e', side * 0.497, 1.79, 0.039);
    innerEar.scale.set(0.65, 1.24, 0.18);
    innerEar.rotation.z = side * -0.36;
  }

  if (a.pattern === 1) {
    for (let i = 0; i < 3; i++)
      add(
        new T.CylinderGeometry(0.283 - i * 0.009, 0.283 - i * 0.009, 0.035, 18),
        '#fff3d1',
        0,
        1.09 - i * 0.14,
        0,
      );
  }
  if (a.pattern === 2) {
    for (let i = 0; i < 8; i++) {
      const angle = i * 2.4;
      sphere(
        0.038,
        '#ffea88',
        Math.sin(angle) * 0.263,
        0.8 + (i % 3) * 0.12,
        Math.cos(angle) * 0.263,
      );
    }
  }
  if (a.pattern === 3) {
    add(new T.BoxGeometry(0.07, 0.36, 0.025), '#e8d4ac', -0.14, 0.93, 0.24);
    add(new T.BoxGeometry(0.07, 0.36, 0.025), '#e8d4ac', 0.14, 0.93, 0.24);
    add(new T.BoxGeometry(0.35, 0.19, 0.035), '#e8d4ac', 0, 0.81, 0.258);
  }
  if (a.pattern === 4) {
    // Flowers wrap around the whole shirt, with a real collar and button placket.
    add(new T.BoxGeometry(0.028, 0.37, 0.018), '#fff2be', 0, 0.93, 0.281);
    for (const side of [-1, 1]) {
      const collar = add(
        new T.BoxGeometry(0.1, 0.12, 0.026),
        '#fff2be',
        side * 0.075,
        1.095,
        0.252,
      );
      collar.rotation.z = side * 0.55;
    }
    for (let i = 0; i < 3; i++)
      sphere(0.014, '#fefbf0', 0, 0.81 + i * 0.105, 0.299);
    for (let i = 0; i < 9; i++) {
      const angle = i * 2.4 + 0.42;
      const flower = new T.Group();
      flower.position.set(
        Math.sin(angle) * 0.271,
        0.805 + (i % 3) * 0.113,
        Math.cos(angle) * 0.271,
      );
      flower.rotation.y = angle;
      g.add(flower);
      for (let petal = 0; petal < 5; petal++) {
        const theta = petal * Math.PI * 0.4;
        const mesh = sphere(
          0.025,
          i % 2 ? '#ffdc74' : '#fff8df',
          Math.sin(theta) * 0.026,
          Math.cos(theta) * 0.026,
          0.006,
          flower,
        );
        mesh.scale.set(0.8, 1.1, 0.22);
        mesh.rotation.z = -theta;
      }
      sphere(0.016, '#ef877e', 0, 0, 0.014, flower).scale.z = 0.25;
      const leaf = sphere(0.027, '#255f58', 0.04, -0.028, 0.002, flower);
      leaf.scale.set(0.5, 1.2, 0.18);
      leaf.rotation.z = -0.6;
      flower.updateMatrix();
      for (const part of [...flower.children]) {
        part.applyMatrix4(flower.matrix);
        g.add(part);
      }
      flower.removeFromParent();
    }
  }

  const arms: T.Group[] = [],
    legs: T.Group[] = [];
  for (const side of [-1, 1]) {
    const arm = new T.Group();
    arm.position.set(side * 0.29, 1.1, 0);
    g.add(arm);
    add(
      new T.CapsuleGeometry(0.068, 0.38, 5, 9),
      ALIEN_GREEN,
      side * 0.045,
      -0.21,
      0,
      arm,
    );
    add(
      new T.CylinderGeometry(0.088, 0.082, 0.14, 10),
      a.shirt,
      side * 0.035,
      -0.05,
      0,
      arm,
    );
    const handColor = a.gloves === false ? ALIEN_GREEN : '#f7f1d9';
    sphere(0.092, handColor, side * 0.06, -0.46, 0.015, arm).scale.set(
      0.8,
      1.16,
      0.75,
    );
    for (let finger = 0; finger < 3; finger++)
      add(
        new T.CapsuleGeometry(0.023, 0.07, 3, 5),
        handColor,
        side * 0.06 + (finger - 1) * 0.037,
        -0.53,
        0.025,
        arm,
      );
    sphere(0.035, handColor, side * 0.124, -0.443, 0.06, arm).scale.set(
      0.76,
      1.22,
      0.74,
    );
    if (a.gloves !== false) {
      add(
        new T.CylinderGeometry(0.079, 0.077, 0.045, 10),
        '#d4e3c6',
        side * 0.06,
        -0.397,
        0.011,
        arm,
      );
      for (let seam = 0; seam < 2; seam++)
        add(
          new T.BoxGeometry(0.008, 0.044, 0.008),
          '#bbcba8',
          side * 0.06 + (seam - 0.5) * 0.036,
          -0.462,
          0.078,
          arm,
        );
    }
    arms.push(arm);
    const leg = new T.Group();
    leg.position.set(side * 0.14, 0.67, 0);
    g.add(leg);
    add(
      new T.CapsuleGeometry(0.065, 0.39, 5, 9),
      ALIEN_GREEN,
      0,
      -0.25,
      0,
      leg,
    );
    sphere(0.13, a.shoeColor ?? '#183e47', 0, -0.57, 0.08, leg).scale.set(
      0.84,
      0.62,
      1.55,
    );
    add(new T.BoxGeometry(0.14, 0.018, 0.09), '#ecf2d8', 0, -0.5, 0.13, leg);
    sphere(0.13, '#e4edcf', 0, -0.628, 0.082, leg).scale.set(0.86, 0.17, 1.59);
    for (let lace = 0; lace < 3; lace++)
      add(
        new T.BoxGeometry(0.112, 0.013, 0.016),
        '#fff9dd',
        0,
        -0.49 + lace * 0.006,
        0.086 + lace * 0.034,
        leg,
      ).rotation.y = lace % 2 ? 0.16 : -0.16;
    add(
      new T.BoxGeometry(0.064, 0.063, 0.012),
      a.shirt,
      0,
      -0.548,
      -0.043,
      leg,
    );
    legs.push(leg);
  }

  const eyes: T.Mesh[] = [];
  const eyeBases: number[] = [];
  const eyelids: T.Mesh[] = [];
  const eyeHue = new T.Color(a.eyeColor ?? '#294d5d')
    .lerp(new T.Color('#040d14'), 0.8)
    .getHexString();
  for (const side of [-1, 1]) {
    const spacing = T.MathUtils.clamp(
      (a.eyeSpacing ?? 0.155) + 0.055,
      0.18,
      0.27,
    );
    const eye = add(
      new T.SphereGeometry(1, 20, 14),
      `#${eyeHue}`,
      side * spacing,
      1.835,
      0.349,
      g,
      true,
    );
    eye.scale.set(
      a.eyes === 2 ? 0.17 : 0.185,
      a.eyes === 1 ? 0.205 : 0.253,
      0.092,
    );
    eye.rotation.z = side * -0.23;
    const lid = add(
      new T.TorusGeometry(0.184, 0.012, 6, 26, Math.PI),
      '#65b849',
      side * spacing,
      1.835,
      0.389,
    );
    lid.scale.y = a.eyes === 1 ? 1.1 : 1.36;
    lid.rotation.z = side * -0.23;
    lid.userData.animated = true;
    eyelids.push(lid);
    // Highlights are children so a blink closes the entire eye naturally.
    sphere(0.14, '#e6fffb', -0.32, 0.4, 0.89, eye).scale.set(0.66, 1.15, 0.15);
    sphere(0.075, '#a4d6e2', 0.29, -0.38, 0.94, eye).scale.z = 0.15;
    eyes.push(eye);
    eyeBases.push(eye.scale.y);
    if ((a.brows ?? 0) > 0 || a.eyes === 3) {
      const brow = add(
        new T.CapsuleGeometry(a.brows === 2 ? 0.018 : 0.012, 0.17, 4, 8),
        a.hairColor ?? '#344552',
        side * spacing,
        2.11,
        0.303,
      );
      brow.rotation.z = Math.PI / 2 + side * (a.brows === 3 ? 0.3 : -0.13);
    }
  }
  const nose = sphere(
    a.nose === 1 ? 0.064 : a.nose === 3 ? 0.028 : 0.044,
    '#75c454',
    0,
    1.535,
    0.344,
  );
  nose.scale.set(0.78, a.nose === 2 ? 1.3 : 0.8, 0.9);
  const face = new T.Group();
  face.position.set(0, 1.425, 0.334);
  face.scale.setScalar(a.mouthScale ?? 1);
  g.add(face);
  const mouth = (mood: string) => {
    const group = new T.Group();
    face.add(group);
    if (mood === 'happy' || (a.mouth === 2 && mood === 'neutral')) {
      sphere(0.1, '#173b30', 0, 0, 0, group).scale.set(1.2, 0.76, 0.23);
      add(
        new T.BoxGeometry(0.15, 0.034, 0.016),
        '#fffde2',
        0,
        0.025,
        0.024,
        group,
      );
      sphere(0.04, '#e48490', 0, -0.038, 0.022, group).scale.set(
        1.3,
        0.3,
        0.13,
      );
    } else {
      const mesh = add(
        new T.TorusGeometry(0.092, 0.02, 7, 20, Math.PI),
        '#23422c',
        0,
        mood === 'sad' ? -0.03 : 0.025,
        0.015,
        group,
      );
      mesh.rotation.z =
        mood === 'sad' || (a.mouth === 1 && mood === 'neutral') ? 0 : Math.PI;
    }
    return group;
  };
  const neutral = mouth('neutral'),
    happy = mouth('happy'),
    sad = mouth('sad');
  happy.visible = sad.visible = false;
  for (const side of [-1, 1]) {
    sphere(0.055, '#b1e873', side * 0.22, 1.5, 0.304).scale.set(1.1, 0.55, 0.2);
    if (a.freckles)
      for (let i = 0; i < 3; i++)
        sphere(
          0.012,
          '#437e46',
          side * (0.18 + i * 0.038),
          1.52 - (i % 2) * 0.03,
          0.344 - i * 0.025,
        );
  }

  const hc = a.hairColor ?? '#344552';
  if (a.hair === 1)
    for (let i = 0; i < 5; i++)
      sphere(
        0.11,
        hc,
        (i - 2) * 0.14,
        2.23 + Math.sin(i) * 0.025,
        -0.025,
      ).scale.y = 0.8;
  if (a.hair === 2)
    add(new T.ConeGeometry(0.22, 0.34, 12), hc, 0, 2.3, -0.03).rotation.z =
      -0.2;
  if (a.hair === 3) sphere(0.45, hc, 0, 2.17, -0.17).scale.set(1.06, 0.4, 0.8);
  if (a.hair === 4)
    for (let i = 0; i < 3; i++)
      add(new T.ConeGeometry(0.13, 0.32, 9), hc, (i - 1) * 0.18, 2.28, -0.01);
  if (a.hair === 5) {
    add(new T.CylinderGeometry(0.56, 0.56, 0.045, 24), '#f7e0a0', 0, 2.2, 0);
    add(new T.CylinderGeometry(0.3, 0.4, 0.19, 20), '#e0af66', 0, 2.31, 0);
    add(new T.CylinderGeometry(0.36, 0.38, 0.05, 20), a.shirt, 0, 2.245, 0);
  }
  if (a.hair === 6) {
    sphere(0.41, hc, 0, 2.2, -0.11).scale.set(1, 0.35, 0.8);
    sphere(0.19, hc, 0, 2.06, -0.45);
  }
  if (a.hair === 7)
    for (let i = 0; i < 5; i++)
      add(new T.ConeGeometry(0.09, 0.22, 8), hc, 0, 2.26, (-2 + i) * 0.14);
  if (a.beard === 1)
    for (const side of [-1, 1])
      add(
        new T.CapsuleGeometry(0.023, 0.065, 4, 7),
        hc,
        side * 0.064,
        1.475,
        0.365,
      ).rotation.z = side * 0.85;
  if (a.beard === 2) sphere(0.075, hc, 0, 1.28, 0.254).scale.set(1, 0.65, 0.4);
  if (a.accessory === 1) {
    for (const side of [-1, 1]) {
      const frame = add(
        new T.TorusGeometry(0.198, 0.022, 8, 24),
        '#f2cd65',
        side * 0.21,
        1.835,
        0.44,
      );
      frame.scale.set(0.98, 1.23, 1);
      frame.rotation.z = side * -0.23;
    }
    add(new T.BoxGeometry(0.09, 0.025, 0.026), '#f2cd65', 0, 1.845, 0.445);
  }
  if (a.accessory === 2) {
    for (let i = 0; i < 5; i++)
      sphere(
        0.068,
        '#ff79a7',
        0.42 + Math.sin(i * 1.256) * 0.08,
        2.08 + Math.cos(i * 1.256) * 0.08,
        0.1,
      ).scale.z = 0.4;
    sphere(0.05, '#ffe166', 0.42, 2.08, 0.145);
  }
  if (a.accessory === 3) {
    add(new T.CylinderGeometry(0.43, 0.46, 0.085, 20), '#ffda61', 0, 2.2, 0);
    for (let i = 0; i < 5; i++)
      add(
        new T.ConeGeometry(0.07, 0.2, 5),
        '#ffda61',
        Math.sin(i * 1.256) * 0.38,
        2.32,
        Math.cos(i * 1.256) * 0.38,
      );
  }
  if (a.accessory === 4)
    add(
      new T.TorusGeometry(0.34, 0.07, 8, 24),
      '#fa718c',
      0,
      0.77,
      0,
    ).rotation.x = Math.PI / 2;
  if (a.accessory === 5) {
    for (const side of [-1, 1])
      sphere(0.13, '#a4dcf0', side * 0.49, 1.89, -0.025).scale.set(
        0.65,
        1.3,
        1,
      );
    add(
      new T.TorusGeometry(0.49, 0.035, 8, 24, Math.PI),
      '#294f6f',
      0,
      1.87,
      -0.02,
    );
  }
  if (a.accessory === 6)
    add(new T.BoxGeometry(0.25, 0.31, 0.14), '#a683d2', 0, 0.98, -0.3);

  // Static detail shares a draw per material; joints and blinking eyes remain independent.
  const bake = (parent: T.Object3D) => {
    parent.children.filter((child) => child instanceof T.Group).forEach(bake);
    const buckets = new Map<T.Material, T.Mesh[]>();
    for (const child of parent.children) {
      if (
        !(child instanceof T.Mesh) ||
        child.userData.animated ||
        child.children.length ||
        Array.isArray(child.material)
      )
        continue;
      const meshes = buckets.get(child.material) ?? [];
      meshes.push(child);
      buckets.set(child.material, meshes);
    }
    for (const [material, meshes] of buckets) {
      if (meshes.length < 2) continue;
      const pieces = meshes.map((mesh) => {
        mesh.updateMatrix();
        const geometry = mesh.geometry.index
          ? mesh.geometry.toNonIndexed()
          : mesh.geometry.clone();
        return geometry.applyMatrix4(mesh.matrix);
      });
      const geometry = mergeGeometries(pieces, false);
      pieces.forEach((piece) => piece.dispose());
      if (!geometry) continue;
      const merged = new T.Mesh(geometry, material);
      merged.castShadow = merged.receiveShadow = true;
      parent.add(merged);
      meshes.forEach((mesh) => {
        mesh.removeFromParent();
        mesh.geometry.dispose();
      });
    }
  };
  bake(g);
  g.userData.rig = { arms, legs, neutral, happy, sad, eyes, eyeBases, eyelids };
  return g;
}

export function animateAvatar(
  g: T.Group,
  t: number,
  speed: number,
  mood = 'neutral',
  reduced = false,
) {
  const rig = g.userData.rig;
  if (!rig) return;
  const stride = reduced
    ? 0
    : Math.sin(t * (speed > 5 ? 18 : 11)) * Math.min(0.9, speed * 0.14);
  rig.arms.forEach((arm: T.Group, i: number) => {
    arm.rotation.x = (i ? 1 : -1) * stride;
    arm.rotation.z =
      mood === 'happy'
        ? (i ? -1 : 1) * 2.3
        : (i ? 1 : -1) * (mood === 'sad' ? 0.05 : 0.14);
  });
  rig.legs.forEach((leg: T.Group, i: number) => {
    leg.rotation.x = (i ? -1 : 1) * stride;
  });
  rig.neutral.visible = mood !== 'happy' && mood !== 'sad';
  rig.happy.visible = mood === 'happy';
  rig.sad.visible = mood === 'sad';
  const blinkPhase = t % 4.7;
  const blink =
    !reduced && blinkPhase < 0.15
      ? Math.max(0.1, Math.abs(blinkPhase - 0.075) / 0.075)
      : 1;
  rig.eyes.forEach((eye: T.Mesh, i: number) => {
    eye.scale.y =
      rig.eyeBases[i] *
      blink *
      (mood === 'happy' ? 0.87 : mood === 'sad' ? 0.91 : 1);
  });
  rig.eyelids?.forEach((lid: T.Mesh, i: number) => {
    lid.rotation.z =
      (i ? 1 : -1) * (mood === 'sad' ? 0.03 : mood === 'happy' ? -0.32 : -0.23);
  });
  g.rotation.z = reduced
    ? 0
    : mood === 'sad'
      ? Math.sin(t * 3) * 0.05
      : Math.sin(t * 11) * Math.min(0.035, speed * 0.01);
}
