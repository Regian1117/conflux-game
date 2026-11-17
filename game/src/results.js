// The end-of-run results screen, filling the whole frame: "CONFLUX MASTERED" with a grade
// medallion, or "THE CORE SHATTERS" with the rift reached. It has its own backdrop (the shattered
// Colossus lit by rim light with gold rising, or the broken Core under a red glow), large stat
// tiles, a bar chart of the reactions used and PLAY AGAIN / TITLE buttons.
import { DIFFICULTIES, FONT, H, PALETTE as P, PLATES, RIFT_COUNT, W } from './config.js';
import { drawColossus } from './colossus.js';
import { drawText, formatNumber } from './draw.js';
import { drawFiligree, drawGlyph, GLYPH_COLORS } from './glyphs.js';
import { gradeFor } from './score.js';

/** The two buttons (also click targets). */
export const AGAIN_BUTTON = { x: 250, y: 706, w: 470, h: 76 };
export const TITLE_BUTTON = { x: 750, y: 706, w: 280, h: 76 };

const GRADE_COLORS = { S: '#ffd24a', A: '#6dffb0', B: '#22c3ff', C: '#ff9a5a' };

/** Gold motes rising through the frame, and confetti: positions come from the clock only. */
function risingGold(ctx, time, count) {
  ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < count; k += 1) {
    const x = ((k * 7919) % W) + Math.sin(time * 1.2 + k) * 14;
    const y = H - ((time * (30 + (k % 6) * 12) + k * 83) % (H + 40)) + 20;
    ctx.globalAlpha = 0.55 + 0.4 * Math.sin(time * 3 + k);
    ctx.fillStyle = k % 3 ? '#ffd24a' : '#fff2c0';
    const s = 2 + (k % 3);
    ctx.fillRect(x, y, s, s * 2);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

/** Backdrop for a win: the shattered Colossus, rim lit, its broken plates scattered, gold rising. */
function winBackdrop(ctx, time) {
  ctx.fillStyle = '#0a0b12';
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 10; k += 1) {
    const x = 60 + k * 128 + Math.sin(time + k) * 12;
    const beam = ctx.createLinearGradient(x, H, x, 0);
    beam.addColorStop(0, 'rgba(255,210,120,0.32)');
    beam.addColorStop(1, 'rgba(255,210,120,0)');
    ctx.fillStyle = beam;
    ctx.fillRect(x - 26, 0, 52, H);
  }
  const halo = ctx.createRadialGradient(W / 2, 430, 20, W / 2, 430, 560);
  halo.addColorStop(0, 'rgba(255,190,90,0.7)');
  halo.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.translate(W / 2, 470);
  drawColossus(ctx, 168, time, { ruin: true, plates: 4 });
  ctx.restore();
  for (let k = 0; k < 26; k += 1) {
    const x = 30 + ((k * 331) % 1220);
    const y = 560 + ((k * 97) % 200);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(k);
    ctx.fillStyle = PLATES[k % 4].color;
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(19, 9);
    ctx.lineTo(-13, 11);
    ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.3;
    ctx.fillRect(-20, -20, 40, 40);
    ctx.restore();
  }
  risingGold(ctx, time, 140);
}

/** Backdrop for a loss: the Core Crystal in pieces under a red glow. */
function loseBackdrop(ctx, time) {
  ctx.fillStyle = '#0a0508';
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(W / 2, 420, 20, W / 2, 420, 620);
  glow.addColorStop(0, 'rgba(255,50,70,0.55)');
  glow.addColorStop(1, 'rgba(120,0,20,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  for (let k = 0; k < 34; k += 1) {
    const a = (k / 34) * 6.283 + k;
    const d = 160 + ((k * 53) % 380) + Math.sin(time * 0.6 + k) * 8;
    const x = W / 2 + Math.cos(a) * d * 1.7;
    const y = 430 + Math.sin(a) * d * 0.95 + ((time * 14 + k * 20) % 40);
    const s = 30 + ((k * 37) % 60);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a * 2 + time * 0.2);
    ctx.fillStyle = k % 3 ? '#2aa8c8' : '#9ff8ff';
    ctx.strokeStyle = '#05060a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s * 0.45, s * 0.2);
    ctx.lineTo(-s * 0.3, s * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function panel(ctx, x, y, w, h, color) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 14);
  ctx.fillStyle = 'rgba(8,10,18,0.74)';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = color;
  ctx.stroke();
  drawFiligree(ctx, x + 2, y + 2, w - 4, h - 4);
}

