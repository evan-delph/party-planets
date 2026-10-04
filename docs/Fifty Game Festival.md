# Sausage Party — Fifty Game Festival

**Version:** 0.5 · **Date:** September 9, 2026 · **Status:** Fifty-game prototype integrated; automated checks, new-scene browser mounts, TypeScript, production and offline builds, and four-client local online checks passed.

The Festival update integrates **exactly fifty games**, preserving the original twelve and adding **38 new games**. It also adds direct board selection on the initial menu, wider board spacing, shorter shirts, and recurring environmental scenes. The arcade is searchable, and the match selection shuffles through the full catalog without repeating a game before the current cycle is exhausted. The verification record below distinguishes automated simulation, browser rendering, and completed builds from the manual and online checks still outstanding. Earlier twelve-game results remain historical.

## Choose a world from the initial menu

The initial menu now presents **Crown Cay**, **Aurora Alps**, and **Mossveil Ruins** as selectable world buttons. Selection updates the background board, welcome text, location label, and named Play button. Starting a new solo match uses that selection. Resume retains the saved match's own board, and an active match continues to use its recorded board. Online room creation also offers the world choice.

Each board still contains **138 spaces: 96 outer spaces and three 14-space shortcuts**. The node IDs, connections, bank locations, hazards, and existing board rules are retained. The shared bank starts at zero, takes up to five shells when passed, and pays the whole pot on a final landing without also charging that landing deposit.

## Wider paths and a clearer face

Board outlines and shortcuts are resampled by distance, then scaled to guarantee a minimum **3.05-unit separation between every pair of space centers**. This includes spaces that are close visually but are not neighbors in the movement graph. The generated coordinates inspected for this update had an actual minimum of **3.10 units on all three boards**. Previously, some near-junction pairs were less than one unit apart.

The geometry audit retained 138 nodes and 141 directed connections per board, with the original forks and full reachability. Crown Cay and Aurora Alps have outer steps of approximately 3.10 units. Mossveil keeps its broader, more angular footprint; its outer steps range from approximately 3.10 to 4.54 units. Terrain and board camera dimensions follow each generated radius. Walking presentation uses 14 world units per second. These are source geometry measurements, not new frame-rate or browser acceptance results.

Shirts are shorter, and their patterns and straps were shortened with them. The model-space shirt top is **0.96**, and the straps end at **0.95**. The inspected maximum-scale mouth begins around **1.206**, leaving approximately **0.246 units of geometric clearance** above the shirt. The mouth is also raised and moved forward. Idle board characters turn toward the camera; running characters face their travel direction. The studio restricts overhead orbit angles to help keep the face readable. Visual checks across the full creator range are still part of verification.

## Scenery throughout each minute

Each ecosystem now has a richer outer setting with nearby islets, buildings, trees, rocks, and distant landmarks. Crown Cay adds a lighthouse and coastal details; Aurora Alps adds mountain scenery; Mossveil adds marsh islands, foliage, and ruin structures.

Four short environmental scenes start at **0, 15, 30, and 45 seconds** within a repeating **60-second cycle**. Each individual scene therefore returns once per minute. Scenes last about 10–12 seconds and are cosmetic: they do not charge shells, trigger a gameplay hazard, or change board state.

| Cycle offset   | Crown Cay                | Aurora Alps         | Mossveil Ruins                 |
| -------------- | ------------------------ | ------------------- | ------------------------------ |
| **0 seconds**  | Harbor merchant sailboat | Ridge cable car     | Temple awakening beam and halo |
| **15 seconds** | Gulls over the palms     | Aurora curtains     | Firefly gathering              |
| **30 seconds** | Dolphin cove             | Snow fox crossing   | Marsh frog chorus              |
| **45 seconds** | Caldera steam            | Distant powder gust | Ruins canoe                    |

The scenic clock advances during visible board frames and skips hidden-tab time, studio time, and long frame gaps. Reduced-motion mode shows a static pose during each scene's active window. Low-detail mode uses fewer decorative objects. The performance meter distinguishes background frame-delivery throttling from active rendering load; the recorded Festival samples below exclude background throttling.

