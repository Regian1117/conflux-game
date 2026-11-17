// The Rift Path screen, drawn as a bright parchment-and-gold map: the branching nodes of the run
// (completed path glowing gold, the current node pulsing, the reachable branches ahead), a tooltip
// for the hovered node, the collected boons, the run seed, difficulty and rerolls, and on the
// right the post-rift boon pick with rarity colours and a REROLL button. Also the shrine dialog.
import { DIFFICULTIES, FONT, H, RIFT_COUNT, W } from './config.js';
import { BOONS, RARITY, REROLL_COST } from './boons.js';
import { NODE_TYPES, nodeById, nodePosition, reachableNodes } from './path.js';
import { drawFiligree, drawGlyph, drawGlyphTile } from './glyphs.js';
import { drawText } from './draw.js';

const INK = '#3a2810';
const GOLD = '#c8912a';

/** The three boon cards on the right (also click targets), and the reroll button under them. */
export const PATH_BOON_CARDS = [0, 1, 2].map((i) => ({ x: 820, y: 162 + i * 150, w: 430, h: 140 }));
export const REROLL_BUTTON = { x: 820, y: 620, w: 430, h: 58 };
/** The shrine dialog's two buttons. */
export const SHRINE_BUTTONS = [{ x: 330, y: 420, w: 300, h: 90, choice: 'heal' }, { x: 650, y: 420, w: 300, h: 90, choice: 'reroll' }];

const NODE_R = 30;
const radiusOf = (node) => (node.type === 'colossus' ? 44 : NODE_R);