function statTile(ctx, x, y, label, value, color) {
  panel(ctx, x, y, 290, 88, color);
  drawText(ctx, label, x + 145, y + 26, { size: 15, color: '#c9d2e8', align: 'center', outline: 0 });
  drawText(ctx, value, x + 145, y + 72, { size: 42, color, align: 'center' });
}

/** The ornate grade medallion: gold rings, rays and the grade (or the rift reached). */
function medallion(ctx, cx, cy, label, color, grade, time) {
  ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(cx, cy, 30, cx, cy, 190);
  glow.addColorStop(0, `${color}88`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - 200, cy - 200, 400, 400);
  ctx.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(time * 0.15);
  ctx.strokeStyle = '#d4aa55';
  ctx.lineWidth = 3;
  for (let k = 0; k < 24; k += 1) {
    const a = (k / 24) * 6.283;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 126, Math.sin(a) * 126);
    ctx.lineTo(Math.cos(a) * (k % 2 ? 140 : 152), Math.sin(a) * (k % 2 ? 140 : 152));
    ctx.stroke();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, 118, 0, 6.283);
  ctx.fillStyle = 'rgba(8,10,18,0.92)';
  ctx.fill();
  ctx.lineWidth = 9;
  ctx.strokeStyle = '#d4aa55';
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, 104, 0, 6.283);
  ctx.stroke();
  ['fire', 'water', 'earth', 'storm'].forEach((kind, k) => {
    const a = -Math.PI / 2 + (k / 4) * 6.283;
    drawGlyph(ctx, kind, cx + Math.cos(a) * 86, cy + Math.sin(a) * 86, 9, GLYPH_COLORS[kind], 2.5);
  });
  drawText(ctx, label, cx, cy + (grade ? 62 : 24), { size: grade ? 170 : 78, color, align: 'center' });
}

/** Horizontal bars of how often each reaction fired, in its element colour. */
function reactionChart(ctx, stats, x, y, w, h, accent) {
  panel(ctx, x, y, w, h, accent);
  drawText(ctx, 'REACTIONS USED', x + 24, y + 38, { size: 24, color: '#ffffff' });
  const by = stats.byReaction;
  const rows = [
    ['steam', 'STEAM', (by.STEAM ?? 0) + (by.QUENCH ?? 0)],
    ['lava', 'LAVA', by.LAVA ?? 0],
    ['shock', 'SHOCK', by.SHOCK ?? 0],
    ['ice', 'ICE', (by.FROST ?? 0) + (by.SHATTER ?? 0)],
    ['magnet', 'MAGNET', by.MAGNET ?? 0],
    ['cloud', 'STORMCLOUD', (by.STORMSTEAM ?? 0) + (by.STRIKE ?? 0)],
  ];
  const max = Math.max(1, ...rows.map((r) => r[2]));
  rows.forEach(([kind, name, count], i) => {
    const ry = y + 62 + i * 38;
    const color = GLYPH_COLORS[kind];
    drawGlyph(ctx, kind, x + 38, ry + 14, 12, color, 3);
    drawText(ctx, name, x + 62, ry + 21, { size: 15, color: '#e6ecff', outline: 2 });
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x + 176, ry + 4, w - 290, 22);
    ctx.fillStyle = color;
    ctx.fillRect(x + 176, ry + 4, Math.max(count > 0 ? 6 : 0, ((w - 290) * count) / max), 22);
    drawText(ctx, formatNumber(count), x + w - 20, ry + 23, { size: 20, color: '#ffffff', align: 'right' });
  });
}

