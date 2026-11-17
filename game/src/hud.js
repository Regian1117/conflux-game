// The always-visible interface. Top bar: rift counter, the incoming creature queue (with a NEXT
// line) and, during the boss fight, the Colossus's health and plate order; Core health at the
// right. Right panel: the four brushes with essence, score and chain, the live reaction grade and
// held boons. Bottom: a row of keycaps for the controls and the WIN / LOSE reminder.
import { CORE, FIELD, H, PALETTE as P, PLATES, REACT, RIFT_COUNT, W } from './config.js';
import { BRUSHES, ELEMENTS } from './elements.js';
import { KINDS } from './creatures.js';
import { drawCreatureSprite } from './sprites.js';
import { BOONS } from './boons.js';
import { chainMult, reactionGrade } from './score.js';
import { RIFT_PLANS, incomingSummary, upcoming } from './rifts.js';
import { NODE_TYPES } from './path.js';
import { drawBar, drawPanel, drawText, formatNumber } from './draw.js';
import { isMuted } from './audio.js';
import { GLYPH_COLORS, drawFiligree, drawGlyph, drawGlyphTile } from './glyphs.js';

const BRUSH_GLYPHS = ['fire', 'water', 'earth', 'storm'];
const GRADE_COLORS = { S: '#ffd24a', A: '#6dffb0', B: '#22c3ff', C: '#ff9a5a' };

export const PANEL_X = 1044;
export const PANEL_W = 224;
/** The top bar's middle region (queue, and the boss panel during the boss fight). */
const MID_X = 236;
const MID_W = PANEL_X - 10 - MID_X;
/** Clickable brush cards, so the mouse can pick a brush as well as keys 1-4. */
export const BRUSH_CARDS = BRUSHES.map((_, i) => ({ x: PANEL_X, y: 84 + i * 62, w: PANEL_W, h: 56 }));

const BRUSH_HINTS = [
  'with WATER: steam. with EARTH: lava',
  'with STORM: shock. with FIRE: steam',
  'with FIRE: lava. with STORM: magnet',
  'with WATER: shock. with STEAM: cloud',
];

export function brushCardAt(x, y) {
  return BRUSH_CARDS.findIndex((c) => x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h);
}

function drawRiftBlock(ctx, game) {
  drawPanel(ctx, 12, 8, 214, 68);
  const number = Math.min(RIFT_COUNT, game.phase === 'prep' ? game.riftNum + 1 : Math.max(1, game.riftNum));
  drawText(ctx, `RIFT ${number}/${RIFT_COUNT}`, 24, 42, { size: 34, color: '#ffd9a0' });
  const node = game.node && game.phase !== 'path' ? NODE_TYPES[game.node.type] : null;
  drawText(ctx, node ? node.name : RIFT_PLANS[number - 1].title, 24, 62, { size: 12, color: node ? node.color : P.muted, weight: 700, outline: 0 });
  const rift = game.rift;
  const left = rift ? rift.total - rift.next + game.creatures.length : 0;
  const ratio = rift && game.phase !== 'prep' ? 1 - left / rift.total : 0;
  drawBar(ctx, 24, 68, 190, 5, game.riftNum === 0 ? 0 : ratio, '#ffb347');
}

