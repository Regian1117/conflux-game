// The always-visible interface. Top bar: rift counter, the incoming creature queue (with a NEXT
// line) and, during the boss fight, the Colossus's health and plate order; Core health at the
// right. Right panel: score, the threat queue with behaviour notes, and the boons held. Bottom: the
// spell bar, with the four element slots, the chain and reaction-grade badge and the control keys.
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
const BAR_Y = 692;
export const BRUSH_CARDS = BRUSHES.map((_, i) => ({ x: 12 + i * 204, y: BAR_Y, w: 196, h: 104 }));

/** Two-word reaction hints, one per element slot. */
const BRUSH_HINTS = ['+WATER = STEAM', '+STORM = SHOCK', '+FIRE = LAVA', '+WATER = CHARGED'];

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

/** The big element slots of the bottom bar: glyph, keycap, name, essence bar and a reaction hint. */
function drawBrushSlots(ctx, game, time) {
  BRUSHES.forEach((id, i) => {
    const c = BRUSH_CARDS[i];
    const el = ELEMENTS[id];
    const selected = game.brush === i;
    const empty = game.emptyFlash[i] > 0;
    ctx.save();
    if (selected) {
      ctx.shadowColor = el.color;
      ctx.shadowBlur = 18;
    }
    const body = ctx.createLinearGradient(0, c.y, 0, c.y + c.h);
    body.addColorStop(0, selected ? '#232c44' : '#161b2b');
    body.addColorStop(1, '#0a0d16');
    ctx.beginPath();
    ctx.roundRect(c.x, c.y, c.w, c.h, 12);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = selected ? 5 : 2.5;
    ctx.strokeStyle = selected ? el.color : '#3a4258';
    ctx.beginPath();
    ctx.roundRect(c.x, c.y, c.w, c.h, 12);
    ctx.stroke();
    if (selected) {
      ctx.globalAlpha = 0.12 + Math.sin(time * 5) * 0.04;
      ctx.fillStyle = el.color;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // Keycap, big glyph in a medallion, name, essence bar and number, reaction hint.
    ctx.beginPath();
    ctx.roundRect(c.x + 8, c.y + 8, 26, 26, 6);
    ctx.fillStyle = '#2a3148';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#aab4cc';
    ctx.stroke();
    drawText(ctx, String(i + 1), c.x + 21, c.y + 28, { size: 18, align: 'center', outline: 0 });
    ctx.beginPath();
    ctx.arc(c.x + 52, c.y + 58, 28, 0, 6.283);
    ctx.fillStyle = '#070910';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = el.color;
    ctx.stroke();
    drawGlyph(ctx, BRUSH_GLYPHS[i], c.x + 52, c.y + 58, 19, el.color, 5);
    drawText(ctx, el.name, c.x + 92, c.y + 40, { size: 20, color: el.color });
    drawText(ctx, String(Math.floor(game.essence[i])), c.x + c.w - 10, c.y + 24, { size: 16, align: 'right', color: '#ffffff' });
    drawBar(ctx, c.x + 92, c.y + 47, c.w - 102, 12, game.essence[i] / game.mods.essenceMax, empty && Math.floor(time * 12) % 2 === 0 ? P.danger : el.color);
    drawText(ctx, BRUSH_HINTS[i], c.x + c.w / 2, c.y + 96, { size: 15, color: '#ffd9a0', align: 'center', weight: 800, outline: 2 });
  });
}

/** The chain and reaction-grade badge at the right end of the spell bar. */
function drawComboBadge(ctx, game) {
  const x = 836;
  const w = 204;
  const count = game.chain.count;
  const grade = count >= 2 ? reactionGrade(count) : null;
  const color = grade ? GRADE_COLORS[grade] : P.muted;
  drawPanel(ctx, x, BAR_Y, w, 104, { edge: grade ? color : P.panelEdge, lineWidth: grade ? 4 : 2 });
  drawText(ctx, 'CHAIN', x + 12, BAR_Y + 20, { size: 13, color: P.muted, outline: 0 });
  drawText(ctx, count > 0 ? `x${count}` : '-', x + 12, BAR_Y + 66, { size: 46, color: count >= 5 ? '#ffe23a' : count > 0 ? '#ffffff' : P.muted });
  drawText(ctx, 'GRADE', x + w - 52, BAR_Y + 20, { size: 13, color: P.muted, align: 'center', outline: 0 });
  drawText(ctx, grade ?? '-', x + w - 52, BAR_Y + 72, { size: 64, color, align: 'center' });
  drawText(ctx, count > 0 ? `score x${chainMult(count).toFixed(1)}` : 'no combo', x + 12, BAR_Y + 86, { size: 13, color: '#ffd9a0', outline: 0, weight: 800 });
  if (count > 0) drawBar(ctx, x + 12, BAR_Y + 92, w - 24, 6, game.chain.timer / REACT.chainWindow, color);
}

/** The bottom spell bar: element slots, chain badge and the compact control keys. */
export function drawToolBar(ctx, game, time) {
  ctx.fillStyle = 'rgba(5,6,10,0.9)';
  ctx.fillRect(0, BAR_Y - 6, W, H - BAR_Y + 6);
  drawBrushSlots(ctx, game, time);
  drawComboBadge(ctx, game);
  let x = 1052;
  const y = BAR_Y + 10;
  x = drawKeycap(ctx, 'SPACE', x, y, 66);
  drawText(ctx, 'open rift', x + 2, y + 22, { size: 13, color: '#dfe7ff', weight: 700, outline: 0 });
  x = 1052;
  const small = (key, label) => {
    x = drawKeycap(ctx, key, x, y + 48, 28);
    drawText(ctx, label, x + 1, y + 70, { size: 12, color: '#dfe7ff', weight: 700, outline: 0 });
    x += ctx.measureText(label).width + 10;
  };
  small('P', 'pause');
  small('M', isMuted() ? 'unmute' : 'mute');
  small('R', 'restart');
}

function drawScoreBlock(ctx, game, bests) {
  const y = 84;
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

/** What each creature is weak to (glyph) and how it behaves (one line), for the threat queue. */
const WEAKNESS = { imp: 'water', golem: 'frost', wraith: 'storm', beetle: 'fire', swarm: 'water', ram: 'lava' };
const BEHAVIOUR = { imp: 'fire-immune; water kills', golem: 'tanky; shatters when frozen', wraith: 'only STORM hurts it', beetle: 'explodes near storm', swarm: 'many; drown in water', ram: 'smashes earth walls' };

/**
 * The threat queue: every creature kind still to come or already out this rift, each with a 28 px
 * icon, name, count, side and weakness glyph, a behaviour note under it, and the NEXT line. It is
 * built from the live rift state, so it changes as creatures spawn and die.
 */
function drawThreatQueue(ctx, game) {
  const y = 192;
  const h = 312;
  const number = Math.min(RIFT_COUNT, game.phase === 'prep' ? game.riftNum + 1 : Math.max(1, game.riftNum));
  drawPanel(ctx, PANEL_X, y, PANEL_W, h, { edge: '#d4aa55', lineWidth: 3 });
  drawText(ctx, `THREAT QUEUE \u00b7 RIFT ${number}`, PANEL_X + PANEL_W / 2, y + 22, { size: 15, color: '#ffd24a', align: 'center' });
  const rows = incomingSummary(game, 6);
  if (rows.length === 0) drawText(ctx, game.phase === 'rift' ? 'all creatures are out' : 'rift cleared', PANEL_X + PANEL_W / 2, y + 100, { size: 15, color: P.muted, align: 'center', outline: 0 });
  rows.forEach((row, i) => {
    const ry = y + 30 + i * 43;
    const kind = KINDS[row.kind];
    ctx.save();
    ctx.beginPath();
    ctx.rect(PANEL_X + 6, ry, 36, 40);
    ctx.clip();
    drawCreatureSprite(ctx, row.kind, PANEL_X + 24, ry + 19, row.kind === 'swarm' ? 9 : 10, 0, {});
    ctx.restore();
    drawText(ctx, kind.name, PANEL_X + 44, ry + 16, { size: 12.5, color: '#ffffff', weight: 800, outline: 2 });
    drawText(ctx, `x${row.count}`, PANEL_X + 158, ry + 17, { size: 16, color: '#ffd24a', align: 'right' });
    drawText(ctx, row.gate, PANEL_X + 163, ry + 15, { size: 10.5, color: '#ffc27a', weight: 800, outline: 2 });
    drawGlyph(ctx, WEAKNESS[row.kind], PANEL_X + PANEL_W - 11, ry + 12, 6, GLYPH_COLORS[WEAKNESS[row.kind]], 2.4);
    drawText(ctx, BEHAVIOUR[row.kind], PANEL_X + 44, ry + 34, { size: 10.5, color: '#c9d2e8', weight: 700, outline: 0 });
  });
  const next = upcoming(game, 1)[0];
  const line = game.phase === 'prep' && next ? `NEXT: ${next.count} ${KINDS[next.kind].name} from ${next.gate} in ${Math.ceil(next.seconds + game.prepTimer)}s` : next ? `NEXT: ${next.count} ${KINDS[next.kind].name} from ${next.gate} in ${Math.ceil(next.seconds)}s` : 'no more creatures to spawn';
  ctx.font = '800 100px sans-serif';
  const fit = Math.min(12.5, ((PANEL_W - 16) / ctx.measureText(line).width) * 100);
  drawText(ctx, line, PANEL_X + PANEL_W / 2, y + h - 9, { size: fit, color: '#ffd9a0', align: 'center', outline: 2 });
}

/** The boons held, as glyph icons with their names. */
function drawBoonList(ctx, game) {
  const y = 512;
  const h = 172;
  drawPanel(ctx, PANEL_X, y, PANEL_W, h);
  drawText(ctx, 'BOONS HELD', PANEL_X + 12, y + 20, { size: 13, color: P.muted, outline: 0 });
  const held = BOONS.filter((b) => game.boons[b.id]);
  if (held.length === 0) drawText(ctx, 'pick 1 of 3 after each rift', PANEL_X + 12, y + 50, { size: 12, color: P.muted, weight: 700, outline: 0 });
  held.slice(0, 6).forEach((b, i) => {
    const row = y + 34 + i * 22;
    drawGlyphTile(ctx, b.glyph, PANEL_X + 22, row + 9, 20, b.color);
    drawText(ctx, `${b.name}${game.boons[b.id] > 1 ? ` x${game.boons[b.id]}` : ''}`, PANEL_X + 38, row + 14, { size: 13, color: '#ffffff', outline: 2 });
  });
}

/** A one-line how-to at the foot of the field: always on the cover, and during the first rift's preparation. */
function drawHowTo(ctx, game) {
  if (!game.showHowTo && !(game.phase === 'prep' && game.riftNum === 0)) return;
  const text = 'Paint WATER, then STORM on it: the shock chains through every creature in the pool';
  ctx.font = '800 100px sans-serif';
  const size = Math.min(17, ((FIELD.w - 80) / ctx.measureText(text).width) * 100);
  ctx.font = `800 ${size}px sans-serif`;
  const w = ctx.measureText(text).width + 34;
  const x = FIELD.x + (FIELD.w - w) / 2;
  const y = FIELD.y + FIELD.h - 36;
  ctx.beginPath();
  ctx.roundRect(x, y, w, 28, 8);
  ctx.fillStyle = 'rgba(4,5,8,0.92)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#d4aa55';
  ctx.stroke();
  drawText(ctx, text, x + w / 2, y + 20, { size, color: '#ffffff', align: 'center', weight: 800, outline: 2 });
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
  const mid = game.boss ? [[MID_X, 8, 480, 68], [726, 8, MID_X + MID_W - 726, 68]] : [[MID_X, 8, MID_W, 68]];
  const frames = [[12, 8, 214, 68], ...mid, [PANEL_X, 8, PANEL_W, 68], ...BRUSH_CARDS.map((c) => [c.x, c.y, c.w, c.h]), [836, BAR_Y, 204, 104], [PANEL_X, 84, PANEL_W, 100], [PANEL_X, 192, PANEL_W, 312], [PANEL_X, 512, PANEL_W, 172]];
  for (const [x, y, w, h] of frames) drawFiligree(ctx, x + 1, y + 1, w - 2, h - 2);
}

/** One drawn keycap with its label at (x, y); returns the x where the next item may start. */
function drawKeycap(ctx, label, x, y, w) {
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
  drawRiftBlock(ctx, game);
  if (game.boss) {
    drawBossPanel(ctx, game.boss, time, MID_X, 480);
    drawQueue(ctx, game, time, 726, MID_X + MID_W - 726);
  } else drawQueue(ctx, game, time, MID_X, MID_W);
  drawCoreBlock(ctx, game);
  drawScoreBlock(ctx, game, bests);
  drawThreatQueue(ctx, game);
  drawBoonList(ctx, game);
  drawGoalBanner(ctx);
  drawHowTo(ctx, game);
  drawToolBar(ctx, game, time);
  drawTip(ctx, game);
  drawFrames(ctx, game);
}
