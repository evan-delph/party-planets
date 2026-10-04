# Sausage Party — Worlds Expansion

**Version:** 0.4 · **Date:** September 9, 2026 · **Status:** Implemented prototype expansion; automated checks and final builds passed, with targeted browser verification recorded.

The current editable prototype contains three selectable ecosystems, 138 board spaces per ecosystem, twelve action minigames, an expanded character studio, animated reactions, sound effects, and automatic performance feedback. This update supersedes the earlier 46-space board, six-game catalog, and smaller creator described in Appendices A and B of the GDD. The earlier production specification remains a record of broader ambitions; the implemented rules below take precedence for this version.

## Three playable ecosystems

Each board has **138 traversable nodes: 96 outer spaces plus three 14-space shortcuts**. That is three times the original 46-space playable board. The worlds have distinct generated layouts, colors, landmarks, and environmental props while sharing the turn and economy systems.

| World              | Environment                                                                                    | Hazard and reward                                                                                                              |
| ------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Crown Cay**      | Tropical archipelago with a volcanic caldera, coral coves, harbor, palms, and jungle shortcuts | Volcano eruption costs up to **8 shells**. Tide-pool treasure awards **8 shells**.                                             |
| **Aurora Alps**    | Alpine snow, frozen lake crossings, pine forests, chalets, hot springs, and an avalanche ridge | Avalanche costs up to **5 shells** and moves the player back up to **3 traveled steps**. Hot-spring bonus awards **8 shells**. |
| **Mossveil Ruins** | Rainforest temples, giant mushrooms, glowing marsh, fireflies, and vine routes                 | Hungry bog costs up to **5 shells** and moves the player back up to **2 traveled steps**. Relic cache awards **8 shells**.     |

Snow and bog displacement follows the current roll's recorded path and stops at the beginning of that path if fewer steps are available. It does not recursively resolve another landing. Losses stop at zero shells. **Bun Shield blocks one red-space or ecosystem hazard penalty**, including the hazard's displacement, and is then consumed.

All spaces have centered icons using shared textures and instanced rendering. Color and the icon identify the space together. The board presents hazards with eruption, snow, or bog particles and corresponding sound effects.

## Movement, bank, and interactive spaces

The normal movement die now rolls **1–10**. The pearl still costs **20 shells**; after purchase, a new eligible destination is selected **8–18 forward graph steps** from the buyer. Start, bank, hazard, and portal spaces are excluded from those destinations. Shortcut availability can change during a match.

The **shared bank starts at zero**. Passing a bank before the final movement step deposits **5 shells, or the player's available balance if lower**. Landing on a bank collects the **entire accumulated pot** and resets it to zero. A final bank landing does **not** also charge a passing deposit. All bank spaces in the match use that same pot.

| Space            | Current rule                                                                     |
| ---------------- | -------------------------------------------------------------------------------- |
| Blue / red       | Gain 3 shells / lose up to 3 shells; shield can block the red penalty            |
| Ecosystem reward | Gain 8 shells, presented as tide-pool treasure, hot-spring bonus, or relic cache |
| Portal           | Move to the next district's portal without triggering intermediate pass effects  |
| Trickster        | Take up to 6 shells from the richest other player                                |
| Shortcut switch  | Toggle shortcuts open or closed and gain 4 shells                                |
| Bank             | Deposit when passing; collect the shared pot when landing                        |
| Hazard           | Apply the selected world's bounded loss and any displacement                     |

The prototype keeps the six implemented items, a three-item bag, 20 starting shells, a 10-shell lap reward, and minigame rank prizes of **10 / 6 / 3 / 1 shells**. These are the current tuning values, distinct from the older planned economy in the original GDD.

## Twelve action minigames

The first six physical games retain their rules and receive distinct environments. Six additional games bring the implemented catalog to twelve. Computer players use simulated movement and game actions; their results come from the arena state.

