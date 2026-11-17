// The screenshot scenes behind ?shot=cover|title|path|results. Each plays the real rules forward
// from a fresh game with the painting bot (autopilot.js) at the controls, so every frame is genuine
// gameplay and the same seed always gives the same frame. A few helpers stage the moment worth
// photographing (the board filled with every element, a chain about to land) by painting through
// the same grid functions the player's brush uses.
import { COLS, ROWS, STEP } from './config.js';
import { CHARGED, CLOUD, EARTH, ICE, LAVA, MAGNET, STEAM, STORM, WATER } from './elements.js';
import { botStep, createBot } from './autopilot.js';
import { autoAdvance, callRift, createGame, setCursor, updateGame } from './game.js';
import { setCell, toScreenX, toScreenY } from './grid.js';
import { offerBoons, takeBoon } from './boons.js';
import { damageCreature, spawnCreature } from './creatures.js';
import { reactNow } from './reactions.js';
import { addBolt, addFlash, addText, burst, updateFx } from './particles.js';
import { nodeById, reachableNodes } from './path.js';
import { computeFlow } from './pathing.js';

const BOON_PREFERENCE = ['frost', 'wide', 'arc', 'overflow', 'shield', 'slowdecay', 'siphon', 'lava', 'mend'];
const IDLE = () => ({ queue: [], stroke: null, cooldown: 99, progress: 0, flip: 0 });

/**
 * Run the game forward for up to `seconds` or until `until(game)` is true. In `god` mode the Core
 * and essence are topped up (to reach a late rift quickly); the bot takes boons and nodes by
 * itself and skips prep.
 */