## The complete fifty-game catalog

The first twelve entries carry forward the previous action-game catalog. Entries 13–50 are the new Festival games. All fifty are integrated into the arcade and match selection. The descriptions below summarize each game's format and interaction. “Rotating 1 vs 3” gives each participant a turn in the solo role.

|   # | Game                   | Type and interaction                                                                                    |
| --: | ---------------------- | ------------------------------------------------------------------------------------------------------- |
|   1 | **Canopy Crush**       | Free-for-all survival: run into openings before the treetop canopy falls.                               |
|   2 | **Bumper Buns**        | Free-for-all bumper battle: steer with momentum and dash rivals off a shrinking platform.               |
|   3 | **Sizzle Skippers**    | Free-for-all jump survival: avoid the rotating grill bar; three burns eliminate a player.               |
|   4 | **Coconut Crossfire**  | Free-for-all projectile battle: charge coconuts and knock opponents out of the arena.                   |
|   5 | **Turbo Tide**         | Free-for-all drag race: hold throttle and time shifts through five gears.                               |
|   6 | **Pier Pressure**      | Two vs two relay: operate a gate, cross a moving platform, and alternate boat strokes.                  |
|   7 | **Skybridge Sprint**   | Free-for-all obstacle race: jump through a sequence of sky islands and checkpoints.                     |
|   8 | **Molten Morsel**      | Free-for-all hot-potato survival: pass a sizzling morsel before its unchanged fuse expires.             |
|   9 | **Moss Bosses**        | Free-for-all territory contest: charge hops and stamp tiles in your color.                              |
|  10 | **Relic Rumble**       | Free-for-all treasure hunt: dig tunnels and uncover scoring relics.                                     |
|  11 | **Aurora Glide**       | Free-for-all ice race: steer, skate, and brake through four laps.                                       |
|  12 | **Bun & Done**         | Two vs two conveyor kitchen: load buns and fillings onto moving trays in the correct order.             |
|  13 | **Tide Tiles**         | Free-for-all survival: read the beacon and reach matching islands before the others sink.               |
|  14 | **Cannonball Cay**     | Free-for-all survival: avoid marked cannonball impacts and brace against raft movement.                 |
|  15 | **Prickle on Ice**     | Free-for-all survival: slide around bouncing urchins, jump small ones, and brake.                       |
|  16 | **Crab Traffic**       | Free-for-all survival: find gaps in crossing crab herds and avoid the pier edges.                       |
|  17 | **Crumble Clock**      | Free-for-all survival: move between countdown blocks before they disappear.                             |
|  18 | **Lantern Lurk**       | Free-for-all survival: shade a lantern, use cover, and avoid a salamander's fire cone.                  |
|  19 | **Vine Vault**         | Free-for-all climbing race: jump between alternating leaves and use checkpoints.                        |
|  20 | **Mangrove Motors**    | Free-for-all boat race: raise throttle through rapids and spend limited emergency brakes.               |
|  21 | **Bubble Trouble**     | Free-for-all swimming race: follow pearl buoys, manage sprint energy, and dive under mines.             |
|  22 | **Frosty Freight**     | Two vs two sled race: split steering, pushing, leaning, and barrier-jumping duties.                     |
|  23 | **Pelican Pilots**     | Two vs two flight race: coordinate steering and flapping through hoops while managing lift and heat.    |
|  24 | **Hotel Hiccup**       | Free-for-all escape race: discover and remember the working door on each floor.                         |
|  25 | **Pickle Patrol**      | Free-for-all tank survival: fire ricocheting pickle bolts, break cover, and manage reloads.             |
|  26 | **Mango Sluggers**     | Free-for-all batting contest: time swings and choose loft or a bunt for scoring hits.                   |
|  27 | **Gecko Graffiti**     | Two vs two target painting: lead shots onto moving gecko boats and claim team colors.                   |
|  28 | **Skewer Gallery**     | Rotating 1 vs 3 targeting: take turns shooting skewers and dodging behind moving cover.                 |
|  29 | **Boulder Buffet**     | Rotating 1 vs 3 targeting: roll melons downhill as the solo chef or climb past them.                    |
|  30 | **Return to Sender**   | Two vs two conveyor defense: operate belt switches and send parcels toward the rival depot.             |
|  31 | **Sundae Summit**      | Free-for-all collection: catch scoops and stabilize a growing, wobbling stack.                          |
|  32 | **Postcard Panic**     | Free-for-all delivery: carry envelopes to moving carts, matching express-mail colors.                   |
|  33 | **Rain Garden**        | Free-for-all collection: move a planter beneath rain and protect its water from gusts.                  |
|  34 | **Parasol Pearls**     | Free-for-all collection: steer through pearls while changing descent speed and avoiding jellyfish.      |
|  35 | **Coinquake**          | Free-for-all collection: gather coins, avoid falling metal coconuts, and bank vulnerable carried coins. |
|  36 | **Hook, Line & Lunch** | Free-for-all fishing: aim a charged cast, hook snack rafts, and balance reeling against line tension.   |
|  37 | **Coconut Compass**    | Free-for-all coverage race: tilt a tabletop to roll a marble over every square.                         |
|  38 | **Fossil Fillet**      | Free-for-all accuracy puzzle: engrave a fossil outline while avoiding extra cuts.                       |
|  39 | **Lost Luggage**       | Free-for-all memory puzzle: restore nine cases to their remembered slots and orientations.              |
|  40 | **Dough Doppelganger** | Free-for-all accuracy puzzle: drag six dough-face handles to match a target.                            |
|  41 | **Bento Blocks**       | Free-for-all falling-block puzzle: place ingredient pairs, clear groups, and build chains.              |
|  42 | **Picnic Partition**   | Two vs two clearing puzzle: eat sandwich sections and refill stamina at thermoses.                      |
|  43 | **Volley Buns**        | Two vs two volleyball: strike or set the ball, respecting the three-contact limit.                      |
|  44 | **Puck Picnic**        | Two vs two ice hockey: control the puck, charge shots, and defend the goal.                             |
|  45 | **Pineapple Strikers** | Two vs two target soccer: kick a shell into the rival team's pineapples and protect your own.           |
|  46 | **Goal Guava**         | Rotating 1 vs 3 sport: take turns keeping goal against three shooters.                                  |
|  47 | **Touchdown Tiki**     | Rotating 1 vs 3 sport: use limited runner boosts while defenders time tackles.                          |
|  48 | **Paddle Plunder**     | Two vs two collection sport: coordinate separate paddles to steer and collect pearl clusters.           |
|  49 | **Crate Escape**       | Rotating 1 vs 3 tactics: escape as the small crate while larger crates commit to tumbling moves.        |
|  50 | **Rubble Runners**     | Two vs two course race: break boulders so the team's snack cart can advance.                            |