function button(ctx, b, label, top, bottom, accent, time) {
  const pulse = 0.5 + 0.5 * Math.sin(time * 4);
  ctx.save();
  ctx.shadowColor = accent;
  ctx.shadowBlur = 12 + pulse * 16;
  const grad = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.w, b.h, 18);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = '#fff3c0';
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.w, b.h, 18);
  ctx.stroke();
  ctx.font = `900 46px ${FONT}`;
  drawText(ctx, label, b.x + b.w / 2, b.y + 54, { size: 46, color: '#1a0c00', align: 'center', outline: 0 });
}

const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

/** Paint the whole results screen (it replaces the game view). `bests` = records from before this run. */
export function drawResults(ctx, game, bests, won, time) {
  if (won) winBackdrop(ctx, time);
  else loseBackdrop(ctx, time);
  const accent = won ? '#ffd24a' : '#ff4a5e';
  const stats = game.stats;
  drawText(ctx, won ? 'CONFLUX MASTERED' : 'THE CORE SHATTERS', W / 2, 122, { size: 116, color: accent, align: 'center' });
  drawText(ctx, won ? `All ${RIFT_COUNT} rifts sealed. The Hollow Colossus is hollow no more.` : `The rifts broke through on rift ${Math.max(1, game.riftNum)} of ${RIFT_COUNT}.`, W / 2, 166, { size: 24, color: '#ffffff', align: 'center' });

  const grade = won ? gradeFor(game) : null;
  const label = won ? grade : `${Math.max(1, game.riftNum)}/${RIFT_COUNT}`;
  const medal = won ? GRADE_COLORS[grade] : '#ff7a8a';
  medallion(ctx, 200, 340, label, medal, Boolean(won), time);
  drawText(ctx, won ? 'GRADE' : 'RIFT REACHED', 200, 492, { size: 20, color: '#ffffff', align: 'center' });

  panel(ctx, 380, 190, 330, 260, accent);
  drawText(ctx, 'SCORE', 545, 232, { size: 20, color: '#c9d2e8', align: 'center', outline: 0 });
  drawText(ctx, formatNumber(game.score), 545, 320, { size: 76, color: '#ffe9a8', align: 'center' });
  const best = Math.max(bests.score, game.score);
  const isBest = game.score >= bests.score && game.score > 0;
  drawText(ctx, isBest ? 'NEW BEST SCORE!' : 'BEST SCORE', 545, 366, { size: 26, color: isBest ? '#6dffb0' : '#ffffff', align: 'center' });
  drawText(ctx, formatNumber(best), 545, 412, { size: 40, color: '#ffffff', align: 'center' });
  reactionChart(ctx, stats, 730, 190, 510, 280, accent);

  const diff = DIFFICULTIES[game.difficulty ?? 1].name;
  const tiles = [
    ['BEST CHAIN', `x${stats.bestChain}`, '#ffe23a'],
    ['RIFTS CLEARED', `${stats.riftsCleared ?? 0}/${RIFT_COUNT}`, '#6dffb0'],
    ['CREATURES DISSOLVED', formatNumber(stats.kills), '#ff9a5a'],
    ['REACTIONS TRIGGERED', formatNumber(stats.reactions), '#22c3ff'],
    ['DIFFICULTY', diff, '#c58aff'],
    ['TIME', formatTime(game.t), '#ffffff'],
    [won ? 'CORE HEALTH LEFT' : 'CHAIN RECORD', won ? `${Math.ceil(game.core.hp)}%` : `x${Math.max(bests.chain, stats.bestChain)}`, '#6ff0ff'],
    ['CORE HITS TAKEN', String(stats.coreHits), '#ff7a8a'],
  ];
  tiles.forEach((t, i) => statTile(ctx, 30 + (i % 4) * 310, 506 + Math.floor(i / 4) * 100, t[0], t[1], t[2]));

  button(ctx, AGAIN_BUTTON, won ? 'PLAY AGAIN (R)' : 'TRY AGAIN (R)', won ? '#ffd24a' : '#ff6a7a', won ? '#e8780f' : '#c4203a', accent, time);
  button(ctx, TITLE_BUTTON, 'TITLE (T)', '#9ad4ff', '#4a7fd0', '#6aa8ff', time);
}
