// The game state and its fixed-step update. createGame builds a fresh run; updateGame advances it
// by one step: paint input, essence, cell decay, the reaction tick, creatures, the boss, rifts and
// the win/lose phases. It never touches the DOM, so the autopilot and screenshot scenes use it too.
import { BRUSH, CORE, ESSENCE, FIELD, FIRST_PREP_SECONDS, PREP_SECONDS, REACT, RIFT_COUNT } from './config.js';
import { BRUSHES } from './elements.js';
import { CELLS, createGrid, fromScreenX, fromScreenY, paintDab, toScreenX, toScreenY } from './grid.js';
import { computeFlow, createFlow } from './pathing.js';
import { createRandom } from './random.js';
import { addText, burst, createFx, updateFx } from './particles.js';
import { ambientEffects, decayCells, reactNow, tickReactions } from './reactions.js';
import { updateCreatures } from './creatures.js';
import { updateBoss } from './boss.js';
import { startRift, updateRift } from './rifts.js';
import { deriveMods, offerBoons } from './boons.js';
import { addScore, tickChain } from './score.js';
import { sfx } from './audio.js';

export function createGame(seed) {
  const game = {
    seed,
    rng: createRandom(seed),
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
    stats: { kills: 0, reactions: 0, bestChain: 0, painted: 0, leaks: 0, coreHits: 0, byKind: {} },
    boons: {},
    mods: {},
    rift: null,
    riftNum: 0,
    phase: 'prep',
    prepTimer: FIRST_PREP_SECONDS,
    clearTimer: 0,
    offer: [],
    seen: {},
    tip: null,
    boss: null,
    cursor: { x: 0, y: 0, down: false, inField: false, lastX: null, lastY: null },
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

function finishRift(game) {
  game.phase = 'clear';
  game.clearTimer = game.riftNum === RIFT_COUNT ? 2.4 : 1.6;
  addScore(game, 300 * game.riftNum);
  game.stats.riftsCleared = game.riftNum;
  addText(game.fx, FIELD.x + FIELD.w / 2, FIELD.y + 150, game.riftNum === RIFT_COUNT ? 'THE RIFTS ARE SEALED' : `RIFT ${game.riftNum} CLEARED`, { color: '#6dffb0', size: 54, life: 2.2, vy: -8, pop: 0.4 });
}

/** Advance one fixed step. Visual effects keep moving after the run ends. */
export function updateGame(game, dt) {
  updateFx(game.fx, dt);
  for (let i = 0; i < 4; i += 1) game.emptyFlash[i] = Math.max(0, game.emptyFlash[i] - dt);
  game.core.hitFlash = Math.max(0, game.core.hitFlash - dt);
  if (game.phase === 'won' || game.phase === 'lost' || game.phase === 'boon') return;

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
    computeFlow(game.flow, game.grid);
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
        game.offer = offerBoons(game);
        game.phase = 'boon';
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

/** Called after a boon is chosen: start the preparation countdown for the next rift. */
export function beginNextPrep(game) {
  game.phase = 'prep';
  game.prepTimer = PREP_SECONDS;
  game.core.shield = game.mods.shieldMax;
}
