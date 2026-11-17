// The screenshot scenes behind ?shot=cover|early|boon|win. Each plays the real rules forward from
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
import { addBolt, burst, updateFx } from './particles.js';

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
      game.core.hp = Math.max(game.core.hp, 70);
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
  // A lava river down the west, an ice field in the east, charged water arcing between them.
  river(game, LAVA, 7, 1, 9, 32, 4.2, 2.4);
  river(game, LAVA, 9, 25, 19, 30, 2.6, 1.4);
  blob(game, LAVA, 3.5, 11, 2.4, 3);
  blob(game, ICE, 39, 12, 8, 8);
  blob(game, ICE, 40, 27, 6, 4.4);
  blob(game, ICE, 31, 5, 3.4, 2.2);
  river(game, WATER, 13, 27.5, 36, 26.5, 2.6, 1.6);
  river(game, WATER, 14, 31.5, 33, 31, 2, 1);
  blob(game, STORM, 33, 20, 2.2, 1.8);
  blob(game, CLOUD, 15, 4, 3.2, 1.6);
  blob(game, CLOUD, 33, 3.5, 3.4, 1.5);
  blob(game, CLOUD, 12, 17, 2.4, 1.4);
  blob(game, STEAM, 14, 11, 4.2, 2.4);
  blob(game, STEAM, 27, 26, 4, 1.6);
  blob(game, STEAM, 36, 21, 3, 2);
  blob(game, FIRE, 18, 22, 2, 1.4);
  blob(game, FIRE, 30, 23, 2, 1.2);
  blob(game, EARTH, 16, 15.5, 1.6, 1.2);
  blob(game, EARTH, 44.5, 18, 1.4, 3.4);
  blob(game, EARTH, 3, 30, 1.8, 2.2);
  blob(game, MAGNET, 27, 31, 2.2, 1.3);
  // Everything that lives: 20 creatures of every kind, none under the Colossus or the Core.
  const crowd = [
    ['golem', 'W', 15.5, 7.5], ['golem', 'E', 33.5, 9], ['ram', 'W', 13.5, 21], ['ram', 'E', 31, 15.5],
    ['wraith', 'N', 18.5, 9.5], ['wraith', 'N', 36, 7.5], ['wraith', 'N', 29.5, 13], ['beetle', 'S', 35.5, 18],
    ['beetle', 'S', 18, 24.5], ['imp', 'E', 41, 20], ['imp', 'E', 38, 30], ['imp', 'W', 21, 30], ['imp', 'W', 12, 20],
    ['swarm', 'W', 21, 21], ['swarm', 'W', 22, 22.1], ['swarm', 'W', 20.2, 22.2], ['swarm', 'W', 28, 21], ['swarm', 'W', 29, 20.2],
    ['swarm', 'W', 32, 25.6], ['swarm', 'W', 11, 8],
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
  // Explosions: real particle bursts at spots across the board.
  for (const [x, y, kind] of [[12, 19, 'spark'], [35, 22, 'zap'], [30, 7, 'spark'], [16, 27, 'ember'], [42, 7, 'shard'], [22, 22, 'spark']]) burst(game.fx, kind, toScreenX(x), toScreenY(y), 26);
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
  game.brush = 3;
  setCursor(game, toScreenX(40), toScreenY(24), false);
  return { game, screen: 'play', bests: { score: 31500, chain: 14 }, time: game.t };
}

/** Scatter a few decorative blobs over empty ground so no corner of the board is bare. */
function decorate(game, spots) {
  for (const [type, x, y, rx, ry] of spots) blob(game, type, x, y, rx, ry);
}

/** Early play: rift 2 with a fire-and-water steam trap mid-reaction, creatures caught inside. */
function stageEarly(seed) {
  const game = createGame(seed);
  const bot = createBot();
  const golem = (g) => g.creatures.find((c) => c.kind === 'golem');
  advance(game, bot, 160, (g) => g.riftNum === 2 && golem(g) !== undefined && golem(g).x < 41);
  game.grid.type.fill(0);
  decorate(game, [[EARTH, 6, 6, 2, 1.4], [EARTH, 42, 29, 2.4, 1.6], [LAVA, 10, 28, 2.6, 1.6], [ICE, 40, 6, 3.4, 2], [WATER, 14, 7, 3, 1.4], [STEAM, 20, 28, 3, 1.4], [CLOUD, 30, 5, 2.6, 1.2], [FIRE, 45, 24, 1.2, 1.2], [LAVA, 36, 31, 3.4, 1.2], [WATER, 6, 18, 1.6, 4], [ICE, 24, 30, 2.6, 1.4], [EARTH, 24, 6, 2.4, 1.2], [STORM, 44, 10, 1.4, 1.8], [MAGNET, 18, 25, 1.8, 1.2], [CLOUD, 8, 11, 2.4, 1.3], [FIRE, 12, 14, 1.5, 1.2], [WATER, 31, 28, 3, 1.2], [EARTH, 12, 22, 1.4, 1.4]]);
  // The player's trap: a water stroke, then fire beside it, across the Golem's path.
  const hand = createBot();
  hand.queue.push({ brush: 1, ax: 33.2, ay: 12.5, bx: 33.2, by: 22.5 }, { brush: 0, ax: 34.9, ay: 22.5, bx: 34.9, by: 12.5 });
  hand.cooldown = 0;
  advance(game, hand, 4, () => hand.queue.length === 0 && !hand.stroke);
  // Creatures walk into the trap: a mix caught in the steam, imps drowning in the water column.
  for (const [kind, x, y] of [['swarm', 34, 14], ['swarm', 34.8, 15.2], ['swarm', 33.6, 16.4], ['swarm', 35.4, 18], ['swarm', 34.2, 19.4], ['swarm', 33.8, 20.6], ['imp', 33.2, 13.5], ['imp', 33.2, 18.5], ['imp', 33.2, 21.5]]) place(game, kind, 'E', x, y, 1.3);
  place(game, 'swarm', 'N', 16, 11);
  place(game, 'swarm', 'N', 17, 11.8);
  place(game, 'ram', 'W', 9, 17);
  advance(game, IDLE(), 0.55);
  game.tip = null;
  game.brush = 0;
  setCursor(game, toScreenX(30.5), toScreenY(14.5), false);
  return { game, screen: 'play', bests: { score: 0, chain: 0 }, time: game.t };
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

/** End: the win screen after a full run (the Colossus is finished off once it has been broken). */
function stageWin(seed) {
  const game = createGame(seed);
  const bot = createBot();
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
  return { game, screen: game.phase === 'won' ? 'win' : 'lose', bests: { score: 0, chain: 0 }, time: game.t };
}

export function stageShot(name, seed) {
  if (name === 'lose') return stageLose(seed);
  if (name === 'early') return stageEarly(seed);
  if (name === 'boon') return stageBoon(seed);
  if (name === 'win') return stageWin(seed);
  return stageCover(seed);
}
