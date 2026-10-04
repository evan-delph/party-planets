import type { Space, SpaceKind } from './config';

export const PLANETS = [
  {
    id: 'earth',
    name: 'Earth',
    colors: ['#55bed4', '#78ae6a', '#e7cca5'],
    description:
      'The visitors’ first holiday stop: a tropical archipelago of harbors, reefs and a grumbling volcano.',
    boardIds: ['crown'],
  },
  {
    id: 'selene',
    name: 'Selene',
    colors: ['#a5adc6', '#615a99', '#d4e4ff'],
    description:
      'A cratered moon of quiet impact basins, survey bridges and low-gravity jump pads.',
    boardIds: ['crater'],
  },
  {
    id: 'ignara',
    name: 'Ignara',
    colors: ['#3a2226', '#ff7a2e', '#ffd27a'],
    description:
      'A molten world of basalt plates, glowing rivers and a volcano that never sleeps.',
    boardIds: ['fissure'],
  },
  {
    id: 'verdara',
    name: 'Verdara',
    colors: ['#64b7a4', '#a874bd', '#ffc4ec'],
    description:
      'A pastel sky world of floating coral reefs, mist islands and drifting cloud ferries.',
    boardIds: ['coral'],
  },
] as const;
export type PlanetId = (typeof PLANETS)[number]['id'];
export function getPlanet(id?: string) {
  return PLANETS.find((p) => p.id === id) ?? PLANETS[0];
}

/** Retired v0.7 boards map to their closest v0.8 replacement for old saves and links. */
export const RETIRED_BOARDS: Record<string, string> = {
  alpine: 'crown',
  moss: 'crown',
  crystal: 'crater',
  lumen: 'coral',
  dunes: 'coral',
};

/** Each board's signature mechanic, driven by the round number. */
export type Gimmick = 'tide' | 'jumppads' | 'eruption' | 'ferry';

