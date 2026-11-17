// The always-visible interface: the rift counter and incoming creature queue (with a NEXT line)
// along the top, Core health, the four brushes with keys and essence, score and chain, held boons,
// the boss armour strip, a first-sighting tip and the WIN / LOSE reminder at the bottom.
import { CORE, FIELD, PALETTE as P, PLATES, REACT, RIFT_COUNT, W } from './config.js';
import { BRUSHES, ELEMENTS } from './elements.js';
import { KINDS } from './creatures.js';
import { drawCreatureSprite } from './sprites.js';
import { BOONS } from './boons.js';
import { chainMult } from './score.js';
import { RIFT_PLANS, upcoming } from './rifts.js';
import { drawBar, drawPanel, drawText, formatNumber } from './draw.js';
import { isMuted } from './audio.js';

const PANEL_X = 988;
const PANEL_W = 280;
/** Clickable brush cards, so the mouse can pick a brush as well as keys 1-4. */
export const BRUSH_CARDS = BRUSHES.map((_, i) => ({ x: PANEL_X, y: 84 + i * 76, w: PANEL_W, h: 70 }));

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
  const number = Math.max(1, game.riftNum);
  drawText(ctx, `RIFT ${number}/${RIFT_COUNT}`, 24, 42, { size: 34, color: '#ffd9a0' });
  drawText(ctx, RIFT_PLANS[number - 1].title, 24, 62, { size: 12, color: P.muted, weight: 700, outline: 0 });
  const rift = game.rift;
  const left = rift ? rift.total - rift.next + game.creatures.length : 0;
  const ratio = rift ? 1 - left / rift.total : 0;
  drawBar(ctx, 24, 68, 190, 5, game.riftNum === 0 ? 0 : ratio, '#ffb347');
}

function drawQueue(ctx, game, time) {
  drawPanel(ctx, 236, 8, 584, 68);
  drawText(ctx, 'INCOMING', 248, 26, { size: 13, color: P.muted, outline: 0 });
  const groups = upcoming(game, 5);
  let x = 248;
  if (groups.length === 0) {
    drawText(ctx, game.phase === 'clear' || game.phase === 'boon' ? 'rift cleared' : game.rift && !game.rift.done ? 'all creatures are out - finish them!' : 'last creatures on the field', x, 46, { size: 16, color: P.muted, outline: 0 });
  }
  for (const g of groups) {
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.roundRect(x - 4, 30, 108, 24, 6);
    ctx.fill();
    drawCreatureSprite(ctx, g.kind, x + 12, 42, g.kind === 'colossus' ? 7 : 9, 0, {});
    drawText(ctx, `x${g.count}`, x + 28, 49, { size: 18, color: '#ffffff' });
    drawText(ctx, g.gate[0], x + 80, 49, { size: 14, color: '#ff9af5' });
    x += 112;
  }
  const next = groups[0];
  let line;
  if (game.phase === 'prep') line = `RIFT ${game.riftNum + 1} OPENS IN ${Math.ceil(game.prepTimer)}s   paint your defences!  [SPACE] open now`;
  else if (next) line = `NEXT: ${next.count} ${next.count > 1 ? KINDS[next.kind].plural : KINDS[next.kind].name} from ${next.gate} in ${Math.ceil(next.seconds)}s`;
  else if (game.phase === 'clear' || game.phase === 'boon') line = `RIFT ${game.riftNum} SEALED - well done!`;
  else line = 'finish the last creatures';
  const pulse = game.phase === 'prep' && Math.floor(time * 2) % 2 === 0;
  drawText(ctx, line, 248, 71, { size: 16, color: pulse ? '#ffffff' : '#ffd9a0', outline: 3 });
}

