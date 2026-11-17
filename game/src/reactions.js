// Cell life and the reaction tick. Painted cells age and fade; four times a second every pair of
// touching cells is checked against the rule table (elements.js), products spread or strike, and
// everything that reacted feeds the chain counter with big floating callouts.
import { COLS, FIELD, REACT, ROWS } from './config.js';
import { CHARGED, CLOUD, EARTH, EMPTY, FIRE, ICE, LAVA, MAGNET, STEAM, STORM, WATER, ruleFor } from './elements.js';
import { inGrid, setCell, toScreenX, toScreenY } from './grid.js';
import { addBolt, addFlash, addShake, addText, burst } from './particles.js';
import { damageArea, damageCreature } from './creatures.js';
import { noteReaction } from './boss.js';
import { addScore } from './score.js';
import { sfx } from './audio.js';

const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];

const CALLOUT_COLORS = {
  STEAM: '#e9f7fb', LAVA: '#ff8a2a', SHOCK: '#ffe23a', MAGNET: '#ff8fae', STORMSTEAM: '#c58aff',
  QUENCH: '#cfe9f2', SHATTER: '#dff6ff', MELT: '#8fe3ff', FROST: '#bfeaff', STRIKE: '#ffe23a',
};
const CALLOUT_ORDER = ['STORMSTEAM', 'SHATTER', 'SHOCK', 'LAVA', 'QUENCH', 'STEAM', 'MAGNET', 'FROST', 'MELT', 'STRIKE'];

/** Age every painted cell and clear the ones whose life has run out. */
export function decayCells(game, dt) {
  const g = game.grid;
  for (let i = 0; i < g.type.length; i += 1) {
    const type = g.type[i];
    if (type === EMPTY) continue;
    g.age[i] += dt;
    g.life[i] -= dt;
    if (g.life[i] <= 0) {
      g.type[i] = EMPTY;
      g.life[i] = 0;
    }
  }
}

/** Ambient sparks, embers, steam and zaps from a random sample of cells, every step. */
export function ambientEffects(game) {
  const g = game.grid;
  for (let n = 0; n < 70; n += 1) {
    const i = game.fx.rng.int(g.type.length);
    const type = g.type[i];
    if (type === EMPTY) continue;
    const x = toScreenX((i % COLS) + 0.5) + game.fx.rng.range(-8, 8);
    const y = toScreenY(Math.floor(i / COLS) + 0.5) + game.fx.rng.range(-8, 8);
    if (type === FIRE && game.fx.rng.chance(0.35)) burst(game.fx, 'ember', x, y, 1);
    else if (type === LAVA && game.fx.rng.chance(0.2)) burst(game.fx, 'ember', x, y, 1);
    else if (type === STEAM && game.fx.rng.chance(0.3)) burst(game.fx, 'steam', x, y, 1);
    else if ((type === CHARGED || type === STORM) && game.fx.rng.chance(0.3)) burst(game.fx, 'zap', x, y, 1);
    else if (type === CLOUD && game.fx.rng.chance(0.25)) burst(game.fx, 'zap', x, y, 1, ['#c58aff', '#ffffff']);
    else if (type === ICE && game.fx.rng.chance(0.04)) burst(game.fx, 'shard', x, y, 1);
  }
}

/** Charge every water cell connected to (col, row); returns how many cells it turned. */
function floodShock(game, col, row) {
  const g = game.grid;
  const stack = [row * COLS + col];
  const seen = new Set(stack);
  let turned = 0;
  while (stack.length > 0 && turned < 500) {
    const i = stack.pop();
    const c = i % COLS;
    const r = Math.floor(i / COLS);
    for (let k = 0; k < 4; k += 1) {
      const nc = c + DX[k];
      const nr = r + DY[k];
      if (!inGrid(nc, nr)) continue;
      const j = nr * COLS + nc;
      if (seen.has(j) || g.type[j] !== WATER) continue;
      seen.add(j);
      setCell(g, nc, nr, CHARGED, game.mods.lifeMul);
      turned += 1;
      stack.push(j);
      noteReaction(game, 'SHOCK', nc + 0.5, nr + 0.5);
      if (turned % 7 === 0) {
        addBolt(game.fx, toScreenX(c + 0.5), toScreenY(r + 0.5), toScreenX(nc + 0.5), toScreenY(nr + 0.5), '#9ff3ff', 0.3);
      }
    }
  }
  return turned;
}

