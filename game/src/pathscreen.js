// The post-rift screen: a dark "PICK 1 OF 3" boon pick with three large cards (glyph, rarity band,
// name, one-line effect, key) and a REROLL button, over the blurred, dimmed battlefield, with a
// compact Rift Path map on a dark panel at the right (completed path glowing, the current node
// pulsing, the branches ahead, seed and difficulty). Also the shrine dialog.
import { DIFFICULTIES, FONT, H, RIFT_COUNT, W } from './config.js';
import { BOONS, RARITY, REROLL_COST } from './boons.js';
import { NODE_TYPES, nodeById, reachableNodes } from './path.js';
import { drawFiligree, drawGlyph, drawGlyphTile } from './glyphs.js';
import { drawText } from './draw.js';

const GOLD = '#d4aa55';

/** The three boon cards (also click targets) and the reroll button under them. */
export const PATH_BOON_CARDS = [0, 1, 2].map((i) => ({ x: 50 + i * 260, y: 200, w: 240, h: 350 }));
export const REROLL_BUTTON = { x: 50, y: 576, w: 760, h: 64 };
/** The shrine dialog's two buttons. */
export const SHRINE_BUTTONS = [{ x: 330, y: 420, w: 300, h: 90, choice: 'heal' }, { x: 650, y: 420, w: 300, h: 90, choice: 'reroll' }];

const MAP = { x: 850, y: 90, w: 400, h: 640 };

/** Position of a node of the compact map. */
function mapPos(node) {
  return { x: MAP.x + 46 + (node.row - 1) * 51, y: 232 + ((node.index + 0.5) * 230) / node.count };
}
const radiusOf = (node) => (node.type === 'colossus' ? 22 : 16);

/** The node under the pointer, or null. */
export function pathNodeAt(game, x, y) {
  for (const node of game.map.flat()) {
    const p = mapPos(node);
    if (Math.hypot(x - p.x, y - p.y) <= radiusOf(node) + 6) return node;
  }
  return null;
}

export function pathBoonAt(x, y) {
  return PATH_BOON_CARDS.findIndex((c) => x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h);
}

export const rerollHit = (x, y) => x >= REROLL_BUTTON.x && x < REROLL_BUTTON.x + REROLL_BUTTON.w && y >= REROLL_BUTTON.y && y < REROLL_BUTTON.y + REROLL_BUTTON.h;

export function shrineChoiceAt(x, y) {
  const b = SHRINE_BUTTONS.find((c) => x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h);
  return b ? b.choice : null;
}

function wrap(ctx, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = trial;
  }
  if (line) lines.push(line);
  return lines;
}

function boonCard(ctx, boon, i, lit, time) {
  const c = PATH_BOON_CARDS[i];
  const rarity = RARITY[boon.rarity];
  const cx = c.x + c.w / 2;
  const top = c.y + (lit ? -8 : 0);
  ctx.save();
  ctx.shadowColor = rarity.color;
  ctx.shadowBlur = lit ? 36 : 18;
  const body = ctx.createLinearGradient(0, top, 0, top + c.h);
  body.addColorStop(0, '#1d2438');
  body.addColorStop(1, '#0b0e18');
  ctx.beginPath();
  ctx.roundRect(c.x, top, c.w, c.h, 18);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = 5;
  ctx.strokeStyle = rarity.color;
  ctx.beginPath();
  ctx.roundRect(c.x, top, c.w, c.h, 18);
  ctx.stroke();
  // Rarity band across the top.
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(c.x, top, c.w, 46, [18, 18, 0, 0]);
  ctx.clip();
  ctx.fillStyle = rarity.color;
  ctx.fillRect(c.x, top, c.w, 46);
  ctx.restore();
  drawText(ctx, rarity.label, cx, top + 33, { size: 24, color: '#ffffff', align: 'center', outline: 3 });
  // Bold glyph medallion.
  ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(cx, top + 130, 10, cx, top + 130, 90);
  glow.addColorStop(0, boon.color);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = glow;
  ctx.fillRect(cx - 90, top + 40, 180, 180);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.beginPath();
  ctx.arc(cx, top + 130, 56, 0, 6.283);
  ctx.fillStyle = '#080a12';
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = GOLD;
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = boon.color;
  ctx.beginPath();
  ctx.arc(cx, top + 130, 46, 0, 6.283);
  ctx.stroke();
  drawGlyph(ctx, boon.glyph, cx, top + 130, 32, boon.color, 7);
  // Big name and one-line effect.
  ctx.font = `900 24px ${FONT}`;
  const nameLines = wrap(ctx, boon.name.toUpperCase(), c.w - 24).slice(0, 2);
  nameLines.forEach((line, n) => drawText(ctx, line, cx, top + 226 + n * 27, { size: 24, color: '#ffffff', align: 'center' }));
  ctx.font = `700 16px ${FONT}`;
  wrap(ctx, boon.desc, c.w - 30).slice(0, 2).forEach((line, n) => drawText(ctx, line, cx, top + 280 + n * 19, { size: 16, color: '#c9d2e8', align: 'center', weight: 700, outline: 0 }));
  drawText(ctx, `[${i + 1}]`, cx, top + 340, { size: 32, color: Math.floor(time * 3) % 2 === 0 && lit ? '#ffffff' : '#ffd24a', align: 'center' });
}