function drawCoreBlock(ctx, game) {
  drawPanel(ctx, 832, 8, 436, 68, { edge: game.core.hitFlash > 0 ? P.danger : '#2f6f7a' });
  drawText(ctx, 'CORE CRYSTAL', 846, 28, { size: 15, color: P.core, outline: 0 });
  const ratio = game.core.hp / CORE.maxHp;
  drawBar(ctx, 846, 36, 408, 24, ratio, ratio > 0.4 ? '#33d4e6' : P.danger);
  if (game.core.shield > 0) drawBar(ctx, 846, 36, 408, 7, game.core.shield / Math.max(40, game.mods.shieldMax), '#e6faff', 'rgba(0,0,0,0)');
  drawText(ctx, `${Math.ceil(game.core.hp)} / ${CORE.maxHp}`, 1050, 56, { size: 20, align: 'center' });
  if (game.core.shield > 0) drawText(ctx, `SHIELD ${Math.ceil(game.core.shield)}`, 1250, 28, { size: 14, color: '#bfefff', align: 'right', outline: 2 });
  drawText(ctx, game.core.hp <= 30 ? 'CRITICAL!' : '', 846 + 408, 71, { size: 12, color: P.danger, align: 'right', outline: 0 });
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
    ctx.roundRect(card.x + 10, card.y + 10, 38, 38, 8);
    ctx.fill();
    drawText(ctx, String(i + 1), card.x + 29, card.y + 39, { size: 28, color: '#05060a', align: 'center', outline: 0 });
    drawText(ctx, el.name, card.x + 58, card.y + 32, { size: 24, color: el.color });
    const essence = game.essence[i];
    const ratio = essence / game.mods.essenceMax;
    drawBar(ctx, card.x + 58, card.y + 40, 170, 12, ratio, empty && Math.floor(time * 12) % 2 === 0 ? P.danger : el.color);
    drawText(ctx, String(Math.floor(essence)), card.x + 270, card.y + 52, { size: 16, align: 'right', color: '#ffffff' });
    drawText(ctx, BRUSH_HINTS[i], card.x + 12, card.y + 65, { size: 11.5, color: P.muted, weight: 700, outline: 0 });
  });
}

function drawScoreBlock(ctx, game, bests) {
  const y = 394;
  drawPanel(ctx, PANEL_X, y, PANEL_W, 112);
  drawText(ctx, 'SCORE', PANEL_X + 12, y + 22, { size: 13, color: P.muted, outline: 0 });
  drawText(ctx, formatNumber(game.score), PANEL_X + 12, y + 52, { size: 34, color: P.gold });
  drawText(ctx, `BEST ${formatNumber(Math.max(bests.score, game.score))}`, PANEL_X + PANEL_W - 12, y + 22, { size: 13, color: P.muted, align: 'right', outline: 0 });
  const chain = game.chain.count;
  const hot = chain >= 5;
  drawText(ctx, chain > 0 ? `CHAIN x${chain}` : 'CHAIN -', PANEL_X + 12, y + 86, { size: 32, color: chain > 0 ? (hot ? '#ffe23a' : '#ffffff') : P.muted });
  if (chain > 0) {
    drawText(ctx, `score x${chainMult(chain).toFixed(1)}`, PANEL_X + PANEL_W - 12, y + 70, { size: 13, color: '#ffd9a0', align: 'right', outline: 0 });
    drawBar(ctx, PANEL_X + 12, y + 94, PANEL_W - 24, 6, game.chain.timer / REACT.chainWindow, '#ffe23a');
  }
  drawText(ctx, `BEST x${Math.max(game.chain.best, bests.chain)}`, PANEL_X + PANEL_W - 12, y + 88, { size: 14, color: '#ffd9a0', align: 'right', outline: 2 });
}

function drawBoonList(ctx, game) {
  const y = 514;
  drawPanel(ctx, PANEL_X, y, PANEL_W, 170);
  drawText(ctx, 'BOONS', PANEL_X + 12, y + 22, { size: 13, color: P.muted, outline: 0 });
  const held = BOONS.filter((b) => game.boons[b.id]);
  if (held.length === 0) {
    drawText(ctx, 'none yet', PANEL_X + 12, y + 50, { size: 17, color: P.muted, outline: 0 });
    drawText(ctx, 'pick 1 of 3 after each rift', PANEL_X + 12, y + 72, { size: 13, color: P.muted, weight: 700, outline: 0 });
  }
  held.slice(0, 6).forEach((b, i) => {
    const row = y + 30 + i * 22;
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.roundRect(PANEL_X + 12, row, 18, 18, 4);
    ctx.fill();
    drawText(ctx, b.icon, PANEL_X + 21, row + 14, { size: 13, color: '#05060a', align: 'center', outline: 0 });
    drawText(ctx, `${b.name}${game.boons[b.id] > 1 ? ` x${game.boons[b.id]}` : ''}`, PANEL_X + 38, row + 15, { size: 15, color: '#ffffff', outline: 2 });
  });
}

