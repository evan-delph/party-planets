// Export board layouts for the Blender scenery builder (art/blender/board.py).
// Usage: node scripts/test-loader.cjs scripts/export-boards.ts
// Coordinates stay in three.js board space (x right, z toward the camera).
import { mkdirSync, writeFileSync } from 'node:fs';
import { BOARDS } from '../game/boards';

mkdirSync('art/boards', { recursive: true });
for (const board of BOARDS) {
  const p = (id: number) => [board.spaces[id].x, board.spaces[id].z];
  const layout = {
    id: board.id,
    name: board.name,
    planet: board.planet,
    gimmick: board.gimmick,
    radius: board.radius,
    colors: {
      ground: board.ground,
      edge: board.edge,
      water: board.water,
      sky: board.sky,
      accent: board.accent,
    },
    spaces: board.spaces.map((s) => ({
      id: s.id,
      x: s.x,
      z: s.z,
      type: s.type,
      next: s.next,
      miniNext: s.miniNext ?? [],
    })),
    // Each road as an ordered polyline: junction → its spaces → junction.
    roads: board.districtRoads.map((r) => ({
      name: r.name,
      branch: board.routeLabels[r.from]?.indexOf(r.name) > 0,
      points: [p(r.from), ...r.spaceIds.map(p), p(r.to)],
      spaceIds: r.spaceIds,
    })),
    landmark: [board.landmark.x, board.landmark.z],
    districts: board.districts.map((d) => ({ name: d.name, kind: d.kind, x: d.x, z: d.z })),
    water: board.waterFeatures,
  };
  writeFileSync(`art/boards/${board.id}.json`, JSON.stringify(layout, null, 1));
  console.log(`art/boards/${board.id}.json`, board.spaces.length, 'spaces');
}
