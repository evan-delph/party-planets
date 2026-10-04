import * as T from 'three';
import { Avatar, DEFAULT_AVATAR } from './config';
import { makeAvatar, animateAvatar } from './avatar';
import { makeUfo, animateUfo } from './Ufo';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function mergeStatic(root: T.Group) {
  root.updateMatrixWorld(true);
  const buckets = new Map<T.Material, T.Mesh[]>();
  root.traverse((object) => {
    if (
      !(object instanceof T.Mesh) ||
      object instanceof T.InstancedMesh ||
      Array.isArray(object.material)
    )
      return;
    const bucket = buckets.get(object.material) ?? [];
    bucket.push(object);
    buckets.set(object.material, bucket);
  });
  const inverse = root.matrixWorld.clone().invert();
  for (const [material, objects] of buckets) {
    if (objects.length < 2) continue;
    const pieces = objects.map((object) => {
      const geometry = object.geometry.index
        ? object.geometry.toNonIndexed()
        : object.geometry.clone();
      return geometry.applyMatrix4(
        new T.Matrix4().multiplyMatrices(inverse, object.matrixWorld),
      );
    });
    const geometry = mergeGeometries(pieces, false);
    pieces.forEach((piece) => piece.dispose());
    if (!geometry) continue;
    const joined = new T.Mesh(geometry, material);
    joined.castShadow = joined.receiveShadow = true;
    root.add(joined);
    const disposed = new Set<T.BufferGeometry>();
    objects.forEach((object) => {
      object.removeFromParent();
      if (!disposed.has(object.geometry)) {
        disposed.add(object.geometry);
        object.geometry.dispose();
      }
    });
  }
}

