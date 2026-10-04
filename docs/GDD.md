# Party Planets — Game Design Document

**Version 0.7 · September 10, 2026 · Current browser implementation**

Party Planets is an editable 3D board-and-minigame party game about green alien tourists visiting three worlds. Four competitors collect points, buy diamonds and compete in short action games. The current release contains **three planets, nine boards and 30 selectable minigames**. It is a procedural browser game with local solo play and a server-backed online mode. Larger production art, a public online service and console releases remain future work.

## Match flow and settings

Choose a planet and one of its three boards from the initial menu, customize an alien, then open the game settings before launching. Defaults are 10 rounds, a three-diamond victory target and Normal AI. Available limits are 5/10/15/20/30 rounds; each round gives every player one board turn and then a minigame. The diamond target can be disabled or set to 1/3/5/10. AI difficulty is Easy, Normal or Expert, shared by the CPU seats in that match.

1. A UFO arrives with all four aliens aboard and lands by the first space.
2. Each alien leaves the UFO on their first roll. The ramp closes after everyone has taken that first roll.
3. A turn announcement introduces the active player. They may use one inventory item, then roll a ten-sided die. The central die spins, reveals the result and fades.
4. The alien walks the rolled distance. Route choices appear only upon reaching a fork; movement pauses until a choice is made. Closed shortcuts leave only the main road available.
5. Passing certain spaces deposits points or purchases a diamond. The final space applies its landing effect, with a visible reaction and sound.
6. After all four turns, everyone votes between three distinct minigames. The option with the most votes wins. Equal leaders enter a random tiebreak limited to those tied games. Players may change their ballot until it closes; CPUs vote too. The ballot lasts up to 20 seconds.
7. A briefing and ready countdown precede the game. Results award points, then the next round begins. The arcade menu also launches any of the 30 games directly for practice.

## Economy and victory

Every player begins with 20 points, no diamonds and a Comet Boost. A diamond costs **50 points**. Exactly one yellow, glowing diamond destination is active on the board. Reaching it with sufficient points purchases it automatically, including when passing through during a longer move. Its replacement is chosen from eligible spaces 8–18 directed steps away; start, bank, hazard and portal spaces are excluded, and no replacement may be occupied by any player.

Reaching an enabled diamond target ends the match immediately with the winner's cinematic. Otherwise the final round's minigame leads into the ship lounge and three bonus awards:

| Award           | Qualification                                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Point Collector | Highest point balance at the end of the match, before bonus awards.                                                                         |
| Rough Landing   | Most landings on red, hazard or event spaces that actually reduced that player's points. It counts landings, not the number of points lost. |
| Event Explorer  | Most event-space landings, including an event landed on with no points remaining.                                                           |

Each category grants one diamond to every tied leader. Rough Landing and Event Explorer award nothing if all players have zero qualifying landings. A player losing points because somebody else triggered an event does not receive a Rough Landing count for that remote loss. Bank deposits and item spending are not qualifying loss landings.

Final ranking uses diamonds first and remaining points second. A complete tie on both values currently resolves by seat order. The enabled target applies to normal board purchases; the end-of-match ceremony completes all three awards before ranking the crew.

## Board spaces and items

Each board contains 138 spaces with distinct central symbols, rounded connecting roads, four decision junctions, named districts and moving scenery. Nimbus Reef includes one three-way fork; the other forks offer two roads. Earth retains its existing routes. The six alien boards use new authored networks. Minimum center spacing is 3.12 world units, apart from floating-point rounding.

| Space                      | Effect                                                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Blue / red                 | Gain 3 points / lose up to 3 points.                                                                                               |
| Bank                       | Passing while movement remains deposits up to 5 points into the shared pot. Landing collects the entire pot and resets it to zero. |
| Ecosystem hazard           | Lose up to 5–8 points according to the board. Aurora Alps and Mossveil can also push the player back along the current trail.      |
| Event                      | Trigger the board's landmark phenomenon and distance-based point losses for all four players.                                      |
| Lucky / ecosystem treasure | Lucky gives an item or 8 points; treasure gives 8 points.                                                                          |
| Shop                       | Buy an item during the landing phase. Inventory holds three items.                                                                 |
| Portal                     | Travel to the next portal on that board.                                                                                           |
| Trickster                  | Take up to 6 points from the richest rival.                                                                                        |
| Switch                     | Toggle shortcut access and gain 4 points.                                                                                          |
| Start                      | Returning to the landing pad gives 10 points.                                                                                      |

Items are Comet Boost (+3 to the next roll; 7 points), Double Orbit (two dice; 10), Point Magnet (+8 points; 8), Tractor Beam (move before the diamond; 12), Sneaky Seagull (take up to 5 from the richest rival; 10) and Orbit Shield (block the next red-space or ecosystem-hazard penalty; 6). Orbit Shield does not block a global event.

