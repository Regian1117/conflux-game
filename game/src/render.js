// Paints the battlefield: obsidian ground, rift gates, every painted cell with its element's
// look and glow, the Core Crystal, creatures, particles, floating text and the brush cursor.
// The HUD and the overlay screens are painted on top by hud.js and screens.js.
import { CELL, COLS, CORE, FIELD, GATES, PALETTE as P, ROWS } from './config.js';
import { BRUSHES, CHARGED, CLOUD, EARTH, ELEMENTS, EMPTY, FIRE, ICE, LAVA, MAGNET, STEAM, STORM, WATER } from './elements.js';
import { toScreenX, toScreenY } from './grid.js';
import { drawCreatures } from './creatures.js';
import { drawBossWarning } from './boss.js';
import { drawParticles, drawTexts } from './particles.js';
import { upcoming } from './rifts.js';

const glowCache = new Map();

/** A soft radial glow sprite in the given colour, built once. */
function glowSprite(color) {
  let sprite = glowCache.get(color);
  if (!sprite) {
    sprite = document.createElement('canvas');
    sprite.width = 64;
    sprite.height = 64;
    const g = sprite.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    glowCache.set(color, sprite);
  }
  return sprite;
}

function zigzag(ctx, x, y, color, width, phase) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x + 6, y + 2);
  ctx.lineTo(x + 11 + phase, y + 8);
  ctx.lineTo(x + 7, y + 11);
  ctx.lineTo(x + 13 - phase, y + 18);
  ctx.stroke();
}

/** One painted cell at pixel (x, y); `i` and `t` vary the animation between neighbouring cells. */
function drawCell(ctx, type, x, y, t, i) {
  const wob = Math.sin(t * 9 + i * 1.7);
  switch (type) {
    case FIRE:
      ctx.fillStyle = '#b8280a';
      ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
      ctx.fillStyle = '#ff5a1f';
      ctx.fillRect(x + 2, y + 5, CELL - 4, CELL - 7);
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath();
      ctx.moveTo(x + 4, y + CELL - 3);
      ctx.lineTo(x + 10 + wob * 3, y + 2 + wob * 2);
      ctx.lineTo(x + CELL - 4, y + CELL - 3);
      ctx.fill();
      break;
    case WATER:
      ctx.fillStyle = '#0f6fb0';
      ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
      ctx.fillStyle = '#22c3ff';
      ctx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
      ctx.strokeStyle = '#b9f0ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 3, y + 8 + wob);
      ctx.quadraticCurveTo(x + 8, y + 4 - wob, x + 12, y + 8 + wob);
      ctx.quadraticCurveTo(x + 15, y + 11, x + 17, y + 8);
      ctx.stroke();
      break;
    case EARTH:
      ctx.fillStyle = '#2c2010';
      ctx.fillRect(x, y, CELL, CELL);
      ctx.fillStyle = '#8a6a3a';
      ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 3);
      ctx.fillStyle = '#6a4e28';
      ctx.fillRect(x + 3, y + 11, 7, 4);
      ctx.fillRect(x + 12, y + 5, 5, 4);
      ctx.fillStyle = '#6aa23a';
      ctx.fillRect(x + 1, y + 1, CELL - 2, 3);
      break;
    case STORM:
      ctx.fillStyle = '#2a1b6a';
      ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
      ctx.fillStyle = 'rgba(166,92,255,0.5)';
      ctx.fillRect(x + 3, y + 3, CELL - 6, CELL - 6);
      zigzag(ctx, x, y, '#ffe23a', 2.4, wob * 2);
      break;
    case STEAM: {
      ctx.fillStyle = `rgba(226,244,250,${0.5 + wob * 0.1})`;
      ctx.beginPath();
      ctx.arc(x + 10 + wob * 2, y + 10, 10.5, 0, 6.283);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.arc(x + 6, y + 7 - wob, 5, 0, 6.283);
      ctx.fill();
      break;
    }
    case LAVA:
      ctx.fillStyle = '#7a1500';
      ctx.fillRect(x, y, CELL, CELL);
      ctx.fillStyle = '#ff4d0a';
      ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
      ctx.fillStyle = '#ffb21f';
      ctx.beginPath();
      ctx.arc(x + 7 + wob * 1.5, y + 8, 4.2, 0, 6.283);
      ctx.arc(x + 14, y + 13 - wob, 3.2, 0, 6.283);
      ctx.fill();
      ctx.fillStyle = '#4a0d00';
      ctx.fillRect(x + 11, y + 3, 4, 3);
      break;
    case CHARGED:
      ctx.fillStyle = '#0c7fb8';
      ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
      ctx.fillStyle = '#37e6ff';
      ctx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
      zigzag(ctx, x, y, '#fff6a0', 2.4, wob * 3);
      break;
    case ICE:
      ctx.fillStyle = '#6fb4d8';
      ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
      ctx.fillStyle = '#dff6ff';
      ctx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 15);
      ctx.lineTo(x + 14, y + 4);
      ctx.moveTo(x + 9, y + 17);
      ctx.lineTo(x + 17, y + 9);
      ctx.stroke();
      break;
    case MAGNET:
      ctx.fillStyle = '#2d2230';
      ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
      ctx.fillStyle = '#ff4d6a';
      ctx.fillRect(x + 3, y + 3, 6, CELL - 6);
      ctx.fillStyle = '#5a8cff';
      ctx.fillRect(x + 11, y + 3, 6, CELL - 6);
      ctx.fillStyle = '#c9c9d9';
      ctx.fillRect(x + 3, y + 3, 14, 3);
      break;
    case CLOUD:
      ctx.fillStyle = '#3a2f8f';
      ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
      ctx.fillStyle = '#7b6cf0';
      ctx.beginPath();
      ctx.arc(x + 7, y + 9, 5, 0, 6.283);
      ctx.arc(x + 13, y + 10, 5.5, 0, 6.283);
      ctx.fill();
      if (wob > 0.5) zigzag(ctx, x, y, '#ffe23a', 2, 0);
      break;
    default:
      break;
  }
}