export const BOARD_THEMES = [
  {
    id: 'crown' as string,
    name: 'Crown Cay',
    ecosystem: 'Tropical archipelago',
    description:
      'Hop the islands from Sunset Harbor past coconut coves, a smoking volcano and the coral lighthouse. At low tide the Lagoon Footbridge opens a shortcut across the bay.',
    gimmick: 'tide' as Gimmick,
    gimmickName: 'Tides',
    gimmickRule:
      'Every other round the tide drops and the Lagoon Footbridge opens.',
    ground: '#77b975',
    edge: '#e6c38d',
    water: '#22aebb',
    sky: '#a7e5e7',
    hazard: 'Volcano eruption',
    loss: 8,
    reward: 'Tide-pool treasure',
    icon: 'VOLCANO',
    planet: 'earth',
    terrain: 'grass',
    accent: '#ffe1a3',
    globalEvent: {
      id: 'eruption' as string,
      name: 'Fireflower Eruption',
      description:
        'The volcano launches molten fragments and a bright pressure ring across Crown Cay; nearby players lose up to 20 points, with losses decreasing by distance.',
      color: '#ffac56',
      maxLoss: 20,
      radiusFactor: 1.4,
    },
  },
  {
    id: 'crater' as string,
    name: 'Moonwake Basin',
    planet: 'selene',
    terrain: 'crater',
    ecosystem: 'Crater desert & regolith plains',
    description:
      'Circle two impact basins on survey bridges and rim roads. Low-gravity jump pads fling explorers across the craters — not always forward.',
    gimmick: 'jumppads' as Gimmick,
    gimmickName: 'Jump pads',
    gimmickRule:
      'Land on a jump pad to bounce to the next pad around the basin.',
    ground: '#87909f',
    edge: '#555e74',
    water: '#323d64',
    sky: '#111a38',
    accent: '#dacdff',
    hazard: 'Meteor impact',
    loss: 8,
    reward: 'Moonstone cache',
    icon: 'METEOR',
    globalEvent: {
      id: 'meteor' as string,
      name: 'Meteor Shower',
      description:
        'A bright meteor strikes the main impact basin; ejecta rings sweep outward and remove up to 20 points, with less damage farther from impact.',
      color: '#b8d4ff',
      maxLoss: 20,
      radiusFactor: 1.4,
    },
  },
  {
    id: 'fissure' as string,
    name: 'Emberfault Reach',
    planet: 'ignara',
    terrain: 'fissure',
    ecosystem: 'Lava rivers & obsidian ridges',
    description:
      'Cross catwalks over a live volcano, trade at the magma market and soak in the hot springs. Every third round the volcano erupts and the Lava Bridge melts away.',
    gimmick: 'eruption' as Gimmick,
    gimmickName: 'Eruptions',
    gimmickRule:
      'Every third round the volcano erupts and the Lava Bridge closes.',
    ground: '#675773',
    edge: '#3f354e',
    water: '#ff783d',
    sky: '#271e3f',
    accent: '#ffc071',
    hazard: 'Steam blowout',
    loss: 8,
    reward: 'Thermal crystal',
    icon: 'VENT',
    globalEvent: {
      id: 'geyser' as string,
      name: 'Mantle Blowout',
      description:
        'A towering geyser erupts from the pressure well and a ring of glowing steam travels over the terrain, removing up to 20 points with distance falloff.',
      color: '#ffb36a',
      maxLoss: 20,
      radiusFactor: 1.4,
    },
  },
  {
    id: 'coral' as string,
    name: 'Nimbus Reef',
    planet: 'verdara',
    terrain: 'coral',
    ecosystem: 'Floating coral reefs & mist islands',
    description:
      'Wander shell villages, windmill reefs and kite-strewn kelp beds floating above the clouds. A cloud ferry docks at Mist Islands every other round.',
    gimmick: 'ferry' as Gimmick,
    gimmickName: 'Cloud ferry',
    gimmickRule:
      'Every other round the cloud ferry docks, opening a ride to the Storm Eye.',
    ground: '#80c7ba',
    edge: '#4d8fa1',
    water: '#7462bf',
    sky: '#9fb8d4',
    accent: '#ffb7e4',
    hazard: 'Tidal surge',
    loss: 7,
    reward: 'Sky-pearl cache',
    icon: 'TIDE',
    globalEvent: {
      id: 'tide' as string,
      name: 'Sky-Tide Pulse',
      description:
        'The tide-heart lifts a violet wave above the floating reefs; spreading rings sweep up to 20 points away, with weaker force farther from its center.',
      color: '#d3a5ff',
      maxLoss: 20,
      radiusFactor: 1.4,
    },
  },
] as const;
export type BoardId = (typeof BOARD_THEMES)[number]['id'];
type Point = { x: number; z: number };
type XY = readonly [number, number];
type Road = {
  from: number;
  to: number;
  via: XY[];
  name: string;
  /**
   * One code per space along the road (junctions excluded):
   * B blue · R red · L lucky · E event · S shop · O lottery · K bank ·
   * H hazard · T treasure · P jump pad/portal · N Nabbit · V Captain Klaxon · W switch
   */
  tiles: string;
};
type District = Point & { name: string; kind: string };
type WaterFeature = Point & { rx: number; rz: number; angle: number };
type Plan = {
  /** Uniform scale applied to every authored coordinate. */
  scale: number;
  junctions: XY[];
  /** Space codes for the junctions themselves (index 0 is the landing pad). */
  junctionTiles: string;
  roads: Road[];
  /** Shrink Ray wormholes: [road, tile] entrance → [road, tile] exit. */
  wormholes: (readonly [readonly [number, number], readonly [number, number]])[];
  landmark: XY;
  districts: (readonly [string, string, number, number])[];
  water: (readonly [number, number, number, number, number])[];
};
const CODES: Record<string, SpaceKind> = {
  '@': 'start',
  B: 'blue',
  R: 'red',
  L: 'lucky',
  E: 'event',
  S: 'shop',
  O: 'lottery',
  K: 'bank',
  H: 'hazard',
  T: 'spring',
  P: 'portal',
  N: 'thief',
  V: 'villain',
  W: 'switch',
};

