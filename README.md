# conflux-game

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/Regian1117/conflux-game/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/Regian1117/conflux-game/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**CONFLUX** is a 2D elemental-reaction defence game in one canvas, with all art and sound generated in code: no engine, no assets, no network.

Rift creatures walk out of four gates toward the Core Crystal in the middle of the battlefield. You stop them by **painting elements** onto a 48x30 grid with the mouse. Painted cells persist for a while and then fade, and touching cells react:

| Paint | Reaction |
| --- | --- |
| FIRE + WATER | STEAM: a cloud that blinds and slows |
| FIRE + EARTH | LAVA: burns, and creeps through earth |
| WATER + STORM | CHARGED WATER: shock chains across all connected water |
| EARTH + STORM | MAGNETITE: pulls creatures into a clump |
| STEAM + STORM | STORMCLOUD: lightning strikes below it |
| LAVA + WATER | QUENCH: lava hardens to earth, water boils off |
| WATER + Frost Touch | ICE: freezes creatures; STORM shatters it for damage |

Reactions trigger further reactions. Each chain shows a callout such as `CHAIN x7 - STORMSTEAM!` and multiplies your score.

**Controls**: hold the mouse to paint; `1` FIRE, `2` WATER, `3` EARTH, `4` STORM pick the brush (each has its own essence bar that refills slowly and from kills); `Space` opens the next rift early; `P` pause; `M` mute; `R` retry on the end screens.

**Goal**: survive 7 rifts and defeat the **Hollow Colossus** on rift 7. The Core Crystal shatters if its health reaches 0. Six kinds of creature each have a weakness (Cinder Imp: drowns in water, immune to fire; Mud Golem: freeze then shatter it; Mist Wraith: only storm hurts it; Spark Beetle: charges near storm and explodes; Ember Swarm: many small embers; Stone Ram: smashes earth walls). The Colossus's armour plates break only to a named reaction sequence shown on screen. After every rift you pick 1 of 3 boons.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080. The game is plain static files under `game/` (ES modules, no build step).

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
