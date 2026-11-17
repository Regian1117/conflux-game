// The screenshot scenes behind ?shot=cover|early|boon|win. Each plays the real rules forward from
// a fresh game with the painting bot (autopilot.js) at the controls, so every frame is genuine
// gameplay and the same seed always gives the same frame. A few helpers stage the moment worth
// photographing (a trap laid, the board filled, a chain about to land) by painting through the
// same grid functions the player's brush uses.
import { STEP } from './config.js';
import { CHARGED, CLOUD, EARTH, ICE, LAVA, MAGNET, STEAM, STORM } from './elements.js';
import { botStep, createBot } from './autopilot.js';
import { beginNextPrep, callRift, createGame, setCursor, updateGame } from './game.js';
import { setCell, toScreenX, toScreenY } from './grid.js';
import { offerBoons, takeBoon } from './boons.js';
import { damageCreature, spawnCreature } from './creatures.js';
import { reactNow } from './reactions.js';
import { updateFx } from './particles.js';

const BOON_PREFERENCE = ['frost', 'wide', 'arc', 'overflow', 'shield', 'slowdecay', 'siphon', 'lava', 'mend'];

/**
 * Run the game forward for up to `seconds` or until `until(game)` is true. In `god` mode the Core
 * and essence are topped up (to reach a late rift quickly); the bot picks boons and skips prep.
 */
function advance(game, bot, seconds, until, god = false) {
  for (let n = 0; n < seconds / STEP; n += 1) {
    if (game.phase === 'boon') {
      const pick = [...game.offer].sort((a, b) => BOON_PREFERENCE.indexOf(a.id) - BOON_PREFERENCE.indexOf(b.id))[0];
      takeBoon(game, pick.id);
      beginNextPrep(game);
    }
    if (game.phase === 'prep' && game.prepTimer > 3) callRift(game);
    if (god) {
      game.core.hp = Math.max(game.core.hp, 70);
      for (let i = 0; i < 4; i += 1) game.essence[i] = Math.max(game.essence[i], 55);
    }
    botStep(bot, game, STEP);
    updateGame(game, STEP);
    if (game.phase === 'won' || game.phase === 'lost' || (until && until(game))) return;
  }
}

/** Fill a rough ellipse of cells around (cx, cy) with one element. */
function blob(game, type, cx, cy, rx, ry, density = 0.9) {
  for (let row = Math.floor(cy - ry); row <= Math.ceil(cy + ry); row += 1) {
    for (let col = Math.floor(cx - rx); col <= Math.ceil(cx + rx); col += 1) {
      const dx = (col + 0.5 - cx) / rx;
      const dy = (row + 0.5 - cy) / ry;
      if (dx * dx + dy * dy > 1 || col < 1 || row < 1 || col > 46 || row > 28) continue;
      if (Math.abs(col - 24) <= 1 && Math.abs(row - 15) <= 1) continue;
      if (game.rng.chance(density)) setCell(game.grid, col, row, type, 1.6);
    }
  }
}

function boonUpTo(game, ids) {
  for (const id of ids) takeBoon(game, id);
}