// Hand-designed v0.8 boards. Each road's tile string fixes its exact spaces;
// the first road leaving a junction is the main route, later ones are the
// branches that a board gimmick can open or close.
const PLANS: Plan[] = [
  {
    // Crown Cay — tide gimmick opens the Lagoon Footbridge (road 6).
    scale: 0.72,
    junctions: [
      [-26, 24],
      [-38, 0],
      [-18, -26],
      [14, -28],
      [36, -4],
      [22, 24],
      [-4, 4],
      [16, -10],
    ],
    junctionTiles: '@BBBBBBB',
    roads: [
      { from: 0, to: 1, via: [[-36, 16]], name: 'Sunset Harbor', tiles: 'BBSBR' },
      { from: 1, to: 2, via: [[-40, -14], [-32, -24]], name: 'Coconut Coast', tiles: 'BLBRBNBB' },
      { from: 2, to: 3, via: [[-4, -34]], name: 'Volcano Gardens', tiles: 'BRBEBHB' },
      { from: 3, to: 4, via: [[32, -26]], name: 'Lighthouse Reef', tiles: 'BBKBRBLB' },
      { from: 4, to: 5, via: [[40, 12]], name: 'Tidepool Boardwalk', tiles: 'BOBRBTB' },
      { from: 5, to: 0, via: [[0, 32]], name: 'Festival Beach', tiles: 'BBRBLBVBSB' },
      { from: 1, to: 6, via: [[-22, 4]], name: 'Lagoon Footbridge', tiles: 'BTBLBB' },
      { from: 6, to: 5, via: [[8, 16]], name: 'Reef Causeway', tiles: 'BRBEBB' },
      { from: 3, to: 7, via: [[14, -18]], name: 'Caldera Rim', tiles: 'HBH' },
      { from: 7, to: 4, via: [[26, -8]], name: 'Lava Steps', tiles: 'BRBL' },
    ],
    wormholes: [[[1, 2], [2, 6]]],
    landmark: [18, -17],
    districts: [
      ['Sunset Harbor', 'harbor', -34, 20],
      ['Coconut Cove', 'grove', -44, -10],
      ['Fireflower Caldera', 'volcano', 18, -17],
      ['Coral Lighthouse', 'lighthouse', 34, -22],
      ['Blueglass Lagoon', 'lagoon', -15, 15],
    ],
    water: [
      [-15, 15, 7, 4, 0.2],
      [16, 4, 6, 4, -0.3],
    ],
  },
  {
    // Moonwake Basin — three jump pads (P) fling players between rims.
    scale: 0.72,
    junctions: [
      [0, 30],
      [-30, 14],
      [-30, -18],
      [0, -32],
      [30, -16],
      [32, 16],
      [-12, -4],
      [14, 0],
    ],
    junctionTiles: '@BBBBBBB',
    roads: [
      { from: 0, to: 1, via: [[-18, 28]], name: 'Landing Flats', tiles: 'BBSBRBL' },
      { from: 1, to: 2, via: [[-40, -2]], name: 'West Rim', tiles: 'BRBPBNB' },
      { from: 2, to: 3, via: [[-18, -32]], name: 'Observatory Ridge', tiles: 'BEBRBKB' },
      { from: 3, to: 4, via: [[18, -32]], name: 'Survey Bridge', tiles: 'BBRBLBB' },
      { from: 4, to: 5, via: [[40, 0]], name: 'East Rim', tiles: 'BHBOBRB' },
      { from: 5, to: 0, via: [[18, 30]], name: 'Dust Road', tiles: 'BLBPBVB' },
      { from: 1, to: 6, via: [[-16, 8]], name: 'Crater Floor', tiles: 'BTBRB' },
      { from: 6, to: 3, via: [[-8, -18]], name: 'Crater Exit', tiles: 'BEBLBB' },
      { from: 3, to: 7, via: [[10, -14]], name: 'Ice Mine', tiles: 'BPBHBTB' },
      { from: 7, to: 5, via: [[22, 8]], name: 'Mine Rail', tiles: 'BRBL' },
    ],
    wormholes: [[[0, 3], [2, 2]]],
    landmark: [-12, -6],
    districts: [
      ['Landing Zone', 'base', 0, 34],
      ['West Rim', 'rim', -40, 4],
      ['Star Observatory', 'observatory', -20, -34],
      ['Ice Mine', 'mine', 16, -8],
      ['East Crater', 'crater', 30, 2],
    ],
    water: [
      [0, 10, 6, 5, 0],
      [26, -4, 4, 4, 0],
    ],
  },
  {
    // Emberfault Reach — eruptions close the Lava Bridge (road 6).
    scale: 0.72,
    junctions: [
      [-28, 26],
      [-34, -6],
      [-12, -30],
      [20, -26],
      [36, 4],
      [14, 28],
      [-4, -2],
    ],
    junctionTiles: '@BBBBBB',
    roads: [
      { from: 0, to: 1, via: [[-38, 12]], name: 'Ash Trail', tiles: 'BBSBRBL' },
      { from: 1, to: 2, via: [[-30, -22]], name: 'Obsidian Steps', tiles: 'BRBHBNB' },
      { from: 2, to: 3, via: [[4, -36]], name: 'Magma Market', tiles: 'BSBRBKB' },
      { from: 3, to: 4, via: [[34, -16]], name: 'Vent Catwalks', tiles: 'BHBEBRB' },
      { from: 4, to: 5, via: [[30, 22]], name: 'Basalt Rim', tiles: 'BLBOBRB' },
      { from: 5, to: 0, via: [[-6, 34]], name: 'Hot Springs', tiles: 'BTBRBVBLB' },
      { from: 1, to: 6, via: [[-18, -6]], name: 'Lava Bridge', tiles: 'BLBTBB' },
      { from: 6, to: 3, via: [[8, -14]], name: 'Caldera Crossing', tiles: 'BHBEBR' },
      { from: 6, to: 5, via: [[6, 12]], name: 'Ember Gardens', tiles: 'BRBLBNB' },
    ],
    wormholes: [[[1, 2], [3, 3]]],
    landmark: [-16, 12],
    districts: [
      ['Ash Fields', 'ash', -34, 10],
      ['Obsidian Steps', 'obsidian', -28, -22],
      ['Magma Market', 'market', -4, -36],
      ['Vent Works', 'vents', 30, -14],
      ['Hot Springs', 'springs', 0, 34],
    ],
    water: [
      [14, -6, 5, 3.5, 0.4],
      [22, 14, 5, 4, 0],
    ],
  },
  {
    // Nimbus Reef — the cloud ferry (road 7) docks every other round.
    scale: 0.72,
    junctions: [
      [0, 30],
      [-30, 18],
      [-36, -10],
      [-10, -30],
      [22, -26],
      [36, 4],
      [20, 24],
      [-2, -2],
    ],
    junctionTiles: '@BBBBBBB',
    roads: [
      { from: 0, to: 1, via: [[-16, 30]], name: 'Shell Village', tiles: 'BSBRBL' },
      { from: 1, to: 2, via: [[-40, 4]], name: 'Mist Islands', tiles: 'BRBNBB' },
      { from: 2, to: 3, via: [[-28, -26]], name: 'Coral Arch', tiles: 'BEBLBRB' },
      { from: 3, to: 4, via: [[6, -36]], name: 'Windmill Reef', tiles: 'BKBRBHB' },
      { from: 4, to: 5, via: [[34, -14]], name: 'Kelp Kites', tiles: 'BLBOBRB' },
      { from: 5, to: 6, via: [[34, 18]], name: 'Pearl Steps', tiles: 'BTBRB' },
      { from: 6, to: 0, via: [[10, 32]], name: 'Rainbow Pier', tiles: 'BVBS' },
      { from: 1, to: 7, via: [[-16, 8]], name: 'Cloud Ferry', tiles: 'BTBLBB' },
      { from: 7, to: 4, via: [[10, -14]], name: 'Storm Eye', tiles: 'BRBEBH' },
    ],
    wormholes: [[[1, 1], [3, 2]]],
    landmark: [14, 8],
    districts: [
      ['Shell Village', 'village', -14, 34],
      ['Mist Islands', 'mist', -42, 4],
      ['Coral Arch', 'arch', -30, -28],
      ['Windmill Reef', 'windmill', 6, -38],
      ['Kelp Kites', 'kelp', 38, -12],
      ['Tide Heart', 'heart', 14, 8],
    ],
    water: [
      [-18, -12, 6, 5, 0],
      [22, -6, 5, 4, 0.3],
    ],
  },
];


