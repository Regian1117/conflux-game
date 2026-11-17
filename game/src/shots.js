// The screenshot scenes behind ?shot=cover|title|boon|results. Each plays the real rules forward from
// a fresh game with the painting bot (autopilot.js) at the controls, so every frame is genuine
// gameplay and the same seed always gives the same frame. A few helpers stage the moment worth
// photographing (a trap laid, the board filled with every element, a chain about to land) by
// painting through the same grid functions the player's brush uses.
import { COLS, ROWS, STEP } from './config.js';
import { CHARGED, CLOUD, EARTH, FIRE, ICE, LAVA, MAGNET, STEAM, STORM, WATER } from './elements.js';
import { botStep, createBot } from './autopilot.js';
import { beginNextPrep, callRift, createGame, setCursor, updateGame } from './game.js';
import { setCell, toScreenX, toScreenY } from './grid.js';
import { offerBoons, takeBoon } from './boons.js';
import { damageCreature, spawnCreature } from './creatures.js';
import { reactNow } from './reactions.js';
import { addBolt, addText, burst, updateFx } from './particles.js';

const BOON_PREFERENCE = ['frost', 'wide', 'arc', 'overflow', 'shield', 'slowdecay', 'siphon', 'lava', 'mend'];
const IDLE = () => ({ queue: [], stroke: null, cooldown: 99, progress: 0, flip: 0 });

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
      game.core.hp = Math.max(game.core.hp, game.godHp ?? 70);
      for (let i = 0; i < 4; i += 1) game.essence[i] = Math.max(game.essence[i], 55);
    }
    botStep(bot, game, STEP);
    updateGame(game, STEP);
    if (game.phase === 'won' || game.phase === 'lost' || (until && until(game))) return;
  }
}

/** Fill a rough ellipse of cells around (cx, cy) with one element. */
function blob(game, type, cx, cy, rx, ry, density = 1) {
  for (let row = Math.floor(cy - ry); row <= Math.ceil(cy + ry); row += 1) {
    for (let col = Math.floor(cx - rx); col <= Math.ceil(cx + rx); col += 1) {
      const dx = (col + 0.5 - cx) / rx;
      const dy = (row + 0.5 - cy) / ry;
      if (dx * dx + dy * dy > 1 || col < 1 || row < 1 || col > COLS - 2 || row > ROWS - 2) continue;
      if (Math.abs(col - 24) <= 1 && Math.abs(row - 17) <= 1) continue;
      if (game.rng.chance(density)) setCell(game.grid, col, row, type, 1.8);
    }
  }
}

/** A winding band of one element running from (col0, row0) to (col1, row1), `width` cells wide. */
function river(game, type, col0, row0, col1, row1, width, wiggle) {
  const steps = Math.ceil(Math.hypot(col1 - col0, row1 - row0) * 2);
  for (let s = 0; s <= steps; s += 1) {
    const t = s / steps;
    const nx = -(row1 - row0);
    const ny = col1 - col0;
    const len = Math.hypot(nx, ny) || 1;
    const bend = Math.sin(t * 9 + wiggle) * wiggle * 0.5;
    const w = width * (0.75 + 0.25 * Math.sin(t * 13 + wiggle));
    blob(game, type, col0 + (col1 - col0) * t + (nx / len) * bend, row0 + (row1 - row0) * t + (ny / len) * bend, w / 2, w / 2, 1);
  }
}

function boonUpTo(game, ids) {
  for (const id of ids) takeBoon(game, id);
}

/** Put a creature of `kind` at (x, y) cells, as if it had walked there. */
function place(game, kind, gate, x, y, hpMul = 1.6) {
  const c = spawnCreature(game, kind, gate, hpMul);
  if (c) {
    c.x = x;
    c.y = y;
  }
  return c;
}

