// The in-game interface as thin translucent overlays at the screen edges, over a full-bleed field.
// Top strip: rift counter, the goal, the boss bar with its plate order (or the incoming creatures),
// Core health and score, with the threat queue as one row of six creature icons with counts (the
// boons are shown on the Rift Path screen). Bottom strip: the spell bar (four element slots with glyph, keycap, essence
// bar, recipe and effect word), the chain / grade badge and the control keys.
import { CORE, H, PALETTE as P, PLATES, REACT, RIFT_COUNT, W } from './config.js';
import { BRUSHES, ELEMENTS } from './elements.js';
import { KINDS } from './creatures.js';
import { drawCreatureSprite } from './sprites.js';
import { chainMult, reactionGrade } from './score.js';
import { RIFT_PLANS, incomingSummary, upcoming } from './rifts.js';
import { NODE_TYPES } from './path.js';
import { drawBar, drawText, formatNumber } from './draw.js';
import { isMuted } from './audio.js';
import { drawGlyph } from './glyphs.js';

const BRUSH_GLYPHS = ['fire', 'water', 'earth', 'storm'];
const GRADE_COLORS = { S: '#ffd24a', A: '#6dffb0', B: '#22c3ff', C: '#ff9a5a' };
const GOLD_LINE = 'rgba(212,170,85,0.75)';
const PLATE = 'rgba(6,8,14,0.55)';

const TOP_H = 46;
const BAR_Y = 736;
const STRIP_Y = 728;

/** Clickable brush cards, so the mouse can pick a brush as well as keys 1-4. */
export const BRUSH_CARDS = BRUSHES.map((_, i) => ({ x: 12 + i * 212, y: BAR_Y, w: 204, h: 58 }));

/** Recipe and effect word for each element slot (the words live here, not in the playfield). */
const BRUSH_HINTS = ['+WATER = STEAM slows', '+STORM = SHOCK chains', '+FIRE = LAVA burns', '+WATER = CHARGE zaps'];

export function brushCardAt(x, y) {
  return BRUSH_CARDS.findIndex((c) => x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h);
}

/** True where the pointer is over a HUD overlay, so a click there never paints the field. */
export function overHud(x, y) {
  return y < TOP_H || y >= STRIP_Y;
}

/** A thin dark translucent plate with a fine gold line. */
function plate(ctx, x, y, w, h, edge = GOLD_LINE, radius = 8) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fillStyle = PLATE;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = edge;
  ctx.stroke();
}

function drawRiftBlock(ctx, game) {
  const number = Math.min(RIFT_COUNT, game.phase === 'prep' ? game.riftNum + 1 : Math.max(1, game.riftNum));
  drawText(ctx, `RIFT ${number}/${RIFT_COUNT}`, 14, 25, { size: 24, color: '#ffd9a0' });
  const node = game.node && game.phase !== 'path' ? NODE_TYPES[game.node.type] : null;
  drawText(ctx, node ? node.name : RIFT_PLANS[number - 1].title, 14, 40, { size: 10, color: node ? node.color : P.muted, weight: 700, outline: 0 });
  const rift = game.rift;
  const left = rift ? rift.total - rift.next + game.creatures.length : 0;
  const ratio = rift && game.phase !== 'prep' ? 1 - left / rift.total : 0;
  drawBar(ctx, 0, 43, W, 3, game.riftNum === 0 ? 0 : ratio, '#ffb347', 'rgba(0,0,0,0)');
}

function drawGoal(ctx) {
  drawText(ctx, 'WIN: seal 7 rifts + slay the Colossus', 140, 19, { size: 13, color: P.good, weight: 900, outline: 3 });
  drawText(ctx, 'LOSE: the Core shatters', 140, 38, { size: 13, color: '#ff5a6a', weight: 900, outline: 3 });
}

/** The threat queue as one row of up to six icons with counts, in the top strip. */
function drawThreatRow(ctx, game, x0) {
  const rows = incomingSummary(game, 6);
  if (rows.length === 0) {
    drawText(ctx, game.phase === 'rift' ? 'all creatures out' : 'rift cleared', x0, 29, { size: 13, color: P.muted, outline: 0 });
    return;
  }
  rows.forEach((row, i) => {
    const x = x0 + i * 50;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, 6, 48, 34);
    ctx.clip();
    drawCreatureSprite(ctx, row.kind, x + 13, 23, row.kind === 'swarm' ? 7 : 9, 0, {});
    ctx.restore();
    drawText(ctx, `x${row.count}`, x + 25, 30, { size: 14, color: '#ffd24a' });
  });
}

