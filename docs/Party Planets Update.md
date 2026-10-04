# Party Planets — v0.7 update

**September 10, 2026**

Party Planets expands the alien holiday across **three planets and nine playable boards**, with a focused menu of **30 minigames: the original 12 plus 18 rebuilt remixes**. Older material describing a 50-game selectable release is superseded by this update and the current GDD.

## Explore three worlds

- **Earth:** Crown Cay, Aurora Alps and Mossveil Ruins retain their authored routes.
- **Selene:** Moonwake Basin, Prism Glacier and Emberfault Reach add crater deserts, crystal ice and geothermal rifts.
- **Verdara:** Lumen Canopy, Nimbus Reef and Scarlet Drift add luminous jungle, floating coral wetlands and crimson dunes.

Every board has 138 spaced tiles, named forks, landmarks, ecosystem colors and animated scenery. The initial menu selects planets and their boards. The orbital view shows the actual three route layouts on each world, with board zoom and camera controls.

## Board events and the finish

Event spaces now trigger a distinct landmark phenomenon for all four players: an eruption, avalanche, temple awakening, meteor shower, prism resonance, steam blowout, spore bloom, sky tide or sandstorm. A funded player loses 1–20 points according to distance, capped by their balance. Those points leave the game; they are not bank deposits.

Bank rules remain: pass a bank to deposit up to 5 points; land on one to collect the accumulated jackpot. Diamonds still cost 50 points, purchase automatically when reached with enough points, and relocate to an eligible unoccupied space.

At the turn limit, the crew boards the UFO and receives three bonus diamonds in its lounge: highest final point balance, most actual point-losing red/hazard/event landings, and most event-space landings. Tied leaders each get a diamond. Empty landing categories award none. Final diamonds determine the winner, with remaining points breaking ties. An enabled diamond target still allows an immediate victory before the turn limit.

The presentation includes point reactions, a diamond pickup, a winner's toast and dance, UFO boarding/departure, and the bonus-lounge ceremony. Green alien customization and Hawaiian shirts remain available. Dice, turn announcements, three-game voting, fork-only route choices, sound, mute, reduced motion and lower graphics settings are retained.

## The 18 remade games

Caldera Critter, Snowball Showdown, Powder Panic, Crustacean Crossing, Comet Hoops, Last-Second Spotlight, Canopy Cadence, Buoy Bandits, Reef Ring Rally, Summit Signal, Kite Coast Crew, Postcard Puzzle, Signal Snap, Meteor Batters, Relic Rendezvous, Beacon Keepers, Ripple Rumble and Parcel Panic join the original 12 games in the 30-game menu.

The roster includes survival, skiing, boat racing, shooting, picture puzzles, climbing, cooperative relays and rotating 1-vs-3 roles. Briefings show each game's controls and scoring. Extra legacy catalog entries may remain internally for save compatibility; they are not additional selectable v0.7 games.

## Playing and editing

Open `Party Planets - Offline.html` for one human and three CPUs without a server. Select a board, set rounds/diamond target/AI difficulty and launch. Hosted rooms can use four humans or fill empty seats with CPUs at the host's selected difficulty. Friends need a reachable server; the standalone file and a loopback local address do not host public online play.

The editable source remains modular. Economy and avatar options live in `game/config.ts`; rules, events and bonuses in `game/engine.ts`; planets and routes in `game/boards.ts`; new minigame behavior in `game/arcade/remix.ts`; and presentation in the renderer, scenery, UFO and finale modules. The GDD includes the full 30-game roster and editing map.

## Validation record

The board-data audit verified all nine 138-space graphs, at least 3.12 center spacing, complete directed reachability, valid diamond destinations and no disconnected road crossings. Earth geometry was compared with the prior layouts and remained unchanged.

Release checks passed: TypeScript, production and standalone builds, 765 existing turn/vote/diamond checks, 35,606 shared assertions across nine complete matches and 270 deterministic arena runs, 680 new event/bonus/migration/minigame assertions with 108 CPU completion/replay cases, and 44 performance-monitor checks. Local multiplayer integration passed with four humans and with three humans plus an AI. New rendering and rules modules pass lint; the repository-wide lint command still reports pre-existing React compiler and accessibility findings.

Browser checks covered the planet and board selectors, alien studio, live skiing, and isolated visual fixtures for the toast, dance, boarding, departure, bonus lounge, eruption and bank jackpot. Sampled frame rates were approximately 91–100 FPS in the main planet/alien-board/skiing views and 51–70 FPS in the more detailed visual fixtures. No automatic slowdown warning or browser console error appeared during these checks. These are observations from this machine, not a promised minimum across devices. The visible performance badge and adaptive detail remain enabled.