const GLOWS = new Set([FIRE, LAVA, STORM, CHARGED, CLOUD, MAGNET, ICE]);

function drawGround(ctx) {
  ctx.fillStyle = P.ground;
  ctx.fillRect(FIELD.x, FIELD.y, FIELD.w, FIELD.h);
  ctx.strokeStyle = P.groundLine;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 0; c <= COLS; c += 1) {
    ctx.moveTo(FIELD.x + c * CELL + 0.5, FIELD.y);
    ctx.lineTo(FIELD.x + c * CELL + 0.5, FIELD.y + FIELD.h);
  }
  for (let r = 0; r <= ROWS; r += 1) {
    ctx.moveTo(FIELD.x, FIELD.y + r * CELL + 0.5);
    ctx.lineTo(FIELD.x + FIELD.w, FIELD.y + r * CELL + 0.5);
  }
  ctx.stroke();
}

function drawCells(ctx, game, time) {
  const g = game.grid;
  for (let i = 0; i < g.type.length; i += 1) {
    const type = g.type[i];
    if (type === EMPTY) continue;
    const x = FIELD.x + (i % COLS) * CELL;
    const y = FIELD.y + Math.floor(i / COLS) * CELL;
    const fade = Math.min(1, g.life[i] / 1.4);
    if (fade < 1) ctx.globalAlpha = 0.35 + 0.65 * fade * (0.7 + 0.3 * Math.sin(time * 20));
    drawCell(ctx, type, x, y, time, i);
    ctx.globalAlpha = 1;
  }
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < g.type.length; i += 1) {
    const type = g.type[i];
    if (!GLOWS.has(type)) continue;
    const x = FIELD.x + (i % COLS) * CELL + CELL / 2;
    const y = FIELD.y + Math.floor(i / COLS) * CELL + CELL / 2;
    ctx.globalAlpha = type === ICE ? 0.18 : type === MAGNET ? 0.22 : 0.38;
    ctx.drawImage(glowSprite(ELEMENTS[type].glow), x - 30, y - 30, 60, 60);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function drawGates(ctx, game, time) {
  const next = upcoming(game, 2).map((u) => u.gate);
  for (const key of Object.keys(GATES)) {
    const gate = GATES[key];
    const x = toScreenX(gate.col + 0.5);
    const y = toScreenY(gate.row + 0.5);
    const vertical = key === 'W' || key === 'E';
    const hot = next.includes(gate.name) && game.rift !== null && !game.rift.done;
    const soon = game.phase === 'prep' && next.includes(gate.name);
    ctx.save();
    ctx.translate(x, y);
    const pulse = 1 + Math.sin(time * 4) * 0.08;
    ctx.fillStyle = '#0a0414';
    ctx.strokeStyle = hot || soon ? '#ff6af0' : '#7b4cc9';
    ctx.lineWidth = hot || soon ? 4 : 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, (vertical ? 9 : 30) * pulse, (vertical ? 30 : 9) * pulse, 0, 0, 6.283);
    ctx.fill();
    ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = hot || soon ? 0.7 : 0.3;
    ctx.drawImage(glowSprite('#b04cff'), -44, -44, 88, 88);
    ctx.restore();
  }
}

