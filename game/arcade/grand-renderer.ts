import * as T from 'three';
import { Avatar } from '../config';
import { makeAvatar, animateAvatar } from '../avatar';
import { WorldKit, disposeObject, performanceMeter } from '../visuals';
import { Arena, randomAt } from './simulation';
import { ArenaKind } from './catalog';
import { grandInfo } from './grand-catalog';
import { lane, fossilOutline, doughTarget, GObject, GTile } from './grand';
const COLORS = ['#ffc856', '#f387a5', '#6abfed', '#ae91ef'],
  TEAM = ['#ffc856', '#76c9f6'];
const SYMBOLS = ['SUN', 'LEAF', 'WAVE', 'SHELL', 'STAR', 'MOON', 'FLOWER'];
const TILE_COLORS = [
  '#efb957',
  '#79b36d',
  '#66bed0',
  '#ed999d',
  '#b9a1e8',
  '#8ea5d6',
  '#cf89b6',
];
export function createGrandRenderer(
  root: HTMLDivElement,
  players: { id: string; avatar: Avatar }[],
  kind: ArenaKind,
  low = false,
) {
  const info = grandInfo(kind)!;
  const ice = ['prickleice', 'frostyfreight', 'puckpicnic'].includes(kind),
    night = [
      'lanternlurk',
      'crumbleclock',
      'skewergallery',
      'parasolpearls',
    ].includes(kind),
    forest = [
      'tidetiles',
      'vinevault',
      'mangrovemotors',
      'raingarden',
      'paddleplunder',
    ].includes(kind),
    quad = [
      'vinevault',
      'mangosluggers',
      'hooklinelunch',
      'coconutcompass',
      'fossilfillet',
      'lostluggage',
      'doughdouble',
      'bentoblocks',
    ].includes(kind),
    long = [
      'mangrovemotors',
      'bubbletrouble',
      'frostyfreight',
      'pelicanpilots',
      'rubblerunners',
    ].includes(kind),
    vertical = ['vinevault', 'parasolpearls'].includes(kind),
    wide =
      quad ||
      [
        'frostyfreight',
        'pelicanpilots',
        'rubblerunners',
        'picnicpartition',
      ].includes(kind);
  const sky = ice
      ? '#aecbdd'
      : night
        ? '#303f59'
        : forest
          ? '#a7d8c3'
          : '#9edce5',
    water = ice
      ? '#7aaac3'
      : night
        ? '#344c69'
        : forest
          ? '#419b91'
          : '#55b9cb';
  const renderer = new T.WebGLRenderer({
    antialias: !low,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1 : 1.5));
  renderer.setClearColor(sky);
  renderer.shadowMap.enabled = !low;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16;
  root.appendChild(renderer.domElement);
  const perf = performanceMeter(renderer, root, kind),
    scene = new T.Scene(),
    camera = new T.OrthographicCamera(-20, 20, 14, -14, 0.1, 400);
  scene.fog = new T.Fog(sky, 100, 300);
  scene.add(new T.HemisphereLight('#fff5df', water, 2.5));
  const sun = new T.DirectionalLight('#fff0d8', 3);
  sun.position.set(-12, 30, 15);
  sun.castShadow = !low;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {
    left: -30,
    right: 30,
    top: 30,
    bottom: -30,
    near: 1,
    far: 100,
  });
  sun.shadow.bias = -0.002;
  scene.add(sun, sun.target);
  const kit = new WorldKit(scene),
    dynamic = new WorldKit(scene),
    labels: T.Sprite[] = [];
  const textCache = new Map<string, T.CanvasTexture>();
  function label(
    text: string,
    x: number,
    y: number,
    z: number,
    color = '#fff5db',
    size = 3,
    parent: T.Object3D = scene,
  ) {
    const sprite = new T.Sprite(
      new T.SpriteMaterial({ depthTest: false, toneMapped: false }),
    );
    sprite.position.set(x, y, z);
    sprite.scale.set(size, size / 4, 1);
    sprite.renderOrder = 20;
    parent.add(sprite);
    labels.push(sprite);
    setText(sprite, text, color);
    return sprite;
  }
  function setText(sprite: T.Sprite, text: string, color = '#fff5db') {
    const key = text + '|' + color;
    if (sprite.userData.key === key) return;
    sprite.userData.key = key;
    let texture = textCache.get(key);
    if (!texture) {
      const canvas = document.createElement('canvas');
      canvas.width = 384;
      canvas.height = 96;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#193d4bee';
      ctx.beginPath();
      ctx.roundRect(3, 7, 378, 82, 17);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let size = 44;
      do {
        ctx.font = `900 ${size}px Trebuchet MS,Arial`;
        size -= 2;
      } while (ctx.measureText(text).width > 355 && size > 18);
      ctx.fillText(text, 192, 49);
      texture = new T.CanvasTexture(canvas);
      textCache.set(key, texture);
    }
    sprite.material.map = texture;
    sprite.material.needsUpdate = true;
  }
  const box = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    c: string,
    parent?: T.Object3D,
  ) => kit.box(x, y, z, w, h, d, c, parent);
  const cylinder = (
    x: number,
    y: number,
    z: number,
    r: number,
    h: number,
    c: string,
    parent?: T.Object3D,
  ) => kit.mesh(new T.CylinderGeometry(r, r, h, 24), c, x, y, z, parent);
  const ring = (
    x: number,
    y: number,
    z: number,
    r: number,
    c: string,
    parent: T.Object3D = kit.root,
  ) => {
    const m = kit.mesh(
      new T.TorusGeometry(r, 0.045, 5, 48),
      c,
      x,
      y,
      z,
      parent,
    );
    m.rotation.x = Math.PI / 2;
    return m;
  };
  const ground = (w = 15, d = w, c = '#e5d7aa', z = 0, y = -0.25) =>
    box(0, y, z, w, 0.5, d, c);
  const arch = (x: number, z: number, c: string, w = 4, y = 0) => {
    box(x - w / 2, y + 2, z, 0.25, 4, 0.3, c);
    box(x + w / 2, y + 2, z, 0.25, 4, 0.3, c);
    box(x, y + 4, z, w + 0.3, 0.3, 0.4, c);
  };
  const floor = kit.mesh(
    new T.PlaneGeometry(440, 440),
    water,
    0,
    vertical ? -5 : -1.4,
    long ? -80 : 0,
  );
  floor.rotation.x = -Math.PI / 2;
  // Each world has its own physical footprint and landmarks; playable geometry follows simulation coordinates.
  if (kind === 'tidetiles') {
    for (let j = 0; j < 12; j++) {
      const a = (j / 12) * Math.PI * 2;
      kit.tree(Math.cos(a) * 12, Math.sin(a) * 11, 'palm', 1.2);
      cylinder(Math.cos(a) * 12, -0.55, Math.sin(a) * 11, 2.2, 0.8, '#d9c18d');
    }
    arch(0, -10, '#e6be66', 5);
  }
  if (kind === 'cannoncay') {
    cylinder(0, -0.3, 0, 6.2, 0.6, '#a8784e');
    for (let j = -5; j <= 5; j++)
      box(j, -0.02, 0, 0.05, 0.05, 2 * Math.sqrt(38.44 - j * j), '#5c5743');
    for (let j = 0; j < 4; j++) {
      const a = (j * Math.PI) / 2,
        x = Math.cos(a) * 11,
        z = Math.sin(a) * 11;
      cylinder(x, -0.5, z, 2, 0.6, '#d6c099');
      const cannon = box(x, 1, z, 1.2, 1.2, 2.6, '#38546a');
      cannon.rotation.y = -a;
      kit.hut(x, z + 2, '#c78d68');
    }
  }
  if (kind === 'prickleice') {
    ground(15, 15, '#c6e4e7');
    ring(0, 0.02, 0, 6.8, '#edfaff');
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      kit.rock(Math.sin(a) * 10, Math.cos(a) * 10, 2.3, '#bdd9e2');
      kit.tree(Math.sin(a) * 13, Math.cos(a) * 13, 'pine', 1.5);
    }
  }
  if (kind === 'crabtraffic') {
    ground(16, 11.6, '#b78d62');
    for (let z = -5.7; z <= 5.7; z += 0.7)
      box(0, 0.01, z, 16, 0.035, 0.05, '#6e6850');
    for (const x of [-7, 7])
      for (const z of [-7, 7]) {
        cylinder(x, -1, z, 0.3, 3, '#776751');
        box(x, 0.3, z, 1, 0.2, 1, '#cdae7d');
      }
    label('CRAB CROSSING →', 10, 2, 0, '#ffd263', 4);
    kit.hut(-11, -3, '#80b7ac');
  }
  if (kind === 'crumbleclock') {
    for (let j = 0; j < 12; j++) {
      const a = (j / 12) * Math.PI * 2;
      kit.rock(Math.cos(a) * 12, Math.sin(a) * 12, 3, '#607c71');
      kit.tree(Math.cos(a) * 15, Math.sin(a) * 15, 'mushroom', 1.4);
    }
    arch(0, -11, '#cfb789', 5);
  }
  if (kind === 'lanternlurk') {
    ground(15, 15, '#586979');
    for (let j = -3; j <= 3; j++)
      for (let k = -3; k <= 3; k++)
        box(
          j * 2,
          0.015,
          k * 2,
          1.8,
          0.025,
          1.8,
          (j + k) % 2 ? '#617584' : '#70838b',
        );
    for (const x of [-10, 10])
      for (const z of [-8, 8]) {
        cylinder(x, 1.5, z, 0.8, 5, '#658076');
        kit.mesh(new T.IcosahedronGeometry(0.55), '#ffa75d', x, 4.2, z);
      }
    arch(0, -10, '#adc2ad', 7);
  }
  if (kind === 'vinevault') {
    for (let i = 0; i < 4; i++) {
      cylinder(lane(i), 19, -0.8, 0.32, 44, '#548753');
      for (let j = 0; j < 15; j++) {
        const vine = kit.mesh(
          new T.TorusGeometry(1, 0.12, 5, 16),
          '#7fac60',
          lane(i),
          j * 3,
          -0.8,
        );
        vine.rotation.y = j * 0.8;
      }
      label('CROWN', lane(i), 43, 0, COLORS[i], 3);
    }
    for (const x of [-21, 21]) {
      kit.tree(x, 0, 'palm', 8);
    }
  }
  if (kind === 'mangrovemotors') {
    ground(11, 196, '#80c6c2', -88, -0.55);
    for (const x of [-7, 7]) {
      box(x, -0.25, -85, 2, 0.6, 194, '#c0b580');
      for (let j = 0; j < 16; j++)
        kit.tree(x + (j % 2 ? 1 : -1), -j * 12, 'palm', 1.5);
    }
    for (let j = 0; j < 10; j++)
      label(`${j * 20}m`, 6, 1, -j * 20, '#ffe6a6', 2);
    arch(0, -180, '#ffe9a0', 11);
    label('FINISH', 0, 4.5, -180, '#ffd263', 5);
  }
  if (kind === 'bubbletrouble') {
    ground(13, 145, '#dcd6b1', -60, -1.4);
    for (const x of [-7, 7])
      for (let j = 0; j < 18; j++) {
        kit.rock(x, -j * 7, 1.2, j % 2 ? '#cf92a2' : '#a98ac0');
        const coral = kit.tree(x, -j * 7, 'mushroom', 0.8);
        coral.position.y = -1;
      }
    for (let j = 0; j < 9; j++) {
      const hoop = kit.mesh(
        new T.TorusGeometry(7, 0.1, 6, 32),
        '#7abbc9',
        0,
        1,
        -j * 16,
      );
      hoop.scale.y = 0.45;
    }
    arch(0, -120, '#f4d6a0', 11);
  }
  if (kind === 'frostyfreight') {
    for (const x of [-8, 8]) {
      box(x, -0.35, -78, 11, 0.7, 172, '#d4e8ed');
      for (const side of [-6, 6]) box(x + side, 1, -78, 0.6, 2, 174, '#97c6da');
      arch(x, -160, '#ef8797', 11);
    }
    for (let j = 0; j < 14; j++)
      kit.tree(j % 2 ? 20 : -20, -j * 12, 'pine', 2.4);
  }
  if (kind === 'pelicanpilots') {
    for (const x of [-8, 8]) {
      box(x, -0.3, 3, 11, 0.6, 7, '#e6c894');
      arch(x, -142, '#f8df85', 12);
    }
    for (let j = 0; j < 20; j++) {
      const x = Math.sin(j * 4) * 30,
        z = -j * 8;
      kit.rock(x, z, 3 + (j % 3), '#89acaa');
      if (j % 2 === 0) kit.tree(x, z, 'palm', 1.5);
    }
  }
  if (kind === 'hotelhiccup') {
    ground(15, 12, '#cfaaa0');
    for (const x of [-8, 8]) box(x, 6, -5, 0.6, 15, 2, '#dda883');
    for (let y = 0; y < 12; y += 3) {
      box(0, y + 2.3, -5.6, 15, 0.35, 0.7, '#e6c599');
      label(`FLOOR ${y / 3 + 1}`, 9, y + 1, -3, '#ffe8b4', 2.8);
    }
    kit.hut(-12, -7, '#e7bfa0');
    kit.hut(12, -7, '#b5ced1');
  }
  if (kind === 'picklepatrol') {
    ground(15, 15, '#d2b78d');
    for (const x of [-8, 8]) box(x, 0.6, 0, 0.7, 1.2, 17, '#af9067');
    for (const z of [-8, 8]) box(0, 0.6, z, 16, 1.2, 0.7, '#af9067');
    for (let j = 0; j < 8; j++)
      kit.rock(Math.cos(j) * 12, Math.sin(j) * 12, 2, '#d2bd91');
  }
  if (kind === 'mangosluggers') {
    for (let i = 0; i < 4; i++) {
      box(lane(i), -0.2, -7, 7, 0.4, 29, '#75a98a');
      box(lane(i), 0.01, 5, 3, 0.035, 0.15, '#fff0c5');
      for (const x of [-3.5, 3.5]) {
        box(lane(i) + x, 2, -5, 0.08, 4, 30, '#547b79');
        for (let j = 0; j < 8; j++)
          box(lane(i) + x, 2, -18 + j * 4, 0.08, 4, 0.08, '#a0c1ab');
      }
      for (const [z, value] of [
        [-6, 3],
        [-14, 5],
      ]) {
        box(lane(i), 0.025, z, 7, 0.03, 0.12, '#edcf87');
        label(`${value} POINTS`, lane(i), 0.4, z - 1, COLORS[i], 3);
      }
      label('1 / 3 / 5', lane(i), 2, -20, COLORS[i], 4);
      cylinder(lane(i), 0.5, -9, 0.7, 1, '#edba6c');
    }
  }
  if (kind === 'geckograffiti') {
    ground(14, 11, '#65b7b8', 0, -0.5);
    for (const z of [-7, 7]) {
      box(0, -0.25, z, 15, 0.5, 3, '#e6d7af');
      for (let x = -8; x <= 8; x += 4) kit.tree(x, z * 1.7, 'palm', 1.3);
    }
    ring(0, -0.16, 0, 5.8, '#b9d9b8');
  }
  if (kind === 'skewergallery') {
    ground(15, 10, '#879dab', -2);
    ground(10, 3, '#d3b880', 7);
    arch(0, -8, '#ebbb75', 15);
    for (let x = -7; x <= 7; x += 2)
      box(x, 3.8, -8, 1, 1, 0.25, x % 4 ? '#f2949d' : '#ffe4a4');
    label('DODGE THE SKEWERS', 0, 4.8, -8, '#fff0ce', 7);
  }
  if (kind === 'boulderbuffet') {
    const slope = box(0, 2.2, 0, 14, 0.7, 17, '#bdab78');
    slope.rotation.x = Math.atan(0.31);
    box(0, 4.75, -9, 14, 0.5, 3, '#ddc98c');
    for (let j = 0; j < 6; j++) {
      label(`+${j + 1}`, 7, (j + 1) * 0.95, -j * 3 + 5, '#fff0c5', 1.5);
    }
    kit.hut(11, -9, '#8fab85');
  }
  if (kind === 'returnsender') {
    for (const x of [-6, 6])
      box(x, -0.25, 0, 4, 0.5, 14, x < 0 ? '#dfc28b' : '#b2cbd7');
    for (let j = 0; j < 6; j++) {
      box(0, -0.2, (j - 2.5) * 2, 10, 0.35, 1.25, '#6b7887');
      for (const x of [-8.5, 8.5]) {
        box(x, 1, (j - 2.5) * 2, 1.5, 2, 1.5, '#617789');
      }
    }
    label('SUN DISPATCH', -7, 3, -8, TEAM[0], 5);
    label('MOON DISPATCH', 7, 3, -8, TEAM[1], 5);
  }
  if (kind === 'sundaesummit') {
    ground(14, 14, '#efc8b4');
    for (let j = 0; j < 10; j++) {
      const a = (j * Math.PI) / 5,
        x = Math.cos(a) * 10,
        z = Math.sin(a) * 10;
      cylinder(x, 0.2, z, 1.6, 0.7, '#eedebb');
      kit.mesh(
        new T.SphereGeometry(1.5, 12, 8),
        j % 2 ? '#d8a3c6' : '#9bcfc1',
        x,
        1.3,
        z,
      );
    }
    label('SCOOP SKY', 0, 5, -10, '#ffe4a4', 6);
  }
  if (kind === 'postcardpanic') {
    ground(15, 14, '#e1ceab');
    kit.hut(0, -11, '#7fb8bd');
    arch(0, -9, '#f0d795', 5);
    label('ISLAND POST', 0, 4, -10, '#ffe7ba', 5);
    for (let j = 0; j < 6; j++)
      kit.tree(j % 2 ? 11 : -11, (j - 3) * 4, 'palm', 1.4);
  }
  if (kind === 'raingarden') {
    ground(15, 15, '#adcaab');
    for (const x of [-8, 8]) {
      for (let z = -8; z <= 8; z += 4) box(x, 3, z, 0.15, 6, 0.15, '#e6dec0');
      box(x, 6, 0, 0.2, 0.2, 16, '#e6dec0');
    }
    for (let z = -8; z <= 8; z += 4) {
      const r = kit.mesh(
        new T.TorusGeometry(8, 0.08, 5, 32, Math.PI),
        '#d7e4d5',
        0,
        3,
        z,
      );
      r.rotation.z = 0;
    }
    kit.hut(11, -6, '#bfca98');
  }
  if (kind === 'parasolpearls') {
    for (let j = 0; j < 18; j++) {
      const cloud = kit.mesh(
        new T.SphereGeometry(2, 12, 8),
        '#c2c7df',
        j % 2 ? 11 : -11,
        j * 2,
        2,
      );
      cloud.scale.set(2, 0.55, 1);
    }
    box(0, -0.15, 0, 16, 0.3, 5, '#eddbc0');
    label('SEA LEVEL', 0, 1.3, 0, '#fff0ce', 5);
  }
  if (kind === 'coinquake') {
    cylinder(0, -0.3, 0, 6.2, 0.6, '#c0ad92');
    cylinder(0, -4.3, 0, 5.2, 7.4, '#ebd9b5');
    for (const x of [-4.5, 4.5]) {
      ring(x, 0.03, 0, 1.25, '#ffd86e');
      label('BANK · E', x, 1.8, 0, '#ffd86e', 2.5);
    }
    box(8, 7, -7, 0.45, 14, 0.45, '#597c88');
    box(2, 13, -7, 12, 0.4, 0.4, '#597c88');
    label('CRANE ROOF', 0, 3, -10, '#ffe9c0', 6);
  }
  if (kind === 'hooklinelunch') {
    box(0, -0.25, 6, 34, 0.5, 3, '#b58e69');
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 3; j++) {
        box(lane(i), -0.6, -2 - j * 4, 6, 0.1, 0.12, '#a1d7d5');
        label(`${1 + j * 2} POINTS`, lane(i), 0.4, -2 - j * 4, COLORS[i], 2.8);
      }
      cylinder(lane(i), -0.7, 7, 0.25, 3, '#796a53');
    }
    kit.hut(-21, 7, '#c4ac7e');
  }
  if (
    [
      'coconutcompass',
      'fossilfillet',
      'lostluggage',
      'doughdouble',
      'bentoblocks',
    ].includes(kind)
  ) {
    for (let i = 0; i < 4; i++) {
      const cx = lane(i);
      box(
        cx,
        -0.55,
        0,
        7,
        0.65,
        kind === 'lostluggage' ? 12 : 8,
        kind === 'fossilfillet'
          ? '#c7ab88'
          : kind === 'lostluggage'
            ? '#97b5b6'
            : '#e8d4b2',
      );
      for (const x of [-2.8, 2.8])
        for (const z of [-2.8, 2.8])
          box(cx + x, -1.6, z, 0.45, 2, 0.45, '#887b64');
      label(
        players[i].avatar.name,
        cx,
        1.5,
        kind === 'lostluggage' ? 6 : 5,
        COLORS[i],
        5,
      );
      if (kind === 'fossilfillet') cylinder(cx, -0.08, 0, 2.8, 0.25, '#e4c693');
      if (kind === 'doughdouble') cylinder(cx, 0.05, 0, 2.7, 0.35, '#efe0ba');
      if (kind === 'bentoblocks') {
        box(cx, -0.16, 0, 4.5, 0.15, 6.8, '#3f6472');
        for (let x = 0; x < 7; x++)
          box(cx + (x - 3) * 0.62, -0.06, 0, 0.025, 0.025, 6.2, '#6895a0');
        for (let z = 0; z < 11; z++)
          box(cx, -0.06, (z - 5) * 0.62, 3.72, 0.025, 0.025, '#6895a0');
      }
      if (kind === 'lostluggage') {
        for (let z = 0; z < 3; z++)
          for (let x = 0; x < 3; x++)
            box(
              cx + (x - 1) * 1.6,
              -0.12,
              -3 + z * 1.4,
              1.4,
              0.15,
              1.2,
              (x + z) % 2 ? '#e8d7b0' : '#c6cdb1',
            );
      }
    }
    ground(
      38,
      25,
      kind === 'fossilfillet'
        ? '#d5bd91'
        : kind === 'lostluggage'
          ? '#aebec0'
          : kind === 'bentoblocks'
            ? '#648b99'
            : kind === 'doughdouble'
              ? '#e2bcb0'
              : '#b4bd95',
      -2,
      -1.3,
    );
    for (let j = 0; j < 8; j++) {
      const x = (j - 3.5) * 5;
      if (kind === 'fossilfillet') {
        kit.rock(x, -11, 1.8, '#b79e7a');
        const bone = kit.mesh(
          new T.CapsuleGeometry(0.12, 1.2, 4, 8),
          '#eee0b9',
          x,
          0.2,
          -8,
        );
        bone.rotation.z = j;
      } else if (kind === 'lostluggage') {
        box(x, 0.1, -9, 4, 0.5, 1.4, '#55757d');
        box(x, 2, -12, 0.15, 4, 0.15, '#78989c');
        label('BAGGAGE', x, 4, -12, '#dce9df', 3);
      } else if (kind === 'doughdouble') {
        cylinder(x, 0.2, -10, 1.6, 0.6, '#c9a675');
        cylinder(x, 0.6, -10, 1.5, 0.15, '#efd9a6');
        for (let k = 0; k < 4; k++)
          kit.mesh(
            new T.SphereGeometry(0.3, 9, 6),
            '#f1dabb',
            x + Math.sin(k * 1.6) * 0.7,
            0.9,
            -10 + Math.cos(k * 1.6) * 0.7,
          );
      } else if (kind === 'bentoblocks') {
        box(x, 0.15, -9, 4, 0.5, 1.5, '#426876');
        box(x, 0.7, -9, 1.2, 0.7, 1, TILE_COLORS[j % 7]);
        arch(x, -12, '#e8bd83', 4);
      } else {
        kit.hut(x, -11, '#a5b988');
        kit.mesh(new T.SphereGeometry(0.45, 9, 6), '#9b7853', x, 0.1, -8);
      }
    }
  }
  if (kind === 'picnicpartition') {
    ground(31, 17, '#7fa67f');
    for (const x of [-8, 8]) {
      box(x, -0.1, 0, 12, 0.25, 12, '#f0d4b4');
      for (let j = -5; j <= 5; j++)
        box(x + j, 0.04, 0, 0.08, 0.025, 11, '#dd8d85');
      cylinder(x, 0.7, 6, 0.55, 1.4, '#749eac');
      label('REFILL · E', x, 2, 6, '#d8f3e5', 3);
    }
    for (let j = 0; j < 8; j++)
      kit.tree(j % 2 ? 19 : -19, (j - 4) * 4, 'palm', 2);
  }
  if (
    [
      'volleybuns',
      'puckpicnic',
      'pineapplestrikers',
      'goalguava',
      'touchdowntiki',
    ].includes(kind)
  ) {
    ground(
      15,
      17,
      kind === 'puckpicnic'
        ? '#d5e7ec'
        : kind === 'volleybuns'
          ? '#edd9ac'
          : kind === 'goalguava'
            ? '#dabfb0'
            : '#86ac86',
    );
    for (const x of [-7, 7]) box(x, 0.02, 0, 0.08, 0.03, 16, '#fff1cb');
    for (const z of [-8, 0, 8]) box(0, 0.02, z, 14, 0.03, 0.07, '#fff1cb');
    if (kind === 'volleybuns') {
      for (const x of [-7.4, 7.4]) box(x, 1.2, 0, 0.15, 2.5, 0.15, '#d1a36e');
      for (let x = -7; x <= 7; x += 0.6)
        box(x, 1.1, 0, 0.025, 1.8, 0.025, '#f7eccf');
      for (let y = 0.3; y <= 2; y += 0.3)
        box(0, y, 0, 14, 0.025, 0.025, '#f7eccf');
    } else if (kind === 'touchdowntiki')
      for (const x of [-5, 0, 5]) arch(x, -8, '#e7c778', 2.7);
    else if (kind === 'goalguava') arch(0, -8, '#edc59f', 12);
    else
      for (const z of [-8.4, 8.4])
        arch(0, z, '#e4b078', kind === 'puckpicnic' ? 4.4 : 13);
    for (let j = 0; j < 3; j++)
      for (const x of [-10, 10])
        box(x, j * 0.6, (j - 1) * 3, 3, 0.6, 16, '#c4b7a2');
    for (let j = 0; j < 10; j++)
      kit.tree(j % 2 ? 16 : -16, (j - 5) * 4, ice ? 'pine' : 'palm', 1.8);
  }
  if (kind === 'paddleplunder') {
    cylinder(0, -0.5, 0, 10, 0.15, '#69b9b0');
    ring(0, -0.35, 0, 9.2, '#c9d9a8');
    for (let j = 0; j < 18; j++) {
      const a = (j / 18) * Math.PI * 2;
      cylinder(Math.cos(a) * 13, -0.5, Math.sin(a) * 13, 2.7, 1, '#c2bd8b');
      kit.tree(Math.cos(a) * 13, Math.sin(a) * 13, 'palm', 1.7);
    }
  }
  if (kind === 'crateescape') {
    ground(14, 14, '#bca587');
    for (let x = -7; x <= 7; x++) box(x, 0.02, 0, 0.03, 0.03, 14, '#796f61');
    for (let z = -7; z <= 7; z++) box(0, 0.02, z, 14, 0.03, 0.03, '#796f61');
    for (let j = 0; j < 16; j++) {
      const x = j % 2 ? 10 : -10,
        z = (Math.floor(j / 2) - 3.5) * 3;
      box(
        x,
        1 + (j % 3) * 0.4,
        z,
        2.3,
        2 + (j % 3) * 0.8,
        2.3,
        j % 2 ? '#a17d59' : '#b79767',
      );
    }
    arch(0, -10, '#d5ba85', 9);
  }
  if (kind === 'rubblerunners') {
    for (const x of [-8, 8]) {
      box(x, -0.25, -45, 7, 0.5, 110, '#d6bc8d');
      for (const edge of [-4, 4])
        box(x + edge, 0.35, -45, 0.6, 0.7, 112, '#9a8067');
      arch(x, -98, '#edd494', 7);
    }
    for (let j = 0; j < 24; j++)
      kit.rock(j % 2 ? 18 : -18, -j * 5, 3.5 + (j % 3), '#ae8e78');
  }
  kit.bake();
  const db = (
    parent: T.Object3D,
    w: number,
    h: number,
    d: number,
    c: string,
    x = 0,
    y = 0,
    z = 0,
  ) => dynamic.box(x, y, z, w, h, d, c, parent);
  const dm = (
    parent: T.Object3D,
    geo: T.BufferGeometry,
    c: string,
    x = 0,
    y = 0,
    z = 0,
  ) => dynamic.mesh(geo, c, x, y, z, parent);
  const dr = (parent: T.Object3D, r: number, c: string, y = 0.04) => {
    const m = dm(parent, new T.TorusGeometry(r, 0.045, 5, 40), c, 0, y, 0);
    m.rotation.x = Math.PI / 2;
    return m;
  };
  const avatarViews = players.map((v, i) => {
    const body = makeAvatar(v.avatar);
    body.scale.multiplyScalar(0.8);
    scene.add(body);
    const name = label(v.avatar.name, 0, 2.7, 0, COLORS[i], 2.7),
      you = label('▼ YOU', 0, 3.25, 0, '#ffffff', 2);
    const tool = new T.Group(),
      stack = new T.Group();
    scene.add(tool, stack);
    const halo = dr(scene, 0.58, COLORS[i]);
    if (['picklepatrol', 'skewergallery', 'geckograffiti'].includes(kind)) {
      db(
        tool,
        1.2,
        0.55,
        1.35,
        kind === 'picklepatrol' ? '#708c76' : '#dfbd87',
        0,
        0.25,
      );
      db(tool, 0.22, 0.22, 1.2, '#475e6a', 0, 1.0, 0.5);
      if (kind === 'picklepatrol')
        for (const x of [-0.65, 0.65])
          db(tool, 0.25, 0.4, 1.6, '#41515b', x, 0.2);
    }
    if (kind === 'mangosluggers') {
      const bat = dm(
        tool,
        new T.CylinderGeometry(0.12, 0.07, 1.5, 8),
        '#ebca94',
        0.55,
        1.1,
        0.3,
      );
      bat.rotation.z = 0.5;
    }
    if (kind === 'hooklinelunch') {
      const rod = db(tool, 0.055, 3, 0.055, '#e4c693', 0.4, 2, 0.5);
      rod.rotation.x = 0.7;
    }
    if (kind === 'raingarden') {
      dm(
        tool,
        new T.CylinderGeometry(0.48, 0.3, 0.5, 10),
        '#ddac8a',
        0,
        1,
        0.65,
      );
      const lid = db(tool, 1, 0.08, 0.75, '#83ae84', 0, 1.4, 0.6);
      lid.name = 'lid';
    }
    if (kind === 'parasolpearls') {
      dm(tool, new T.CylinderGeometry(0.035, 0.035, 2.4, 6), '#ead8b1', 0, 2.1);
      const canopy = dm(
        tool,
        new T.ConeGeometry(1.45, 0.65, 12),
        COLORS[i],
        0,
        3.3,
      );
      canopy.name = 'parasol';
    }
    if (kind === 'sundaesummit') {
      const cone = dm(
        tool,
        new T.ConeGeometry(0.4, 1.1, 10),
        '#d6a56c',
        0,
        1.45,
        0,
      );
      cone.rotation.z = Math.PI;
      for (let j = 0; j < 40; j++) {
        const scoop = dm(
          stack,
          new T.SphereGeometry(0.36, 10, 7),
          [COLORS[i], '#eee0bb', '#96c7ad'][j % 3],
        );
        scoop.position.y = 1.9 + j * 0.2;
        scoop.visible = false;
      }
    }
    if (['mangrovemotors', 'bubbletrouble'].includes(kind)) {
      const hull = dm(
        tool,
        new T.SphereGeometry(0.8, 12, 6),
        COLORS[i],
        0,
        -0.18,
        0,
      );
      hull.scale.set(0.7, 0.35, 1.7);
      db(tool, 0.65, 0.2, 0.8, '#efe3bd', 0, 0.01);
    }
    if (kind === 'picnicpartition') {
      db(tool, 0.15, 0.15, 1.15, '#e4e1c9', 0.5, 0.8, 0.3);
    }
    if (['puckpicnic', 'pineapplestrikers'].includes(kind)) {
      db(tool, 0.08, 0.9, 0.08, '#d3b77f', 0.55, 0.4, 0.45);
      db(tool, 0.15, 0.1, 0.8, '#e1ca98', 0.55, 0.05, 0.7);
    }
    if (kind === 'crateescape') {
      db(
        tool,
        i === 0 ? 1.1 : 1.8,
        1.4,
        i === 0 ? 1.1 : 1.8,
        COLORS[i],
        0,
        0.55,
      );
      for (const y of [0.1, 1]) db(tool, 1.85, 0.1, 1.85, '#775b44', 0, y);
    }
    if (kind === 'rubblerunners') {
      db(tool, 0.09, 1.25, 0.09, '#8c7156', 0.5, 1.1);
      db(tool, 0.7, 0.4, 0.4, '#718d99', 0.5, 1.65);
    }
    return { body, name, you, tool, stack, halo };
  });
  const tileViews: {
    group: T.Group;
    body: T.Mesh;
    label: T.Sprite;
    index: number;
    copy: number;
  }[] = [];
  function newTile(t: GTile, index: number, copy: number) {
    const group = new T.Group();
    scene.add(group);
    let body: T.Mesh;
    if (kind === 'tidetiles')
      body = dm(
        group,
        new T.CylinderGeometry(2.22, 1.95, 0.5, 24),
        TILE_COLORS[t.tag],
        0,
        -0.25,
      );
    else if (kind === 'vinevault') {
      body = dm(
        group,
        new T.SphereGeometry(1, 12, 6),
        t.tag % 4 === 0 ? '#e4c673' : '#7bae72',
        0,
        -0.2,
      );
      body.scale.set(t.w / 2, 0.2, t.d / 2);
    } else if (kind === 'pelicanpilots') {
      body = dm(group, new T.TorusGeometry(2.3, 0.13, 8, 32), TEAM[copy]);
    } else if (kind === 'rubblerunners') {
      body = dm(
        group,
        new T.DodecahedronGeometry(1.2),
        t.tag ? '#788b94' : '#bfa785',
        0,
        0.65,
      );
      body.scale.set(1, 0.9, 0.85);
      if (t.tag) dr(group, 1.12, '#c6d4d4', 0.8);
    } else if (kind === 'hotelhiccup') {
      body = db(group, t.w, 2.3, 0.3, TILE_COLORS[t.tag], 0, 1.15);
      db(group, 0.1, 0.1, 0.1, '#ffe7a4', 0.45, 1.0, 0.2);
    } else if (
      ['mangrovemotors', 'bubbletrouble', 'frostyfreight'].includes(kind)
    ) {
      body = db(
        group,
        t.w,
        kind === 'bubbletrouble' && t.tag === 0 ? 0.65 : 0.9,
        t.d,
        kind === 'frostyfreight'
          ? '#90bdca'
          : kind === 'bubbletrouble'
            ? t.tag === 0
              ? '#eaa5ac'
              : '#aa90b8'
            : '#956c4e',
        0,
        kind === 'bubbletrouble' && t.tag === 0 ? 0.3 : 0.15,
      );
    } else if (kind === 'crumbleclock')
      body = db(group, t.w, 3.5, t.d, '#c4b287', 0, -1.75);
    else if (kind === 'picnicpartition') {
      body = db(group, t.w, 0.6, t.d, '#e6c38d', 0, 0.18);
      db(group, t.w, 0.1, t.d, '#84ae72', 0, 0.11);
      db(group, t.w, 0.08, t.d, '#d88c76', 0, 0.26);
    } else if (kind === 'coconutcompass')
      body = db(group, t.w, 0.08, t.d, '#beac83', 0, -0.08);
    else if (kind === 'pineapplestrikers') {
      body = dm(group, new T.SphereGeometry(0.55, 8, 6), '#e0b65a', 0, 0.55);
      dm(group, new T.ConeGeometry(0.5, 0.65, 6), '#78a36e', 0, 1.2);
    } else
      body = db(
        group,
        t.w,
        kind === 'lanternlurk' ? 3 : kind === 'raingarden' ? 0.65 : 1.5,
        t.d,
        kind === 'lanternlurk'
          ? '#839889'
          : kind === 'raingarden'
            ? '#7c9c65'
            : kind === 'skewergallery'
              ? '#a3bdc8'
              : '#b1a585',
        0,
        kind === 'lanternlurk' ? 1.5 : kind === 'raingarden' ? 0.3 : 0.65,
      );
    const text = label(
      '',
      0,
      kind === 'hotelhiccup'
        ? 2.6
        : kind === 'crumbleclock'
          ? 0.2
          : kind === 'tidetiles'
            ? 0.2
            : 1.8,
      0,
      '#fff2c9',
      kind === 'crumbleclock' ? 1.8 : 2.4,
      group,
    );
    tileViews.push({ group, body, label: text, index, copy });
    return tileViews[tileViews.length - 1];
  }
  const objectPool: {
    group: T.Group;
    kind: string;
    used: boolean;
    body: T.Mesh;
    warning: T.Mesh;
    text: T.Sprite;
  }[] = [];
  function objectView(o: GObject) {
    let v = objectPool.find((v) => !v.used && v.kind === o.kind);
    if (v) {
      v.used = true;
      return v;
    }
    const group = new T.Group();
    scene.add(group);
    let body: T.Mesh;
    const colored = [
      'coin',
      'pearl',
      'scoop',
      'pitch',
      'metal',
      'cannonball',
      'melon',
      'ball',
      'guava',
      'urchin',
      'beetle',
      'jelly',
    ].includes(o.kind);
    if (colored) {
      const color =
        o.kind === 'urchin'
          ? '#9874b0'
          : o.kind === 'metal' || o.kind === 'cannonball'
            ? '#485967'
            : o.kind === 'coin' || o.kind === 'pearl'
              ? '#f5d16f'
              : o.kind === 'melon'
                ? '#8bb573'
                : o.kind === 'scoop'
                  ? '#edbbc4'
                  : o.kind === 'jelly'
                    ? '#bca6dc'
                    : o.kind === 'beetle'
                      ? '#6f8470'
                      : '#f1dbae';
      body = dm(
        group,
        o.kind === 'metal' || o.kind === 'urchin'
          ? new T.IcosahedronGeometry(1)
          : new T.SphereGeometry(1, 12, 8),
        color,
      );
      body.scale.setScalar(o.r);
      if (o.kind === 'coin') body.scale.y = 0.16;
      if (o.kind === 'ball' && kind === 'puckpicnic') body.scale.y = 0.12;
      if (o.kind === 'ball' && kind === 'pineapplestrikers')
        body.material = dynamic.mat('#97b482');
      if (o.kind === 'urchin')
        for (let j = 0; j < 10; j++) {
          const a = (j / 10) * Math.PI * 2,
            spike = dm(
              group,
              new T.ConeGeometry(0.13, 0.5, 5),
              '#e7c9e5',
              Math.sin(a) * o.r * 0.9,
              0,
              Math.cos(a) * o.r * 0.9,
            );
          spike.rotation.set(Math.PI / 2, a, 0);
        }
      if (o.kind === 'jelly')
        for (let j = 0; j < 5; j++)
          db(group, 0.06, 0.7, 0.06, '#c5bddf', (j - 2) * 0.2, -0.6);
      if (o.kind === 'beetle')
        for (const x of [-0.4, 0.4])
          for (const z of [-0.3, 0, 0.3])
            db(group, 0.4, 0.07, 0.06, '#394f4b', x, -0.1, z);
    } else if (o.kind === 'crab') {
      body = dm(group, new T.SphereGeometry(o.r, 10, 6), '#dc987b', 0, 0.35);
      body.scale.set(1, 0.6, 0.85);
      for (const x of [-1, 1]) {
        dm(
          group,
          new T.SphereGeometry(0.14, 6, 5),
          '#fff0d7',
          x * o.r * 0.45,
          0.75,
          -0.1,
        );
        dm(
          group,
          new T.SphereGeometry(0.07, 6, 5),
          '#293e47',
          x * o.r * 0.45,
          0.77,
          -0.22,
        );
        for (const z of [-0.4, 0, 0.4])
          db(group, o.r * 0.75, 0.12, 0.13, '#d5866c', x * o.r, 0.2, z);
      }
    } else if (o.kind === 'gecko') {
      body = dm(group, new T.SphereGeometry(o.r, 10, 6), '#a6bba0', 0, 0.2);
      body.scale.set(1, 0.45, 1.6);
      dm(
        group,
        new T.SphereGeometry(o.r * 0.55, 10, 6),
        '#b8d09a',
        0,
        0.45,
        -0.35,
      );
      db(group, 0.15, 0.1, 0.9, '#8aab76', 0, 0.25, 0.65);
    } else if (o.kind === 'letter' || o.kind === 'case') {
      body = db(
        group,
        o.kind === 'case' ? 1 : 0.75,
        o.kind === 'case' ? 0.45 : 0.06,
        o.kind === 'case' ? 0.8 : 0.55,
        o.kind === 'case'
          ? TILE_COLORS[o.tag % 7]
          : o.tag === 1
            ? TEAM[0]
            : o.tag === 2
              ? TEAM[1]
              : '#f0e7cb',
      );
      const arrow = dm(
        group,
        new T.ConeGeometry(0.18, 0.4, 3),
        '#3a5a68',
        0,
        0.28,
        -0.1,
      );
      arrow.rotation.x = -Math.PI / 2;
    } else if (o.kind === 'mailcart') {
      body = db(
        group,
        1.25,
        0.8,
        1.1,
        o.tag === 1 ? TEAM[0] : TEAM[1],
        0,
        0.55,
      );
      for (const x of [-0.65, 0.65])
        for (const z of [-0.4, 0.4]) {
          const wheel = dm(
            group,
            new T.CylinderGeometry(0.23, 0.23, 0.12, 10),
            '#4c6170',
            x,
            0.15,
            z,
          );
          wheel.rotation.z = Math.PI / 2;
        }
    } else if (o.kind === 'snackraft') {
      body = db(group, 1.4, 0.25, 1.1, '#bc9565', 0, 0.05);
      dm(group, new T.CapsuleGeometry(0.2, 0.6, 4, 8), '#de9370', 0, 0.35);
    } else if (o.kind === 'parcel') {
      body = db(group, 0.7, 0.7, 0.7, '#e3bc84', 0, 0.2);
      db(group, 0.73, 0.08, 0.72, '#708b8c', 0, 0.28);
    } else {
      body = db(
        group,
        o.kind === 'paintshot' ? 0.35 : 0.14,
        0.14,
        o.kind === 'hook' ? 0.2 : 0.8,
        o.kind === 'paintshot' ? TEAM[o.owner % 2] : '#f6dea5',
      );
    }
    const warning = dr(
      scene,
      o.kind === 'cannonball'
        ? 3
        : o.kind === 'scoop' || o.kind === 'metal' || o.kind === 'coin'
          ? 0.65
          : 0.35,
      o.kind === 'cannonball' || o.kind === 'metal' ? '#f3a18b' : '#fff0bd',
    );
    const text = label('', 0, 1.1, 0, '#fff1cb', 1.8, group);
    v = { group, body, warning, text, kind: o.kind, used: true };
    objectPool.push(v);
    return v;
  }
  const extras = new T.Group();
  scene.add(extras);
  const cloud = new T.Group();
  extras.add(cloud);
  for (let j = 0; j < 5; j++) {
    const m = dm(
      cloud,
      new T.SphereGeometry(0.9, 10, 6),
      '#dcece9',
      (j - 2) * 0.75,
      0,
      Math.sin(j) * 0.35,
    );
    m.scale.y = 0.65;
  }
  const rainRing = dr(extras, 2.6, '#b5eff1'),
    rainDrops = Array.from({ length: low ? 12 : 30 }, (_, j) =>
      db(extras, 0.035, 0.35, 0.035, '#d2f5ef', 0, 0, 0),
    );
  const monster = new T.Group();
  extras.add(monster);
  const monsterBody = dm(
    monster,
    new T.SphereGeometry(1, 12, 8),
    '#b5a579',
    0,
    0.7,
  );
  monsterBody.scale.set(0.8, 0.6, 1.4);
  for (const x of [-0.4, 0.4])
    dm(monster, new T.SphereGeometry(0.15, 7, 6), '#ffda84', x, 1, -0.9);
  const flame = dm(extras, new T.ConeGeometry(2.1, 4.6, 20), '#edb877');
  flame.rotation.x = Math.PI / 2;
  flame.material = flame.material.clone();
  flame.material.transparent = true;
  flame.material.opacity = 0.38;
  flame.material.depthWrite = false;
  const reticle = dr(extras, 0.65, '#ffdd83');
  const beltLabels = Array.from({ length: 6 }, (_, j) =>
    label('→', 0, 0.35, (j - 2.5) * 2, '#ffe4a8', 2),
  );
  const vehicles = [0, 1].map((team) => {
    const group = new T.Group();
    scene.add(group);
    const hull = dm(group, new T.SphereGeometry(1, 12, 7), TEAM[team], 0, 0.1);
    hull.scale.set(
      kind === 'paddleplunder' ? 1 : 1.5,
      0.35,
      kind === 'paddleplunder' ? 2 : 1.8,
    );
    if (kind === 'pelicanpilots') {
      for (const x of [-1, 1]) {
        const wing = db(group, 3, 0.12, 1, '#efdfb9', x * 1.6, 0.25);
        wing.name = 'wing' + x;
      }
    }
    if (kind === 'rubblerunners') {
      db(group, 2.5, 1.3, 2.6, '#ceb184', 0, 0.65);
      for (const x of [-1.3, 1.3])
        for (const z of [-1, 1]) {
          const wheel = dm(
            group,
            new T.CylinderGeometry(0.45, 0.45, 0.2, 10),
            '#596c73',
            x,
            0,
            z,
          );
          wheel.rotation.z = Math.PI / 2;
        }
    }
    if (kind === 'paddleplunder')
      for (const x of [-1, 1]) {
        const paddle = db(group, 0.18, 0.12, 2.6, '#d7bf8d', x, 0.3);
        paddle.name = 'paddle' + x;
      }
    return group;
  });
  function faceDiagram(parent: T.Object3D, zOffset = 0, scale = 1) {
    const group = new T.Group();
    parent.add(group);
    group.position.set(0, 0.1, zOffset);
    group.scale.setScalar(scale);
    const eyes = [0, 1].map(() => {
      const m = dm(group, new T.SphereGeometry(0.17, 10, 7), '#3d555e');
      m.scale.set(1, 0.45, 1.4);
      return m;
    });
    const nose = dm(group, new T.SphereGeometry(0.18, 10, 6), '#dda98d');
    const geo = new T.BufferGeometry();
    geo.setAttribute(
      'position',
      new T.BufferAttribute(new Float32Array(13 * 3), 3),
    );
    const mouth = new T.Line(
      geo,
      new T.LineBasicMaterial({ color: '#4b6168' }),
    );
    group.add(mouth);
    return { group, eyes, nose, mouth };
  }
  function poseFace(
    face: ReturnType<typeof faceDiagram>,
    points: { x: number; z: number }[],
  ) {
    face.eyes.forEach((eye, j) =>
      eye.position.set(points[j ? 2 : 0].x, 0.42, points[j ? 2 : 0].z),
    );
    face.nose.position.set(points[1].x, 0.46, points[1].z + 0.5);
    const attr = face.mouth.geometry.getAttribute(
      'position',
    ) as T.BufferAttribute;
    for (let j = 0; j <= 12; j++) {
      const t = j / 12,
        u = 1 - t;
      attr.setXYZ(
        j,
        u * u * points[3].x + 2 * u * t * points[4].x + t * t * points[5].x,
        0.43,
        u * u * points[3].z +
          2 * u * t * (points[4].z + 0.5) +
          t * t * points[5].z,
      );
    }
    attr.needsUpdate = true;
  }
  const puzzleViews = players.map((_, i) => {
    const group = new T.Group();
    scene.add(group);
    group.position.x = lane(i);
    const cursor = dm(
      group,
      new T.SphereGeometry(0.22, 10, 8),
      COLORS[i],
      0,
      0.25,
    );
    const markers: T.Mesh[] = [],
      targets: T.Mesh[] = [],
      texts: T.Sprite[] = [];
    for (
      let j = 0;
      j <
      (kind === 'bentoblocks'
        ? 62
        : kind === 'fossilfillet'
          ? 40
          : kind === 'lostluggage'
            ? 9
            : 6);
      j++
    ) {
      const m = db(group, 0.54, 0.18, 0.54, COLORS[i]);
      markers.push(m);
      const target = dr(
        group,
        kind === 'fossilfillet' ? 0.07 : 0.18,
        '#466777',
      );
      targets.push(target);
      if (kind === 'lostluggage' || kind === 'doughdouble')
        texts.push(label(String(j + 1), 0, 0.7, 0, '#fff0c5', 0.8, group));
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute(
      'position',
      new T.BufferAttribute(new Float32Array(350 * 3), 3),
    );
    const trace = new T.Line(
      geometry,
      new T.LineBasicMaterial({ color: COLORS[i] }),
    );
    group.add(trace);
    const face = faceDiagram(group),
      targetFace = faceDiagram(group, -5.5, 0.6);
    face.group.visible = targetFace.group.visible = kind === 'doughdouble';
    if (kind === 'doughdouble') {
      dm(
        group,
        new T.CylinderGeometry(1.8, 1.8, 0.1, 24),
        '#efdfb8',
        0,
        0,
        -5.5,
      );
      label('TARGET FACE', 0, 0.5, -7.3, '#edf1d2', 3, group);
    }
    return { group, cursor, markers, targets, texts, trace, face, targetFace };
  });
  let aspect = 1,
    lastNow = performance.now(),
    currentLocal = 0;
  const look = new T.Vector3(),
    desired = new T.Vector3();
  function resize() {
    const w = root.clientWidth,
      h = root.clientHeight;
    if (!w || !h) return;
    aspect = w / h;
    renderer.setSize(w, h, false);
    const width =
      wide && aspect < 1.15
        ? 8
        : wide
          ? 22
          : kind === 'boulderbuffet'
            ? 15
            : 13;
    const halfH = Math.max(width / aspect, vertical ? 11 : 10);
    camera.left = -halfH * aspect;
    camera.right = halfH * aspect;
    camera.top = halfH;
    camera.bottom = -halfH;
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(root);
  resize();
  const hotelDeck = db(scene, 15, 0.4, 12, '#ceb49f');
  const eventBeacon = label('', 0, 4, -9, '#fff0c8', 5);
  function draw(w: Arena, localId: string, dt: number, reduced = false) {
    const g = w.grand;
    if (!g) return;
    const now = performance.now();
    currentLocal = Math.max(
      0,
      w.actors.findIndex((p) => p.id === localId),
    );
    const me = w.actors[currentLocal];
    desired.set(
      wide && aspect < 1.15
        ? quad
          ? lane(currentLocal)
          : me.team === 0
            ? -8
            : 8
        : 0,
      vertical
        ? kind === 'vinevault'
          ? me.y + 4
          : Math.max(5, me.y - 4)
        : kind === 'hotelhiccup'
          ? me.gear * 3 + 1
          : 0,
      long ? -me.distance - 8 : 0,
    );
    look.lerp(desired, reduced ? 1 : Math.min(1, dt * 8));
    if (w.time === 0) look.copy(desired);
    camera.position.set(
      look.x,
      look.y + (vertical ? 4 : 23),
      look.z + (vertical ? 32 : 25),
    );
    camera.lookAt(look);
    sun.position.set(look.x - 12, look.y + 30, look.z + 15);
    sun.target.position.copy(look);
    sun.target.updateMatrixWorld();
    avatarViews.forEach((v, i) => {
      const p = w.actors[i],
        s = g.seats[i],
        isPuzzle = [
          'coconutcompass',
          'fossilfillet',
          'lostluggage',
          'doughdouble',
          'bentoblocks',
        ].includes(kind),
        showBody = ![
          'coconutcompass',
          'fossilfillet',
          'doughdouble',
          'bentoblocks',
          'crateescape',
        ].includes(kind);
      v.body.visible =
        showBody && p.alive && (kind !== 'hotelhiccup' || p.gear === me.gear);
      v.body.position.set(p.x, p.y, p.z);
      v.body.rotation.y = p.face;
      animateAvatar(
        v.body,
        w.time,
        Math.hypot(p.vx, p.vz),
        !p.alive
          ? 'sad'
          : p.flash > 0
            ? 'surprised'
            : w.done
              ? 'happy'
              : 'neutral',
        reduced,
      );
      v.body.scale.y =
        players[i].avatar.height *
        0.8 *
        (p.input.b && kind === 'skewergallery' ? 0.65 : 1);
      v.body.visible =
        v.body.visible &&
        (!p.flash || reduced || Math.floor(w.time * 15) % 3 !== 0);
      v.name.position.set(p.x, p.y + 2.7, p.z);
      v.you.position.set(p.x, p.y + 3.3, p.z);
      v.name.visible = false;
      v.you.visible = !isPuzzle && p.alive && p.id === localId;
      v.halo.position.set(p.x, p.y + 0.03, p.z);
      v.halo.visible = p.alive && !vertical && !isPuzzle;
      v.tool.visible = p.alive && v.tool.children.length > 0;
      v.tool.position.set(p.x, p.y, p.z);
      v.tool.rotation.set(0, p.face, 0);
      if (kind === 'mangosluggers')
        v.tool.rotation.y = p.cooldown > 0 ? Math.PI + p.cooldown * 8 : Math.PI;
      if (kind === 'hooklinelunch') {
        v.tool.rotation.y = p.face;
        v.tool.rotation.x = -p.charge * 0.2;
      }
      if (kind === 'rubblerunners')
        v.tool.rotation.x = p.cooldown > 0 ? -p.cooldown * 2 : p.charge * 0.6;
      if (kind === 'raingarden') {
        const lid = v.tool.getObjectByName('lid');
        if (lid) lid.rotation.x = p.input.a && !p.input.b ? -1.2 : 0;
      }
      if (kind === 'parasolpearls') {
        const canopy = v.tool.getObjectByName('parasol')!;
        canopy.scale.setScalar(p.input.a && !p.input.b ? 1 : 0.22);
      }
      if (kind === 'crateescape') {
        v.tool.scale.setScalar(i === g.solo ? 0.65 : 1);
        v.tool.rotation.x = p.cooldown > 0 ? Math.sin(p.cooldown * 8) * 0.6 : 0;
      }
      v.stack.visible = kind === 'sundaesummit';
      v.stack.position.copy(v.tool.position);
      v.stack.rotation.z = reduced ? 0 : Math.sin(w.time * 5) * s.wobble * 0.12;
      v.stack.children.forEach((o, j) => (o.visible = j < p.score));
    });
    const copies = kind === 'frostyfreight' || kind === 'pelicanpilots' ? 2 : 1;
    for (let index = 0; index < g.tiles.length; index++)
      for (let copy = 0; copy < copies; copy++) {
        const t = g.tiles[index],
          v = tileViews[index * copies + copy] ?? newTile(t, index, copy);
        v.group.position.set(
          t.x + (copies === 2 ? (copy === 0 ? -8 : 8) : 0),
          t.y,
          t.z,
        );
        v.group.visible =
          t.hp > 0 && (kind !== 'hotelhiccup' || t.owner === me.gear);
        v.label.visible = false;
        if (kind === 'tidetiles') {
          v.label.visible = true;
          setText(v.label, SYMBOLS[t.tag]);
          v.body.material = dynamic.mat(
            t.tag === g.target ? '#ffe5a0' : TILE_COLORS[t.tag],
          );
          if (t.hp <= 0) {
            v.group.visible = true;
            v.group.position.y = -1.5;
            v.label.visible = false;
          }
        }
        if (kind === 'crumbleclock') {
          v.label.visible = t.hp > 0;
          setText(
            v.label,
            String(Math.ceil(t.hp)),
            t.hp < 8 ? '#ffb39b' : '#fff2c9',
          );
          v.body.material = dynamic.mat(t.hp < 8 ? '#b98877' : '#c4b287');
          if (t.hp <= 0) {
            v.group.visible = false;
          }
        }
        if (kind === 'hotelhiccup') {
          const memory = g.seats[currentLocal].memory[t.owner * 5 + t.tag];
          v.label.visible = v.group.visible;
          setText(
            v.label,
            `${t.tag + 1}${memory === 1 ? ' ✓' : memory === 0 ? ' ×' : ''}`,
          );
          v.body.material = dynamic.mat(
            memory === 0 ? '#837f89' : TILE_COLORS[t.tag],
          );
        }
        if (kind === 'coconutcompass') {
          v.body.material = dynamic.mat(
            g.seats[t.owner].coverage[t.tag] ? COLORS[t.owner] : '#b8aa89',
          );
        }
        if (kind === 'pelicanpilots') {
          v.body.material = dynamic.mat(
            t.tag < g.vehicles[copy].checkpoint
              ? '#90afa8'
              : t.tag === g.vehicles[copy].checkpoint
                ? '#ffe7a0'
                : TEAM[copy],
          );
        }
        if (kind === 'rubblerunners') {
          v.label.visible = t.hp > 0;
          setText(
            v.label,
            `${t.tag ? 'ARMOR ' : ''}${Math.ceil(t.hp)}`,
            t.tag ? '#cbe4e9' : '#ffe6b4',
          );
          v.group.scale.setScalar(t.hp <= 1 ? 0.86 : 1);
        }
      }
    for (let j = g.tiles.length * copies; j < tileViews.length; j++)
      tileViews[j].group.visible = false;
    objectPool.forEach((v) => {
      v.used = false;
      v.group.visible = false;
      v.warning.visible = false;
    });
    for (const o of g.objects) {
      if (o.life <= 0) continue;
      const v = objectView(o);
      v.group.visible = !(kind === 'lostluggage' && w.time < 5);
      v.group.position.set(o.x, o.y, o.z);
      v.group.rotation.set(0, 0, 0);
      v.text.visible = false;
      v.warning.visible = [
        'cannonball',
        'scoop',
        'coin',
        'metal',
        'pitch',
        'ball',
      ].includes(o.kind);
      v.warning.position.set(o.x, 0.025, o.z);
      if (o.kind === 'cannonball')
        v.warning.scale.setScalar(
          0.65 + 0.35 * (1 - Math.min(1, o.life / 0.9)),
        );
      if (['skewer', 'bolt', 'paintshot'].includes(o.kind))
        v.group.rotation.y = Math.atan2(o.vx, o.vz);
      if (o.kind === 'melon') v.group.rotation.x = w.time * 4;
      if (o.kind === 'gecko') {
        v.group.rotation.y = Math.atan2(o.vx, o.vz);
        v.body.material = dynamic.mat(o.owner < 0 ? '#b0c6a6' : TEAM[o.owner]);
        v.text.visible = true;
        setText(
          v.text,
          o.owner < 0
            ? `${o.value} · NEUTRAL`
            : `${o.owner === 0 ? 'SUN' : 'MOON'} · ${o.value}`,
          o.owner < 0 ? '#edf1d8' : TEAM[o.owner],
        );
      }
      if (o.kind === 'letter' || o.kind === 'mailcart') {
        v.text.visible = true;
        setText(
          v.text,
          o.tag === 0 ? 'ANY' : o.tag === 1 ? 'SUN' : 'MOON',
          o.tag === 0 ? '#fff0cd' : TEAM[o.tag - 1],
        );
        v.text.position.y = o.kind === 'mailcart' ? 1.5 : 0.5;
      }
      if (o.kind === 'case') {
        v.text.visible = true;
        setText(v.text, String(o.tag + 1));
        v.group.rotation.y = (o.value * Math.PI) / 2;
        v.text.position.y = 0.8;
      }
      if (o.kind === 'snackraft') {
        v.text.visible = true;
        setText(v.text, String(o.value));
      }
      if (o.kind === 'pearl' && o.value > 1) {
        v.text.visible = true;
        setText(v.text, '3');
      }
      if (o.kind === 'hook') {
        const p = w.actors[o.owner];
        v.warning.visible = true;
        v.warning.position.set(o.x, 0.05, o.z);
        v.group.rotation.y = p.face;
      }
    }
    cloud.visible = kind === 'raingarden';
    rainRing.visible = kind === 'raingarden';
    rainDrops.forEach((drop, j) => {
      drop.visible = kind === 'raingarden';
      if (drop.visible) {
        const a = j * 2.4,
          r = ((j % 7) / 7) * 2.5;
        drop.position.set(
          g.windX + Math.cos(a) * r,
          4.5 - ((w.time * 5 + j * 0.3) % 4),
          g.windZ + Math.sin(a) * r,
        );
      }
    });
    if (cloud.visible) {
      cloud.position.set(g.windX, 5, g.windZ);
      rainRing.position.set(g.windX, 0.03, g.windZ);
    }
    monster.visible = kind === 'lanternlurk';
    flame.visible = kind === 'lanternlurk' && w.time - g.monster.at > 1.2;
    if (monster.visible) {
      monster.position.set(g.monster.x, 0, g.monster.z);
      monster.rotation.y = g.monster.face + Math.PI;
      flame.position.set(
        g.monster.x + Math.sin(g.monster.face) * 2.3,
        0.5,
        g.monster.z + Math.cos(g.monster.face) * 2.3,
      );
      flame.rotation.set(Math.PI / 2, 0, -g.monster.face);
      flame.material.opacity = w.time - g.monster.at > 1.95 ? 0.5 : 0.17;
    }
    reticle.visible = kind === 'skewergallery';
    if (reticle.visible)
      reticle.position.set(w.actors[g.solo].tx, 0.07, w.actors[g.solo].tz);
    beltLabels.forEach((v, j) => {
      v.visible = kind === 'returnsender';
      if (v.visible) {
        const dir = (g.data[j + 6] ?? 0) > w.time ? g.data[j] : j % 2 ? 1 : -1;
        setText(
          v,
          (g.data[j + 12] ?? 0) > w.time
            ? dir > 0
              ? 'LOCK →'
              : '← LOCK'
            : dir > 0
              ? '→ → →'
              : '← ← ←',
        );
        v.position.x = reduced ? 0 : Math.sin(w.time * 3) * 0.3;
      }
    });
    vehicles.forEach((v, team) => {
      v.visible = [
        'frostyfreight',
        'pelicanpilots',
        'paddleplunder',
        'rubblerunners',
      ].includes(kind);
      if (!v.visible) return;
      const data = g.vehicles[team],
        x = kind === 'paddleplunder' ? data.x : (team === 0 ? -8 : 8) + data.x,
        z = kind === 'paddleplunder' ? data.z : -data.distance;
      v.position.set(x, data.y - 0.05, z);
      v.rotation.y = kind === 'paddleplunder' ? data.face : Math.PI;
      for (const wing of v.children.filter((c) => c.name.startsWith('wing')))
        wing.rotation.z = reduced ? 0 : Math.sin(w.time * 9) * data.lift * 0.2;
      for (const paddle of v.children.filter((c) =>
        c.name.startsWith('paddle'),
      ))
        paddle.rotation.x = reduced ? 0 : Math.sin(w.time * 7) * 0.35;
    });
    puzzleViews.forEach((v, i) => {
      const s = g.seats[i],
        p = w.actors[i];
      v.group.visible = [
        'coconutcompass',
        'fossilfillet',
        'lostluggage',
        'doughdouble',
        'bentoblocks',
      ].includes(kind);
      if (!v.group.visible) return;
      v.cursor.position.set(p.x - lane(i), 0.3, p.z);
      v.cursor.visible = kind === 'coconutcompass' || kind === 'fossilfillet';
      v.markers.forEach((m) => (m.visible = false));
      v.targets.forEach((m) => (m.visible = false));
      v.texts.forEach((m) => (m.visible = false));
      v.trace.visible = kind === 'fossilfillet';
      if (kind === 'fossilfillet') {
        const outline = fossilOutline(w.seed);
        outline.forEach((point, j) => {
          const t = v.targets[j];
          t.visible = true;
          t.position.set(point.x, 0.08, point.z);
          t.material = dynamic.mat(s.coverage[j] ? COLORS[i] : '#557c77');
        });
        const positions = v.trace.geometry.getAttribute(
          'position',
        ) as T.BufferAttribute;
        s.trace.forEach((p, j) => positions.setXYZ(j, p.x, 0.14, p.z));
        positions.needsUpdate = true;
        v.trace.geometry.setDrawRange(0, s.trace.length);
        v.cursor.scale.setScalar(p.input.a && !p.input.b ? 1 : 0.6);
      }
      if (kind === 'lostluggage' && w.time < 5) {
        s.memory.forEach((tag, j) => {
          const m = v.markers[j],
            text = v.texts[j];
          m.visible = true;
          m.position.set(
            ((j % 3) - 1) * 1.6,
            0.4,
            -3 + Math.floor(j / 3) * 1.4,
          );
          m.material = dynamic.mat(TILE_COLORS[tag % 7]);
          m.rotation.y =
            (Math.floor(randomAt(w.seed, tag * 17 + 7) * 4) * Math.PI) / 2;
          text.visible = true;
          text.position.set(m.position.x, 1, m.position.z);
          setText(
            text,
            `${tag + 1} ${['↑', '→', '↓', '←'][Math.floor(randomAt(w.seed, tag * 17 + 7) * 4)]}`,
          );
        });
      }
      if (kind === 'doughdouble') {
        const target = doughTarget(w.seed);
        poseFace(v.face, s.handles);
        poseFace(v.targetFace, target);
        s.handles.forEach((h, j) => {
          const m = v.markers[j],
            t = v.targets[j],
            text = v.texts[j];
          m.visible = true;
          m.position.set(h.x, 0.25, h.z);
          m.scale.setScalar(j === s.selection ? 0.75 : 0.48);
          m.material = dynamic.mat(j === s.selection ? '#ed9b89' : COLORS[i]);
          t.visible = true;
          t.position.set(target[j].x, 0.3, target[j].z);
          text.visible = true;
          text.position.set(h.x, 0.8, h.z);
          setText(text, String(j + 1));
        });
      }
      if (kind === 'bentoblocks') {
        s.grid.forEach((value, j) => {
          if (!value) return;
          const m = v.markers[j];
          m.visible = true;
          m.position.set(
            ((j % 6) - 2.5) * 0.62,
            0.15,
            (Math.floor(j / 6) - 4.5) * 0.62,
          );
          m.material = dynamic.mat(TILE_COLORS[value - 1]);
          m.rotation.y = (value * Math.PI) / 4;
          m.scale.setScalar(value === 3 ? 0.8 : 1);
        });
        if (s.piece.length) {
          for (let j = 0; j < 2; j++) {
            const [x, y, a, b, r] = s.piece,
              col = x + (j ? (r === 1 ? 1 : r === 3 ? -1 : 0) : 0),
              row = y + (j ? (r === 0 ? -1 : r === 2 ? 1 : 0) : 0),
              m = v.markers[60 + j];
            m.visible = row >= 0;
            m.position.set((col - 2.5) * 0.62, 0.35, (row - 4.5) * 0.62);
            m.material = dynamic.mat(TILE_COLORS[(j ? b : a) - 1]);
          }
        }
      }
    });
    hotelDeck.visible = kind === 'hotelhiccup';
    if (hotelDeck.visible) hotelDeck.position.y = me.gear * 3 - 0.2;
    eventBeacon.visible =
      kind === 'tidetiles' ||
      kind === 'goalguava' ||
      kind === 'touchdowntiki' ||
      kind === 'crateescape';
    if (kind === 'tidetiles') {
      setText(eventBeacon, `SAFE: ${SYMBOLS[g.target]}`, TILE_COLORS[g.target]);
      eventBeacon.position.set(0, 4, -9);
    } else if (eventBeacon.visible) {
      setText(
        eventBeacon,
        `SOLO: ${players[g.solo].avatar.name}`,
        COLORS[g.solo],
      );
      eventBeacon.position.set(0, 4, -10);
    }
    const start = performance.now();
    renderer.render(scene, camera);
    perf.frame(now, now - lastNow, performance.now() - start);
    lastNow = now;
  }
  const ray = new T.Raycaster(),
    plane = new T.Plane(new T.Vector3(0, 1, 0), 0);
  return {
    draw,
    groundPoint(x: number, y: number) {
      const rect = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(
        new T.Vector2(
          ((x - rect.left) / rect.width) * 2 - 1,
          (-(y - rect.top) / rect.height) * 2 + 1,
        ),
        camera,
      );
      return ray.ray.intersectPlane(plane, new T.Vector3());
    },
    dispose() {
      observer.disconnect();
      perf.dispose();
      disposeObject(scene);
      for (const texture of textCache.values()) texture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
