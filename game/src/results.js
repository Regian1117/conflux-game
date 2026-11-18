// The end-of-run results screen, filling the whole frame: "CONFLUX MASTERED" with a grade
// medallion, or "THE CORE SHATTERS" with the rift reached. It has its own backdrop (the shattered
// Colossus lit by rim light with gold rising, or the broken Core under a red glow), large stat
// tiles, a bar chart of the reactions used and PLAY AGAIN / TITLE buttons.
import { DIFFICULTIES, FONT, H, PALETTE as P, PLATES, RIFT_COUNT, THEME, W } from './config.js';
import { drawColossus } from './colossus.js';
import { drawText, formatNumber } from './draw.js';
import { drawFiligree, drawGlyph, GLYPH_COLORS } from './glyphs.js';
import { gradeFor } from './score.js';
import { routeSummary } from './path.js';
import { FEATS, OMENS } from './omens.js';
import { KILLER_TIPS } from './history.js';
import { KINDS } from './creatures.js';
import { drawCreatureSprite } from './sprites.js';

/** The three buttons (also click targets), relative to the current-run card. */
const BUTTONS = {
  again: { x: 28, y: 604, w: 268, h: 72 },
  seed: { x: 306, y: 604, w: 256, h: 72 },
  title: { x: 572, y: 604, w: 180, h: 72 },
};

/** The card is centred when there is no other run to show beside it. */
export function resultsOffset(game, won) {
  return otherRun(game, won) ? 0 : 260;
}

/** Button rectangles in canvas pixels for this results screen. */
export function resultsButtons(game, won) {
  const dx = resultsOffset(game, won);
  const out = {};
  for (const [name, r] of Object.entries(BUTTONS)) out[name] = { ...r, x: r.x + dx };
  return out;
}

/** The most recent earlier run with the other outcome (loss beside a win, win beside a loss). */
function otherRun(game, won) {
  return (game.history ?? []).slice(1).find((run) => run.won !== won) ?? null;
}

const GRADE_COLORS = { S: '#ffd24a', A: '#6dffb0', B: '#22c3ff', C: '#ff9a5a' };

