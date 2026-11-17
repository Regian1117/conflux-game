// A simple painting bot. It drives the title screen's attract mode and the screenshot scenes by
// "moving the mouse" through game.cursor exactly as a player would: pick the creature closest to
// the Core, choose element pairs that hurt it (or that match the Colossus's next plate), and paint
// two adjacent strokes across its path so the elements react.
import { CORE, GATES, PLATES } from './config.js';
import { BRUSHES, EARTH, FIRE, STORM, WATER } from './elements.js';
import { setCursor } from './game.js';
import { toScreenX, toScreenY } from './grid.js';
import { upcoming } from './rifts.js';

const PAIRS = {
  imp: [WATER, WATER],
  wraith: [STORM, STORM],
  swarm: [WATER, STORM],
  beetle: [FIRE, FIRE],
  golem: [EARTH, FIRE],
  ram: [EARTH, FIRE],
};
/** Element pairs that produce each Colossus plate's reaction. */
const PLATE_PAIRS = { STEAM: [FIRE, WATER], STORMSTEAM: [FIRE, WATER, STORM], LAVA: [EARTH, FIRE], SHOCK: [WATER, STORM] };

export function createBot() {
  return { cooldown: 0.5, stroke: null, queue: [], progress: 0, flip: 0 };
}

function queueTrap(bot, game, x, y, dirX, dirY, pair) {
  const px = -dirY;
  const py = dirX;
  pair.forEach((element, i) => {
    const off = (i - (pair.length - 1) / 2) * 1.5;
    const cx = x + dirX * off;
    const cy = y + dirY * off;
    const half = 4.5;
    bot.queue.push({ brush: BRUSHES.indexOf(element), ax: cx - px * half, ay: cy - py * half, bx: cx + px * half, by: cy + py * half });
  });
}

function plan(bot, game) {
  const coreX = CORE.col + 0.5;
  const coreY = CORE.row + 0.5;
  let target = null;
  let best = Infinity;
  for (const c of game.creatures) {
    const d = Math.hypot(c.x - coreX, c.y - coreY);
    if (d > 4 && d < best) {
      best = d;
      target = c;
    }
  }
  if (target) {
    const dx = coreX - target.x;
    const dy = coreY - target.y;
    const len = Math.hypot(dx, dy) || 1;
    const lead = target.kind === 'colossus' ? 5 : 3.5;
    const x = target.x + (dx / len) * lead;
    const y = target.y + (dy / len) * lead;
    let pair = PAIRS[target.kind];
    if (target.kind === 'colossus') pair = target.exposed > 0 ? PLATE_PAIRS.SHOCK : PLATE_PAIRS[PLATES[Math.min(target.plates, 3)].need];
    queueTrap(bot, game, x, y, dx / len, dy / len, pair ?? [WATER, STORM]);
    return;
  }
  // Nothing to fight yet: build a trap on the approach to the next gate.
  const next = upcoming(game, 1)[0];
  const gate = Object.values(GATES).find((g) => next && g.name === next.gate) ?? GATES.W;
  const dx = gate.col - CORE.col;
  const dy = gate.row - CORE.row;
  const len = Math.hypot(dx, dy) || 1;
  queueTrap(bot, game, coreX + (dx / len) * 9, coreY + (dy / len) * 9, -dx / len, -dy / len, bot.flip++ % 2 ? [FIRE, WATER] : [EARTH, FIRE]);
}

/** Advance the bot by dt: move the virtual mouse along the current stroke, planning when idle. */
export function botStep(bot, game, dt) {
  if (game.phase === 'boon' || game.phase === 'won' || game.phase === 'lost') return;
  if (!bot.stroke) {
    setCursor(game, 0, 0, false);
    bot.cooldown -= dt;
    if (bot.cooldown > 0) return;
    if (bot.queue.length === 0) plan(bot, game);
    bot.stroke = bot.queue.shift() ?? null;
    bot.progress = 0;
    if (!bot.stroke) {
      bot.cooldown = 0.6;
      return;
    }
    game.brush = bot.stroke.brush;
  }
  const s = bot.stroke;
  const length = Math.hypot(s.bx - s.ax, s.by - s.ay) || 1;
  bot.progress = Math.min(1, bot.progress + (26 * dt) / length);
  const x = s.ax + (s.bx - s.ax) * bot.progress;
  const y = s.ay + (s.by - s.ay) * bot.progress;
  setCursor(game, toScreenX(x), toScreenY(y), true);
  if (bot.progress >= 1) {
    bot.stroke = null;
    bot.cooldown = 0.2;
    if (bot.queue.length === 0) bot.cooldown = 0.9;
  }
}
