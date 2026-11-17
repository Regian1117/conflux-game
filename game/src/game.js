// The game state and its fixed-step update. createGame builds a fresh run; updateGame advances it
// by one step: paint input, essence, cell decay, the reaction tick, creatures, the boss, rifts and
// the win/lose phases. It never touches the DOM, so the autopilot and screenshot scenes use it too.
import { BRUSH, CORE, DIFFICULTIES, ESSENCE, FIELD, FIRST_PREP_SECONDS, PREP_SECONDS, REACT, RIFT_COUNT } from './config.js';
import { BRUSHES } from './elements.js';
import { CELLS, createGrid, fromScreenX, fromScreenY, paintDab, toScreenX, toScreenY } from './grid.js';
import { computeFlow, createFlow } from './pathing.js';
import { createRandom } from './random.js';
import { addText, burst, createFx, updateFx } from './particles.js';
import { ambientEffects, decayCells, reactNow, tickReactions } from './reactions.js';
import { updateCreatures } from './creatures.js';
import { updateBoss } from './boss.js';
import { startRift, updateRift } from './rifts.js';
import { REROLL_COST, deriveMods, offerBoons, takeBoon } from './boons.js';
import { NODE_TYPES, generateMap, nodeById, reachableNodes } from './path.js';
import { addScore, tickChain } from './score.js';
import { sfx } from './audio.js';

export function createGame(seed, difficulty = 1) {
  const game = {
    seed,
    difficulty,
    tuning: DIFFICULTIES[difficulty],
    rng: createRandom(seed),
    map: generateMap(createRandom(seed ^ 0x5eed1234)),
    route: [],
    node: null,
    pendingNode: null,
    cam: { zoom: 1, cx: FIELD.w / 2, cy: FIELD.h / 2, hold: 0, fx: FIELD.w / 2, fy: FIELD.h / 2 },
    rerolls: 1,
    offerBias: null,
    t: 0,
    grid: createGrid(),
    mark: new Uint8Array(CELLS),
    flow: createFlow(),
    magnets: [],
    creatures: [],
    nextId: 1,
    reactAcc: 0,
    reactTick: 0,
    floodBonus: 0,
    essence: [ESSENCE.max, ESSENCE.max, ESSENCE.max, ESSENCE.max],
    emptyFlash: [0, 0, 0, 0],
    brush: 0,
    core: { hp: CORE.maxHp, shield: 0, hitFlash: 0 },
    score: 0,
    chain: { count: 0, timer: 0, best: 0, lastText: -9, lastGain: -9, kinds: new Set() },
    stats: { shieldAbsorbed: 0, byReaction: {}, kills: 0, reactions: 0, bestChain: 0, painted: 0, leaks: 0, coreHits: 0, byKind: {} },
    boons: {},
    mods: {},
    rift: null,
    riftNum: 0,
    phase: 'path',
    prepTimer: FIRST_PREP_SECONDS,
    clearTimer: 0,
    offer: [],
    seen: {},
    tip: null,
    boss: null,
    cursor: { x: 0, y: 0, down: false, inField: false, lastX: null, lastY: null, trail: [] },
  };
  game.fx = createFx(createRandom(seed ^ 0x9e3779b9));
  deriveMods(game);
  computeFlow(game.flow, game.grid);
  return game;
}

export function selectBrush(game, index) {
  if (index >= 0 && index < BRUSHES.length) game.brush = index;
}

/** Skip the rest of the preparation countdown and open the next rift now. */
export function callRift(game) {
  if (game.phase === 'prep') game.prepTimer = 0;
}