| Game                  | Environment and play                                                                                                                                                                                                   | Winner / round limit                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Canopy Crush**      | Treetop canopy. Move into an opening before the ceiling falls; players can push one another.                                                                                                                           | Survive longest; surviving players tie at the 45-second limit.                 |
| **Bumper Buns**       | Carnival ball arena. Steer with momentum and dash into opponents on a shrinking platform.                                                                                                                              | Last survivor, with survival ties at 50 seconds.                               |
| **Sizzle Skippers**   | Lava and stepping pads. Time jumps over the rotating grill bar; three burns eliminate a player.                                                                                                                        | Survive longest, with survival ties at 45 seconds.                             |
| **Coconut Crossfire** | Desert court with environmental cover. Move, aim, charge a coconut, and release it to knock rivals away.                                                                                                               | Last survivor, with survival ties at 55 seconds.                               |
| **Turbo Tide**        | Harbor drag track. Hold throttle and time shifts through five gears.                                                                                                                                                   | Fastest 620-unit finish; unfinished racers rank by distance. 40-second cap.    |
| **Pier Pressure**     | Marsh relay. Two-player teams operate a gate together, cross using a moving platform, then alternate boat strokes.                                                                                                     | Faster team completion; unfinished teams rank by progress. 90-second cap.      |
| **Skybridge Sprint**  | Sky course with 16 sequential islands, moving platforms, and checkpoint arches. Move and jump; falls return you to a checkpoint.                                                                                       | Fastest finish; unfinished players rank by island progress. 65-second cap.     |
| **Molten Morsel**     | Forge chase around a central furnace and slowing steam vents. Pass the hot morsel to a nearby rival before its fuse expires; dash to escape. Passing does not reset the fuse, and immediate pass-backs are restricted. | The holder is eliminated on an explosion. Survive longest; 50-second cap.      |
| **Moss Bosses**       | Mushroom territory around a flower pond. Aim, hold to charge, then release to hop and stamp tiles. A stamp can overwrite rival territory.                                                                              | Most owned tiles after 45 seconds.                                             |
| **Relic Rumble**      | Digging quarry. Move through cleared tunnels and hold action to dig ahead. Stone takes longer than dirt; small relics score 1 and the gold cache scores 5.                                                             | Most relic points after 55 seconds.                                            |
| **Aurora Glide**      | Ice oval around an iceberg. Hold to skate, steer through bends, and brake; snowbanks slow you down.                                                                                                                    | Fastest four-lap finish; unfinished racers rank by progress. 65-second cap.    |
| **Bun & Done**        | Orbital kitchen with moving trays. Two-player teams collect ingredients, place buns first and filling second, and send complete orders through the delivery window. Incorrect assembly spoils a tray.                  | Most delivered orders after 55 seconds; team members share their team's score. |

Keyboard movement uses **WASD or arrows**; controller movement uses the **left stick**. **Space / controller A** is the primary action and **E or Shift / controller B** is the secondary action. Turbo Tide also accepts **Up arrow** to shift. Aurora Glide uses left/right steering; its secondary action brakes. Molten Morsel uses the secondary action to dash, and Bun & Done uses it to discard an ingredient. Each ready screen states the game's current actions.

Ready, countdown, results, and replay remain part of the arcade flow. Offline menu exit preserves an active arena and returns to it paused. Online play retains server-owned simulation outcomes and room controls; real internet responsiveness still needs broader playtesting.

## Character studio, animation, and audio

The creator now offers **8 hair choices, 7 accessory choices, 4 clothing patterns, 4 eyebrow choices, 4 nose choices, and 3 beard choices**, alongside the existing face and body options. Hair, eye, and shoe colors are editable. Eye spacing, mouth scale, freckles, and gloves add further control.

The mouth sits above the outfit, and the studio viewport framing was adjusted so the face remains visible. Characters animate their arms and legs while running. Shell gains trigger celebration jumps and happy expressions; losses trigger sad expressions. Footsteps and reward, loss, bank, portal, and hazard sounds accompany gameplay feedback. These are procedural prototype assets and effects, with room for further character and audio refinement.

## Performance behavior and verification

An on-screen FPS indicator reports sampled performance. For genuinely slow active frames, **two consecutive three-second samples below 38 FPS** lower rendering pixel ratio. A third low sample disables shadows and displays a performance warning. Hidden-tab time is excluded from sampling. Static environment geometry is batched, and repeated board elements share rendering resources.

Background throttling was observed in the embedded browser: after the task or browser became inactive, frame delivery fell to about **1 FPS** while render submissions remained quick. The meter now identifies this as **Frame delivery limited**, with a tooltip explaining that inactive windows commonly cause it. Because this browser does not always update focus or visibility signals, regular **800–1,300 millisecond frame gaps** paired with render submissions under **50 milliseconds** skip automatic quality reductions. Genuinely slow active frames still use adaptive detail. This separates measured frame delivery from rendering load; it is not a guarantee of smooth background animation.

Automated rules validation passed **17,827 assertions**, including:

- Nine complete simulated board matches across all three ecosystems.
- 108 deterministic arena runs across twelve games, three difficulties, and three seeds, together with the new game-specific checks.
- Bank passing and landing behavior, bounded hazards, shield consumption, portals, and shortcut correctness.
- Four-client local HTTP room checks covering board selection and minigame controls.
- A regression check that an explosion appears at the eliminated morsel carrier's position.

The performance regression suite also passed **44 assertions across 8 cases**, covering the frame-delivery and adaptive-detail behavior.

Final TypeScript validation, the production Vinext build, and the standalone offline build passed, including the latest performance-monitor changes. The standalone output is **1,391,314 bytes**, approximately **1,359 KB**. Its JavaScript parse check passed, and it embeds scripts and styles without external script or stylesheet dependencies.

Targeted browser observations so far are limited to the current test session:

