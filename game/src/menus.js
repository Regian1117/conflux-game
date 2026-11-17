// The title screen: logo, one-line goal, a compact reaction chart with element icons, the controls,
// the difficulty choice (which really changes the run: creature health and count, essence
// regeneration) and a big start button, all over the live attract-mode battlefield.
import { DIFFICULTIES, FONT, H, PALETTE as P, W } from './config.js';
import { drawPanel, drawText } from './draw.js';

const CHIP_W = 188;
const CHIP_GAP = 14;
/** Clickable difficulty chips, left to right (Apprentice, Adept, Archmage). */
export const DIFF_CHIPS = DIFFICULTIES.map((_, i) => ({ x: (W - (3 * CHIP_W + 2 * CHIP_GAP)) / 2 + i * (CHIP_W + CHIP_GAP), y: 566, w: CHIP_W, h: 54 }));
/** The big start button. */
export const START_BUTTON = { x: 360, y: 668, w: 560, h: 84 };

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
  ctx.lineWidth = size / 8;
  ctx.strokeStyle = '#05060a';
  ctx.strokeText('CONFLUX', x, y);
  ctx.fillStyle = grad;
  ctx.fillText('CONFLUX', x, y);
}

const ICON_COLORS = { fire: '#ff5a1f', water: '#22c3ff', earth: '#8a6a3a', storm: '#ffe23a', steam: '#cfe9f2', frost: '#bfeaff', lava: '#ff3d00', shock: '#37e6ff', cloud: '#7b6cf0', magnet: '#b86a86', ice: '#dff6ff' };

/** A small vector icon for an element or reaction product, `s` pixels square at (x, y) centre. */
function drawIcon(ctx, kind, x, y, s) {
  const color = ICON_COLORS[kind];
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#0b0e16';
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(-s / 2, -s / 2, s, s, s * 0.25);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  const k = s / 40;
  ctx.scale(k, k);
  ctx.beginPath();
  if (kind === 'fire' || kind === 'lava') {
    ctx.moveTo(0, -14);
    ctx.quadraticCurveTo(12, -2, 8, 8);
    ctx.quadraticCurveTo(0, 16, -8, 8);
    ctx.quadraticCurveTo(-12, -2, 0, -14);
    ctx.fill();
    ctx.fillStyle = kind === 'lava' ? '#ffd24a' : '#ffe27a';
    ctx.beginPath();
    ctx.ellipse(0, 6, 4, 6, 0, 0, 6.283);
    ctx.fill();
  } else if (kind === 'water' || kind === 'shock') {
    ctx.moveTo(0, -14);
    ctx.quadraticCurveTo(13, 4, 7, 11);
    ctx.quadraticCurveTo(0, 17, -7, 11);
    ctx.quadraticCurveTo(-13, 4, 0, -14);
    ctx.fill();
    if (kind === 'shock') {
      ctx.fillStyle = '#ffe23a';
      ctx.beginPath();
      ctx.moveTo(2, -6);
      ctx.lineTo(-4, 3);
      ctx.lineTo(0, 3);
      ctx.lineTo(-2, 11);
      ctx.lineTo(5, 0);
      ctx.lineTo(1, 0);
      ctx.fill();
    }
  } else if (kind === 'earth') {
    ctx.moveTo(-13, 8);
    ctx.lineTo(-8, -8);
    ctx.lineTo(2, -12);
    ctx.lineTo(13, -2);
    ctx.lineTo(11, 9);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#6aa23a';
    ctx.fillRect(-8, -9, 14, 4);
  } else if (kind === 'storm') {
    ctx.moveTo(4, -15);
    ctx.lineTo(-8, 2);
    ctx.lineTo(-1, 2);
    ctx.lineTo(-5, 15);
    ctx.lineTo(9, -3);
    ctx.lineTo(2, -3);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'steam' || kind === 'cloud') {
    ctx.arc(-6, 3, 7, 0, 6.283);
    ctx.arc(4, 0, 9, 0, 6.283);
    ctx.arc(10, 6, 5, 0, 6.283);
    ctx.fill();
    if (kind === 'cloud') {
      ctx.fillStyle = '#ffe23a';
      ctx.beginPath();
      ctx.moveTo(1, 6);
      ctx.lineTo(-3, 13);
      ctx.lineTo(1, 13);
      ctx.lineTo(-1, 18);
      ctx.lineTo(5, 10);
      ctx.lineTo(1, 10);
      ctx.fill();
    }
  } else if (kind === 'magnet') {
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0.2, Math.PI - 0.2, true);
    ctx.stroke();
    ctx.fillStyle = '#ff4d6a';
    ctx.fillRect(-12, 0, 6, 10);
    ctx.fillStyle = '#5a8cff';
    ctx.fillRect(6, 0, 6, 10);
  } else {
    // frost and ice: a six-armed snowflake
    ctx.lineWidth = 2.6;
    for (let a = 0; a < 3; a += 1) {
      ctx.save();
      ctx.rotate((a * Math.PI) / 3);
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(0, 14);
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
}

const CHART = [
  ['fire', 'water', 'steam', 'STEAM', '#e9f7fb', 'blinds and slows'],
  ['fire', 'earth', 'lava', 'LAVA', '#ff8a2a', 'burns, creeps through earth'],
  ['water', 'storm', 'shock', 'SHOCK', '#37e6ff', 'charges all connected water'],
  ['steam', 'storm', 'cloud', 'STORMCLOUD', '#c58aff', 'lightning strikes below'],
  ['earth', 'storm', 'magnet', 'MAGNET', '#ff8fae', 'pulls creatures together'],
  ['water', 'frost', 'ice', 'ICE', '#dff6ff', 'freezes (Frost Touch boon)'],
];

function keyCap(ctx, label, x, y, w) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, 34, 7);
  ctx.fillStyle = '#1a2030';
  ctx.fill();
  ctx.strokeStyle = '#8f98ad';
  ctx.lineWidth = 2;
  ctx.stroke();
  drawText(ctx, label, x + w / 2, y + 24, { size: 17, align: 'center', outline: 0 });
}