/** Paint along the mouse path since the last step with the chosen brush, spending its essence. */
function applyPainting(game) {
  const cur = game.cursor;
  if (!cur.down || !cur.inField) {
    cur.lastX = null;
    return;
  }
  const brush = BRUSHES[game.brush];
  const fromX = cur.lastX ?? cur.x;
  const fromY = cur.lastY ?? cur.y;
  const steps = Math.max(1, Math.ceil(Math.hypot(cur.x - fromX, cur.y - fromY) / BRUSH.spacing));
  for (let s = 1; s <= steps; s += 1) {
    const x = fromX + ((cur.x - fromX) * s) / steps;
    const y = fromY + ((cur.y - fromY) * s) / steps;
    const budget = game.essence[game.brush];
    if (budget < 0.5) {
      game.emptyFlash[game.brush] = 0.5;
      break;
    }
    const result = paintDab(game.grid, brush, x, y, game.mods.brushRadius, budget, game.mods.lifeMul, ESSENCE.perCell, ESSENCE.refreshCost);
    if (result.cost > 0) {
      game.essence[game.brush] -= result.cost;
      game.stats.painted += result.cost;
      sfx.paint(game.brush);
      if (game.fx.rng.chance(0.5)) burst(game.fx, ['ember', 'splash', 'dust', 'zap'][game.brush], toScreenX(x), toScreenY(y), 1);
    }
    if (result.events.length > 0) reactNow(game, result.events);
  }
  const tail = cur.trail[cur.trail.length - 1];
  if (!tail || Math.hypot(tail.x - cur.x, tail.y - cur.y) > 0.4) cur.trail.push({ x: cur.x, y: cur.y, age: 0, brush: game.brush });
  cur.lastX = cur.x;
  cur.lastY = cur.y;
}

/** The brush position in cell units from a canvas pixel position (used by main and shots). */
export function setCursor(game, px, py, down) {
  const c = game.cursor;
  c.x = fromScreenX(px);
  c.y = fromScreenY(py);
  c.inField = px >= FIELD.x && py >= FIELD.y && px < FIELD.x + FIELD.w && py < FIELD.y + FIELD.h;
  c.down = down;
}

/** Reward for clearing a rift of the current node's type (essence, repair, score), shown as text. */
function applyNodeReward(game) {
  const type = game.node?.type;
  const x = FIELD.x + FIELD.w / 2;
  const y = FIELD.y + 230;
  if (type === 'tide') {
    for (let i = 0; i < 4; i += 1) game.essence[i] = Math.min(game.mods.essenceMax, game.essence[i] + 40);
    addText(game.fx, x, y, '+40 ESSENCE IN EVERY POOL', { color: '#2ec8ff', size: 30, life: 2 });
  } else if (type === 'stone') {
    game.core.hp = Math.min(CORE.maxHp, game.core.hp + 20);
    addText(game.fx, x, y, 'CORE REPAIRED +20', { color: '#c9a36a', size: 30, life: 2 });
  } else if (type === 'storm') {
    addScore(game, 600);
    game.chain.best = Math.max(game.chain.best, game.chain.count + 3);
    addText(game.fx, x, y, 'STORM BONUS +600', { color: '#ffe23a', size: 30, life: 2 });
  }
  game.offerBias = NODE_TYPES[type]?.bias ?? null;
}

function finishRift(game) {
  game.phase = 'clear';
  game.clearTimer = game.riftNum === RIFT_COUNT ? 2.4 : 1.6;
  addScore(game, 300 * game.riftNum);
  game.stats.riftsCleared = game.riftNum;
  applyNodeReward(game);
  addText(game.fx, FIELD.x + FIELD.w / 2, FIELD.y + 150, game.riftNum === RIFT_COUNT ? 'THE RIFTS ARE SEALED' : `RIFT ${game.riftNum} CLEARED`, { color: '#6dffb0', size: 54, life: 2.2, vy: -8, pop: 0.4 });
}