const hash = (i, k) => {
  const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

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

/** The node under the pointer, or null. */
export function pathNodeAt(game, x, y) {
  for (const node of game.map.flat()) {
    const p = nodePosition(node.row, node.index, node.count);
    if (Math.hypot(x - p.x, y - p.y) <= radiusOf(node) + 4) return node;
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

function parchment(ctx) {
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#f3e6bd');
  grad.addColorStop(1, '#dcc388');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i += 1) {
    ctx.fillStyle = hash(i, 1) > 0.5 ? 'rgba(120,80,20,0.07)' : 'rgba(255,255,240,0.18)';
    ctx.fillRect(hash(i, 2) * W, hash(i, 3) * H, 1 + hash(i, 4) * 3, 1 + hash(i, 5) * 2);
  }
  ctx.strokeStyle = 'rgba(140,100,30,0.16)';
  ctx.lineWidth = 2;
  for (const r of [170, 240, 310]) {
    ctx.beginPath();
    ctx.arc(420, 420, r, 0, 6.283);
    ctx.stroke();
  }
  const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.7);
  vignette.addColorStop(0, 'rgba(90,50,10,0)');
  vignette.addColorStop(1, 'rgba(90,50,10,0.4)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 6;
  ctx.strokeRect(12, 12, W - 24, H - 24);
  ctx.lineWidth = 2;
  ctx.strokeRect(22, 22, W - 44, H - 44);
  drawFiligree(ctx, 22, 22, W - 44, H - 44, '#8a5a12');
}

function edges(ctx, game, time) {
  const route = game.route;
  const ahead = new Set(game.phase === 'path' ? reachableNodes(game.map, route).map((n) => n.id) : []);
  for (const node of game.map.flat()) {
    const a = nodePosition(node.row, node.index, node.count);
    for (const id of node.next) {
      const next = nodeById(game.map, id);
      const b = nodePosition(next.row, next.index, next.count);
      const done = route.includes(node.id) && route.includes(id);
      const open = route[route.length - 1] === node.id && ahead.has(id);
      ctx.beginPath();
      ctx.moveTo(a.x + radiusOf(node), a.y);
      ctx.bezierCurveTo((a.x + b.x) / 2, a.y, (a.x + b.x) / 2, b.y, b.x - radiusOf(next), b.y);
      if (done) {
        ctx.strokeStyle = 'rgba(255,200,60,0.5)';
        ctx.lineWidth = 14;
        ctx.stroke();
        ctx.strokeStyle = '#d9a020';
        ctx.lineWidth = 6;
        ctx.stroke();
        ctx.strokeStyle = '#fff3b0';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.setLineDash(open ? [10, 6] : [4, 8]);
        ctx.lineDashOffset = open ? -time * 12 : 0;
        ctx.strokeStyle = open ? '#9a6a14' : 'rgba(90,60,20,0.45)';
        ctx.lineWidth = open ? 4 : 2.5;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }
}

function drawNode(ctx, game, node, time, hover) {
  const p = nodePosition(node.row, node.index, node.count);
  const type = NODE_TYPES[node.type];
  const route = game.route;
  const done = route.includes(node.id);
  const current = route[route.length - 1] === node.id;
  const reachable = game.phase === 'path' && reachableNodes(game.map, route).some((n) => n.id === node.id);
  const pending = game.pendingNode === node.id;
  const r = radiusOf(node) * (hover && reachable ? 1.1 : 1);
  ctx.save();
  ctx.globalAlpha = done || reachable || current ? 1 : 0.6;
  if (current) {
    ctx.strokeStyle = `rgba(255,214,90,${0.5 + 0.4 * Math.sin(time * 4)})`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r + 9 + 3 * Math.sin(time * 4), 0, 6.283);
    ctx.stroke();
  }
  if (reachable) {
    ctx.strokeStyle = `rgba(${pending ? '90,200,120' : '255,255,255'},0.9)`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r + 6, 0, 6.283);
    ctx.stroke();
  }
  const fill = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.4, 2, p.x, p.y, r);
  if (done) {
    fill.addColorStop(0, '#ffe9a0');
    fill.addColorStop(1, '#d9a020');
  } else {
    fill.addColorStop(0, '#fff8e0');
    fill.addColorStop(1, '#e8d49a');
  }
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, 6.283);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = type.color;
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r + 2.5, 0, 6.283);
  ctx.stroke();
  drawGlyph(ctx, type.glyph, p.x, p.y, r * 0.5, done ? INK : type.color, node.type === 'colossus' ? 5 : 4);
  if (done && !current) {
    ctx.strokeStyle = '#2a6a2a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(p.x + r * 0.35, p.y + r * 0.55);
    ctx.lineTo(p.x + r * 0.6, p.y + r * 0.8);
    ctx.lineTo(p.x + r * 1.0, p.y + r * 0.3);
    ctx.stroke();
  }
  ctx.restore();
  drawText(ctx, node.type === 'colossus' ? 'COLOSSUS' : type.short.toUpperCase(), p.x, p.y + r + 20, { size: 13, color: INK, align: 'center', outline: 0 });
}

/** The hovered node's tooltip: its creatures and reward, in the free band under the map, joined to the node by a gold line. */
function tooltip(ctx, node) {
  const p = nodePosition(node.row, node.index, node.count);
  const type = NODE_TYPES[node.type];
  const w = 330;
  const x = Math.min(790 - w, Math.max(40, p.x - w / 2));
  const top = 616;
  ctx.strokeStyle = type.color;
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y + radiusOf(node) + 24);
  ctx.lineTo(p.x, top);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(40,26,8,0.97)';
  ctx.beginPath();
  ctx.roundRect(x, top, w, 86, 12);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = type.color;
  ctx.stroke();
  drawGlyph(ctx, type.glyph, x + 28, top + 27, 13, type.color, 3);
  drawText(ctx, type.name, x + 52, top + 33, { size: 20, color: type.color });
  drawText(ctx, `Creatures: ${type.creatures}`, x + 14, top + 56, { size: 15, color: '#f6e9c4', weight: 700, outline: 0 });
  drawText(ctx, `Reward: ${type.reward}`, x + 14, top + 76, { size: 15, color: '#ffd24a', weight: 700, outline: 0 });
}