function drawBossStrip(ctx, game, time) {
  const boss = game.boss;
  if (!boss) return;
  const x = FIELD.x + 150;
  const y = FIELD.y + FIELD.h - 78;
  const w = 660;
  drawPanel(ctx, x, y, w, 70, { fill: 'rgba(10,6,20,0.88)', edge: '#a65cff' });
  drawText(ctx, 'HOLLOW COLOSSUS', x + 12, y + 22, { size: 18, color: '#c58aff' });
  drawBar(ctx, x + 190, y + 8, w - 202, 14, boss.hp / boss.maxHp, '#c0486a');
  if (boss.exposed > 0) drawText(ctx, `EXPOSED! ${Math.ceil(boss.exposed)}s`, x + 12, y + 56, { size: 24, color: '#ffd24a' });
  else drawText(ctx, 'BREAK THE ARMOUR IN ORDER:', x + 12, y + 50, { size: 12, color: P.muted, outline: 0 });
  PLATES.forEach((plate, i) => {
    const cx = x + 190 + i * 117;
    const broken = i < boss.plates || boss.exposed > 0;
    const current = i === boss.plates && boss.exposed <= 0;
    ctx.fillStyle = broken ? '#1d3a2c' : current ? plate.color : '#1a1f2c';
    ctx.globalAlpha = current ? 0.8 + Math.sin(time * 8) * 0.2 : 1;
    ctx.beginPath();
    ctx.roundRect(cx, y + 30, 110, 34, 6);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = broken ? P.good : plate.color;
    ctx.lineWidth = current ? 3 : 1.5;
    ctx.stroke();
    drawText(ctx, `${i + 1} ${plate.need}`, cx + 55, y + 45, { size: 14, color: broken ? P.good : current ? '#05060a' : plate.color, align: 'center', outline: current ? 0 : 2 });
    drawText(ctx, broken ? 'BROKEN' : plate.hint, cx + 55, y + 58, { size: 10, color: broken ? P.good : current ? '#05060a' : P.muted, align: 'center', outline: 0, weight: 700 });
  });
}

function drawTip(ctx, game) {
  if (!game.tip) return;
  const a = Math.min(1, game.tip.timer);
  ctx.globalAlpha = a;
  drawPanel(ctx, FIELD.x + 130, FIELD.y + 8, 700, 36, { fill: 'rgba(8,10,16,0.88)', edge: '#ffd24a' });
  drawCreatureSprite(ctx, game.tip.kind, FIELD.x + 158, FIELD.y + 26, 10, 0, {});
  drawText(ctx, game.tip.text, FIELD.x + 480, FIELD.y + 33, { size: 15, color: '#ffe9a8', align: 'center' });
  ctx.globalAlpha = 1;
}

/** Paint the full HUD. `bests` = { score, chain } saved records. */
export function drawHud(ctx, game, bests, time) {
  drawRiftBlock(ctx, game);
  drawQueue(ctx, game, time);
  drawCoreBlock(ctx, game);
  drawBrushCards(ctx, game, time);
  drawScoreBlock(ctx, game, bests);
  drawBoonList(ctx, game);
  drawBossStrip(ctx, game, time);
  drawTip(ctx, game);
  drawText(ctx, 'WIN: clear 7 rifts and the Colossus', 16, 708, { size: 17, color: P.good });
  drawText(ctx, '·', 322, 708, { size: 17, color: P.muted });
  drawText(ctx, 'LOSE: the Core shatters', 336, 708, { size: 17, color: P.danger });
  drawText(ctx, `[1-4] brush   [SPACE] open rift   [P] pause   [M] ${isMuted() ? 'unmute' : 'mute'}   hold mouse to paint`, W - 12, 708, { size: 13, color: P.muted, align: 'right', weight: 700, outline: 0 });
}