/** The next wave, in the top strip (when no boss is out). */
function drawNextLine(ctx, game, x0) {
  const next = upcoming(game, 1)[0];
  const secs = next ? Math.ceil(next.seconds + (game.phase === 'prep' ? game.prepTimer : 0)) : 0;
  const line = next ? `NEXT ${next.count} ${KINDS[next.kind].name.split(' ').pop()} \u00b7 ${next.gate[0]} ${secs}s` : 'no more to spawn';
  drawText(ctx, line, x0, 29, { size: 13, color: '#ffd9a0', outline: 2 });
}

/** The Colossus's health and plate order. */
function drawBossStrip(ctx, boss, time, x, w) {
  drawText(ctx, 'HOLLOW COLOSSUS', x, 15, { size: 12, color: '#c58aff' });
  drawBar(ctx, x + 124, 5, w - 124, 10, boss.hp / boss.maxHp, '#c0486a');
  if (boss.exposed > 0) drawText(ctx, `EXPOSED! ${Math.ceil(boss.exposed)}s`, x + 124 + (w - 124) / 2, 14, { size: 10.5, color: '#ffe9a8', align: 'center', outline: 2 });
  const chipW = (w - 3 * 5) / 4;
  PLATES.forEach((plate, i) => {
    const cx = x + i * (chipW + 5);
    const broken = i < boss.plates || boss.exposed > 0;
    const current = i === boss.plates && boss.exposed <= 0;
    ctx.fillStyle = broken ? '#1d3a2c' : current ? plate.color : 'rgba(26,31,44,0.85)';
    ctx.globalAlpha = current ? 0.8 + Math.sin(time * 8) * 0.2 : 1;
    ctx.beginPath();
    ctx.roundRect(cx, 19, chipW, 22, 5);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = broken ? P.good : plate.color;
    ctx.lineWidth = current ? 2.5 : 1.2;
    ctx.stroke();
    drawText(ctx, `${i + 1} ${plate.need}`, cx + chipW / 2, 34, { size: 10, color: broken ? P.good : current ? '#05060a' : plate.color, align: 'center', outline: current ? 0 : 2 });
  });
}

function drawCoreStrip(ctx, game) {
  const x = 1026;
  const w = 112;
  drawText(ctx, 'CORE', x, 13, { size: 11, color: P.core, outline: 0 });
  if (game.core.shield > 0) drawText(ctx, `SHIELD ${Math.ceil(game.core.shield)}`, x + w, 13, { size: 10, color: '#bfefff', align: 'right', outline: 2 });
  const ratio = game.core.hp / CORE.maxHp;
  drawBar(ctx, x, 18, w, 18, ratio, ratio > 0.4 ? '#33d4e6' : P.danger);
  if (game.core.shield > 0) drawBar(ctx, x, 18, w, 5, game.core.shield / Math.max(40, game.mods.shieldMax), '#e6faff', 'rgba(0,0,0,0)');
  drawText(ctx, `${Math.ceil(game.core.hp)} / ${CORE.maxHp}`, x + w / 2, 33, { size: 14, align: 'center' });
}

function drawScoreStrip(ctx, game, bests) {
  drawText(ctx, `BEST ${formatNumber(Math.max(bests.score, game.score))}`, W - 12, 12, { size: 10, color: P.muted, align: 'right', outline: 0 });
  drawText(ctx, formatNumber(game.score), W - 12, 36, { size: 24, color: P.gold, align: 'right' });
}

function drawTopStrip(ctx, game, bests, time) {
  ctx.fillStyle = PLATE;
  ctx.fillRect(0, 0, W, TOP_H);
  ctx.fillStyle = GOLD_LINE;
  ctx.fillRect(0, TOP_H - 1, W, 1);
  drawRiftBlock(ctx, game);
  drawGoal(ctx);
  drawThreatRow(ctx, game, 402);
  if (game.boss) drawBossStrip(ctx, game.boss, time, 712, 300);
  else drawNextLine(ctx, game, 712);
  drawCoreStrip(ctx, game);
  drawScoreStrip(ctx, game, bests);
}

