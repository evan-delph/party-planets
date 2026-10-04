export const REMIX_IDS = [
  'tidetiles',
  'cannoncay',
  'prickleice',
  'crabtraffic',
  'crumbleclock',
  'lanternlurk',
  'vinevault',
  'mangrovemotors',
  'bubbletrouble',
  'frostyfreight',
  'pelicanpilots',
  'hotelhiccup',
  'picklepatrol',
  'mangosluggers',
  'geckograffiti',
  'skewergallery',
  'boulderbuffet',
  'returnsender',
] as const;
export type RemixKind = (typeof REMIX_IDS)[number];
type Meta = {
  name: string;
  category: string;
  duration: number;
  brief: string;
  controls: string;
  action: string;
  tip: string;
  policy: 'survival' | 'race' | 'points';
  teams: boolean;
  heats: boolean;
  /** Briefing for the fixed-solo board 1 vs 3 version. */
  soloBrief?: string;
  /** Per-role controls in a 1 vs 3 where the solo alien plays differently. */
  roles?: Record<'solo' | 'team', { controls: string; action: string; tip: string }>;
};
const entry = (
  name: string,
  category: string,
  duration: number,
  brief: string,
  controls: string,
  action: string,
  tip: string,
  policy: Meta['policy'] = 'points',
  teams = false,
  heats = false,
): Meta => ({
  name,
  category,
  duration,
  brief,
  controls,
  action,
  tip,
  policy,
  teams,
  heats,
});
export const REMIX_META: Record<RemixKind, Meta> = {
  tidetiles: entry(
    'Caldera Critter',
    'Lava chase',
    40,
    'Bait the lava critter’s charge, then dodge erupting fissures. Last alien standing wins.',
    'WASD: move · Space: hop',
    'Hop',
    'Dodge as soon as it turns: the critter charges quickly and grows throughout the round. Orange fissures erupt after the warning.',
    'survival',
  ),
  cannoncay: entry(
    'Snowball Showdown',
    'Ice survival',
    40,
    'Snow sentries wind up and throw across the frozen pond. Dodge their shots and outlast your rivals.',
    'WASD: move · E: brake',
    'Move',
    'Watch each sentry’s glowing aim line. Snowballs travel straight after release.',
    'survival',
  ),
  prickleice: entry(
    'Powder Panic',
    'Downhill skiing',
    45,
    'Ski down a winding mountain while an avalanche closes in. Dodge rocks, plant your poles and reach the finish.',
    'A/D: steer · Space: pole strokes · E: snowplow',
    'Plant poles',
    'Clean runs build speed up to 13.5 m/s. Straight skis accelerate fastest; rocks reset the streak. Hold Space for poles; E brakes.',
    'race',
  ),
  crabtraffic: entry(
    'Crustacean Crossing',
    'Migration survival',
    40,
    'Thread the gaps in a marching crab colony. Heavy crabs shove harder. Stay on the crescent shore.',
    'WASD: move',
    'Move',
    'Read the gaps before the herd reaches you. There is no jump shortcut.',
    'survival',
  ),
  crumbleclock: entry(
    'Comet Hoops',
    'Jump-shot contest',
    35,
    'Jump and shoot into moving hoops. Middle hoops score two; outer hoops score one.',
    'A/D: aim · Space: jump, then press again to shoot',
    'Jump / shoot',
    'Shoot while airborne. A filled hoop takes a moment to open again.',
  ),
  lanternlurk: entry(
    'Last-Second Spotlight',
    'Nerve & timing',
    32,
    'Let the night beast approach, then lift your flashlight. Stop it as close as possible across three heats.',
    'Space: raise flashlight once per heat',
    'Flashlight',
    'The light takes 0.18 seconds to lift. Too late means zero for that heat.',
  ),
  vinevault: entry(
    'Canopy Cadence',
    'Leaf climbing',
    35,
    'Read the next leaf, choose its side and jump. Climb higher than your rivals.',
    'A/D: choose side · Space: jump',
    'Jump',
    'A wrong-side leap drops you two leaves. The next two leaves are visible.',
  ),
  mangrovemotors: entry(
    'Buoy Bandits',
    'Open-water race',
    45,
    'Pilot a boat through eight numbered buoy gates in order. Cut tight turns without skipping a gate.',
    'WASD: steer · Space: throttle · E: brake',
    'Throttle',
    'High speed means wider turns. Enter every gate before heading to the next.',
    'race',
  ),
  bubbletrouble: entry(
    'Reef Ring Rally',
    'Underwater collection',
    40,
    'Swim through drifting rings before your rivals claim them. Gold rings score three. Dodge jellyfish.',
    'WASD: swim · Space: surge',
    'Surge',
    'Line up before a ring crosses your depth. Each ring can be collected only once.',
  ),
  frostyfreight: entry(
    'Summit Signal',
    '2 vs 2 climbing',
    55,
    'Climb together, then anchor when the blizzard warning appears. An unanchored partner drags both climbers back.',
    'W/S: climb · Space: reach · E: anchor',
    'Reach',
    'Hold E during the gust. Both partners must reach the top.',
    'race',
    true,
  ),
  pelicanpilots: entry(
    'Kite Coast Crew',
    '2 vs 2 parasailing',
    40,
    'One partner pilots the boat past crates while the other steers a kite through floating tokens.',
    'WASD: steer · Space: boat throttle / kite tuck · E: brake / rise',
    'Throttle / tuck',
    'The rope couples both players. Crates slow your boat and pull the kite down.',
    'points',
    true,
  ),
  hotelhiccup: entry(
    'Postcard Puzzle',
    'Picture puzzle',
    45,
    'Restore a six-piece vacation postcard. Swap pieces and rotate them until the picture matches.',
    'Arrows: select · Space: pick / swap · E: rotate',
    'Pick / swap',
    'A glowing border means both the position and rotation are correct.',
    'race',
  ),
  picklepatrol: entry(
    'Signal Snap',
    'Reaction & aiming',
    40,
    'Wait for the beacon’s shape, aim at the matching balloon and fire. First correct hit earns three.',
    'WASD: aim · Space: fire',
    'Fire',
    'Early or wrong shots lock your cannon until the next signal. Simultaneous first hits share the bonus. Shapes distinguish the colors.',
  ),
  mangosluggers: entry(
    'Tap Launch',
    'Ten-second long jump',
    13,
    'Tap as many times as you can in ten seconds, then launch into a long jump. Most taps travels farthest!',
    'Space: tap repeatedly',
    'Tap!',
    'Every fresh button press adds jump distance. Holding a button does not count as repeated taps.',
  ),
  geckograffiti: entry(
    'Relic Rendezvous',
    '2 vs 2 maze quest',
    60,
    'Find your team’s two relics, carry one each, then meet your partner at the central shrine.',
    'WASD: move · Space: collect relic · E: partner marker',
    'Collect',
    'One relic per player. Both partners must bring their relic to the shrine.',
    'race',
    true,
  ),
  skewergallery: entry(
    'Beacon Keepers',
    '1 vs 3 water chase',
    52,
    'Protect a beacon while three rivals try to soak it. Everyone gets a turn carrying the light.',
    'WASD: move / aim · Space: dash / water blast · E: brace',
    'Dash / spray',
    'Columns block water shots. Three direct hits extinguish the beacon.',
    'points',
    false,
    true,
  ),
  boulderbuffet: entry(
    'Ripple Rumble',
    '1 vs 3 wave battle',
    52,
    'Balance on the saucer while three opponents splash waves toward it. Everyone gets the solo role.',
    'WASD: move / balance · Space: jump, then splash · E: crouch',
    'Jump / splash',
    'Coordinate arriving waves. The solo alien should lean against the incoming swell.',
    'points',
    false,
    true,
  ),
  returnsender: entry(
    'Parcel Panic',
    '2 vs 2 conveyor duel',
    45,
    'Race between six switches and send parcels back toward the other team. Protect your depot’s ten shields.',
    'WASD: move · Space: reverse nearby parcel',
    'Reverse',
    'Cover three lanes each, then help your partner. Each switch reverses one nearby parcel.',
    'points',
    true,
  ),
};
REMIX_META.skewergallery.soloBrief =
  'One alien carries the beacon for 30 seconds while three rivals try to soak it. Keep it lit to win the showdown; three hits and the team wins.';
