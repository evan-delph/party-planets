import * as T from 'three';
import { Avatar } from '../config';
import { WorldKit, disposeObject, performanceMeter } from '../visuals';
import { planetStyle } from './planet-style';
import { makeAvatar, animateAvatar } from '../avatar';
import { Arena } from './simulation';
import { ArenaKind } from './catalog';
import { buildSkyScene } from './look/sky-scene';
const COLORS = ['#ffc856', '#f387a5', '#6abfed', '#ae91ef'];
const THEMES = {
  sky: { sky: '#99c5e5', floor: '#e9e4ce', water: '#abcfe9' },
  bomb: { sky: '#655478', floor: '#776275', water: '#dc7647' },
  paint: { sky: '#9cacb5', floor: '#6f9c83', water: '#467e79' },
  dig: { sky: '#ecc59e', floor: '#dab97a', water: '#bd865b' },
  skate: { sky: '#a4bcdd', floor: '#d8e8ed', water: '#669aba' },
  factory: { sky: '#333957', floor: '#6a748e', water: '#333957' },
};
export function createExpansionRenderer(
  root: HTMLDivElement,
  players: { id: string; avatar: Avatar }[],
  kind: ArenaKind,
  low = false,
  boardId = 'crown',
) {
  const theme = THEMES[kind as keyof typeof THEMES];
  const renderer = new T.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1 : 1.5));
  renderer.setClearColor(theme.sky);
  renderer.shadowMap.enabled = !low;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  root.appendChild(renderer.domElement);
  const perf = performanceMeter(renderer, root, kind);
  const scene = new T.Scene();
  const style = planetStyle(scene, renderer, boardId);
  scene.fog = new T.Fog(theme.sky, 60, 160);
  const camera = new T.OrthographicCamera(-17, 17, 14, -14, 0.1, 200);
  camera.position.set(0, 23, 23);
  camera.lookAt(0, 0, 0);
  // Skybridge Sprint uses a perspective chase camera instead of the board view.
  const skyCam =
    kind === 'sky' ? new T.PerspectiveCamera(48, 1, 0.1, 700) : null;
  const view: T.Camera = skyCam ?? camera;
  const hemi = new T.HemisphereLight('#fff9e3', theme.water, 2.7);
  scene.add(hemi);
  const sun = new T.DirectionalLight('#fff0d4', 3);
  sun.position.set(-10, 27, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, {
    left: -22,
    right: 22,
    top: 22,
    bottom: -22,
    near: 1,
    far: 75,
  });
  sun.shadow.bias = -0.002;
  scene.add(sun);
  scene.add(sun.target);
  const kit = new WorldKit(scene);
  const plane = kit.mesh(new T.PlaneGeometry(180, 180), theme.water, 0, -1, 0);
  plane.rotation.x = -Math.PI / 2;
  if (kind === 'sky') {
    plane.removeFromParent();
    plane.geometry.dispose();
  }
  let sky: ReturnType<typeof buildSkyScene> | null = null;
  const moving: T.Mesh[] = [],
    deco: T.Mesh[] = [];
  const textSprites: T.Sprite[] = [];
  function label(
    text: string,
    x: number,
    y: number,
    z: number,
    color = '#fff5d6',
    size = 3,
  ) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = 'rgba(22,46,65,.85)';
    ctx.beginPath();
    ctx.roundRect(6, 12, 500, 104, 24);
    ctx.fill();
    ctx.fillStyle = color;
    let fontSize = 58;
    ctx.font = `900 ${fontSize}px Trebuchet MS,Arial`;
    while (ctx.measureText(text).width > 470 && fontSize > 24) {
      fontSize -= 2;
      ctx.font = `900 ${fontSize}px Trebuchet MS,Arial`;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#244156';
    ctx.shadowBlur = 7;
    ctx.fillText(text, 256, 65);
    const s = new T.Sprite(
      new T.SpriteMaterial({
        map: new T.CanvasTexture(c),
        depthTest: false,
        toneMapped: false,
      }),
    );
    s.position.set(x, y, z);
    s.scale.set(size, size / 4, 1);
    s.renderOrder = 20;
    scene.add(s);
    textSprites.push(s);
    return s;
  }
  const dynamicMesh = (geo: T.BufferGeometry, color: string) => {
    const m = new T.Mesh(
      geo,
      new T.MeshStandardMaterial({ color, roughness: 0.6 }),
    );
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  };
  if (kind === 'sky') {
    sky = buildSkyScene({
      scene,
      renderer,
      camera: skyCam!,
      sun,
      hemi,
      low,
      names: players.map((p) => p.avatar.name),
    });
  } else if (kind === 'bomb') {
    kit.box(0, -0.4, 0, 16, 0.8, 16, '#504b62');
    for (let x = -7; x <= 7; x += 2)
      for (let z = -7; z <= 7; z += 2)
        kit.box(
          x,
          0.025,
          z,
          1.94,
          0.05,
          1.94,
          (x + z) % 4 ? '#847184' : '#74647a',
        );
    kit.box(0, 1.6, 0, 3, 3.2, 4.6, '#4a465d');
    kit.box(0, 3.5, 0, 3.8, 0.45, 5.2, '#a98372');
    kit.mesh(new T.CylinderGeometry(0.75, 1.1, 3, 12), '#6c5862', 0, 4, 0);
    kit.mesh(
      new T.CylinderGeometry(0.66, 0.66, 0.08, 12),
      '#ffb566',
      0,
      5.53,
      0,
    );
    for (const x of [-5, 5]) {
      kit.mesh(
        new T.CylinderGeometry(0.95, 1.1, 0.18, 16),
        '#51495a',
        x,
        0.08,
        0,
      );
      for (let i = 0; i < 6; i++) {
        const m = dynamicMesh(new T.SphereGeometry(0.26, 8, 6), '#d9ccd0');
        m.position.set(x, 0, 0);
        deco.push(m);
      }
    }
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      kit.rock(Math.sin(a) * 12, Math.cos(a) * 12, 2, '#735865');
      kit.mesh(
        new T.ConeGeometry(0.4, 1.3, 6),
        '#f5a55e',
        Math.sin(a) * 11,
        -0.4,
        Math.cos(a) * 11,
      );
    }
    label('PASS IT BEFORE IT POPS', 0, 5, -8.8, '#ffe0a0', 7);
  } else if (kind === 'paint') {
    kit.box(0, -0.25, 0, 16, 0.5, 16, '#637e69');
    kit.mesh(
      new T.CylinderGeometry(1.5, 1.65, 0.12, 32),
      '#79c3b7',
      0,
      0.02,
      0,
    );
    for (let i = 0; i < 8; i++) {
      const a = i * 0.785;
      kit.mesh(
        new T.SphereGeometry(0.18, 7, 5),
        '#f6a8bc',
        Math.sin(a),
        0.15,
        Math.cos(a),
      );
    }
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8,
        x = Math.sin(a) * 11,
        z = Math.cos(a) * 11;
      kit.tree(x, z, i % 3 ? 'mushroom' : 'jungle', 0.8 + (i % 3) * 0.3);
      kit.rock(x * 0.9, z * 0.9, 0.55, '#a1af8b');
    }
    kit.arch(0, -10, '#9caa86');
    label('MAKE YOUR MARK', 0, 4, -10, '#e8f4b1', 6);
  } else if (kind === 'dig') {
    kit.box(0, -0.3, 0, 20, 0.5, 17, '#ad8158');
    for (const x of [-10, 10]) kit.box(x, 0.4, 0, 0.5, 1.2, 17, '#ddbc84');
    for (const z of [-8.5, 8.5]) kit.box(0, 0.4, z, 20, 1.2, 0.5, '#ddbc84');
    kit.arch(-5, -11, '#c6a272');
    for (let i = 0; i < 5; i++)
      kit.mesh(
        new T.CylinderGeometry(0.55, 0.65, 3 + (i % 2), 8),
        '#cdb280',
        5 + i * 1.6,
        0.9,
        -11,
      );
    kit.mesh(new T.ConeGeometry(5, 5, 4), '#d7b07b', -14, 1.2, -12).rotation.y =
      Math.PI / 4;
    kit.mesh(new T.ConeGeometry(3, 3.8, 4), '#c49b6e', 15, 1, -11).rotation.y =
      Math.PI / 4;
    for (let i = 0; i < 12; i++) {
      const x = Math.sin(i * 2) * 14,
        z = Math.cos(i * 2) * 12;
      if (Math.abs(x) > 11 || Math.abs(z) > 10) kit.rock(x, z, 0.8, '#d4b184');
    }
    label('THE SUNKEN QUARRY', 0, 4, -10, '#fff1c0', 7);
  } else if (kind === 'skate') {
    kit.mesh(
      new T.CylinderGeometry(11.3, 11.7, 0.6, 64),
      '#e3edf0',
      0,
      -0.32,
      0,
    ).scale.z = 0.72;
    const ice = kit.mesh(
      new T.RingGeometry(6.3, 10.5, 72),
      '#88cbd8',
      0,
      0.015,
      0,
    );
    ice.rotation.x = -Math.PI / 2;
    ice.scale.y = 0.72;
    kit.mesh(
      new T.CylinderGeometry(6.25, 6.5, 0.2, 50),
      '#e5edf0',
      0,
      0.05,
      0,
    ).scale.z = 0.72;
    for (let i = 0; i < 6; i++) {
      const a = i;
      kit.mesh(
        new T.ConeGeometry(1.4, 3.5 + (i % 3), 6),
        '#addce9',
        Math.sin(a) * 3,
        1.4,
        Math.cos(a) * 2,
      );
    }
    for (let i = 0; i < 18; i++) {
      const a = (i * Math.PI) / 9;
      kit.tree(Math.cos(a) * 13, Math.sin(a) * 9.5, 'pine', 0.8);
      kit.box(
        Math.cos(a) * 10.9,
        1,
        Math.sin(a) * 7.85,
        0.08,
        2,
        0.08,
        '#718aa5',
      );
      kit.mesh(
        new T.SphereGeometry(0.2, 7, 5),
        '#ffe8a0',
        Math.cos(a) * 10.9,
        2,
        Math.sin(a) * 7.85,
      );
    }
    for (let i = 0; i < 8; i++)
      kit.box(
        6.5 + i * 0.5,
        0.04,
        0,
        0.45,
        0.06,
        0.65,
        i % 2 ? '#3b6688' : '#fff8db',
      );
    label('4 LAPS · KEEP YOUR SPEED', 0, 5, -10, '#edf9dc', 7);
    for (let i = 0; i < 4; i++) {
      const m = dynamicMesh(
        new T.TorusGeometry(15 + i * 1.3, 0.2, 6, 44, Math.PI),
        '#adc8ed',
      );
      m.rotation.x = 0.35;
      m.position.set(-4 + i, 6 + i * 0.9, -16);
      deco.push(m);
    }
  } else if (kind === 'factory') {
    kit.box(0, -0.35, 0, 20, 0.7, 17, '#69758b');
    for (let team = 0; team < 2; team++) {
      const x = team === 0 ? -5 : 5,
        c = team === 0 ? '#e3be68' : '#a28fd1';
      kit.box(x, -0.01, 0, 8.7, 0.1, 15, team === 0 ? '#a8afb2' : '#8e9dae');
      kit.box(x, 0.13, 0, 1.8, 0.3, 13, '#354b65');
      for (let j = 0; j < 20; j++)
        kit.box(x, 0.3, -6 + j * 0.64, 1.75, 0.05, 0.08, '#8394a3');
      for (const role of [0, 1]) {
        const sx = x + (role ? 2.8 : -2.8),
          sz = role ? 0 : -4;
        kit.box(sx, 0.25, sz, 1.4, 0.5, 1.4, c);
        kit
          .mesh(
            new T.SphereGeometry(0.4, 12, 6),
            role ? '#e67e5d' : '#eed29c',
            sx,
            0.72,
            sz,
          )
          .scale.set(1, 0.5, role ? 1 : 1.4);
        label(role ? 'FILLING' : 'BUNS', sx, 2, sz, '#fff7d5', 2.7);
      }
      kit.arch(x, 7, c);
      label('DELIVER', x, 4.5, 7, c, 3);
      kit.box(x, 2, -8, 6, 4, 0.5, '#38475f');
      kit.box(x, 2.2, -7.7, 4, 1.9, 0.05, '#6c8aa2');
    }
    for (let i = 0; i < 40; i++) {
      const a = i * 2.4;
      kit.mesh(
        new T.SphereGeometry(0.09, 5, 4),
        '#efe5c3',
        Math.sin(a) * 30,
        5 + (i % 7) * 1.7,
        -16 - Math.cos(a) * 5,
      );
    }
    kit.mesh(new T.SphereGeometry(4, 20, 12), '#b6a3cd', -14, 7, -20);
    const ring = kit.mesh(
      new T.TorusGeometry(6, 0.28, 6, 40),
      '#dcc1b1',
      -14,
      7,
      -20,
    );
    ring.rotation.x = 1.1;
    label('ORBITAL DINER', 0, 6, -8, '#fff4cf', 6);
  }
  kit.bake();
  const avatars = players.map((p, i) => {
    const g = makeAvatar(p.avatar);
    g.scale.multiplyScalar(0.82);
    scene.add(g);
    const name = label(p.avatar.name, 0, 0, 0, COLORS[i], 3.1);
    const you = label('▼ YOU', 0, 0, 0, '#fff3ad', 2.5);
    const carry = dynamicMesh(
      new T.SphereGeometry(0.3, 12, 8),
      i % 2 ? '#e98b6a' : '#ecd09d',
    );
    return { g, name, you, carry };
  });
  const bomb = dynamicMesh(new T.SphereGeometry(0.43, 14, 10), '#4a324b');
  const fuse = dynamicMesh(new T.SphereGeometry(0.12, 8, 6), '#ffd164');
  bomb.visible = false;
  fuse.visible = false;
  let cells: T.InstancedMesh | undefined;
  const trayMeshes = new Map<number, T.Group>();
  const flash = dynamicMesh(new T.SphereGeometry(1, 14, 10), '#ffce7f');
  flash.visible = false;
  const dummy = new T.Object3D(),
    color = new T.Color();
  let width = 1,
    height = 1,
    lastNow = performance.now();
  function resize() {
    width = root.clientWidth;
    height = root.clientHeight;
    renderer.setSize(width, height);
    const a = width / height,
      half = Math.max(
        kind === 'factory' ? 15 : kind === 'dig' ? 14 : 13,
        12 / a,
      );
    camera.left = -half * a;
    camera.right = half * a;
    camera.top = half;
    camera.bottom = -half;
    // Keep the playable floor beneath the score and instruction overlays in narrow panes.
    if (width < 850)
      camera.setViewOffset(width, height, 0, -height * 0.13, width, height);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    if (skyCam) {
      skyCam.aspect = a;
      // Narrow panes need a wider lens to keep the next islands in view.
      skyCam.fov = a < 1 ? 62 : 48;
      skyCam.updateProjectionMatrix();
      sky?.resize(height);
    }
  }
  const observer = new ResizeObserver(resize);
  observer.observe(root);
  resize();
  function draw(w: Arena, localId: string, dt: number, reduced = false) {
    style.draw();
    const now = performance.now(),
      extra = w.extra!;
    if (sky) sky.update(w, localId, dt, reduced);
    else if (kind === 'skate')
      deco.forEach((m, i) => {
        m.rotation.z = Math.sin(w.time * 0.2 + i) * 0.05;
      });
    else if (kind === 'bomb')
      deco.forEach((m, i) => {
        m.visible = w.time % 7 < 1.4;
        m.position.y = (w.time * 2 + i * 0.22) % 2;
        m.scale.setScalar(0.6 + m.position.y * 0.5);
      });
    if ((kind === 'paint' || kind === 'dig') && !cells) {
      cells = new T.InstancedMesh(
        new T.BoxGeometry(1.44, 1, 1.44),
        new T.MeshStandardMaterial({ roughness: 0.85 }),
        extra.cells.length,
      );
      cells.receiveShadow = true;
      cells.castShadow = kind === 'dig';
      scene.add(cells);
    }
    if (cells) {
      extra.cells.forEach((c, i) => {
        dummy.position.set(
          c.x,
          kind === 'dig' ? (c.depth ? 0.4 : -0.055) : 0.045,
          c.z,
        );
        dummy.scale.set(1, kind === 'dig' ? (c.depth ? 0.85 : 0.05) : 0.07, 1);
        if (kind === 'paint' && Math.hypot(c.x, c.z) < 1.6)
          dummy.scale.y = 0.001;
        dummy.updateMatrix();
        cells!.setMatrixAt(i, dummy.matrix);
        const shade =
          kind === 'paint'
            ? c.owner < 0
              ? '#a4bc8e'
              : COLORS[c.owner]
            : c.depth === 2
              ? '#9f8175'
              : c.depth === 1
                ? '#d4ab76'
                : c.prize > 0
                  ? '#efcf68'
                  : '#9a7958';
        color.set(shade);
        cells!.setColorAt(i, color);
      });
      cells.instanceMatrix.needsUpdate = true;
      if (cells.instanceColor) cells.instanceColor.needsUpdate = true;
    }
    avatars.forEach((v, i) => {
      const p = w.actors[i];
      v.g.position.lerp(new T.Vector3(p.x, p.y, p.z), Math.min(1, dt * 25));
      // Snap on start, and in the sky race whenever the racer is far from its
      // drawn spot (joining mid-race, respawns) so it never lingers off-camera.
      if (
        w.time < 0.05 ||
        (sky && v.g.position.distanceToSquared(new T.Vector3(p.x, p.y, p.z)) > 36)
      )
        v.g.position.set(p.x, p.y, p.z);
      v.g.rotation.y = p.face;
      v.g.visible = p.alive;
      const mood = !p.alive
        ? 'sad'
        : w.done
          ? p.score === Math.max(...w.actors.map((p) => p.score))
            ? 'happy'
            : 'sad'
          : p.flash > 0.25
            ? kind === 'sky'
              ? 'sad'
              : 'happy'
            : 'neutral';
      animateAvatar(
        v.g,
        w.time,
        kind === 'skate' ? p.charge : Math.hypot(p.vx, p.vz),
        mood,
        reduced,
      );
      if (kind === 'paint' && p.charge > 0)
        v.g.scale.y = players[i].avatar.height * 0.82 * (1 - p.charge * 0.14);
      else v.g.scale.y = players[i].avatar.height * 0.82;
      v.name.position.set(p.x, p.y + 2.6, p.z);
      v.name.visible = false;
      v.you.position.set(p.x, p.y + 3.25, p.z);
      v.you.visible = p.alive && p.id === localId && !sky;
      v.carry.visible = kind === 'factory' && p.gear > 0;
      if (v.carry.visible) {
        v.carry.position.set(
          p.x + Math.sin(p.face) * 0.7,
          1,
          p.z + Math.cos(p.face) * 0.7,
        );
        (v.carry.material as T.MeshStandardMaterial).color.set(
          p.gear === 1 ? '#edcd93' : '#e67e5e',
        );
      }
    });
    if (kind === 'bomb') {
      const p = w.actors[extra.holder];
      bomb.visible = p.alive;
      fuse.visible = p.alive;
      bomb.position.set(p.x, p.y + 2.1, p.z);
      bomb.scale.setScalar(
        1 + Math.sin(w.time * (extra.fuse - w.time < 3 ? 18 : 6)) * 0.1,
      );
      fuse.position.copy(bomb.position).add(new T.Vector3(0.15, 0.5, 0));
      flash.visible = w.pulse > 0.3;
      if (flash.visible) {
        flash.position.set(
          extra.explosionAt?.x ?? p.x,
          1,
          extra.explosionAt?.z ?? p.z,
        );
        flash.scale.setScalar((1 - w.pulse) * 5 + 0.3);
      }
    }
    if (kind === 'factory') {
      const ids = new Set(extra.trays.map((t) => t.id));
      for (const [id, g] of trayMeshes)
        if (!ids.has(id)) {
          scene.remove(g);
          disposeObject(g);
          trayMeshes.delete(id);
        }
      for (const t of extra.trays) {
        let g = trayMeshes.get(t.id);
        if (!g) {
          g = new T.Group();
          scene.add(g);
          g.add(
            new T.Mesh(
              new T.BoxGeometry(1.4, 0.12, 1.3),
              new T.MeshStandardMaterial({ color: '#edf0e4' }),
            ),
          );
          const bun = new T.Mesh(
            new T.SphereGeometry(0.4, 12, 6),
            new T.MeshStandardMaterial({ color: '#e9c789' }),
          );
          bun.position.y = 0.2;
          bun.scale.set(1, 0.4, 1.3);
          g.add(bun);
          const filling = new T.Mesh(
            new T.CapsuleGeometry(0.14, 0.45, 5, 9),
            new T.MeshStandardMaterial({ color: '#dc8161' }),
          );
          filling.position.y = 0.35;
          filling.rotation.x = Math.PI / 2;
          g.add(filling);
          trayMeshes.set(t.id, g);
        }
        g.position.set(t.x, 0.39, t.z);
        g.children[1].visible = t.stage >= 1;
        g.children[2].visible = t.stage >= 2;
        (
          g.children[0] as T.Mesh<T.BoxGeometry, T.MeshStandardMaterial>
        ).material.color.set(t.stage < 0 ? '#cd6c77' : '#edf0e4');
      }
    }
    const renderStart = performance.now();
    renderer.render(scene, view);
    perf.frame(now, now - lastNow, performance.now() - renderStart);
    lastNow = now;
  }
  const ray = new T.Raycaster(),
    planeY = new T.Plane(new T.Vector3(0, 1, 0), 0);
  return {
    draw,
    groundPoint(x: number, y: number) {
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(
        new T.Vector2(
          ((x - r.left) / r.width) * 2 - 1,
          (-(y - r.top) / r.height) * 2 + 1,
        ),
        view,
      );
      return ray.ray.intersectPlane(planeY, new T.Vector3());
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
