// Full-screen overlays drawn over the running scene: title, how-to-play card, boon pick, pause,
// win ("CONFLUX MASTERED") and lose ("THE CORE SHATTERS"). Each is a pure function of the game
// state, so the screenshot mode can paint any of them.
import { FIELD, FONT, H, PALETTE as P, PLATES, RIFT_COUNT, W } from './config.js';
import { BRUSHES, ELEMENTS } from './elements.js';
import { KINDS } from './creatures.js';
import { drawCreatureSprite } from './sprites.js';
import { drawPanel, drawText, formatNumber } from './draw.js';
import { drawColossus } from './colossus.js';

/** The three boon cards, left to right (also used for mouse hit tests). */
export const BOON_CARDS = [0, 1, 2].map((i) => ({ x: 62 + i * 290, y: FIELD.y + 118, w: 270, h: 330 }));

export function boonCardAt(x, y) {
  return BOON_CARDS.findIndex((c) => x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h);
}

function dim(ctx, alpha, full = true) {
  ctx.fillStyle = `rgba(4,5,9,${alpha})`;
  if (full) ctx.fillRect(0, 0, W, H);
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

/** The big CONFLUX logo with a fire-to-storm gradient. */
function drawLogo(ctx, x, y, size) {
  const grad = ctx.createLinearGradient(x - size * 2, y - size, x + size * 2, y);
  grad.addColorStop(0, '#ff5a1f');
  grad.addColorStop(0.35, '#ffd24a');
  grad.addColorStop(0.65, '#22c3ff');
  grad.addColorStop(1, '#a65cff');
  ctx.font = `900 ${size}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = size / 8;
  ctx.strokeStyle = '#05060a';
  ctx.strokeText('CONFLUX', x, y);
  ctx.fillStyle = grad;
  ctx.fillText('CONFLUX', x, y);
}

export function drawTitle(ctx, time) {
  dim(ctx, 0.62);
  drawLogo(ctx, W / 2, 196, 124);
  drawText(ctx, 'paint four elements. make them react. hold the Core.', W / 2, 242, { size: 26, color: '#dfe7ff', align: 'center' });
  const names = ['FIRE', 'WATER', 'EARTH', 'STORM'];
  names.forEach((n, i) => {
    const el = ELEMENTS[BRUSHES[i]];
    drawPanel(ctx, 262 + i * 190, 290, 170, 56, { edge: el.color, fill: 'rgba(8,10,16,0.85)' });
    drawText(ctx, `[${i + 1}] ${n}`, 262 + i * 190 + 85, 326, { size: 24, color: el.color, align: 'center' });
  });
  drawText(ctx, 'FIRE + WATER = STEAM     FIRE + EARTH = LAVA     WATER + STORM = SHOCK     STEAM + STORM = LIGHTNING', W / 2, 392, { size: 17, color: '#ffd9a0', align: 'center' });
  if (blink(time, 1.6)) drawText(ctx, 'PRESS SPACE OR CLICK TO BEGIN', W / 2, 480, { size: 40, color: '#ffffff', align: 'center' });
  drawText(ctx, 'Survive 7 rifts and the Hollow Colossus. If the Core Crystal shatters, you lose.', W / 2, 530, { size: 20, color: P.muted, align: 'center' });
  drawText(ctx, 'attract mode: the game is playing itself', W / 2, 700, { size: 14, color: P.muted, align: 'center', outline: 0 });
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

function drawStatBox(ctx, x, y, w, label, value, color) {
  drawPanel(ctx, x, y, w, 96, { fill: 'rgba(10,13,22,0.92)', edge: color });
  drawText(ctx, label, x + w / 2, y + 26, { size: 15, color: P.muted, align: 'center', outline: 0 });
  drawText(ctx, value, x + w / 2, y + 74, { size: 44, color, align: 'center' });
}

function drawKillRow(ctx, game, y, time) {
  const kinds = Object.keys(KINDS).filter((k) => game.stats.byKind[k]);
  const width = kinds.length * 118;
  kinds.forEach((id, i) => {
    const x = W / 2 - width / 2 + i * 118 + 59;
    drawCreatureSprite(ctx, id, x - 22, y, id === 'colossus' ? 5 : 13, time, {});
    drawText(ctx, `x${game.stats.byKind[id]}`, x + 8, y + 7, { size: 22, color: '#ffffff' });
  });
}

/** The dead Colossus, a dark cracked husk under rising light, drawn behind the win results. */
function drawVictoryBackdrop(ctx, time) {
  ctx.fillStyle = '#07080d';
  ctx.fillRect(FIELD.x, FIELD.y, FIELD.w, FIELD.h);
  ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 7; k += 1) {
    const x = 120 + k * 120 + Math.sin(time + k) * 12;
    const beam = ctx.createLinearGradient(x, 700, x, 80);
    beam.addColorStop(0, 'rgba(255,210,120,0.28)');
    beam.addColorStop(1, 'rgba(255,210,120,0)');
    ctx.fillStyle = beam;
    ctx.fillRect(x - 26, 80, 52, 620);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.translate(W / 2 - 150, 430);
  drawColossus(ctx, 100, time, { ruin: true, plates: 4 });
  ctx.restore();
  for (let k = 0; k < 16; k += 1) {
    const x = 80 + ((k * 331) % 760);
    const y = 560 + ((k * 97) % 110);
    const color = PLATES[k % 4].color;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(x, y - 9);
    ctx.lineTo(x + 13, y + 6);
    ctx.lineTo(x - 9, y + 8);
    ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.25;
    ctx.fillRect(x - 14, y - 14, 28, 28);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 40; k += 1) {
    const x = 60 + ((k * 197) % 900);
    const y = 690 - ((time * 40 + k * 53) % 600);
    ctx.fillStyle = k % 2 ? '#ffd24a' : '#ffffff';
    ctx.globalAlpha = 0.7;
    ctx.fillRect(x, y, 3, 3);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

/** The end screens share a layout; `won` picks the words and colours. */
export function drawEnd(ctx, game, bests, won, time) {
  if (won) drawVictoryBackdrop(ctx, time);
  dim(ctx, won ? 0.34 : 0.78);
  const color = won ? '#ffd24a' : '#ff4a5e';
  if (won) {
    drawText(ctx, 'CONFLUX MASTERED', W / 2, 205, { size: 92, color, align: 'center' });
    drawText(ctx, `All ${RIFT_COUNT} rifts sealed. The Hollow Colossus is hollow no more.`, W / 2, 248, { size: 25, color: '#dfe7ff', align: 'center' });
  } else {
    drawText(ctx, 'THE CORE SHATTERS', W / 2, 190, { size: 92, color, align: 'center' });
    drawText(ctx, `The rifts broke through on rift ${Math.max(1, game.riftNum)} of ${RIFT_COUNT}.`, W / 2, 238, { size: 25, color: '#dfe7ff', align: 'center' });
  }
  const newScore = game.score >= bests.score && game.score > 0;
  const newChain = game.stats.bestChain >= bests.chain && game.stats.bestChain > 0;
  const boxes = [
    ['SCORE', formatNumber(game.score), '#ffd24a'],
    ['BEST SCORE', formatNumber(Math.max(bests.score, game.score)), '#ffe9a8'],
    ['BEST CHAIN', `x${game.stats.bestChain}`, '#ffe23a'],
    ['RIFTS CLEARED', `${game.stats.riftsCleared ?? 0}/${RIFT_COUNT}`, '#6dffb0'],
  ];
  boxes.forEach((b, i) => drawStatBox(ctx, 118 + i * 282, 290, 262, b[0], b[1], b[2]));
  if (newScore) drawText(ctx, 'NEW BEST SCORE!', 118 + 140 + 0, 282, { size: 18, color: '#ffffff', align: 'center' });
  if (newChain) drawText(ctx, 'NEW CHAIN RECORD!', 118 + 282 * 2 + 131, 282, { size: 18, color: '#ffffff', align: 'center' });
  const small = [
    ['CREATURES SLAIN', game.stats.kills],
    ['REACTIONS', game.stats.reactions],
    ['CORE HITS TAKEN', game.stats.coreHits],
    ['CHAIN RECORD (ALL RUNS)', `x${Math.max(bests.chain, game.stats.bestChain)}`],
  ];
  small.forEach((s, i) => {
    const x = 118 + i * 282;
    drawText(ctx, String(s[0]), x + 131, 424, { size: 14, color: P.muted, align: 'center', outline: 0 });
    drawText(ctx, String(s[1]), x + 131, 458, { size: 32, color: '#ffffff', align: 'center' });
  });
  drawKillRow(ctx, game, 520, time);
  const glow = 0.8 + 0.2 * Math.sin(time * 5);
  drawText(ctx, won ? 'Press R to play again' : 'Press R to retry', W / 2, 626, { size: 50, color: `rgba(255,255,255,${glow})`, align: 'center' });
  drawText(ctx, won ? 'a perfect storm of elements' : 'paint earlier, chain harder', W / 2, 668, { size: 18, color: P.muted, align: 'center', outline: 0 });
}
