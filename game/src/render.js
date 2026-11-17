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
import { drawGlyph } from './glyphs.js';
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

/**
 * A rift: a slowly rotating gold rune circle with a ring of elemental glyphs, and a torn, dark
 * opening at its heart with swirling particles. Hotter (more cracks, brighter) when creatures are
 * about to come through it.
 */
function drawPortal(ctx, key, hot, time) {
  const gate = GATES[key];
  const inward = { W: 38, E: -38, N: 38, S: -38 }[key];
  const vertical = key === 'W' || key === 'E';
  const x = toScreenX(gate.col + 0.5) + (vertical ? inward : 0);
  const y = toScreenY(gate.row + 0.5) + (vertical ? 0 : inward);
  const R = 42;
  ctx.save();
  ctx.translate(x, y);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = hot ? 0.75 : 0.4;
  ctx.drawImage(glowSprite('#c58aff'), -R * 2.2, -R * 2.2, R * 4.4, R * 4.4);
  ctx.globalAlpha = hot ? 0.45 : 0.22;
  ctx.drawImage(glowSprite('#ffb347'), -R * 1.5, -R * 1.5, R * 3, R * 3);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  // The torn opening.
  ctx.beginPath();
  for (let k = 0; k <= 22; k += 1) {
    const a = (k / 22) * 6.283;
    const j = 0.78 + hash(k + (key.charCodeAt(0) % 9), 2) * 0.5 + Math.sin(time * 3 + k) * 0.04;
    ctx[k === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * R * 0.46 * j, Math.sin(a) * R * 0.46 * j);
  }
  ctx.closePath();
  const hole = ctx.createRadialGradient(0, 0, 1, 0, 0, R * 0.5);
  hole.addColorStop(0, '#000000');
  hole.addColorStop(0.7, '#1a0630');
  hole.addColorStop(1, '#6a2dba');
  ctx.fillStyle = hole;
  ctx.fill();
  ctx.strokeStyle = hot ? '#ff8af5' : '#a65cff';
  ctx.lineWidth = 3;
  ctx.stroke();
  // Gold rune circle: rings, rotating dashes, tick marks and four glyphs.
  ctx.strokeStyle = '#d4aa55';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, 6.283);
  ctx.stroke();
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, 0, R - 7, 0, 6.283);
  ctx.stroke();
  ctx.setLineDash([9, 7]);
  ctx.lineDashOffset = time * 14;
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.62, 0, 6.283);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.save();
  ctx.rotate(time * 0.35);
  for (let k = 0; k < 24; k += 1) {
    const a = (k / 24) * 6.283;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * R, Math.sin(a) * R);
    ctx.lineTo(Math.cos(a) * (R + (k % 3 === 0 ? 7 : 4)), Math.sin(a) * (R + (k % 3 === 0 ? 7 : 4)));
    ctx.stroke();
  }
  ['fire', 'water', 'earth', 'storm'].forEach((kind, k) => {
    const a = (k / 4) * 6.283;
    ctx.save();
    ctx.translate(Math.cos(a) * (R - 15), Math.sin(a) * (R - 15));
    ctx.rotate(-time * 0.35);
    drawGlyph(ctx, kind, 0, 0, 6, hot ? '#ffe9a0' : '#d4aa55', 1.8);
    ctx.restore();
  });
  ctx.restore();
  // Glyph rings tearing open: violet cracks leaking out of the heart.
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = 2;
  ctx.strokeStyle = hot ? 'rgba(255,140,245,0.85)' : 'rgba(170,110,255,0.55)';
  for (let k = 0; k < (hot ? 9 : 5); k += 1) {
    const a = (k / 9) * 6.283 + time * 0.2;
    const len = R * (0.55 + hash(k, 6) * 0.5);
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * R * 0.3, Math.sin(a) * R * 0.3);
    ctx.lineTo(Math.cos(a + 0.12) * len * 0.7, Math.sin(a + 0.12) * len * 0.7);
    ctx.lineTo(Math.cos(a - 0.05) * len, Math.sin(a - 0.05) * len);
    ctx.stroke();
  }
  for (let p = 0; p < 12; p += 1) {
    const a = time * (1.2 + (p % 3) * 0.5) + p * 0.52;
    const r = 0.25 + 0.5 * ((p * 0.37 + time * 0.4) % 1);
    ctx.fillStyle = p % 2 ? '#ff9af5' : '#c58aff';
    ctx.fillRect(Math.cos(a) * R * r - 1.5, Math.sin(a) * R * r - 1.5, 3, 3);
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

/** The shield ring round the Core: whole when full, broken into arcs with crack marks as it drains. */
function drawShieldRing(ctx, fraction, time) {
  const rx = CELL * 2.5;
  const ry = CELL * 2.9;
  const pieces = 14;
  ctx.lineCap = 'round';
  for (let k = 0; k < pieces; k += 1) {
    if (hash(k, 4) > fraction + 0.25) continue;
    const a0 = (k / pieces) * 6.283 + 0.04;
    ctx.strokeStyle = `rgba(150,240,255,${0.55 + Math.sin(time * 6 + k) * 0.2})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(0, -8, rx, ry, 0, a0, a0 + 6.283 / pieces - 0.1);
    ctx.stroke();
  }
  if (fraction < 0.6) {
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5;
    for (let k = 0; k < 5; k += 1) {
      const a = hash(k, 9) * 6.283;
      const x = Math.cos(a) * rx;
      const y = -8 + Math.sin(a) * ry;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - Math.cos(a) * 9 + 4, y - Math.sin(a) * 9 - 3);
      ctx.lineTo(x - Math.cos(a) * 16 - 3, y - Math.sin(a) * 16 + 2);
      ctx.stroke();
    }
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
  if (game.core.shield > 0) drawShieldRing(ctx, game.core.shield / Math.max(40, game.mods.shieldMax), time);
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

let bloomCanvas = null;
let grain = null;

/**
 * Soft bloom (the bright parts of the field, blurred by downscaling and added back) and a faint
 * paper grain, so the scene reads as a painted arcane world rather than flat shapes.
 */
function drawBloomAndGrain(ctx) {
  if (!bloomCanvas) {
    bloomCanvas = document.createElement('canvas');
    bloomCanvas.width = 192;
    bloomCanvas.height = 136;
    const n = document.createElement('canvas');
    n.width = 96;
    n.height = 96;
    const g = n.getContext('2d');
    for (let i = 0; i < 2600; i += 1) {
      g.fillStyle = hash(i, 1) > 0.5 ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.6)';
      g.fillRect(hash(i, 2) * 96, hash(i, 3) * 96, 1 + hash(i, 4) * 2, 1 + hash(i, 5) * 2);
    }
    grain = ctx.createPattern(n, 'repeat');
  }
  const b = bloomCanvas.getContext('2d');
  b.globalCompositeOperation = 'source-over';
  b.filter = 'blur(2px) brightness(1.15) contrast(1.25)';
  b.drawImage(ctx.canvas, FIELD.x, FIELD.y, FIELD.w, FIELD.h, 0, 0, 192, 136);
  b.filter = 'none';
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.3;
  ctx.drawImage(bloomCanvas, FIELD.x, FIELD.y, FIELD.w, FIELD.h);
  ctx.globalAlpha = 0.05;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = grain;
  ctx.fillRect(FIELD.x, FIELD.y, FIELD.w, FIELD.h);
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
  drawBloomAndGrain(ctx);
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