/** The visible and physical result of one reaction event. */
function playReaction(game, e) {
  const px = toScreenX(e.x);
  const py = toScreenY(e.y);
  const fx = game.fx;
  switch (e.name) {
    case 'STEAM':
      burst(fx, 'steam', px, py, 3);
      burst(fx, 'splash', px, py, 3);
      break;
    case 'QUENCH':
      burst(fx, 'steam', px, py, 4);
      burst(fx, 'dust', px, py, 3);
      break;
    case 'LAVA':
      burst(fx, 'ember', px, py, 4);
      break;
    case 'MELT':
      burst(fx, 'splash', px, py, 5);
      break;
    case 'MAGNET':
      burst(fx, 'zap', px, py, 5, ['#ff5d7a', '#ffffff']);
      break;
    case 'SHOCK': {
      burst(fx, 'zap', px, py, 8);
      const turned = floodShock(game, Math.floor(e.x), Math.floor(e.y));
      game.floodBonus += Math.floor(turned / 6);
      addShake(fx, 2 + Math.min(5, turned / 8));
      break;
    }
    case 'STORMSTEAM':
      addBolt(fx, px + game.rng.range(-30, 30), py - 150, px, py, '#c58aff');
      burst(fx, 'zap', px, py, 10, ['#c58aff', '#ffffff']);
      damageArea(game, e.x, e.y, 1.6, 40, 'storm');
      addShake(fx, 3);
      break;
    case 'SHATTER':
      burst(fx, 'shard', px, py, 16);
      damageArea(game, e.x, e.y, 2.6, 85, 'shatter');
      addShake(fx, 5);
      addFlash(fx, 0.18, '#dff6ff');
      break;
    default:
      break;
  }
  sfx.react(e.name);
}

/** Lava creeps into neighbouring earth. */
function spreadLava(game, events, lavaCells) {
  const g = game.grid;
  const p = 0.1 + game.mods.lavaSpread;
  for (const i of lavaCells) {
    if (!game.rng.chance(p)) continue;
    const k = game.rng.int(4);
    const nc = (i % COLS) + DX[k];
    const nr = Math.floor(i / COLS) + DY[k];
    if (!inGrid(nc, nr) || g.type[nr * COLS + nc] !== EARTH) continue;
    setCell(g, nc, nr, LAVA, game.mods.lifeMul * 0.55);
    events.push({ name: 'LAVA', x: nc + 0.5, y: nr + 0.5, spread: true });
    burst(game.fx, 'ember', toScreenX(nc + 0.5), toScreenY(nr + 0.5), 2);
  }
}

/** Stormclouds throw lightning down on creatures beneath them. */
function strikeClouds(game, events, cloudCells) {
  for (const i of cloudCells) {
    if (!game.rng.chance(0.16)) continue;
    const x = (i % COLS) + 0.5;
    const y = Math.floor(i / COLS) + 0.5;
    addBolt(game.fx, toScreenX(x) + game.rng.range(-12, 12), toScreenY(y) - 160, toScreenX(x), toScreenY(y), '#c58aff');
    burst(game.fx, 'zap', toScreenX(x), toScreenY(y), 6, ['#c58aff', '#ffffff']);
    damageArea(game, x, y, 1.5, 42, 'storm');
    events.push({ name: 'STRIKE', x, y });
    sfx.strike();
  }
}

/** The Chain Lightning boon: storm cells arc to the nearest creatures. */
function arcStorms(game, stormCells) {
  const arcs = game.mods.arcs;
  if (arcs <= 0) return;
  for (const i of stormCells) {
    if (!game.rng.chance(0.18)) continue;
    let fromX = (i % COLS) + 0.5;
    let fromY = Math.floor(i / COLS) + 0.5;
    const hit = new Set();
    for (let n = 0; n < arcs; n += 1) {
      let best = null;
      let bestDist = 6;
      for (const c of game.creatures) {
        const d = Math.hypot(c.x - fromX, c.y - fromY);
        if (!hit.has(c) && !c.dead && d < bestDist) {
          bestDist = d;
          best = c;
        }
      }
      if (!best) break;
      hit.add(best);
      addBolt(game.fx, toScreenX(fromX), toScreenY(fromY), toScreenX(best.x), toScreenY(best.y), '#fff39a', 0.18);
      damageCreature(game, best, 16 + arcs * 4, 'storm');
      fromX = best.x;
      fromY = best.y;
    }
  }
}

