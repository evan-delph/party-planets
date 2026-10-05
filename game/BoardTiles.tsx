import * as T from 'three';
import { renderToStaticMarkup } from 'react-dom/server';
import { SPACE_INFO, type Space, type SpaceKind } from './config';
import { SPACE_GLYPH } from './art';

/**
 * Board spaces as glossy enamel discs set into a bevelled plinth, with the
 * HUD's own glyphs printed on top. Every space shares three instanced draws
 * (plinth, enamel, glyph); glyphs come from one atlas picked per instance.
 */
const KINDS = Object.keys(SPACE_INFO) as SpaceKind[];
const CELLS = 4,
  CELL = 256;
const TOP = 0.955;

/** Linear size of a space relative to the original 0.98-radius token. */
const SIZE = 1.27;

/**
 * Board tokens use deeper, punchier versions of the HUD colours so every
 * space type reads at a glance against the pale road.
 */
const TOKEN: Partial<Record<SpaceKind, string>> = {
  blue: '#1784ff',
  red: '#ff2f45',
  lucky: '#ffc21a',
  event: '#8f45ff',
  shop: '#14d29a',
  bank: '#ffcf2e',
  lottery: '#ff5fd2',
  hazard: '#ff6a1f',
  spring: '#1fd6c4',
  portal: '#4f7dff',
  thief: '#b25cff',
  villain: '#3b2560',
  switch: '#ff8f6b',
  start: '#ffffff',
};

const PLINTH: Record<string, { color: string; metalness: number; roughness: number; glow: number; rim: number }> = {
  crown: { color: '#efe2c4', metalness: 0.05, roughness: 0.4, glow: 0.08, rim: 0.85 },
  crater: { color: '#b7c1d6', metalness: 0.6, roughness: 0.32, glow: 0.28, rim: 0.6 },
  fissure: { color: '#3b3036', metalness: 0.35, roughness: 0.42, glow: 0.3, rim: 0.5 },
  coral: { color: '#f4e7f2', metalness: 0.05, roughness: 0.38, glow: 0.07, rim: 0.85 },
};

function glyphAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = CELLS * CELL;
  const ctx = canvas.getContext('2d')!;
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  KINDS.forEach((kind, i) => {
    const x = (i % CELLS) * CELL,
      y = Math.floor(i / CELLS) * CELL;
    // Text stand-in until the vector glyph has rasterised.
    const mark = SPACE_INFO[kind].mark;
    ctx.font = `900 ${mark.length > 3 ? 64 : mark.length > 1 ? 104 : 150}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#1b2440';
    ctx.strokeText(mark, x + CELL / 2, y + CELL / 2 + 6);
    ctx.fillStyle = '#fff';
    ctx.fillText(mark, x + CELL / 2, y + CELL / 2 + 6);
    const glyph = SPACE_GLYPH[kind];
    if (!glyph) return;
    const svg = renderToStaticMarkup(
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="5 5 22 22" width={CELL} height={CELL}>
        {glyph}
      </svg>,
    );
    const image = new Image();
    image.onload = () => {
      ctx.clearRect(x, y, CELL, CELL);
      ctx.save();
      ctx.shadowColor = 'rgba(10,20,40,0.55)';
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 6;
      ctx.drawImage(image, x + 18, y + 18, CELL - 36, CELL - 36);
      ctx.restore();
      texture.needsUpdate = true;
    };
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
  return texture;
}

export function createBoardTiles(world: T.Object3D, boardId: string, nodes: Space[]) {
  const style = PLINTH[boardId] ?? PLINTH.crown;
  const root = new T.Group();
  world.add(root);
  const count = nodes.length;

  // Bevelled plinth with a lip the enamel sits inside.
  const plinthGeo = new T.LatheGeometry(
    [
      [0, 0],
      [0.9, 0],
      [0.97, 0.05],
      [0.98, 0.15],
      [0.95, 0.2],
      [0.86, 0.215],
      [0.8, 0.2],
      [0, 0.2],
    ].map(([r, y]) => new T.Vector2(r * SIZE, y)),
    48,
  );
  plinthGeo.translate(0, TOP - 0.245, 0);
  const plinthMat = new T.MeshStandardMaterial({
    color: '#ffffff',
    metalness: style.metalness,
    roughness: style.roughness,
  });
  const plinth = new T.InstancedMesh(plinthGeo, plinthMat, count);
  plinth.receiveShadow = plinth.castShadow = true;

  // Slightly domed enamel face, coloured per space, with a soft self-glow.
  const enamelGeo = new T.LatheGeometry(
    // Rim to centre, so the lathe's faces point up.
    [
      [0.8, 0],
      [0.79, 0.012],
      [0.7, 0.028],
      [0.4, 0.04],
      [0, 0.045],
    ].map(([r, y]) => new T.Vector2(r * SIZE, y)),
    48,
  );
  enamelGeo.translate(0, TOP - 0.05, 0);
  const enamelMat = new T.MeshPhysicalMaterial({
    roughness: 0.4,
    clearcoat: 0.55,
    clearcoatRoughness: 0.1,
    envMapIntensity: 0.25,
  });
  enamelMat.onBeforeCompile = (shader) => {
    shader.uniforms.glow = { value: style.glow };
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform float glow;\nvoid main() {')
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n#ifdef USE_INSTANCING_COLOR\ntotalEmissiveRadiance += vColor.rgb * glow;\n#endif',
      );
  };
  const enamel = new T.InstancedMesh(enamelGeo, enamelMat, count);
  enamel.receiveShadow = true;

  // Glyph decals from the atlas.
  const atlas = glyphAtlas();
  const glyphGeo = new T.PlaneGeometry(1.08 * SIZE, 1.08 * SIZE);
  glyphGeo.rotateX(-Math.PI / 2);
  glyphGeo.translate(0, TOP + 0.004, 0);
  const cells = new Float32Array(count);
  glyphGeo.setAttribute('cell', new T.InstancedBufferAttribute(cells, 1));
  const glyphMat = new T.MeshBasicMaterial({
    map: atlas,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  glyphMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'attribute float cell;\nvoid main() {')
      .replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
        vMapUv = (vMapUv + vec2(mod(cell, ${CELLS}.0), ${CELLS - 1}.0 - floor(cell / ${CELLS}.0))) / ${CELLS}.0;`,
      );
  };
  const glyphs = new T.InstancedMesh(glyphGeo, glyphMat, count);
  glyphs.renderOrder = 2;

  const dummy = new T.Object3D(),
    base = nodes.map((n) => new T.Color(TOKEN[n.type] ?? SPACE_INFO[n.type]?.color ?? '#cccccc')),
    plinthBase = base.map((c, i) => {
      // A deeper shade of the token's own hue frames it against the road.
      const hsl = { h: 0, s: 0, l: 0 };
      c.getHSL(hsl);
      const rim = new T.Color().setHSL(hsl.h, Math.min(1, hsl.s * 0.95), hsl.l * 0.52);
      if (nodes[i].type === 'start') rim.set('#c9a24a');
      return new T.Color(style.color).lerp(rim, style.rim);
    });
  nodes.forEach((n, i) => {
    dummy.position.set(n.x, 0, n.z);
    dummy.updateMatrix();
    plinth.setMatrixAt(i, dummy.matrix);
    enamel.setMatrixAt(i, dummy.matrix);
    glyphs.setMatrixAt(i, dummy.matrix);
    enamel.setColorAt(i, base[i]);
    plinth.setColorAt(i, plinthBase[i]);
    glyphs.setColorAt(i, new T.Color('#ffffff'));
    cells[i] = Math.max(0, KINDS.indexOf(n.type));
  });
  root.add(plinth, enamel, glyphs);

  const dim = new Float32Array(count),
    grey = new T.Color('#5d6676'),
    tmp = new T.Color();
  let facing = 0;
  return {
    root,
    /** Turn every glyph upright for a camera at this azimuth (radians). */
    face(yaw: number) {
      if (Math.abs(Math.atan2(Math.sin(yaw - facing), Math.cos(yaw - facing))) < 0.03) return;
      facing = yaw;
      nodes.forEach((n, i) => {
        dummy.position.set(n.x, 0, n.z);
        dummy.rotation.set(0, yaw, 0);
        dummy.updateMatrix();
        glyphs.setMatrixAt(i, dummy.matrix);
      });
      glyphs.instanceMatrix.needsUpdate = true;
    },
    /** Fade spaces (0 = normal, 1 = closed and greyed out). */
    setDim(ids: number[], amount: number) {
      let changed = false;
      for (const id of ids) {
        if (Math.abs(dim[id] - amount) < 0.004) continue;
        dim[id] = amount;
        changed = true;
        enamel.setColorAt(id, tmp.copy(base[id]).lerp(grey, amount * 0.75).multiplyScalar(1 - amount * 0.35));
        plinth.setColorAt(id, tmp.copy(plinthBase[id]).lerp(grey, amount * 0.6).multiplyScalar(1 - amount * 0.3));
        glyphs.setColorAt(id, tmp.setScalar(1 - amount * 0.55));
      }
      if (changed) {
        enamel.instanceColor!.needsUpdate = true;
        plinth.instanceColor!.needsUpdate = true;
        glyphs.instanceColor!.needsUpdate = true;
      }
    },
    dispose() {
      root.removeFromParent();
      [plinthGeo, enamelGeo, glyphGeo, plinthMat, enamelMat, glyphMat, atlas].forEach((d) => d.dispose());
    },
  };
}