REMIX_META.tidetiles.soloBrief =
  'One alien rides the lava critter for 30 seconds: steer it and charge to bowl over the other three. Catch everyone to win; one survivor wins it for the team.';
REMIX_META.cannoncay.soloBrief =
  'One alien commands the snow sentries from the ice tower, aiming each throw across the pond. One hit knocks a runner out; get all three in 30 seconds to win.';
REMIX_META.tidetiles.roles = {
  solo: {
    controls: 'WASD: steer the critter · Space: charge',
    action: 'Charge',
    tip: 'Charges are fast but recharge for two seconds. Herd runners toward walls and erupting fissures, then charge.',
  },
  team: {
    controls: 'WASD: move · Space: hop',
    action: 'Hop',
    tip: 'A ridden critter is low enough to hop over. Spread out so it can only chase one of you, and stay off glowing fissures.',
  },
};
REMIX_META.cannoncay.roles = {
  solo: {
    controls: 'WASD: aim the reticle · Space: throw',
    action: 'Throw',
    tip: 'Throws come from the glowing sentry and the next one loads after each throw. Aim where runners are heading, not where they are.',
  },
  team: {
    controls: 'WASD: move · E: brake',
    action: 'Move',
    tip: 'Watch the glowing sentry and its aim line. One hit and you are out, but one survivor wins it for the team.',
  },
};
REMIX_META.boulderbuffet.soloBrief =
  'One alien balances on the saucer for 30 seconds while three rivals splash waves at it. Stay aboard to win; fall off and the team wins.';
export function remixInfo(id: string): Meta | undefined {
  return REMIX_META[id as RemixKind];
}