function drawReactionChart(ctx) {
  drawPanel(ctx, 60, 222, 610, 322, { fill: 'rgba(8,10,18,0.8)', edge: '#ffd24a', lineWidth: 3 });
  drawText(ctx, 'REACTIONS', 84, 256, { size: 22, color: '#ffd24a' });
  drawText(ctx, 'touching cells react, and reactions chain', 650, 256, { size: 14, color: P.muted, align: 'right', weight: 700, outline: 0 });
  CHART.forEach(([a, b, result, name, color, note], i) => {
    const y = 300 + i * 41;
    drawIcon(ctx, a, 100, y, 34);
    drawText(ctx, '+', 134, y + 8, { size: 24, color: '#ffffff', align: 'center' });
    drawIcon(ctx, b, 168, y, 34);
    drawText(ctx, '=', 202, y + 8, { size: 24, color: '#ffffff', align: 'center' });
    drawIcon(ctx, result, 236, y, 34);
    drawText(ctx, name, 264, y + 8, { size: 21, color });
    drawText(ctx, note, 650, y + 6, { size: 13.5, color: P.muted, align: 'right', weight: 700, outline: 0 });
  });
}

function drawControls(ctx) {
  drawPanel(ctx, 700, 222, 520, 322, { fill: 'rgba(8,10,18,0.8)', edge: '#22c3ff', lineWidth: 3 });
  drawText(ctx, 'CONTROLS', 724, 256, { size: 22, color: '#22c3ff' });
  const rows = [
    [['MOUSE'], 'hold and drag to paint', 80],
    [['1', '2', '3', '4'], 'fire / water / earth / storm', 36],
    [['SPACE'], 'open the next rift early', 80],
    [['P', 'M', 'R'], 'pause / mute / retry', 36],
  ];
  rows.forEach(([keys, text, width], i) => {
    const y = 282 + i * 56;
    let x = 724;
    for (const key of keys) {
      keyCap(ctx, key, x, y, width);
      x += width + 8;
    }
    drawText(ctx, text, 724, y + 56 - 8, { size: 15, color: '#dfe7ff', weight: 700, outline: 0 });
  });
}

/** Paint the title screen. `difficulty` is the chosen index; `hit` the hovered target or null. */
export function drawTitle(ctx, time, difficulty, hit) {
  ctx.fillStyle = 'rgba(4,5,9,0.3)';
  ctx.fillRect(0, 0, W, H);
  drawLogo(ctx, W / 2, 150, 124);
  drawText(ctx, 'Paint four elements. Make them react. Hold the Core through 7 rifts.', W / 2, 198, { size: 26, color: '#ffffff', align: 'center' });
  drawReactionChart(ctx);
  drawControls(ctx);
  drawText(ctx, 'DIFFICULTY', W / 2, 556, { size: 17, color: P.muted, align: 'center', outline: 0 });
  DIFFICULTIES.forEach((d, i) => {
    const c = DIFF_CHIPS[i];
    const selected = difficulty === i;
    const hover = hit && hit.type === 'diff' && hit.index === i;
    drawPanel(ctx, c.x, c.y, c.w, c.h, { fill: selected ? '#3a2c0c' : hover ? '#1a2133' : 'rgba(8,10,18,0.9)', edge: selected ? '#ffd24a' : '#4a5470', lineWidth: selected ? 4 : 2 });
    drawText(ctx, d.name, c.x + c.w / 2, c.y + 26, { size: 22, color: selected ? '#ffd24a' : '#ffffff', align: 'center' });
    drawText(ctx, d.tag, c.x + c.w / 2, c.y + 46, { size: 13, color: P.muted, align: 'center', weight: 700, outline: 0 });
  });
  drawText(ctx, DIFFICULTIES[difficulty].note, W / 2, 646, { size: 16, color: '#ffd9a0', align: 'center', weight: 700, outline: 2 });
  const b = START_BUTTON;
  const hover = hit && hit.type === 'start';
  const pulse = 0.5 + 0.5 * Math.sin(time * 4);
  ctx.save();
  ctx.shadowColor = '#ffb347';
  ctx.shadowBlur = 18 + pulse * 22;
  const grad = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
  grad.addColorStop(0, hover ? '#ffe27a' : '#ffc23a');
  grad.addColorStop(1, hover ? '#ff9a2a' : '#e8780f');
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.w, b.h, 18);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#fff3c0';
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.w, b.h, 18);
  ctx.stroke();
  drawText(ctx, 'CLICK TO START', b.x + b.w / 2, b.y + 56, { size: 48, color: '#1a0c00', align: 'center', outline: 0 });
  drawText(ctx, 'attract mode: the game is playing itself  -  [H] how to play', W / 2, 778, { size: 14, color: P.muted, align: 'center', outline: 0 });
}