/** Gold motes rising through the frame, and confetti: positions come from the clock only. */
function drawRisingGold(ctx, time, count) {
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

/** Soft golden rays fanning out from (x, y), slowly turning: wedges that fade with distance. */
function drawRadialRays(ctx, x, y, time, count, length) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < count; k += 1) {
    const a = time * 0.08 + (k / count) * 6.283;
    const width = 0.05 + 0.03 * Math.sin(k * 3.1);
    const grad = ctx.createRadialGradient(x, y, 20, x, y, length);
    grad.addColorStop(0, 'rgba(255,214,120,0.42)');
    grad.addColorStop(1, 'rgba(255,170,60,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, length, a - width, a + width);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** A broken armour plate lying on the floor: an angular slab with a glowing edge. */
function fallenPlate(ctx, x, y, angle, scale, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.moveTo(-46, -10);
  ctx.lineTo(-18, -26);
  ctx.lineTo(34, -18);
  ctx.lineTo(48, 8);
  ctx.lineTo(10, 26);
  ctx.lineTo(-38, 16);
  ctx.closePath();
  ctx.fillStyle = '#2a2d3c';
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#05060a';
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.85;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.16;
  ctx.fill();
  ctx.restore();
}

/** Backdrop for a win: the Colossus fallen on its back, cracked and lit gold from its chest, plates scattered. */
function winBackdrop(ctx, time) {
  const ground = ctx.createLinearGradient(0, 0, 0, H);
  ground.addColorStop(0, THEME.bright ? '#EFE3C6' : '#0a0b12');
  ground.addColorStop(1, THEME.bright ? '#D8C49C' : '#15121a');
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, W, H);
  const chestX = W / 2 - 80;
  const chestY = 470;
  ctx.globalCompositeOperation = 'lighter';
  const halo = ctx.createRadialGradient(chestX, chestY, 10, chestX, chestY, 620);
  halo.addColorStop(0, 'rgba(255,200,110,0.75)');
  halo.addColorStop(0.35, 'rgba(255,140,50,0.3)');
  halo.addColorStop(1, 'rgba(255,100,30,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.ellipse(W / 2 + 40, 690, 520, 70, 0, 0, 6.283);
  ctx.fill();
  drawRadialRays(ctx, chestX, chestY, time, 22, 760);
  ctx.save();
  ctx.translate(W / 2 + 40, 520);
  ctx.rotate(-Math.PI / 2 + 0.06);
  drawColossus(ctx, 150, time, { ruin: true, plates: 4 });
  ctx.restore();
  ctx.globalCompositeOperation = 'lighter';
  const chestGlow = ctx.createRadialGradient(chestX, chestY, 5, chestX, chestY, 150);
  chestGlow.addColorStop(0, 'rgba(255,230,150,0.8)');
  chestGlow.addColorStop(1, 'rgba(255,160,50,0)');
  ctx.fillStyle = chestGlow;
  ctx.fillRect(chestX - 160, chestY - 160, 320, 320);
  ctx.globalCompositeOperation = 'source-over';
  [[120, 640, 0.4, 0], [330, 735, -0.3, 1], [1090, 700, 0.6, 2], [940, 640, -0.5, 3], [60, 400, 1.2, 1], [1200, 330, -0.9, 0], [200, 250, 0.2, 2], [1120, 560, 0.1, 3]].forEach(([x, y, angle, k]) => fallenPlate(ctx, x, y, angle, 0.9, PLATES[k].color));
  drawRisingGold(ctx, time, 150);
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

function drawResultsPanel(ctx, x, y, w, h, color) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 14);
  ctx.fillStyle = 'rgba(8,10,18,0.42)';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = color;
  ctx.stroke();
  drawFiligree(ctx, x + 2, y + 2, w - 4, h - 4);
}

function drawStatTile(ctx, x, y, label, value, color, sub) {
  drawResultsPanel(ctx, x, y, 160, 90, color);
  drawText(ctx, label, x + 80, y + 24, { size: 12, color: '#c9d2e8', align: 'center', outline: 0 });
  drawText(ctx, value, x + 80, sub ? y + 61 : y + 68, { size: value.length > 8 ? 26 : 38, color, align: 'center' });
  if (sub) drawText(ctx, sub, x + 80, y + 81, { size: 13, color: '#c9d2e8', align: 'center', outline: 0, weight: 700 });
}

/** The feats earned this run (the rest dimmed). */
function featsPanel(ctx, game, won, x, y, w, h, accent) {
  drawResultsPanel(ctx, x, y, w, h, accent);
  const earned = FEATS.filter((f) => f.test(game, won)).length;
  drawText(ctx, 'FEATS', x + 20, y + 36, { size: 26, color: '#ffffff' });
  drawText(ctx, `${earned}/${FEATS.length} earned`, x + w - 18, y + 34, { size: 16, color: '#ffe9a8', align: 'right', outline: 0 });
  FEATS.forEach((f, i) => {
    const ry = y + 46 + i * ((h - 52) / 5);
    const ok = f.test(game, won);
    ctx.globalAlpha = ok ? 1 : 0.35;
    ctx.beginPath();
    ctx.arc(x + 32, ry + 15, 15, 0, 6.283);
    ctx.fillStyle = '#05070c';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = ok ? f.color : '#5a6480';
    ctx.stroke();
    drawGlyph(ctx, f.glyph, x + 32, ry + 15, 10, f.color, 2.5);
    drawText(ctx, f.name, x + 58, ry + 14, { size: 17, color: ok ? f.color : '#8f98ad' });
    drawText(ctx, f.desc, x + 58, ry + 30, { size: 12, color: '#ffffff', weight: 700, outline: 0 });
    ctx.globalAlpha = 1;
    if (ok) {
      ctx.strokeStyle = '#6dffb0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + w - 38, ry + 15);
      ctx.lineTo(x + w - 32, ry + 22);
      ctx.lineTo(x + w - 20, ry + 7);
      ctx.stroke();
    }
  });
}

/** The ornate grade medallion: gold rings, rays and the grade (or the rift reached). */
function drawGradeMedallion(ctx, cx, cy, label, color, grade, time) {
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
  const rowGap = (h - 64) / 6;
  drawResultsPanel(ctx, x, y, w, h, accent);
  drawText(ctx, 'REACTIONS USED', x + 20, y + 36, { size: 22, color: '#ffffff' });
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
    const ry = y + 48 + i * rowGap;
    const color = GLYPH_COLORS[kind];
    drawGlyph(ctx, kind, x + 30, ry + 14, 11, color, 3);
    drawText(ctx, name, x + 50, ry + 20, { size: 14, color: '#e6ecff', outline: 2 });
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x + 152, ry + 4, w - 222, 20);
    ctx.fillStyle = color;
    ctx.fillRect(x + 152, ry + 4, Math.max(count > 0 ? 6 : 0, ((w - 222) * count) / max), 20);
    drawText(ctx, formatNumber(count), x + w - 14, ry + 21, { size: 17, color: '#ffffff', align: 'right' });
  });
}

function drawResultsButton(ctx, b, label, top, bottom, accent, time, size = 30) {
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
  ctx.font = `900 ${size}px ${FONT}`;
  drawText(ctx, label, b.x + b.w / 2, b.y + b.h / 2 + size * 0.36, { size, color: '#1a0c00', align: 'center', outline: 0 });
}

const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

