'use client';
import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createShop } from './Shop';
import { Avatar, SPACE_INFO } from './config';
import { getBoard, BOARD_WALK_SPEED } from './boards';
import { makeAvatar, animateAvatar } from './avatar';
import { WorldKit, disposeObject, performanceMeter } from './visuals';
import type { Game } from './engine';
import { createBoardLife } from './BoardLife';
import { makeUfo, animateUfo } from './Ufo';
import { createPlanetScenery } from './PlanetScenery';
import { terrainMaterial, addGroundDetail } from './Surfaces';
import { createAlienScenery } from './AlienScenery';
import { createPlanetarium } from './Planetarium';
import { createBoardEffects } from './BoardEffects';
import { createBoardDirector } from './BoardDirector';
import { createFinale } from './Finale';
import { createBoardSky } from './SpaceLife';
type Props = {
  avatar: Avatar;
  mode: 'board' | 'creator' | 'minigame';
  players?: { id?: string; avatar: Avatar; pos: number }[];
  pearl?: number;
  active?: number;
  low?: boolean;
  reduced?: boolean;
  view?: number;
  boardId?: string;
  effect?: Game['effect'];
  path?: number[];
  bank?: number;
  focus?: boolean;
  game?: Game;
  clockOffset?: number;
  orbital?: boolean;
  titleScreen?: boolean;
  sunBrightness?: number;
  travelTo?: string;
  onTravelComplete?: () => void;
  onOrbitView?: (orbital: boolean) => void;
};
export default function BoardScene(props: Props) {
  const holder = useRef<HTMLDivElement>(null),
    arrivingFromSpace = useRef(false),
    previousBoard = useRef(props.boardId),
    latest = useRef(props),
    [error, setError] = useState('');
  latest.current = props;
  useEffect(() => {
    if (!holder.current) return;
    const root = holder.current;
    let renderer: T.WebGLRenderer;
    try {
      renderer = new T.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setError(
        'WebGL could not start. Enable hardware acceleration in your browser.',
      );
      return;
    }
    const board = getBoard(props.boardId),
      nodes = board.spaces,
      sceneryScale = board.radius / 35;
    const skyColor =
      board.planet === 'earth'
        ? '#9edbf3'
        : board.planet === 'selene'
          ? '#536e9a'
          : '#648da5';
    renderer.setPixelRatio(Math.min(devicePixelRatio, props.low ? 1 : 1.5));
    renderer.setClearColor(skyColor);
    renderer.shadowMap.enabled = !props.low;
    renderer.shadowMap.type = T.PCFShadowMap;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    root.appendChild(renderer.domElement);
    const perf = performanceMeter(renderer, root, board.name);
    const scene = new T.Scene();
    const boardFog = new T.Fog(skyColor, 85 * sceneryScale, 180 * sceneryScale);
    scene.fog = boardFog;
    const camera = new T.PerspectiveCamera(42, 1, 0.1, 6000);
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.enablePan = true;
    orbit.maxPolarAngle = Math.PI * 0.46;
    orbit.minDistance = 14;
    orbit.maxDistance = 115;
    const ambient = new T.HemisphereLight('#fff8e6', board.water, 2.7);
    scene.add(ambient);
    const sun = new T.DirectionalLight('#ffedcd', 3.2);
    sun.position.set(-22 * sceneryScale, 55, 22 * sceneryScale);
    sun.castShadow = true;
    sun.shadow.mapSize.set(props.low ? 512 : 2048, props.low ? 512 : 2048);
    Object.assign(sun.shadow.camera, {
      left: -board.radius,
      right: board.radius,
      top: board.radius,
      bottom: -board.radius,
      near: 1,
      far: 110 * sceneryScale,
    });
    sun.shadow.bias = -0.002;
    scene.add(sun);
    const boardSky = createBoardSky(scene, board.planet === 'earth');
    const world = new T.Group();
    scene.add(world);
    const kit = new WorldKit(world);
    const sea = kit.mesh(
      new T.PlaneGeometry(board.radius * 3.2, board.radius * 3.2),
      board.water,
      0,
      -0.65,
      0,
    );
    sea.rotation.x = -Math.PI / 2;
    sea.castShadow = false;
    kit.mesh(
      new T.CylinderGeometry(board.radius, board.radius + 0.6, 0.9, 72),
      board.edge,
      0,
      -0.1,
      0,
    ).scale.z = 0.83;
    const ground = kit.mesh(
      new T.CylinderGeometry(board.radius - 1.5, board.radius - 1, 0.25, 72),
      board.ground,
      0,
      0.45,
      0,
    );
    ground.scale.z = 0.82;
    ground.material = terrainMaterial(
      board.ground,
      board.terrain,
      board.radius * 0.38,
    );
    addGroundDetail(world, board, !!props.low);
    for (const water of board.waterFeatures) {
      const shore = kit.mesh(
        new T.CylinderGeometry(1, 1, 0.06, 48),
        board.id === 'alpine' ? '#eaffff' : board.edge,
        water.x,
        0.59,
        water.z,
      );
      shore.scale.set(water.rx + 0.8, 1, water.rz + 0.8);
      shore.rotation.y = water.angle;
      const lake = kit.mesh(
        new T.CylinderGeometry(1, 1, 0.07, 48),
        board.id === 'alpine' ? '#a1dce5' : board.water,
        water.x,
        0.64,
        water.z,
      );
      lake.scale.set(water.rx, 1, water.rz);
      lake.rotation.y = water.angle;
    }
    const pathColor =
      board.planet !== 'earth'
        ? board.edge
        : board.id === 'alpine'
          ? '#b3cddd'
          : board.id === 'moss'
            ? '#c4bf98'
            : '#efd8aa';
    for (const a of nodes)
      for (const n of a.next) {
        const b = nodes[n],
          dx = b.x - a.x,
          dz = b.z - a.z;
        const path = kit.box(
          (a.x + b.x) / 2,
          0.63,
          (a.z + b.z) / 2,
          1.32,
          0.17,
          Math.hypot(dx, dz),
          pathColor,
        );
        path.rotation.y = Math.atan2(dx, dz);
      }
    const icons = new Map<string, T.Texture>();
    for (const [type, info] of Object.entries(SPACE_INFO)) {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 128;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#fffbe7';
      ctx.beginPath();
      ctx.arc(64, 64, 58, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#163e50';
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.fillStyle = '#123d49';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `900 ${info.mark.length > 3 ? 26 : info.mark.length > 1 ? 45 : 74}px Arial`;
      ctx.fillText(info.mark, 64, 66);
      icons.set(type, new T.CanvasTexture(c));
    }
    for (const [type, info] of Object.entries(SPACE_INFO)) {
      const spaces = nodes.filter((n) => n.type === type);
      const tile = new T.InstancedMesh(
        new T.CylinderGeometry(0.84, 0.88, 0.2, 18),
        kit.mat(info.color),
        spaces.length,
      );
      tile.receiveShadow = true;
      world.add(tile);
      const icon = new T.InstancedMesh(
        new T.PlaneGeometry(1.25, 1.25),
        new T.MeshBasicMaterial({
          map: icons.get(type),
          transparent: true,
          depthWrite: false,
        }),
        spaces.length,
      );
      world.add(icon);
      const dummy = new T.Object3D();
      spaces.forEach((s, i) => {
        dummy.position.set(s.x, 0.81, s.z);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        tile.setMatrixAt(i, dummy.matrix);
        dummy.position.y = 0.927;
        dummy.rotation.x = -Math.PI / 2;
        dummy.updateMatrix();
        icon.setMatrixAt(i, dummy.matrix);
      });
    }
    const safe = (x: number, z: number, r = 2.2) =>
      nodes.every((n) => Math.hypot(n.x - x, n.z - z) > r) &&
      board.waterFeatures.every(
        (w) => Math.hypot((x - w.x) / (w.rx + 1), (z - w.z) / (w.rz + 1)) > 1,
      ) &&
      nodes.every((a) =>
        a.next.every((id) => {
          const b = nodes[id],
            dx = b.x - a.x,
            dz = b.z - a.z,
            t = Math.max(
              0,
              Math.min(
                1,
                ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz),
              ),
            );
          return Math.hypot(x - a.x - t * dx, z - a.z - t * dz) > r;
        }),
      );
    for (
      let i = 0;
      i < (board.planet !== 'earth' ? 0 : props.low ? 120 : 360);
      i++
    ) {
      const a = i * 2.39996,
        r = (6 + Math.sqrt(i / (props.low ? 120 : 360)) * 26) * sceneryScale,
        x = Math.sin(a) * r,
        z = Math.cos(a) * r * 0.8;
      if (!safe(x, z)) continue;
      if (i % 4 === 0)
        kit.rock(
          x,
          z,
          0.7 + (i % 3) * 0.3,
          board.id === 'alpine' ? '#a4b9c6' : '#7b977f',
        );
      else
        kit.tree(
          x,
          z,
          board.id === 'alpine'
            ? 'pine'
            : board.id === 'moss'
              ? i % 3
                ? 'jungle'
                : 'mushroom'
              : 'palm',
          0.7 + (i % 4) * 0.13,
        );
    }
    for (const n of nodes.filter(
      (n) => n.type === 'bank' || n.type === 'shop' || n.type === 'lottery',
    )) {
      let clearing: { x: number; z: number } | undefined;
      for (let i = 0; i < 48; i++) {
        const a = i * 2.4,
          r = 4 + Math.floor(i / 16) * 2,
          x = n.x + Math.sin(a) * r,
          z = n.z + Math.cos(a) * r;
        if (safe(x, z, 3.3)) {
          clearing = { x, z };
          break;
        }
      }
      if (!clearing && (n.type === 'shop' || n.type === 'lottery')) {
        const angle = Math.atan2(n.z, n.x);
        clearing = {
          x: n.x + Math.cos(angle) * 2.7,
          z: n.z + Math.sin(angle) * 2.7,
        };
      }
      if (!clearing) continue;
      const { x, z } = clearing;
      if (n.type === 'shop' || n.type === 'lottery') {
        createShop(
          world,
          x,
          z,
          n.x,
          n.z,
          n.type === 'lottery' ? '#cf74da' : board.accent,
          n.type === 'lottery' ? 'LOTTO' : 'SHOP',
        );
        continue;
      }
      if (board.planet === 'earth')
        kit.hut(
          x,
          z,
          n.type === 'bank'
            ? '#edcb77'
            : board.id === 'moss'
              ? '#a9b887'
              : '#d8b994',
          board.id === 'alpine',
        );
      else {
        const color = n.type === 'bank' ? '#e8c267' : board.accent;
        kit.mesh(
          new T.CylinderGeometry(1.65, 1.85, 0.35, 24),
          board.edge,
          x,
          0.78,
          z,
        );
        const dome = kit.mesh(
          new T.SphereGeometry(1.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
          color,
          x,
          0.94,
          z,
        );
        dome.scale.y = 0.85;
        kit.box(x, 1.3, z + 1.45, 0.75, 1, 0.12, '#112436');
        kit.box(x, 1.85, z + 1.52, 0.84, 0.12, 0.08, board.accent);
        for (const side of [-1, 1])
          kit.mesh(
            new T.SphereGeometry(0.23, 12, 8),
            '#b7fff0',
            x + side * 0.94,
            1.52,
            z + 1.1,
          ).scale.z = 0.25;
        kit.mesh(
          new T.CylinderGeometry(0.04, 0.06, 0.65, 8),
          '#cadfe5',
          x,
          2.53,
          z,
        );
        kit.mesh(new T.OctahedronGeometry(0.18), color, x, 2.98, z);
      }
      if (n.type === 'bank') {
        for (let j = 0; j < 3; j++)
          kit.mesh(
            new T.CylinderGeometry(0.4, 0.4, 0.12, 12),
            '#ffcf5a',
            x + 0.9,
            1.2 + j * 0.14,
            z + 1.3,
          );
      }
    }
    // Blender-built Nabbit figures beside every steal stop (public/models/nabbit.glb).
    const nabbits: {
      node: (typeof nodes)[number];
      root: T.Object3D;
      mixer: T.AnimationMixer;
      home: T.Vector3;
    }[] = [];
    const nabbitSpots = nodes
      .filter((n) => n.type === 'thief')
      .map((n) => {
        for (let i = 0; i < 32; i++) {
          const a = Math.atan2(n.x, n.z) + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.45,
            r = 2 + Math.floor(i / 12) * 0.6,
            x = n.x + Math.sin(a) * r,
            z = n.z + Math.cos(a) * r;
          if (safe(x, z, 1.25)) return { n, x, z };
        }
        return { n, x: n.x * 1.06, z: n.z * 1.06 };
      });
    let disposed = false;
    if (nabbitSpots.length)
      new GLTFLoader().load(
        '/models/nabbit.glb',
        (gltf) => {
          if (disposed) return disposeObject(gltf.scene);
          for (const spot of nabbitSpots) {
            const root = gltf.scene.clone(true);
            root.scale.setScalar(1.15);
            root.position.set(spot.x, 0.6, spot.z);
            root.rotation.y = Math.atan2(spot.n.x - spot.x, spot.n.z - spot.z);
            root.traverse((o) => {
              if ((o as T.Mesh).isMesh) o.castShadow = true;
            });
            world.add(root);
            const mixer = new T.AnimationMixer(root);
            if (gltf.animations[0]) {
              const idle = mixer.clipAction(gltf.animations[0]);
              idle.time = Math.random() * gltf.animations[0].duration;
              idle.play();
            }
            nabbits.push({ node: spot.n, root, mixer, home: root.position.clone() });
          }
        },
        undefined,
        () => {
          // Optional art: a missing model (e.g. the offline file) leaves the board as-is.
        },
      );
    const landmark = board.landmark;
    const details = new T.Group();
    world.add(details);
    const detailKit = new WorldKit(details);
    if (board.id === 'crown') {
      detailKit.mesh(
        new T.ConeGeometry(4.7, 7, 16),
        '#806456',
        landmark.x / sceneryScale,
        3.4,
        landmark.z / sceneryScale,
      );
      detailKit.mesh(
        new T.CylinderGeometry(1.35, 2, 1.5, 16),
        '#5e5052',
        landmark.x / sceneryScale,
        6.2,
        landmark.z / sceneryScale,
      );
      detailKit.mesh(
        new T.CylinderGeometry(1.18, 1.18, 0.1, 20),
        '#ffb14b',
        landmark.x / sceneryScale,
        6.98,
        landmark.z / sceneryScale,
      );
      for (let i = 0; i < 8; i++) {
        const a = i * 0.8;
        detailKit.rock(
          landmark.x / sceneryScale + Math.sin(a) * 4,
          landmark.z / sceneryScale + Math.cos(a) * 4,
          0.8,
          '#736059',
        );
      }
    } else if (board.id === 'alpine') {
      for (let i = 0; i < 3; i++) {
        const x = landmark.x / sceneryScale + (i - 1) * 1.6,
          z = landmark.z / sceneryScale;
        detailKit.mesh(
          new T.ConeGeometry(1.5, 7 + (i % 3), 9),
          '#829eaf',
          x,
          3,
          z,
        );
        detailKit.mesh(
          new T.ConeGeometry(0.85, 4 + (i % 3), 9),
          '#f0f1e6',
          x,
          5.5,
          z,
        );
      }
    } else if (board.id === 'moss') {
      for (let i = 0; i < 5; i++)
        detailKit.box(
          landmark.x / sceneryScale,
          0.5 + i * 0.7,
          landmark.z / sceneryScale,
          7 - i,
          1,
          7 - i,
          '#a3ae88',
        );
      detailKit.arch(
        landmark.x / sceneryScale,
        landmark.z / sceneryScale,
        '#c2c5a0',
      );
      detailKit.mesh(
        new T.SphereGeometry(0.8, 12, 8),
        '#8ce5b5',
        landmark.x / sceneryScale,
        5,
        landmark.z / sceneryScale,
      );
    }
    detailKit.bake();
    details.scale.set(sceneryScale, 1, sceneryScale);
    kit.bake();
    const life =
      board.planet === 'earth'
        ? createBoardLife(world, board, landmark, !!props.low)
        : createAlienScenery(world, board, !!props.low);
    const planetLife =
      board.planet === 'earth'
        ? createPlanetScenery(world, board, !!props.low)
        : { draw: () => {} };
    const universe = createPlanetarium(scene, board.id);
    const boardEffects = createBoardEffects(world, board);
    const director = createBoardDirector(world, nodes);
    const ship = makeUfo();
    world.add(ship);
    const startNode = nodes[0],
      approach = new T.Vector3(-startNode.x, 0, -startNode.z).normalize();
    const shipHome = new T.Vector3(
      startNode.x - approach.x * 3.94,
      0.7,
      startNode.z - approach.z * 3.94,
    );
    ship.rotation.y = Math.atan2(approach.x, approach.z);
    let worldClock = 0;
    const ambiance = new T.Group();
    world.add(ambiance);
    const motes: T.Mesh[] = [];
    for (let i = 0; i < 28; i++) {
      const m = new T.Mesh(
        new T.SphereGeometry(board.id === 'alpine' ? 0.06 : 0.08, 5, 4),
        new T.MeshBasicMaterial({
          color:
            board.id === 'moss'
              ? '#eeffa1'
              : board.id === 'alpine'
                ? '#fffef3'
                : '#f9c995',
        }),
      );
      ambiance.add(m);
      motes.push(m);
    }
    const prize = new T.Mesh(
      new T.OctahedronGeometry(0.84, 0),
      new T.MeshStandardMaterial({
        color: '#ffe93d',
        emissive: '#ffc400',
        emissiveIntensity: 1.25,
        metalness: 0.35,
        roughness: 0.13,
      }),
    );
    world.add(prize);
    const prizeRing = new T.Mesh(
      new T.TorusGeometry(1.08, 0.05, 8, 48),
      new T.MeshBasicMaterial({
        color: '#fff59b',
        transparent: true,
        opacity: 0.8,
      }),
    );
    prizeRing.rotation.x = -Math.PI / 2;
    world.add(prizeRing);
    const prizeLight = new T.PointLight('#ffd82f', 5, 9, 2);
    world.add(prizeLight);
    const actors = new T.Group();
    scene.add(actors);
    const creator = new T.Group();
    scene.add(creator);
    const pedestal = new T.Mesh(
      new T.CylinderGeometry(1.35, 1.5, 0.18, 32),
      kit.mat('#ffe6ad'),
    );
    creator.add(pedestal);
    const particles: T.Mesh[] = [];
    for (let i = 0; i < 26; i++) {
      const p = new T.Mesh(
        new T.IcosahedronGeometry(0.16, 0),
        new T.MeshBasicMaterial({ color: '#ffbd4d' }),
      );
      p.visible = false;
      world.add(p);
      particles.push(p);
    }
    let meshes: T.Group[] = [],
      signature = '',
      lastMode = '',
      lastView = -1,
      lastEffect = -1,
      lastDiamond = -1,
      lastBonusCount = 0,
      raf = 0,
      last = performance.now(),
      effectAt = -100,
      lastStep = 0,
      arrival = false;
    let lastOrbital: boolean | undefined,
      lastTitle: boolean | undefined,
      transition = 0,
      followZoom = 0,
      previousPhase = '',
      previousPos = -1,
      lastAnnounce = -1;
    let finale: ReturnType<typeof createFinale> | undefined,
      finaleKey = '';
    const transitionPosition = new T.Vector3(),
      transitionTarget = new T.Vector3();
    let traveling = '',
      travelAge = 0,
      travelDone = false;
    const travelFrom = new T.Vector3(),
      travelLookFrom = new T.Vector3();
    const travelFade = document.createElement('div');
    travelFade.className = 'planet-travel-fade';
    root.appendChild(travelFade);
    const directTransfer =
      !props.orbital &&
      previousBoard.current !== props.boardId &&
      !arrivingFromSpace.current;
    previousBoard.current = props.boardId;
    let entryFade = arrivingFromSpace.current ? 0.7 : directTransfer ? 0.25 : 0;
    travelFade.style.opacity = entryFade ? '1' : '0';
    arrivingFromSpace.current = false;
    orbit.addEventListener('start', () => {
      transition = 0;
      if (latest.current.game?.phase !== 'moving') followZoom = 0;
    });
    let effect: Props['effect'];
    const target = new T.Vector3();
    function studioFrame() {
      if (latest.current.mode === 'creator' && root.clientWidth < 750)
        camera.setViewOffset(
          root.clientWidth,
          root.clientHeight,
          0,
          Math.round(root.clientHeight * 0.19),
          root.clientWidth,
          root.clientHeight,
        );
      else camera.clearViewOffset();
    }
    function cameraSetup(p: Props) {
      const studio = p.mode === 'creator';
      transitionPosition.set(
        studio ? 2.1 : 42 * sceneryScale,
        studio ? 2.2 : 20 * sceneryScale,
        studio ? 5.2 : 59 * sceneryScale,
      );
      transitionTarget.set(studio ? 0.1 : 0, studio ? 1.2 : 0, 0);
      if (p.orbital && !studio) {
        const offset =
          !p.titleScreen && !p.game && root.clientWidth > 750 ? -210 : 0;
        const distance = root.clientWidth < 750 ? 1800 : 1300;
        transitionPosition.set(offset, distance * 0.52, distance);
        transitionTarget.set(offset, 0, 0);
      }
      if (lastMode === '') {
        camera.position.copy(transitionPosition);
        if (directTransfer) camera.position.add(new T.Vector3(-6, 4, 0));
        orbit.target.copy(transitionTarget);
      }
      transition = 2;
      orbit.minDistance = studio ? 2.6 : p.orbital ? 135 : 14;
      orbit.maxDistance = studio ? 8 : p.orbital ? 2300 : board.radius * 2.75;
      orbit.enablePan = !studio;
      orbit.minPolarAngle = studio ? Math.PI * 0.28 : 0;
      orbit.maxPolarAngle = p.orbital ? Math.PI * 0.98 : Math.PI * 0.46;
      if (p.game?.phase === 'moving' && !studio && !p.orbital) {
        transition = 0;
        followZoom = 2;
      }
      studioFrame();
    }
    function animate(now: number) {
      raf = requestAnimationFrame(animate);
      const elapsed = now - last,
        dt = Math.min(0.07, elapsed / 1000);
      last = now;
      const p = latest.current,
        studio = p.mode === 'creator';
      if (entryFade > 0) {
        entryFade = Math.max(0, entryFade - dt);
        travelFade.style.opacity = String(entryFade / 0.7);
      }
      if (!studio && !document.hidden && elapsed < 250)
        worldClock += elapsed / 1000;
      if (!p.orbital) {
        life.draw(worldClock, !!p.reduced);
        planetLife.draw(worldClock, !!p.reduced);
      }
      universe.root.visible = !!p.orbital && !studio;
      if (universe.root.visible)
        universe.draw(worldClock, !!p.reduced, p.titleScreen, p.sunBrightness);
      // Low fill in orbit gives the planets a real night side.
      ambient.intensity = p.orbital ? 0.35 : 2.7;
      sun.intensity = p.orbital ? 0.6 : 1.5 + (p.sunBrightness ?? 0.55) * 2;
      boardSky.root.visible = !p.orbital && !studio;
      boardSky.draw(camera, worldClock, p.sunBrightness ?? 0.55, !!p.reduced);
      scene.fog = p.orbital ? null : boardFog;
      renderer.setClearColor(
        studio ? '#0b1426' : p.orbital ? '#030815' : skyColor,
      );
      const game = p.game,
        serverNow = Date.now() + (p.clockOffset ?? 0);
      const pickup = game?.diamondPickup,
        bonusCount = game?.bonuses?.filter((b) => b.awarded).length ?? 0;
      if (pickup && pickup.startedAt !== lastDiamond) {
        lastDiamond = pickup.startedAt;
        if (serverNow - pickup.startedAt < 1800)
          window.dispatchEvent(
            new CustomEvent('sp-sound', {
              detail: { kind: 'diamond', delta: 1 },
            }),
          );
      }
      if (bonusCount > lastBonusCount)
        window.dispatchEvent(
          new CustomEvent('sp-sound', {
            detail: { kind: 'diamond', delta: 1 },
          }),
        );
      lastBonusCount = bonusCount;
      const flight = game?.flight,
        landing = flight
          ? T.MathUtils.smoothstep(
              serverNow,
              flight.startedAt,
              flight.landAt - 900,
            )
          : 1;
      ship.visible = !!game && !game.practice;
      ship.position.copy(shipHome);
      if (flight && !p.reduced)
        ship.position.add(
          new T.Vector3(
            -18 * (1 - landing),
            32 * (1 - landing),
            18 * (1 - landing),
          ),
        );
      // Once the whole crew is out, the ship lifts clear so it never hides the start.
      const crewOut =
        !!game &&
        !game.flight &&
        game.players.every((q) => game.departed?.[q.id] !== undefined);
      const lift = crewOut
        ? T.MathUtils.smoothstep(
            serverNow,
            (game!.rampClosesAt ?? 0) + 1100,
            (game!.rampClosesAt ?? 0) + 3600,
          )
        : 0;
      if (lift > 0 && game?.phase !== 'finished' && game?.phase !== 'bonus') {
        ship.position.y += lift * 8.5;
        ship.position.addScaledVector(approach, -lift * 3);
        if (!p.reduced) ship.position.y += Math.sin(worldClock * 0.9) * 0.25 * lift;
      }
      ship.rotation.z =
        flight && !p.reduced ? Math.sin(landing * Math.PI) * 0.16 : 0;
      const rampOpen = flight
        ? T.MathUtils.smoothstep(serverNow, flight.landAt - 1000, flight.landAt)
        : 1;
      const rampClosed = game?.rampClosesAt
        ? T.MathUtils.smoothstep(
            serverNow,
            game.rampClosesAt,
            game.rampClosesAt + 1100,
          )
        : 0;
      animateUfo(ship, worldClock, rampOpen * (1 - rampClosed), !!p.reduced);
      ship.updateMatrixWorld(true);
      world.visible = !studio && !p.orbital;
      actors.visible = !studio && !p.orbital;
      creator.visible = studio;
      if (
        lastMode !== p.mode ||
        lastView !== (p.view ?? 0) ||
        lastOrbital !== !!p.orbital ||
        lastTitle !== !!p.titleScreen
      ) {
        cameraSetup(p);
        lastMode = p.mode;
        lastView = p.view ?? 0;
        lastOrbital = !!p.orbital;
        lastTitle = !!p.titleScreen;
      }
      const sig = JSON.stringify(
        studio ? p.avatar : (p.players?.map((x) => x.avatar) ?? [p.avatar]),
      );
      if (sig !== signature) {
        signature = sig;
        meshes.forEach((m) => {
          m.removeFromParent();
          disposeObject(m);
        });
        meshes = (
          studio ? [p.avatar] : (p.players?.map((x) => x.avatar) ?? [p.avatar])
        ).map((a, i) => {
          const m = makeAvatar(a);
          (studio ? creator : actors).add(m);
          const n = nodes[p.players?.[i]?.pos ?? 0];
          m.position.set(n.x, 0.96, n.z);
          return m;
        });
      }
      if (p.effect && p.effect.id !== lastEffect && !studio) {
        lastEffect = p.effect.id;
        effect = p.effect;
        arrival = true;
        effectAt =
          now / 1000 -
          (effect.startedAt
            ? Math.max(0, (serverNow - effect.startedAt) / 1000)
            : 0);
        window.dispatchEvent(
          new CustomEvent('sp-sound', {
            detail: { kind: effect.kind, delta: effect.delta },
          }),
        );
      }
      if (!p.effect) {
        effect = undefined;
        lastEffect = -1;
      }
      meshes.forEach((m, i) => {
        const a = studio ? p.avatar : (p.players?.[i]?.avatar ?? p.avatar);
        if (studio) {
          m.position.set(0, 0, 0);
          m.rotation.y = p.reduced ? 0 : Math.sin(now * 0.0003) * 0.25;
          animateAvatar(m, now / 1000, 0, 'neutral', p.reduced);
          return;
        }
        const player = p.players?.[i],
          id = player?.id ?? '';
        const boarded = !!game?.flight && game.departed?.[id] === undefined;
        const departureAt = game?.departed?.[id];
        const exiting =
          departureAt !== undefined && serverNow < departureAt + 1200;
        const moving =
          !!game?.movement && i === game.active && game.phase === 'moving';
        const n = nodes[player?.pos ?? 0];
        let d = 0,
          speed = 0,
          hop = 0;
        m.visible = true;
        if (boarded) {
          target.set(i % 2 ? 0.57 : -0.57, 1.3, i < 2 ? 0.42 : -0.42);
          ship.localToWorld(target);
          m.position.copy(target);
          m.rotation.y = ship.rotation.y;
          m.scale.setScalar(0.44);
          animateAvatar(m, worldClock, 0, 'happy', p.reduced);
          return;
        }
        if (exiting) {
          const t = T.MathUtils.clamp((serverNow - departureAt) / 1200, 0, 1);
          target.set(0, 0.37, 2.52);
          ship.localToWorld(target);
          const end = new T.Vector3(
            n.x + Math.sin(i * 1.57) * 0.45,
            0.96,
            n.z + Math.cos(i * 1.57) * 0.45,
          );
          m.position.copy(target).lerp(end, t);
          m.rotation.y = ship.rotation.y;
          m.scale.set(a.width * 0.72, a.height * 0.72, a.width * 0.72);
          animateAvatar(m, worldClock, 5, 'happy', p.reduced);
          return;
        }
        if (moving) {
          const edge = game!.movement!,
            from = nodes[edge.from],
            to = nodes[edge.to];
          const progress = T.MathUtils.clamp(
            (serverNow - edge.startedAt) / (edge.arrivesAt - edge.startedAt),
            0,
            1,
          );
          target.set(
            T.MathUtils.lerp(from.x, to.x, progress),
            0.96,
            T.MathUtils.lerp(from.z, to.z, progress),
          );
          m.position.copy(target);
          m.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
          d = progress < 1 ? 1 : 0;
          speed = BOARD_WALK_SPEED;
          // One springy hop per space, like a game piece bounding along the road.
          hop = p.reduced ? 0 : Math.sin(progress * Math.PI) * 0.62;
          if (progress >= 0.9 && lastStep !== edge.startedAt) {
            lastStep = edge.startedAt;
            window.dispatchEvent(
              new CustomEvent('sp-sound', {
                detail: { kind: 'step', delta: 0 },
              }),
            );
          }
        } else {
          target.set(
            n.x + Math.sin(i * 1.57) * 0.45,
            0.96,
            n.z + Math.cos(i * 1.57) * 0.45,
          );
          m.position.lerp(target, Math.min(1, dt * 9));
          const facing = Math.atan2(
            camera.position.x - m.position.x,
            camera.position.z - m.position.z,
          );
          m.rotation.y +=
            Math.atan2(
              Math.sin(facing - m.rotation.y),
              Math.cos(facing - m.rotation.y),
            ) * Math.min(1, dt * 4);
        }
        const age = now / 1000 - effectAt,
          individual = effect?.losses?.find((l) => l.player === id),
          diamond =
            game?.diamondPickup?.player === id &&
            serverNow - game.diamondPickup.startedAt < 2400,
          react =
            ((effect?.player === id || !!individual) &&
              age <
                (effect?.kind === 'event'
                  ? 5
                  : effect?.kind === 'bank'
                    ? 5.5
                    : 2.4)) ||
            diamond,
          delta = diamond ? 1 : (individual?.delta ?? effect?.delta ?? 0),
          mood = react ? (delta >= 0 ? 'happy' : 'sad') : 'neutral';
        m.position.y =
          0.96 +
          hop +
          (!p.reduced && react && delta > 0
            ? Math.max(0, Math.sin(age * 8)) * 0.65
            : 0);
        m.scale.set(a.width * 0.72, a.height * 0.72, a.width * 0.72);
        // Stretch while airborne, squash on touchdown.
        if (hop > 0) {
          const stretch = 1 + (hop / 0.62 - 0.5) * 0.16;
          m.scale.y *= stretch;
          m.scale.x /= Math.sqrt(stretch);
          m.scale.z /= Math.sqrt(stretch);
        }
        animateAvatar(m, now / 1000, d > 0.1 ? speed : 0, mood, p.reduced);
      });
      for (const nab of nabbits) {
        nab.mixer.update(p.reduced ? 0 : dt);
        // Hop and turn toward the explorer haggling at this Nabbit's stop.
        const haggling =
          game?.phase === 'steal' && game.steal?.space === nab.node.id;
        const subject = meshes[game?.active ?? 0];
        const face = haggling && subject
          ? Math.atan2(
              subject.position.x - nab.root.position.x,
              subject.position.z - nab.root.position.z,
            )
          : Math.atan2(nab.node.x - nab.home.x, nab.node.z - nab.home.z);
        nab.root.rotation.y +=
          Math.atan2(
            Math.sin(face - nab.root.rotation.y),
            Math.cos(face - nab.root.rotation.y),
          ) * Math.min(1, dt * 6);
        nab.root.position.y =
          nab.home.y +
          (haggling && !p.reduced
            ? Math.abs(Math.sin(worldClock * 7)) * 0.45
            : 0);
      }
      if (!studio)
        director.frame({
          game: game?.practice ? undefined : game,
          serverNow,
          dt,
          meshes,
          reduced: !!p.reduced,
          camera,
        });
      const movementLive = game?.phase === 'moving';
      if (movementLive && previousPhase !== 'moving') {
        followZoom = 2;
        p.onOrbitView?.(false);
        transition = 0;
      }
      // Each new turn frames the explorer and their dice block up close.
      const announceId = game?.announce?.id ?? -1;
      if (game?.phase === 'turn' && announceId !== lastAnnounce) {
        followZoom = 2.4;
        transition = 0;
        p.onOrbitView?.(false);
      }
      lastAnnounce = announceId;
      if (
        game &&
        previousPos !== -1 &&
        previousPos !== game.players[game.active].pos &&
        game.phase === 'turn'
      )
        followZoom = 1.5;
      previousPhase = game?.phase ?? '';
      previousPos = game?.players[game.active]?.pos ?? -1;
      if (
        p.focus &&
        !studio &&
        !p.orbital &&
        (movementLive ||
          game?.phase === 'arrival' ||
          game?.phase === 'rolling' ||
          followZoom > 0) &&
        meshes[p.active ?? 0]
      ) {
        followZoom = Math.max(0, followZoom - dt);
        const subject = meshes[p.active ?? 0];
        const desired =
          game?.phase === 'arrival'
            ? ship.position.clone().add(new T.Vector3(0, 2, 0))
            : subject.position.clone().setY(1.6);
        const follow = 1 - Math.exp(-dt * 3.4);
        const shift = desired.clone().sub(orbit.target).multiplyScalar(follow);
        orbit.target.add(shift);
        camera.position.add(shift);
        if (
          followZoom > 0 ||
          game?.phase === 'arrival' ||
          game?.phase === 'rolling'
        ) {
          const distance = camera.position.distanceTo(orbit.target),
            wanted =
              game?.phase === 'arrival'
                ? 19
                : game?.phase === 'turn' || game?.phase === 'rolling'
                  ? 17
                  : 25;
          const direction = camera.position
            .clone()
            .sub(orbit.target)
            .normalize();
          if (game?.phase !== 'arrival' && followZoom > 0) {
            // Settle into a high view from the island's interior, so the
            // parked ship and outer scenery sit behind the explorer.
            const inward = new T.Vector3(-desired.x, 0, -desired.z);
            if (inward.lengthSq() < 16)
              inward.set(direction.x, 0, direction.z);
            inward.normalize();
            const elevation = 0.95;
            direction
              .lerp(
                new T.Vector3(
                  inward.x * Math.cos(elevation),
                  Math.sin(elevation),
                  inward.z * Math.cos(elevation),
                ),
                1 - Math.exp(-dt * 2.4),
              )
              .normalize();
          }
          camera.position
            .copy(orbit.target)
            .addScaledVector(
              direction,
              T.MathUtils.lerp(distance, wanted, follow),
            );
        }
      }
      if (transition > 0) {
        const t = 1 - Math.exp(-dt * (directTransfer ? 9 : 3.8));
        camera.position.lerp(transitionPosition, t);
        orbit.target.lerp(transitionTarget, t);
        transition -= dt;
      }
      if (!studio && !p.orbital) {
        // Pan and zoom stay inside the board view throughout a match.
        const bounded = orbit.target.clone();
        bounded.x = T.MathUtils.clamp(bounded.x, -board.radius, board.radius);
        bounded.z = T.MathUtils.clamp(
          bounded.z,
          -board.radius * 0.85,
          board.radius * 0.85,
        );
        bounded.y = T.MathUtils.clamp(bounded.y, 0, 6);
        camera.position.add(bounded.clone().sub(orbit.target));
        orbit.target.copy(bounded);
      }
      const age = now / 1000 - effectAt;
      boardEffects.draw(effect, age, !!p.reduced);
      particles.forEach((m, i) => {
        m.visible = !!effect && arrival && age < 2.7 && !p.reduced;
        if (!m.visible) return;
        const n = nodes[effect!.space],
          haz = effect!.kind === 'hazard',
          t = age + i * 0.027,
          source = haz ? landmark : n;
        const color = haz
          ? board.id === 'alpine'
            ? '#f1f5ee'
            : board.id === 'moss'
              ? '#9470a3'
              : '#ff9e35'
          : '#ffcf56';
        (m.material as T.MeshBasicMaterial).color.set(color);
        const f = Math.min(1, t / 1.1);
        m.position.set(
          source.x + (n.x - source.x) * f + Math.sin(i * 2.4) * t,
          1 + (haz ? 6 * (1 - f) : 0) + Math.sin(Math.min(Math.PI, t * 2)) * 3,
          n.z + (source.z - n.z) * (1 - f) + Math.cos(i * 2.4) * t,
        );
        m.rotation.y = now * 0.005 + i;
      });
      motes.forEach((m, i) => {
        if (p.reduced) {
          m.visible = false;
          return;
        }
        m.position.set(
          Math.sin(i * 2.4) * 29 * sceneryScale,
          board.id === 'alpine'
            ? 8 - ((now * 0.0005 + i * 0.4) % 8)
            : 1.2 + Math.sin(now * 0.0008 + i) * 0.6,
          Math.cos(i * 2.4) * 23 * sceneryScale,
        );
      });
      const n = nodes[p.pearl ?? (board.id === 'moss' ? 23 : 22)];
      prize.position.set(
        n.x,
        2.1 + (p.reduced ? 0 : Math.sin(now * 0.002) * 0.18),
        n.z,
      );
      prize.rotation.y = now * 0.001;
      prizeRing.position.set(n.x, 1.02, n.z);
      prizeRing.scale.setScalar(
        p.reduced ? 1 : 1 + Math.sin(now * 0.003) * 0.08,
      );
      prizeLight.position.copy(prize.position);
      if (game?.finale && ['bonus', 'finished'].includes(game.phase)) {
        // Award deadlines may rebase the timeline without replacing the scene.
        const key = game.finale.reason + ':' + game.seed;
        if (finaleKey !== key) {
          finale?.dispose();
          finale = createFinale(
            scene,
            game.players.map((p) => p.avatar),
            Math.max(
              0,
              game.players.findIndex((p) => p.id === game.finale?.winner),
            ),
            game.finale.reason === 'goal' ? 'winner' : 'bonus',
          );
          finaleKey = key;
        }
        if (game.finale.winner)
          finale!.setWinner(
            game.players.findIndex((p) => p.id === game.finale!.winner),
          );
        finale!.update(
          Math.max(0, (serverNow - game.finale.startedAt) / 1000),
          !!p.reduced,
        );
        world.visible =
          actors.visible =
          universe.root.visible =
          boardSky.root.visible =
            false;
        scene.fog = null;
        renderer.setClearColor('#050b19');
        orbit.enabled = false;
        camera.position.lerp(finale!.cameraPosition, 1 - Math.exp(-dt * 4.5));
        orbit.target.lerp(finale!.cameraTarget, 1 - Math.exp(-dt * 4.5));
        camera.fov = finale!.cameraFov;
        camera.updateProjectionMatrix();
      } else {
        if (finale) {
          finale.dispose();
          finale = undefined;
          finaleKey = '';
          cameraSetup(p);
        }
        orbit.enabled = true;
        camera.fov = 42;
        camera.updateProjectionMatrix();
      }
      if (p.travelTo && p.orbital && !finale) {
        if (traveling !== p.travelTo) {
          traveling = p.travelTo;
          travelAge = 0;
          travelDone = false;
          travelFrom.copy(camera.position);
          travelLookFrom.copy(orbit.target);
        }
        travelAge += dt;
        const progress = Math.min(1, travelAge / 2.8),
          eased = progress * progress * (3 - 2 * progress);
        const destination = universe.destination(p.travelTo);
        camera.position.lerpVectors(travelFrom, destination.position, eased);
        orbit.target.lerpVectors(travelLookFrom, destination.center, eased);
        orbit.enabled = false;
        transition = 0;
        camera.lookAt(orbit.target);
        travelFade.style.opacity = String(
          Math.max(0, (progress - 0.83) / 0.17),
        );
        if (progress >= 1 && !travelDone) {
          travelDone = true;
          arrivingFromSpace.current = true;
          p.onTravelComplete?.();
        }
      } else {
        if (traveling) {
          traveling = '';
          arrivingFromSpace.current = false;
          travelFade.style.transition = 'opacity 650ms ease';
          travelFade.style.opacity = '0';
        }
        if (finale) camera.lookAt(orbit.target);
        else orbit.update();
      }
      const renderStart = performance.now();
      renderer.render(scene, camera);
      perf.frame(now, elapsed, performance.now() - renderStart);
    }
    const resize = () => {
      const w = root.clientWidth,
        h = root.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      studioFrame();
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(root);
    resize();
    raf = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      orbit.dispose();
      perf.dispose();
      disposed = true;
      director.dispose();
      finale?.dispose();
      disposeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
      travelFade.remove();
    };
  }, [props.low, props.boardId]);
  return (
    <div
      className="scene"
      ref={holder}
      aria-label={
        props.mode === 'creator'
          ? '3D character preview'
          : `Interactive 3D ${getBoard(props.boardId).name} board`
      }
    >
      {error && <div className="webgl-error">{error}</div>}
    </div>
  );
}