/** A hand-held glass with visible liquid, striped straw, paper umbrella and garnish. */
export function makeCocktail(color: T.ColorRepresentation, pinaColada = false) {
  const drink = new T.Group();
  drink.name = pinaColada
    ? 'Pina colada with umbrella'
    : 'Colored umbrella cocktail';
  const materials = new Map<string, T.MeshStandardMaterial>();
  const solid = (c: T.ColorRepresentation) => {
    const key = new T.Color(c).getHexString();
    if (!materials.has(key))
      materials.set(
        key,
        new T.MeshStandardMaterial({ color: c, roughness: 0.42 }),
      );
    return materials.get(key)!;
  };
  const add = (
    geometry: T.BufferGeometry,
    material: T.Material,
    x: number,
    y: number,
    z: number,
    parent: T.Object3D = drink,
  ) => {
    const mesh = new T.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const glass = new T.MeshPhysicalMaterial({
    color: '#d8f8ff',
    transparent: true,
    opacity: 0.23,
    roughness: 0.08,
    metalness: 0,
    clearcoat: 1,
    side: T.DoubleSide,
    depthWrite: false,
  });
  const profile = (
    pinaColada
      ? [
          [0.095, 0.025],
          [0.073, 0.055],
          [0.032, 0.13],
          [0.04, 0.18],
          [0.1, 0.25],
          [0.125, 0.36],
          [0.116, 0.435],
        ]
      : [
          [0.09, 0.025],
          [0.085, 0.04],
          [0.102, 0.22],
          [0.127, 0.435],
        ]
  ).map(([x, y]) => new T.Vector2(x, y));
  add(new T.LatheGeometry(profile, 24), glass, 0, 0, 0);
  add(new T.CylinderGeometry(0.102, 0.09, 0.023, 20), glass, 0, 0.014, 0);
  const liquidProfile = (
    pinaColada
      ? [
          [0, 0.2],
          [0.042, 0.205],
          [0.09, 0.26],
          [0.114, 0.36],
          [0.11, 0.396],
          [0, 0.396],
        ]
      : [
          [0, 0.04],
          [0.076, 0.04],
          [0.112, 0.385],
          [0, 0.385],
        ]
  ).map(([x, y]) => new T.Vector2(x, y));
  const liquid = add(
    new T.LatheGeometry(liquidProfile, 24),
    solid(pinaColada ? '#fff0bc' : color),
    0,
    0,
    0,
  );
  liquid.userData.liquid = true;
  add(new T.TorusGeometry(0.117, 0.008, 6, 24), glass, 0, 0.43, 0).rotation.x =
    Math.PI / 2;
  for (let i = 0; i < 3; i++) {
    const ice = add(
      new T.BoxGeometry(0.055, 0.04, 0.055),
      glass,
      Math.sin(i * 2.1) * 0.055,
      0.397,
      Math.cos(i * 2.1) * 0.055,
    );
    ice.rotation.y = i;
  }
  const strawCurve = new T.CatmullRomCurve3([
    new T.Vector3(0.035, 0.27, -0.04),
    new T.Vector3(0.025, 0.53, -0.05),
    new T.Vector3(-0.03, 0.6, -0.07),
    new T.Vector3(-0.15, 0.615, -0.075),
  ]);
  add(
    new T.TubeGeometry(strawCurve, 20, 0.013, 6, false),
    solid('#fff5d9'),
    0,
    0,
    0,
  );
  for (let i = 0; i < 5; i++)
    add(
      new T.CylinderGeometry(0.014, 0.014, 0.021, 6),
      solid('#ed788b'),
      0.026 + i * 0.002,
      0.33 + i * 0.036,
      -0.047 + i * 0.001,
    );
  const umbrella = new T.Group();
  umbrella.name = 'Paper umbrella';
  umbrella.position.set(0.105, 0.35, 0.065);
  umbrella.rotation.z = -0.26;
  drink.add(umbrella);
  add(
    new T.CylinderGeometry(0.008, 0.009, 0.4, 6),
    solid('#c9a176'),
    0,
    0.2,
    0,
    umbrella,
  );
  const canopyGeometry = new T.ConeGeometry(
    0.21,
    0.11,
    8,
    1,
    true,
  ).toNonIndexed();
  const positions = canopyGeometry.getAttribute('position'),
    colors = [];
  const bright = new T.Color(pinaColada ? '#ff938b' : color);
  const light = bright.clone().lerp(new T.Color('#fff4d8'), 0.6);
  for (let i = 0; i < positions.count; i++) {
    const triangle = Math.floor(i / 3),
      c = triangle % 2 ? bright : light;
    colors.push(c.r, c.g, c.b);
  }
  canopyGeometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  add(
    canopyGeometry,
    new T.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.82,
      side: T.DoubleSide,
    }),
    0,
    0.39,
    0,
    umbrella,
  );
  add(
    new T.SphereGeometry(0.018, 8, 6),
    solid('#fff3bf'),
    0,
    0.455,
    0,
    umbrella,
  );
  const garnish = new T.Group();
  garnish.position.set(-0.115, 0.43, 0.025);
  garnish.rotation.z = -0.2;
  drink.add(garnish);
  const wedge = add(
    new T.CircleGeometry(0.085, 12, 0, Math.PI * 1.55),
    solid(pinaColada ? '#ffc95d' : '#c7ec7c'),
    0,
    0,
    0,
    garnish,
  );
  (wedge.material as T.MeshStandardMaterial).side = T.DoubleSide;
  if (pinaColada) {
    for (let i = 0; i < 3; i++) {
      const leaf = add(
        new T.ConeGeometry(0.019, 0.11, 4),
        solid('#5f985a'),
        -0.02 + i * 0.017,
        0.075,
        0,
        garnish,
      );
      leaf.rotation.z = (i - 1) * 0.4;
    }
    add(
      new T.SphereGeometry(0.031, 10, 8),
      solid('#f2647b'),
      0.055,
      0.421,
      0.03,
    );
  }
  mergeStatic(drink);
  drink.userData.pinaColada = pinaColada;
  drink.userData.hasUmbrella = drink.userData.hasStraw = true;
  return drink;
}

export type FinaleStage =
  | 'toast'
  | 'dance'
  | 'boarding'
  | 'departure'
  | 'lounge';
export type FinaleController = {
  group: T.Group;
  exterior: T.Group;
  interior: T.Group;
  ship: T.Group;
  crew: T.Group[];
  cameraPosition: T.Vector3;
  cameraTarget: T.Vector3;
  cameraFov: number;
  stage: FinaleStage;
  caption: string;
  duration: number;
  complete: boolean;
  winnerIndex: number;
  setWinner: (index: number) => void;
  update: (elapsedSeconds: number, reduced?: boolean) => void;
  dispose: () => void;
};