/** A dark, cracked Core Crystal (lost run) or a bright whole one (won run), centred at cx, cy. */
function drawCoreIllustration(ctx, cx, cy, s, broken, time) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(0, 0, 10, 0, 0, 150);
  glow.addColorStop(0, broken ? 'rgba(255,40,60,0.5)' : 'rgba(255,230,160,0.6)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-160, -160, 320, 320);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.ellipse(0, 96, 80, 16, 0, 0, 6.283);
  ctx.fill();
  const body = ctx.createLinearGradient(-50, -90, 50, 90);
  body.addColorStop(0, broken ? '#3a4658' : '#e6fbff');
  body.addColorStop(1, broken ? '#0c1018' : '#3fb8d8');
  ctx.beginPath();
  ctx.moveTo(0, -96);
  ctx.lineTo(52, -20);
  ctx.lineTo(34, 70);
  ctx.lineTo(0, 92);
  ctx.lineTo(-34, 70);
  ctx.lineTo(-52, -20);
  ctx.closePath();
  ctx.fillStyle = body;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#05060a';
  ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = broken ? '#5b6a82' : '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -96);
  ctx.lineTo(0, 92);
  ctx.moveTo(-52, -20);
  ctx.lineTo(52, -20);
  ctx.stroke();
  if (broken) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [w, alpha] of [[9, 0.3], [3.2, 0.95]]) {
      ctx.lineWidth = w;
      ctx.strokeStyle = `rgba(255,70,90,${alpha * (0.8 + 0.2 * Math.sin(time * 3))})`;
      ctx.beginPath();
      ctx.moveTo(-6, -92);
      ctx.lineTo(8, -50);
      ctx.lineTo(-10, -12);
      ctx.lineTo(12, 26);
      ctx.lineTo(-2, 88);
      ctx.moveTo(8, -50);
      ctx.lineTo(40, -30);
      ctx.moveTo(-10, -12);
      ctx.lineTo(-40, 6);
      ctx.moveTo(12, 26);
      ctx.lineTo(34, 52);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#1a202c';
    ctx.strokeStyle = '#05060a';
    ctx.lineWidth = 3;
    for (const [x, y, r] of [[-78, 80, 14], [74, 86, 11], [58, 66, 8], [-56, 92, 8]]) {
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y + r * 0.6);
      ctx.lineTo(x - r, y + r * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** The "LAST RUN" card: the most recent run with the other outcome. */
function drawLastRunCard(ctx, run, x, y, w, h, time) {
  const lost = !run.won;
  const color = lost ? '#ff4a5e' : '#ffd24a';
  const cx = x + w / 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 18);
  ctx.fillStyle = lost ? 'rgba(20,4,10,0.86)' : 'rgba(18,14,4,0.86)';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = color;
  ctx.stroke();
  drawFiligree(ctx, x + 3, y + 3, w - 6, h - 6);
  drawText(ctx, `LAST RUN  \u00b7  Run ${run.n}`, cx, y + 44, { size: 26, color: '#ffffff', align: 'center' });
  drawText(ctx, lost ? 'THE CORE' : 'CONFLUX', cx, y + 118, { size: 78, color, align: 'center' });
  drawText(ctx, lost ? 'SHATTERS' : 'MASTERED', cx, y + 190, { size: 78, color, align: 'center' });
  drawCoreIllustration(ctx, cx, y + 322, 1.0, lost, time);
  drawText(ctx, lost ? `Fell at Rift ${run.rift}  \u00b7  Grade ${run.grade}  \u00b7  ${formatNumber(run.score)}` : `All 7 rifts sealed  \u00b7  Grade ${run.grade}  \u00b7  ${formatNumber(run.score)}`, cx, y + 462, { size: 24, color: '#ffffff', align: 'center' });
  if (lost && run.killer && KINDS[run.killer]) {
    drawCreatureSprite(ctx, run.killer, x + 62, y + 520, 17, 0, {});
    drawText(ctx, `Overrun by ${KINDS[run.killer].plural}`, x + 96, y + 530, { size: 29, color: '#ff8a7a' });
    drawText(ctx, KILLER_TIPS[run.killer] ?? '', cx, y + 596, { size: 19, color: '#ffe9a8', align: 'center', outline: 2 });
  } else {
    drawText(ctx, lost ? 'Overrun before the seventh rift' : 'The Hollow Colossus is hollow no more', cx, y + 530, { size: 24, color: '#ff8a7a', align: 'center' });
  }
}

/** Paint the whole results screen (it replaces the game view). `bests` = records from before this run. */
export function drawResults(ctx, game, bests, won, time) {
  if (won) winBackdrop(ctx, time);
  else loseBackdrop(ctx, time);
  const accent = won ? '#ffd24a' : '#ff4a5e';
  const stats = game.stats;
  const other = otherRun(game, won);
  if (other) drawLastRunCard(ctx, other, 776, 14, 488, 686, time);
  const dx = resultsOffset(game, won);
  ctx.save();
  ctx.translate(dx, 0);
  ctx.beginPath();
  ctx.roundRect(14, 14, 750, 686, 18);
  ctx.fillStyle = 'rgba(6,8,14,0.74)';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = accent;
  ctx.stroke();
  drawText(ctx, won ? 'CONFLUX MASTERED' : 'THE CORE SHATTERS', 389, 92, { size: 68, color: accent, align: 'center' });
  drawText(ctx, won ? `All ${RIFT_COUNT} rifts sealed. The Hollow Colossus is hollow no more.` : `The rifts broke through on rift ${Math.max(1, game.riftNum)} of ${RIFT_COUNT}.`, 389, 122, { size: 19, color: '#ffffff', align: 'center' });
  const route = game.route.length > 0 ? routeSummary(game.map, game.route) : 'none';
  drawText(ctx, `Path: ${route}  -  Seed ${game.seed}`, 389, 148, { size: 16, color: '#ffe9a8', align: 'center' });
  const grade = won ? gradeFor(game) : null;
  const label = won ? grade : `${Math.max(1, game.riftNum)}/${RIFT_COUNT}`;
  const medal = won ? GRADE_COLORS[grade] : '#ff7a8a';
  ctx.save();
  ctx.translate(112, 272);
  ctx.scale(0.62, 0.62);
  drawGradeMedallion(ctx, 0, 0, label, medal, Boolean(won), time);
  ctx.restore();
  drawText(ctx, won ? 'GRADE' : 'RIFT REACHED', 112, 376, { size: 17, color: '#ffffff', align: 'center' });

  drawResultsPanel(ctx, 206, 160, 214, 218, accent);
  drawText(ctx, 'SCORE', 313, 190, { size: 17, color: '#c9d2e8', align: 'center', outline: 0 });
  drawText(ctx, formatNumber(game.score), 313, 252, { size: 48, color: '#ffe9a8', align: 'center' });
  const isBest = game.score >= bests.score && game.score > 0;
  drawText(ctx, bests.score > 0 ? `previous best ${formatNumber(bests.score)}` : 'first run on record', 313, 280, { size: 14, color: '#c9d2e8', align: 'center', outline: 0, weight: 700 });
  const omen = OMENS[game.omen ?? 0];
  const diff = DIFFICULTIES[game.difficulty ?? 1].name;
  drawGlyph(ctx, omen.glyph, 232, 326, 12, omen.color, 3);
  drawText(ctx, omen.name, 252, 323, { size: 16, color: omen.color });
  drawText(ctx, `${diff} difficulty`, 252, 348, { size: 14, color: '#ffffff', outline: 0, weight: 800 });
  if (isBest) {
    ctx.save();
    ctx.translate(394, 182);
    ctx.rotate(0.6);
    ctx.fillStyle = '#2a9a5a';
    ctx.fillRect(-46, -11, 92, 22);
    ctx.strokeStyle = '#baffd0';
    ctx.lineWidth = 2;
    ctx.strokeRect(-46, -11, 92, 22);
    drawText(ctx, 'NEW BEST', 0, 5, { size: 13, color: '#ffffff', align: 'center', outline: 0 });
    ctx.restore();
  }
  featsPanel(ctx, game, won, 432, 160, 322, 218, accent);

  reactionChart(ctx, stats, 26, 388, 392, 190, accent);
  const tiles = [
    ['BEST CHAIN', `x${stats.bestChain}`, '#ffe23a'],
    ['CREATURES', formatNumber(stats.kills), '#ff9a5a'],
    ['TIME', formatTime(game.t), '#ffffff'],
    [won ? 'CORE LEFT' : 'CHAIN RECORD', won ? `${Math.ceil(game.core.hp)}%` : `x${Math.max(bests.chain, stats.bestChain)}`, '#6ff0ff'],
  ];
  tiles.forEach((t, i) => drawStatTile(ctx, 430 + (i % 2) * 168, 388 + Math.floor(i / 2) * 98, t[0], t[1], t[2], t[3]));

  drawResultsButton(ctx, BUTTONS.again, won ? 'PLAY AGAIN (R)' : 'TRY AGAIN (R)', won ? '#ffd24a' : '#ff6a7a', won ? '#e8780f' : '#c4203a', accent, time);
  drawResultsButton(ctx, BUTTONS.seed, 'SAME SEED (S)', '#8dffc0', '#1f9a5a', '#6dffb0', time);
  drawResultsButton(ctx, BUTTONS.title, 'TITLE (T)', '#9ad4ff', '#4a7fd0', '#6aa8ff', time);
  ctx.restore();
}
