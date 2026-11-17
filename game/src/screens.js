// Overlays drawn over the running scene: the how-to-play card, the boon pick and pause. (The title
// is in menus.js and the win and lose cards are in results.js.)
import { FIELD, FONT, H, PALETTE as P, W } from './config.js';
import { KINDS } from './creatures.js';
import { drawCreatureSprite } from './sprites.js';
import { drawPanel, drawText } from './draw.js';
import { drawFiligree, drawGlyph } from './glyphs.js';
import { RARITY } from './boons.js';

/** The three boon cards, left to right (also used for mouse hit tests). */
export const BOON_CARDS = [0, 1, 2].map((i) => ({ x: 42 + i * 310, y: FIELD.y + 118, w: 290, h: 400 }));

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
    const lift = lit ? -8 : 0;
    const rarity = RARITY[boon.rarity];
    const cx = card.x + card.w / 2;
    const top = card.y + lift;
    ctx.save();
    ctx.shadowColor = rarity.color;
    ctx.shadowBlur = lit ? 34 : 16;
    const body = ctx.createLinearGradient(0, top, 0, top + card.h);
    body.addColorStop(0, lit ? '#222a40' : '#161b2c');
    body.addColorStop(1, '#0a0d16');
    ctx.beginPath();
    ctx.roundRect(card.x, top, card.w, card.h, 16);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = 4;
    ctx.strokeStyle = rarity.color;
    ctx.beginPath();
    ctx.roundRect(card.x, top, card.w, card.h, 16);
    ctx.stroke();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = '#d4aa55';
    ctx.beginPath();
    ctx.roundRect(card.x + 8, top + 8, card.w - 16, card.h - 16, 11);
    ctx.stroke();
    drawFiligree(ctx, card.x + 8, top + 8, card.w - 16, card.h - 16);
    // Rarity pill.
    ctx.beginPath();
    ctx.roundRect(cx - 52, top + 18, 104, 24, 12);
    ctx.fillStyle = rarity.color;
    ctx.fill();
    drawText(ctx, rarity.label, cx, top + 36, { size: 15, color: '#0a0d16', align: 'center', outline: 0 });
    // Glyph medallion.
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = boon.color;
    ctx.beginPath();
    ctx.arc(cx, top + 102, 62, 0, 6.283);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.beginPath();
    ctx.arc(cx, top + 102, 48, 0, 6.283);
    ctx.fillStyle = '#0a0d16';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#d4aa55';
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, top + 102, 40, 0, 6.283);
    ctx.stroke();
    drawGlyph(ctx, boon.glyph, cx, top + 102, 25, boon.color, 5);
    const size = boon.name.length > 16 ? 19 : 23;
    drawText(ctx, boon.name.toUpperCase(), cx, top + 190, { size, color: boon.color, align: 'center' });
    ctx.font = `700 17px ${FONT}`;
    wrap(ctx, boon.desc, card.w - 44).forEach((line, n) => {
      drawText(ctx, line, cx, top + 222 + n * 22, { size: 17, color: '#dfe7ff', align: 'center', weight: 700, outline: 0 });
    });
    ctx.font = `700 14px ${FONT}`;
    wrap(ctx, boon.synergy, card.w - 52).forEach((line, n) => {
      drawText(ctx, line, cx, top + 276 + n * 17, { size: 14, color: rarity.color, align: 'center', weight: 700, outline: 0 });
    });
    const owned = game.boons[boon.id] ?? 0;
    if (owned > 0) drawText(ctx, `you hold x${owned}`, card.x + 18, top + 316, { size: 13, color: P.muted, outline: 0 });
    drawText(ctx, `[${i + 1}]`, card.x + card.w - 18, top + 318, { size: 24, color: blink(time, 3) && lit ? '#ffffff' : P.gold, align: 'right' });
  });
}

export function drawPause(ctx) {
  dim(ctx, 0.7);
  drawText(ctx, 'PAUSED', W / 2, 330, { size: 100, color: '#ffffff', align: 'center' });
  drawText(ctx, 'press P to resume   -   R to restart   -   M to mute', W / 2, 390, { size: 26, color: '#dfe7ff', align: 'center' });
}