function drawCore(ctx, game, time) {
  const x = toScreenX(CORE.col + 0.5);
  const y = toScreenY(CORE.row + 0.5);
  const flash = game.core.hitFlash > 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.5 + Math.sin(time * 3) * 0.12;
  ctx.drawImage(glowSprite(flash ? '#ff4060' : '#6ff0ff'), -70, -70, 140, 140);
  ctx.restore();
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#0a1620';
  ctx.strokeStyle = '#6ff0ff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.rect(-CELL * 1.5, -CELL * 1.5, CELL * 3, CELL * 3);
  ctx.fill();
  ctx.stroke();
  const bob = Math.sin(time * 2.5) * 2;
  ctx.fillStyle = flash ? '#ff8090' : '#9ff8ff';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -CELL * 1.25 + bob);
  ctx.lineTo(CELL * 0.8, bob * 0.5);
  ctx.lineTo(0, CELL * 1.25 + bob);
  ctx.lineTo(-CELL * 0.8, bob * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.moveTo(0, -CELL * 1.0 + bob);
  ctx.lineTo(CELL * 0.35, bob * 0.5);
  ctx.lineTo(0, bob * 0.5 + 4);
  ctx.closePath();
  ctx.fill();
  if (game.core.shield > 0) {
    ctx.strokeStyle = `rgba(120,230,255,${0.45 + Math.sin(time * 6) * 0.15})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, CELL * 2.3, 0, 6.283);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCursor(ctx, game, time) {
  const cur = game.cursor;
  if (!cur.inField) return;
  const element = ELEMENTS[BRUSHES[game.brush]];
  const x = toScreenX(cur.x);
  const y = toScreenY(cur.y);
  const radius = game.mods.brushRadius * CELL;
  ctx.strokeStyle = element.color;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([6, 5]);
  ctx.lineDashOffset = -time * 20;
  ctx.beginPath();
  ctx.arc(x, y, radius + 3, 0, 6.283);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = cur.down ? 0.35 : 0.18;
  ctx.fillStyle = element.color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 6.283);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** Paint the whole battlefield for this frame (inside the FIELD rectangle, with screen shake). */
export function drawBattlefield(ctx, game, time) {
  const shake = game.fx.shake;
  ctx.save();
  ctx.beginPath();
  ctx.rect(FIELD.x, FIELD.y, FIELD.w, FIELD.h);
  ctx.clip();
  ctx.translate(Math.sin(time * 91) * shake, Math.cos(time * 73) * shake);
  drawGround(ctx);
  drawGates(ctx, game, time);
  drawCells(ctx, game, time);
  drawCore(ctx, game, time);
  drawBossWarning(ctx, game);
  drawCreatures(ctx, game, time);
  drawParticles(ctx, game.fx);
  drawCursor(ctx, game, time);
  drawTexts(ctx, game.fx);
  ctx.restore();
  if (game.fx.flash > 0) {
    ctx.globalAlpha = Math.min(0.45, game.fx.flash * 0.5);
    ctx.fillStyle = game.fx.flashColor;
    ctx.fillRect(FIELD.x, FIELD.y, FIELD.w, FIELD.h);
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = P.panelEdge;
  ctx.lineWidth = 3;
  ctx.strokeRect(FIELD.x - 1.5, FIELD.y - 1.5, FIELD.w + 3, FIELD.h + 3);
}