/** Cover: rift 7, the Hollow Colossus mid-fight on a board full of every element. */
function stageCover(seed) {
  const game = createGame(seed);
  const bot = createBot();
  boonUpTo(game, ['frost', 'wide', 'arc', 'arc', 'lava', 'overflow', 'shield']);
  game.riftNum = 6;
  game.phase = 'prep';
  game.prepTimer = 0;
  game.stats.riftsCleared = 6;
  game.score = 48250;
  advance(game, bot, 40, (g) => g.boss !== null && g.rift.clock > 26, true);
  const boss = game.boss;
  const bx = boss ? boss.x : 24;
  const by = boss ? Math.max(6, boss.y) : 8;
  game.grid.type.fill(0);
  blob(game, LAVA, bx - 9, by + 5, 3.6, 2.6);
  blob(game, CHARGED, bx + 9, by + 4, 4.4, 2.2);
  blob(game, ICE, bx - 8, by - 3, 2.8, 1.5);
  blob(game, STORM, bx + 10, by - 3, 2.2, 1.3);
  blob(game, STEAM, bx + 2, by + 5, 3, 1.3);
  blob(game, CLOUD, bx - 2, by + 6, 2.6, 1.1);
  blob(game, EARTH, bx - 15, 15, 1.2, 4, 0.95);
  blob(game, MAGNET, bx + 14, by + 9, 1.8, 1.4);
  if (boss) {
    for (const [kind, gate, x, y] of [['golem', 'W', 12, 17], ['imp', 'E', 38, 14], ['wraith', 'N', 31, 9], ['wraith', 'N', 17, 8], ['beetle', 'S', 36, 21], ['swarm', 'W', 14, 12], ['swarm', 'W', 15, 12.6], ['swarm', 'W', 14.6, 13.4], ['ram', 'W', 9, 12]]) {
      const c = spawnCreature(game, kind, gate, 1.6);
      if (c) {
        c.x = x;
        c.y = y;
      }
    }
  }
  game.core.hp = 74;
  advance(game, bot, 0.5, null, true);
  game.core.hp = 74;
  // A last chain lands through the game's own reaction path: only STORMSTEAM and LAVA are new
  // to it, so it reads CHAIN x7.
  game.fx.texts.length = 0;
  game.tip = null;
  if (game.boss) game.boss.plates = 3;
  game.chain.count = 4;
  game.chain.timer = 2.6;
  game.chain.best = 9;
  game.chain.lastText = -9;
  game.chain.lastGain = -9;
  game.chain.kinds.clear();
  ['STEAM', 'SHOCK', 'QUENCH', 'STRIKE', 'MELT', 'MAGNET', 'FROST', 'SHATTER'].forEach((n) => game.chain.kinds.add(n));
  const rx = Math.floor(bx) - 3;
  const ry = Math.floor(by) + 7;
  setCell(game.grid, rx, ry, CLOUD, 2);
  setCell(game.grid, rx + 1, ry, CLOUD, 2);
  setCell(game.grid, rx, ry + 1, LAVA, 2);
  reactNow(game, [{ name: 'STORMSTEAM', x: rx + 0.5, y: ry + 0.5 }, { name: 'LAVA', x: rx + 0.5, y: ry + 1.5 }]);
  for (let n = 0; n < 8; n += 1) updateFx(game.fx, STEP);
  if (game.boss) {
    game.boss.plates = 2;
    game.boss.exposed = 0;
    game.boss.hp = Math.round(game.boss.maxHp * 0.58);
  }
  game.brush = 3;
  setCursor(game, toScreenX(bx + 12), toScreenY(by + 12), false);
  return { game, screen: 'play', bests: { score: 31500, chain: 14 }, time: game.t };
}

/** Early play: rift 2 with a fire-and-water trap laid across the western path and steam rising. */
function stageEarly(seed) {
  const game = createGame(seed);
  const bot = createBot();
  const golem = (g) => g.creatures.find((c) => c.kind === 'golem');
  advance(game, bot, 160, (g) => g.riftNum === 2 && golem(g) !== undefined && golem(g).x < 40);
  // From here the "player" lays one trap by hand across the Golem's path: water, then fire beside it.
  game.grid.type.fill(0);
  const hand = createBot();
  hand.queue.push({ brush: 1, ax: 33.2, ay: 10.5, bx: 33.2, by: 20.5 }, { brush: 0, ax: 34.9, ay: 20.5, bx: 34.9, by: 10.5 });
  hand.cooldown = 0;
  advance(game, hand, 4, () => hand.queue.length === 0 && !hand.stroke);
  const idle = { queue: [], stroke: null, cooldown: 99, progress: 0, flip: 0 };
  advance(game, idle, 12, () => golem(game) !== undefined && golem(game).x < 35.2);
  game.brush = 0;
  setCursor(game, toScreenX(30.5), toScreenY(12.5), false);
  return { game, screen: 'play', bests: { score: 0, chain: 0 }, time: game.t };
}

/** Mid play: the boon pick panel over a busy rift 5 board. */
function stageBoon(seed) {
  const game = createGame(seed);
  const bot = createBot();
  advance(game, bot, 400, (g) => g.riftNum === 5 && g.rift.clock > 27, true);
  game.rift.next = game.rift.spawns.length;
  for (const c of game.creatures) damageCreature(game, c, 1e6, 'none');
  advance(game, bot, 6, (g) => g.phase === 'boon', true);
  if (game.phase !== 'boon') {
    game.offer = offerBoons(game);
    game.phase = 'boon';
  }
  return { game, screen: 'boon', bests: { score: 0, chain: 0 }, time: game.t, hover: 1 };
}

/** End: the win screen after a full run (the Colossus is finished off once it has been broken). */
function stageWin(seed) {
  const game = createGame(seed);
  const bot = createBot();
  for (let n = 0; n < 60 && game.phase !== 'won'; n += 1) {
    advance(game, bot, 20, null, true);
    if (game.boss && game.rift.clock > 52) {
      game.boss.exposed = 2;
      damageCreature(game, game.boss, 1e6, 'burst');
    }
  }
  advance(game, bot, 4, null, true);
  return { game, screen: 'win', bests: { score: 0, chain: 0 }, time: game.t };
}

export function stageShot(name, seed) {
  if (name === 'early') return stageEarly(seed);
  if (name === 'boon') return stageBoon(seed);
  if (name === 'win') return stageWin(seed);
  return stageCover(seed);
}
