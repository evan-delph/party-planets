import * as T from 'three';
import { BOARDS, PLANETS, getBoard } from './boards';
import { SPACE_INFO } from './config';
import { terrainMaterial } from './Surfaces';
import { createSpaceLife } from './SpaceLife';

export function createPlanetarium(parent: T.Object3D, boardId: string) {
  const root = new T.Group();
  parent.add(root);
  const life = createSpaceLife(root);
  const boardTargets = new Map<string, { group: T.Group; normal: T.Vector3 }>();
  const worlds: T.Group[] = [],
    labels: T.Object3D[] = [];
  const orbitRadii = [245, 385, 540],
    phases = [2.7, 5.5, 0.7];
  const star = new T.Mesh(
    new T.SphereGeometry(57, 48, 32),
    new T.MeshBasicMaterial({
      color: new T.Color(5, 2.65, 0.62),
      toneMapped: false,
    }),
  );
  const sunlight = new T.PointLight('#ffd5a0', 4, 0, 0);
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
    group.scale.setScalar([0.7, 0.48, 0.78][index]);
    root.add(group);
    worlds.push(group);
    const radius = 106,
      base = boards[0];
    const globe = new T.Mesh(
      new T.SphereGeometry(radius, 80, 48),
      terrainMaterial(
        planet.id === 'earth' ? '#225d8d' : base.edge,
        base.terrain,
        10,
      ),
    );
    group.add(globe);
    const shell = new T.Mesh(
      new T.SphereGeometry(radius * 1.025, 48, 32),
      new T.MeshBasicMaterial({
        color: base.accent,
        transparent: true,
        opacity: 0.08,
        side: T.BackSide,
        depthWrite: false,
      }),
    );
    group.add(shell);
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
      const patch = new T.RingGeometry(0, 1, 64, 14);
      const pos = patch.getAttribute('position');
      for (let k = 0; k < pos.count; k++) {
        const angle = Math.atan2(pos.getY(k), pos.getX(k)),
          coast =
            1.1 +
            0.065 * Math.sin(angle * 5 + j) +
            0.035 * Math.cos(angle * 9 - j);
        const p = project(
          pos.getX(k) * board.radius * coast,
          pos.getY(k) * board.radius * 0.86 * coast,
          0.5,
        );
        pos.setXYZ(k, p.x, p.y, p.z);
      }
      const indices = patch.getIndex()!;
      for (let k = 0; k < indices.count; k += 3) {
        const a = indices.getX(k);
        indices.setX(k, indices.getX(k + 2));
        indices.setX(k + 2, a);
      }
      patch.computeVertexNormals();
      group.add(
        new T.Mesh(patch, terrainMaterial(board.ground, board.terrain, 6)),
      );
      const road: number[] = [];
      board.spaces.forEach((n) =>
        n.next.forEach((id) => {
          const b = board.spaces[id];
          const a1 = project(n.x, n.z, 0.7),
            b1 = project(b.x, b.z, 0.7);
          road.push(...a1.toArray(), ...b1.toArray());
        }),
      );
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(road, 3));
      group.add(
        new T.LineSegments(
          g,
          new T.LineBasicMaterial({
            color: board.id === boardId ? '#daffa2' : '#fff5c6',
          }),
        ),
      );
      const tiles = new T.InstancedMesh(
          new T.SphereGeometry(0.34, 5, 4),
          new T.MeshBasicMaterial({ color: '#ffffff' }),
          board.spaces.length,
        ),
        d = new T.Object3D();
      board.spaces.forEach((n, i) => {
        d.position.copy(project(n.x, n.z, 1));
        d.updateMatrix();
        tiles.setMatrixAt(i, d.matrix);
        tiles.setColorAt(i, new T.Color(SPACE_INFO[n.type].color));
      });
      group.add(tiles);
      const marker = new T.Mesh(
        new T.OctahedronGeometry(2.1),
        new T.MeshStandardMaterial({
          color: board.accent,
          emissive: board.accent,
          emissiveIntensity: 0.8,
        }),
      );
      marker.position.copy(project(board.landmark.x, board.landmark.z, 3));
      group.add(marker);
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
    if (planet.id === 'selene')
      for (let i = 0; i < 26; i++) {
        const n = new T.Vector3(
          Math.sin(i * 2.4),
          Math.cos(i * 1.7),
          Math.sin(i * 0.63),
        ).normalize();
        if (anchors.some((a) => a.dot(n) > 0.89)) continue;
        const ring = new T.Mesh(
          new T.TorusGeometry(3 + (i % 4) * 1.8, 0.9, 6, 28),
          new T.MeshStandardMaterial({ color: '#8b8b9d', roughness: 1 }),
        );
        ring.position.copy(n.clone().multiplyScalar(radius));
        ring.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), n);
        group.add(ring);
        const bowl = new T.Mesh(
          new T.CircleGeometry(2.8 + (i % 4) * 1.8, 28),
          new T.MeshStandardMaterial({ color: '#414553', roughness: 1 }),
        );
        bowl.position.copy(n.clone().multiplyScalar(radius + 0.15));
        bowl.quaternion.copy(ring.quaternion);
        group.add(bowl);
      }
    if (planet.id === 'verdara') {
      const ring = new T.Mesh(
        new T.RingGeometry(140, 153, 100),
        new T.MeshBasicMaterial({
          color: '#ce7dba',
          side: T.DoubleSide,
          transparent: true,
          opacity: 0.35,
          depthWrite: false,
        }),
      );
      ring.rotation.x = 1.05;
      ring.rotation.y = 0.25;
      group.add(ring);
    }
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
      sunlight.intensity = 1.5 + brightness * 2.5;
      life.draw(time, reduced);
      labels.forEach((label) => {
        label.visible = !titleScreen;
      });
      worlds.forEach((g, i) => {
        const phase =
          phases[i] + (reduced ? 0 : time * [0.004, 0.0027, 0.0018][i]);
        g.position.set(
          Math.cos(phase) * orbitRadii[i],
          0,
          Math.sin(phase) * orbitRadii[i],
        );
        g.rotation.y = reduced ? 0 : time * 0.007;
      });
    },
  };
}