/** Deterministic cinematic. All coordinates are local to group; caller owns camera and render loop. */
export function createFinale(
  parent: T.Object3D,
  avatars: Avatar[],
  winnerIndex: number,
  mode: 'winner' | 'bonus',
): FinaleController {
  const group = new T.Group(),
    exterior = new T.Group(),
    interior = new T.Group();
  group.name = 'Party Planets finale';
  group.add(exterior, interior);
  parent.add(group);
  const source = avatars.length ? avatars.slice(0, 4) : [DEFAULT_AVATAR];
  let champion = T.MathUtils.clamp(
    Math.trunc(winnerIndex),
    0,
    source.length - 1,
  );
  const materials = new Map<string, T.MeshStandardMaterial>();
  const mat = (c: string, glow = false) => {
    const key = `${c}:${glow}`;
    if (!materials.has(key))
      materials.set(
        key,
        new T.MeshStandardMaterial({
          color: c,
          roughness: glow ? 0.26 : 0.63,
          metalness: glow ? 0.25 : 0,
          emissive: glow ? c : '#000000',
          emissiveIntensity: glow ? 0.6 : 0,
        }),
      );
    return materials.get(key)!;
  };
  const add = (
    target: T.Object3D,
    geometry: T.BufferGeometry,
    c: string,
    x: number,
    y: number,
    z: number,
    glow = false,
  ) => {
    const mesh = new T.Mesh(geometry, mat(c, glow));
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    target.add(mesh);
    return mesh;
  };
  const stageScenery = new T.Group();
  exterior.add(stageScenery);
  add(
    stageScenery,
    new T.CylinderGeometry(7.8, 8.5, 0.38, 48),
    '#bbdcb6',
    0,
    -0.2,
    0,
  );
  add(
    stageScenery,
    new T.CylinderGeometry(7.1, 7.5, 0.035, 48),
    '#e6d9b0',
    0,
    0.008,
    0,
  );
  for (let i = 0; i < 12; i++) {
    const angle = (i * Math.PI) / 6;
    add(
      stageScenery,
      new T.CylinderGeometry(0.07, 0.11, 0.8, 8),
      '#647d88',
      Math.sin(angle) * 7.2,
      0.4,
      Math.cos(angle) * 7.2,
    );
    add(
      stageScenery,
      new T.SphereGeometry(0.13, 10, 8),
      i % 2 ? '#66cfff' : '#93f3bb',
      Math.sin(angle) * 7.2,
      0.85,
      Math.cos(angle) * 7.2,
      true,
    );
  }
  mergeStatic(stageScenery);
  const ship = makeUfo();
  ship.position.set(0, 0, -4.5);
  ship.userData.disco = true;
  exterior.add(ship);
  const crew = source.map((a) => makeAvatar(a)),
    drinks = source.map((_, i) =>
      makeCocktail(
        ['#ff87ae', '#69d9f1', '#bc8cff', '#ffd269'][i],
        i === champion && mode === 'winner',
      ),
    );
  crew.forEach((alien, i) => {
    exterior.add(alien);
    alien.add(drinks[i]);
    drinks[i].scale.setScalar(0.82);
  });
  const starting = crew.map((_, i) =>
    i === champion && mode === 'winner'
      ? new T.Vector3(0, 0, 2.5)
      : new T.Vector3(
          (i - (crew.length - 1) / 2) * 1.65,
          0,
          mode === 'winner' ? 0.3 : 2.1,
        ),
  );
  if (mode === 'winner') {
    let side = 0;
    starting.forEach((point, i) => {
      if (i !== champion) {
        point.x = [-2.9, 2.9, 0][side++];
        point.z = i === crew.length - 1 ? -0.2 : 0.2;
      }
    });
  }
  const interiorScenery = new T.Group();
  interior.add(interiorScenery);
  add(
    interiorScenery,
    new T.CylinderGeometry(6.1, 6.1, 0.25, 48),
    '#253e61',
    0,
    -0.17,
    0,
  );
  const wall = add(
    interiorScenery,
    new T.CylinderGeometry(6, 6, 3.9, 40, 1, true, Math.PI / 2, Math.PI),
    '#334e77',
    0,
    1.8,
    0,
  );
  (wall.material as T.MeshStandardMaterial).side = T.DoubleSide;
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 2 + ((i + 0.5) * Math.PI) / 6,
      x = Math.sin(angle) * 5.78,
      z = Math.cos(angle) * 5.78;
    const windowGroup = new T.Group();
    windowGroup.position.set(x, 2.25, z);
    windowGroup.rotation.y = angle + Math.PI;
    interiorScenery.add(windowGroup);
    add(windowGroup, new T.CircleGeometry(0.66, 24), '#11203e', 0, 0, 0);
    add(
      windowGroup,
      new T.TorusGeometry(0.67, 0.065, 8, 24),
      '#8dacce',
      0,
      0,
      0.03,
    );
    for (let star = 0; star < 5; star++)
      add(
        windowGroup,
        new T.SphereGeometry(0.022 + (star % 2) * 0.008, 5, 4),
        '#e9f7ff',
        Math.sin(star * 2.4) * 0.43,
        Math.cos(star * 2.4) * 0.45,
        0.015,
        true,
      );
  }
  for (const side of [-1, 1]) {
    add(
      interiorScenery,
      new T.BoxGeometry(2.6, 0.45, 0.94),
      '#a97cbd',
      side * 3.9,
      0.38,
      -1.3,
    );
    add(
      interiorScenery,
      new T.BoxGeometry(2.6, 0.78, 0.25),
      '#bb94d1',
      side * 3.9,
      0.9,
      -1.8,
    );
    add(
      interiorScenery,
      new T.BoxGeometry(2.6, 0.035, 0.88),
      '#d7b4e4',
      side * 3.9,
      0.625,
      -1.3,
    );
  }
  add(
    interiorScenery,
    new T.BoxGeometry(4.7, 1.1, 0.8),
    '#7a9fb4',
    0,
    0.55,
    -4.4,
  );
  add(
    interiorScenery,
    new T.BoxGeometry(5, 0.12, 1.02),
    '#f7dfb1',
    0,
    1.13,
    -4.4,
  );
  for (let i = 0; i < 7; i++) {
    add(
      interiorScenery,
      new T.CylinderGeometry(0.07, 0.095, 0.32 + (i % 2) * 0.1, 10),
      ['#83dba3', '#ffb3c1', '#72c8fa'][i % 3],
      -2 + i * 0.64,
      1.36,
      -4.4,
      true,
    );
  }
  const floorLights = new T.InstancedMesh(
    new T.BoxGeometry(0.75, 0.025, 0.75),
    new T.MeshStandardMaterial({
      color: '#ffffff',
      vertexColors: false,
      emissive: '#80c8df',
      emissiveIntensity: 0.5,
      roughness: 0.25,
    }),
    36,
  );
  const matrix = new T.Matrix4(),
    cyan = new T.Color('#6cbfff'),
    green = new T.Color('#9ef5ae');
  for (let i = 0; i < 36; i++) {
    matrix.makeTranslation(
      ((i % 6) - 2.5) * 0.88,
      0.003,
      (Math.floor(i / 6) - 2.5) * 0.88,
    );
    floorLights.setMatrixAt(i, matrix);
    floorLights.setColorAt(i, i % 2 ? cyan : green);
  }
  interior.add(floorLights);
  const discoBall = add(
    interior,
    new T.IcosahedronGeometry(0.45, 1),
    '#c6f5ff',
    0,
    3.45,
    0,
    true,
  );
  add(
    interiorScenery,
    new T.CylinderGeometry(0.016, 0.016, 0.65, 6),
    '#9eb5d7',
    0,
    4.0,
    0,
  );
  mergeStatic(interiorScenery);
  const confetti = new T.InstancedMesh(
    new T.BoxGeometry(0.07, 0.1, 0.025),
    new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 }),
    56,
  );
  for (let i = 0; i < 56; i++)
    confetti.setColorAt(
      i,
      new T.Color(['#ffca61', '#9ce1b1', '#83cfff', '#ff9eae'][i % 4]),
    );
  exterior.add(confetti);
  const pose = new T.Object3D(),
    hand = new T.Vector3(),
    bodyParent = new Map<T.Group, T.Object3D>();
  const drinkOffset = new T.Vector3(0, -0.16, -0.07),
    shipLookOffset = new T.Vector3(0, 1.5, 0);
  let disposed = false,
    winnerAnnounced = false;
  const blend = (value: number) => {
    const x = T.MathUtils.clamp(value, 0, 1);
    return x * x * (3 - 2 * x);
  };
  const boardingAt = mode === 'winner' ? 10.5 : 1.5;
  const takeoffAt = boardingAt + 7.3;
  const loungeAt = takeoffAt + 5.4;
  const controller: FinaleController = {
    group,
    exterior,
    interior,
    ship,
    crew,
    cameraPosition: new T.Vector3(),
    cameraTarget: new T.Vector3(),
    cameraFov: 42,
    stage: 'toast',
    caption: 'Cheers to our visitor of honor!',
    duration: mode === 'winner' ? 28 : 42,
    complete: false,
    winnerIndex: champion,
    setWinner(index: number) {
      champion = T.MathUtils.clamp(Math.trunc(index), 0, source.length - 1);
      controller.winnerIndex = champion;
      winnerAnnounced = true;
    },
    update(elapsedSeconds: number, reduced = false) {
      if (disposed) return;
      const t = Math.max(
        0,
        Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0,
      );
      const inside = t >= loungeAt && mode === 'bonus';
      exterior.visible = !inside;
      interior.visible = inside;
      controller.complete = t >= controller.duration;
      controller.stage = inside
        ? 'lounge'
        : t >= takeoffAt
          ? 'departure'
          : t >= boardingAt
            ? 'boarding'
            : t >= 4
              ? 'dance'
              : 'toast';
      controller.caption = inside
        ? 'A little Earth hospitality, all the way home.'
        : t >= takeoffAt
          ? 'Next stop: another party planet.'
          : t >= boardingAt
            ? 'Umbrellas up. All aboard!'
            : t >= 4
              ? 'One small sip. One giant victory dance.'
              : `${source[champion].name} — cheers to the champion!`;
      const celebration = inside && winnerAnnounced && t >= 31;
      if (celebration)
        controller.caption = `${source[champion].name} is the Party Planets champion!`;
      const lift = blend((t - takeoffAt) / 5);
      ship.position.set(
        Math.sin(lift * 1.6) * lift * 5,
        lift * lift * 18,
        -4.5 - lift * 14,
      );
      ship.rotation.set(
        lift * -0.1,
        lift * 0.38,
        reduced ? 0 : Math.sin(t * 2) * 0.015 * lift,
      );
      const rampOpen = 1 - blend((t - (takeoffAt - 1.15)) / 1.15);
      ship.userData.disco = t >= takeoffAt - 1.15;
      animateUfo(ship, t, rampOpen, reduced);
      crew.forEach((alien, i) => {
        const holder = inside ? interior : exterior;
        if (bodyParent.get(alien) !== holder) {
          holder.add(alien);
          bodyParent.set(alien, holder);
        }
        alien.visible = true;
        const boarding = blend((t - boardingAt - i * 0.76) / 3.8);
        const hero = i === champion && mode === 'winner';
        const dancing =
          !reduced && ((hero && t >= 4 && t < boardingAt) || inside);
        const sip =
          hero && !inside && t < 4
            ? Math.sin(blend((t - 0.4) / 2.6) * Math.PI)
            : inside
              ? Math.max(0, Math.sin(t * 0.55 + i * 1.6)) * 0.65
              : 0;
        let walk = 0;
        if (inside) {
          alien.position.set(
            (i - (crew.length - 1) / 2) * 1.35,
            0,
            0.35 + Math.sin(i * 1.5) * 0.35,
          );
          alien.rotation.y = Math.sin(t * 0.6 + i) * 0.22;
        } else if (t < boardingAt) {
          alien.position.copy(starting[i]);
          alien.rotation.y = hero && dancing ? Math.sin(t * 3) * 0.3 : 0;
        } else {
          const join = blend(Math.min(1, boarding * 1.75));
          const laneZ = T.MathUtils.lerp(starting[i].z, -3.0, boarding);
          alien.position.set(
            T.MathUtils.lerp(starting[i].x, 0, join),
            T.MathUtils.clamp((-0.56 - laneZ) / 1.42, 0, 1) * 0.37,
            laneZ,
          );
          alien.rotation.y = Math.PI;
          walk = boarding > 0 && boarding < 1 ? 3.6 : 0;
          alien.visible = boarding < 1 && t < takeoffAt;
        }
        animateAvatar(
          alien,
          t + i * 0.21,
          walk,
          walk ? 'neutral' : 'happy',
          reduced,
        );
        const rig = alien.userData.rig;
        if (dancing) {
          alien.position.y =
            Math.abs(Math.sin(t * 5.4 + i)) *
            (celebration && i === champion ? 0.23 : 0.11);
          alien.rotation.z = Math.sin(t * 4.8 + i) * 0.11;
          rig.legs[0].rotation.x = Math.sin(t * 5.4 + i) * 0.24;
          rig.legs[1].rotation.x = -Math.sin(t * 5.4 + i) * 0.24;
          rig.arms[0].rotation.z = 1.2 + Math.sin(t * 3.5 + i) * 0.75;
          rig.arms[0].rotation.x = Math.sin(t * 4.1) * 0.45;
        }
        // Holding arm stays below the face; raising it brings the straw to the mouth.
        rig.arms[1].rotation.set(-0.25 - sip * 1.22, 0, -0.1 - sip * 0.22);
        hand
          .set(0.06, -0.45, 0.015)
          .applyQuaternion(rig.arms[1].quaternion)
          .add(rig.arms[1].position);
        drinks[i].position.copy(hand).add(drinkOffset);
        drinks[i].rotation.set(-sip * 0.09, 0, -0.04);
      });
      if (confetti.parent !== (inside ? interior : exterior))
        (inside ? interior : exterior).add(confetti);
      confetti.visible =
        ((mode === 'winner' && t < boardingAt) || celebration) && !reduced;
      if (confetti.visible) {
        for (let i = 0; i < 56; i++) {
          const f = (t * 0.65 + i * 0.19) % 4.5;
          pose.position.set(
            Math.sin(i * 2.4 + t * 0.25) * (2.2 + (i % 3)),
            5 - f,
            (inside ? 0 : 2) + Math.cos(i * 1.7) * 2,
          );
          pose.rotation.set(t * 1.4 + i, t + i * 0.5, t * 0.7);
          pose.updateMatrix();
          confetti.setMatrixAt(i, pose.matrix);
        }
        confetti.instanceMatrix.needsUpdate = true;
      }
      discoBall.rotation.y = reduced ? 0 : t * 0.4;
      (floorLights.material as T.MeshStandardMaterial).emissiveIntensity =
        reduced ? 0.55 : 0.45 + Math.sin(t * 4) * 0.2;
      if (inside) {
        controller.cameraPosition.set(Math.sin(t * 0.1) * 0.6, 2.55, 8.3);
        controller.cameraTarget.set(0, 1.35, -0.45);
        controller.cameraFov = 46;
        if (celebration) {
          const winner = crew[champion];
          controller.cameraPosition.set(
            winner.position.x + 2.0,
            2.3,
            winner.position.z + 5.5,
          );
          controller.cameraTarget.set(
            winner.position.x,
            1.3,
            winner.position.z,
          );
          controller.cameraFov = 39;
        }
      } else if (t < boardingAt && mode === 'winner') {
        const wide = blend((t - 4) / 2.5);
        controller.cameraPosition.set(
          2.25 + wide * 0.7,
          2.25 + wide * 0.9,
          6.8 + wide * 1.1,
        );
        controller.cameraTarget.set(0, 1.25, 2.5 - wide * 0.7);
        controller.cameraFov = 38 + wide * 5;
      } else if (t < takeoffAt) {
        controller.cameraPosition.set(6.2, 4.3, 8.5);
        controller.cameraTarget.set(0, 1.35, -1.1);
        controller.cameraFov = 47;
      } else {
        controller.cameraPosition.set(
          8 + lift * 6,
          5 + lift * 10,
          9 - lift * 4,
        );
        controller.cameraTarget.copy(ship.position).add(shipLookOffset);
        controller.cameraFov = 47;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      const geometries = new Set<T.BufferGeometry>(),
        ownedMaterials = new Set<T.Material>();
      group.traverse((object) => {
        if (!(object instanceof T.Mesh)) return;
        geometries.add(object.geometry);
        (Array.isArray(object.material)
          ? object.material
          : [object.material]
        ).forEach((material) => ownedMaterials.add(material));
      });
      geometries.forEach((geometry) => geometry.dispose());
      ownedMaterials.forEach((material) => material.dispose());
    },
  };
  controller.update(0);
  return controller;
}
