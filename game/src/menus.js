// The title screen, built to read even as a thumbnail: a huge gold-bevelled CONFLUX logo whose
// letter cores glow in element colours, with the four element glyphs orbiting it, one big tagline,
// the six reactions as large glyph tiles, three large difficulty buttons (which really change the
// run), a "Same seed" option, a huge start button and the keycap row. It is drawn over the blurred,
// darkened attract-mode battlefield, with no game HUD behind it.
import { DIFFICULTIES, FONT, H, W } from './config.js';
import { drawGlyph, drawFiligree, GLYPH_COLORS } from './glyphs.js';
import { drawText } from './draw.js';
import { drawKeyBar } from './hud.js';

const CHIP_W = 300;
const CHIP_GAP = 20;
/** Clickable difficulty buttons, left to right (Apprentice, Adept, Archmage). */
export const DIFF_CHIPS = DIFFICULTIES.map((_, i) => ({ x: (W - (3 * CHIP_W + 2 * CHIP_GAP)) / 2 + i * (CHIP_W + CHIP_GAP), y: 490, w: CHIP_W, h: 58 }));
/** The "Same seed" toggle and the big start button. */
export const SEED_CHIP = { x: 440, y: 556, w: 400, h: 34 };
export const START_BUTTON = { x: 250, y: 602, w: 780, h: 96 };

