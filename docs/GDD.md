# Party Planets — Game Design Document

**Version 0.8 · October 2026 · Current browser implementation**

Party Planets is a 3D board-and-minigame party game about green alien tourists on a holiday across four worlds. Four players (humans online or locally against CPUs) roll dice around hand-designed boards, collect points, buy diamonds, and fight it out in short action minigames between rounds. The game is entirely original: no characters, art, audio, maps or code from any other game.

The v0.8 release contains **four planets with one hand-designed board each, 28 minigames in the rotation, and real-time-feeling online rooms for up to four friends**. Boards, the UFO, the aliens and the Nabbit are Blender-built 3D models; terrain uses public-domain (CC0) scanned textures.

## Match flow and settings

Choose a planet in the solar-system menu, customize an alien in the Character Studio, then set up the party. Defaults are 10 rounds, a three-diamond goal and Normal AI. Round limits are 5/10/15/20/30; the diamond goal can be off or 1/3/5/10; AI difficulty (Easy, Normal, Expert) applies to every CPU seat.

1. The UFO lands beside the start space. Each alien steps off the ramp on their first roll; the ship lifts away once everyone is out.
2. A turn begins with the camera framing the active alien. They may use one item, then jump into the dice block (1–10; Shrink Ray 1–5; Double Orbit and Growth Ray roll two blocks).
3. The alien hops along the road space by space with a step counter overhead. Forks pause for a route choice. Passing a diamond, the bank or a Nabbit stop pauses for its decision too.
4. The final space applies its effect. Its color also decides the alien's team for this round's minigame.
5. After all four turns, everyone votes on three minigames for the round's team shape (below). Ties are broken randomly among the leaders. Votes can change until the ballot closes; CPUs vote too.
6. A briefing and ready check precede the minigame. Results pay points and the next round begins.

## Economy and victory

Everyone starts with 20 points, no diamonds and a Comet Boost. A diamond costs **50 points**. One glowing diamond waits on the board; passing or landing on it offers the purchase. After a purchase it moves 8–18 steps further along the roads to an unoccupied, eligible space.

Reaching the diamond goal ends the match immediately with the winner's cinematic. Otherwise the last round leads to the ship lounge and three bonus diamonds:

| Award           | Qualification                                                              |
| --------------- | -------------------------------------------------------------------------- |
| Point Collector | Highest point balance before bonuses.                                      |
| Rough Landing   | Most landings on red, hazard, event or villain spaces that cost points.    |
| Event Explorer  | Most event-space landings.                                                 |

Every tied leader receives the award; categories with no qualifying landings award nothing. Final ranking is diamonds first, points second.

## Minigame teams

Space colors decide the shape of each round's minigame, so landing spots matter beyond their points:

| Landings (blue : red) | Shape        | Payout                                                          |
| --------------------- | ------------ | --------------------------------------------------------------- |
| 4 : 0 or 0 : 4        | Free-for-all | 10 / 6 / 3 / 1 points by placing (ties share).                  |
| 2 : 2                 | 2 vs 2       | Each winner gets 10; a tie pays everyone 3.                     |
| 3 : 1 or 1 : 3        | 1 vs 3       | The lone color plays solo. A solo win pays 15; a trio win pays each of the three 10. |

Blue and start spaces count as blue; red, hazard and Captain Klaxon spaces count as red; every other space flips a coin. Each ballot offers only games built for that shape. Four games support 1 vs 3:

- **Beacon Keepers** and **Ripple Rumble**: the solo alien protects a beacon or balances on a saucer for 30 seconds.
- **Caldera Critter**: the solo alien rides the lava critter and charges at the other three.
- **Snowball Showdown**: the solo alien commands the snow sentries from an ice tower.

The trio wins if any one of them survives.

## Board spaces and items

| Space            | Effect                                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| Blue / red       | +3 / −3 points (doubled during the Last 5 Turns).                                                         |
| Lucky            | An item or 8 points.                                                                                      |
| Treasure         | +8 points.                                                                                                |
| Event            | The board's landmark phenomenon: every player loses 1–20 points, more the closer they are to it.          |
| Hazard           | Lose the board's hazard penalty (Orbit Shield blocks it).                                                 |
| Shop             | Buy items while landed; bags hold three.                                                                  |
| Lottery          | Pick and scratch a card for a prize.                                                                      |
| Bank             | Passing deposits up to 5 points; landing collects the pot.                                                |
| Jump pad         | Bounces you in an arc to the next pad around the board (Moonwake Basin).                                  |
| Nabbit stop      | Passing or landing lets you pay the Nabbit: 5 points to swipe 5–15 points from a rival, or 50 points to swipe a diamond. |
| Captain Klaxon   | A random villain strike: shakedown (−20), space toll (everyone −10), Equalizer Ray (split all points evenly), diamond relocation, or a Switcheroo place swap. |
| Start            | Passing the landing pad pays 10 points.                                                                   |

| Item          | Cost | Effect                                                                                           |
| ------------- | ---- | ------------------------------------------------------------------------------------------------ |
| Comet Boost   | 7    | +3 to the next roll.                                                                             |
| Double Orbit  | 10   | Roll two dice.                                                                                   |
| Point Magnet  | 8    | +8 points now.                                                                                   |
| Tractor Beam  | 12   | Ride to the space before the diamond.                                                            |
| Sneaky Seagull| 10   | Take up to 5 points from the richest rival.                                                      |
| Orbit Shield  | 6    | Block the next red, hazard or shakedown penalty.                                                 |
| Lucky +5      | 11   | +5 to the next roll (lottery prize).                                                             |
| Shrink Ray    | 5    | Roll 1–5 this turn and fit through the board's tiny wormhole shortcut.                           |
| Growth Ray    | 12   | Roll two dice and stomp every rival you pass for 10 points each.                                 |

