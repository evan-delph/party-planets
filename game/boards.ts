import type { Space, SpaceKind } from './config';

export const PLANETS = [
  {
    id: 'earth',
    name: 'Earth',
    colors: ['#55bed4', '#78ae6a', '#e7cca5'],
    description:
      'The visitors’ first holiday destination: tropical islands, snowy peaks and ancient rainforests.',
    boardIds: ['crown', 'alpine', 'moss'],
  },
  {
    id: 'selene',
    name: 'Selene',
    colors: ['#a5adc6', '#615a99', '#d4e4ff'],
    description:
      'A cratered moon of quiet impact basins, prismatic ice shelves and glowing geothermal rifts.',
    boardIds: ['crater', 'crystal', 'fissure'],
  },
  {
    id: 'verdara',
    name: 'Verdara',
    colors: ['#64b7a4', '#a874bd', '#d88377'],
    description:
      'An exuberant alien world of living light, airborne coral wetlands and red glass deserts.',
    boardIds: ['lumen', 'coral', 'dunes'],
  },
] as const;
export type PlanetId = (typeof PLANETS)[number]['id'];
export function getPlanet(id?: string) {
  return PLANETS.find((p) => p.id === id) ?? PLANETS[0];
}

export const BOARD_THEMES = [
  {
    id: 'crown',
    name: 'Crown Cay',
    ecosystem: 'Tropical archipelago',
    description:
      'A winding island-hopping holiday through coral headlands, a market harbor, volcanic gardens and lagoon causeways.',
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
      id: 'eruption',
      name: 'Fireflower Eruption',
      description:
        'The volcano launches molten fragments and a bright pressure ring across Crown Cay; nearby players lose up to20 points, with losses decreasing by distance.',
      color: '#ffac56',
      maxLoss: 20,
      radiusFactor: 1.4,
    },
  },
  {
    id: 'alpine',
    name: 'Aurora Alps',
    ecosystem: 'Alpine snow & hot springs',
    description:
      'Climb a chain of snowy switchbacks, cross the frozen valley and choose between hot springs and the exposed summit pass.',
    ground: '#deecf0',
    edge: '#9ab9cd',
    water: '#579cba',
    sky: '#b4c8e4',
    hazard: 'Avalanche',
    loss: 5,
    reward: 'Hot-spring bonus',
    icon: 'SNOW',
    planet: 'earth',
    terrain: 'snow',
    accent: '#d8f0ff',
    globalEvent: {
      id: 'avalanche',
      name: 'Cloudcap Avalanche',
      description:
        'Snow breaks from the summit and a rolling white powder front sweeps the valley; players lose up to20 points according to distance from the ridge.',
      color: '#d6efff',
      maxLoss: 20,
      radiusFactor: 1.4,
    },
  },
  {
    id: 'moss',
    name: 'Mossveil Ruins',
    ecosystem: 'Rainforest & glowing marsh',
    description:
      'Follow a braided jungle river through temple courtyards, mushroom wetlands, waterfall bridges and the firefly delta.',
    ground: '#639575',
    edge: '#466b68',
    water: '#397c79',
    sky: '#aacabd',
    hazard: 'Hungry bog',
    loss: 5,
    reward: 'Relic cache',
    icon: 'BOG',
    planet: 'earth',
    terrain: 'moss',
    accent: '#b7f2bf',
    globalEvent: {
      id: 'temple',
      name: 'Sun Temple Awakening',
      description:
        'The ancient temple opens an emerald beam and sends carved rune rings through the rainforest, draining up to20 points with distance falloff.',
      color: '#adffd0',
      maxLoss: 20,
      radiusFactor: 1.4,
    },
  },
  {
    id: 'crater',
    name: 'Moonwake Basin',
    planet: 'selene',
    terrain: 'crater',
    ecosystem: 'Crater desert & regolith plains',
    description:
      'Two ancient impact basins joined by narrow survey bridges, dusty rim roads and a buried lunar observatory.',
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
      id: 'meteor',
      name: 'Meteor Shower',
      description:
        'A bright meteor strikes the main impact basin; ejecta rings sweep outward and remove up to20 points, with less damage farther from impact.',
      color: '#b8d4ff',
      maxLoss: 20,
      radiusFactor: 1.4,
    },
  },
  {
    id: 'crystal',
    name: 'Prism Glacier',
    planet: 'selene',
    terrain: 'crystal',
    ecosystem: 'Crystal ice & frozen starlight',
    description:
      'A jagged chain of sapphire glacier shelves surrounds an ice cathedral, luminous caves and a star-mirror research station.',
    ground: '#9fb8d3',
    edge: '#596c9f',
    water: '#537de1',
    sky: '#171b4b',
    accent: '#94ffff',
    hazard: 'Crystal fracture',
    loss: 7,
    reward: 'Prism fragment',
    icon: 'PRISM',
    globalEvent: {
      id: 'prism',
      name: 'Prism Resonance',
      description:
        'The great ice prism splits moonlight into expanding cyan and violet waves; players lose up to20 points according to distance from the crystal.',
      color: '#88f8ff',
      maxLoss: 20,
      radiusFactor: 1.4,
    },
  },
  {
    id: 'fissure',
    name: 'Emberfault Reach',
    planet: 'selene',
    terrain: 'fissure',
    ecosystem: 'Geothermal fissures & obsidian ridges',
    description:
      'Suspended service bridges cross an active lunar rift, linking pressure towers, sulfur vents and abandoned mining terraces.',
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
      id: 'geyser',
      name: 'Mantle Blowout',
      description:
        'A towering geyser erupts from the pressure well and a ring of glowing steam travels over the terrain, removing up to20 points with distance falloff.',
      color: '#ffb36a',
      maxLoss: 20,
      radiusFactor: 1.4,
    },
  },
  {
    id: 'lumen',
    name: 'Lumen Canopy',
    planet: 'verdara',
    terrain: 'lumen',
    ecosystem: 'Bioluminescent jungle & spore groves',
    description:
      'Curl around colossal alien roots and glowing seed gardens, then choose between the canopy bridges and a luminous fungal understorey.',
    ground: '#3d6973',
    edge: '#264455',
    water: '#35628e',
    sky: '#192d4e',
    accent: '#96ffc3',
    hazard: 'Spore burst',
    loss: 7,
    reward: 'Glow-seed cache',
    icon: 'SPORE',
    globalEvent: {
      id: 'spore',
      name: 'Great Spore Bloom',
      description:
        'The ancient glowtree releases a billowing cloud of luminous spores that drains up to20 points from nearby players, fading with distance.',
      color: '#a2ffa5',
      maxLoss: 20,
      radiusFactor: 1.4,
    },
  },
  {
    id: 'coral',
    name: 'Nimbus Reef',
    planet: 'verdara',
    terrain: 'coral',
    ecosystem: 'Floating coral wetland & mist islands',
    description:
      'Follow curved coral causeways between buoyant reef islands, cloud pools, shell villages and a huge tide-heart anemone.',
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
      id: 'tide',
      name: 'Sky-Tide Pulse',
      description:
        'The tide-heart lifts a violet wave above the floating wetlands; spreading rings sweep up to20 points away, with weaker force farther from its center.',
      color: '#d3a5ff',
      maxLoss: 20,
      radiusFactor: 1.4,
    },
  },
  {
    id: 'dunes',
    name: 'Scarlet Drift',
    planet: 'verdara',
    terrain: 'dunes',
    ecosystem: 'Crimson dunes & glass canyons',
    description:
      'An old caravan network winds around red dunes, glass arches, a singing monolith and the sheltered canyon bazaar.',
    ground: '#b76b68',
    edge: '#704153',
    water: '#d9918e',
    sky: '#754b78',
    accent: '#ffd594',
    hazard: 'Sand vortex',
    loss: 8,
    reward: 'Glass relic',
    icon: 'VORTEX',
    globalEvent: {
      id: 'sandstorm',
      name: 'Crimson Sandstorm',
      description:
        'A red spiral rises beside the singing monolith and sends dust fronts across the caravan roads, removing up to20 points with less loss at a distance.',
      color: '#ff9b85',
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
  kind?: 'hazard' | 'treasure' | 'market';
};
type District = Point & { name: string; kind: string };
type WaterFeature = Point & { rx: number; rz: number; angle: number };
type Plan = {
  junctions: XY[];
  roads: Road[];
  landmark: XY;
  districts: (readonly [string, string, number, number])[];
  water: (readonly [number, number, number, number, number])[];
};

// Each world has an authored road network. The roads are rounded independently;
// junctions are shared, so a visually joined fork is also a real game decision.
// These are deliberately different networks, rather than one reused ring mesh.
const PLANS: Plan[] = [
  {
    junctions: [
      [-28, 26],
      [-36, 8],
      [-22, -11],
      [1, -20],
      [23, -23],
      [35, -4],
      [19, 13],
      [-3, 16],
      [-14, 4],
      [6, -1],
    ],
    roads: [
      {
        from: 0,
        to: 1,
        via: [
          [-37, 23],
          [-41, 17],
        ],
        name: 'Harbor promenade',
        kind: 'market',
      },
      {
        from: 1,
        to: 2,
        via: [
          [-38, -2],
          [-31, -11],
        ],
        name: 'Coconut coast',
      },
      {
        from: 2,
        to: 3,
        via: [
          [-19, -23],
          [-7, -26],
        ],
        name: 'Volcanic gardens',
        kind: 'hazard',
      },
      {
        from: 3,
        to: 4,
        via: [
          [9, -28],
          [15, -31],
        ],
        name: 'Coral headland',
        kind: 'treasure',
      },
      {
        from: 4,
        to: 5,
        via: [
          [34, -23],
          [40, -14],
        ],
        name: 'Lighthouse reef',
      },
      {
        from: 5,
        to: 6,
        via: [
          [37, 7],
          [29, 16],
        ],
        name: 'Tide-pool boardwalk',
        kind: 'treasure',
      },
      {
        from: 6,
        to: 7,
        via: [
          [13, 22],
          [5, 25],
        ],
        name: 'Blueglass bay',
      },
      {
        from: 7,
        to: 0,
        via: [
          [-11, 27],
          [-20, 33],
        ],
        name: 'Beach festival',
        kind: 'market',
      },
      {
        from: 1,
        to: 8,
        via: [
          [-28, 10],
          [-20, 11],
        ],
        name: 'Lagoon footbridge',
      },
      {
        from: 8,
        to: 7,
        via: [
          [-9, 7],
          [-2, 9],
        ],
        name: 'Palm picnic trail',
        kind: 'treasure',
      },
      {
        from: 3,
        to: 9,
        via: [
          [-2, -13],
          [6, -8],
        ],
        name: 'Caldera overlook',
        kind: 'hazard',
      },
      {
        from: 9,
        to: 6,
        via: [
          [15, -3],
          [24, 3],
        ],
        name: 'Reef causeway',
      },
      {
        from: 8,
        to: 9,
        via: [
          [-11, -2],
          [-3, 1],
        ],
        name: 'Lagoon stepping stones',
      },
      {
        from: 2,
        to: 8,
        via: [
          [-26, -3],
          [-23, 3],
        ],
        name: 'Mangrove market',
        kind: 'market',
      },
    ],
    landmark: [9, -15],
    districts: [
      ['Sunset Harbor', 'harbor', -31, 20],
      ['Coconut Cove', 'grove', -31, -2],
      ['Fireflower Caldera', 'volcano', 9, -15],
      ['Coral Lighthouse', 'lighthouse', 29, -16],
      ['Blueglass Lagoon', 'lagoon', 8, 12],
    ],
    water: [
      [-21, 17, 7, 4, -0.3],
      [8, 12, 9, 5, 0.4],
      [25, -10, 5, 6, 0.3],
    ],
  },
  {
    junctions: [
      [-22, 29],
      [15, 28],
      [30, 12],
      [-15, 10],
      [-31, -4],
      [20, -9],
      [28, -26],
      [-12, -29],
      [-7, -6],
      [-1, 14],
    ],
    roads: [
      {
        from: 0,
        to: 1,
        via: [
          [-10, 36],
          [3, 31],
        ],
        name: 'Chalet crescent',
        kind: 'market',
      },
      {
        from: 1,
        to: 2,
        via: [
          [28, 31],
          [36, 22],
        ],
        name: 'Chairlift ridge',
      },
      {
        from: 2,
        to: 3,
        via: [
          [20, 17],
          [10, 10],
          [-4, 9],
        ],
        name: 'Frozen valley crossing',
      },
      {
        from: 3,
        to: 4,
        via: [
          [-25, 13],
          [-36, 6],
        ],
        name: 'Pinewood switchback',
      },
      {
        from: 4,
        to: 5,
        via: [
          [-25, -14],
          [-12, -16],
          [3, -12],
        ],
        name: 'Glacier shelf',
        kind: 'hazard',
      },
      {
        from: 5,
        to: 6,
        via: [
          [33, -10],
          [37, -19],
        ],
        name: 'Avalanche ascent',
        kind: 'hazard',
      },
      {
        from: 6,
        to: 7,
        via: [
          [18, -34],
          [2, -36],
        ],
        name: 'Summit observatory',
        kind: 'treasure',
      },
      {
        from: 7,
        to: 0,
        via: [
          [-29, -33],
          [-42, -23],
          [-43, -1],
          [-35, 19],
        ],
        name: 'Long mountain descent',
      },
      {
        from: 0,
        to: 9,
        via: [
          [-11, 24],
          [-2, 22],
        ],
        name: 'Ski-school slalom',
      },
      {
        from: 9,
        to: 3,
        via: [
          [-7, 15],
          [-12, 12],
        ],
        name: 'Lodge courtyard',
        kind: 'market',
      },
      {
        from: 3,
        to: 8,
        via: [
          [-17, 3],
          [-13, -4],
        ],
        name: 'Hot-spring trail',
        kind: 'treasure',
      },
      {
        from: 8,
        to: 5,
        via: [
          [0, -5],
          [11, -3],
        ],
        name: 'Steam-garden bridge',
      },
      {
        from: 5,
        to: 7,
        via: [
          [15, -20],
          [4, -24],
        ],
        name: 'Exposed summit pass',
        kind: 'hazard',
      },
      {
        from: 2,
        to: 8,
        via: [
          [24, 3],
          [9, 4],
          [-2, 2],
        ],
        name: 'Ice-cave shortcut',
      },
    ],
    landmark: [-24, -23.75],
    districts: [
      ['Starlight Lodge', 'chalet', -6, 27],
      ['Crystal Lake', 'lake', 6, 7],
      ['Whistling Pines', 'grove', -27, 1],
      ['Cloudcap Summit', 'mountain', -24, -23.75],
      ['Moonwater Springs', 'hot-spring', -7, -10],
    ],
    water: [
      [7, 7, 10, 4, -0.1],
      [-7, -10, 4, 3, 0.1],
      [-33, -21, 4, 5, -0.4],
    ],
  },
  {
    junctions: [
      [-7, 30],
      [-25, 20],
      [-25, -1],
      [-7, -5],
      [-12, -26],
      [15, -30],
      [28, -10],
      [15, 6],
      [28, 26],
      [10, 31],
      [-6, 11],
    ],
    roads: [
      {
        from: 0,
        to: 1,
        via: [
          [-19, 33],
          [-29, 28],
        ],
        name: 'Firefly delta',
        kind: 'treasure',
      },
      {
        from: 1,
        to: 2,
        via: [
          [-35, 18],
          [-36, 7],
        ],
        name: 'Mushroom marsh',
        kind: 'hazard',
      },
      {
        from: 2,
        to: 3,
        via: [
          [-22, -9],
          [-15, -10],
        ],
        name: 'Ancient aqueduct',
      },
      {
        from: 3,
        to: 4,
        via: [
          [-10, -18],
          [-7, -24],
        ],
        name: 'Root staircase',
      },
      {
        from: 4,
        to: 5,
        via: [
          [-8, -36],
          [4, -38],
        ],
        name: 'Temple courtyard',
        kind: 'treasure',
      },
      {
        from: 5,
        to: 6,
        via: [
          [26, -29],
          [36, -22],
        ],
        name: 'Waterfall canopy',
      },
      {
        from: 6,
        to: 7,
        via: [
          [23, -7],
          [24, 1],
        ],
        name: 'Orchid terraces',
      },
      {
        from: 7,
        to: 8,
        via: [
          [30, 12],
          [35, 19],
        ],
        name: 'Riverbend outpost',
        kind: 'market',
      },
      {
        from: 8,
        to: 9,
        via: [
          [23, 36],
          [16, 39],
        ],
        name: 'Lantern jetty',
      },
      {
        from: 9,
        to: 0,
        via: [
          [6, 25],
          [0, 25],
        ],
        name: 'Canoe landing',
        kind: 'market',
      },
      {
        from: 3,
        to: 7,
        via: [
          [1, -17],
          [12, -16],
          [17, -5],
        ],
        name: 'Sunken shrine',
        kind: 'hazard',
      },
      {
        from: 7,
        to: 10,
        via: [
          [9, 13],
          [2, 16],
        ],
        name: 'Vine bridge',
      },
      {
        from: 10,
        to: 1,
        via: [
          [-14, 16],
          [-20, 14],
        ],
        name: 'Explorer camp',
        kind: 'market',
      },
      {
        from: 10,
        to: 3,
        via: [
          [-14, 5],
          [-14, -1],
        ],
        name: 'Fern hollow',
      },
      {
        from: 0,
        to: 10,
        via: [
          [-10, 24],
          [-8, 18],
        ],
        name: 'Glow-worm trail',
        kind: 'treasure',
      },
    ],
    landmark: [0, -29],
    districts: [
      ['Firefly Delta', 'lagoon', -17, 25],
      ['Whispering Bog', 'bog', -27.5, 8.75],
      ['Sun Temple', 'temple', 0, -29],
      ['Orchid Falls', 'waterfall', 25, -22],
      ['Fern Hollow', 'grove', -6, 2],
      ['Lantern Outpost', 'harbor', 24, 23],
    ],
    water: [
      [-27, 9, 6, 6, 0.1],
      [4, -4, 5, 8, -0.4],
      [18, 22, 6, 4, 0.2],
    ],
  },
  {
    junctions: [
      [-5, 30],
      [-25, 22],
      [-35, 0],
      [-20, -24],
      [5, -30],
      [27, -20],
      [35, 8],
      [20, 29],
      [0, 7],
      [-9, -9],
      [11, -11],
    ],
    roads: [
      {
        from: 0,
        to: 1,
        via: [
          [-15, 37],
          [-26, 32],
        ],
        name: 'Survey-port crescent',
        kind: 'market',
      },
      {
        from: 1,
        to: 2,
        via: [
          [-36, 20],
          [-42, 9],
        ],
        name: 'West crater rim',
      },
      {
        from: 2,
        to: 3,
        via: [
          [-39, -13],
          [-31, -25],
        ],
        name: 'Ejecta ridge',
        kind: 'hazard',
      },
      {
        from: 3,
        to: 4,
        via: [
          [-14, -35],
          [-4, -37],
        ],
        name: 'Far-side observatory',
        kind: 'treasure',
      },
      {
        from: 4,
        to: 5,
        via: [
          [15, -34],
          [27, -30],
        ],
        name: 'Silver dune traverse',
      },
      {
        from: 5,
        to: 6,
        via: [
          [39, -17],
          [42, -5],
        ],
        name: 'Radio-telescope road',
      },
      {
        from: 6,
        to: 7,
        via: [
          [39, 21],
          [30, 32],
        ],
        name: 'Moonstone quarry',
        kind: 'treasure',
      },
      {
        from: 7,
        to: 0,
        via: [
          [14, 40],
          [2, 37],
        ],
        name: 'Solar-panel fields',
      },
      {
        from: 1,
        to: 8,
        via: [
          [-17, 20],
          [-8, 16],
        ],
        name: 'Southern basin bridge',
      },
      {
        from: 8,
        to: 7,
        via: [
          [10, 12],
          [20, 17],
        ],
        name: 'Basin research camp',
        kind: 'market',
      },
      {
        from: 3,
        to: 9,
        via: [
          [-13, -21],
          [-8, -16],
        ],
        name: 'Impact-well descent',
        kind: 'hazard',
      },
      {
        from: 9,
        to: 8,
        via: [
          [-15, -1],
          [-10, 7],
        ],
        name: 'Regolith tunnel',
      },
      {
        from: 4,
        to: 10,
        via: [
          [4, -22],
          [8, -17],
        ],
        name: 'Ice-prospect shaft',
      },
      {
        from: 10,
        to: 6,
        via: [
          [23, -7],
          [26, 1],
        ],
        name: 'Magnetic rail bridge',
      },
      {
        from: 9,
        to: 10,
        via: [
          [-3, -6],
          [4, -7],
        ],
        name: 'Crater dividing ridge',
      },
    ],
    landmark: [-25, 0],
    districts: [
      ['Survey Port', 'spaceport', -16, 29],
      ['Atlas Impact Basin', 'crater', -25, 0],
      ['Far-side Observatory', 'observatory', -8, -28],
      ['Silver Dunes', 'dunes', 24, -14],
      ['Moonstone Quarry', 'crystals', 28, 18],
      ['Southern Basin', 'crater', 2, 21],
    ],
    water: [
      [-25, 0, 9, 9, 0],
      [2, 21, 8, 7, 0.2],
      [17, -21, 4, 5, -0.2],
    ],
  },
  {
    junctions: [
      [-30, 27],
      [-29, 4],
      [-38, -20],
      [-9, -25],
      [7, -9],
      [29, -29],
      [39, -1],
      [21, 12],
      [33, 34],
      [2, 30],
      [-4, 11],
    ],
    roads: [
      {
        from: 0,
        to: 1,
        via: [
          [-37, 23],
          [-37, 13],
        ],
        name: 'Ice-dock ascent',
        kind: 'market',
      },
      {
        from: 1,
        to: 2,
        via: [
          [-43, -4],
          [-46, -13],
        ],
        name: 'Sapphire escarpment',
        kind: 'hazard',
      },
      {
        from: 2,
        to: 3,
        via: [
          [-36, -33],
          [-23, -36],
        ],
        name: 'Aurora mirror walk',
        kind: 'treasure',
      },
      {
        from: 3,
        to: 4,
        via: [
          [0, -26],
          [5, -20],
        ],
        name: 'Cathedral stair',
      },
      {
        from: 4,
        to: 5,
        via: [
          [18, -11],
          [20, -21],
        ],
        name: 'Prism fault',
        kind: 'hazard',
      },
      {
        from: 5,
        to: 6,
        via: [
          [43, -25],
          [48, -14],
        ],
        name: 'Starfall glacier',
      },
      {
        from: 6,
        to: 7,
        via: [
          [36, 9],
          [29, 17],
        ],
        name: 'Snow-moth garden',
        kind: 'treasure',
      },
      {
        from: 7,
        to: 8,
        via: [
          [21, 25],
          [29, 27],
        ],
        name: 'Crystal orchard',
      },
      {
        from: 8,
        to: 9,
        via: [
          [23, 43],
          [9, 40],
        ],
        name: 'Comet-view terrace',
      },
      {
        from: 9,
        to: 0,
        via: [
          [-9, 37],
          [-23, 35],
        ],
        name: 'Research village',
        kind: 'market',
      },
      {
        from: 1,
        to: 10,
        via: [
          [-17, 5],
          [-10, 10],
        ],
        name: 'Blue-ice causeway',
      },
      {
        from: 10,
        to: 9,
        via: [
          [0, 19],
          [-2, 25],
        ],
        name: 'Polar greenhouse',
      },
      {
        from: 10,
        to: 4,
        via: [
          [-7, 2],
          [-2, -5],
        ],
        name: 'Resonance bridge',
        kind: 'hazard',
      },
      {
        from: 4,
        to: 7,
        via: [
          [7, 1],
          [13, 7],
        ],
        name: 'Inner glacier shelf',
      },
      {
        from: 3,
        to: 1,
        via: [
          [-18, -18],
          [-22, -8],
        ],
        name: 'Moon-mirror shortcut',
      },
    ],
    landmark: [30, -13],
    districts: [
      ['Ice Dock', 'spaceport', -26, 24],
      ['Sapphire Hall', 'crystals', -33, -15],
      ['Moon Mirror', 'observatory', -23, -26],
      ['Resonant Prism', 'crystals', 30, -13],
      ['Polar Greenhouse', 'garden', 8, 18],
      ['Comet Terrace', 'observatory', 17, 34],
    ],
    water: [
      [-23, -6, 7, 6, -0.4],
      [29, -13, 6, 6, 0.2],
      [13, 29, 7, 4, 0.3],
    ],
  },
  {
    junctions: [
      [-25, 31],
      [-30, 11],
      [-25, -14],
      [-15, -34],
      [12, -35],
      [28, -18],
      [32, 9],
      [20, 31],
      [1, 19],
      [-5, -3],
      [5, -18],
    ],
    roads: [
      {
        from: 0,
        to: 1,
        via: [
          [-38, 27],
          [-39, 17],
        ],
        name: 'Pressure-port walkway',
        kind: 'market',
      },
      {
        from: 1,
        to: 2,
        via: [
          [-38, 1],
          [-36, -9],
        ],
        name: 'Obsidian wall',
      },
      {
        from: 2,
        to: 3,
        via: [
          [-28, -26],
          [-24, -34],
        ],
        name: 'Sulfur switchback',
        kind: 'hazard',
      },
      {
        from: 3,
        to: 4,
        via: [
          [-7, -43],
          [3, -42],
        ],
        name: 'Deep-core mine',
      },
      {
        from: 4,
        to: 5,
        via: [
          [25, -38],
          [34, -29],
        ],
        name: 'Magma-watch ridge',
        kind: 'hazard',
      },
      {
        from: 5,
        to: 6,
        via: [
          [38, -12],
          [41, -1],
        ],
        name: 'Cinderworks promenade',
        kind: 'market',
      },
      {
        from: 6,
        to: 7,
        via: [
          [38, 22],
          [29, 32],
        ],
        name: 'Basalt garden',
      },
      {
        from: 7,
        to: 0,
        via: [
          [11, 42],
          [-6, 40],
          [-18, 37],
        ],
        name: 'Cooling-pool circuit',
        kind: 'treasure',
      },
      {
        from: 1,
        to: 9,
        via: [
          [-24, 0],
          [-15, -5],
        ],
        name: 'Lower rift suspension bridge',
      },
      {
        from: 9,
        to: 6,
        via: [
          [9, 3],
          [24, 2],
        ],
        name: 'Steam-turbine crossing',
      },
      {
        from: 2,
        to: 10,
        via: [
          [-18, -21],
          [-7, -23],
        ],
        name: 'Vent-field catwalk',
        kind: 'hazard',
      },
      {
        from: 10,
        to: 5,
        via: [
          [15, -23],
          [24, -23],
        ],
        name: 'Geothermal control deck',
      },
      {
        from: 7,
        to: 8,
        via: [
          [12, 27],
          [4, 29],
        ],
        name: 'Cooling station descent',
      },
      {
        from: 8,
        to: 9,
        via: [
          [-4, 15],
          [-7, 7],
        ],
        name: 'Thermal siphon road',
        kind: 'treasure',
      },
      {
        from: 9,
        to: 10,
        via: [
          [0, -9],
          [8, -12],
        ],
        name: 'Inner fault crossing',
      },
    ],
    landmark: [-3, -31],
    districts: [
      ['Pressure Port', 'spaceport', -29, 24],
      ['Sulfur Chimneys', 'vents', -27, -3],
      ['Mantle Pressure Well', 'geyser', -3, -31],
      ['Cinderworks', 'factory', 31, -1],
      ['Cooling Gardens', 'garden', 7, 31],
      ['Rift Turbines', 'turbine', 8, -5],
    ],
    water: [
      [-3, -30, 6, 4, 0.2],
      [-17, -5, 4, 10, 0.3],
      [18, 15, 6, 4, -0.2],
    ],
  },
  {
    junctions: [
      [-31, 26],
      [-10, 24],
      [-6, 4],
      [-24, -6],
      [-28, -29],
      [-1, -35],
      [8, -13],
      [27, -23],
      [39, 2],
      [18, 19],
      [25, 34],
      [3, 37],
    ],
    roads: [
      {
        from: 0,
        to: 1,
        via: [
          [-24, 33],
          [-18, 31],
        ],
        name: 'Glow-seed landing',
        kind: 'market',
      },
      {
        from: 1,
        to: 2,
        via: [
          [-10, 16],
          [-6, 10],
        ],
        name: 'Root spiral',
      },
      {
        from: 2,
        to: 3,
        via: [
          [-15, 6],
          [-22, 2],
        ],
        name: 'Mycelium causeway',
      },
      {
        from: 3,
        to: 4,
        via: [
          [-37, -10],
          [-38, -22],
        ],
        name: 'Spore-thicket trail',
        kind: 'hazard',
      },
      {
        from: 4,
        to: 5,
        via: [
          [-23, -41],
          [-11, -44],
        ],
        name: 'Night-bloom orchard',
        kind: 'treasure',
      },
      {
        from: 5,
        to: 6,
        via: [
          [9, -32],
          [13, -22],
        ],
        name: 'Ancient trunk ascent',
      },
      {
        from: 6,
        to: 7,
        via: [
          [20, -12],
          [28, -16],
        ],
        name: 'Canopy insectarium',
      },
      {
        from: 7,
        to: 8,
        via: [
          [39, -22],
          [46, -10],
        ],
        name: 'Lantern-moth cliffs',
      },
      {
        from: 8,
        to: 9,
        via: [
          [37, 17],
          [29, 22],
        ],
        name: 'Floating seed-garden',
        kind: 'treasure',
      },
      {
        from: 9,
        to: 10,
        via: [
          [18, 29],
          [19, 33],
        ],
        name: 'Root-hollow bazaar',
        kind: 'market',
      },
      {
        from: 10,
        to: 11,
        via: [
          [17, 45],
          [9, 44],
        ],
        name: 'Glowroot terraces',
      },
      {
        from: 11,
        to: 0,
        via: [
          [-10, 42],
          [-27, 40],
          [-38, 34],
        ],
        name: 'Fern-valley descent',
      },
      {
        from: 1,
        to: 11,
        via: [
          [-6, 30],
          [-1, 30],
        ],
        name: 'Seed-pod overlook',
      },
      {
        from: 2,
        to: 9,
        via: [
          [3, 4],
          [9, 11],
        ],
        name: 'Living vine bridge',
      },
      {
        from: 3,
        to: 6,
        via: [
          [-19, -18],
          [-7, -22],
          [1, -17],
        ],
        name: 'Spore-heart hollow',
        kind: 'hazard',
      },
      {
        from: 6,
        to: 2,
        via: [
          [3, -7],
          [-6, -3],
        ],
        name: 'Moonflower tunnel',
      },
    ],
    landmark: [-21, -29],
    districts: [
      ['Glow-seed Port', 'spaceport', -24, 28],
      ['Great Glowtree', 'alien-tree', -21, -29],
      ['Spore-heart Hollow', 'mushrooms', -13, -11],
      ['Canopy Insectarium', 'garden', 25, -15],
      ['Lantern Moth Sanctuary', 'moths', 31, 9],
      ['Root-hollow Bazaar', 'village', 14, 34],
    ],
    water: [
      [-13, -11, 5, 6, 0.5],
      [23, -10, 6, 5, -0.1],
      [-17, 32, 7, 3, -0.1],
    ],
  },
  {
    junctions: [
      [-34, 16],
      [-26, -9],
      [-8, -22],
      [3, -2],
      [22, -24],
      [39, -6],
      [31, 16],
      [10, 30],
      [-3, 16],
      [-20, 33],
    ],
    roads: [
      {
        from: 0,
        to: 1,
        via: [
          [-41, 8],
          [-39, -3],
        ],
        name: 'Shell-port spiral',
        kind: 'market',
      },
      {
        from: 1,
        to: 2,
        via: [
          [-23, -23],
          [-16, -29],
        ],
        name: 'Cloud-coral ridge',
      },
      {
        from: 2,
        to: 3,
        via: [
          [-2, -17],
          [-8, -5],
        ],
        name: 'Mist-lily stair',
      },
      {
        from: 3,
        to: 4,
        via: [
          [2, -12],
          [11, -22],
        ],
        name: 'Tide-heart ascent',
        kind: 'hazard',
      },
      {
        from: 4,
        to: 5,
        via: [
          [37, -28],
          [46, -17],
        ],
        name: 'Pearlescent reef',
        kind: 'treasure',
      },
      {
        from: 5,
        to: 6,
        via: [
          [42, 6],
          [40, 13],
        ],
        name: 'Jellyfish panorama',
      },
      {
        from: 6,
        to: 7,
        via: [
          [29, 28],
          [21, 35],
        ],
        name: 'Buoyant coral garden',
      },
      {
        from: 7,
        to: 8,
        via: [
          [6, 24],
          [1, 24],
        ],
        name: 'Water-singer village',
        kind: 'market',
      },
      {
        from: 8,
        to: 9,
        via: [
          [-7, 32],
          [-13, 37],
        ],
        name: 'Cloud-pool stepping stones',
      },
      {
        from: 9,
        to: 0,
        via: [
          [-32, 34],
          [-40, 26],
        ],
        name: 'Sky-ray nursery',
        kind: 'treasure',
      },
      {
        from: 1,
        to: 8,
        via: [
          [-24, 2],
          [-15, 12],
        ],
        name: 'Western mist bridge',
      },
      {
        from: 3,
        to: 8,
        via: [
          [-1, 7],
          [-2, 11],
        ],
        name: 'Suspended shell bridge',
      },
      {
        from: 3,
        to: 6,
        via: [
          [16, 4],
          [25, 10],
        ],
        name: 'Inner reef crossing',
      },
      {
        from: 6,
        to: 3,
        via: [
          [29, 0],
          [17, -5],
        ],
        name: 'Anemone underpass',
        kind: 'hazard',
      },
      {
        from: 2,
        to: 1,
        via: [
          [-12, -12],
          [-21, -7],
        ],
        name: 'Moon-shell loop',
      },
    ],
    landmark: [22, -14],
    districts: [
      ['Shell Port', 'spaceport', -31, 9],
      ['Cloud Lily Fields', 'garden', -17, -15],
      ['Tide-heart Anemone', 'anemone', 22, -14],
      ['Pearlescent Reef', 'coral', 33, -16],
      ['Sky-ray Nursery', 'rays', -23, 24],
      ['Water-singer Village', 'village', 17, 23],
    ],
    water: [
      [-22, 18, 7, 6, 0.1],
      [22, -13, 7, 6, 0],
      [16, 20, 7, 5, 0.4],
    ],
  },
  {
    junctions: [
      [-36, 22],
      [-17, 30],
      [7, 24],
      [30, 31],
      [39, 7],
      [19, -4],
      [29, -28],
      [1, -35],
      [-23, -27],
      [-34, -5],
      [-10, -5],
      [4, 8],
    ],
    roads: [
      {
        from: 0,
        to: 1,
        via: [
          [-29, 35],
          [-24, 38],
        ],
        name: 'Caravan landing',
        kind: 'market',
      },
      {
        from: 1,
        to: 2,
        via: [
          [-8, 31],
          [1, 31],
        ],
        name: 'Red dune crest',
      },
      {
        from: 2,
        to: 3,
        via: [
          [16, 31],
          [21, 39],
        ],
        name: 'Glass-arch pass',
      },
      {
        from: 3,
        to: 4,
        via: [
          [43, 27],
          [47, 17],
        ],
        name: 'Scarlet badlands',
        kind: 'hazard',
      },
      {
        from: 4,
        to: 5,
        via: [
          [35, -3],
          [28, -7],
        ],
        name: 'Canyon shade road',
      },
      {
        from: 5,
        to: 6,
        via: [
          [15, -14],
          [19, -25],
        ],
        name: 'Singing monolith ascent',
        kind: 'hazard',
      },
      {
        from: 6,
        to: 7,
        via: [
          [21, -39],
          [12, -43],
        ],
        name: 'Star-sand overlook',
        kind: 'treasure',
      },
      {
        from: 7,
        to: 8,
        via: [
          [-8, -40],
          [-19, -37],
        ],
        name: 'Ancient glass flats',
      },
      {
        from: 8,
        to: 9,
        via: [
          [-37, -25],
          [-42, -14],
        ],
        name: 'Wind-carved canyon',
      },
      {
        from: 9,
        to: 0,
        via: [
          [-43, 3],
          [-43, 14],
        ],
        name: 'Silk-sail camp',
        kind: 'market',
      },
      {
        from: 1,
        to: 10,
        via: [
          [-17, 19],
          [-18, 5],
        ],
        name: 'Caravan spring road',
        kind: 'treasure',
      },
      {
        from: 10,
        to: 9,
        via: [
          [-21, -9],
          [-28, -10],
        ],
        name: 'Hidden canyon exit',
      },
      {
        from: 10,
        to: 11,
        via: [
          [-6, 3],
          [-3, 9],
        ],
        name: 'Bazaar steps',
      },
      {
        from: 11,
        to: 2,
        via: [
          [3, 16],
          [4, 21],
        ],
        name: 'Sun-glass bridge',
      },
      {
        from: 5,
        to: 11,
        via: [
          [17, 4],
          [12, 9],
        ],
        name: 'East canyon shelf',
      },
      {
        from: 7,
        to: 10,
        via: [
          [-3, -24],
          [-5, -15],
        ],
        name: 'Monolith pilgrim trail',
      },
    ],
    landmark: [29, -15],
    districts: [
      ['Caravan Port', 'spaceport', -29, 25],
      ['Singing Monolith', 'monolith', 29, -15],
      ['Glass Arches', 'arch', 26, 23],
      ['Canyon Bazaar', 'village', -5, 17],
      ['Star-sand Flats', 'dunes', -15, -27],
      ['Silk-sail Camp', 'camp', -32, 7],
    ],
    water: [
      [-5, 16, 5, 4, 0.2],
      [-23, -20, 4, 3, 0.3],
      [26, 20, 5, 4, -0.4],
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
  const chains = plan.roads.map((r) =>
    roundedPath(
      [plan.junctions[r.from], ...r.via, plan.junctions[r.to]].map(
        ([x, z]) => ({ x, z }),
      ),
    ),
  );
  const lengths = chains.map((c) => measure(c).at(-1)!);
  // Allocate the same 138 playable spaces by actual road length. Every road has
  // at least two interior spaces, keeping branches readable and worth a choice.
  const interiorTotal = 138 - plan.junctions.length;
  const totalLength = lengths.reduce((a, b) => a + b, 0);
  const allocations = lengths.map((l) =>
    Math.max(2, Math.floor((interiorTotal * l) / totalLength)),
  );
  while (allocations.reduce((a, b) => a + b, 0) < interiorTotal) {
    let best = 0;
    for (let i = 1; i < allocations.length; i++)
      if (
        lengths[i] / (allocations[i] + 1) >
        lengths[best] / (allocations[best] + 1)
      )
        best = i;
    allocations[best]++;
  }
  while (allocations.reduce((a, b) => a + b, 0) > interiorTotal) {
    let best = -1;
    for (let i = 0; i < allocations.length; i++)
      if (
        allocations[i] > 2 &&
        (best < 0 ||
          lengths[i] / allocations[i] < lengths[best] / allocations[best])
      )
        best = i;
    allocations[best]--;
  }
  const spaces: Space[] = plan.junctions.map(([x, z], id) => ({
    id,
    x,
    z,
    type: id === 0 ? 'start' : 'blue',
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
    const pts = resample(chains[r], allocations[r] + 2),
      ids: number[] = [];
    for (let i = 0; i < allocations[r]; i++) {
      const id = spaces.length;
      const type: SpaceKind =
        road.kind === 'hazard' &&
        Math.abs(i - Math.floor(allocations[r] / 2)) <= 1
          ? 'hazard'
          : i === Math.floor(allocations[r] / 2)
            ? road.kind === 'hazard'
              ? 'hazard'
              : road.kind === 'treasure'
                ? 'lucky'
                : road.kind === 'market'
                  ? 'shop'
                  : r % 3 === 0
                    ? 'bank'
                    : r % 4 === 1
                      ? 'event'
                      : 'blue'
            : i === Math.max(0, Math.floor(allocations[r] / 2) - 2) &&
                r % 3 === 0
              ? 'bank'
              : i === allocations[r] - 1 && r % 4 === 0
                ? 'switch'
                : i === 1 && r % 5 === 1
                  ? 'spring'
                  : i === allocations[r] - 2 && r % 5 === 2
                    ? 'portal'
                    : i === 2 && r % 5 === 4
                      ? 'thief'
                      : (id + r) % 9 === 4
                        ? 'red'
                        : (id + r) % 13 === 8
                          ? 'event'
                          : 'blue';
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
  // Retype existing tiles: saved positions and every road connection stay valid.
  // The first road is shared by all players leaving the landing pad.
  const lotteryRoads = [
    districtRoads[0],
    districtRoads[Math.floor(districtRoads.length / 2)],
  ];
  for (const road of lotteryRoads) {
    const candidates = road.spaceIds.filter((id) => spaces[id].type === 'blue');
    const id = candidates[Math.floor(candidates.length / 2)];
    if (id !== undefined) spaces[id].type = 'lottery';
  }
  // Captain Klaxon claims a red tile on every third road (at least two per board).
  const villainRoads = districtRoads.filter((_, r) => r % 3 === 2);
  for (const road of villainRoads.length >= 2
    ? villainRoads
    : districtRoads.slice(-2)) {
    const id = road.spaceIds.find((id) => spaces[id].type === 'red');
    if (id !== undefined) spaces[id].type = 'villain';
  }
  if (!spaces.some((n) => n.type === 'shop')) {
    const candidate = spaces.find(
      (n) => n.type === 'blue' && n.id > plan.junctions.length,
    );
    if (candidate) candidate.type = 'shop';
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
  const transform = ([x, z]: XY): Point => ({
    x: (x - center.x) * scale,
    z: (z - center.z) * scale,
  });
  for (const p of spaces) Object.assign(p, transform([p.x, p.z]));
  const landmark = transform(plan.landmark);
  const districts: District[] = plan.districts.map(([name, kind, x, z]) => ({
    name,
    kind,
    ...transform([x, z]),
  }));
  const waterFeatures: WaterFeature[] = plan.water.map(
    ([x, z, rx, rz, angle]) => ({
      ...transform([x, z]),
      rx: rx * scale,
      rz: rz * scale,
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
  return BOARDS.find((b) => b.id === id) ?? BOARDS[0];
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
export const BOARD_WALK_SPEED = 9;
