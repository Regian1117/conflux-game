// Paints the battlefield: the cached obsidian floor, torn rift portals, every painted cell as a
// material (materials.js), the faceted Core Crystal, creatures, particles, floating text and the
// brush cursor. The HUD and the overlay screens are painted on top by hud.js and screens.js.
import { CELL, CORE, FIELD, GATES } from './config.js';
import { BRUSHES, ELEMENTS } from './elements.js';
import { toScreenX, toScreenY } from './grid.js';
import { drawCreatures } from './creatures.js';
import { drawBossWarning } from './boss.js';
import { drawParticles, drawTexts } from './particles.js';
import { upcoming } from './rifts.js';
import { getGridLines, getGround } from './ground.js';
import { drawMaterials } from './materials.js';

const glowCache = new Map();

/** A soft radial glow sprite in the given colour, built once. */
export function glowSprite(color) {
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

const hash = (i, k) => {
  const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

/** A torn, glowing rift portal with swirling particles; brighter when creatures are about to come. */
function drawPortal(ctx, key, hot, time) {
  const gate = GATES[key];
  const vertical = key === 'W' || key === 'E';
  const inward = { W: 16, E: -16, N: 16, S: -16 }[key];
  const x = toScreenX(gate.col + 0.5) + (vertical ? inward : 0);
  const y = toScreenY(gate.row + 0.5) + (vertical ? 0 : inward);
  const rx = vertical ? 15 : 50;
  const ry = vertical ? 50 : 15;
  ctx.save();
  ctx.translate(x, y);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = hot ? 0.85 : 0.45;
  ctx.drawImage(glowSprite('#b04cff'), -rx * 3, -ry * 3, rx * 6, ry * 6);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  // The torn rim: a ring whose radius jitters, so it reads as ripped open rather than drawn.
  ctx.beginPath();
  for (let k = 0; k <= 28; k += 1) {
    const a = (k / 28) * 6.283;
    const j = 1 + (hash(k + (key.charCodeAt(0) % 7), 2) - 0.5) * 0.28 + Math.sin(time * 3 + k) * 0.03;
    ctx[k === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * rx * j, Math.sin(a) * ry * j);
  }
  ctx.closePath();
  const hole = ctx.createRadialGradient(0, 0, 2, 0, 0, Math.max(rx, ry));
  hole.addColorStop(0, '#000000');
  hole.addColorStop(0.7, '#1a0630');
  hole.addColorStop(1, '#5a1d9a');
  ctx.fillStyle = hole;
  ctx.fill();
  ctx.strokeStyle = hot ? '#ff8af5' : '#a65cff';
  ctx.lineWidth = hot ? 4 : 3;
  ctx.stroke();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = 2;
  for (let s = 0; s < 3; s += 1) {
    ctx.strokeStyle = s === 1 ? 'rgba(255,140,245,0.6)' : 'rgba(150,100,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * (0.35 + s * 0.2), ry * (0.35 + s * 0.2), 0, time * (1.5 + s) + s, time * (1.5 + s) + s + 3);
    ctx.stroke();
  }
  for (let p = 0; p < 12; p += 1) {
    const a = time * (1.2 + (p % 3) * 0.5) + p * 0.52;
    const r = 0.6 + 0.5 * ((p * 0.37 + time * 0.4) % 1);
    ctx.fillStyle = p % 2 ? '#ff9af5' : '#c58aff';
    ctx.fillRect(Math.cos(a) * rx * r * 1.1 - 1.5, Math.sin(a) * ry * r * 1.1 - 1.5, 3, 3);
  }
  ctx.restore();
}

function drawGates(ctx, game, time) {
  const next = upcoming(game, 2).map((u) => u.gate);
  for (const key of Object.keys(GATES)) {
    const hot = next.includes(GATES[key].name) && (game.phase === 'prep' || (game.rift !== null && !game.rift.done));
    drawPortal(ctx, key, hot, time);
  }
}

/** The Core Crystal: a tall faceted crystal on a rune platform, with slowly turning light rays. */
function drawCore(ctx, game, time) {
  const x = toScreenX(CORE.col + 0.5);
  const y = toScreenY(CORE.row + 0.5);
  const flash = game.core.hitFlash > 0;
  const tint = flash ? '#ff4060' : '#6ff0ff';
  ctx.save();
  ctx.translate(x, y);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.55 + Math.sin(time * 3) * 0.12;
  ctx.drawImage(glowSprite(tint), -110, -120, 220, 220);
  for (let k = 0; k < 9; k += 1) {
    const a = time * 0.25 + (k / 9) * 6.283;
    ctx.globalAlpha = 0.13;
    ctx.fillStyle = tint;
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(Math.cos(a - 0.07) * 120, -20 + Math.sin(a - 0.07) * 120);
    ctx.lineTo(Math.cos(a + 0.07) * 120, -20 + Math.sin(a + 0.07) * 120);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  // Platform.
  ctx.fillStyle = '#0a1620';
  ctx.strokeStyle = '#3aa8c0';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 14, CELL * 2, CELL * 1.2, 0, 0, 6.283);
  ctx.fill();
  ctx.stroke();
  // Crystal.
  const bob = Math.sin(time * 2.2) * 3;
  ctx.translate(0, bob - 6);
  const P = [[0, -66], [22, -28], [17, 18], [0, 34], [-17, 18], [-22, -28]];
  const facets = [
    [[0, -66], [-22, -28], [0, -22], '#e4fdff'],
    [[0, -66], [22, -28], [0, -22], '#8cf0ff'],
    [[-22, -28], [-17, 18], [0, -22], '#3fc4e0'],
    [[22, -28], [17, 18], [0, -22], '#1f93b4'],
    [[-17, 18], [0, 34], [0, -22], '#2aa8c8'],
    [[17, 18], [0, 34], [0, -22], '#136f90'],
  ];
  for (const [a, b, c, fill] of facets) {
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.closePath();
    ctx.fillStyle = flash ? '#ff9aa8' : fill;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.beginPath();
  P.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
  ctx.closePath();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.translate(0, -(bob - 6));
  for (let k = 0; k < 4; k += 1) {
    const a = time * 1.3 + k * 1.57;
    ctx.fillStyle = '#c8fbff';
    ctx.fillRect(Math.cos(a) * 34 - 2, -16 + Math.sin(a) * 12 - 2, 4, 4);
  }
  if (game.core.shield > 0) {
    ctx.strokeStyle = `rgba(120,230,255,${0.45 + Math.sin(time * 6) * 0.15})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, -8, CELL * 2.3, CELL * 2.6, 0, 0, 6.283);
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
  ctx.drawImage(getGround(), FIELD.x, FIELD.y);
  ctx.globalAlpha = game.cursor.down ? 0.12 : 0.035;
  ctx.drawImage(getGridLines(), FIELD.x, FIELD.y);
  ctx.globalAlpha = 1;
  drawGates(ctx, game, time);
  drawMaterials(ctx, game, time);
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
  ctx.strokeStyle = '#2a3042';
  ctx.lineWidth = 3;
  ctx.strokeRect(FIELD.x - 1.5, FIELD.y - 1.5, FIELD.w + 3, FIELD.h + 3);
}
