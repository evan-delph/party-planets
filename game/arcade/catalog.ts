import { GRAND_CATALOG, grandInfo } from './grand-catalog';
import { remixInfo } from './remix-catalog';
export const ALL_ARCADE = [
  {
    id: 'canopy',
    name: 'Canopy Crush',
    category: 'Survival',
    duration: 45,
    accent: '#ffd263',
    brief:
      'You are inside a giant book! Falling paper speeds up early. Stay inside a cutout: touching the descending page knocks you out.',
    controls: 'WASD / arrows: move',
    action: 'Move into a glowing opening',
    tip: 'Look for the next safe opening early. A hole can fit more than one alien.',
  },
  {
    id: 'bumper',
    name: 'Bumper Buns',
    category: 'Bumper battle',
    duration: 50,
    accent: '#f49aa5',
    brief:
      'Build momentum on your beach ball and bump the others into the sea. Last one standing wins.',
    controls: 'WASD / arrows: steer · Space: dash',
    action: 'Dash',
    tip: 'Brake by steering against your momentum. A missed charge can send you over the edge.',
  },
  {
    id: 'rope',
    name: 'Sizzle Skippers',
    category: 'Jump survival',
    duration: 45,
    accent: '#ff9668',
    brief:
      'Jump over the spinning grill bar. It speeds up and changes pace. Three burns and you are out!',
    controls: 'Space: jump · Hold briefly for a higher jump',
    action: 'Jump',
    tip: 'Watch the approaching bar. Release sooner for a short hop, hold for a longer jump.',
  },
  {
    id: 'coconut',
    name: 'Coconut Crossfire',
    category: 'Arena battle',
    duration: 55,
    accent: '#93d8a0',
    brief:
      'Face a rival, grow a coconut, then send them flying. Bigger coconuts hit harder but slow you down.',
    controls: 'WASD / arrows: move & aim · Hold Space: charge · Release: throw',
    action: 'Hold & throw',
    tip: 'Move to face a rival before charging. You can turn while charging. Dodge sideways and protect the center.',
  },
  {
    id: 'race',
    name: 'Turbo Tide',
    category: 'Drag race',
    duration: 40,
    accent: '#65cbe8',
    brief:
      'Hold the throttle and shift through five gears. Clean shifts in the green RPM band win the race.',
    controls: 'Hold Space: throttle · E / Shift / ↑: shift gear',
    action: 'Throttle',
    tip: 'Shift in the green band. Early shifts bog the engine down; the redline wastes speed.',
  },
  {
    id: 'duos',
    name: 'Cavern Kayaks',
    category: '2 vs 2 river race',
    duration: 90,
    accent: '#b79df3',
    brief:
      'Paddle a winding cave river with your teammate. Dodge rocks and fire-breathing stone dragons. The first kayak out wins!',
    controls: 'A/D: lean · Space: row · E: brace',
    action: 'Row',
    tip: 'Each partner paddles one side. Match strokes for speed and straight travel; unmatched strokes turn the kayak. Lean to dodge the warning flames.',
  },
  {
    id: 'sky',
    name: 'Skybridge Sprint',
    category: 'Cloud obstacle race',
    duration: 65,
    accent: '#c2e5f3',
    brief:
      'Race across winding sky islands and moving platforms. Reach each island in order. Checkpoint arches catch you after a fall.',
    controls: 'WASD / arrows: move · Space: jump · E: walk slowly',
    action: 'Jump',
    tip: 'Thin walkways and sliding platforms need careful landings. Hold E to walk slowly; hold Space briefly for a longer leap. Gold arches save your progress.',
  },
  {
    id: 'bomb',
    name: 'Bomb Domb',
    category: 'Bomb survival',
    duration: 75,
    accent: '#ff9569',
    brief:
      'Bombs fall from the sky. Pick one up, aim, and throw it at your rivals. Anyone caught in a blast is out. Last survivor wins.',
    controls: 'WASD: move & aim · Space: pick up / throw · E: dash',
    action: 'Pick / throw',
    tip: 'Red-orange blinking gets faster as the fuse runs out. Throwing never resets the timer; leave room to escape the blast.',
  },
  {
    id: 'paint',
    name: 'Moss Bosses',
    category: 'Territory hopping',
    duration: 45,
    accent: '#b8df89',
    brief:
      'Aim, charge a mushroom hop, and stamp the moss in your color. Overwrite your rivals. Most colored tiles wins!',
    controls: 'WASD: aim · Hold Space: charge · Release: hop & stamp',
    action: 'Charge & hop',
    tip: 'You travel by hopping. Longer holds travel farther. Steal a rival’s patch or claim fresh ground around the flower pond.',
  },
  {
    id: 'dig',
    name: 'Picture Perfect',
    category: 'Eight-piece puzzle race',
    duration: 90,
    accent: '#e5bd88',
    brief:
      'Study the completed picture, then rebuild it from eight scattered pieces. Pick up, rotate, and place. First complete puzzle wins!',
    controls: 'WASD: move cursor · Space: pick up / place · E: rotate',
    action: 'Pick / place',
    tip: 'Only the correct position AND rotation locks a piece. A wrong placement stays loose so you can pick it up again.',
  },
  {
    id: 'skate',
    name: 'Aurora Glide',
    category: 'Ice circuit race',
    duration: 65,
    accent: '#a6caf2',
    brief:
      'Skate four full laps around the iceberg. Keep your speed through the bends; snowbanks slow you down.',
    controls: 'Hold Space: skate · A/D or ←/→: steer · E: brake',
    action: 'Skate',
    tip: 'Start by steering left around the iceberg. Your skates drift, so turn early and brake if you are heading for a snowbank.',
  },
  {
    id: 'factory',
    name: 'Bun & Done',
    category: '2 vs 2 conveyor kitchen',
    duration: 55,
    accent: '#bdabec',
    brief:
      'Work together in the orbital diner. Load a bun onto a moving tray, then add filling. Completed orders score at the delivery window.',
    controls: 'WASD: move · Space: pick up / place · E: discard',
    action: 'Pick / place',
    tip: 'Player 1 of each team starts by the bun bin; player 2 starts by the filling bin. Follow the moving trays. Buns must go on first.',
  },
  ...GRAND_CATALOG.map((m) => ({ ...m, ...remixInfo(m.id) })),
] as const;
export const ARCADE = ALL_ARCADE.slice(0, 30);
// Canonical indices stay fixed so saved games never turn into a different title.
export const AVAILABLE_ARCADE = ARCADE.map((game, index) => ({
  ...game,
  index,
})).filter((game) => !['factory', 'crumbleclock'].includes(game.id));
/** Board minigames are offered by team shape: 4-player free-for-all, 1 vs 3, or 2 vs 2. */
export type MiniMode = 'ffa' | '1v3' | '2v2';
export const MODE_LABEL: Record<MiniMode, string> = {
  ffa: '4-Player',
  '1v3': '1 vs 3',
  '2v2': '2 vs 2',
};
const TEAM_MODES: Record<string, MiniMode> = {
  duos: '2v2',
  factory: '2v2',
  frostyfreight: '2v2',
  pelicanpilots: '2v2',
  geckograffiti: '2v2',
  returnsender: '2v2',
  skewergallery: '1v3',
  boulderbuffet: '1v3',
};
export function miniMode(index: number): MiniMode {
  return TEAM_MODES[arcadeInfo(index).id] ?? 'ffa';
}
export const DEFAULT_MINIGAME_POOL: string[] = AVAILABLE_ARCADE.map(
  (game) => game.id,
);
export function normalizeMinigamePool(value?: unknown): string[] {
  if (value === undefined) return [...DEFAULT_MINIGAME_POOL];
  if (
    !Array.isArray(value) ||
    value.length > ARCADE.length ||
    value.some(
      (id) => typeof id !== 'string' || !DEFAULT_MINIGAME_POOL.includes(id),
    )
  )
    throw Error('Choose valid minigames for the party.');
  const ids = [...new Set(value as string[])];
  if (!ids.length) throw Error('Keep at least one board minigame selected.');
  return ids;
}
export type ArenaKind = (typeof ALL_ARCADE)[number]['id'];
export function arcadeInfo(index: number) {
  return ALL_ARCADE[index] ?? ALL_ARCADE[0];
}
export function scoreLabel(index: number, score: number) {
  const kind = arcadeInfo(index).id;
  if (kind === 'mangosluggers') return `${(score / 100).toFixed(2)} m jump`;
  if (kind === 'dig')
    return score >= 90000
      ? `${((100000 - score) / 100).toFixed(2)}s finish`
      : `${Math.floor(score / 1000)} / 8 pieces`;
  if (kind === 'duos')
    return score >= 90000
      ? `${((100000 - score) / 100).toFixed(2)}s finish`
      : `${Math.floor((score / 89999) * 100)}% river`;
  const info = remixInfo(kind) ?? grandInfo(kind ?? '');
  if (info && info.policy !== 'survival') {
    if (info.policy === 'accuracy') return `${score}% accuracy`;
    if (info.policy === 'race')
      return score >= 90000
        ? `${((100000 - score) / 100).toFixed(2)}s finish`
        : `${Math.min(99, Math.floor((score / 89999) * 100))}% progress`;
    return `${score} points`;
  }
  if (kind === 'paint') return `${score} tiles`;
  if (kind === 'factory') return `${score} orders`;
  if (kind === 'sky' || kind === 'skate') {
    if (score >= 90000) return `${((100000 - score) / 100).toFixed(2)}s finish`;
    return kind === 'sky'
      ? `Island ${Math.floor(score / 500) + 1} / 16`
      : `${Math.floor(score / 1000)} / 4 laps`;
  }
  if (kind === 'race') {
    if (score >= 90000) return `${((100000 - score) / 100).toFixed(2)}s finish`;
    return kind === 'race'
      ? `${Math.min(100, Math.floor((score / 6200) * 100))}% distance`
      : `Stage ${Math.min(3, Math.floor(score / 1000) + 1)}`;
  }
  return score >= 100000
    ? `${((score - 100000) / 100).toFixed(1)}s · Survived`
    : `${(score / 100).toFixed(1)}s`;
}