function rerollButton(ctx, game) {
  const b = REROLL_BUTTON;
  const pending = game.offer.length > 0;
  const can = pending && (game.rerolls > 0 || Math.min(...game.essence) >= REROLL_COST);
  const grad = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
  grad.addColorStop(0, can ? '#ffd24a' : '#6a6f7c');
  grad.addColorStop(1, can ? '#d98a14' : '#454955');
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.w, b.h, 16);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = '#fff3c0';
  ctx.stroke();
  drawGlyph(ctx, 'spiral', b.x + 50, b.y + 32, 20, '#1a0c00', 4.5);
  drawText(ctx, 'REROLL', b.x + 92, b.y + 44, { size: 38, color: '#1a0c00', outline: 0 });
  drawText(ctx, game.rerolls > 0 ? `FREE  -  ${game.rerolls} left` : `costs ${REROLL_COST} essence per pool`, b.x + b.w - 22, b.y + 41, { size: 24, color: '#1a0c00', align: 'right', outline: 0 });
}

/** The compact Rift Path on a dark panel. */
function miniMap(ctx, game, ui, time) {
  ctx.beginPath();
  ctx.roundRect(MAP.x, MAP.y, MAP.w, MAP.h, 18);
  ctx.fillStyle = 'rgba(8,10,18,0.92)';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = GOLD;
  ctx.stroke();
  drawFiligree(ctx, MAP.x + 3, MAP.y + 3, MAP.w - 6, MAP.h - 6, GOLD);
  drawText(ctx, 'THE RIFT PATH', MAP.x + MAP.w / 2, MAP.y + 48, { size: 30, color: '#ffd24a', align: 'center' });
  drawText(ctx, `SEED ${game.seed}   -   ${DIFFICULTIES[game.difficulty].name}`, MAP.x + MAP.w / 2, MAP.y + 76, { size: 17, color: '#c9d2e8', align: 'center', outline: 0, weight: 800 });
  for (let row = 1; row <= RIFT_COUNT; row += 1) {
    const p = mapPos({ row, index: 0, count: 1 });
    drawText(ctx, String(row), p.x, MAP.y + 118, { size: 16, color: row <= game.route.length ? '#ffd24a' : '#7a8296', align: 'center', outline: 0 });
  }
  const route = game.route;
  const ahead = new Set(reachableNodes(game.map, route).map((n) => n.id));
  for (const node of game.map.flat()) {
    const a = mapPos(node);
    for (const id of node.next) {
      const next = nodeById(game.map, id);
      const b = mapPos(next);
      const done = route.includes(node.id) && route.includes(id);
      const open = route[route.length - 1] === node.id && ahead.has(id);
      ctx.beginPath();
      ctx.moveTo(a.x + radiusOf(node), a.y);
      ctx.bezierCurveTo((a.x + b.x) / 2, a.y, (a.x + b.x) / 2, b.y, b.x - radiusOf(next), b.y);
      if (done) {
        ctx.strokeStyle = 'rgba(255,200,60,0.45)';
        ctx.lineWidth = 11;
        ctx.stroke();
        ctx.strokeStyle = '#ffd24a';
        ctx.lineWidth = 4;
        ctx.stroke();
      } else {
        ctx.setLineDash(open ? [8, 5] : [3, 6]);
        ctx.lineDashOffset = open ? -time * 12 : 0;
        ctx.strokeStyle = open ? '#ffd24a' : 'rgba(150,160,185,0.4)';
        ctx.lineWidth = open ? 3.5 : 2;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }
  for (const node of game.map.flat()) {
    const p = mapPos(node);
    const type = NODE_TYPES[node.type];
    const done = route.includes(node.id);
    const current = route[route.length - 1] === node.id;
    const reachable = game.phase === 'path' && ahead.has(node.id);
    const hover = ui.hoverNode === node.id && reachable;
    const r = radiusOf(node) * (hover ? 1.18 : 1);
    ctx.save();
    ctx.globalAlpha = done || reachable ? 1 : 0.55;
    if (current) {
      ctx.strokeStyle = `rgba(255,214,90,${0.55 + 0.4 * Math.sin(time * 4)})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 7 + 2.5 * Math.sin(time * 4), 0, 6.283);
      ctx.stroke();
    }
    if (reachable) {
      ctx.strokeStyle = game.pendingNode === node.id ? '#6dffb0' : '#ffffff';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 5, 0, 6.283);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, 6.283);
    ctx.fillStyle = done ? '#d9a020' : '#10141f';
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = type.color;
    ctx.stroke();
    drawGlyph(ctx, type.glyph, p.x, p.y, r * 0.52, done ? '#1a1206' : type.color, 3);
    ctx.restore();
  }
  // Tooltip for the hovered node, then the collected boons.
  const hovered = ui.hoverNode ? nodeById(game.map, ui.hoverNode) : null;
  const ty = MAP.y + 410;
  if (hovered) {
    const type = NODE_TYPES[hovered.type];
    drawGlyph(ctx, type.glyph, MAP.x + 36, ty + 22, 13, type.color, 3);
    drawText(ctx, type.name, MAP.x + 60, ty + 28, { size: 20, color: type.color });
    ctx.font = `700 15px ${FONT}`;
    wrap(ctx, `Creatures: ${type.creatures}`, MAP.w - 40).forEach((line, n) => drawText(ctx, line, MAP.x + 22, ty + 54 + n * 18, { size: 15, color: '#e8ecf8', weight: 700, outline: 0 }));
    drawText(ctx, `Reward: ${type.reward}`, MAP.x + 22, ty + 92, { size: 15, color: '#ffd24a', weight: 700, outline: 0 });
  } else {
    drawText(ctx, game.offer.length > 0 ? 'Take a boon, then pick a node.' : 'Click a glowing node to choose your next rift.', MAP.x + 22, ty + 30, { size: 16, color: '#aab4cc', weight: 700, outline: 0 });
  }
  drawText(ctx, 'BOONS', MAP.x + 22, MAP.y + 558, { size: 14, color: '#aab4cc', outline: 0 });
  const held = BOONS.filter((b) => game.boons[b.id]);
  held.slice(0, 8).forEach((b, i) => drawGlyphTile(ctx, b.glyph, MAP.x + 36 + i * 44, MAP.y + 598, 34, b.color));
  if (held.length === 0) drawText(ctx, 'none yet', MAP.x + 22, MAP.y + 600, { size: 15, color: '#7a8296', outline: 0 });
}

/** Paint the pick screen over an already-blurred battlefield. ui = { hoverNode, hoverBoon }. */
export function drawPath(ctx, game, time, ui = {}) {
  ctx.fillStyle = 'rgba(4,5,10,0.55)';
  ctx.fillRect(0, 0, W, H);
  const pending = game.offer.length > 0;
  drawText(ctx, pending ? 'PICK 1 OF 3' : game.riftNum === 0 ? 'CHOOSE YOUR FIRST RIFT' : 'PICK YOUR NEXT RIFT', 50, 124, { size: pending ? 92 : 64, color: '#ffd24a' });
  drawText(ctx, pending ? `RIFT ${game.riftNum} CLEARED` : game.riftNum === 0 ? 'THE RIFT PATH' : `RIFT ${game.riftNum} CLEARED - BOON TAKEN`, 54, 172, { size: 36, color: '#6dffb0' });
  if (pending) {
    game.offer.forEach((boon, i) => boonCard(ctx, boon, i, ui.hoverBoon === i, time));
    rerollButton(ctx, game);
    drawText(ctx, `Rerolls left: ${game.rerolls}   -   [Q] reroll   -   then pick your next rift on the map`, 50, 678, { size: 18, color: '#c9d2e8', outline: 0, weight: 700 });
  } else {
    drawText(ctx, 'Choose your next rift on the map  >>>', 50, 380, { size: 44, color: '#ffffff' });
    drawText(ctx, 'Each node changes the creatures and the reward.', 50, 424, { size: 22, color: '#c9d2e8', outline: 0, weight: 700 });
  }
  miniMap(ctx, game, ui, time);
}

/** The shrine dialog, drawn over the path screen. */
export function drawShrine(ctx, game, time) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, W, H);
  ctx.beginPath();
  ctx.roundRect(280, 250, 720, 290, 20);
  ctx.fillStyle = '#10141f';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#6dffb0';
  ctx.stroke();
  drawGlyph(ctx, 'ring', 640, 312, 30, '#6dffb0', 5);
  drawText(ctx, 'THE SHRINE', 640, 376, { size: 44, color: '#ffffff', align: 'center' });
  const labels = [['HEAL THE CORE +35', '[H]'], ['GAIN A REROLL', '[R]']];
  SHRINE_BUTTONS.forEach((b, i) => {
    const pulse = 0.5 + 0.5 * Math.sin(time * 4 + i);
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, 14);
    ctx.fillStyle = i === 0 ? '#ffd24a' : '#9ad4ff';
    ctx.fill();
    ctx.lineWidth = 3 + pulse * 2;
    ctx.strokeStyle = '#fff3c0';
    ctx.stroke();
    drawText(ctx, labels[i][0], b.x + b.w / 2, b.y + 44, { size: 24, color: '#1a0c00', align: 'center', outline: 0 });
    drawText(ctx, labels[i][1], b.x + b.w / 2, b.y + 72, { size: 18, color: '#3a2a10', align: 'center', outline: 0 });
  });
}