function advance(game, bot, seconds, until, god = false) {
  for (let n = 0; n < seconds / STEP; n += 1) {
    autoAdvance(game, BOON_PREFERENCE);
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
      if (Math.abs(col - 25) <= 1 && Math.abs(row - 14) <= 1) continue;
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

/** Follow the map's first branch to record a route of `length` nodes without playing them. */
function walkRoute(game, length) {
  game.route = [];
  for (let n = 0; n < length; n += 1) {
    const nodes = reachableNodes(game.map, game.route);
    game.route.push(nodes[n % nodes.length].id);
  }
  game.node = nodeById(game.map, game.route[game.route.length - 1]);
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

/** A thick forked lightning bolt (white core, violet glow) with two short branches. */
function forkedBolt(game, x1, y1, x2, y2) {
  addBolt(game.fx, x1, y1, x2, y2, '#c58aff', 3, 2.2);
  const mx = x1 + (x2 - x1) * 0.45;
  const my = y1 + (y2 - y1) * 0.45;
  addBolt(game.fx, mx, my, mx + 55, my + 70, '#c58aff', 3, 1.2);
  addBolt(game.fx, x1 + (x2 - x1) * 0.7, y1 + (y2 - y1) * 0.7, x1 + (x2 - x1) * 0.7 - 50, y1 + (y2 - y1) * 0.7 + 55, '#c58aff', 3, 1);
}

/** Cover: rift 7, painting mid-stroke over the storm pool, every area tagged, creatures converging from three sides. */
function stageCover(seed) {
  const game = createGame(seed);
  const bot = createBot();
  for (const id of ['frost', 'wide', 'arc', 'arc', 'lava', 'overflow', 'shield']) takeBoon(game, id);
  game.riftNum = 6;
  walkRoute(game, 7);
  game.phase = 'prep';
  game.prepTimer = 0;
  game.stats.riftsCleared = 6;
  game.score = 30400;
  advance(game, bot, 40, (g) => g.boss !== null && g.rift.clock > 20, true);
  const boss = game.boss;
  const BOSS_X = 38.5;
  const BOSS_Y = 11;
  game.grid.type.fill(0);
  game.creatures = game.creatures.filter((c) => c === boss);
  // West: a smooth lava river between earth walls, steam where it meets a pond.
  river(game, LAVA, 8.5, 1, 9, 25, 4.4, 2.6);
  river(game, EARTH, 4.5, 1, 5, 26, 1.9, 1.2);
  river(game, EARTH, 12.7, 1, 13, 19, 1.9, 1.2);
  blob(game, WATER, 14, 24, 3.6, 2.2);
  blob(game, STEAM, 12.5, 21.5, 3.8, 2);
  blob(game, STEAM, 16, 23, 2.4, 1.4);
  blob(game, MAGNET, 19.5, 19.5, 1.7, 1.1);
  // Middle right: the storm cloud, and the pool under it: shocked to the left of the brush, still water to its right.
  blob(game, CLOUD, 38, 3.3, 7.5, 1.8);
  blob(game, CLOUD, 30.5, 4.3, 2.8, 1.4);
  blob(game, CLOUD, 45.5, 4.4, 3, 1.5);
  blob(game, WATER, 38.5, 19.4, 10, 2.4);
  for (let col = 0; col < 44; col += 1) for (let row = 14; row < 24; row += 1) if (game.grid.type[row * COLS + col] === WATER) setCell(game.grid, col, row, CHARGED, 1.8);
  // Lower right: the small ice patch with three frozen creatures.
  blob(game, ICE, 44.5, 25.3, 4.4, 2.7);
  if (boss) {
    boss.x = BOSS_X;
    boss.y = BOSS_Y;
  }
  for (const c of game.creatures) {
    c.steamed = 0;
    c.wet = 0;
  }
  for (const [kind, x, y] of [['golem', 42.4, 25.4], ['wraith', 46, 26], ['imp', 44.4, 23.9]]) place(game, kind, 'E', x, y).frozen = 99;
  // Converging: from the west (an imp burning in the lava, a golem and swarm), the north (wraiths) and the south (ram, beetle).
  place(game, 'imp', 'W', 8.8, 11);
  place(game, 'golem', 'W', 15.2, 14.2);
  for (const [x, y] of [[17.6, 12.8], [18.8, 14.9], [16.8, 16.2]]) place(game, 'swarm', 'W', x, y);
  place(game, 'wraith', 'N', 22.4, 6.2);
  place(game, 'wraith', 'N', 28.2, 7.6);
  place(game, 'ram', 'S', 24, 22.4);
  place(game, 'beetle', 'S', 28.4, 25);
  // The chain: seven creatures across the pool, each hit in turn.
  const links = [['imp', 30.4, 18.7], ['wraith', 33.2, 20.3], ['beetle', 35.9, 18.7], ['golem', 38.6, 20.3], ['swarm', 41.3, 18.7], ['ram', 44, 20.3], ['imp', 47.2, 18.7]];
  const chain = links.map(([kind, x, y]) => place(game, kind, 'E', x, y));
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
  computeFlow(game.flow, game.grid);
  game.fx.parts.length = 0;
  burst(game.fx, 'zap', toScreenX(12.5), toScreenY(21.5), 14, ['#ffe9a8', '#ffffff']);
  burst(game.fx, 'spark', toScreenX(16), toScreenY(23), 8);
  // One callout: the chain lands through the game's own reaction path, then is placed above the storm.
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
  reactNow(game, [{ name: 'STORMSTEAM', x: 12.5, y: 21.5 }, { name: 'LAVA', x: 10.5, y: 21.5 }]);
  game.fx.bolts.length = 0;
  const callout = game.fx.texts.find((t) => t.text.startsWith('CHAIN'));
  if (callout) {
    callout.x = 735;
    callout.y = 104;
    callout.size = 32;
    callout.angle = -0.03;
    callout.life = callout.max = 3;
    callout.vy = 0;
  }
  // The storm: three thick forked bolts out of the cloud, onto the Colossus's shoulder, the pool and the ground by the Core.
  forkedBolt(game, 800, 128, 872, 232);
  forkedBolt(game, 940, 130, 952, 430);
  forkedBolt(game, 660, 128, 606, 318);
  // The chain itself, link by link, with a numbered spark at each hit.
  chain.forEach((c, i) => {
    const x = toScreenX(c.x);
    const y = toScreenY(c.y);
    if (i > 0) addBolt(game.fx, toScreenX(chain[i - 1].x), toScreenY(chain[i - 1].y), x, y, '#9ff3ff', 3, 2.4);
    addText(game.fx, x, y - 40, String(i + 1), { color: '#ffffff', size: 24, life: 3, vy: 0 });
    burst(game.fx, 'zap', x, y, 5, ['#ffffff', '#9ff3ff']);
  });
  addFlash(game.fx, 0.12, '#dfe8ff');
  if (boss) boss.plates = 2;
  for (let n = 0; n < 4; n += 1) updateFx(game.fx, STEP);
  // The player, mid-stroke: a fresh STORM stroke across the pool behind the brush.
  game.brush = 3;
  game.cursor = { x: 44.6, y: 20.4, down: true, inField: true, lastX: 44.6, lastY: 20.4, trail: [] };
  for (let i = 0; i <= 15; i += 1) game.cursor.trail.push({ x: 29.8 + i * 0.99, y: 20.5 + Math.sin(i * 0.8) * 0.2, age: (15 - i) * 0.028, brush: 3 });
  game.showAllTags = true;
  game.showHowTo = true;
  return { game, screen: 'play', bests: { score: 31500, chain: 14 }, time: game.t };
}

/** Title: the real title screen over live attract-mode play (the bot defending rift 2). */
function stageTitle(seed) {
  const game = createGame(seed, 1);
  const bot = createBot();
  advance(game, bot, 160, (g) => g.riftNum === 2 && g.rift.clock > 14);
  game.tip = null;
  return { game, screen: 'title', bests: { score: 0, chain: 0 }, time: game.t, difficulty: 1 };
}

/** The Rift Path at rift 4 of 7: three nodes behind us, two branches ahead, the boon pick open. */
function stagePath(seed) {
  const game = createGame(seed);
  const bot = createBot();
  advance(game, bot, 400, (g) => g.phase === 'path' && g.riftNum >= 3 && g.offer.length > 0, true);
  if (game.offer.length === 0) game.offer = offerBoons(game, null);
  const ahead = reachableNodes(game.map, game.route);
  return { game, screen: 'path', bests: { score: 0, chain: 0 }, time: game.t, hoverNode: (ahead.find((n) => n.type !== 'shrine') ?? ahead[0]).id, hoverBoon: -1 };
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
  // The run kept the Core topped up for the bot; report the state a real run would end in:
  // 26 hits taken, 12 points soaked by the shield, the Core at 74%.
  game.stats.coreHits = 26;
  game.stats.shieldAbsorbed = 12;
  game.core.hp = 74;
  const previous = Math.round((game.score * 0.74) / 100) * 100;
  return { game, screen: 'win', bests: { score: previous, chain: 19 }, time: game.t };
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
  if (name === 'path') return stagePath(seed);
  if (name === 'results') return stageWin(seed);
  return stageCover(seed);
}
