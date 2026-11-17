// Overlays drawn over the running scene: the how-to-play card, the boon pick and pause. (The title
// is in menus.js and the win and lose cards are in results.js.)
import { FIELD, FONT, H, PALETTE as P, W } from './config.js';
import { KINDS } from './creatures.js';
import { drawCreatureSprite } from './sprites.js';
import { drawPanel, drawText } from './draw.js';

/** The three boon cards, left to right (also used for mouse hit tests). */
export const BOON_CARDS = [0, 1, 2].map((i) => ({ x: 62 + i * 290, y: FIELD.y + 118, w: 270, h: 330 }));

export function boonCardAt(x, y) {
  return BOON_CARDS.findIndex((c) => x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h);
}

/** The 720-line layouts of the full-screen overlays are centred in the taller canvas. */
export const OVERLAY_OFFSET = (H - 720) / 2;

function dim(ctx, alpha, full = true) {
  ctx.fillStyle = `rgba(4,5,9,${alpha})`;
  if (full) ctx.fillRect(0, -OVERLAY_OFFSET, W, H);
  else ctx.fillRect(FIELD.x, FIELD.y, FIELD.w, FIELD.h);
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

function blink(time, rate = 2) {
  return Math.floor(time * rate) % 2 === 0;
}

const REACTION_ROWS = [
  ['FIRE + WATER', 'STEAM', 'a cloud that blinds and slows', '#e9f7fb'],
  ['FIRE + EARTH', 'LAVA', 'burns, and creeps through earth', '#ff8a2a'],
  ['WATER + STORM', 'SHOCK', 'charges ALL connected water', '#ffe23a'],
  ['EARTH + STORM', 'MAGNETITE', 'pulls creatures into a clump', '#ff8fae'],
  ['STEAM + STORM', 'STORMCLOUD', 'lightning strikes below it', '#c58aff'],
  ['ICE + STORM', 'SHATTER', 'ice bursts for damage (Frost Touch)', '#dff6ff'],
];

export function drawHelp(ctx, time) {
  dim(ctx, 0.8);
  drawPanel(ctx, 140, 60, 1000, 600, { fill: 'rgba(10,13,22,0.97)', edge: '#ffd24a', lineWidth: 3 });
  drawText(ctx, 'HOW TO PLAY', W / 2, 112, { size: 44, color: '#ffd24a', align: 'center' });
  drawText(ctx, 'Rift creatures walk from the gates to the Core Crystal in the middle. HOLD THE MOUSE to paint elements.', W / 2, 150, { size: 19, color: '#dfe7ff', align: 'center', outline: 0 });
  drawText(ctx, 'Keys [1] FIRE  [2] WATER  [3] EARTH  [4] STORM pick the brush. Each brush has its own essence; kills refill it.', W / 2, 176, { size: 17, color: '#aab4cc', align: 'center', outline: 0 });
  drawText(ctx, 'REACTIONS (touching cells react, and reactions chain)', 180, 224, { size: 20, color: '#ffffff' });
  REACTION_ROWS.forEach((row, i) => {
    const y = 258 + i * 32;
    drawText(ctx, row[0], 190, y, { size: 19, color: '#ffffff', outline: 2 });
    drawText(ctx, row[1], 410, y, { size: 19, color: row[3] });
    drawText(ctx, row[2], 560, y, { size: 16, color: P.muted, weight: 700, outline: 0 });
  });
  drawText(ctx, 'CREATURES', 180, 478, { size: 20, color: '#ffffff' });
  const kinds = ['imp', 'golem', 'wraith', 'beetle', 'swarm', 'ram'];
  kinds.forEach((id, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 190 + col * 320;
    const y = 520 + row * 54;
    drawCreatureSprite(ctx, id, x + 14, y, 12, time, {});
    drawText(ctx, KINDS[id].name, x + 38, y - 2, { size: 15, color: '#ffffff', outline: 2 });
    drawText(ctx, KINDS[id].tip.slice(0, 40), x + 38, y + 15, { size: 11.5, color: P.muted, weight: 700, outline: 0 });
  });
  drawText(ctx, '[SPACE] open the next rift early   [P] pause   [M] mute   [R] restart', W / 2, 626, { size: 16, color: '#aab4cc', align: 'center', outline: 0 });
  if (blink(time, 1.6)) drawText(ctx, 'PRESS SPACE TO DEFEND THE CORE', W / 2, 650, { size: 26, color: '#ffffff', align: 'center' });
}

export function drawBoonPick(ctx, game, hover, time) {
  dim(ctx, 0.5, false);
  drawText(ctx, `RIFT ${game.riftNum} CLEARED`, FIELD.x + FIELD.w / 2, FIELD.y + 56, { size: 50, color: '#6dffb0', align: 'center' });
  drawText(ctx, 'CHOOSE A BOON  -  press 1, 2 or 3, or click a card', FIELD.x + FIELD.w / 2, FIELD.y + 92, { size: 24, color: '#ffffff', align: 'center' });
  game.offer.forEach((boon, i) => {
    const card = BOON_CARDS[i];
    const lit = hover === i;
    const lift = lit ? -6 : 0;
    drawPanel(ctx, card.x, card.y + lift, card.w, card.h, { fill: lit ? '#1a2133' : '#0e121c', edge: boon.color, lineWidth: lit ? 5 : 3 });
    ctx.fillStyle = boon.color;
    ctx.beginPath();
    ctx.arc(card.x + card.w / 2, card.y + 74 + lift, 40, 0, 6.283);
    ctx.fill();
    drawText(ctx, boon.icon, card.x + card.w / 2, card.y + 90 + lift, { size: 48, color: '#05060a', align: 'center', outline: 0 });
    drawText(ctx, boon.name.toUpperCase(), card.x + card.w / 2, card.y + 158 + lift, { size: 24, color: boon.color, align: 'center' });
    ctx.font = `700 17px ${FONT}`;
    wrap(ctx, boon.desc, card.w - 36).forEach((line, n) => {
      drawText(ctx, line, card.x + card.w / 2, card.y + 196 + n * 24 + lift, { size: 17, color: '#dfe7ff', align: 'center', weight: 700, outline: 0 });
    });
    const owned = game.boons[boon.id] ?? 0;
    if (owned > 0) drawText(ctx, `you hold x${owned}`, card.x + card.w / 2, card.y + 292 + lift, { size: 14, color: P.muted, align: 'center', outline: 0 });
    drawText(ctx, `[${i + 1}]`, card.x + card.w / 2, card.y + 318 + lift, { size: 26, color: blink(time, 3) && lit ? '#ffffff' : P.gold, align: 'center' });
  });
}

export function drawPause(ctx) {
  dim(ctx, 0.7);
  drawText(ctx, 'PAUSED', W / 2, 330, { size: 100, color: '#ffffff', align: 'center' });
  drawText(ctx, 'press P to resume   -   R to restart   -   M to mute', W / 2, 390, { size: 26, color: '#dfe7ff', align: 'center' });
}
