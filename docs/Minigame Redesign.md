# Sausage Party — Minigame Redesign Addendum

> Historical document from the project's earlier Sausage Party version. The current roster is described in [GDD.md](GDD.md).

The redesign replaces the original four cue-and-click games with six action minigames. Each game has its own arena, rules, movement or timing model, and computer-player decisions. The descriptions below reflect the editable implementation. Automated simulation and local room checks have passed; browser playtesting remains outstanding.

## The six games

| Game                                      | What you do                                                                                                                                                                                                                     | How the round is decided                                                                                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Canopy Crush**           | Run around the arena and get fully beneath a glowing opening before the canopy drops. Players collide and can push one another away from safety. Drops become faster and safe openings become fewer and smaller.                | A player outside an opening is eliminated. Stay alive longest; players still alive when time expires share the top survival score.                                     |
| **Bumper Buns**          | Steer a beach ball with momentum, countersteer to brake, and dash into opponents. The platform gradually shrinks.                                                                                                               | Falling beyond the platform eliminates you. The last survivor wins; surviving players tie if the timer expires first.                                                  |
| **Sizzle Skippers**     | Time jumps over a rotating grill bar whose speed and rhythm change. Hold the action button briefly for a higher jump; release sooner for a shorter hop. Players remain at their jump positions.                                 | Each low contact costs a life. Three burns eliminate you. Outlast the other players, with surviving players tied at the time limit.                                    |
| **Coconut Crossfire** | Move to face a rival, hold the action button to grow a coconut, then release to throw. Larger coconuts knock rivals back harder and slow your movement while charging. Dodge incoming shots and avoid the shrinking arena edge. | Knock opponents off the arena and stay alive. The last survivor wins; survivors tie at the time limit.                                                                 |
| **Turbo Tide**      | Hold the throttle and shift through five gears. Watch RPM and shift inside the green band; early shifts and shifts beyond the band lose speed. Each racer stays in a lane.                                                      | The fastest finish over the 620-unit course wins. Racers who have not finished are ranked by distance.                                                                 |
| **Pier Pressure**        | In two teams of two, stand on separate gate pads and operate them together, jump across a gap using a moving platform, then alternate operating the boat. A missed platform crossing sends you back to the near side.           | Complete the gate, get both partners across, and perform ten alternating boat strokes. The faster finishing team wins; unfinished teams are ranked by course progress. |

## Controls and round flow

| Input            | Keyboard              | Controller |
| ---------------- | --------------------- | ---------- |
| Move or steer    | WASD or arrow keys    | Left stick |
| Primary action   | Space                 | A          |
| Secondary action | E or Shift            | B          |
| Race gear shift  | E, Shift, or Up arrow | B          |

The primary action changes with the game: dash, jump, charge-and-release, or throttle. Pier Pressure uses the secondary action to operate the gate and boat. Canopy Crush relies on movement. Turbo Tide uses throttle and shifting rather than directional steering.

The redesigned presentation uses native 3D arenas and a ready screen with the current rules and controls. Replay starts another round after results. Leaving an offline round for the menu preserves its arena and returns to it paused. Online polling no longer overrides the chosen menu state, and briefing inputs do not queue gameplay actions. These interface behaviors still need browser playtesting.

## Computer players and intentional adaptations

Computer players participate in the simulation. Their decisions feed into the same movement, collisions, hazards, projectiles, jumps, gears, and team objectives as human actions. They seek canopy openings, attack and retreat from arena edges, time jumps, charge and dodge coconuts, shift gears, and work through the paired obstacle course. Difficulty changes their reaction and timing behavior. They are capable of mistakes and elimination.

These are original, sausage-themed designs. Bumper Buns adds a dash; Sizzle Skippers permits three burns; Coconut Crossfire uses charged coconut projectiles. Pier Pressure deliberately condenses the team course to a cooperative gate, moving-platform crossing, and alternating boat strokes.

## Validation and delivery status

The following automated checks passed:

- TypeScript validation after the final fixes and nine complete board matches.
- Fifty-four arena runs covering all six games, three difficulties, and three seeds, with exact agreement on deterministic replay.
- Physical movement, hazards, projectiles, gears, relay gate behavior, and computer-player completion checks.
- A four-client local HTTP room integration check covering the ready countdown, simultaneous controls, authorization, stale inputs, and server-only scoring.
- The final production build and standalone offline build. A standalone JavaScript parse check also confirmed embedded scripts and styles, with no external script or CSS dependencies.

Browser and manual playtesting were not performed. How fun the games feel and how they respond over real internet connections still need user play.

The source export is editable at `outputs/sausage-party-source`; the catalog and simulation rules live in `game/arcade/catalog.ts` and `game/arcade/simulation.ts`. This Markdown addendum is also editable. The existing hosted version remains unpublished under the earlier source-export approval scope; no new deployment is claimed.
