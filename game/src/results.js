// The end-of-run results card: "CONFLUX MASTERED" with a grade, or "THE CORE SHATTERS" with the
// rift reached, over its own backdrop (the shattered Colossus, or the broken Core) instead of a
// dimmed game. Both share one card layout: big title, score, a stat grid and a play-again button.
import { DIFFICULTIES, FONT, H, PALETTE as P, PLATES, RIFT_COUNT, W } from './config.js';
import { drawColossus } from './colossus.js';
import { drawText, formatNumber } from './draw.js';
import { gradeFor } from './score.js';

/** The play-again button (also the click target). */
export const AGAIN_BUTTON = { x: 410, y: 676, w: 460, h: 74 };

const GRADE_COLORS = { S: '#ffd24a', A: '#6dffb0', B: '#22c3ff', C: '#ff9a5a' };

function confetti(ctx, time) {
  const colors = ['#ffd24a', '#ff5a1f', '#22c3ff', '#a65cff', '#6dffb0', '#ffffff'];
  for (let k = 0; k < 110; k += 1) {
    const x = ((k * 7919) % W) + Math.sin(time * 1.5 + k) * 18;
    const y = ((time * (50 + (k % 5) * 14) + k * 61) % (H + 40)) - 20;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(time * (1 + (k % 4)) + k);
    ctx.fillStyle = colors[k % colors.length];
    ctx.fillRect(-4, -2, 8, 4);
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'lighter';
  for (let f = 0; f < 5; f += 1) {
    const phase = (time * 0.55 + f * 0.21) % 1;
    const cx = 130 + f * 255;
    const cy = 140 + (f % 3) * 60;
    for (let k = 0; k < 18; k += 1) {
      const a = (k / 18) * 6.283;
      ctx.globalAlpha = 1 - phase;
      ctx.fillStyle = colors[(k + f) % colors.length];
      ctx.fillRect(cx + Math.cos(a) * phase * 90 - 2, cy + Math.sin(a) * phase * 90 + phase * phase * 30 - 2, 4, 4);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

/** Backdrop for a win: the shattered Colossus, lit gold, under rising beams and confetti. */
function winBackdrop(ctx, time) {
  ctx.fillStyle = '#0a0b12';
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 10; k += 1) {
    const x = 60 + k * 128 + Math.sin(time + k) * 12;
    const beam = ctx.createLinearGradient(x, H, x, 0);
    beam.addColorStop(0, 'rgba(255,210,120,0.3)');
    beam.addColorStop(1, 'rgba(255,210,120,0)');
    ctx.fillStyle = beam;
    ctx.fillRect(x - 26, 0, 52, H);
  }
  const halo = ctx.createRadialGradient(W / 2, 430, 20, W / 2, 430, 520);
  halo.addColorStop(0, 'rgba(255,190,90,0.6)');
  halo.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.translate(W / 2, 470);
  drawColossus(ctx, 175, time, { ruin: true, plates: 4 });
  ctx.restore();
  for (let k = 0; k < 22; k += 1) {
    const x = 40 + ((k * 331) % 1200);
    const y = 600 + ((k * 97) % 160);
    ctx.fillStyle = PLATES[k % 4].color;
    ctx.beginPath();
    ctx.moveTo(x, y - 12);
    ctx.lineTo(x + 17, y + 8);
    ctx.lineTo(x - 12, y + 10);
    ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.28;
    ctx.fillRect(x - 18, y - 18, 36, 36);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  confetti(ctx, time);
}

/** Backdrop for a loss: the Core Crystal in pieces under a red glow. */
function loseBackdrop(ctx, time) {
  ctx.fillStyle = '#0a0508';
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(W / 2, 400, 20, W / 2, 400, 560);
  glow.addColorStop(0, 'rgba(255,50,70,0.5)');
  glow.addColorStop(1, 'rgba(120,0,20,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  for (let k = 0; k < 26; k += 1) {
    const a = (k / 26) * 6.283 + k;
    const d = 140 + ((k * 53) % 300) + Math.sin(time * 0.6 + k) * 8;
    const x = W / 2 + Math.cos(a) * d * 1.6;
    const y = 420 + Math.sin(a) * d * 0.9 + ((time * 14 + k * 20) % 40);
    const s = 26 + ((k * 37) % 50);
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

function statBox(ctx, x, y, label, value, color) {
  ctx.beginPath();
  ctx.roundRect(x, y, 236, 92, 12);
  ctx.fillStyle = 'rgba(14,18,30,0.9)';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  drawText(ctx, label, x + 118, y + 26, { size: 14, color: P.muted, align: 'center', outline: 0 });
  drawText(ctx, value, x + 118, y + 70, { size: 36, color, align: 'center' });
}

/**
 * Paint the whole results screen (it replaces the game view). `won` picks the words, the
 * backdrop and the grade; `bests` holds the records from before this run.
 */
export function drawResults(ctx, game, bests, won, time) {
  if (won) winBackdrop(ctx, time);
  else loseBackdrop(ctx, time);
  const accent = won ? '#ffd24a' : '#ff4a5e';
  ctx.beginPath();
  ctx.roundRect(150, 46, 980, 716, 26);
  ctx.fillStyle = 'rgba(7,9,16,0.64)';
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = accent;
  ctx.stroke();
  const stats = game.stats;
  const title = won ? 'CONFLUX MASTERED' : 'THE CORE SHATTERS';
  drawText(ctx, title, W / 2, 142, { size: 80, color: accent, align: 'center' });
  drawText(ctx, won ? `All ${RIFT_COUNT} rifts sealed. The Hollow Colossus is hollow no more.` : `The rifts broke through on rift ${Math.max(1, game.riftNum)} of ${RIFT_COUNT}.`, W / 2, 186, { size: 22, color: '#dfe7ff', align: 'center', outline: 2 });

  // Grade (or the rift reached) in a big medallion on the left, score on the right.
  const label = won ? gradeFor(game) : `${Math.max(1, game.riftNum)}/${RIFT_COUNT}`;
  const medal = won ? GRADE_COLORS[label] : '#ff7a8a';
  ctx.beginPath();
  ctx.arc(330, 322, 84, 0, 6.283);
  ctx.fillStyle = 'rgba(10,12,20,0.95)';
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = medal;
  ctx.stroke();
  drawText(ctx, label, 330, 322 + (won ? 38 : 20), { size: won ? 110 : 56, color: medal, align: 'center' });
  drawText(ctx, won ? 'GRADE' : 'RIFT REACHED', 330, 440, { size: 16, color: P.muted, align: 'center', outline: 0 });
  drawText(ctx, 'SCORE', 760, 262, { size: 18, color: P.muted, align: 'center', outline: 0 });
  drawText(ctx, formatNumber(game.score), 760, 340, { size: 78, color: '#ffe9a8', align: 'center' });
  const best = Math.max(bests.score, game.score);
  const isBest = game.score >= bests.score && game.score > 0;
  drawText(ctx, isBest ? 'NEW BEST SCORE!' : `BEST ${formatNumber(best)}`, 760, 384, { size: 24, color: isBest ? '#6dffb0' : '#dfe7ff', align: 'center' });
  if (won) drawText(ctx, `BEST ${formatNumber(best)}`, 760, 416, { size: 17, color: P.muted, align: 'center', outline: 0 });

  const diff = DIFFICULTIES[game.difficulty ?? 1].name;
  const chainRecord = Math.max(bests.chain, stats.bestChain);
  const boxes = [
    ['BEST CHAIN', `x${stats.bestChain}`, '#ffe23a'],
    ['RIFTS CLEARED', `${stats.riftsCleared ?? 0}/${RIFT_COUNT}`, '#6dffb0'],
    ['DIFFICULTY', diff, '#c58aff'],
    ['CREATURES DISSOLVED', formatNumber(stats.kills), '#ff9a5a'],
    ['REACTIONS TRIGGERED', formatNumber(stats.reactions), '#22c3ff'],
    [won ? 'CORE HEALTH LEFT' : 'CHAIN RECORD', won ? `${Math.ceil(game.core.hp)}%` : `x${chainRecord}`, won ? '#6ff0ff' : '#ffe23a'],
  ];
  boxes.forEach((b, i) => statBox(ctx, 214 + (i % 3) * 256, 462 + Math.floor(i / 3) * 106, b[0], b[1], b[2]));
  if (!won && game.stats.bestChain >= bests.chain && game.stats.bestChain > 0) drawText(ctx, 'NEW CHAIN RECORD!', W / 2, 452, { size: 18, color: '#6dffb0', align: 'center' });

  const b = AGAIN_BUTTON;
  const pulse = 0.5 + 0.5 * Math.sin(time * 4);
  ctx.save();
  ctx.shadowColor = accent;
  ctx.shadowBlur = 14 + pulse * 18;
  const grad = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
  grad.addColorStop(0, won ? '#ffd24a' : '#ff6a7a');
  grad.addColorStop(1, won ? '#e8780f' : '#c4203a');
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.w, b.h, 16);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.w, b.h, 16);
  ctx.stroke();
  ctx.font = `900 40px ${FONT}`;
  drawText(ctx, won ? 'Play again (R)' : 'Try again (R)', b.x + b.w / 2, b.y + 52, { size: 40, color: '#1a0c00', align: 'center', outline: 0 });
}