Minigame placement pays 10/6/3/1 points. Tied scores share the corresponding placement award. Team games use their shared team result.

## Three planets and nine boards

| Planet  | Board and ecosystem                                                               | Landmark event       |
| ------- | --------------------------------------------------------------------------------- | -------------------- |
| Earth   | **Crown Cay** — tropical archipelago, harbor, lagoon bridges and volcanic gardens | Fireflower Eruption  |
| Earth   | **Aurora Alps** — snow shelves, hot springs and mountain switchbacks              | Cloudcap Avalanche   |
| Earth   | **Mossveil Ruins** — rainforest, braided river routes and ancient temples         | Sun Temple Awakening |
| Selene  | **Moonwake Basin** — crater desert, regolith ridges and lunar survey bridges      | Meteor Shower        |
| Selene  | **Prism Glacier** — crystal ice shelves, observatories and a resonance bridge     | Prism Resonance      |
| Selene  | **Emberfault Reach** — geothermal fissures, basalt rims and vent catwalks         | Mantle Blowout       |
| Verdara | **Lumen Canopy** — luminous jungle roots, fungal hollows and seed gardens         | Great Spore Bloom    |
| Verdara | **Nimbus Reef** — floating coral wetlands, mist islands and shell villages        | Sky-Tide Pulse       |
| Verdara | **Scarlet Drift** — crimson dunes, glass canyons and caravan roads                | Crimson Sandstorm    |

**Global events are triggered by landing on an event space.** Their visual source is the board landmark. Each funded player loses 1–20 points, with a larger loss nearer that landmark, capped by their current balance. The calculation uses the ceiling of `20 × (1 − distance / (board radius × 1.4))`, clamped to 1–20. A player with no points loses zero. These points leave the game and never enter the bank. Losses are calculated once by the rules simulation; particle collisions do not determine damage.

Every event has its own presentation: lava, snow, temple energy, meteor ejecta, prism light, steam, spores, a violet tidal pulse or red dust. Separate ambient scenery animations keep playing between turns; those decorative animations do not charge points.

## The 30 selectable minigames

The current roster retains the original 12 games and rebuilds 18 additional games around more specific rules, maps and interactions. The previous 50-game menu is no longer the current roster. Legacy entries remain in some source tables for compatibility.

| Original game     | Main interaction                                 |
| ----------------- | ------------------------------------------------ |
| Canopy Crush      | Reach openings before a giant canopy drops.      |
| Bumper Buns       | Build momentum and knock rivals from a platform. |
| Sizzle Skippers   | Time jumps over an accelerating grill bar.       |
| Coconut Crossfire | Charge and throw knockback projectiles.          |
| Turbo Tide        | Throttle and shift through a drag race.          |
| Pier Pressure     | Coordinate a gate, moving bridge and boat relay. |
| Skybridge Sprint  | Jump between winding islands and checkpoints.    |
| Molten Morsel     | Chase and pass a live hot potato.                |
| Moss Bosses       | Charge hops to stamp and steal territory.        |
| Relic Rumble      | Dig navigable tunnels and uncover treasure.      |
| Aurora Glide      | Steer and brake through an ice circuit.          |
| Bun & Done        | Coordinate a two-player conveyor kitchen.        |

| Rebuilt game          | Main interaction                                                  |
| --------------------- | ----------------------------------------------------------------- |
| Caldera Critter       | Bait a charging lava creature and dodge warned fissures.          |
| Snowball Showdown     | Read sentry aim lines and evade snowballs on ice.                 |
| Powder Panic          | Ski away from an avalanche using poles and a snowplow.            |
| Crustacean Crossing   | Find safe gaps through a shoving crab migration.                  |
| Comet Hoops           | Jump, aim and shoot into moving hoops.                            |
| Last-Second Spotlight | Raise a flashlight as late as possible across three heats.        |
| Canopy Cadence        | Choose the next leaf and climb with accurate jumps.               |
| Buoy Bandits          | Pilot a boat through eight gates in order.                        |
| Reef Ring Rally       | Surge through drifting rings and avoid jellyfish.                 |
| Summit Signal         | Climb as a pair and anchor both partners during gusts.            |
| Kite Coast Crew       | Couple boat steering with a partner's token-collecting kite.      |
| Postcard Puzzle       | Swap and rotate six picture pieces.                               |
| Signal Snap           | Identify a beacon's shape, aim and fire first.                    |
| Meteor Batters        | Time swings against thirty varied pitches.                        |
| Relic Rendezvous      | Find a relic each, then reunite at the shrine.                    |
| Beacon Keepers        | Rotate the solo beacon-carrier role against three water shooters. |
| Ripple Rumble         | Rotate the solo balancing role against three wave makers.         |
| Parcel Panic          | Defend a depot by reversing parcels across six conveyor lanes.    |

