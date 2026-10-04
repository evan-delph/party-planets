# Planet Party · Earth Vacation update

Version 0.6 · September 10, 2026

This is the current implementation record. It supersedes earlier Sausage Party appearance, currency, board topology and turn-selection rules. All 50 existing minigames remain available in the arcade and in board matches.

## The match

Select Crown Cay, Aurora Alps or Mossveil Ruins on the opening menu, then choose **Play** to enter the game setup screen. Choose 5, 10, 15, 20 or 30 turns per player; a goal of 1, 3, 5 or 10 diamonds, or turn-limit-only scoring; and Easy, Normal or Expert AI. Defaults are 10 turns, 3 diamonds and Normal AI. Reaching the goal wins immediately. At the turn limit, most diamonds wins and points break ties. Equal final totals share a rank.

Solo uses one human and three AI rivals. Online rooms can start with one to four humans; empty seats become AI at the host's chosen difficulty. The host can set the rules before launching. Online mode requires the server-backed edition; the standalone HTML is offline solo and arcade play.

Every match begins with a five-second UFO landing at the first space. Four green visitors are visible under the cockpit canopy. Each player walks down the ramp on their first roll. The ramp closes after the fourth player's first dice animation finishes. Subsequent turns start with a centered, two-second player announcement.

Each normal die produces 1–10. Every roll has a visible three-dimensional rotating die, a held result and a fade; the Double Orbit item displays two dice. Comet Boost adds three steps. A first departure precedes that player's dice animation. The board then advances one timed edge at a time at 9 world units per second, with the camera smoothly tracking the traveler.

**Roads are chosen only after reaching a fork with movement remaining.** The roll pauses at that exact junction, presents the named roads, and preserves the unspent steps. Landing exactly on a fork with no steps left ends the move normally; its road choice waits for the next roll. An idle human fork chooses randomly after 30 seconds. Closed alternate roads offer only the main road. No pre-roll route selector remains.

Exactly one purchasable yellow diamond hovers and glows above a board space. Reaching it with at least **50 points** purchases it automatically. Its replacement is randomly chosen from eligible reachable spaces 8–18 graph steps ahead, excluding the previous location and every player-occupied space. Random events no longer move the diamond independently. Initial diamond spaces are Crown Cay 23, Aurora Alps 23, and Mossveil Ruins 24 in the one-based UI.

Passing a bank deposits up to five available points into one shared pot. Landing on any bank pays the entire accumulated pot. Blue spaces give three; red spaces take three; other central icons identify shops, gifts, hazards, treasure, portals, theft and route switches. Shields block penalties. Volcanoes cost up to eight points; avalanches and hungry bogs cost up to five and push the traveler back along their path.

## Three-game voting

After all four board turns, the crew sees three distinct choices from the retained 50-game catalog. Each player has one ballot, shown on their chosen card. A player may change their vote before the result is locked. AI opponents cast staggered votes too. Voting locks when everyone has voted or the 20-second deadline expires.

The choice with the most votes wins. If multiple choices have the same highest count, the game randomly selects **only among those tied choices**. Unanswered seats abstain; an all-abstain result randomly selects among all three. The chosen game is revealed for 2.4 seconds, then its briefing and ready countdown begin. Unselected choices rotate away in the deck; selected games leave it until a refresh is needed. Direct arcade practice starts the selected game without a vote.

Online ballots are bound to the authenticated seat and a unique vote identifier. Concurrent ballots use retry-safe room revisions. A late ballot from an earlier vote cannot affect a later one. The server determines the winning game; clients cannot submit a fabricated winner or score.

## Aliens and world presentation

All visitors have fixed green skin, slender bodies and limbs, large glossy eyes and expressive faces. The skin-color selector is removed. Old saved skin values normalize to green. Names, height/build, hair, eyes, brows, nose, smile, freckles, facial hair, gloves, outfit and shoe colors, accessories and patterns remain editable. **Hawaiian shirt** is the fifth pattern and the new default; its flower details, collar and buttons sit below the mouth. The model is shared by all 50 minigames.

The Planet Party wordmark incorporates a UFO. UI additions include the mission setup, travel status, destination information, vote cards with visible ballots, fork choices, dice reveal and turn announcements. Higher-resolution shadows, a glowing faceted diamond and glossy alien eyes refine the existing procedural style.

The three boards each retain **138 playable spaces**, now in independently authored networks with four named forks, minimum center spacing of 3.12 world units and no crossing roads that falsely appear connected:

- **Crown Cay:** irregular harbor and cove loops, volcanic gardens, a caldera overlook, lagoon bridges, coral headland and lighthouse reef.
- **Aurora Alps:** layered mountain switchbacks, a frozen valley crossing, pinewood descent, hot-spring trails, glacier shelf and exposed summit pass.
- **Mossveil Ruins:** a braided jungle network through mushroom marsh, ancient aqueduct, root stairs, temple courtyard, orchid terraces and lantern outpost.

Scenic clearings contain district-specific props. Added movement includes a sweeping lighthouse beam, flowing waterfall, drifting balloons, orbiting critters, smoke/steam and spinning junction pinwheels. Existing ecosystem boat, wildlife, steam, aurora and firefly vignettes recur every minute. Decorative motion uses its own clock and does not change gameplay randomness. Static decorative meshes are batched. The UFO, limbs, eyes, die and moving world props animate independently.

## Controls, saving and editing

- Board: **Space** to roll/end turn; click a road only at a fork; click a voting card during the ballot. Drag to orbit and scroll to zoom.
- Minigames: their individual briefing retains the original movement/action instructions, with keyboard, touch and existing controller support.
- Character and offline match saves use the existing browser storage keys. Legacy appearances become green. Timed state is rebased when resuming a saved match so an interrupted die, walk or ballot does not wait on an outdated deadline.
- The old **Sausage Party - Offline.html** path is updated as a compatibility copy. The newly named **Planet Party - Offline.html** is the primary deliverable. Both contain the same game.

Edit `game/config.ts` for prices and avatar defaults; `game/boards.ts` for authored roads and district coordinates; `game/engine.ts` for turn and voting rules; `game/avatar.ts` for the alien model; `game/Ufo.ts`, `game/DiceRoll.tsx`, `game/BoardScene.tsx` and `game/PlanetScenery.ts` for presentation. The existing catalog and individual arena modules retain all 50 games. Internal `shells`/`pearls` property names remain for save compatibility; the player-facing currencies are points and diamonds.

## Verification and remaining limits

The new behavior has 327 dedicated rules checks. The retained suite also checks nine complete matches, 450 deterministic arena runs, the 50-game catalog and its mechanics, bank conservation, hazard resolution, reachable routes and all-pair tile clearance. A separate 44-assertion performance-monitor suite covers eight frame-delivery cases. TypeScript and production/offline builds are checked during packaging.

A local four-human HTTP test exercised visible rolls, fork actions, turn order, a concurrent 2–2 vote, tied-choice-only selection, ready countdown, accepted controls, server physics, stale input and scoring authorization. Another room used three humans and one AI with the selected difficulty and changed host settings. This is local server verification, not a claim of remote internet playtesting.

The live performance badge and adaptive detail remain enabled; sustained slow rendering lowers detail and displays a warning. This update has not been measured for real foreground GPU frame rate on the user's browser. The build's JavaScript-size warning is a load-size advisory, not evidence of a frame-rate problem. The game remains an editable procedural prototype; full hands-on playtesting, controller/device coverage and hosted internet latency testing remain production work.