/** The creature queue panel at (x, w): icons with counts and gates, and the NEXT line. */
function drawQueue(ctx, game, time, x0, w) {
  drawPanel(ctx, x0, 8, w, 68);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0 + 2, 8, w - 4, 68);
  ctx.clip();
  drawText(ctx, 'INCOMING', x0 + 12, 26, { size: 13, color: P.muted, outline: 0 });
  const groups = upcoming(game, Math.max(1, Math.floor((w - 24) / 166)));
  let x = x0 + 12;
  if (groups.length === 0) {
    drawText(ctx, game.phase === 'clear' || game.phase === 'boon' || game.phase === 'won' ? 'rift cleared' : game.rift && !game.rift.done ? 'all creatures are out - finish them!' : 'last creatures on the field', x, 46, { size: 16, color: P.muted, outline: 0 });
  }
  for (const g of groups) {
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.beginPath();
    ctx.roundRect(x - 4, 29, 158, 30, 7);
    ctx.fill();
    drawCreatureSprite(ctx, g.kind, x + 16, 46, g.kind === 'colossus' ? 9 : 13, 0, {});
    drawText(ctx, `x${g.count}`, x + 40, 52, { size: 22, color: '#ffffff' });
    drawText(ctx, g.gate, x + 84, 51, { size: 14, color: '#ffc27a' });
    x += 166;
  }
  const next = groups[0];
  let line;
  if (game.phase === 'prep') line = `RIFT ${game.riftNum + 1} OPENS IN ${Math.ceil(game.prepTimer)}s - paint! [SPACE] open now`;
  else if (next && w < 420) line = `NEXT ${next.count}x ${KINDS[next.kind].name} - ${next.gate} ${Math.ceil(next.seconds)}s`;
  else if (next) line = `NEXT: ${next.count} ${next.count > 1 ? KINDS[next.kind].plural : KINDS[next.kind].name} from ${next.gate} in ${Math.ceil(next.seconds)}s`;
  else if (game.phase === 'won') line = 'ALL RIFTS SEALED';
  else if (game.phase === 'clear' || game.phase === 'boon') line = `RIFT ${game.riftNum} SEALED - well done!`;
  else line = 'finish the last creatures';
  const pulse = game.phase === 'prep' && Math.floor(time * 2) % 2 === 0;
  drawText(ctx, line, x0 + 12, 71, { size: 16, color: pulse ? '#ffffff' : '#ffd9a0', outline: 3 });
  ctx.restore();
}

/** The Colossus's health and plate order, in the top bar beside the rift counter. */
function drawBossPanel(ctx, boss, time, x, w) {
  drawPanel(ctx, x, 8, w, 68, { fill: 'rgba(10,6,20,0.92)', edge: '#a65cff' });
  drawText(ctx, 'HOLLOW COLOSSUS', x + 12, 28, { size: 16, color: '#c58aff' });
  drawBar(ctx, x + 170, 13, w - 182, 14, boss.hp / boss.maxHp, '#c0486a');
  if (boss.exposed > 0) drawText(ctx, `EXPOSED! ${Math.ceil(boss.exposed)}s`, x + 170 + (w - 182) / 2, 25, { size: 15, color: '#ffe9a8', align: 'center' });
  const chipW = (w - 24 - 3 * 6) / 4;
  PLATES.forEach((plate, i) => {
    const cx = x + 12 + i * (chipW + 6);
    const broken = i < boss.plates || boss.exposed > 0;
    const current = i === boss.plates && boss.exposed <= 0;
    ctx.fillStyle = broken ? '#1d3a2c' : current ? plate.color : '#1a1f2c';
    ctx.globalAlpha = current ? 0.8 + Math.sin(time * 8) * 0.2 : 1;
    ctx.beginPath();
    ctx.roundRect(cx, 36, chipW, 32, 6);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = broken ? P.good : plate.color;
    ctx.lineWidth = current ? 3 : 1.5;
    ctx.stroke();
    drawText(ctx, `${i + 1} ${plate.need}`, cx + chipW / 2, 50, { size: 13, color: broken ? P.good : current ? '#05060a' : plate.color, align: 'center', outline: current ? 0 : 2 });
    drawText(ctx, broken ? 'BROKEN' : plate.hint, cx + chipW / 2, 63, { size: 9.5, color: broken ? P.good : current ? '#05060a' : P.muted, align: 'center', outline: 0, weight: 700 });
  });
}

function drawCoreBlock(ctx, game) {
  drawPanel(ctx, PANEL_X, 8, PANEL_W, 68, { edge: game.core.hitFlash > 0 ? P.danger : '#2f6f7a' });
  drawText(ctx, 'CORE CRYSTAL', PANEL_X + 12, 28, { size: 14, color: P.core, outline: 0 });
  const ratio = game.core.hp / CORE.maxHp;
  drawBar(ctx, PANEL_X + 12, 36, PANEL_W - 24, 24, ratio, ratio > 0.4 ? '#33d4e6' : P.danger);
  if (game.core.shield > 0) drawBar(ctx, PANEL_X + 12, 36, PANEL_W - 24, 7, game.core.shield / Math.max(40, game.mods.shieldMax), '#e6faff', 'rgba(0,0,0,0)');
  drawText(ctx, `${Math.ceil(game.core.hp)} / ${CORE.maxHp}`, PANEL_X + PANEL_W / 2, 56, { size: 19, align: 'center' });
  if (game.core.shield > 0) drawText(ctx, `SHIELD ${Math.ceil(game.core.shield)}`, PANEL_X + PANEL_W - 12, 28, { size: 12, color: '#bfefff', align: 'right', outline: 2 });
  drawText(ctx, game.core.hp <= 30 ? 'CRITICAL!' : '', PANEL_X + PANEL_W - 12, 73, { size: 11, color: P.danger, align: 'right', outline: 0 });
}

