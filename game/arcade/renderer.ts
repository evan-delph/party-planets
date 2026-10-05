import { createGrandRenderer } from './grand-renderer';
import { GRAND_IDS } from './grand-catalog';
import { createExpansionRenderer } from './expansion-renderer';
import { EXPANDED } from './expansion';
import { decorateArena } from './environments';
import { performanceMeter } from '../visuals';
import { animateAvatar, makeAvatar } from '../avatar';
import * as T from 'three';
import { Avatar } from '../config';
import { Arena, canopyHeight } from './simulation';
import { ArenaKind } from './catalog';
import { createRemixRenderer } from './remix-renderer';
import { remixInfo } from './remix-catalog';
import { planetStyle } from './planet-style';
import { OVERHAUL } from './overhaul';
import { createOverhaulRenderer } from './overhaul-renderer';
import { createSeaBumperRenderer } from './look/sea-bumper';
const TEAM_COLORS = ['#ffcf58', '#ff809a', '#65bdf5', '#a394ff'];
export function createRenderer(
  root: HTMLDivElement,
  players: { id: string; avatar: Avatar }[],
  kind: ArenaKind,
  low = false,
  boardId = 'crown',
) {
  if (OVERHAUL.includes(kind))
    return createOverhaulRenderer(root, players, kind, low);
  if (remixInfo(kind))
    return createRemixRenderer(root, players, kind, low, boardId);
  if (GRAND_IDS.includes(kind))
    return createGrandRenderer(root, players, kind, low);
  if (EXPANDED.includes(kind))
    return createExpansionRenderer(root, players, kind, low, boardId);
  // Bumper Buns has its own sea-arena presentation (look/sea-*.ts).
  if (kind === 'bumper')
    return createSeaBumperRenderer(root, players, low, boardId);
  const renderer = new T.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1 : 1.6));
  renderer.setClearColor('#70d9e4');
  renderer.shadowMap.enabled = !low && kind !== 'race';
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  root.appendChild(renderer.domElement);
  const perf = performanceMeter(renderer, root, kind);
  let lastPerf = performance.now();
  const scene = new T.Scene();
  const style = planetStyle(scene, renderer, boardId);
  scene.fog = new T.Fog('#70d9e4', 60, 150);
  const camera = new T.OrthographicCamera(-16, 16, 13, -13, 0.1, 220);
  const raceCameras = Array.from(
    { length: 4 },
    () => new T.PerspectiveCamera(60, 1, 0.1, 250),
  );
  camera.position.set(0, 19, 22);
  camera.lookAt(0, 0, 0);
  scene.add(new T.HemisphereLight('#fff8e1', '#4daaa1', 2.6));
  const sun = new T.DirectionalLight('#fff1cb', 3.5);
  sun.position.set(-10, 25, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(low ? 512 : 2048, low ? 512 : 2048);
  Object.assign(sun.shadow.camera, {
    left: -23,
    right: 23,
    top: 22,
    bottom: -22,
    near: 1,
    far: 80,
  });
  sun.shadow.bias = -0.001;
  scene.add(sun);
  const materialCache = new Map<string, T.MeshStandardMaterial>();
  const mat = (c: string) => {
    if (!materialCache.has(c))
      materialCache.set(
        c,
        new T.MeshStandardMaterial({ color: c, roughness: 0.6 }),
      );
    return materialCache.get(c)!;
  };
  function mesh(
    geometry: T.BufferGeometry,
    color: string,
    x = 0,
    y = 0,
    z = 0,
    parent: T.Object3D = scene,
  ) {
    const m = new T.Mesh(geometry, mat(color));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function box(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    c: string,
    parent: T.Object3D = scene,
  ) {
    return mesh(new T.BoxGeometry(w, h, d), c, x, y, z, parent);
  }
  function disc(x: number, z: number, r: number, color: string, y = 0.035) {
    const m = mesh(new T.CylinderGeometry(r, r, 0.05, 40), color, x, y, z);
    m.castShadow = false;
    return m;
  }
  function label(text: string, color = '#fff8dd', width = 3) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = color;
    ctx.font = '900 52px Trebuchet MS,Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#164953';
    ctx.shadowBlur = 6;
    ctx.fillText(text, 256, 66);
    const texture = new T.CanvasTexture(c);
    const s = new T.Sprite(
      new T.SpriteMaterial({ map: texture, depthTest: false }),
    );
    s.scale.set(width, width / 4, 1);
    s.renderOrder = 50;
    scene.add(s);
    return s;
  }
  const sea = new T.Mesh(
    new T.PlaneGeometry(250, 250, 64, 64),
    new T.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader:
        'uniform float time; varying vec3 pos; void main(){ pos=position; vec3 p=position; p.z+=sin(p.x*.4+time)*.045+cos(p.y*.6-time*.7)*.035; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.); }',
      fragmentShader:
        'uniform float time;varying vec3 pos;void main(){float w=sin(pos.x*.6+pos.y*.55+time)*sin(pos.x*.28-pos.y*.3-time*.6); vec3 c=mix(vec3(.09,.64,.73),vec3(.20,.79,.80),w*.5+.5);if(w>.92)c+=vec3(.1);gl_FragColor=vec4(c,1.);}',
    }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -0.78;
  scene.add(sea);
  function palm(x: number, z: number, scale = 1) {
    const g = new T.Group();
    g.position.set(x, -0.3, z);
    g.scale.setScalar(scale);
    scene.add(g);
    mesh(
      new T.CylinderGeometry(0.14, 0.24, 4, 9),
      '#a47648',
      0,
      1.8,
      0,
      g,
    ).rotation.z = 0.1;
    for (let i = 0; i < 7; i++) {
      const a = (i * Math.PI * 2) / 7;
      const leaf = mesh(
        new T.SphereGeometry(1, 10, 6),
        i % 2 ? '#279166' : '#48b774',
        Math.cos(a) * 0.8,
        3.8,
        Math.sin(a) * 0.8,
        g,
      );
      leaf.scale.set(0.36, 0.1, 1.5);
      leaf.rotation.y = -a + Math.PI / 2;
    }
    mesh(new T.SphereGeometry(0.25, 8, 8), '#855b39', 0, 3.6, 0, g);
  }
  let platform: T.Object3D | undefined,
    plate: T.Mesh | undefined,
    plateIndex = -1;
  const holeMarkers: T.Object3D[] = [],
    gates: T.Group[] = [],
    bridges: T.Mesh[] = [],
    boats: T.Group[] = [];
  const rope = new T.Group();
  scene.add(rope);
  rope.visible = kind === 'rope';
  if (kind === 'canopy') {
    box(0, -0.75, 0, 18, 0.4, 14, '#6849a4');
    box(0, -0.4, 0, 17.4, 0.5, 13.3, '#f8efd1');
    box(-8.8, 0.2, 0, 0.55, 2, 14, '#7652b5');
    for (let i = 0; i < 9; i++)
      box(0, -0.59 + i * 0.055, 6.67, 17.3, 0.012, 0.025, '#c8b999');
    // Printed lines and a central binding make the arena an open storybook.
    for (let i = 0; i < 12; i++) {
      const z = -5.1 + i * 0.88;
      box(-4.3, -0.08, z, 6, 0.012, 0.03, '#b4ad9a');
      box(4.3, -0.08, z, 6, 0.012, 0.03, '#b4ad9a');
    }
    box(0, -0.07, 0, 0.09, 0.016, 12.8, '#c6b691');
    for (let i = 0; i < 3; i++) {
      const h = new T.Group();
      scene.add(h);
      const ring = mesh(
        new T.TorusGeometry(1, 0.07, 8, 40),
        '#35caa5',
        0,
        0.06,
        0,
        h,
      );
      ring.rotation.x = Math.PI / 2;
      const d = new T.Mesh(
        new T.CircleGeometry(1, 40),
        new T.MeshBasicMaterial({
          color: '#70e3ba',
          transparent: true,
          opacity: 0.36,
          side: T.DoubleSide,
        }),
      );
      d.rotation.x = -Math.PI / 2;
      d.position.y = 0.027;
      h.add(d);
      holeMarkers.push(h);
    }
    label('THE GREAT PAPER ESCAPE', '#fff3cf', 6).position.set(0, 1, -7);
  } else if (kind === 'race') {
    box(0, -0.32, -54, 17, 0.6, 133, '#e7bd7f');
    box(0, -0.01, -54, 12.4, 0.14, 133, '#2d696b');
    for (const x of [-6, -3, 0, 3, 6])
      box(x, 0.08, -54, 0.065, 0.018, 130, '#fff2ca');
    for (let i = 0; i < 16; i++) {
      const z = 8 - i * 8;
      box(0, 0.09, z, 12, 0.018, 0.08, '#86b5ae');
      palm(-10, z, 1.1);
      palm(10, z, 1.1);
    }
    for (let i = 0; i < 12; i++)
      for (let j = 0; j < 2; j++)
        box(
          -5.5 + i,
          0.12,
          -111.6 + j * 0.5,
          1,
          0.025,
          0.5,
          (i + j) % 2 ? '#143f47' : '#fff7db',
        );
    box(-7, 3, -112, 0.3, 6, 0.3, '#fff0c2');
    box(7, 3, -112, 0.3, 6, 0.3, '#fff0c2');
    box(0, 6, -112, 14, 0.7, 0.3, '#f6c44b');
    label('FINISH', '#153e48', 4).position.set(0, 6, -111.7);
  } else if (kind === 'duos') {
    for (let team = 0; team < 2; team++) {
      const x = team === 0 ? -4 : 4,
        color = team === 0 ? '#ffd15b' : '#ab96f5';
      box(x, -0.4, 2, 6.1, 0.8, 11.2, '#e5be81');
      box(x, -0.35, -14, 6.1, 0.7, 7.2, '#e5be81');
      for (let k = 0; k < 10; k++)
        box(x, 0.025, 6.5 - k, 6, 0.04, 0.8, '#eacb96');
      const gate = new T.Group();
      gate.position.set(x, 0, 1.5);
      scene.add(gate);
      box(0, 2.5, 0, 6, 0.45, 0.45, color, gate);
      for (let j = -2; j <= 2; j++)
        box(j, 1.4, 0, 0.17, 2.5, 0.2, '#aa7348', gate);
      gates.push(gate);
      for (const dx of [-1.2, 1.2]) {
        const padColor = TEAM_COLORS[team * 2 + (dx > 0 ? 1 : 0)];
        disc(x + dx, 3.5, 0.8, padColor);
        disc(x + dx, -15, 0.8, padColor);
        box(x + dx, 0.6, -15, 0.12, 1.2, 0.12, '#ae7847');
        box(x + dx, 0.9, -15, 0.7, 0.09, 0.12, '#514c44');
      }
      bridges.push(box(x, -0.08, -7, 2.9, 0.24, 2.8, color));
      const boat = new T.Group();
      boat.position.set(x, -0.1, -19);
      scene.add(boat);
      mesh(new T.SphereGeometry(1, 14, 8), color, 0, 0, 0, boat).scale.set(
        1.5,
        0.35,
        2.3,
      );
      box(0, 1, 0, 0.08, 2.3, 0.08, '#c69857', boat);
      mesh(
        new T.ConeGeometry(1, 1.6, 3),
        '#fff5d2',
        0.1,
        1.4,
        0,
        boat,
      ).scale.z = 0.08;
      boats.push(boat);
      label(team === 0 ? 'TEAM SUN' : 'TEAM MOON', color, 3.2).position.set(
        x,
        0.9,
        7.4,
      );
      palm(x + (team === 0 ? -4 : 4), -13);
    }
    label('01 · GATE', '#fff7d1', 3).position.set(0, 3, 3);
    label('02 · CROSS', '#fff7d1', 3).position.set(0, 3, -7);
    label('03 · LAUNCH', '#fff7d1', 3).position.set(0, 3, -15);
  } else {
    const g = new T.Group();
    scene.add(g);
    platform = g;
    mesh(
      kind === 'coconut'
        ? new T.BoxGeometry(16, 0.75, 16)
        : new T.CylinderGeometry(8, 8.3, 0.75, 64),
      '#d5ae77',
      0,
      -0.4,
      0,
      g,
    );
    mesh(
      kind === 'coconut'
        ? new T.BoxGeometry(16, 0.07, 16)
        : new T.CylinderGeometry(7.96, 8, 0.07, 64),
      kind === 'coconut' ? '#e6cd97' : '#f8dfad',
      0,
      0.01,
      0,
      g,
    );
    const rim = mesh(
      new T.TorusGeometry(7.98, 0.1, 8, 96),
      '#fff3d0',
      0,
      0.1,
      0,
      g,
    );
    rim.rotation.x = Math.PI / 2;
    if (kind === 'coconut') rim.visible = false;
    if (kind === 'rope') {
      mesh(new T.CylinderGeometry(0.85, 1.05, 0.8, 16), '#344e54', 0, 0.38, 0);
      mesh(new T.SphereGeometry(0.5, 16, 12), '#ffb952', 0, 0.85, 0);
      box(0, 0.38, 0, 15, 0.14, 0.17, '#ff8d45', rope);
      for (const x of [-7.5, 7.5])
        mesh(new T.SphereGeometry(0.35, 12, 10), '#ffcc57', x, 0.4, 0, rope);
      for (let i = 0; i < 4; i++) {
        const a = ((i + 0.5) * Math.PI) / 2;
        disc(Math.cos(a) * 4.4, Math.sin(a) * 4.4, 0.9, TEAM_COLORS[i]);
      }
    }
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3;
      palm(Math.cos(a) * 12, Math.sin(a) * 12, 1.1);
      mesh(
        new T.CylinderGeometry(2.2, 2.6, 0.5, 20),
        '#e8ca91',
        Math.cos(a) * 12,
        -0.5,
        Math.sin(a) * 12,
      );
    }
  }
  decorateArena(scene, kind);
  if (kind === 'rope') {
    if (platform) platform.visible = false;
    sea.visible = false;
    renderer.setClearColor('#a78387');
    scene.fog = new T.Fog('#a78387', 60, 150);
  }
  if (kind === 'coconut') {
    sea.visible = false;
    renderer.setClearColor('#e4c6a0');
    scene.fog = new T.Fog('#e4c6a0', 60, 150);
  }
  const actorGroups = players.map((p, i) => {
    const group = new T.Group();
    scene.add(group);
    const avatar = makeAvatar(p.avatar);
    avatar.scale.multiplyScalar(kind === 'race' ? 0.64 : 0.82);
    avatar.position.y = kind === 'race' ? 0.62 : 0;
    group.add(avatar);
    // Bumper Buns tubs live in look/sea-bumper.ts.
    const ball = undefined as T.Mesh | undefined;
    if (kind === 'race') {
      box(0, 0.35, 0, 1.55, 0.5, 2.2, TEAM_COLORS[i], group);
      box(0, 0.64, -0.7, 1.4, 0.24, 0.6, '#fff0bf', group);
      for (const x of [-0.86, 0.86])
        for (const z of [-0.75, 0.75]) {
          const wheel = mesh(
            new T.CylinderGeometry(0.34, 0.34, 0.22, 14),
            '#234450',
            x,
            0.26,
            z,
            group,
          );
          wheel.rotation.z = Math.PI / 2;
        }
      box(0, 0.56, 1.15, 0.6, 0.3, 0.2, '#e8dfb3', group);
    }
    const shadow = new T.Mesh(
      new T.CircleGeometry(0.5, 24),
      new T.MeshBasicMaterial({
        color: '#345b59',
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    scene.add(shadow);
    const name = label(p.avatar.name, TEAM_COLORS[i], 2.7);
    const charge = mesh(
      new T.SphereGeometry(1, 18, 12),
      '#a5673f',
      0,
      1,
      1,
      group,
    );
    charge.visible = false;
    const you = label('▼ YOU', '#fff4a3', 1.7);
    you.visible = false;
    return { group, avatar, ball, shadow, name, charge, you };
  });
  const shots = new Map<number, T.Mesh>();
  function disposeTree(obj: T.Object3D) {
    obj.traverse((o) => {
      if (o instanceof T.Mesh || o instanceof T.Sprite) {
        if (o instanceof T.Mesh) o.geometry.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if ('map' in m) (m.map as T.Texture | null)?.dispose();
          m.dispose();
        }
      }
    });
  }
  let width = 1,
    height = 1;
  function resize() {
    width = root.clientWidth;
    height = root.clientHeight;
    renderer.setSize(width, height);
    const aspect = width / height;
    const h = kind === 'duos' ? 19 : kind === 'race' ? 16 : 13.5;
    const half = Math.max(h, 11.5 / aspect);
    camera.left = -half * aspect;
    camera.right = half * aspect;
    camera.top = half;
    camera.bottom = -half;
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(root);
  resize();
  function draw(w: Arena, localId: string, dt: number, reduced = false) {
    style.draw();
    (sea.material as T.ShaderMaterial).uniforms.time.value = w.time;
    if (platform) platform.scale.set(w.radius / 8, 1, w.radius / 8);
    if (kind === 'canopy') {
      if (plateIndex !== w.dropIndex) {
        plateIndex = w.dropIndex;
        if (plate) {
          scene.remove(plate);
          plate.geometry.dispose();
          (plate.material as T.Material).dispose();
        }
        const shape = new T.Shape();
        shape.moveTo(-8, -6);
        shape.lineTo(8, -6);
        shape.lineTo(8, 6);
        shape.lineTo(-8, 6);
        shape.closePath();
        for (const h of w.holes) {
          const hole = new T.Path();
          hole.absarc(h.x, h.z, h.r, 0, Math.PI * 2, true);
          shape.holes.push(hole);
        }
        const geo = new T.ExtrudeGeometry(shape, {
          depth: 0.035,
          bevelEnabled: false,
          curveSegments: 32,
        });
        plate = new T.Mesh(
          geo,
          new T.MeshStandardMaterial({
            color: '#fff9e7',
            roughness: 0.7,
            side: T.DoubleSide,
            transparent: true,
            opacity: 0.8,
          }),
        );
        plate.rotation.x = Math.PI / 2;
        plate.castShadow = true;
        scene.add(plate);
      }
      plate!.position.y = canopyHeight(w);
      (plate!.material as T.MeshStandardMaterial).opacity = 0.58;
      holeMarkers.forEach((m, i) => {
        const h = w.holes[i];
        m.visible = !!h;
        if (h) {
          m.position.set(h.x, 0, h.z);
          m.scale.set(h.r, 1, h.r);
        }
      });
    }
    rope.rotation.y = -w.angle;
    if (kind === 'duos') {
      for (let i = 0; i < 2; i++) {
        const center = i === 0 ? -4 : 4;
        gates[i].position.y = w.teams[i].stage > 0 ? 3.5 : 0;
        bridges[i].position.x = center + Math.sin(w.time * 1.15) * 1.8;
        if (w.teams[i].stage === 3)
          boats[i].position.z = -19 - (w.time - w.teams[i].finish) * 2.5;
      }
      camera.position.set(0, 28, 22);
      camera.lookAt(0, 0, -5);
    }
    if (kind === 'race') {
      const local = w.actors.find((p) => p.id === localId) ?? w.actors[0];
      const target = local.z;
      camera.position.set(0, 21, target + 21);
      camera.lookAt(0, 0, target - 7);
      sun.position.z = target + 14;
      sun.target.position.set(0, 0, target);
      scene.add(sun.target);
    }
    actorGroups.forEach((v, i) => {
      const p = w.actors[i];
      const target = new T.Vector3(p.x, p.y, p.z);
      v.group.position.lerp(target, Math.min(1, dt * 22));
      if (w.time < 0.04) v.group.position.copy(target);
      v.group.rotation.y = kind === 'race' ? Math.PI : p.face;
      v.avatar.rotation.z =
        !reduced && p.alive
          ? Math.sin(w.time * 17 + i) *
            Math.min(0.12, Math.hypot(p.vx, p.vz) * 0.022)
          : 0;
      v.avatar.rotation.x = kind === 'bumper' ? -0.08 : 0;
      animateAvatar(
        v.avatar,
        w.time,
        Math.hypot(p.vx, p.vz),
        !p.alive
          ? 'sad'
          : w.done
            ? p.score === Math.max(...w.actors.map((a) => a.score))
              ? 'happy'
              : 'sad'
            : p.flash > 0.5
              ? 'sad'
              : 'neutral',
        reduced,
      );
      v.group.visible = p.alive || w.time - p.outAt < 1.4;
      v.name.visible = false;
      v.name.position.set(
        p.x,
        p.y + (kind === 'bumper' ? 3.25 : kind === 'race' ? 2.8 : 2.5),
        p.z,
      );
      v.you.visible = p.id === localId && p.alive;
      v.you.position.set(p.x, p.y + (kind === 'bumper' ? 4 : 3.3), p.z);
      v.shadow.visible = p.alive;
      v.shadow.position.set(p.x, 0.065, p.z);
      v.shadow.scale.setScalar(1 - Math.min(0.6, p.y * 0.15));
      if (v.ball) {
        v.ball.rotation.x += p.vz * dt;
        v.ball.rotation.z -= p.vx * dt;
      }
      v.charge.visible = kind === 'coconut' && p.charge > 0.02;
      v.charge.scale.setScalar(0.2 + p.charge * 0.35);
      v.charge.position.z = 1 + p.charge * 0.15;
      v.charge.rotation.x = w.time * 3;
      if (p.flash > 0.1 && p.alive && kind !== 'race')
        v.avatar.visible = Math.floor(w.time * 18) % 2 === 0;
      else v.avatar.visible = true;
    });
    const activeShots = new Set(w.shots.map((s) => s.id));
    for (const [id, m] of shots)
      if (!activeShots.has(id)) {
        scene.remove(m);
        m.geometry.dispose();
        shots.delete(id);
      }
    for (const s of w.shots) {
      let m = shots.get(s.id);
      if (!m) {
        m = mesh(new T.SphereGeometry(1, 16, 12), '#9d613a');
        shots.set(s.id, m);
      }
      m.position.set(s.x, s.size + 0.1, s.z);
      m.scale.setScalar(s.size);
      m.rotation.x = w.time * 8;
    }
    const renderStart = performance.now();
    if (kind === 'race') {
      renderer.setScissorTest(true);
      w.actors.forEach((p, i) => {
        const col = i % 2,
          row = i < 2 ? 1 : 0;
        const x = Math.floor((width * col) / 2),
          y = Math.floor((height * row) / 2);
        const vw = Math.floor((width * (col + 1)) / 2) - x,
          vh = Math.floor((height * (row + 1)) / 2) - y;
        const chase = raceCameras[i];
        chase.aspect = vw / vh;
        chase.updateProjectionMatrix();
        chase.position.set(p.x, 3.9, p.z + 8.5);
        chase.lookAt(p.x, 0.8, p.z - 21);
        renderer.setViewport(x, y, vw, vh);
        renderer.setScissor(x, y, vw, vh);
        renderer.render(scene, chase);
      });
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, width, height);
    } else renderer.render(scene, camera);
    const pn = performance.now();
    perf.frame(pn, pn - lastPerf, pn - renderStart);
    lastPerf = pn;
  }
  const ray = new T.Raycaster(),
    plane = new T.Plane(new T.Vector3(0, 1, 0), 0);
  return {
    draw,
    groundPoint(clientX: number, clientY: number) {
      const rect = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(
        new T.Vector2(
          ((clientX - rect.left) / rect.width) * 2 - 1,
          (-(clientY - rect.top) / rect.height) * 2 + 1,
        ),
        camera,
      );
      return ray.ray.intersectPlane(plane, new T.Vector3());
    },
    dispose() {
      observer.disconnect();
      perf.dispose();
      disposeTree(scene);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
