import * as T from 'three';
import { BOARDS, PLANETS } from './boards';
import { createGlobe } from './PlanetGlobe';
import { createSpaceLife } from './SpaceLife';

export function createPlanetarium(parent: T.Object3D, boardId: string) {
  const root = new T.Group();
  parent.add(root);
  const life = createSpaceLife(root);
  const boardTargets = new Map<string, { group: T.Group; normal: T.Vector3 }>();
  const worlds: T.Group[] = [],
    labels: T.Object3D[] = [],
    globes: ReturnType<typeof createGlobe>[] = [],
    beacons: T.Mesh[] = [];
  const orbitRadii = [225, 345, 465, 590],
    phases = [2.7, 5.5, 0.7, 3.9],
    sizes = [0.7, 0.48, 0.6, 0.8],
    speeds = [0.004, 0.0027, 0.0021, 0.0016];
  const star = new T.Mesh(
    new T.SphereGeometry(57, 48, 32),
    new T.MeshBasicMaterial({
      color: new T.Color(5, 2.65, 0.62),
      toneMapped: false,
    }),
  );
  // Warm-white sunlight keeps oceans blue; the corona supplies the orange.
  const sunlight = new T.PointLight('#fff2e0', 4, 0, 0);
  root.add(star, sunlight);
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 256;
  const glowContext = glowCanvas.getContext('2d')!;
  const glow = glowContext.createRadialGradient(128, 128, 20, 128, 128, 128);
  glow.addColorStop(0, '#fff4bdcc');
  glow.addColorStop(0.28, '#ffc25799');
  glow.addColorStop(0.55, '#ff891e28');
  glow.addColorStop(1, '#ff600000');
  glowContext.fillStyle = glow;
  glowContext.fillRect(0, 0, 256, 256);
  const corona = new T.Sprite(
    new T.SpriteMaterial({
      map: new T.CanvasTexture(glowCanvas),
      blending: T.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  corona.scale.set(390, 390, 1);
  root.add(corona);
  // A wide, faint outer glow replaces post-process bloom (which tinted planets).
  const halo = new T.Sprite(
    new T.SpriteMaterial({
      map: corona.material.map,
      color: '#ffb35c',
      blending: T.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      opacity: 0.35,
    }),
  );
  halo.scale.set(900, 900, 1);
  root.add(halo);
  const coreCanvas = document.createElement('canvas');
  coreCanvas.width = coreCanvas.height = 256;
  const coreContext = coreCanvas.getContext('2d')!;
  const coreGradient = coreContext.createRadialGradient(128, 128, 0, 128, 128, 128);
  coreGradient.addColorStop(0, '#ffffffff');
  coreGradient.addColorStop(0.35, '#fff6d8f0');
  coreGradient.addColorStop(0.5, '#ffd68a80');
  coreGradient.addColorStop(1, '#ff9a3000');
  coreContext.fillStyle = coreGradient;
  coreContext.fillRect(0, 0, 256, 256);
  const core = new T.Sprite(
    new T.SpriteMaterial({
      map: new T.CanvasTexture(coreCanvas),
      blending: T.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  core.scale.set(175, 175, 1);
  root.add(core);
  // The glowing billboard is the visible disc; the sphere stays as the light anchor.
  star.visible = false;
  orbitRadii.forEach((radius) => {
    const curve = new T.EllipseCurve(
      0,
      0,
      radius,
      radius,
      0,
      Math.PI * 2,
      false,
      0,
    );
    const geometry = new T.BufferGeometry().setFromPoints(
      curve.getPoints(180).map((p) => new T.Vector3(p.x, 0, p.y)),
    );
    root.add(
      new T.LineLoop(
        geometry,
        new T.LineBasicMaterial({
          color: '#526b91',
          transparent: true,
          opacity: 0.35,
        }),
      ),
    );
  });
  const stars = new Float32Array(900 * 3);
  for (let i = 0; i < 900; i++) {
    const a = i * 2.39996,
      y = 1 - (2 * (i + 0.5)) / 900,
      r = Math.sqrt(1 - y * y);
    stars.set(
      [Math.cos(a) * r * 2100, y * 2100, Math.sin(a) * r * 2100],
      i * 3,
    );
  }
  const sg = new T.BufferGeometry();
  sg.setAttribute('position', new T.BufferAttribute(stars, 3));
  root.add(
    new T.Points(
      sg,
      new T.PointsMaterial({
        color: '#d8efff',
        size: 2.1,
        sizeAttenuation: true,
      }),
    ),
  );
  PLANETS.forEach((planet, index) => {
    const boards = BOARDS.filter((b) => b.planet === planet.id),
      group = new T.Group();
    group.position.set(
      Math.cos(phases[index]) * orbitRadii[index],
      0,
      Math.sin(phases[index]) * orbitRadii[index],
    );
    group.scale.setScalar(sizes[index]);
    root.add(group);
    worlds.push(group);
    const radius = 106;
    const globe = createGlobe(planet.id, radius);
    group.add(globe.group);
    globes.push(globe);
    const anchors = [
      new T.Vector3(-0.54, 0.45, 0.72).normalize(),
      new T.Vector3(0.56, 0.38, 0.74).normalize(),
      new T.Vector3(0, -0.43, 0.9).normalize(),
    ];
    boards.forEach((board, j) => {
      boardTargets.set(board.id, { group, normal: anchors[j] });
      const normal = anchors[j],
        right = new T.Vector3()
          .crossVectors(new T.Vector3(0, 1, 0), normal)
          .normalize(),
        up = new T.Vector3().crossVectors(normal, right).normalize();
      const project = (x: number, z: number, height = 0) =>
        normal
          .clone()
          .multiplyScalar(radius)
          .addScaledVector(right, (x / board.radius) * 37)
          .addScaledVector(up, (-z / board.radius) * 37)
          .normalize()
          .multiplyScalar(radius + height);
      // Landing beacon: a glowing ring on the surface and a soft light pillar.
      const beacon = new T.Group();
      beacon.position.copy(project(0, 0, 0.6));
      beacon.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), normal);
      const ring = new T.Mesh(
        new T.TorusGeometry(9, 0.7, 8, 64),
        new T.MeshBasicMaterial({
          color: board.id === boardId ? '#daffa2' : board.accent,
          toneMapped: false,
        }),
      );
      ring.rotation.x = Math.PI / 2;
      const pillar = new T.Mesh(
        new T.CylinderGeometry(4, 8, 14, 24, 1, true),
        new T.MeshBasicMaterial({
          color: board.accent,
          transparent: true,
          opacity: 0.12,
          blending: T.AdditiveBlending,
          depthWrite: false,
          side: T.DoubleSide,
        }),
      );
      pillar.position.y = 7;
      beacon.add(ring, pillar);
      group.add(beacon);
      beacons.push(ring);
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 96;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#06111bea';
      ctx.roundRect(8, 8, 496, 80, 24);
      ctx.fill();
      ctx.strokeStyle = board.accent;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = '#f2fff1';
      ctx.font = 'bold 34px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(board.name, 256, 50);
      const label = new T.Sprite(
        new T.SpriteMaterial({ map: new T.CanvasTexture(c), depthTest: false }),
      );
      label.position.copy(project(0, board.radius * 0.8, 9));
      label.scale.set(48, 9, 1);
      group.add(label);
      labels.push(label);
    });
  });
  return {
    root,
    destination(id: string) {
      const entry = boardTargets.get(id)!;
      root.updateMatrixWorld(true);
      const center = entry.group.localToWorld(
        entry.normal.clone().multiplyScalar(107),
      );
      const normal = entry.normal
        .clone()
        .transformDirection(entry.group.matrixWorld);
      return { center, position: center.clone().addScaledVector(normal, 125) };
    },
    draw: (
      time: number,
      reduced: boolean,
      titleScreen = false,
      brightness = 0.55,
    ) => {
      star.material.color.setRGB(
        0.8 + brightness * 4.2,
        0.6 + brightness * 2.05,
        0.3 + brightness * 0.32,
      );
      corona.material.opacity = brightness;
      halo.material.opacity = brightness * 0.55;
      sunlight.intensity = 1.5 + brightness * 2.5;
      life.draw(time, reduced);
      labels.forEach((label) => {
        label.visible = !titleScreen;
      });
      worlds.forEach((g, i) => {
        const phase =
          phases[i] + (reduced ? 0 : time * speeds[i]);
        g.position.set(
          Math.cos(phase) * orbitRadii[i],
          0,
          Math.sin(phase) * orbitRadii[i],
        );
        g.rotation.y = reduced ? 0 : time * 0.007;
      });
      globes.forEach((globe) => globe.update(time, reduced, star));
      beacons.forEach((ring, i) => {
        ring.scale.setScalar(reduced ? 1 : 1 + Math.sin(time * 2.4 + i) * 0.08);
      });
    },
  };
}
