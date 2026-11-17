// The title screen, built to read even as a thumbnail: a huge CONFLUX logo with the four element
// glyphs orbiting it, one big tagline, the six reactions as large glyph tiles, three large
// difficulty buttons (which really change the run) and a huge start button, over the live
// attract-mode battlefield.
import { DIFFICULTIES, FONT, H, W } from './config.js';
import { drawGlyph, drawFiligree, GLYPH_COLORS } from './glyphs.js';
import { drawText } from './draw.js';

const CHIP_W = 300;
const CHIP_GAP = 20;
/** Clickable difficulty buttons, left to right (Apprentice, Adept, Archmage). */
export const DIFF_CHIPS = DIFFICULTIES.map((_, i) => ({ x: (W - (3 * CHIP_W + 2 * CHIP_GAP)) / 2 + i * (CHIP_W + CHIP_GAP), y: 528, w: CHIP_W, h: 76 }));
/** The big start button. */
export const START_BUTTON = { x: 250, y: 650, w: 780, h: 112 };

/** What the pointer is over on the title screen: {type:'diff', index}, {type:'start'} or null. */
export function titleHit(x, y) {
  const index = DIFF_CHIPS.findIndex((c) => x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h);
  if (index >= 0) return { type: 'diff', index };
  const b = START_BUTTON;
  if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return { type: 'start' };
  return null;
}

/** The CONFLUX logo with a fire-to-storm gradient. */
export function drawLogo(ctx, x, y, size) {
  const grad = ctx.createLinearGradient(x - size * 2, y - size, x + size * 2, y);
  grad.addColorStop(0, '#ff5a1f');
  grad.addColorStop(0.35, '#ffd24a');
  grad.addColorStop(0.65, '#22c3ff');
  grad.addColorStop(1, '#a65cff');
  ctx.font = `900 ${size}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = size / 7;
  ctx.strokeStyle = '#05060a';
  ctx.strokeText('CONFLUX', x, y);
  ctx.fillStyle = grad;
  ctx.fillText('CONFLUX', x, y);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,240,200,0.55)';
  ctx.strokeText('CONFLUX', x, y);
}

/** The six reactions as tiles: glyph + glyph = result, with the name in bold. */
const TILES = [
  ['fire', 'water', 'steam', 'STEAM', 26],
  ['fire', 'earth', 'lava', 'LAVA', 26],
  ['water', 'storm', 'shock', 'SHOCK', 26],
  ['steam', 'storm', 'cloud', 'STORMCLOUD', 21],
  ['earth', 'storm', 'magnet', 'MAGNET', 26],
  ['water', 'frost', 'ice', 'ICE', 26],
];

function drawTile(ctx, tile, x, y, w, h) {
  const [a, b, result, name, size] = tile;
  const color = GLYPH_COLORS[result];
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 16);
  ctx.fillStyle = 'rgba(8,10,18,0.9)';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = color;
  ctx.stroke();
  drawFiligree(ctx, x + 3, y + 3, w - 6, h - 6, '#d4aa55');
  const cx = x + w / 2;
  drawGlyph(ctx, a, cx - 52, y + 44, 21, GLYPH_COLORS[a], 4);
  drawText(ctx, '+', cx, y + 53, { size: 32, align: 'center' });
  drawGlyph(ctx, b, cx + 52, y + 44, 21, GLYPH_COLORS[b], 4);
  ctx.strokeStyle = '#d4aa55';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 20, y + 84);
  ctx.lineTo(x + w - 20, y + 84);
  ctx.stroke();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, y + 130, 40, 0, 6.283);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  drawGlyph(ctx, result, cx, y + 130, 31, color, 5);
  drawText(ctx, name, cx, y + 188, { size, color, align: 'center' });
}

/** Paint the title screen. `difficulty` is the chosen index; `hit` the hovered target or null. */
export function drawTitle(ctx, time, difficulty, hit) {
  ctx.fillStyle = 'rgba(4,5,9,0.34)';
  ctx.fillRect(0, 0, W, H);
  // Logo with the four element glyphs orbiting it.
  const cy = 128;
  ['fire', 'water', 'earth', 'storm'].forEach((kind, k) => {
    const a = time * 0.7 + (k / 4) * 6.283;
    const x = W / 2 + Math.cos(a) * 520;
    const y = cy - 52 + Math.sin(a) * 52;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = GLYPH_COLORS[kind];
    ctx.beginPath();
    ctx.arc(x, y, 34, 0, 6.283);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    drawGlyph(ctx, kind, x, y, 22, '#ffffff', 5);
  });
  drawLogo(ctx, W / 2, 168, 190);
  drawText(ctx, 'Paint four elements. Make them react. Hold the Core.', W / 2, 232, { size: 38, color: '#ffffff', align: 'center' });
  // Reaction tiles.
  const tw = 188;
  const gap = 12;
  const x0 = (W - (6 * tw + 5 * gap)) / 2;
  TILES.forEach((tile, i) => drawTile(ctx, tile, x0 + i * (tw + gap), 270, tw, 206));
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
    drawText(ctx, d.name, c.x + c.w / 2, c.y + 40, { size: 32, color: selected ? '#ffd24a' : '#ffffff', align: 'center' });
    drawText(ctx, d.tag, c.x + c.w / 2, c.y + 64, { size: 16, color: '#aab4cc', align: 'center', weight: 700, outline: 0 });
  });
  drawText(ctx, DIFFICULTIES[difficulty].note, W / 2, 630, { size: 16, color: '#ffd9a0', align: 'center', weight: 700, outline: 2 });
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
  drawText(ctx, 'CLICK TO START', b.x + b.w / 2, b.y + 76, { size: 68, color: '#1a0c00', align: 'center', outline: 0 });
  ctx.fillStyle = 'rgba(4,5,9,0.92)';
  ctx.fillRect(0, H - 34, W, 34);
  drawText(ctx, 'hold the mouse to paint  -  keys 1-4 pick the brush  -  Space opens a rift  -  [H] help', W / 2, 786, { size: 15, color: '#aab4cc', align: 'center', outline: 0 });
}
