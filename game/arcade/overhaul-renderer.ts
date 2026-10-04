import * as T from 'three';
import { WorldKit, disposeObject, performanceMeter } from '../visuals';
import { makeAvatar, animateAvatar } from '../avatar';
import type { Avatar } from '../config';
import type { Arena } from './simulation';
import type { ArenaKind } from './catalog';
import { stageLighting } from './planet-style';
import {
  riverCenter,
  riverHazards,
  dragonPhase,
  RIVER_LENGTH,
  puzzleSlot,
  bombBounds,
} from './overhaul';

const COLORS = ['#ffd26b', '#ff82a1', '#79ceff', '#c3a0ff'];
export function createOverhaulRenderer(
  root: HTMLDivElement,
  players: { id: string; avatar: Avatar }[],
  kind: ArenaKind,
  low = false,
) {
  const renderer = new T.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1 : 1.5));
  renderer.setClearColor(kind === 'duos' ? '#263b49' : '#8ecfe7');
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  root.appendChild(renderer.domElement);
  const scene = new T.Scene(),
    kit = new WorldKit(scene),
    camera = new T.PerspectiveCamera(48, 1, 0.1, 700);
  stageLighting(scene, renderer, 'crown', false);
  scene.add(new T.HemisphereLight('#fff7e6', '#416a86', 3));
  const sun = new T.DirectionalLight('#fff0cf', 3);
  sun.position.set(-8, 24, 8);
  scene.add(sun);
  const perf = performanceMeter(renderer, root, kind);
  let lastPerf = performance.now(),
    width = 1,
    height = 1,
    localIndex = 0,
    disposed = false;
  const avatars = players.map((p) => {
    const avatar = makeAvatar(p.avatar);
    avatar.scale.setScalar(0.78);
    scene.add(avatar);
    return avatar;
  });
  const boats: T.Group[] = [],
    paddles: T.Group[][] = [],
    flames: { mesh: T.Mesh; index: number }[] = [];
  const bombs = new Map<number, T.Group>(),
    blasts: T.Mesh[] = [];
  const bombFence = new T.Group();
  scene.add(bombFence);
  const puzzlePieces: T.Group[] = [],
    puzzleLocks: T.Mesh[] = [],
    puzzleCursor = new T.Group();
  let puzzlePreview: T.Mesh | undefined, atlas: T.CanvasTexture | undefined;
  const image = new Image();
  const jumpMarks: T.Object3D[] = [];
  if (kind === 'bomb') {
    const fk = new WorldKit(bombFence);
    for (const side of [-1, 1]) {
      fk.box(side, 0.35, 0, 0.035, 0.7, 2, '#ff795c');
      fk.box(0, 0.35, side, 2, 0.7, 0.035, '#ff795c');
    }
    fk.bake();
    kit.box(0, -0.5, 0, 20, 0.8, 16, '#657aaf');
    kit.box(0, -0.045, 0, 18, 0.12, 14, '#dee8f5');
    for (let i = 0; i < 9; i++)
      kit.box((i - 4) * 2, 0.025, 0, 0.03, 0.018, 14, '#97accd');
    for (let i = 0; i < 7; i++)
      kit.box(0, 0.025, (i - 3) * 2, 18, 0.018, 0.03, '#97accd');
    for (const x of [-9.3, 9.3])
      for (let z = -7; z <= 7; z += 2)
        kit.box(x, 0.55, z, 0.3, 1.2, 0.35, '#7b54ac');
    for (let i = 0; i < 15; i++) {
      const m = new T.Mesh(
        new T.SphereGeometry(1, 20, 12),
        new T.MeshBasicMaterial({
          color: '#ffad32',
          transparent: true,
          opacity: 0.45,
          depthWrite: false,
        }),
      );
      m.visible = false;
      scene.add(m);
      blasts.push(m);
    }
  } else if (kind === 'duos') {
    scene.fog = new T.Fog('#263b49', 48, 125);
    for (let team = 0; team < 2; team++) {
      const offset = team ? 11 : -11,
        color = team ? '#a2b8ff' : '#ffd26b';
      const river = new T.PlaneGeometry(10, RIVER_LENGTH + 35, 12, 130),
        pos = river.getAttribute('position');
      for (let j = 0; j < pos.count; j++) {
        const d = pos.getY(j) + (RIVER_LENGTH + 35) / 2 - 12;
        pos.setXYZ(j, pos.getX(j) + offset + riverCenter(d), -0.12, -d);
      }
      river.computeVertexNormals();
      const water = new T.Mesh(
        river,
        new T.MeshStandardMaterial({
          color: '#2bb9ba',
          roughness: 0.25,
          metalness: 0.2,
          side: T.DoubleSide,
        }),
      );
      scene.add(water);
      for (let d = -8; d < RIVER_LENGTH + 20; d += 5) {
        for (const side of [-1, 1]) {
          const rock = kit.mesh(
            new T.IcosahedronGeometry(1, 1),
            '#657477',
            offset + riverCenter(d) + side * 6.2,
            2,
            -d,
          );
          rock.scale.set(1.8, 3 + (d % 3) * 0.1, 3.5);
          kit.mesh(
            new T.ConeGeometry(0.42, 2.5, 5),
            '#96a391',
            offset + riverCenter(d) + side * 4.7,
            5.6,
            -d,
          ).rotation.z = Math.PI;
        }
        const roof = kit.mesh(
          new T.TorusGeometry(6.1, 0.55, 6, 20, Math.PI),
          '#485a64',
          offset + riverCenter(d),
          3.2,
          -d,
        );
        roof.scale.y = 0.62;
      }
      riverHazards.forEach((h, index) => {
        const x = offset + riverCenter(h.d);
        if (h.rock) {
          const rock = kit.mesh(
            new T.IcosahedronGeometry(1, 1),
            '#839489',
            x + h.side * 1.5,
            0.6,
            -h.d,
          );
          rock.scale.set(1.25, 1.5, 1.3);
          return;
        }
        const dragon = new T.Group();
        dragon.position.set(x + h.side * 5.5, 1.3, -h.d);
        dragon.rotation.y = h.side < 0 ? Math.PI / 2 : -Math.PI / 2;
        kit.root.add(dragon);
        kit
          .mesh(new T.IcosahedronGeometry(1, 1), '#a0a798', 0, 0, 0, dragon)
          .scale.set(1, 1.1, 1.4);
        kit.box(0, -0.25, 1, 1.25, 0.48, 1.7, '#8b9387', dragon);
        kit.box(0, 0.05, 1.35, 0.9, 0.15, 1.2, '#172c36', dragon);
        for (const side of [-1, 1]) {
          kit.mesh(
            new T.ConeGeometry(0.25, 0.9, 5),
            '#d1c3a1',
            side * 0.7,
            1,
            0,
            dragon,
          );
          kit.mesh(
            new T.SphereGeometry(0.13, 10, 8),
            '#ffb844',
            side * 0.67,
            0.35,
            0.74,
            dragon,
          );
        }
        const fire = new T.Mesh(
          new T.ConeGeometry(0.85, 6.5, 9),
          new T.MeshBasicMaterial({
            color: '#ff873e',
            transparent: true,
            opacity: 0.75,
            depthWrite: false,
          }),
        );
        fire.rotation.z = h.side < 0 ? -Math.PI / 2 : Math.PI / 2;
        fire.position.set(x + h.side * 1.5, 0.75, -h.d);
        scene.add(fire);
        flames.push({ mesh: fire, index });
      });
      const exitX = offset + riverCenter(RIVER_LENGTH);
      kit.arch(exitX, -RIVER_LENGTH, '#f2dfa4');
      kit.box(exitX, 0, -RIVER_LENGTH - 12, 12, 0.5, 20, '#eadfbc');
      const boat = new T.Group();
      scene.add(boat);
      boats.push(boat);
      const bk = new WorldKit(boat);
      bk.mesh(new T.SphereGeometry(1, 24, 12), color, 0, 0.18, 0).scale.set(
        1.2,
        0.42,
        2.5,
      );
      bk.mesh(new T.SphereGeometry(1, 20, 10), '#30444f', 0, 0.37, 0).scale.set(
        0.82,
        0.15,
        1.7,
      );
      const ps: T.Group[] = [];
      for (const side of [-1, 1]) {
        const paddle = new T.Group();
        paddle.position.set(side * 0.8, 0.9, 0);
        boat.add(paddle);
        const pk = new WorldKit(paddle);
        pk.box(0, 0, 0, 0.08, 0.08, 2.8, '#e7cf91');
        pk.box(0, 0, -1.5, 0.48, 0.09, 0.72, color);
        ps.push(paddle);
      }
      paddles.push(ps);
    }
  } else if (kind === 'dig') {
    avatars.forEach((a) => (a.visible = false));
    kit.box(0, -0.5, 0.65, 10.5, 0.7, 10, '#c79166');
    kit.box(0, -0.08, -1.3, 6.7, 0.12, 3.5, '#233f63');
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    const drawImage = () => {
      const grad = ctx.createLinearGradient(0, 0, 1024, 512);
      grad.addColorStop(0, '#172d73');
      grad.addColorStop(0.5, '#586ec8');
      grad.addColorStop(1, '#0a9b9d');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1024, 512);
      ctx.strokeStyle = '#b3f5ed';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(0, 450);
      ctx.bezierCurveTo(300, 100, 650, 600, 1024, 70);
      ctx.stroke();
      ctx.fillStyle = '#fff1b2';
      for (let i = 0; i < 35; i++) {
        ctx.beginPath();
        ctx.arc((i * 157) % 1024, (i * 83) % 512, 2 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
      if (image.complete && image.naturalWidth)
        ctx.drawImage(image, 286, 6, 500, 500);
      if (atlas) atlas.needsUpdate = true;
    };
    drawImage();
    atlas = new T.CanvasTexture(canvas);
    atlas.colorSpace = T.SRGBColorSpace;
    image.onload = () => {
      if (!disposed) drawImage();
    };
    image.src = '/ufo-sticker.webp';
    puzzlePreview = new T.Mesh(
      new T.PlaneGeometry(6.4, 3.2),
      new T.MeshBasicMaterial({ map: atlas }),
    );
    puzzlePreview.rotation.x = -Math.PI / 2;
    puzzlePreview.position.set(0, 0.1, -1.3);
    scene.add(puzzlePreview);
    for (let id = 0; id < 8; id++) {
      const col = id % 4,
        row = Math.floor(id / 4),
        shape = new T.Shape();
      // Matching little tabs create eight true interlocking picture pieces.
      shape.moveTo(-0.8, -0.8);
      shape.lineTo(-0.24, -0.8);
      if (row === 0) shape.bezierCurveTo(-0.23, -1.12, 0.23, -1.12, 0.24, -0.8);
      shape.lineTo(0.8, -0.8);
      shape.lineTo(0.8, -0.24);
      if (col < 3) shape.bezierCurveTo(1.12, -0.23, 1.12, 0.23, 0.8, 0.24);
      shape.lineTo(0.8, 0.8);
      shape.lineTo(0.24, 0.8);
      if (row === 1) shape.bezierCurveTo(0.23, 0.48, -0.23, 0.48, -0.24, 0.8);
      shape.lineTo(-0.8, 0.8);
      shape.lineTo(-0.8, 0.24);
      if (col > 0) shape.bezierCurveTo(-0.48, 0.23, -0.48, -0.23, -0.8, -0.24);
      shape.closePath();
      const geo = new T.ShapeGeometry(shape, 12),
        pos = geo.getAttribute('position'),
        uv = geo.getAttribute('uv');
      for (let j = 0; j < pos.count; j++)
        uv.setXY(
          j,
          (col * 1.6 + pos.getX(j) + 0.8) / 6.4,
          1 - (row * 1.6 + 0.8 - pos.getY(j)) / 3.2,
        );
      const group = new T.Group(),
        face = new T.Mesh(
          geo,
          new T.MeshBasicMaterial({ map: atlas, side: T.DoubleSide }),
        );
      face.rotation.x = -Math.PI / 2;
      group.add(face);
      scene.add(group);
      puzzlePieces.push(group);
      const slot = puzzleSlot(id),
        lock = new T.Mesh(
          new T.PlaneGeometry(1.57, 1.57),
          new T.MeshBasicMaterial({
            color: '#77edbd',
            transparent: true,
            opacity: 0.12,
            side: T.DoubleSide,
          }),
        );
      lock.rotation.x = -Math.PI / 2;
      lock.position.set(slot.x, 0.06, slot.z);
      scene.add(lock);
      puzzleLocks.push(lock);
    }
    const ck = new WorldKit(puzzleCursor);
    ck.mesh(
      new T.TorusGeometry(0.23, 0.055, 8, 24),
      '#ffffff',
      0,
      0,
      0,
    ).rotation.x = -Math.PI / 2;
    scene.add(puzzleCursor);
  } else {
    kit.box(0, -0.5, -16, 21, 0.8, 70, '#74b788');
    for (let i = 0; i < 4; i++) {
      const x = (i - 1.5) * 4;
      kit.box(x, -0.04, 6, 3.3, 0.1, 15, '#b77776');
      kit.box(x, -0.04, -18, 3.3, 0.1, 34, '#ead4a1');
      kit.box(x, 0.025, 1, 3.3, 0.025, 0.25, '#ffffff');
      for (let n = 0; n < 16; n++)
        kit.box(x, 0.02, -n * 2, 3.1, 0.02, 0.035, '#ab895a');
      const marker = new T.Mesh(
        new T.ConeGeometry(0.22, 0.7, 8),
        kit.mat(COLORS[i]),
      );
      marker.position.set(x, 0.35, 0);
      scene.add(marker);
      jumpMarks.push(marker);
    }
  }
  // Only static scenery belongs to this kit; animated objects stay separate.
  kit.bake();
  const resize = () => {
    width = root.clientWidth;
    height = root.clientHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(root);
  resize();
  const kayakCameras = [
    new T.PerspectiveCamera(58, 1, 0.1, 180),
    new T.PerspectiveCamera(58, 1, 0.1, 180),
  ];
  const ray = new T.Raycaster(),
    plane = new T.Plane(new T.Vector3(0, 1, 0), kind === 'dig' ? -0.2 : 0);
  return {
    draw(w: Arena, localId: string, dt: number, reduced = false) {
      const s = w.overhaul!;
      localIndex = Math.max(
        0,
        w.actors.findIndex((p) => p.id === localId),
      );
      avatars.forEach((a, i) => {
        const p = w.actors[i];
        a.visible = kind !== 'dig' && p.alive;
        a.position.set(p.x, p.y, p.z);
        a.rotation.y = p.face;
        if (kind === 'duos') {
          a.position.z += i % 2 ? 0.65 : -0.65;
          a.scale.setScalar(0.58);
        }
        animateAvatar(
          a,
          w.time,
          kind === 'mangosluggers' && w.time < 10 ? 8 : Math.hypot(p.vx, p.vz),
          w.done ? 'happy' : 'neutral',
          reduced,
        );
      });
      if (kind === 'bomb') {
        const bounds = bombBounds(w.time);
        bombFence.scale.set(bounds.x, 1, bounds.z);
        camera.position.set(0, 23, 20);
        camera.lookAt(0, 0, 0);
        const ids = new Set(s.bombs.map((b) => b.id));
        bombs.forEach((g, id) => {
          if (!ids.has(id)) {
            g.removeFromParent();
            disposeObject(g);
            bombs.delete(id);
          }
        });
        for (const b of s.bombs) {
          let g = bombs.get(b.id);
          if (!g) {
            g = new T.Group();
            const bk = new WorldKit(g);
            g.userData.shell = bk.mesh(
              new T.SphereGeometry(0.4, 18, 12),
              '#33394b',
              0,
              0,
              0,
            );
            bk.box(0, 0.4, 0, 0.09, 0.25, 0.09, '#f8c45d');
            scene.add(g);
            bombs.set(b.id, g);
          }
          g.position.set(b.x, b.y, b.z);
          const left = b.fuse - w.time,
            frequency = left < 1 ? 15 : left < 2 ? 8 : left < 3 ? 4 : 1.5;
          const material = (g.userData.shell as T.Mesh)
            .material as T.MeshStandardMaterial;
          material.color.set(
            Math.floor(w.time * frequency) % 2 ? '#ef423a' : '#ffad32',
          );
          material.emissive.copy(material.color);
          material.emissiveIntensity = left < 2 ? 0.55 : 0.1;
        }
        blasts.forEach((m, i) => {
          const e = s.explosions[i];
          m.visible = !!e;
          if (e) {
            const age = (w.time - e.at) / 0.7;
            m.position.set(e.x, 0.4, e.z);
            m.scale.setScalar(e.radius * (0.5 + age * 0.5));
            (m.material as T.MeshBasicMaterial).opacity = 0.7 * (1 - age);
          }
        });
      } else if (kind === 'duos') {
        s.boats.forEach((b, team) => {
          boats[team].position.set(
            (team ? 11 : -11) + riverCenter(b.distance) + b.offset,
            0,
            -b.distance,
          );
          boats[team].rotation.y = -b.heading;
          paddles[team].forEach((p, side) => {
            const age = w.time - b.strokes[side];
            p.rotation.x =
              age < 0.5 ? Math.sin((age / 0.5) * Math.PI) * 0.9 : 0;
            p.rotation.y = (side ? 1 : -1) * 0.3;
          });
        });
        flames.forEach(({ mesh, index }) => {
          const phase = dragonPhase(w.time, index);
          mesh.visible = phase > 0.1 && phase < 2.35;
          mesh.scale.setScalar(phase < 1 ? 0.13 : 1);
          (mesh.material as T.MeshBasicMaterial).color.set(
            phase < 1 ? '#ffec98' : '#ff813b',
          );
        });
      } else if (kind === 'dig') {
        const zoom = Math.max(1, 1.15 / camera.aspect);
        camera.position.set(0, 13.5 * zoom, 0.65 + 4.85 * zoom);
        camera.lookAt(0, 0, 0.65);
        const puzzle = s.puzzles[localIndex],
          assembling = w.time >= 4;
        puzzlePreview!.visible = !assembling;
        puzzlePieces.forEach((g, id) => {
          const piece = puzzle.pieces[id],
            slot = puzzleSlot(id),
            t = Math.min(1, Math.max(0, w.time - 4));
          g.visible = assembling;
          g.position.set(
            T.MathUtils.lerp(slot.x, piece.x, t),
            piece.locked ? 0.12 : puzzle.held === id ? 0.5 : 0.2,
            T.MathUtils.lerp(slot.z, piece.z, t),
          );
          g.rotation.y = ((-piece.turn * Math.PI) / 2) * t;
          puzzleLocks[id].visible = w.time >= 5;
          (puzzleLocks[id].material as T.MeshBasicMaterial).opacity =
            piece.locked ? 0.5 : 0.1;
        });
        puzzleCursor.visible = w.time >= 5;
        puzzleCursor.position.set(puzzle.cursor.x, 0.65, puzzle.cursor.z);
      } else {
        const far = Math.max(12, ...w.actors.map((p) => -p.z));
        camera.position.set(0, 24, 16 - far * 0.25);
        camera.lookAt(0, 0, -far * 0.48);
        jumpMarks.forEach((m, i) => {
          m.position.z = 1 - w.actors[i].distance;
          m.visible = w.time >= 10;
        });
      }
      const renderStart = performance.now();
      if (kind === 'duos') {
        renderer.setScissorTest(true);
        s.boats.forEach((b, team) => {
          const cam = kayakCameras[team],
            x = (team ? 11 : -11) + riverCenter(b.distance) + b.offset;
          cam.aspect = width / 2 / height;
          cam.updateProjectionMatrix();
          cam.position.set(x, 5.3, 9 - b.distance);
          cam.lookAt(
            (team ? 11 : -11) + riverCenter(b.distance + 16),
            1,
            -b.distance - 16,
          );
          renderer.setViewport((team * width) / 2, 0, width / 2, height);
          renderer.setScissor((team * width) / 2, 0, width / 2, height);
          renderer.render(scene, cam);
        });
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, width, height);
      } else renderer.render(scene, camera);
      const at = performance.now();
      perf.frame(at, at - lastPerf, at - renderStart);
      lastPerf = at;
    },
    groundPoint(x: number, y: number) {
      if (kind === 'duos' || kind === 'mangosluggers') return null;
      const rect = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(
        new T.Vector2(
          ((x - rect.left) / rect.width) * 2 - 1,
          1 - ((y - rect.top) / rect.height) * 2,
        ),
        camera,
      );
      return ray.ray.intersectPlane(plane, new T.Vector3());
    },
    dispose() {
      disposed = true;
      image.onload = null;
      observer.disconnect();
      perf.dispose();
      disposeObject(scene);
      atlas?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