function drawBrushCards(ctx, game, time) {
  BRUSHES.forEach((id, i) => {
    const card = BRUSH_CARDS[i];
    const el = ELEMENTS[id];
    const selected = game.brush === i;
    const empty = game.emptyFlash[i] > 0;
    drawPanel(ctx, card.x, card.y, card.w, card.h, { fill: selected ? '#171c2a' : P.panel, edge: selected ? el.color : P.panelEdge, lineWidth: selected ? 4 : 2 });
    if (selected) {
      ctx.globalAlpha = 0.14 + Math.sin(time * 5) * 0.04;
      ctx.fillStyle = el.color;
      ctx.beginPath();
      ctx.roundRect(card.x, card.y, card.w, card.h, 10);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = el.color;
    ctx.beginPath();
    ctx.roundRect(card.x + 10, card.y + 9, 36, 36, 8);
    ctx.fill();
    drawText(ctx, String(i + 1), card.x + 28, card.y + 36, { size: 26, color: '#05060a', align: 'center', outline: 0 });
    drawText(ctx, el.name, card.x + 56, card.y + 25, { size: 20, color: el.color });
    drawGlyph(ctx, BRUSH_GLYPHS[i], card.x + card.w - 24, card.y + 21, 12, el.color, 3);
    const essence = game.essence[i];
    const ratio = essence / game.mods.essenceMax;
    drawBar(ctx, card.x + 56, card.y + 31, 114, 10, ratio, empty && Math.floor(time * 12) % 2 === 0 ? P.danger : el.color);
    drawText(ctx, String(Math.floor(essence)), card.x + card.w - 10, card.y + 41, { size: 14, align: 'right', color: '#ffffff' });
    drawText(ctx, BRUSH_HINTS[i], card.x + 10, card.y + 53, { size: 10, color: P.muted, weight: 700, outline: 0 });
  });
}

function drawScoreBlock(ctx, game, bests) {
  const y = 336;
  drawPanel(ctx, PANEL_X, y, PANEL_W, 100);
  drawText(ctx, 'SCORE', PANEL_X + 12, y + 18, { size: 12, color: P.muted, outline: 0 });
  drawText(ctx, formatNumber(game.score), PANEL_X + 12, y + 46, { size: 29, color: P.gold });
  drawText(ctx, `BEST ${formatNumber(Math.max(bests.score, game.score))}`, PANEL_X + PANEL_W - 12, y + 18, { size: 12, color: P.muted, align: 'right', outline: 0 });
  const chain = game.chain.count;
  const hot = chain >= 5;
  drawText(ctx, chain > 0 ? `CHAIN x${chain}` : 'CHAIN -', PANEL_X + 12, y + 77, { size: 26, color: chain > 0 ? (hot ? '#ffe23a' : '#ffffff') : P.muted });
  if (chain > 0) {
    drawText(ctx, `score x${chainMult(chain).toFixed(1)}`, PANEL_X + PANEL_W - 12, y + 60, { size: 12, color: '#ffd9a0', align: 'right', outline: 0 });
    drawBar(ctx, PANEL_X + 12, y + 86, PANEL_W - 24, 5, game.chain.timer / REACT.chainWindow, '#ffe23a');
  }
  drawText(ctx, `BEST x${Math.max(game.chain.best, bests.chain)}`, PANEL_X + PANEL_W - 12, y + 77, { size: 13, color: '#ffd9a0', align: 'right', outline: 2 });
}

/** The live reaction grade, under SCORE / CHAIN: a letter and the combo count. */
function drawGradeBlock(ctx, game) {
  const y = 440;
  const count = game.chain.count;
  const grade = count >= 2 ? reactionGrade(count) : null;
  const color = grade ? GRADE_COLORS[grade] : P.muted;
  drawPanel(ctx, PANEL_X, y, PANEL_W, 50, { edge: grade ? color : P.panelEdge, lineWidth: grade ? 3 : 2 });
  drawText(ctx, 'REACTION GRADE', PANEL_X + 12, y + 19, { size: 11, color: P.muted, outline: 0 });
  drawText(ctx, grade ? `x${count} combo` : 'no combo', PANEL_X + 12, y + 41, { size: 17, color: grade ? '#ffffff' : P.muted });
  drawText(ctx, grade ?? '-', PANEL_X + PANEL_W - 36, y + 42, { size: 38, color, align: 'center' });
}

/** What each creature is weak to, drawn as the weakness glyph in the threat queue. */
const WEAKNESS = { imp: 'water', golem: 'frost', wraith: 'storm', beetle: 'fire', swarm: 'water', ram: 'lava' };

/**
 * The full threat queue: every creature kind still to come or already out this rift, with a 28 px
 * icon, its name, how many, which side it comes from and its weakness glyph, and the NEXT line.
 * It is built from the live rift state, so it changes as creatures spawn and die.
 */
function drawThreatQueue(ctx, game) {
  const y = 496;
  const h = 212;
  const number = Math.min(RIFT_COUNT, game.phase === 'prep' ? game.riftNum + 1 : Math.max(1, game.riftNum));
  drawPanel(ctx, PANEL_X, y, PANEL_W, h, { edge: '#d4aa55', lineWidth: 3 });
  drawText(ctx, `INCOMING - RIFT ${number}`, PANEL_X + PANEL_W / 2, y + 22, { size: 16, color: '#ffd24a', align: 'center' });
  const rows = incomingSummary(game, 6);
  if (rows.length === 0) drawText(ctx, game.phase === 'rift' ? 'all creatures are out' : 'rift cleared', PANEL_X + PANEL_W / 2, y + 80, { size: 15, color: P.muted, align: 'center', outline: 0 });
  rows.forEach((row, i) => {
    const ry = y + 30 + i * 26;
    const kind = KINDS[row.kind];
    ctx.save();
    ctx.beginPath();
    ctx.rect(PANEL_X + 6, ry, 36, 26);
    ctx.clip();
    drawCreatureSprite(ctx, row.kind, PANEL_X + 24, ry + 13, row.kind === 'swarm' ? 9 : 10, 0, {});
    ctx.restore();
    drawText(ctx, kind.name, PANEL_X + 42, ry + 18, { size: 12.5, color: '#ffffff', weight: 800, outline: 2 });
    drawText(ctx, `x${row.count}`, PANEL_X + 158, ry + 19, { size: 16, color: '#ffd24a', align: 'right' });
    drawText(ctx, row.gate, PANEL_X + 163, ry + 17, { size: 10.5, color: '#ffc27a', weight: 800, outline: 2 });
    drawGlyph(ctx, WEAKNESS[row.kind], PANEL_X + PANEL_W - 11, ry + 13, 6, GLYPH_COLORS[WEAKNESS[row.kind]], 2.4);
  });
  const next = upcoming(game, 1)[0];
  const line = game.phase === 'prep' && next ? `NEXT: ${next.count} ${KINDS[next.kind].name} from ${next.gate} in ${Math.ceil(next.seconds + game.prepTimer)}s` : next ? `NEXT: ${next.count} ${KINDS[next.kind].name} from ${next.gate} in ${Math.ceil(next.seconds)}s` : 'no more creatures to spawn';
  ctx.font = '800 100px sans-serif';
  const fit = Math.min(12.5, ((PANEL_W - 16) / ctx.measureText(line).width) * 100);
  drawText(ctx, line, PANEL_X + PANEL_W / 2, y + h - 9, { size: fit, color: '#ffd9a0', align: 'center', outline: 2 });
}

function drawBoonList(ctx, game) {
  const y = 712;
  drawPanel(ctx, PANEL_X, y, PANEL_W, 36);
  const held = BOONS.filter((b) => game.boons[b.id]);
  if (held.length === 0) drawText(ctx, 'boons: pick 1 of 3 after each rift', PANEL_X + 10, y + 23, { size: 11.5, color: P.muted, weight: 700, outline: 0 });
  held.slice(0, 7).forEach((b, i) => drawGlyphTile(ctx, b.glyph, PANEL_X + 20 + i * 29, y + 18, 25, b.color));
}

function drawTip(ctx, game) {
  if (!game.tip) return;
  const a = Math.min(1, game.tip.timer);
  const x = FIELD.x + FIELD.w - 700 - 8;
  ctx.globalAlpha = a;
  drawPanel(ctx, x, FIELD.y + 8, 700, 36, { fill: 'rgba(8,10,16,0.88)', edge: '#ffd24a' });
  drawCreatureSprite(ctx, game.tip.kind, x + 28, FIELD.y + 26, 10, 0, {});
  drawText(ctx, game.tip.text, x + 350, FIELD.y + 33, { size: 15, color: '#ffe9a8', align: 'center' });
  ctx.globalAlpha = 1;
}

/** The goal banner under the rift counter: how to win (green) and how to lose (red). */
function drawGoalBanner(ctx) {
  const x = FIELD.x + 4;
  const y = FIELD.y + 4;
  ctx.beginPath();
  ctx.roundRect(x, y, 372, 54, 8);
  ctx.fillStyle = 'rgba(4,5,8,0.93)';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#d4aa55';
  ctx.stroke();
  drawText(ctx, 'WIN: seal 7 rifts + slay the Colossus', x + 186, y + 23, { size: 19, color: P.good, align: 'center', weight: 900, outline: 3 });
  drawText(ctx, 'LOSE: the Core shatters', x + 186, y + 46, { size: 19, color: '#ff5a6a', align: 'center', weight: 900, outline: 3 });
}

/** Gold filigree corners over every HUD panel. */
function drawFrames(ctx, game) {
  const midW = game.boss ? 720 - MID_X - 0 : MID_W;
  const frames = [[12, 8, 214, 68], [MID_X, 8, game.boss ? 480 : midW, 68], [PANEL_X, 8, PANEL_W, 68], ...BRUSH_CARDS.map((c) => [c.x, c.y, c.w, c.h]), [PANEL_X, 336, PANEL_W, 100], [PANEL_X, 440, PANEL_W, 50], [PANEL_X, 496, PANEL_W, 212], [PANEL_X, 712, PANEL_W, 36]];
  if (game.boss) frames.push([726, 8, MID_X + MID_W - 726, 68]);
  for (const [x, y, w, h] of frames) drawFiligree(ctx, x + 1, y + 1, w - 2, h - 2);
}

/** One drawn keycap with its label at (x, y); returns the x where the next item may start. */
function keycap(ctx, label, x, y, w) {
  const h = 30;
  ctx.beginPath();
  ctx.roundRect(x, y + 3, w, h, 7);
  ctx.fillStyle = '#05060a';
  ctx.fill();
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, '#3a4258');
  grad.addColorStop(1, '#1f2536');
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 7);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#aab4cc';
  ctx.stroke();
  drawText(ctx, label, x + w / 2, y + 21, { size: 16, align: 'center', outline: 0 });
  return x + w + 6;
}

/** The control bar along the bottom: keycaps with their actions, and the WIN / LOSE reminder. */
export function drawKeyBar(ctx) {
  const y = H - 42;
  ctx.fillStyle = 'rgba(5,6,10,0.85)';
  ctx.fillRect(0, H - 48, W, 48);
  let x = 14;
  const group = (keys, label) => {
    for (const k of keys) x = keycap(ctx, k, x, y, k.length > 2 ? 18 + k.length * 10 : 32);
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
  drawRiftBlock(ctx, game);
  if (game.boss) {
    drawBossPanel(ctx, game.boss, time, MID_X, 480);
    drawQueue(ctx, game, time, 726, MID_X + MID_W - 726);
  } else drawQueue(ctx, game, time, MID_X, MID_W);
  drawCoreBlock(ctx, game);
  drawBrushCards(ctx, game, time);
  drawScoreBlock(ctx, game, bests);
  drawGradeBlock(ctx, game);
  drawThreatQueue(ctx, game);
  drawBoonList(ctx, game);
  drawGoalBanner(ctx);
  drawTip(ctx, game);
  drawFrames(ctx, game);
  drawKeyBar(ctx);
}
