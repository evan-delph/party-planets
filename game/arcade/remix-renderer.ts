import * as T from 'three';
import { WorldKit, disposeObject, performanceMeter } from '../visuals';
import { terrainMaterial } from '../Surfaces';
import { makeAvatar, animateAvatar } from '../avatar';
import type { Avatar } from '../config';
import { getBoard } from '../boards';
import type { Arena } from './simulation';
import {
  BUOYS,
  MAZE_WALLS,
  skiCenter,
  skiHeight,
  skiRocks,
  leafSide,
  pitchAt,
  spotlightApproach,
  critterScale,
  soloDriven,
  COMMANDER,
} from './remix';
import { remixInfo } from './remix-catalog';
import { planetStyle } from './planet-style';
import { createBeachLook, BEACH_SUN } from './look/beach-scene';

const COLORS = ['#ffd26b', '#ff82a1', '#79ceff', '#c3a0ff'];
export function createRemixRenderer(
  root: HTMLDivElement,
  players: { id: string; avatar: Avatar }[],
  kind: string,
  low = false,
  boardId = 'crown',
) {
  const board = getBoard(boardId),
    meta = remixInfo(kind)!,
    renderer = new T.WebGLRenderer({
      antialias: !low,
      powerPreference: 'high-performance',
    });
  renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1 : 1.5));
  renderer.shadowMap.enabled = !low;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  root.appendChild(renderer.domElement);
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera(43, 1, 0.1, 500);
  camera.position.set(0, 23, 27);
  camera.lookAt(0, 0, 0);
  scene.fog = new T.Fog(board.sky, 65, 180);
  const reef = kind === 'bubbletrouble';
  const hemi = new T.HemisphereLight('#edf7ff', board.water, 2.7);
  scene.add(hemi);
  const sun = new T.DirectionalLight('#fff2da', 3);
  sun.position.set(-15, 28, 16);
  sun.castShadow = !low;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {
    left: -25,
    right: 25,
    top: 25,
    bottom: -25,
    far: 90,
  });
  scene.add(sun);
  if (reef) {
    // Reef Ring Rally: warm key light from behind the camera, a cool rim light
    // from the horizon, and a far plane that reaches the lagoon horizon.
    camera.far = 900;
    // Elevated 3/4 lineup view: the ring stream reads above the riders.
    camera.fov = 40;
    camera.position.set(0, 3.8, 8);
    camera.lookAt(0, 0.4, -24);
    hemi.color.set('#cbeaff');
    hemi.groundColor.set('#f3d9a1');
    hemi.intensity = 1.45;
    sun.color.set('#fff0d4');
    sun.intensity = 3.6;
    sun.target.position.set(0, 0, -2);
    sun.position.copy(BEACH_SUN).multiplyScalar(40).add(sun.target.position);
    scene.add(sun.target);
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    Object.assign(sun.shadow.camera, {
      left: -30,
      right: 30,
      top: 26,
      bottom: -26,
      near: 1,
      far: 90,
    });
    sun.shadow.camera.updateProjectionMatrix();
    const rim = new T.DirectionalLight('#bff2ff', 1.6);
    rim.position.set(6, 9, -30);
    scene.add(rim);
    renderer.toneMappingExposure = 1.02;
  }
  const kit = new WorldKit(scene),
    decor = new WorldKit(scene),
    floor = kit.mesh(new T.BoxGeometry(25, 0.6, 19), board.ground, 0, -0.42, 0);
  floor.material = terrainMaterial(board.ground, board.terrain, 8);
  const style = planetStyle(scene, renderer, boardId),
    perf = performanceMeter(renderer, root, meta.name);
  const beach = reef ? createBeachLook(scene, low, players.length) : null;
  if (beach) {
    floor.visible = false;
    const genericSky = scene.getObjectByName('Sky dome');
    if (genericSky) genericSky.visible = false;
  }
  let last = performance.now();
  const snow = ['prickleice', 'cannoncay', 'frostyfreight'].includes(kind),
    wet = [
      'mangrovemotors',
      'bubbletrouble',
      'pelicanpilots',
      'boulderbuffet',
    ].includes(kind);
  if (snow) {
    floor.material = terrainMaterial(
      board.planet === 'earth' ? '#e5f1f8' : board.ground,
      board.planet === 'earth' ? 'snow' : board.terrain,
      9,
    );
  }
  if (wet) {
    floor.material = new T.MeshStandardMaterial({
      color: board.water,
      metalness: 0.24,
      roughness: 0.23,
    });
  }
  for (let i = 0; i < (low ? 10 : 22); i++) {
    const a = i * 2.39996,
      x = Math.sin(a) * 17,
      z = Math.cos(a) * 14;
    if (kind === 'prickleice' || beach) continue;
    if (board.planet === 'selene') {
      const c = decor.mesh(
        new T.ConeGeometry(0.6, 2 + (i % 4) * 0.7, 5),
        i % 2 ? board.accent : board.edge,
        x,
        1,
        z,
      );
      c.rotation.z = Math.sin(i) * 0.2;
    } else
      decor.tree(
        x,
        z,
        snow
          ? 'pine'
          : board.planet === 'verdara'
            ? 'mushroom'
            : wet
              ? 'palm'
              : i % 2
                ? 'jungle'
                : 'palm',
        0.7 + (i % 3) * 0.22,
      );
    decor.rock(x + 1.2, z, 0.6, board.edge);
  }
  const label = (text: string, width = 3, color = '#f0ffe1') => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 96;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#091724e8';
    ctx.roundRect(3, 3, 250, 90, 16);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = 'bold 34px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 49);
    const sp = new T.Sprite(
      new T.SpriteMaterial({ map: new T.CanvasTexture(c), depthTest: false }),
    );
    sp.scale.set(width, width * 0.375, 1);
    scene.add(sp);
    return sp;
  };
  const actors = players.map((p, i) => {
    const group = new T.Group();
    group.userData.gameColor = true;
    scene.add(group);
    const avatar = makeAvatar(p.avatar);
    // Reef Ring Rally heroes are framed up close, so they read a size larger.
    avatar.scale.multiplyScalar(beach ? 1.12 : 0.85);
    group.add(avatar);
    const tag = label(p.avatar.name, 3.5, COLORS[i]);
    const gear = new T.Group();
    group.add(gear);
    const k = new WorldKit(gear);
    if (beach) beach.dressPlayer(group, i);
    const poles: T.Group[] = [];
    let bat: T.Group | undefined,
      carriedRelic: T.Group | undefined,
      relicGem: T.Mesh | undefined,
      anchorCue: T.Group | undefined,
      anchorTag: T.Sprite | undefined;
    if (kind === 'prickleice') {
      for (const x of [-0.22, 0.22]) {
        k.box(x, 0.055, 0, 0.17, 0.09, 2.3, COLORS[i]);
        k.box(x, 0.15, 1.18, 0.17, 0.08, 0.34, COLORS[i]).rotation.x = -0.28;
        k.mesh(
          new T.CapsuleGeometry(0.085, 0.14, 3, 6),
          COLORS[i],
          x,
          0.2,
          1.31,
        ).rotation.x = Math.PI / 2;
        k.box(x, 0.105, -0.52, 0.038, 0.012, 0.82, '#f8f0d1');
        const pole = new T.Group();
        pole.name = 'Ski pole';
        pole.position.set(x * 2.0, 0.95, 0.08);
        gear.add(pole);
        const pk = new WorldKit(pole);
        pk.mesh(
          new T.CylinderGeometry(0.022, 0.024, 1.4, 6),
          '#dce9f2',
          0,
          -0.22,
          0,
        );
        pk.mesh(
          new T.CylinderGeometry(0.045, 0.045, 0.16, 7),
          '#283f58',
          0,
          0,
          0,
        );
        pk.mesh(
          new T.TorusGeometry(0.092, 0.016, 5, 12),
          '#364d62',
          0,
          -0.84,
          0,
        ).rotation.x = Math.PI / 2;
        poles.push(pole);
      }
    }
    if (kind === 'mangosluggers') {
      bat = new T.Group();
      bat.name = 'Held meteor bat';
      avatar.add(bat);
      const bk = new WorldKit(bat);
      bk.mesh(
        new T.CylinderGeometry(0.036, 0.033, 0.36, 10),
        '#364153',
        0,
        0.15,
        0,
      );
      bk.mesh(new T.CapsuleGeometry(0.075, 0.66, 5, 12), COLORS[i], 0, 0.7, 0);
      bk.mesh(
        new T.CylinderGeometry(0.064, 0.064, 0.03, 10),
        '#f6eac5',
        0,
        -0.035,
        0,
      );
      for (let stripe = 0; stripe < 4; stripe++)
        bk.mesh(
          new T.CylinderGeometry(0.039, 0.039, 0.018, 10),
          '#a9c4cc',
          0,
          0.045 + stripe * 0.065,
          0,
        );
    }
    if (kind === 'geckograffiti') {
      carriedRelic = new T.Group();
      carriedRelic.name = 'Carried relic';
      avatar.add(carriedRelic);
      const ck = new WorldKit(carriedRelic);
      relicGem = ck.mesh(
        new T.OctahedronGeometry(0.22),
        COLORS[i < 2 ? 0 : 2],
        0,
        0.15,
        0,
      );
      (relicGem.material as T.MeshStandardMaterial).emissive.set(
        COLORS[i < 2 ? 0 : 2],
      );
      (relicGem.material as T.MeshStandardMaterial).emissiveIntensity = 0.55;
      ck.mesh(
        new T.TorusGeometry(0.18, 0.025, 6, 16),
        '#fff0b4',
        0,
        0.05,
        0,
      ).rotation.x = Math.PI / 2;
      carriedRelic.visible = false;
    }
    if (kind === 'frostyfreight') {
      anchorCue = new T.Group();
      anchorCue.name = 'Anchor cue';
      group.add(anchorCue);
      const ak = new WorldKit(anchorCue);
      const glow = ak.mesh(
        new T.TorusGeometry(0.65, 0.045, 7, 24),
        '#96f7d2',
        0,
        0.06,
        0,
      );
      glow.rotation.x = Math.PI / 2;
      (glow.material as T.MeshStandardMaterial).emissive.set('#69e7b5');
      (glow.material as T.MeshStandardMaterial).emissiveIntensity = 0.7;
      ak.mesh(
        new T.CylinderGeometry(0.045, 0.055, 0.48, 8),
        '#dee9ee',
        0.59,
        0.22,
        0.05,
      ).rotation.z = -0.3;
      ak.mesh(
        new T.TorusGeometry(0.1, 0.025, 6, 14),
        '#ffe48b',
        0.52,
        0.44,
        0.05,
      );
      const tether = new T.Line(
        new T.BufferGeometry().setFromPoints([
          new T.Vector3(0.03, 0.78, 0.05),
          new T.Vector3(0.52, 0.44, 0.05),
        ]),
        new T.LineBasicMaterial({ color: '#fff1ab' }),
      );
      anchorCue.add(tether);
      anchorTag = label('ANCHORED', 2.7, '#aaffd8');
      group.add(anchorTag);
      anchorTag.position.set(0, 3.3, 0);
      anchorCue.visible = anchorTag.visible = false;
    }
    if (
      kind === 'mangrovemotors' ||
      (kind === 'pelicanpilots' && i % 2 === 0)
    ) {
      const hull = k.mesh(
        new T.SphereGeometry(1, 18, 8),
        COLORS[i],
        0,
        0.15,
        0,
      );
      hull.scale.set(0.85, 0.3, 1.6);
      k.box(0, 0.25, -0.2, 0.7, 0.1, 0.85, '#243d52');
    }
    if (kind === 'pelicanpilots' && i % 2) {
      const sail = k.mesh(
        new T.ConeGeometry(1.8, 0.4, 3),
        COLORS[i],
        0,
        2.4,
        0,
      );
      sail.rotation.z = Math.PI;
    }
    if (kind === 'lanternlurk') {
      k.mesh(
        new T.CylinderGeometry(0.1, 0.15, 0.55, 10),
        '#adb2b8',
        0.4,
        1.2,
        0.2,
      ).rotation.x = Math.PI / 2;
    }
    return {
      group,
      avatar,
      tag,
      gear,
      poles,
      bat,
      carriedRelic,
      relicGem,
      anchorCue,
      anchorTag,
    };
  });
  const dynamic = new T.Group();
  scene.add(dynamic);
  dynamic.userData.gameColor = true;
  const objects = new Map<number, T.Object3D>();
  const monster = new T.Group();
  dynamic.add(monster);
  const mk = new WorldKit(monster);
  mk.mesh(new T.SphereGeometry(1, 18, 10), '#c98455', 0, 0.7, 0).scale.set(
    1.2,
    0.65,
    1.7,
  );
  for (const x of [-0.42, 0.42]) {
    mk.mesh(new T.SphereGeometry(0.23, 10, 6), '#f4ffe8', x, 1.2, 0.8);
    mk.mesh(new T.SphereGeometry(0.13, 8, 6), '#142329', x, 1.2, 0.99);
  }
  for (let i = 0; i < 5; i++)
    mk.mesh(
      new T.ConeGeometry(0.2, 0.55, 4),
      '#ffd263',
      0,
      1.2,
      -0.9 + i * 0.45,
    );
  monster.visible = kind === 'tidetiles';
  const fissures: T.Mesh[] = [],
    hoops: T.Mesh[] = [],
    beasts: T.Group[] = [],
    puzzleMeshes: T.Mesh[][] = [],
    puzzleFrames: T.Mesh[][] = [],
    leafMeshes: T.Mesh[][] = [],
    gates: T.Mesh[] = [],
    sentries: T.Group[] = [],
    sentryAims: T.Mesh[] = [],
    pitchArms: T.Group[] = [],
    pitchSignals: T.Sprite[][] = [];
  if (kind === 'tidetiles')
    for (let j = 0; j < 4; j++) {
      const m = kit.mesh(
        new T.CircleGeometry(1.65, 28),
        '#ff8b38',
        (j % 2 ? 1 : -1) * 4,
        0.015,
        (j < 2 ? -1 : 1) * 3,
      );
      m.rotation.x = -Math.PI / 2;
      fissures.push(m);
    }
  if (kind === 'cannoncay')
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3,
        g = new T.Group();
      scene.add(g);
      g.position.set(Math.cos(a) * 12, 0, Math.sin(a) * 8);
      const k = new WorldKit(g);
      k.mesh(new T.SphereGeometry(0.75, 14, 9), '#e9f5fb', 0, 0.65, 0);
      k.mesh(new T.SphereGeometry(0.5, 12, 8), '#f8feff', 0, 1.55, 0);
      k.mesh(
        new T.ConeGeometry(0.13, 0.45, 7),
        '#ffb455',
        0,
        1.5,
        0.55,
      ).rotation.x = Math.PI / 2;
      for (const x of [-0.16, 0.16])
        k.mesh(new T.SphereGeometry(0.07, 6, 5), '#193844', x, 1.7, 0.45);
      sentries.push(g);
    }
  if (kind === 'cannoncay')
    for (let i = 0; i < 6; i++) {
      const line = new T.Mesh(
        new T.CylinderGeometry(0.06, 0.06, 1, 6),
        new T.MeshBasicMaterial({
          color: '#aaffee',
          transparent: true,
          opacity: 0.78,
          depthTest: false,
          toneMapped: false,
        }),
      );
      line.name = 'Sentry aim preview';
      line.visible = false;
      scene.add(line);
      sentryAims.push(line);
    }
  // 1 vs 3 sentry commander: an ice tower to stand on and a target reticle.
  const tower = new T.Group();
  tower.position.set(COMMANDER.x, 0, COMMANDER.z);
  tower.visible = false;
  scene.add(tower);
  {
    const k = new WorldKit(tower);
    k.mesh(new T.CylinderGeometry(1.25, 1.6, COMMANDER.y, 10), '#cfeaf7', 0, COMMANDER.y / 2, 0);
    k.mesh(new T.CylinderGeometry(1.45, 1.3, 0.25, 10), '#f4fbff', 0, COMMANDER.y, 0);
    for (let j = 0; j < 8; j++) {
      const a = (j / 8) * Math.PI * 2;
      k.box(Math.cos(a) * 1.3, COMMANDER.y + 0.25, Math.sin(a) * 1.3, 0.35, 0.35, 0.35, '#e7f6ff');
    }
  }
  const reticle = new T.Mesh(
    new T.RingGeometry(0.55, 0.75, 4, 1),
    new T.MeshBasicMaterial({
      color: '#ff5d5d',
      transparent: true,
      opacity: 0.85,
      depthTest: false,
      toneMapped: false,
      side: T.DoubleSide,
    }),
  );
  reticle.rotation.x = -Math.PI / 2;
  reticle.renderOrder = 4;
  reticle.visible = false;
  scene.add(reticle);
  let skiSeed = -1;
  const course = new T.Group();
  scene.add(course);
  const snowFront = new T.Mesh(
    new T.SphereGeometry(1, 24, 12),
    new T.MeshStandardMaterial({ color: '#f1faff', roughness: 1 }),
  );
  scene.add(snowFront);
  snowFront.visible = kind === 'prickleice';
  if (kind === 'prickleice') {
    floor.visible = false;
    const g = new T.PlaneGeometry(15, 270, 12, 150);
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const d = 130 - p.getY(i);
      p.setXYZ(i, p.getX(i) + skiCenter(d), skiHeight(d), -d);
    }
    const idx = g.getIndex()!;
    for (let i = 0; i < idx.count; i += 3) {
      const n = idx.getX(i);
      idx.setX(i, idx.getX(i + 2));
      idx.setX(i + 2, n);
    }
    g.computeVertexNormals();
    const ground = new T.Mesh(
      g,
      terrainMaterial(
        board.planet === 'earth' ? '#e7f0f7' : board.ground,
        board.planet === 'earth' ? 'snow' : board.terrain,
        20,
      ),
    );
    ground.receiveShadow = true;
    scene.add(ground);
    for (let i = 0; i < 42; i++) {
      const d = i * 6;
      for (const side of [-1, 1]) {
        const tree = decor.tree(
          skiCenter(d) + side * (8 + (i % 4)),
          -d,
          board.planet === 'earth' ? 'pine' : 'mushroom',
          0.8,
        );
        tree.position.y = skiHeight(d);
      }
    }
    const finish = label('FINISH', 9, '#b6ff7c');
    finish.position.set(skiCenter(240), skiHeight(240) + 4, -240);
    for (const x of [-7, 7])
      decor.box(
        skiCenter(240) + x,
        skiHeight(240) + 2,
        -240,
        0.18,
        4,
        0.18,
        '#eaf8f1',
      );
  }
  if (kind === 'crabtraffic') {
    floor.scale.z = 0.8;
    for (let i = 0; i < 10; i++) decor.rock(-13 + i * 2.8, -9, 0.6, board.edge);
  }
  if (kind === 'crumbleclock')
    for (let row = 0; row < 3; row++)
      for (let j = 0; j < 7; j++) {
        const m = new T.Mesh(
          new T.TorusGeometry(0.8, 0.06, 8, 22),
          new T.MeshStandardMaterial({
            color: row === 1 ? '#fbd661' : '#a2c6df',
            emissive: '#445869',
            emissiveIntensity: 0.15,
          }),
        );
        m.position.set(-10 + j * 3.3, 1.9, -1 - row * 2.1);
        m.rotation.x = Math.PI / 2;
        dynamic.add(m);
        hoops.push(m);
        decor.box(m.position.x, 1, m.position.z, 0.06, 2, 0.06, board.edge);
      }
  if (kind === 'lanternlurk')
    for (let i = 0; i < 4; i++) {
      const g = monster.clone();
      g.visible = true;
      dynamic.add(g);
      beasts.push(g);
      decor.box((i - 1.5) * 4, -0.06, -1, 3.4, 0.2, 22, board.edge);
    }
  if (kind === 'vinevault')
    for (let i = 0; i < 4; i++) {
      decor.mesh(
        new T.CylinderGeometry(0.25, 0.7, 60, 12),
        board.planet === 'earth' ? '#568f67' : board.edge,
        (i - 1.5) * 5,
        26,
        0,
      );
      leafMeshes.push(
        Array.from({ length: 8 }, () => {
          const m = new T.Mesh(
            new T.SphereGeometry(1, 12, 6),
            new T.MeshStandardMaterial({ color: board.accent }),
          );
          m.scale.set(1, 0.14, 0.65);
          dynamic.add(m);
          return m;
        }),
      );
    }
  if (kind === 'mangrovemotors')
    BUOYS.forEach(([x, z], i) => {
      const ring = kit.mesh(
        new T.TorusGeometry(1.3, 0.08, 6, 26),
        '#f3e081',
        x,
        0.12,
        z,
      );
      ring.rotation.x = Math.PI / 2;
      gates.push(ring);
      const text = label(String(i + 1), 1.4);
      text.position.set(x, 2, z);
      for (const dx of [-1.5, 1.5])
        kit.mesh(
          new T.CylinderGeometry(0.18, 0.26, 0.8, 10),
          '#f96c64',
          x + dx,
          0.4,
          z,
        );
    });
  if (kind === 'frostyfreight') {
    floor.visible = false;
    const slopeGeometry = new T.PlaneGeometry(14, 62, 8, 32),
      positions = slopeGeometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      const d = 26 - positions.getY(i);
      positions.setXYZ(i, positions.getX(i), d * 0.25 - 0.06, -d);
    }
    const indices = slopeGeometry.getIndex()!;
    for (let i = 0; i < indices.count; i += 3) {
      const a = indices.getX(i);
      indices.setX(i, indices.getX(i + 2));
      indices.setX(i + 2, a);
    }
    slopeGeometry.computeVertexNormals();
    const slope = new T.Mesh(
      slopeGeometry,
      terrainMaterial(
        board.planet === 'earth' ? '#d5eaf4' : board.ground,
        board.planet === 'earth' ? 'snow' : board.terrain,
        9,
      ),
    );
    slope.name = 'Summit climbing slope';
    slope.receiveShadow = true;
    scene.add(slope);
    for (let i = 0; i < 6; i++)
      for (const side of [-1, 1]) {
        decor.box(side * 4, i * 2.5 - 0.18, -i * 10, 4, 0.25, 1.5, board.edge);
        decor.box(
          side * 7.2,
          i * 2.5 + 1.15,
          -i * 10,
          1.1,
          2.8,
          2.5,
          board.edge,
        );
      }
    const finish = label('SUMMIT', 7, '#b6ffad');
    finish.position.set(0, 15.6, -50);
  }
  const ropes = Array.from({ length: 2 }, () => {
    const geo = new T.BufferGeometry().setFromPoints([
      new T.Vector3(),
      new T.Vector3(),
    ]);
    const l = new T.Line(geo, new T.LineBasicMaterial({ color: '#efffa2' }));
    scene.add(l);
    l.visible = ['frostyfreight', 'pelicanpilots'].includes(kind);
    return l;
  });
  const postcards: T.Texture[] = [];
  if (kind === 'hotelhiccup') {
    const c = document.createElement('canvas');
    c.width = 300;
    c.height = 200;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = board.water;
    ctx.fillRect(0, 0, 300, 200);
    ctx.fillStyle = board.ground;
    ctx.beginPath();
    ctx.ellipse(155, 151, 152, 80, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2ebad';
    ctx.beginPath();
    ctx.arc(230, 46, 27, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#bedbf0';
    ctx.beginPath();
    ctx.ellipse(134, 87, 80, 18, -0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#9fea87';
    ctx.beginPath();
    ctx.ellipse(128, 73, 35, 26, -0.12, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#153d37';
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(81 + i * 25, 91, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#fff5d9';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('PARTY PLANETS', 25, 180);
    for (let piece = 0; piece < 6; piece++) {
      const tile = document.createElement('canvas');
      tile.width = 100;
      tile.height = 100;
      tile
        .getContext('2d')!
        .drawImage(
          c,
          (piece % 3) * 100,
          Math.floor(piece / 3) * 100,
          100,
          100,
          0,
          0,
          100,
          100,
        );
      postcards.push(new T.CanvasTexture(tile));
    }
    const frameShape = new T.Shape();
    frameShape.moveTo(-0.8, -0.8);
    frameShape.lineTo(0.8, -0.8);
    frameShape.lineTo(0.8, 0.8);
    frameShape.lineTo(-0.8, 0.8);
    frameShape.closePath();
    const frameHole = new T.Path();
    frameHole.moveTo(-0.71, -0.71);
    frameHole.lineTo(-0.71, 0.71);
    frameHole.lineTo(0.71, 0.71);
    frameHole.lineTo(0.71, -0.71);
    frameHole.closePath();
    frameShape.holes.push(frameHole);
    const frameGeometry = new T.ShapeGeometry(frameShape),
      frameMaterial = new T.MeshBasicMaterial({
        color: '#9eff9f',
        side: T.DoubleSide,
        toneMapped: false,
      });
    for (let i = 0; i < 4; i++) {
      const panels: T.Mesh[] = [],
        frames: T.Mesh[] = [];
      for (let j = 0; j < 6; j++) {
        const m = new T.Mesh(
          new T.PlaneGeometry(1.5, 1.5),
          new T.MeshBasicMaterial({ map: postcards[j], side: T.DoubleSide }),
        );
        m.rotation.x = -Math.PI / 2;
        m.position.set(
          (i - 1.5) * 5.5 + ((j % 3) - 1) * 1.58,
          0.2,
          Math.floor(j / 3) * 1.58,
        );
        dynamic.add(m);
        panels.push(m);
        const frame = new T.Mesh(frameGeometry, frameMaterial);
        frame.name = 'Correct postcard border';
        frame.rotation.x = -Math.PI / 2;
        frame.visible = false;
        dynamic.add(frame);
        frames.push(frame);
      }
      puzzleMeshes.push(panels);
      puzzleFrames.push(frames);
      const ref = new T.Mesh(
        new T.PlaneGeometry(3, 2),
        new T.MeshBasicMaterial({
          map: new T.CanvasTexture(c),
          side: T.DoubleSide,
        }),
      );
      ref.position.set((i - 1.5) * 5.5, 0.1, -3);
      ref.rotation.x = -Math.PI / 2;
      dynamic.add(ref);
    }
  }
  const targetSigns: T.Sprite[] = [];
  const partnerMarkers =
    kind === 'geckograffiti'
      ? players.map((_, i) => {
          const marker = new T.Group();
          marker.name = 'Partner marker';
          marker.userData.gameColor = true;
          scene.add(marker);
          const ring = new T.Mesh(
            new T.TorusGeometry(0.82, 0.06, 7, 28),
            new T.MeshBasicMaterial({
              color: COLORS[i < 2 ? 0 : 2],
              depthTest: false,
            }),
          );
          ring.rotation.x = -Math.PI / 2;
          ring.position.y = 0.15;
          marker.add(ring);
          const arrow = new T.Mesh(
            new T.ConeGeometry(0.24, 0.5, 5),
            new T.MeshBasicMaterial({
              color: COLORS[i < 2 ? 0 : 2],
              depthTest: false,
            }),
          );
          arrow.rotation.x = Math.PI;
          arrow.position.y = 3.25;
          marker.add(arrow);
          const title = label('PARTNER', 2.7, COLORS[i < 2 ? 0 : 2]);
          marker.add(title);
          title.position.y = 3.9;
          marker.visible = false;
          return marker;
        })
      : [];
  if (kind === 'picklepatrol')
    for (let i = 0; i < 5; i++) {
      const sign = label(
        ['●', '▲', '◆', '■', '★'][i],
        2.2,
        ['#ffd96c', '#7dc5ff', '#ee8ecc', '#81edb2', '#ff9d77'][i],
      );
      sign.position.set((i - 2) * 3, 0.18, -3);
      targetSigns.push(sign);
    }
  const pitchedBalls = Array.from({ length: 4 }, () => {
    const m = new T.Mesh(
      new T.SphereGeometry(0.2, 10, 7),
      new T.MeshStandardMaterial({ color: '#fff0cf' }),
    );
    dynamic.add(m);
    m.visible = kind === 'mangosluggers';
    return m;
  });
  if (kind === 'mangosluggers')
    for (let i = 0; i < 4; i++) {
      decor.box((i - 1.5) * 4, 0.12, 0, 3.5, 0.2, 18, board.edge);
      decor.mesh(
        new T.CylinderGeometry(0.6, 0.8, 1.8, 12),
        '#47677a',
        (i - 1.5) * 4,
        1,
        -8,
      );
    }
  if (kind === 'mangosluggers')
    for (let i = 0; i < 4; i++) {
      const arm = new T.Group();
      arm.name = 'Pitching arm';
      arm.position.set((i - 1.5) * 4, 1.65, -8);
      scene.add(arm);
      const ak = new WorldKit(arm);
      ak.mesh(new T.SphereGeometry(0.13, 10, 8), '#ffd978', 0, 0, 0);
      ak.mesh(new T.CapsuleGeometry(0.075, 0.43, 5, 9), '#7ca6bf', 0, -0.3, 0);
      ak.mesh(new T.SphereGeometry(0.15, 10, 7), '#ce985c', 0, -0.6, 0);
      pitchArms.push(arm);
      const signals = ['FAST', 'SLOW', 'CURVE'].map((text, j) => {
        const signal = label(text, 2.4, ['#ffc59b', '#a9e7ff', '#d3b0ff'][j]);
        signal.position.set((i - 1.5) * 4, 3.15, -8);
        signal.visible = false;
        return signal;
      });
      pitchSignals.push(signals);
    }
  if (kind === 'geckograffiti') {
    for (const [x, z, w, d] of MAZE_WALLS)
      decor.box(x, 0.5, z, w, 1, d, board.edge);
    kit.mesh(new T.CylinderGeometry(2, 2.2, 0.25, 24), board.accent, 0, 0, 0);
  }
  if (kind === 'skewergallery')
    for (const [x, z] of [
      [-4, 0],
      [4, 0],
      [0, -4],
    ]) {
      decor.mesh(
        new T.CylinderGeometry(1.5, 1.6, 3, 16),
        board.edge,
        x,
        1.5,
        z,
      );
      decor.mesh(
        new T.TorusGeometry(1.55, 0.1, 8, 22),
        board.accent,
        x,
        2.7,
        z,
      ).rotation.x = Math.PI / 2;
    }
  const raft = new T.Group();
  scene.add(raft);
  raft.visible = kind === 'boulderbuffet';
  const raftKit = new WorldKit(raft);
  raftKit.mesh(
    new T.CylinderGeometry(3.5, 3.8, 0.5, 32),
    board.edge,
    0,
    0.1,
    0,
  );
  raftKit.mesh(
    new T.TorusGeometry(3.3, 0.08, 6, 32),
    board.accent,
    0,
    0.4,
    0,
  ).rotation.x = Math.PI / 2;
  if (kind === 'returnsender')
    for (let j = 0; j < 6; j++) {
      kit.box(0, 0.05, (j - 2.5) * 2.3, 20, 0.18, 1.15, '#2b4557');
      for (let n = 0; n < 24; n++)
        decor.box(
          -10 + n * 0.85,
          0.16,
          (j - 2.5) * 2.3,
          0.04,
          0.02,
          1,
          '#74999c',
        );
      for (const x of [-8, 8])
        kit.mesh(
          new T.CylinderGeometry(0.42, 0.5, 0.25, 12),
          x < 0 ? COLORS[0] : COLORS[2],
          x,
          0.4,
          (j - 2.5) * 2.3,
        );
    }
  decor.bake();
  function objectMesh(type: string, value: number) {
    const styled = beach?.objectMesh(type, value);
    if (styled) return styled;
    const g = new T.Group();
    g.userData.gameColor = true;
    const k = new WorldKit(g);
    if (type === 'ring' || type === 'token') {
      const m = k.mesh(
        new T.TorusGeometry(0.9, 0.09, 8, 28),
        value === 3 ? '#ffd952' : '#a8edec',
      );
      m.rotation.x = Math.PI / 2;
    } else if (type === 'wave') {
      const m = k.mesh(new T.TorusGeometry(1, 0.04, 5, 48), '#a5efff');
      m.rotation.x = Math.PI / 2;
    } else if (type === 'crab') {
      k.mesh(new T.SphereGeometry(0.65, 12, 7), '#e98562', 0, 0.3, 0).scale.set(
        1,
        0.55,
        0.75,
      );
      for (let j = 0; j < 6; j++)
        k.box(
          j % 2 ? 0.65 : -0.65,
          0.2,
          (Math.floor(j / 2) - 1) * 0.35,
          0.55,
          0.09,
          0.1,
          '#b86153',
        );
    } else if (type === 'parcel' || type === 'crate') {
      k.box(
        0,
        0.45,
        0,
        0.8,
        0.8,
        0.8,
        type === 'parcel' ? '#f3ad66' : board.edge,
      );
      k.box(0, 0.45, 0.41, 0.16, 0.83, 0.02, '#f8f3bc');
    } else if (type === 'relic')
      k.mesh(
        new T.OctahedronGeometry(0.55),
        value ? '#ffc765' : '#b990ff',
        0,
        0.55,
        0,
      );
    else if (type === 'jelly') {
      const m = k.mesh(new T.SphereGeometry(0.65, 14, 8), '#cd93e5', 0, 0, 0);
      m.scale.y = 0.55;
      for (let i = 0; i < 5; i++)
        k.mesh(
          new T.CylinderGeometry(0.035, 0.06, 0.7, 5),
          '#e6b5ec',
          Math.sin(i * 1.25) * 0.3,
          -0.5,
          Math.cos(i * 1.25) * 0.3,
        );
    } else
      k.mesh(
        new T.SphereGeometry(
          type === 'snowball' ? 0.48 : type === 'water' ? 0.22 : 0.18,
          12,
          8,
        ),
        type === 'water' ? '#75d5ff' : '#ffedca',
      );
    return g;
  }
  const holdPoint = new T.Vector3(),
    aimStart = new T.Vector3(),
    aimEnd = new T.Vector3(),
    upAxis = new T.Vector3(0, 1, 0);
  let beachFramed = false;
  const beachCam = new T.Vector3();
  function draw(w: Arena, localId: string, delta: number, reduced = false) {
    const r = w.remix!,
      me = w.actors.find((p) => p.id === localId) ?? w.actors[0],
      time = reduced ? 0 : w.time;
    if (kind === 'prickleice' && skiSeed !== w.seed) {
      disposeObject(course);
      course.clear();
      skiSeed = w.seed;
      const k = new WorldKit(course);
      for (const rock of skiRocks(w.seed)) {
        const m = k.rock(
          skiCenter(rock.d) + rock.x,
          -rock.d,
          rock.r,
          board.edge,
        );
        m.position.y = skiHeight(rock.d) + rock.r * 0.45;
      }
      k.bake();
    }
    const beachSpread = beach
      ? beach.layout(w.actors, w.actors.indexOf(me), delta)
      : null;
    actors.forEach((v, i) => {
      const p = w.actors[i],
        seat = r.seats[i];
      let x = p.x,
        y = p.y;
      const z = p.z;
      if (kind === 'prickleice') {
        x += skiCenter(p.distance);
        y += skiHeight(p.distance) + 0.15;
      }
      if (beachSpread) x += beachSpread[i];
      v.group.position.set(x, y, z);
      v.group.rotation.y =
        kind === 'frostyfreight'
          ? Math.PI
          : kind === 'hotelhiccup'
            ? 0
            : p.face;
      v.group.visible = p.alive || meta.heats || w.time - p.outAt < 1.8;
      if (kind === 'hotelhiccup') v.group.position.set((i - 1.5) * 5.5, 0, 5);
      animateAvatar(
        v.avatar,
        time,
        Math.hypot(p.vx, p.vz),
        !p.alive ? 'sad' : p.flash > 0.05 ? 'happy' : 'neutral',
        reduced,
      );
      v.avatar.rotation.z =
        kind === 'prickleice'
          ? w.time < r.seats[i].tumbleUntil
            ? Math.sin(time * 15) * 0.8
            : -p.vx * 0.035
          : 0;
      if (beach) beach.poseActor(v.group, v.avatar, i, p, time, delta);
      const rig = v.avatar.userData.rig;
      if (kind === 'prickleice') {
        const stroking =
            p.alive && (p.input.a || w.time - seat.lastPole < 0.22),
          stroke = reduced
            ? 0
            : Math.sin(time * Math.PI * 6) * (stroking ? 0.6 : 0.1);
        v.poles.forEach((pole, j) => {
          pole.rotation.x = -0.2 + stroke;
          pole.rotation.z = (j ? 1 : -1) * 0.08;
        });
        rig.arms.forEach((arm: T.Group, j: number) => {
          arm.rotation.x = -0.5 + stroke;
          arm.rotation.z = (j ? 1 : -1) * 0.23;
        });
        rig.legs.forEach((leg: T.Group) => {
          leg.rotation.x = 0.08;
        });
      }
      if (v.bat) {
        const age = w.time - seat.lift,
          swinging = seat.lift > 0 && age >= 0 && age < 0.28,
          phase = swinging ? age / 0.28 : 0,
          sweep = Math.sin(phase * Math.PI);
        rig.arms[1].rotation.set(-0.55 - sweep * 0.75, 0, -0.35 - sweep * 0.95);
        rig.arms[0].rotation.set(-0.45 - sweep * 0.6, 0, 0.35 + sweep * 0.6);
        holdPoint
          .set(0.06, -0.43, 0.04)
          .applyQuaternion(rig.arms[1].quaternion)
          .add(rig.arms[1].position);
        v.bat.position.copy(holdPoint);
        v.bat.rotation.set(
          0.35 + sweep * 1.12,
          swinging ? -0.8 + phase * 2.9 : -0.8,
          -0.38 - sweep * 1.08,
        );
        v.avatar.rotation.y = swinging ? Math.sin(phase * Math.PI) * 0.38 : 0;
      }
      if (v.carriedRelic) {
        v.carriedRelic.visible = seat.carrying >= 0;
        if (v.carriedRelic.visible) {
          rig.arms[1].rotation.set(-1.05, 0, -0.25);
          holdPoint
            .set(0.06, -0.43, 0.035)
            .applyQuaternion(rig.arms[1].quaternion)
            .add(rig.arms[1].position);
          v.carriedRelic.position.copy(holdPoint);
          if (v.relicGem) v.relicGem.rotation.y = time * 1.6;
        }
      }
      if (v.anchorCue && v.anchorTag) {
        v.anchorCue.visible = v.anchorTag.visible = seat.anchored;
        const climbing =
            !seat.anchored && p.alive && (p.input.z < -0.1 || p.input.a),
          climb = reduced ? 0 : Math.sin(time * 7) * (climbing ? 0.48 : 0);
        rig.arms.forEach((arm: T.Group, j: number) => {
          arm.rotation.x = -0.75 + (j ? 1 : -1) * climb;
          arm.rotation.z = (j ? 1 : -1) * 0.2;
        });
        rig.legs.forEach((leg: T.Group, j: number) => {
          leg.rotation.x = (j ? 1 : -1) * climb * 0.55;
        });
        v.avatar.rotation.x = -0.13;
      }
      v.tag.position.copy(v.group.position).add(new T.Vector3(0, 2.8, 0));
      v.tag.visible = false;
    });
    partnerMarkers.forEach((marker, i) => {
      const source = w.actors[i],
        partner = w.actors.find(
          (p) => p.id !== source.id && p.team === source.team,
        );
      marker.visible = !!partner && r.seats[i].lift > w.time;
      if (partner) {
        marker.position.set(partner.x, partner.y, partner.z);
        marker.scale.setScalar(reduced ? 1 : 1 + Math.sin(time * 7) * 0.045);
      }
    });
    const ids = new Set(r.objects.map((o) => o.id));
    for (const [id, g] of objects)
      if (!ids.has(id)) {
        g.removeFromParent();
        // Beach props share geometry and materials across every ring/jelly.
        if (!g.userData.beachShared) disposeObject(g);
        objects.delete(id);
      }
    for (const o of r.objects) {
      let g = objects.get(o.id);
      if (!g) {
        g = objectMesh(o.kind, o.value);
        objects.set(o.id, g);
        dynamic.add(g);
      }
      g.position.set(o.x, o.y + 0.12, o.z);
      if (o.kind === 'wave') {
        g.scale.setScalar(o.r);
        g.position.y = 0.4;
      }
      if (o.kind === 'ring') g.rotation.z = time * 0.7;
      if (o.kind === 'crab') g.rotation.z = Math.sin(time * 16 + o.id) * 0.07;
    }
    if (beach)
      beach.forecast(
        w.seed,
        r.serial,
        r.spawn,
        w.time,
        w.done ? -1 : w.duration,
        time,
      );
    if (beach)
      beach.update(
        r.objects,
        objects,
        actors.map((v) => ({
          x: v.group.position.x,
          z: v.group.position.z,
          visible: v.group.visible,
        })),
        time,
      );
    monster.position.set(r.beast.x, 0, r.beast.z);
    monster.scale.setScalar(critterScale(w.time, soloDriven(w)));
    monster.rotation.y = Math.atan2(r.beast.dx, r.beast.dz);
    fissures.forEach((m, j) => {
      (m.material as T.MeshStandardMaterial).emissive.set('#f36c28');
      (m.material as T.MeshStandardMaterial).emissiveIntensity =
        (w.time + j * 0.9) % 5 > 3.2 ? 0.8 : 0;
      m.scale.setScalar((w.time + j * 0.9) % 5 > 4.1 ? 1.1 : 1);
    });
    const commanded = soloDriven(w) && kind === 'cannoncay';
    tower.visible = reticle.visible = commanded;
    if (commanded) {
      reticle.position.set(r.lean.x, 0.08, r.lean.z);
      reticle.rotation.z = time * 2;
      reticle.scale.setScalar(w.actors[0].cooldown > 0 ? 0.75 : 1);
    }
    sentries.forEach((g, i) => {
      // Showdowns aim at the commander's reticle; otherwise at a runner.
      const p = commanded
        ? { x: r.lean.x, z: r.lean.z }
        : w.actors[r.serial % 4];
      const loaded = i === r.serial % 6;
      if (loaded)
        g.rotation.y = Math.atan2(p.x - g.position.x, p.z - g.position.z);
      g.rotation.z = Math.sin(time * 2 + i) * 0.08;
      g.scale.setScalar(commanded && loaded ? 1.18 + Math.sin(time * 8) * 0.04 : 1);
      const line = sentryAims[i];
      line.visible = commanded
        ? loaded
        : loaded && r.spawn - w.time >= 0 && r.spawn - w.time <= 0.65;
      if (line.visible) {
        aimStart.set(g.position.x, 0.16, g.position.z);
        aimEnd.set(p.x, 0.16, p.z);
        line.position.copy(aimStart).add(aimEnd).multiplyScalar(0.5);
        aimEnd.sub(aimStart);
        line.scale.y = Math.max(0.01, aimEnd.length());
        line.quaternion.setFromUnitVectors(upAxis, aimEnd.normalize());
      }
    });
    hoops.forEach((m, i) => {
      m.visible = r.hoopBusy[i] <= w.time;
      const row = Math.floor(i / 7);
      m.position.x = -10 + (i % 7) * 3.3 + Math.sin(w.time * 1.2 + row) * 1.7;
    });
    beasts.forEach((g, i) => {
      const s = r.seats[i],
        gap =
          s.stopped >= 0
            ? s.stopped
            : Math.max(
                0,
                spotlightApproach(
                  w.seed,
                  Math.min(2, Math.floor(w.time / 10)),
                  w.time % 10,
                ).gap,
              );
      g.position.set((i - 1.5) * 4, 0, 5 - gap);
      g.rotation.y = 0;
    });
    leafMeshes.forEach((leaves, i) => {
      const p = w.actors[i];
      leaves.forEach((m, j) => {
        const n = Math.max(0, p.checkpoint - 2) + j;
        m.position.set((i - 1.5) * 5 + leafSide(w.seed, n) * 1.2, n * 0.8, 0);
      });
    });
    gates.forEach((g, i) => {
      (g.material as T.MeshStandardMaterial).emissive.set(
        i === me.checkpoint ? '#8dfc4c' : '#000000',
      );
      (g.material as T.MeshStandardMaterial).emissiveIntensity = 0.7;
    });
    ropes.forEach((l, i) => {
      if (!l.visible) return;
      const a = actors[i * 2].group.position,
        b = actors[i * 2 + 1].group.position;
      l.geometry.setFromPoints([
        a.clone().add(new T.Vector3(0, 1, 0)),
        b.clone().add(new T.Vector3(0, 1, 0)),
      ]);
    });
    puzzleMeshes.forEach((tiles, i) =>
      tiles.forEach((m, j) => {
        const s = r.seats[i],
          mat = m.material as T.MeshBasicMaterial;
        mat.map = postcards[s.grid[j]];
        mat.color.set(
          s.selected === j ? '#ffffff' : s.held === j ? '#ffe49b' : '#b9cece',
        );
        m.rotation.z = (-s.rot[j] * Math.PI) / 2;
        m.position.y = s.selected === j ? 0.32 : 0.2;
        const frame = puzzleFrames[i][j];
        frame.visible = s.grid[j] === j && s.rot[j] === 0;
        frame.position.copy(m.position);
        frame.position.y += 0.025;
      }),
    );
    pitchedBalls.forEach((m, i) => {
      if (!m.visible) return;
      const { pitch, type, contact, cycle } = pitchAt(w.seed, w.time);
      if (pitch >= 30) {
        m.visible = false;
        pitchSignals[i].forEach((sign) => {
          sign.visible = false;
        });
        return;
      }
      const windup = contact * 0.28,
        flight = (cycle - windup) / (contact - windup),
        arm = pitchArms[i];
      arm.rotation.x =
        cycle < windup
          ? -2.2 + (cycle / windup) * 2.8
          : 0.6 * Math.exp(-(cycle - windup) * 9);
      pitchSignals[i].forEach((sign, j) => {
        sign.visible = j === type && pitch < 30;
      });
      if (cycle < windup) {
        arm.updateWorldMatrix(true, false);
        m.position.copy(arm.localToWorld(holdPoint.set(0, -0.6, 0)));
      } else
        m.position.set(
          (i - 1.5) * 4 + (type === 2 ? Math.sin(flight * Math.PI) * 0.55 : 0),
          1.1,
          -8 + flight * 12,
        );
    });
    raft.rotation.set(r.lean.z * 0.09, 0, -r.lean.x * 0.09);
    const cam = new T.Vector3(0, 23, 27),
      look = new T.Vector3(0, 0, 0);
    if (kind === 'prickleice') {
      cam.set(
        skiCenter(me.distance) + me.x * 0.2,
        skiHeight(me.distance) + 10,
        -me.distance + 16,
      );
      look.set(
        skiCenter(me.distance + 14),
        skiHeight(me.distance + 14) + 1,
        -me.distance - 14,
      );
      snowFront.position.set(
        skiCenter(r.avalanche),
        skiHeight(r.avalanche) + 2.5,
        -r.avalanche,
      );
      snowFront.scale.set(9, 2.7, 3);
    }
    if (kind === 'vinevault') {
      cam.set(0, me.y + 14, 27);
      look.set(0, me.y + 3, 0);
    }
    if (kind === 'frostyfreight') {
      cam.set(0, me.y + 17, me.z + 19);
      look.set(0, me.y + 2, me.z - 6);
    }
    if (
      kind === 'prickleice' ||
      kind === 'frostyfreight' ||
      kind === 'vinevault'
    ) {
      sun.position.set(cam.x - 15, look.y + 28, look.z + 16);
      sun.target.position.copy(look);
      sun.target.updateMatrixWorld();
    }
    if (kind === 'hotelhiccup') {
      cam.set(0, 26, 8);
      look.set(0, 0, 0);
    }
    if (beach) {
      // Lineup shot from just behind the riders: all four heroes across the
      // lower middle, the ring stream and lagoon stacked up to the horizon in
      // the upper third. Dolly back (and up, keeping the same angles) only as
      // far as needed to keep every rider inside the frame.
      let minX = Infinity,
        maxX = -Infinity,
        sz = 0,
        n = 0;
      for (const v of actors)
        if (v.group.visible) {
          minX = Math.min(minX, v.group.position.x);
          maxX = Math.max(maxX, v.group.position.x);
          sz += v.group.position.z;
          n++;
        }
      if (!n) {
        minX = maxX = 0;
        n = 1;
      }
      const camX = T.MathUtils.clamp(((minX + maxX) / 2) * 0.5, -5, 5),
        half = Math.max(maxX - camX, camX - minX) + 1.5,
        tanH =
          Math.tan(T.MathUtils.degToRad(camera.fov / 2)) * camera.aspect,
        base = 17,
        dist = Math.max(base, half / (tanH * 0.86)),
        pitch = T.MathUtils.degToRad(13.8);
      cam.set(camX, 7.2 * (dist / base), sz / n + dist);
      if (!beachFramed) beachCam.copy(cam);
      beachFramed = true;
      beachCam.lerp(cam, 1 - Math.exp(-T.MathUtils.clamp(delta, 0, 0.25) * 4));
      cam.copy(beachCam);
      look.set(cam.x, cam.y - Math.sin(pitch) * 40, cam.z - Math.cos(pitch) * 40);
    }
    // Clamp: a frame clock that steps backwards must never push the camera away.
    if (beach) camera.position.copy(cam);
    else camera.position.lerp(cam, T.MathUtils.clamp(delta * 5, 0, 1));
    camera.lookAt(look);
    style.draw();
    const start = performance.now();
    renderer.render(scene, camera);
    const now = performance.now();
    perf.frame(now, now - last, now - start);
    last = now;
  }
  const resize = () => {
    renderer.setSize(root.clientWidth, root.clientHeight);
    camera.aspect = root.clientWidth / Math.max(1, root.clientHeight);
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(root);
  resize();
  const ray = new T.Raycaster(),
    plane = new T.Plane(new T.Vector3(0, 1, 0), 0);
  return {
    draw,
    groundPoint(x: number, y: number) {
      const b = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(
        new T.Vector2(
          ((x - b.left) / b.width) * 2 - 1,
          (-(y - b.top) / b.height) * 2 + 1,
        ),
        camera,
      );
      return ray.ray.intersectPlane(plane, new T.Vector3());
    },
    dispose() {
      observer.disconnect();
      perf.dispose();
      disposeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