| Observed area        | Recorded result                                                                                                                                                                                             |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Character studio     | Face and mouth clearly visible after the viewport framing fix                                                                                                                                               |
| Crown Cay board      | Tropical board rendered and visually inspected                                                                                                                                                              |
| Aurora Alps board    | Approximately 97–100 FPS                                                                                                                                                                                    |
| Mossveil Ruins board | Tree and mushroom village and centered space icons visible; a roll of 10 deposited 5 shells at a passed bank and landed on a +8 spring, changing the balance from 20 to 23 and leaving 5 in the shared bank |
| Canopy Crush         | Approximately 97 FPS                                                                                                                                                                                        |
| Skybridge Sprint     | Approximately 100 FPS; CPU finishes varied from about 18.65 to 18.9 seconds; reached results                                                                                                                |
| Bun & Done           | Approximately 100 FPS during the early round; Space picked up a bun and displayed “Carrying BUN”; ingredients and moving trays were visible; reached results                                                |
| Molten Morsel        | Forge environment and steam vents rendered                                                                                                                                                                  |
| Relic Rumble         | Quarry blocks rendered; a CPU collected a relic and displayed 1 point                                                                                                                                       |
| Aurora Glide         | Ice oval rendered clearly after framing changes for narrow panes                                                                                                                                            |
| Moss Bosses          | Tile-floor occlusion fixed; final grid displayed pink, blue, and purple territory with CPU tile totals of 23, 18, and 21; reached results                                                                   |

The new arenas were moved below the HUD in narrow panes, and screenshots confirmed that the ice course and territory grid were clear. The inspected browser error log was empty.

Observed active-session performance ranged from approximately **53–100 FPS**: earlier samples were 96–100 FPS, while the final territory run recorded 53–59 FPS with the production build running concurrently. The later inactive-window sample was approximately 1 FPS as described above. These measurements do not establish sustained performance on other hardware, full-match balance, or responsiveness over real internet connections.

**All twelve games were simulation tested; seven arenas and all three boards were checked in the browser.** Skybridge Sprint, Bun & Done, and Moss Bosses reached results during browser checks. The other four arena checks establish the recorded rendering and interactions, not completed manual rounds. This is not twelve completed hands-on playtests. Build results in Appendix B apply to the earlier six-game version; the final expansion results are recorded above.

This is an expanded playable prototype. The production ambitions for final art, broader device coverage, comprehensive controller testing, real four-human internet matches, service reliability, and extensive balance work remain separate acceptance goals. The existing hosted version remains unpublished; this update does not claim a new deployment.

## Exact editable source locations

The source export is at [sausage-party-source](..). These are the current files to edit:

| Change                                                     | File                                                                                                        |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| World names, layouts, hazards, and pearl destination rules | [game/boards.ts](../game/boards.ts)                                                                         |
| Economy defaults, items, avatar data, and space labels     | [game/config.ts](../game/config.ts)                                                                         |
| Board movement, bank transfers, landings, and validation   | [game/engine.ts](../game/engine.ts)                                                                         |
| Board scenery, space icons, and board effects              | [game/BoardScene.tsx](../game/BoardScene.tsx)                                                               |
| Avatar construction and animation                          | [game/avatar.ts](../game/avatar.ts)                                                                         |
| Studio, menus, settings, and board selection               | [game/Party.tsx](../game/Party.tsx)                                                                         |
| Procedural sounds                                          | [game/audio.ts](../game/audio.ts)                                                                           |
| Shared scenery utilities and adaptive performance meter    | [game/visuals.ts](../game/visuals.ts)                                                                       |
| Minigame names, instructions, durations, and score labels  | [game/arcade/catalog.ts](../game/arcade/catalog.ts)                                                         |
| First six minigames and shared simulation                  | [game/arcade/simulation.ts](../game/arcade/simulation.ts)                                                   |
| Six new minigames and their CPU decisions                  | [game/arcade/expansion.ts](../game/arcade/expansion.ts)                                                     |
| Classic arenas and environments                            | [game/arcade/renderer.ts](../game/arcade/renderer.ts) and [environments.ts](../game/arcade/environments.ts) |
| New arena visuals                                          | [game/arcade/expansion-renderer.ts](../game/arcade/expansion-renderer.ts)                                   |
| Arena input and ready/replay flow                          | [game/arcade/ArcadeGame.tsx](../game/arcade/ArcadeGame.tsx)                                                 |
| Automated rules and room checks                            | [tests/rules.test.ts](../tests/rules.test.ts) and [online.test.mjs](../tests/online.test.mjs)               |
| Frame delivery and adaptive-detail regression checks       | [tests/performance.test.mjs](../tests/performance.test.mjs)                                                 |

The editable design record is [Sausage Party - GDD.md](GDD.md), with this update incorporated as Appendix C. The original Word document remains the earlier design baseline.