/** One element slot: keycap, glyph medallion, name, essence bar and number, recipe + effect word. */
function drawBrushSlots(ctx, game, time) {
  BRUSHES.forEach((id, i) => {
    const c = BRUSH_CARDS[i];
    const el = ELEMENTS[id];
    const selected = game.brush === i;
    const empty = game.emptyFlash[i] > 0;
    ctx.save();
    if (selected) {
      ctx.shadowColor = el.color;
      ctx.shadowBlur = 14;
    }
    ctx.beginPath();
    ctx.roundRect(c.x, c.y, c.w, c.h, 9);
    ctx.fillStyle = selected ? 'rgba(36,44,68,0.78)' : PLATE;
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = selected ? 3 : 1;
    ctx.strokeStyle = selected ? el.color : GOLD_LINE;
    ctx.beginPath();
    ctx.roundRect(c.x, c.y, c.w, c.h, 9);
    ctx.stroke();
    if (selected) {
      ctx.globalAlpha = 0.1 + Math.sin(time * 5) * 0.04;
      ctx.fillStyle = el.color;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.beginPath();
    ctx.arc(c.x + 33, c.y + 30, 21, 0, 6.283);
    ctx.fillStyle = 'rgba(7,9,16,0.85)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = el.color;
    ctx.stroke();
    drawGlyph(ctx, BRUSH_GLYPHS[i], c.x + 33, c.y + 30, 14, el.color, 4);
    ctx.beginPath();
    ctx.roundRect(c.x + 4, c.y + 4, 17, 17, 4);
    ctx.fillStyle = '#2a3148';
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#aab4cc';
    ctx.stroke();
    drawText(ctx, String(i + 1), c.x + 12.5, c.y + 17, { size: 12, align: 'center', outline: 0 });
    drawText(ctx, el.name, c.x + 64, c.y + 21, { size: 16, color: el.color });
    drawText(ctx, String(Math.floor(game.essence[i])), c.x + c.w - 8, c.y + 20, { size: 13, align: 'right', color: '#ffffff' });
    drawBar(ctx, c.x + 64, c.y + 26, c.w - 74, 8, game.essence[i] / game.mods.essenceMax, empty && Math.floor(time * 12) % 2 === 0 ? P.danger : el.color);
    ctx.font = '800 100px sans-serif';
    const size = Math.min(12, ((c.w - 70) / ctx.measureText(BRUSH_HINTS[i]).width) * 100);
    drawText(ctx, BRUSH_HINTS[i], c.x + 64, c.y + 51, { size, color: '#ffd9a0', weight: 800, outline: 2 });
  });
}

/** The chain and reaction-grade badge. */
function drawComboBadge(ctx, game) {
  const x = 868;
  const w = 188;
  const y = BAR_Y;
  const count = game.chain.count;
  const grade = count >= 2 ? reactionGrade(count) : null;
  const color = grade ? GRADE_COLORS[grade] : P.muted;
  plate(ctx, x, y, w, 58, grade ? color : GOLD_LINE, 9);
  drawText(ctx, 'CHAIN', x + 10, y + 15, { size: 11, color: P.muted, outline: 0 });
  drawText(ctx, count > 0 ? `x${count}` : '-', x + 10, y + 45, { size: 30, color: count >= 5 ? '#ffe23a' : count > 0 ? '#ffffff' : P.muted });
  drawText(ctx, 'GRADE', x + w - 46, y + 15, { size: 11, color: P.muted, align: 'center', outline: 0 });
  drawText(ctx, grade ?? '-', x + w - 46, y + 48, { size: 40, color, align: 'center' });
  drawText(ctx, count > 0 ? `score x${chainMult(count).toFixed(1)}` : 'no combo', x + 10, y + 53, { size: 10, color: '#ffd9a0', outline: 0, weight: 800 });
  if (count > 0) drawBar(ctx, x + 6, y + 56, w - 100, 2, game.chain.timer / REACT.chainWindow, color, 'rgba(0,0,0,0)');
}

/** One drawn keycap; returns the x where the next item may start. */
function drawKeycap(ctx, label, x, y, w, h = 30) {
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, '#3a4258');
  grad.addColorStop(1, '#1f2536');
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 6);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#aab4cc';
  ctx.stroke();
  drawText(ctx, label, x + w / 2, y + h * 0.7, { size: h * 0.52, align: 'center', outline: 0 });
  return x + w + 6;
}

