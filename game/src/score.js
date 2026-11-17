// Score, the chain counter and the Core Crystal's health. The chain multiplies every point earned
// while it lasts; it is fed by reactions (reactions.js) and drains if nothing reacts for a while.
import { CELL, CORE, FIELD, REACT } from './config.js';
import { addFlash, addShake, addText, burst } from './particles.js';
import { sfx } from './audio.js';
import { toScreenX, toScreenY } from './grid.js';

export const chainMult = (count) => 1 + Math.min(count, 30) * 0.1;

/** Award `base` points times the current chain multiplier; optionally show them at (x, y) cells. */
export function addScore(game, base, x, y) {
  const points = Math.round(base * chainMult(game.chain.count));
  game.score += points;
  if (x !== undefined) addText(game.fx, toScreenX(x), toScreenY(y) - 14, `+${points}`, { color: '#ffe9a8', size: 18, life: 0.9 });
  return points;
}

/** Let the chain run down once nothing has reacted for the chain window. */
export function tickChain(game, dt) {
  const chain = game.chain;
  if (chain.count === 0) return;
  chain.timer -= dt;
  if (chain.timer <= 0) {
    if (chain.count >= 5) addText(game.fx, FIELD.x + FIELD.w / 2, FIELD.y + 40, `CHAIN ENDED  x${chain.count}`, { color: '#9fb3d9', size: 24, life: 1.3 });
    chain.count = 0;
    chain.kinds.clear();
  }
}

/** Hit the Core Crystal; the shield soaks damage first. */
export function damageCore(game, amount) {
  const core = game.core;
  let rest = amount;
  if (core.shield > 0) {
    const soaked = Math.min(core.shield, rest);
    core.shield -= soaked;
    rest -= soaked;
  }
  const px = toScreenX(CORE.col + 0.5);
  const py = toScreenY(CORE.row + 0.5);
  if (rest > 0) {
    core.hp = Math.max(0, core.hp - rest);
    addText(game.fx, px, py - 36, `-${Math.round(rest)}`, { color: '#ff5a6a', size: 30, life: 1.2 });
    addShake(game.fx, 7 + Math.min(7, rest / 4));
    addFlash(game.fx, 0.35, '#ff2a3a');
    sfx.coreHit();
  } else {
    addText(game.fx, px, py - 36, 'SHIELDED', { color: '#7fe9ff', size: 22, life: 1 });
    sfx.plate();
  }
  core.hitFlash = 0.5;
  burst(game.fx, 'spark', px + CELL / 2 - 10, py + CELL / 2 - 10, 14, ['#6ff0ff', '#ffffff', '#b0f8ff']);
  game.stats.coreHits += 1;
}