Games use movement plus primary and secondary actions, with instructions tailored to each activity. Team vehicles, timed passes, charged actions, accuracy puzzles, and rotating solo roles have different control needs. Automated outcome checks and browser scene mounts support the current implementation, while comprehensive manual play across every role, controller configuration, and online condition remains outstanding.

## Editable locations

The existing studio options remain editable: eight hair choices, seven accessory choices, clothing patterns, brows, noses, beards, colors, eye spacing, mouth scale, freckles, gloves, and body proportions. The files below identify where to customize the Festival update.

| Change                                                                    | Exact source location                                             |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Initial-menu world buttons, creator controls, and game selection          | [game/Party.tsx](../game/Party.tsx)                               |
| Menu and creator layout styling                                           | [app/globals.css](../app/globals.css)                             |
| Board shapes, spacing, node types, radius, and walking speed              | [game/boards.ts](../game/boards.ts)                               |
| Board rendering, framing, icons, movement, and scenic clock               | [game/BoardScene.tsx](../game/BoardScene.tsx)                     |
| Outer scenery, minute offsets, scene duration, and animated props         | [game/BoardLife.ts](../game/BoardLife.ts)                         |
| Shirt height, patterns, face placement, and character animation           | [game/avatar.ts](../game/avatar.ts)                               |
| Avatar defaults, palette choices, items, and economy values               | [game/config.ts](../game/config.ts)                               |
| The 38 new game names, formats, durations, controls, and descriptions     | [game/arcade/grand-catalog.ts](../game/arcade/grand-catalog.ts)   |
| New game state, rules, shared mechanics, and CPU behavior                 | [game/arcade/grand.ts](../game/arcade/grand.ts)                   |
| The 38 new game environments, props, visual feedback, and scene rendering | [game/arcade/grand-renderer.ts](../game/arcade/grand-renderer.ts) |
| Main arcade catalog and score labels                                      | [game/arcade/catalog.ts](../game/arcade/catalog.ts)               |
| Shared simulation and original action games                               | [game/arcade/simulation.ts](../game/arcade/simulation.ts)         |
| The earlier six-game expansion                                            | [game/arcade/expansion.ts](../game/arcade/expansion.ts)           |
| Ready flow, input, pause, and replay integration                          | [game/arcade/ArcadeGame.tsx](../game/arcade/ArcadeGame.tsx)       |