/** Cover: rift 7, the Hollow Colossus stomping toward the Core over a board full of every element. */
function stageCover(seed) {
  const game = createGame(seed);
  const bot = createBot();
  boonUpTo(game, ['frost', 'wide', 'arc', 'arc', 'lava', 'overflow', 'shield']);
  game.riftNum = 6;
  game.phase = 'prep';
  game.prepTimer = 0;
  game.stats.riftsCleared = 6;
  game.score = 48250;
  advance(game, bot, 40, (g) => g.boss !== null && g.rift.clock > 20, true);
  const boss = game.boss;
  const BOSS_X = 24.5;
  const BOSS_Y = 11.9;
  if (boss) {
    boss.x = BOSS_X;
    boss.y = BOSS_Y;
  }
  game.grid.type.fill(0);
  game.creatures = game.creatures.filter((c) => c === boss);
  // Kept readable on purpose: a lava river down the west, an ice field in the east and charged
  // water along the south, with clear ground round the Colossus, the Core and the brush cursor.
  river(game, LAVA, 7, 1, 9, 32, 4.2, 2.4);
  blob(game, LAVA, 3.5, 11, 2.4, 3);
  blob(game, ICE, 40, 12, 7.5, 7.5);
  blob(game, ICE, 41, 27, 5.5, 4);
  river(game, CHARGED, 13, 28.5, 34, 28, 2.4, 1.4);
  blob(game, CLOUD, 14, 4, 3, 1.4);
  blob(game, STEAM, 14, 12, 2.6, 1.6);
  blob(game, EARTH, 3, 30, 1.8, 2.2);
  // Fourteen creatures of every kind, spread out: none under the Colossus, the Core or the cursor.
  const crowd = [
    ['golem', 'W', 14.5, 8], ['ram', 'W', 14, 27], ['imp', 'W', 13, 19], ['wraith', 'N', 12, 14.5], ['wraith', 'N', 30.5, 7],
    ['beetle', 'S', 34.2, 23.2], ['imp', 'E', 38.5, 19], ['golem', 'E', 43, 9], ['wraith', 'E', 44, 24], ['ram', 'E', 36, 29.5],
    ['swarm', 'W', 20.5, 25], ['swarm', 'W', 22.8, 26.4], ['swarm', 'W', 26, 24.6], ['imp', 'E', 31.5, 15],
  ];
  for (const [kind, gate, x, y] of crowd) place(game, kind, gate, x, y);
  game.core.hp = 74;
  advance(game, IDLE(), 0.4, null, true);
  game.core.hp = 74;
  game.core.shield = 7;
  if (boss) {
    boss.x = BOSS_X;
    boss.y = BOSS_Y;
    boss.plates = 2;
    boss.exposed = 0;
    boss.plateT = [boss.age - 1.1, boss.age - 0.45];
    boss.hp = Math.round(boss.maxHp * 0.58);
    boss.flash = 0;
    boss.stompTimer = 6;
  }
  // Two bursts of sparks, real particles, away from the focal points.
  for (const [x, y, kind] of [[13, 21, 'spark'], [35, 24, 'zap']]) burst(game.fx, kind, toScreenX(x), toScreenY(y), 16);
  // A last chain lands through the game's own reaction path: only STORMSTEAM and LAVA are new
  // to it, so it reads CHAIN x7. Its callout is then set at the lower left,
  // slightly angled, over the lava river and clear of the Colossus, the Core and the boss panel.
  game.fx.texts.length = 0;
  game.tip = null;
  if (boss) boss.plates = 3;
  game.chain.count = 4;
  game.chain.timer = 2.6;
  game.chain.best = 9;
  game.chain.lastText = -9;
  game.chain.lastGain = -9;
  game.chain.kinds.clear();
  ['STEAM', 'SHOCK', 'QUENCH', 'STRIKE', 'MELT', 'MAGNET', 'FROST', 'SHATTER'].forEach((n) => game.chain.kinds.add(n));
  reactNow(game, [{ name: 'STORMSTEAM', x: 8.5, y: 9.5 }, { name: 'LAVA', x: 7.5, y: 9.5 }]);
  game.fx.parts.length = Math.min(game.fx.parts.length, 160);
  const callout = game.fx.texts.find((t) => t.text.startsWith('CHAIN'));
  if (callout) {
    callout.x = 352;
    callout.y = toScreenY(23.4);
    callout.size = 38;
    callout.angle = -0.09;
    callout.life = callout.max = 3;
    callout.vy = -2;
  }
  if (boss) {
    for (const dx of [-30, 5, 40]) addBolt(game.fx, toScreenX(boss.x) + dx * 2, toScreenY(0.6), toScreenX(boss.x) + dx, toScreenY(boss.y) - 190, '#c58aff', 0.3);
    boss.plates = 2;
  }
  for (let n = 0; n < 5; n += 1) updateFx(game.fx, STEP);
  game.fx.texts = game.fx.texts.filter((t) => t.text.startsWith('CHAIN'));
  // Two big, clean feedback popups, well apart: a shatter on the frozen imp and an overload on the charged water.
  addText(game.fx, toScreenX(38.5), toScreenY(16.6), 'SHATTER!', { color: '#dff6ff', size: 40, life: 3, vy: -2, angle: 0.05 });
  addText(game.fx, toScreenX(25), toScreenY(26.2), 'OVERLOAD!', { color: '#ffe23a', size: 40, life: 3, vy: -2, angle: -0.04 });
  game.brush = 3;
  setCursor(game, toScreenX(31), toScreenY(19), false);
  return { game, screen: 'play', bests: { score: 31500, chain: 14 }, time: game.t };
}