/** Feed this tick's reactions into the chain counter, the score and the big floating callouts. */
function registerReactions(game, events) {
  if (events.length === 0) return;
  const chain = game.chain;
  const names = new Set(events.map((e) => e.name));
  const top = CALLOUT_ORDER.find((n) => names.has(n)) ?? events[0].name;
  // New kinds of reaction build the chain fast; repeating the same one only creeps it up.
  const fresh = [...names].filter((n) => !chain.kinds.has(n));
  fresh.forEach((n) => chain.kinds.add(n));
  const paced = game.t - chain.lastGain >= 1.2 + chain.count * 0.25;
  const gain = fresh.length + (paced ? 1 : 0) + Math.min(6, game.floodBonus);
  game.floodBonus = 0;
  const wasZero = chain.count === 0;
  if (gain > 0) {
    chain.lastGain = game.t;
    chain.timer = REACT.chainWindow;
  }
  chain.count += gain;
  chain.best = Math.max(chain.best, chain.count);
  game.stats.bestChain = Math.max(game.stats.bestChain, chain.count);
  game.stats.reactions += events.filter((e) => !e.spread).length;
  addScore(game, 4 * Math.min(events.length, 14));
  const focus = events.find((e) => e.name === top) ?? events[0];
  const px = toScreenX(focus.x);
  const py = toScreenY(focus.y) - 30;
  const color = CALLOUT_COLORS[top] ?? '#ffffff';
  if (gain > 0 && chain.count >= 3 && game.t - chain.lastText > 0.3) {
    chain.lastText = game.t;
    addText(game.fx, Math.min(FIELD.x + FIELD.w - 220, Math.max(FIELD.x + 220, px)), Math.max(FIELD.y + 60, py), `CHAIN x${chain.count} - ${top}!`, { color, size: Math.min(58, 24 + chain.count * 2.6), life: 1.5, pop: 0.5 });
    sfx.chain(chain.count);
    if (chain.count >= 6) addShake(game.fx, Math.min(9, chain.count * 0.7));
    if (chain.count % 10 === 0) addFlash(game.fx, 0.25, color);
  } else if (gain > 0 && (wasZero || game.t - chain.lastText > 1.2)) {
    chain.lastText = game.t;
    addText(game.fx, px, py, `${top}!`, { color, size: 22, life: 0.9 });
  }
}

/** One reaction tick over the whole grid. */
export function tickReactions(game) {
  const g = game.grid;
  const mark = game.mark;
  mark.fill(0);
  game.reactTick += 1;
  const flip = game.reactTick & 1;
  const events = [];
  const lava = [];
  const clouds = [];
  const storms = [];
  game.magnets.length = 0;
  const lm = game.mods.lifeMul;
  for (let a = 0; a < ROWS; a += 1) {
    for (let b = 0; b < COLS; b += 1) {
      const row = flip ? ROWS - 1 - a : a;
      const col = flip ? COLS - 1 - b : b;
      const i = row * COLS + col;
      const type = g.type[i];
      if (type === EMPTY) continue;
      if (type === MAGNET) game.magnets.push({ x: col + 0.5, y: row + 0.5 });
      else if (type === LAVA) lava.push(i);
      else if (type === CLOUD) clouds.push(i);
      else if (type === STORM || type === CHARGED) storms.push(i);
      if (mark[i]) continue;
      if (game.mods.frost && type === WATER && g.age[i] > 1.2) {
        setCell(g, col, row, ICE, lm);
        mark[i] = 1;
        events.push({ name: 'FROST', x: col + 0.5, y: row + 0.5 });
        burst(game.fx, 'shard', toScreenX(col + 0.5), toScreenY(row + 0.5), 2);
        continue;
      }
      for (let d = 0; d < 4; d += 1) {
        const k = (d + game.reactTick + i) & 3;
        const nc = col + DX[k];
        const nr = row + DY[k];
        if (!inGrid(nc, nr)) continue;
        const j = nr * COLS + nc;
        const other = g.type[j];
        if (other === EMPTY || mark[j]) continue;
        const rule = ruleFor(type, other);
        if (!rule) continue;
        mark[i] = 1;
        mark[j] = 1;
        setCell(g, col, row, rule.a, lm);
        setCell(g, nc, nr, rule.b, lm);
        events.push({ name: rule.name, x: (col + nc) / 2 + 0.5, y: (row + nr) / 2 + 0.5 });
        break;
      }
    }
  }
  for (const e of events) playReaction(game, e);
  spreadLava(game, events, lava);
  strikeClouds(game, events, clouds);
  arcStorms(game, storms);
  for (const e of events) noteReaction(game, e.name, e.x, e.y);
  registerReactions(game, events);
  return events.length;
}

/** Reactions triggered by painting straight onto another element take effect immediately. */
export function reactNow(game, events) {
  for (const e of events) {
    playReaction(game, e);
    noteReaction(game, e.name, e.x, e.y);
  }
  registerReactions(game, events);
}