/** What the pointer is over on the title screen: {type:'diff', index}, {type:'seed'}, {type:'start'} or null. */
export function titleHit(x, y) {
  const inside = (b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
  const index = DIFF_CHIPS.findIndex(inside);
  if (index >= 0) return { type: 'diff', index };
  if (inside(SEED_CHIP)) return { type: 'seed' };
  if (inside(START_BUTTON)) return { type: 'start' };
  return null;
}

/** Element colours for the letters of CONFLUX, in order. */
const LETTER_COLORS = ['#ff6a2a', '#ff9a2a', '#ffe23a', '#2ec8ff', '#2ec8ff', '#c9a36a', '#ffe23a'];

/**
 * The CONFLUX logo in arcane gold: each letter has a dark outline, a bevelled gold rim and a core
 * that glows in an element colour. Centred at x, baseline y.
 */
export function drawLogo(ctx, x, y, size) {
  const word = 'CONFLUX';
  ctx.font = `900 ${size}px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  const widths = [...word].map((ch) => ctx.measureText(ch).width + size * 0.03);
  const total = widths.reduce((a, b) => a + b, 0);
  let cx = x - total / 2;
  [...word].forEach((ch, i) => {
    const color = LETTER_COLORS[i];
    ctx.lineWidth = size / 5;
    ctx.strokeStyle = '#05060a';
    ctx.strokeText(ch, cx, y);
    const gold = ctx.createLinearGradient(0, y - size * 0.75, 0, y);
    gold.addColorStop(0, '#fff6c8');
    gold.addColorStop(0.45, '#e0b050');
    gold.addColorStop(1, '#8a5a18');
    ctx.lineWidth = size / 9;
    ctx.strokeStyle = gold;
    ctx.strokeText(ch, cx, y);
    const core = ctx.createLinearGradient(0, y - size * 0.75, 0, y);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.35, color);
    core.addColorStop(1, '#2a1208');
    ctx.fillStyle = core;
    ctx.fillText(ch, cx, y);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = color;
    ctx.fillText(ch, cx, y);
    ctx.restore();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.strokeText(ch, cx - 1.5, y - 1.5);
    cx += widths[i];
  });
}

/** The six reactions as tiles: glyph + glyph = result, with the name in bold. */
const TILES = [
  ['fire', 'water', 'steam', 'STEAM', 23],
  ['fire', 'earth', 'lava', 'LAVA', 23],
  ['water', 'storm', 'shock', 'SHOCK', 23],
  ['steam', 'storm', 'cloud', 'STORMCLOUD', 18],
  ['earth', 'storm', 'magnet', 'MAGNET', 23],
  ['water', 'frost', 'ice', 'ICE', 23],
];

function drawTile(ctx, tile, x, y, w, h) {
  const [a, b, result, name, size] = tile;
  const color = GLYPH_COLORS[result];
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 14);
  ctx.fillStyle = 'rgba(8,10,18,0.9)';
  ctx.fill();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = color;
  ctx.stroke();
  drawFiligree(ctx, x + 3, y + 3, w - 6, h - 6, '#d4aa55');
  const cx = x + w / 2;
  drawGlyph(ctx, a, cx - 48, y + 30, 17, GLYPH_COLORS[a], 3.5);
  drawText(ctx, '+', cx, y + 38, { size: 26, align: 'center' });
  drawGlyph(ctx, b, cx + 48, y + 30, 17, GLYPH_COLORS[b], 3.5);
  ctx.strokeStyle = '#d4aa55';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x + 18, y + 56);
  ctx.lineTo(x + w - 18, y + 56);
  ctx.stroke();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, y + 88, 28, 0, 6.283);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  drawGlyph(ctx, result, cx, y + 88, 21, color, 4.5);
  drawText(ctx, name, cx, y + 130, { size, color, align: 'center' });
}

/** The three how-to-play steps, each with an icon, large enough to read as a thumbnail. */
const STEPS = [
  ['spiral', '1  PAINT', 'elements with the mouse', '#ffd24a'],
  ['steam', '2  REACT:', 'mix two elements', '#5ff0ff'],
  ['shock', '3  CHAIN', 'reactions through the horde', '#ffe23a'],
];

function drawSteps(ctx) {
  const w = 388;
  const gap = 16;
  const x0 = (W - (3 * w + 2 * gap)) / 2;
  STEPS.forEach(([glyph, head, sub, color], i) => {
    const x = x0 + i * (w + gap);
    const y = 252;
    ctx.beginPath();
    ctx.roundRect(x, y, w, 76, 14);
    ctx.fillStyle = 'rgba(8,10,18,0.92)';
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#d4aa55';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + 46, y + 38, 28, 0, 6.283);
    ctx.fillStyle = '#05070c';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = color;
    ctx.stroke();
    drawGlyph(ctx, glyph, x + 46, y + 38, 18, color, 4);
    drawText(ctx, head, x + 88, y + 36, { size: 30, color });
    drawText(ctx, sub, x + 88, y + 62, { size: 19, color: '#ffffff', weight: 800, outline: 2 });
  });
}

/** Paint the title screen. `difficulty` is the chosen index; `hit` the hovered target or null. */
export function drawTitle(ctx, time, difficulty, hit, sameSeed, seed) {
  ctx.fillStyle = 'rgba(4,5,9,0.18)';
  ctx.fillRect(0, 0, W, H);
  // Logo with the four element glyphs orbiting it, fully inside the frame.
  ['fire', 'water', 'earth', 'storm'].forEach((kind, k) => {
    const a = time * 0.7 + (k / 4) * 6.283;
    const x = W / 2 + Math.cos(a) * 520;
    const y = 118 + Math.sin(a) * 34;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = GLYPH_COLORS[kind];
    ctx.beginPath();
    ctx.arc(x, y, 32, 0, 6.283);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    drawGlyph(ctx, kind, x, y, 21, '#ffffff', 5);
  });
  drawLogo(ctx, W / 2, 186, 160);
  drawText(ctx, 'Paint four elements. Make them react. Hold the Core.', W / 2, 232, { size: 32, color: '#ffffff', align: 'center' });
  drawSteps(ctx);
  // Reaction tiles.
  const tw = 188;
  const gap = 12;
  const x0 = (W - (6 * tw + 5 * gap)) / 2;
  TILES.forEach((tile, i) => drawTile(ctx, tile, x0 + i * (tw + gap), 340, tw, 142));
  // Difficulty.
  DIFFICULTIES.forEach((d, i) => {
    const c = DIFF_CHIPS[i];
    const selected = difficulty === i;
    const hover = hit && hit.type === 'diff' && hit.index === i;
    ctx.beginPath();
    ctx.roundRect(c.x, c.y, c.w, c.h, 14);
    ctx.fillStyle = selected ? '#4a3708' : hover ? '#1e2638' : 'rgba(8,10,18,0.9)';
    ctx.fill();
    ctx.lineWidth = selected ? 5 : 2.5;
    ctx.strokeStyle = selected ? '#ffd24a' : '#5a6480';
    ctx.stroke();
    drawText(ctx, d.name, c.x + c.w / 2, c.y + 35, { size: 29, color: selected ? '#ffd24a' : '#ffffff', align: 'center' });
    drawText(ctx, d.tag, c.x + c.w / 2, c.y + 53, { size: 15, color: '#aab4cc', align: 'center', weight: 700, outline: 0 });
  });
  // Same seed.
  const s = SEED_CHIP;
  ctx.beginPath();
  ctx.roundRect(s.x, s.y, s.w, s.h, 10);
  ctx.fillStyle = sameSeed ? '#10382a' : 'rgba(8,10,18,0.9)';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = sameSeed ? '#6dffb0' : hit && hit.type === 'seed' ? '#ffffff' : '#5a6480';
  ctx.stroke();
  ctx.strokeStyle = sameSeed ? '#6dffb0' : '#8f98ad';
  ctx.lineWidth = 3;
  ctx.strokeRect(s.x + 12, s.y + 10, 18, 18);
  if (sameSeed) {
    ctx.beginPath();
    ctx.moveTo(s.x + 15, s.y + 19);
    ctx.lineTo(s.x + 20, s.y + 25);
    ctx.lineTo(s.x + 28, s.y + 12);
    ctx.stroke();
  }
  drawText(ctx, sameSeed ? `SAME SEED ON  -  replay seed ${seed}` : "SAME SEED  -  replay the last run's map [S]", s.x + 44, s.y + 26, { size: 17, color: sameSeed ? '#6dffb0' : '#dfe7ff', weight: 800, outline: 0 });
  // Start.
  const b = START_BUTTON;
  const hover = hit && hit.type === 'start';
  const pulse = 0.5 + 0.5 * Math.sin(time * 4);
  ctx.save();
  ctx.shadowColor = '#ffb347';
  ctx.shadowBlur = 20 + pulse * 26;
  const grad = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
  grad.addColorStop(0, hover ? '#ffe27a' : '#ffc23a');
  grad.addColorStop(1, hover ? '#ff9a2a' : '#e8780f');
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.w, b.h, 22);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#fff3c0';
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.w, b.h, 22);
  ctx.stroke();
  drawText(ctx, 'CLICK TO START', b.x + b.w / 2, b.y + 68, { size: 62, color: '#1a0c00', align: 'center', outline: 0 });
  drawKeyBar(ctx);
}