function boonCards(ctx, game, ui, time) {
  const pending = game.offer.length > 0;
  drawText(ctx, pending ? 'CHOOSE A BOON' : game.riftNum === 0 ? 'NO BOON YET' : 'BOON CHOSEN', 820, 138, { size: 30, color: INK, outline: 0 });
  game.offer.forEach((boon, i) => {
    const c = PATH_BOON_CARDS[i];
    const rarity = RARITY[boon.rarity];
    const lit = ui.hoverBoon === i;
    ctx.save();
    ctx.shadowColor = rarity.color;
    ctx.shadowBlur = lit ? 22 : 8;
    ctx.beginPath();
    ctx.roundRect(c.x, c.y, c.w, c.h, 14);
    ctx.fillStyle = lit ? '#fffdf0' : '#fbf1d2';
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = 5;
    ctx.strokeStyle = rarity.color;
    ctx.beginPath();
    ctx.roundRect(c.x, c.y, c.w, c.h, 14);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = GOLD;
    ctx.beginPath();
    ctx.roundRect(c.x + 6, c.y + 6, c.w - 12, c.h - 12, 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c.x + 62, c.y + 70, 40, 0, 6.283);
    ctx.fillStyle = '#2a1c08';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = GOLD;
    ctx.stroke();
    drawGlyph(ctx, boon.glyph, c.x + 62, c.y + 70, 22, boon.color, 4.5);
    ctx.beginPath();
    ctx.roundRect(c.x + c.w - 104, c.y + 14, 90, 22, 11);
    ctx.fillStyle = rarity.color;
    ctx.fill();
    drawText(ctx, rarity.label, c.x + c.w - 59, c.y + 31, { size: 14, color: '#ffffff', align: 'center', outline: 0 });
    drawText(ctx, boon.name.toUpperCase(), c.x + 116, c.y + 44, { size: boon.name.length > 17 ? 18 : 21, color: INK, outline: 0 });
    ctx.font = `700 16px ${FONT}`;
    wrap(ctx, boon.desc, c.w - 140).forEach((line, n) => drawText(ctx, line, c.x + 116, c.y + 72 + n * 19, { size: 16, color: '#4a3410', weight: 700, outline: 0 }));
    drawText(ctx, boon.synergy, c.x + 116, c.y + 118, { size: 14, color: rarity.color, weight: 800, outline: 0 });
    drawText(ctx, `[${i + 1}]`, c.x + c.w - 16, c.y + 118, { size: 22, color: Math.floor(time * 3) % 2 === 0 && lit ? '#2a1c08' : GOLD, align: 'right', outline: 0 });
  });
  // Reroll.
  const b = REROLL_BUTTON;
  const can = pending && (game.rerolls > 0 || Math.min(...game.essence) >= REROLL_COST);
  const grad = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
  grad.addColorStop(0, can ? '#ffd24a' : '#c9bb98');
  grad.addColorStop(1, can ? '#d98a14' : '#a89a78');
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.w, b.h, 14);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#7a4c0c';
  ctx.stroke();
  drawGlyph(ctx, 'spiral', b.x + 38, b.y + 30, 16, '#2a1c08', 3.5);
  drawText(ctx, 'REROLL', b.x + 74, b.y + 38, { size: 28, color: '#2a1c08', outline: 0 });
  drawText(ctx, game.rerolls > 0 ? `FREE  (${game.rerolls} left)` : `costs ${REROLL_COST} essence from every pool`, b.x + b.w - 16, b.y + 36, { size: 16, color: '#2a1c08', align: 'right', outline: 0, weight: 800 });
  drawText(ctx, `Rerolls left: ${game.rerolls}   -   [Q] reroll`, 820, 706, { size: 16, color: '#5a3c10', outline: 0, weight: 700 });
}