/** Advance one fixed step. Visual effects keep moving after the run ends. */
export function updateGame(game, dt) {
  updateFx(game.fx, dt);
  for (let i = 0; i < 4; i += 1) game.emptyFlash[i] = Math.max(0, game.emptyFlash[i] - dt);
  game.core.hitFlash = Math.max(0, game.core.hitFlash - dt);
  // Climax camera: ease in toward the action while `hold` lasts, then back out.
  const cam = game.cam;
  cam.hold = Math.max(0, cam.hold - dt);
  const ease = Math.min(1, dt * 2.2);
  cam.zoom += ((cam.hold > 0 ? 1.25 : 1) - cam.zoom) * ease;
  cam.cx += ((cam.hold > 0 ? cam.fx : FIELD.w / 2) - cam.cx) * ease;
  cam.cy += ((cam.hold > 0 ? cam.fy : FIELD.h / 2) - cam.cy) * ease;
  // The brush's fading stroke trail.
  for (const point of game.cursor.trail) point.age += dt;
  game.cursor.trail = game.cursor.trail.filter((point) => point.age < 0.9);
  if (game.phase === 'won' || game.phase === 'lost' || game.phase === 'path' || game.phase === 'shrine') return;

  game.t += dt;
  if (game.tip) {
    game.tip.timer -= dt;
    if (game.tip.timer <= 0) game.tip = null;
  }
  for (let i = 0; i < 4; i += 1) game.essence[i] = Math.min(game.mods.essenceMax, game.essence[i] + game.mods.regen * dt);
  applyPainting(game);
  decayCells(game, dt);
  ambientEffects(game);

  game.reactAcc += dt;
  if (game.reactAcc >= REACT.interval) {
    game.reactAcc -= REACT.interval;
    tickReactions(game);
    computeFlow(game.flow, game.grid, game.rift !== null && game.rift.doneFor > 20);
  }

  if (game.phase === 'prep') {
    game.prepTimer -= dt;
    if (game.prepTimer <= 0) {
      game.core.shield = game.mods.shieldMax;
      startRift(game, game.riftNum + 1);
      game.phase = 'rift';
    }
  } else if (game.phase === 'rift') {
    if (updateRift(game, dt)) finishRift(game);
  } else if (game.phase === 'clear') {
    game.clearTimer -= dt;
    if (game.clearTimer <= 0) {
      if (game.riftNum >= RIFT_COUNT) {
        game.phase = 'won';
        sfx.win();
      } else {
        game.offer = offerBoons(game, game.offerBias);
        game.pendingNode = null;
        game.phase = 'path';
      }
    }
  }

  updateCreatures(game, dt);
  updateBoss(game, dt);
  tickChain(game, dt);

  if (game.core.hp <= 0 && game.phase !== 'lost') {
    game.phase = 'lost';
    game.chain.count = 0;
    sfx.lose();
  }
}

/** Mark `id` as the next rift (it starts once any pending boon is taken). Returns false if unreachable. */
export function pickNode(game, id) {
  if (game.phase !== 'path' || !reachableNodes(game.map, game.route).some((n) => n.id === id)) return false;
  game.pendingNode = id;
  tryProceed(game);
  return true;
}

/** Start the chosen node once the boon pick (if any) is done: a rift gets its prep countdown, a shrine its choice. */
export function tryProceed(game) {
  if (game.phase !== 'path' || !game.pendingNode || game.offer.length > 0) return false;
  const node = nodeById(game.map, game.pendingNode);
  game.pendingNode = null;
  game.route.push(node.id);
  game.node = node;
  if (node.type === 'shrine') {
    game.phase = 'shrine';
    return true;
  }
  game.phase = 'prep';
  game.prepTimer = game.riftNum === 0 ? FIRST_PREP_SECONDS : PREP_SECONDS;
  game.core.shield = game.mods.shieldMax;
  return true;
}

/** A shrine: heal the Core or gain a reroll. It counts as a cleared rift. */
export function resolveShrine(game, choice) {
  if (game.phase !== 'shrine') return;
  if (choice === 'heal') game.core.hp = Math.min(CORE.maxHp, game.core.hp + 35);
  else game.rerolls += 1;
  game.riftNum += 1;
  game.stats.riftsCleared = game.riftNum;
  game.offer = [];
  game.phase = 'path';
}

/** Redraw the three boons: a free reroll if one is held, else it costs REROLL_COST essence from every pool. */
export function rerollBoons(game) {
  if (game.phase !== 'path' || game.offer.length === 0) return false;
  if (game.rerolls > 0) game.rerolls -= 1;
  else if (Math.min(...game.essence) >= REROLL_COST) for (let i = 0; i < 4; i += 1) game.essence[i] -= REROLL_COST;
  else return false;
  game.offer = offerBoons(game, game.offerBias);
  return true;
}

/** Let a bot (attract mode, screenshot scenes) take care of the path screen: a boon, then a node. */
export function autoAdvance(game, preference = []) {
  if (game.phase === 'shrine') resolveShrine(game, game.core.hp < 80 ? 'heal' : 'reroll');
  if (game.phase !== 'path') return;
  if (game.offer.length > 0) {
    const rank = (b) => (preference.includes(b.id) ? preference.indexOf(b.id) : 99);
    const pick = [...game.offer].sort((a, b) => rank(a) - rank(b))[0];
    takeBoon(game, pick.id);
    game.offer = [];
  }
  const nodes = reachableNodes(game.map, game.route);
  pickNode(game, nodes[game.route.length % nodes.length].id);
  if (game.phase === 'shrine') resolveShrine(game, game.core.hp < 80 ? 'heal' : 'reroll');
}