The editable [GDD](GDD.md) incorporates this update as Appendix D.

## Verification and remaining work

The following checks passed for the Festival update:

- **19,879 rules assertions**, including nine complete matches and **450 deterministic arena runs**.
- **29,557 assertions across 13 groups** in the new-game suite.
- **44 performance assertions across eight cases**.
- An independent set of **600 simulations and 150 JSON save/replay checks**.
- **12 control-to-outcome probes**, plus **12 Tide Tiles cases** after its timer fix.
- Source geometry checks for board spacing, unchanged topology, and shirt/face clearance.
- Browser mounting of **all 38 new scenes**, with no renderer errors during those checks.
- Targeted browser UI checks: the studio mouth was fully clear above a striped shirt, and the initial menu's Play button launched the selected Mossveil board. The latest HUD placement is below the playfield.
- TypeScript validation and the production Vinext build. The standard build helper failed on Windows path handling; the direct fallback completed successfully.
- The latest **four-client local online test**, covering authorization, conflicting commands, readiness, concurrent controls, exact simulation agreement, stale inputs, input bounds, server-only scoring, and token-leak checks.
- A rebuilt standalone offline file of **1,496,372 bytes**, approximately **1.43 MiB**. Its inline JavaScript parses, and its scripts and styles have no external dependencies.

These are separate verification groups and should not be interpreted as a count of unique manual play sessions. Scene mounting confirms rendering initialization, not a completed human round or every role's behavior.

Observed active-browser performance ranged from **80–100 FPS** in the narrow **640-pixel pane**:

| Scene              | Observed FPS |
| ------------------ | -----------: |
| Tide Tiles         |       90–100 |
| Mango Sluggers     |       95–100 |
| Volley Buns        |    About 100 |
| Aurora Alps        |       85–100 |
| Mossveil Ruins     |        85–94 |
| Crown Cay          |     About 87 |
| Dough Doppelganger |     About 81 |
| Moss results view  |     About 80 |

Dough Doppelganger's sample also recorded a **17-millisecond 95th-percentile frame time** and **150 draw calls**. No renderer errors were observed in these additional checks. Background-throttled periods are excluded from the samples. The measurements describe the inspected session and viewport; they are not performance guarantees across hardware, window sizes, or full matches.

The successful four-client test uses the local online service; remote internet latency still needs real-world playtesting. Manual checks do not yet cover every internal role or team interaction or physical gamepad behavior. The game remains a prototype whose balance, difficulty, pacing, and presentation need further playtesting and tuning. No new deployment is claimed.