function boonRow(ctx, game) {
  drawText(ctx, 'BOONS COLLECTED', 40, 716, { size: 15, color: '#5a3c10', outline: 0 });
  const held = BOONS.filter((b) => game.boons[b.id]);
  if (held.length === 0) drawText(ctx, 'none yet - clear a rift to earn one', 40, 752, { size: 17, color: '#7a5a28', outline: 0, weight: 700 });
  held.slice(0, 8).forEach((b, i) => {
    const x = 62 + i * 92;
    drawGlyphTile(ctx, b.glyph, x, 752, 38, b.color);
    if (game.boons[b.id] > 1) drawText(ctx, `x${game.boons[b.id]}`, x + 24, 772, { size: 15, color: INK, outline: 0 });
  });
}

/** Paint the whole Rift Path screen. ui = { hoverNode, hoverBoon }. */
export function drawPath(ctx, game, time, ui = {}) {
  parchment(ctx);
  drawText(ctx, 'THE RIFT PATH', 44, 84, { size: 58, color: INK, outline: 0 });
  const next = Math.min(RIFT_COUNT, game.riftNum + 1);
  drawText(ctx, game.offer.length > 0 ? `Rift ${next} of ${RIFT_COUNT} - take a boon, then pick your next rift` : `Rift ${next} of ${RIFT_COUNT} - pick your next rift`, 46, 118, { size: 22, color: '#6a4a1a', outline: 0, weight: 700 });
  // Run facts: seed, difficulty, rerolls.
  ctx.fillStyle = 'rgba(58,40,16,0.9)';
  ctx.beginPath();
  ctx.roundRect(40, 132, 750, 30, 8);
  ctx.fill();
  drawText(ctx, `SEED ${game.seed}`, 56, 154, { size: 16, color: '#ffe9a8', outline: 0 });
  drawText(ctx, `DIFFICULTY ${DIFFICULTIES[game.difficulty].name}`, 270, 154, { size: 16, color: '#ffe9a8', outline: 0 });
  drawText(ctx, `REROLLS LEFT ${game.rerolls}`, 560, 154, { size: 16, color: '#ffe9a8', outline: 0 });
  for (let row = 1; row <= RIFT_COUNT; row += 1) {
    const p = nodePosition(row, 0, 1);
    drawText(ctx, row === RIFT_COUNT ? 'RIFT 7' : `RIFT ${row}`, p.x, 184, { size: 14, color: row <= game.route.length ? '#a06a10' : '#6a4a1a', align: 'center', outline: 0 });
  }
  edges(ctx, game, time);
  const hovered = ui.hoverNode ? nodeById(game.map, ui.hoverNode) : null;
  for (const node of game.map.flat()) drawNode(ctx, game, node, time, hovered && hovered.id === node.id);
  if (hovered) tooltip(ctx, hovered);
  boonRow(ctx, game);
  boonCards(ctx, game, ui, time);
}

/** The shrine dialog, drawn over the path screen. */
export function drawShrine(ctx, game, time) {
  ctx.fillStyle = 'rgba(30,20,6,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.beginPath();
  ctx.roundRect(280, 250, 720, 290, 20);
  ctx.fillStyle = '#f6ead0';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#6dc28a';
  ctx.stroke();
  drawGlyph(ctx, 'ring', 640, 312, 30, '#2a8a4a', 5);
  drawText(ctx, 'THE SHRINE', 640, 376, { size: 44, color: INK, align: 'center', outline: 0 });
  const labels = [['HEAL THE CORE +35', '[H]'], ['GAIN A REROLL', '[R]']];
  SHRINE_BUTTONS.forEach((b, i) => {
    const pulse = 0.5 + 0.5 * Math.sin(time * 4 + i);
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, 14);
    ctx.fillStyle = i === 0 ? '#ffd24a' : '#9ad4ff';
    ctx.fill();
    ctx.lineWidth = 3 + pulse * 2;
    ctx.strokeStyle = '#7a4c0c';
    ctx.stroke();
    drawText(ctx, labels[i][0], b.x + b.w / 2, b.y + 44, { size: 24, color: '#2a1c08', align: 'center', outline: 0 });
    drawText(ctx, labels[i][1], b.x + b.w / 2, b.y + 72, { size: 18, color: '#5a3c10', align: 'center', outline: 0 });
  });
}
