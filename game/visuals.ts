import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { surfaceTexture } from './Surfaces';
export class WorldKit {
  root = new T.Group();
  materials = new Map<string, T.MeshStandardMaterial>();
  grain = surfaceTexture('stone', 128);
  constructor(scene: T.Object3D) {
    scene.add(this.root);
  }
  mat(color: string) {
    if (!this.materials.has(color))
      this.materials.set(
        color,
        new T.MeshStandardMaterial({
          color,
          roughness: 0.75,
          bumpMap: this.grain,
          bumpScale: 0.035,
        }),
      );
    return this.materials.get(color)!;
  }
  mesh(
    geo: T.BufferGeometry,
    c: string,
    x = 0,
    y = 0,
    z = 0,
    parent: T.Object3D = this.root,
  ) {
    const m = new T.Mesh(geo, this.mat(c));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  box(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    c: string,
    parent?: T.Object3D,
  ) {
    return this.mesh(new T.BoxGeometry(w, h, d), c, x, y, z, parent);
  }
  rock(x: number, z: number, size = 1, color = '#799381') {
    const m = this.mesh(
      new T.DodecahedronGeometry(size, 0),
      color,
      x,
      size * 0.45,
      z,
    );
    m.rotation.set(x * 0.7, 0, z * 0.4);
    m.scale.y = 0.7;
    return m;
  }
  tree(x: number, z: number, kind = 'palm', size = 1) {
    const g = new T.Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(size);
    this.root.add(g);
    this.mesh(
      new T.CylinderGeometry(0.12, 0.23, 3, 6),
      '#866344',
      0,
      1.5,
      0,
      g,
    );
    if (kind === 'pine') {
      for (let i = 0; i < 3; i++) {
        this.mesh(
          new T.ConeGeometry(1.2 - i * 0.25, 1.8, 7),
          '#507e73',
          0,
          2 + i * 0.7,
          0,
          g,
        );
        this.mesh(
          new T.ConeGeometry(1.02 - i * 0.25, 1.5, 7),
          '#dcebf0',
          0,
          2.3 + i * 0.7,
          0,
          g,
        );
      }
    } else if (kind === 'mushroom') {
      this.mesh(
        new T.SphereGeometry(1, 12, 6),
        '#ab79be',
        0,
        2.6,
        0,
        g,
      ).scale.set(1.6, 0.4, 1.6);
      for (let i = 0; i < 5; i++)
        this.mesh(
          new T.SphereGeometry(0.14, 6, 4),
          '#f9e7c2',
          Math.cos(i * 1.25) * 0.9,
          2.95,
          Math.sin(i * 1.25) * 0.9,
          g,
        );
    } else if (kind === 'jungle') {
      for (let i = 0; i < 4; i++)
        this.mesh(
          new T.IcosahedronGeometry(1.3, 0),
          i % 2 ? '#3d886c' : '#63ac70',
          Math.cos(i * 1.57) * 0.55,
          3,
          Math.sin(i * 1.57) * 0.55,
          g,
        );
    } else {
      for (let i = 0; i < 7; i++) {
        const a = (i * Math.PI * 2) / 7,
          m = this.mesh(
            new T.SphereGeometry(1, 8, 4),
            i % 2 ? '#3ba575' : '#65bc75',
            Math.cos(a) * 0.65,
            3.1,
            Math.sin(a) * 0.65,
            g,
          );
        m.scale.set(0.27, 0.1, 1.6);
        m.rotation.y = -a + Math.PI / 2;
      }
    }
    return g;
  }
  hut(x: number, z: number, color = '#e7c477', snow = false) {
    const g = new T.Group();
    g.position.set(x, 0, z);
    this.root.add(g);
    this.box(0, 1, 0, 2.5, 2, 2.2, color, g);
    this.mesh(
      new T.ConeGeometry(2.15, 1.4, 4),
      snow ? '#f1f6ed' : '#b46d57',
      0,
      2.55,
      0,
      g,
    ).rotation.y = Math.PI / 4;
    this.box(0, 0.6, 1.12, 0.6, 1.2, 0.07, '#345764', g);
    for (const x of [-1.18, 1.18])
      this.box(x, 1.1, 1.15, 0.12, 2.15, 0.13, '#dbc99b', g);
    this.box(0, 0.2, 1.38, 1.1, 0.22, 0.6, '#938777', g);
    for (let j = 0; j < 5; j++)
      this.box(0, 0.22 + j * 0.34, 1.14, 2.45, 0.025, 0.045, '#95704d', g);
    for (const x of [-0.8, 0.8])
      this.box(x, 1.2, 1.14, 0.5, 0.6, 0.08, '#ffdb75', g);
    return g;
  }
  arch(x: number, z: number, color = '#d2b697') {
    for (const side of [-1, 1])
      this.box(x + side * 1.8, 2, z, 0.8, 4, 0.9, color);
    this.box(x, 4, z, 4.5, 0.9, 1, color);
  }
  // Static props share a few draw calls instead of one call for every leaf or tile.
  bake() {
    this.root.updateMatrixWorld(true);
    const batches = new Map<T.Material, T.BufferGeometry[]>();
    this.root.traverse((o) => {
      if (!(o instanceof T.Mesh) || Array.isArray(o.material)) return;
      const geo = o.geometry.index
        ? o.geometry.toNonIndexed()
        : o.geometry.clone();
      geo.applyMatrix4(o.matrixWorld);
      if (!batches.has(o.material)) batches.set(o.material, []);
      batches.get(o.material)!.push(geo);
      o.geometry.dispose();
    });
    this.root.clear();
    for (const [mat, geos] of batches) {
      const merged = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (merged) {
        const m = new T.Mesh(merged, mat);
        m.castShadow = true;
        m.receiveShadow = true;
        this.root.add(m);
      }
    }
  }
}
export function disposeObject(obj: T.Object3D) {
  const geometries = new Set<T.BufferGeometry>(),
    materials = new Set<T.Material>();
  obj.traverse((o) => {
    if (o instanceof T.Mesh || o instanceof T.Line || o instanceof T.Points)
      geometries.add(o.geometry);
    if (
      o instanceof T.Mesh ||
      o instanceof T.Sprite ||
      o instanceof T.Line ||
      o instanceof T.Points
    )
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        materials.add(m);
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => {
    for (const key of [
      'map',
      'bumpMap',
      'normalMap',
      'roughnessMap',
      'metalnessMap',
    ])
      if (key in m)
        (m as unknown as Record<string, T.Texture | null>)[key]?.dispose();
    m.dispose();
  });
}
export function performanceMeter(
  renderer: T.WebGLRenderer,
  root: HTMLElement,
  label: string,
) {
  const chip = document.createElement('div');
  chip.className = 'performance-chip';
  chip.setAttribute('role', 'status');
  root.appendChild(chip);
  let start = performance.now(),
    frames = 0,
    slow = 0,
    adapted = false;
  const samples: number[] = [];
  const renderSamples: number[] = [];
  return {
    frame(now: number, ms: number, renderMs = ms) {
      if (document.hidden || !document.hasFocus()) {
        slow = 0;
        chip.textContent = 'Window inactive';
        chip.title =
          'Background frame throttling is excluded from graphics adjustment.';
        delete chip.dataset.fps;
        delete chip.dataset.p95;
        start = now;
        frames = 0;
        samples.length = 0;
        renderSamples.length = 0;
        return;
      }
      frames++;
      samples.push(ms);
      renderSamples.push(renderMs);
      if (now - start < 3000) return;
      const fps = (frames * 1000) / (now - start);
      const sorted = samples.sort((a, b) => a - b),
        p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
      // Embedded browsers can throttle an occluded page without changing visibility or focus.
      const frameLimited =
        fps < 10 &&
        samples.filter((v) => v > 800 && v < 1300).length >= 2 &&
        samples.filter((v) => v > 800 && v < 1300).reduce((a, b) => a + b, 0) /
          samples.reduce((a, b) => a + b, 0) >
          0.8 &&
        renderSamples.every((v) => v < 50);
      slow = fps < 38 && !frameLimited ? slow + 1 : 0;
      if (slow >= 2 && renderer.getPixelRatio() > 0.76) {
        renderer.setPixelRatio(Math.max(0.75, renderer.getPixelRatio() * 0.8));
        adapted = true;
      }
      if (slow >= 3) {
        renderer.shadowMap.enabled = false;
        adapted = true;
        window.dispatchEvent(
          new CustomEvent('sp-performance-slow', {
            detail: { fps: Math.round(fps), label },
          }),
        );
        slow = 0;
      }
      chip.textContent = `${Math.round(fps)} FPS · ${frameLimited ? 'Frame delivery limited' : adapted ? 'Adaptive detail' : fps < 30 ? 'Running slowly' : fps < 45 ? 'Moderate load' : 'Smooth'}`;
      chip.setAttribute(
        'title',
        `${frameLimited ? 'Browser is supplying about one frame a second despite quick rendering; this commonly occurs in inactive windows. ' : ''}${label} · 95th percentile frame ${Math.round(p95)} ms · ${renderer.info.render.calls} draw calls · ${renderer.info.render.triangles} triangles`,
      );
      chip.dataset.fps = String(Math.round(fps));
      chip.dataset.p95 = String(Math.round(p95));
      start = now;
      frames = 0;
      samples.length = 0;
      renderSamples.length = 0;
    },
    dispose() {
      chip.remove();
    },
  };
}
