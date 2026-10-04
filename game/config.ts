import { getBoard } from './boards';
export const RULES = {
  startingShells: 20,
  pearlPrice: 50,
  blueReward: 3,
  redPenalty: 3,
  lapReward: 10,
  inventorySize: 3,
  minigameReward: [10, 6, 3, 1],
  // Team minigames: each winner gets teamWin; a lone 1-vs-3 winner gets soloWin.
  teamWin: 10,
  soloWin: 15,
  teamTie: 3,
  diceSides: 10,
  miniDiceSides: 5,
  megaStomp: 10,
  nabPointsCost: 5,
  nabDiamondCost: 50,
  // Last-turns event: the final 5 rounds (final 3 in short games).
  lastTurnsBonus: 20,
  minigameSeconds: 20,
  turnTimeout: 60000,
};
export const ALIEN_SKIN = '#86da62';
export const COLORS = [
  '#ec805b',
  '#b96039',
  '#e3ad79',
  '#7d4937',
  '#ebbcaa',
  '#b53738',
  '#f3c45e',
  '#89a46c',
];
export const OUTFITS = [
  '#12ad9a',
  '#f25265',
  '#7549cb',
  '#f4b62c',
  '#247ccc',
  '#fe8b3d',
  '#f5f2df',
  '#253e51',
];
export type Avatar = {
  name: string;
  skin: string;
  shirt: string;
  hair: number;
  eyes: number;
  mouth: number;
  accessory: number;
  height: number;
  width: number;
  hairColor?: string;
  eyeColor?: string;
  shoeColor?: string;
  pattern?: number;
  brows?: number;
  nose?: number;
  beard?: number;
  eyeSpacing?: number;
  mouthScale?: number;
  freckles?: boolean;
  gloves?: boolean;
};
export const DEFAULT_AVATAR: Avatar = {
  name: 'Frankie',
  skin: ALIEN_SKIN,
  shirt: OUTFITS[0],
  hair: 0,
  eyes: 0,
  mouth: 0,
  accessory: 0,
  height: 1,
  width: 1,
  hairColor: '#603821',
  eyeColor: '#294d5d',
  shoeColor: '#183e47',
  pattern: 4,
  brows: 0,
  nose: 0,
  beard: 0,
  eyeSpacing: 0.155,
  mouthScale: 1,
  freckles: false,
  gloves: true,
};
export const ITEMS = [
  {
    id: 'boost',
    name: 'Comet Boost',
    cost: 7,
    description: 'Add 3 to your next roll.',
  },
  {
    id: 'double',
    name: 'Double Orbit',
    cost: 10,
    description: 'Roll two dice this turn.',
  },
  {
    id: 'magnet',
    name: 'Point Magnet',
    cost: 8,
    description: 'Collect 8 points immediately.',
  },
  {
    id: 'warp',
    name: 'Tractor Beam',
    cost: 12,
    description: 'Ride to the space before the diamond.',
  },
  {
    id: 'steal',
    name: 'Sneaky Seagull',
    cost: 10,
    description: 'Take up to 5 points from the richest rival.',
  },
  {
    id: 'shield',
    name: 'Orbit Shield',
    cost: 6,
    description: 'Block your next red-space or ecosystem hazard penalty.',
  },
  {
    id: 'five',
    name: 'Lucky +5',
    cost: 11,
    description: 'Add 5 spaces to your next dice roll.',
  },
  {
    id: 'mini',
    name: 'Shrink Ray',
    cost: 5,
    description: 'Roll 1–5 and squeeze through tiny wormhole shortcuts.',
  },
  {
    id: 'mega',
    name: 'Growth Ray',
    cost: 12,
    description: 'Roll two dice and stomp rivals you pass for 10 points each.',
  },
] as const;
export type SpaceKind =
  | 'blue'
  | 'red'
  | 'lucky'
  | 'event'
  | 'shop'
  | 'lottery'
  | 'start'
  | 'bank'
  | 'hazard'
  | 'spring'
  | 'portal'
  | 'thief'
  | 'villain'
  | 'switch';
export type Space = {
  id: number;
  x: number;
  z: number;
  type: SpaceKind;
  next: number[];
  /** Wormhole shortcuts only a Shrink Ray traveller can enter. */
  miniNext?: number[];
};
export type TeamColor = 'blue' | 'red';
/** Landing color decides minigame teams. Other spaces flip a coin. */
export function spaceColor(kind: SpaceKind): TeamColor | undefined {
  if (kind === 'blue' || kind === 'start') return 'blue';
  if (kind === 'red' || kind === 'hazard' || kind === 'villain') return 'red';
  return undefined;
}
export const NABBER = 'Nabbit';
export const VILLAIN = 'Captain Klaxon';
/** Quick reactions friends can send during an online party. */
export const EMOTES = ['👋', '😂', '😱', '🎉', '😡', '👏', '🤞', '💤'];
export const SPACE_INFO = {
  lottery: {
    color: '#ed91ee',
    name: 'Lottery: stop and scratch',
    mark: 'LOTTO',
  },
  bank: {
    color: '#f6d978',
    name: 'Bank: pass −5 / land JACKPOT',
    mark: 'BANK',
  },
  hazard: { color: '#eb7649', name: 'Ecosystem hazard', mark: '!' },
  spring: { color: '#75e0cc', name: 'Ecosystem treasure +8', mark: '+8' },
  portal: { color: '#75a4fa', name: 'Portal to the next district', mark: '»' },
  thief: {
    color: '#c68cef',
    name: 'Nabbit: pay to steal points or a diamond',
    mark: 'NAB',
  },
  villain: {
    color: '#4a3366',
    name: 'Captain Klaxon: something nasty happens',
    mark: '☠',
  },
  switch: { color: '#ffbfa4', name: 'Shortcut switch +4', mark: '⇄' },
  blue: { color: '#23b5ee', name: 'Points +3', mark: '+' },
  red: { color: '#f66c6b', name: 'Points −3', mark: '−' },
  lucky: { color: '#ffc63c', name: 'Lucky gift', mark: '✦' },
  event: {
    color: '#ab77ea',
    name: 'Planet event: everyone loses up to 20',
    mark: '✹',
  },
  shop: { color: '#42ddaf', name: 'Item shop', mark: '$' },
  start: { color: '#fff6d6', name: 'Start / lap +10', mark: '↻' },
};
export const BOARD: Space[] = getBoard('crown').spaces;
export { ARCADE as MINIGAMES } from './arcade/catalog';