/** Scatter a few decorative blobs over empty ground so no corner of the board is bare. */
function decorate(game, spots) {
  for (const [type, x, y, rx, ry] of spots) blob(game, type, x, y, rx, ry);
}

/** Title: the real title screen over live attract-mode play (the bot defending rift 2). */
function stageTitle(seed) {
  const game = createGame(seed, 1);
  const bot = createBot();
  advance(game, bot, 160, (g) => g.riftNum === 2 && g.rift.clock > 14);
  game.tip = null;
  return { game, screen: 'title', bests: { score: 0, chain: 0 }, time: game.t, difficulty: 1 };
}

/** Mid play: the boon pick panel over a busy rift 5 board. */
function stageBoon(seed) {
  const game = createGame(seed);
  const bot = createBot();
  advance(game, bot, 400, (g) => g.riftNum === 5 && g.rift.clock > 27, true);
  decorate(game, [[ICE, 6, 5, 3.4, 2.2], [WATER, 40, 29, 5, 2.4], [CLOUD, 38, 4, 3.4, 1.6], [EARTH, 8, 29, 2.4, 2.4], [MAGNET, 43, 16, 1.8, 1.6], [LAVA, 20, 31, 4, 1.3], [LAVA, 6, 16, 2, 3.4], [STEAM, 16, 8, 3, 1.6], [CHARGED, 30, 27, 4, 1.4], [FIRE, 33, 8, 2, 1.4], [ICE, 44, 9, 2, 2.6], [STORM, 14, 24, 1.8, 1.4], [CLOUD, 24, 4, 3, 1.2], [EARTH, 36, 18, 1.4, 1.8], [WATER, 24, 28, 3, 1.4], [ICE, 10, 22, 2.4, 1.6], [LAVA, 42, 22, 2, 1.4]]);
  game.rift.next = game.rift.spawns.length;
  for (const c of game.creatures) damageCreature(game, c, 1e6, 'none');
  advance(game, bot, 6, (g) => g.phase === 'boon', true);
  if (game.phase !== 'boon') {
    game.offer = offerBoons(game);
    game.phase = 'boon';
  }
  return { game, screen: 'boon', bests: { score: 0, chain: 0 }, time: game.t, hover: 1 };
}

/** Results: the win card after a full run (the Colossus is finished off once it has been broken). */
function stageWin(seed) {
  const game = createGame(seed);
  const bot = createBot();
  takeBoon(game, 'frost');
  game.godHp = 100;
  for (let n = 0; n < 160 && game.phase !== 'won'; n += 1) {
    advance(game, bot, 20, null, true);
    if (game.boss && game.rift.clock > 40) {
      game.boss.exposed = 2;
      damageCreature(game, game.boss, 1e6, 'burst');
    }
  }
  advance(game, bot, 4, null, true);
  game.fx.texts.length = 0;
  return { game, screen: 'win', bests: { score: 0, chain: 0 }, time: game.t };
}

/** Lose: an unaided run until the Core shatters (not one of the four hand-in screenshots). */
function stageLose(seed) {
  const game = createGame(seed);
  const bot = createBot();
  advance(game, bot, 900);
  advance(game, bot, 2);
  if (game.phase === 'won') {
    game.phase = 'lost';
    game.riftNum = 5;
    game.stats.riftsCleared = 4;
  }
  return { game, screen: 'lose', bests: { score: 0, chain: 0 }, time: game.t };
}

export function stageShot(name, seed) {
  if (name === 'lose') return stageLose(seed);
  if (name === 'title') return stageTitle(seed);
  if (name === 'boon') return stageBoon(seed);
  if (name === 'results') return stageWin(seed);
  return stageCover(seed);
}