/** The bottom strip: spell bar, badge and control keys. */
export function drawToolBar(ctx, game, time) {
  ctx.fillStyle = PLATE;
  ctx.fillRect(0, STRIP_Y, W, H - STRIP_Y);
  ctx.fillStyle = GOLD_LINE;
  ctx.fillRect(0, STRIP_Y, W, 1);
  drawBrushSlots(ctx, game, time);
  drawComboBadge(ctx, game);
  let x = 1070;
  x = drawKeycap(ctx, 'SPACE', x, 738, 56, 24);
  drawText(ctx, 'open rift', x + 1, 756, { size: 12, color: '#dfe7ff', weight: 700, outline: 0 });
  x = 1070;
  const small = (key, label) => {
    x = drawKeycap(ctx, key, x, 768, 24, 24);
    drawText(ctx, label, x, 786, { size: 11, color: '#dfe7ff', weight: 700, outline: 0 });
    x += ctx.measureText(label).width + 8;
  };
  small('P', 'pause');
  small('M', isMuted() ? 'unmute' : 'mute');
  small('R', 'retry');
}

/** A one-line how-to above the spell bar: shown during the first rift's preparation. */
function drawHowTo(ctx, game) {
  if (!game.showHowTo && !(game.phase === 'prep' && game.riftNum === 0)) return;
  const text = 'Paint WATER, then STORM on it: the shock chains through every creature in the pool';
  ctx.font = '800 15px sans-serif';
  const w = ctx.measureText(text).width + 32;
  plate(ctx, (W - w) / 2, STRIP_Y - 34, w, 26, GOLD_LINE, 13);
  drawText(ctx, text, W / 2, STRIP_Y - 16, { size: 15, color: '#ffffff', align: 'center', weight: 800, outline: 2 });
}

/** The preparation countdown, under the top strip. */
function drawPrepLine(ctx, game, time) {
  if (game.phase !== 'prep') return;
  const text = `RIFT ${game.riftNum + 1} OPENS IN ${Math.ceil(game.prepTimer)}s · paint! [SPACE] open now`;
  ctx.font = '800 16px sans-serif';
  const w = ctx.measureText(text).width + 32;
  const y = game.tip ? 96 : 54;
  plate(ctx, (W - w) / 2, y, w, 28, GOLD_LINE, 14);
  drawText(ctx, text, W / 2, y + 20, { size: 16, color: Math.floor(time * 2) % 2 === 0 ? '#ffffff' : '#ffd9a0', align: 'center', outline: 3 });
}

function drawTip(ctx, game) {
  if (!game.tip) return;
  const a = Math.min(1, game.tip.timer);
  const x = (W - 700) / 2;
  ctx.globalAlpha = a;
  plate(ctx, x, 54, 700, 36, '#ffd24a');
  drawCreatureSprite(ctx, game.tip.kind, x + 28, 72, 10, 0, {});
  drawText(ctx, game.tip.text, x + 350, 79, { size: 15, color: '#ffe9a8', align: 'center' });
  ctx.globalAlpha = 1;
}

/** The control bar of the title screen: keycaps with their actions. */
export function drawKeyBar(ctx) {
  const y = H - 42;
  ctx.fillStyle = 'rgba(5,6,10,0.85)';
  ctx.fillRect(0, H - 48, W, 48);
  let x = 14;
  const group = (keys, label) => {
    for (const k of keys) x = drawKeycap(ctx, k, x, y, k.length > 2 ? 18 + k.length * 10 : 32);
    drawText(ctx, label, x + 2, y + 22, { size: 15, color: '#dfe7ff', weight: 700, outline: 0 });
    x += ctx.measureText(label).width + 22;
  };
  group(['1', '2', '3', '4'], 'brush');
  group(['MOUSE'], 'paint');
  group(['SPACE'], 'open rift');
  group(['P'], 'pause');
  group(['M'], isMuted() ? 'unmute' : 'mute');
  group(['R'], 'restart');
}

/** Paint the full HUD. `bests` = { score, chain } saved records. */
export function drawHud(ctx, game, bests, time) {
  drawTopStrip(ctx, game, bests, time);
  drawPrepLine(ctx, game, time);
  drawTip(ctx, game);
  drawHowTo(ctx, game);
  drawToolBar(ctx, game, time);
}