function roundedPath(points: Point[]) {
  let chain = points;
  for (let pass = 0; pass < 3; pass++) {
    const next = [chain[0]];
    for (let i = 0; i < chain.length - 1; i++) {
      const a = chain[i],
        b = chain[i + 1];
      next.push(
        { x: a.x * 0.75 + b.x * 0.25, z: a.z * 0.75 + b.z * 0.25 },
        { x: a.x * 0.25 + b.x * 0.75, z: a.z * 0.25 + b.z * 0.75 },
      );
    }
    next.push(chain[chain.length - 1]);
    chain = next;
  }
  return chain;
}
function measure(chain: Point[]) {
  const lengths = [0];
  for (let i = 1; i < chain.length; i++)
    lengths.push(
      lengths[i - 1] +
        Math.hypot(chain[i].x - chain[i - 1].x, chain[i].z - chain[i - 1].z),
    );
  return lengths;
}
function resample(chain: Point[], count: number) {
  const lengths = measure(chain),
    total = lengths[lengths.length - 1];
  return Array.from({ length: count }, (_, i) => {
    const d = (i * total) / (count - 1);
    let j = 1;
    while (j < lengths.length - 1 && lengths[j] < d) j++;
    const t = (d - lengths[j - 1]) / (lengths[j] - lengths[j - 1]);
    return {
      x: chain[j - 1].x + (chain[j].x - chain[j - 1].x) * t,
      z: chain[j - 1].z + (chain[j].z - chain[j - 1].z) * t,
    };
  });
}
function makeBoard(index: number) {
  const theme = BOARD_THEMES[index],
    plan = PLANS[index];
  const s = plan.scale;
  const at = ([x, z]: XY): Point => ({ x: x * s, z: z * s });
  const chains = plan.roads.map((r) =>
    roundedPath([plan.junctions[r.from], ...r.via, plan.junctions[r.to]].map(at)),
  );
  const spaces: Space[] = plan.junctions.map((xy, id) => ({
    id,
    ...at(xy),
    type: CODES[plan.junctionTiles[id] ?? 'B'],
    next: [],
  }));
  const routeLabels: Record<number, string[]> = {};
  const districtRoads: {
    name: string;
    from: number;
    to: number;
    spaceIds: number[];
  }[] = [];
  plan.roads.forEach((road, r) => {
    // Every authored tile becomes one evenly spaced space along the rounded road.
    const count = road.tiles.length,
      pts = resample(chains[r], count + 2),
      ids: number[] = [];
    for (let i = 0; i < count; i++) {
      const id = spaces.length,
        type = CODES[road.tiles[i]];
      if (!type) throw Error(`Unknown tile code ${road.tiles[i]} on ${road.name}`);
      spaces.push({ id, ...pts[i + 1], type, next: [] });
      ids.push(id);
    }
    spaces[road.from].next.push(ids[0]);
    (routeLabels[road.from] ??= []).push(road.name);
    ids.forEach((id, i) => (spaces[id].next = [ids[i + 1] ?? road.to]));
    districtRoads.push({
      name: road.name,
      from: road.from,
      to: road.to,
      spaceIds: ids,
    });
  });
  for (const [[fromRoad, fromTile], [toRoad, toTile]] of plan.wormholes) {
    const entrance = districtRoads[fromRoad].spaceIds[fromTile],
      exit = districtRoads[toRoad].spaceIds[toTile];
    (spaces[entrance].miniNext ??= []).push(exit);
  }
  let minimum = Infinity;
  for (let i = 0; i < spaces.length; i++)
    for (let j = i + 1; j < spaces.length; j++)
      minimum = Math.min(
        minimum,
        Math.hypot(spaces[i].x - spaces[j].x, spaces[i].z - spaces[j].z),
      );
  const scale = Math.max(1, 3.12 / minimum);
  const bounds = {
    minX: Math.min(...spaces.map((p) => p.x)),
    maxX: Math.max(...spaces.map((p) => p.x)),
    minZ: Math.min(...spaces.map((p) => p.z)),
    maxZ: Math.max(...spaces.map((p) => p.z)),
  };
  const center = {
    x: (bounds.minX + bounds.maxX) / 2,
    z: (bounds.minZ + bounds.maxZ) / 2,
  };
  const place = ({ x, z }: Point): Point => ({
    x: (x - center.x) * scale,
    z: (z - center.z) * scale,
  });
  for (const p of spaces) Object.assign(p, place(p));
  const landmark = place(at(plan.landmark));
  const districts: District[] = plan.districts.map(([name, kind, x, z]) => ({
    name,
    kind,
    ...place(at([x, z])),
  }));
  const waterFeatures: WaterFeature[] = plan.water.map(
    ([x, z, rx, rz, angle]) => ({
      ...place(at([x, z])),
      rx: rx * s * scale,
      rz: rz * s * scale,
      angle,
    }),
  );
  const radius =
    Math.max(...spaces.map((p) => Math.hypot(p.x, p.z / 0.83))) + 6;
  return {
    ...theme,
    spaces,
    radius,
    minimumGap: minimum * scale,
    landmark,
    districts,
    waterFeatures,
    routeLabels,
    districtRoads,
    layoutScale: scale,
  };
}
export const BOARDS = BOARD_THEMES.map((_, i) => makeBoard(i));
export function getBoard(id?: string) {
  const current = RETIRED_BOARDS[id ?? ''] ?? id;
  return BOARDS.find((b) => b.id === current) ?? BOARDS[0];
}
export function pearlDestinations(boardId: string | undefined, from: number) {
  const board = getBoard(boardId).spaces,
    distance = new Map<number, number>([[from, 0]]),
    queue = [from];
  for (let k = 0; k < queue.length; k++) {
    const at = queue[k],
      d = distance.get(at)!;
    if (d >= 20) continue;
    for (const n of board[at].next)
      if (!distance.has(n)) {
        distance.set(n, d + 1);
        queue.push(n);
      }
  }
  return [...distance]
    .filter(
      ([n, d]) =>
        d >= 8 &&
        d <= 18 &&
        !['start', 'bank', 'hazard', 'portal', 'lottery'].includes(
          board[n].type,
        ),
    )
    .map(([n]) => n);
}
export const BOARD_WALK_SPEED = 10.5;