## Last 5 Turns

When five rounds remain (three in matches shorter than 10 rounds), the game pauses for a standings check. The players in last place receive a catch-up boost, picked at random: +20 points, a Double Orbit and Growth Ray, or a bank bailout. Blue and red spaces pay double for the rest of the match.

## Four planets, four boards

| Planet  | Board                | Spaces | Gimmick                                                                                  | Event               |
| ------- | -------------------- | ------ | ---------------------------------------------------------------------------------------- | ------------------- |
| Earth   | **Crown Cay**        | 72     | Tides: the Lagoon Footbridge floods every other round.                                   | Fireflower Eruption |
| Selene  | **Moonwake Basin**   | 72     | Jump pads fling explorers around the crater rim.                                         | Meteor Shower       |
| Ignara  | **Emberfault Reach** | 70     | Eruptions: every third round lava overflows the Lava Bridge.                             | Mantle Blowout      |
| Verdara | **Nimbus Reef**      | 62     | Cloud ferry: every other round the ferry docks and opens the Storm Eye route.            | Sky-Tide Pulse      |

Every board has a Shrink Ray wormhole between two distant roads, at least one Nabbit stop, a Captain Klaxon space, shops, a bank and a lottery. Board gimmicks are visible in the world: water rises over the footbridge, lava floods the bridge, the ferry flies in and out, and a crossing barrier drops while a gimmick road is closed. Closed roads disappear from fork choices; other forks stay open.

Old saves from the nine-board v0.7 roster map to the closest new board, restart at the landing pad and keep everyone's points, diamonds and items.

## Characters and presentation

All characters are slender green aliens built from one Blender model with every Character Studio option as a swappable part: 8 hair styles, beards, 6 accessories, 5 shirt patterns (including overalls and Hawaiian shirts), gloves or bare hands, eyes, brows, noses, mouths, height and build. The same alien appears on boards, inside the UFO, in minigames and in the finale.

The solar-system menu shows four Blender-baked planets with clouds, glowing atmospheres and night sides orbiting a bright sun. Boards use splat-blended scanned terrain, themed props and per-world skies. The HUD uses a sticker style with hand-drawn SVG art. Dice blocks, step counters, score pop-ups, coin bursts, stomps and steals animate on the board. Settings include reduced motion, mute, music volume and a performance mode; a live frame-rate badge reduces detail under sustained load.

## Online, offline and saves

**Online rooms** seat up to four humans; CPUs fill open seats at the host's difficulty. The host creates a room and shares an 8-character code or an invite link (`?join=CODE`). The server runs the rules and minigame simulations authoritatively, and clients poll quickly (about every 0.2 s during action) with small "nothing changed" replies when the state is idle. Players can send quick emotes. If a player disconnects mid-match, a CPU covers their seat after 30 seconds and hands it back when they return. Reopening the browser offers a one-click rejoin. Rooms expire after 24 hours.

**The offline edition** (`pnpm build:offline`) is a single HTML file (about 33 MB) that embeds the game, the Blender models, textures and fonts. It plays one human against three CPUs with no server.

Solo matches autosave in the browser. Internal `shells`/`pearls` field names and `sp-*` storage keys remain for compatibility; the interface says points and diamonds. Content revision 11 marks the v0.8 board set.

## Editing guide

| Change                                              | Source                                                                                          |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Economy, items, avatar defaults, space info, emotes | `game/config.ts`                                                                                |
| Turns, movement, teams, events, gimmicks, migration | `game/engine.ts`                                                                                |
| Planets, board layouts, gimmick roads, wormholes    | `game/boards.ts` (tile codes per road)                                                          |
| Menus, setup, studio, lobby, HUD                    | `game/Party.tsx`, `game/art.tsx`, `app/skin.css`, `app/globals.css`                             |
| Board rendering and camera                          | `game/BoardScene.tsx`, `game/BoardTiles.tsx`, `game/TerrainMaterial.ts`                         |
| Board juice and gimmick visuals                     | `game/BoardDirector.ts`, `game/BoardGimmicks.ts`, `game/BoardEffects.ts`                        |
| Menu planets                                        | `game/PlanetGlobe.ts`, `game/Planetarium.ts`                                                    |
| Alien, UFO, finale                                  | `game/avatar.ts`, `game/Ufo.ts`, `game/Finale.ts`                                               |
| Blender models (rebuild with Blender 5.x)           | `art/blender/*.py` → `public/models/`, `public/textures/` (CC0 sources via `scripts/fetch-assets.mjs`) |
| Minigame roster, team shapes, rules                 | `game/arcade/catalog.ts`, `remix-catalog.ts`, `simulation.ts`, `remix.ts`, `grand.ts`           |
| Minigame presentation                               | `game/arcade/*-renderer.ts`, `game/arcade/ArcadeGame.tsx`                                       |
| Rooms and online validation                         | `app/api/room/route.ts`                                                                         |
| Offline packaging                                   | `offline/main.tsx`, `scripts/build-offline.mjs`, `game/assets.ts`                               |

Run `pnpm test` (rules, boards, minigames, migration, rooms) and `npx tsc --noEmit` before shipping; `pnpm test:online` exercises a running server with four clients. Keep game and board IDs stable and add save migration when changing in-progress state.