Game lengths and scoring vary by mode; the briefing is authoritative for controls and win conditions. Most games use WASD/arrows, Space and E/Shift. Touch controls and gamepad input are supported by the arcade input layer. Offline minigames can pause; an online match continues on the server.

## Characters, UI, cameras and presentation

All characters are slender green aliens with large eyes. Green skin is fixed. The studio supports names, height/build, eye and mouth choices, expression details, hair/head styling, accessories, outfit colors/patterns, shoes and gloves. Hawaiian shirts are included, with the mouth positioned above clothing. Saved avatars are reused on boards, inside the UFO and in minigames.

The menu shows three selectable planets, their board choices and an orbital view with the actual route layouts projected onto each planet. Players can drag/pan/orbit, zoom to a board and reset the camera. Board movement uses slower interpolated walking with a following camera. The interface includes clear turn/dice overlays, three-option voting, points/diamonds, a shared bank balance, item controls, event-loss summaries and bonus awards.

Reactions include walking/running, hopping, happy and sad expressions, point celebrations and diamond pickup effects. UFO arrival, first-roll exits and ramp closure introduce the match. Goal victories zoom in on the winner sipping a piña colada and doing a funny dance. The crew carries differently colored drinks, all with cocktail umbrellas, up the ramp; blue and green disco lights then circle the UFO rim. Turn-limit games board the ship, fly away and enter the lounge for bonus diamonds and the winner celebration. A bank jackpot flips a hovering cloth bag upside down and pours animated coins over the recipient. Sound effects accompany actions and rewards. Reduced motion, mute and lower graphics settings are available.

Graphics use Three.js geometry, procedural materials, lighting, shadows and animated props. The performance badge reports current frame delivery and can reduce detail under sustained load. Browser focus/throttling and hardware affect results; this document does not promise a frame-rate target.

## Offline, online and saves

The standalone HTML embeds the game code, styles and procedural assets. It plays one local human against three CPUs without a running server. It does not provide four-player networking by itself. Local avatar and solo-match data are stored in the browser; changing browsers, clearing storage or moving to a different origin can separate those saves.

The server edition supports four humans or fewer humans with CPUs filling the open seats. The host selects the board, round count, diamond target and shared CPU difficulty. Rooms use seat tokens, revisions, server timestamps and shared arena state. Friends need access to a reachable hosted server; a loopback address on one computer is not a public invitation link. Public hosting, matchmaking, accounts and production reconnect guarantees are separate infrastructure work.

Content revision 7 preserves compatible board progress and balances. Loss-space and event-space counters start at zero for older saves because prior landing history is unavailable. An older in-progress remade minigame can restart at its new briefing; outdated ballots refresh against the 30-game roster. Internal `shells`/`pearls` and `sp-*` save names remain for compatibility, while the interface says points and diamonds.

## Editing guide

| Change                                                                 | Source                                                                                       |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Economy, item values, avatar defaults and space symbols                | `game/config.ts`                                                                             |
| Turns, movement, voting, purchases, events, bonuses and save migration | `game/engine.ts`                                                                             |
| Planets, board themes, authored roads and landmarks                    | `game/boards.ts`                                                                             |
| Menus, setup, studio, lobby and HUD                                    | `game/Party.tsx`, `app/globals.css`                                                          |
| Alien model, motion and accessories                                    | `game/avatar.ts`                                                                             |
| Board render/camera, terrain and world props                           | `game/BoardScene.tsx`, `game/Surfaces.ts`, `game/PlanetScenery.ts`, `game/AlienScenery.ts`   |
| Whole-planet view                                                      | `game/Planetarium.ts`                                                                        |
| UFO, events, pickups and final cinematics                              | `game/Ufo.ts`, `game/BoardEffects.ts`, `game/Finale.ts`                                      |
| Roster, rules and new-game metadata                                    | `game/arcade/catalog.ts`, `remix-catalog.ts`, `simulation.ts`, `remix.ts`                    |
| Minigame environments and presentation                                 | `game/arcade/renderer.ts`, `expansion-renderer.ts`, `grand-renderer.ts`, `remix-renderer.ts` |
| Audio                                                                  | `game/audio.ts`                                                                              |
| Rooms and online validation                                            | `app/api/room/route.ts`                                                                      |
| Standalone packaging                                                   | `offline/main.tsx`, `scripts/build-offline.mjs`                                              |

From the source folder, `pnpm dev` starts an editing server. `pnpm build` followed by `pnpm start` runs the compiled local edition. `pnpm build:offline` writes `Party Planets - Offline.html` beside the source folder. Run the rules, arcade, geometry and online checks relevant to a change before replacing the distributed file. Preserve stable game IDs and use save migration when changing in-progress state formats.

Current art, animations and networking are implemented browser systems. A larger production release would need further playtesting and balancing, bespoke art/audio, broader device testing, an operated online service and platform-specific builds. Those are future development goals, not delivered features of v0.7.
