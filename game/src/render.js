// Paints the battlefield: the cached obsidian floor, torn rift portals, every painted cell as a
// material (materials.js), the faceted Core Crystal, creatures, particles, floating text and the
// brush cursor. The HUD and the overlay screens are painted on top by hud.js and screens.js.
import { CELL, COLS, CORE, FIELD, GATES, H, VIEW_SCALE, W } from './config.js';
import { BRUSHES, ELEMENTS, ruleFor } from './elements.js';
import { toScreenX, toScreenY } from './grid.js';
import { KINDS, drawCreatures } from './creatures.js';
import { flowDirection } from './pathing.js';
import { drawText } from './draw.js';
import { drawLabels } from './labels.js';
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
  const tint = flash ? '#ff4060' : '#ffe3a0';
  ctx.save();
  ctx.translate(x, y);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.55 + Math.sin(time * 3) * 0.12;
  ctx.drawImage(glowSprite(tint), -110, -120, 220, 220);
  ctx.globalAlpha = flash ? 0.3 : 0.5;
  ctx.drawImage(glowSprite(flash ? '#ff6070' : '#fff0c0'), -190, -205, 380, 380);
  ctx.globalAlpha = 0.55 + Math.sin(time * 3) * 0.12;
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
    [[0, -66], [-22, -28], [0, -22], '#ffffff'],
    [[0, -66], [22, -28], [0, -22], '#fff0c8'],
    [[-22, -28], [-17, 18], [0, -22], '#bff4ff'],
    [[22, -28], [17, 18], [0, -22], '#8fdcf0'],
    [[-17, 18], [0, 34], [0, -22], '#a8e8f8'],
    [[17, 18], [0, 34], [0, -22], '#6cc4e0'],
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

const BRUSH_GLYPHS = ['fire', 'water', 'earth', 'storm'];

/** A small dark tag next to the brush: text in the element colour. */
function cursorTag(ctx, x, y, text, color) {
  ctx.font = '800 12px sans-serif';
  const w = ctx.measureText(text).width + 14;
  const left = Math.min(FIELD.x + FIELD.w - w - 4, Math.max(FIELD.x + 4, x));
  ctx.beginPath();
  ctx.roundRect(left, y, w, 20, 6);
  ctx.fillStyle = 'rgba(4,6,10,0.92)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.stroke();
  drawText(ctx, text, left + 7, y + 15, { size: 12, color: '#ffffff', align: 'left', weight: 800, outline: 0 });
}

/**
 * The player's brush: a glowing arcane orb in the selected element's colour with its glyph, a small
 * "YOU" tag, a fading glowing stroke trail while painting, and, when the stroke lands on something
 * it reacts with, a note of what it will make ("painting STORM > CHARGED WATER").
 */
function drawCursor(ctx, game, time) {
  const cur = game.cursor;
  if (!cur.inField) return;
  const index = game.brush;
  const element = ELEMENTS[BRUSHES[index]];
  const x = toScreenX(cur.x);
  const y = toScreenY(cur.y);
  const radius = game.mods.brushRadius * CELL;
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 1; i < cur.trail.length; i += 1) {
    const a = cur.trail[i - 1];
    const b = cur.trail[i];
    const fade = Math.max(0, 1 - b.age / 0.9);
    ctx.strokeStyle = ELEMENTS[BRUSHES[b.brush]].glow;
    ctx.globalAlpha = 0.55 * fade;
    ctx.lineWidth = 16 * fade + 4;
    ctx.beginPath();
    ctx.moveTo(toScreenX(a.x), toScreenY(a.y));
    ctx.lineTo(toScreenX(b.x), toScreenY(b.y));
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = 0.85 * fade;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const glow = ctx.createRadialGradient(x, y, 2, x, y, 34);
  glow.addColorStop(0, element.glow);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 34, y - 34, 68, 68);
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = element.color;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.lineDashOffset = -time * 20;
  ctx.beginPath();
  ctx.arc(x, y, radius + 3, 0, 6.283);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  // The orb itself.
  ctx.beginPath();
  ctx.arc(x, y, 13, 0, 6.283);
  ctx.fillStyle = '#080a12';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = element.color;
  ctx.stroke();
  drawGlyph(ctx, BRUSH_GLYPHS[index], x, y, 8, '#ffffff', 2.4);
  ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 3; k += 1) {
    const a = time * 3 + k * 2.1;
    ctx.fillStyle = element.glow;
    ctx.fillRect(x + Math.cos(a) * 19 - 1.5, y + Math.sin(a) * 19 - 1.5, 3, 3);
  }
  ctx.globalCompositeOperation = 'source-over';
  if (!cur.down) cursorTag(ctx, x + 16, y - 34, 'YOU', '#ffd24a');
  if (cur.down) {
    const under = game.grid.type[Math.floor(cur.y) * COLS + Math.floor(cur.x)] ?? 0;
    const rule = under ? ruleFor(under, BRUSHES[index]) : null;
    const made = rule && rule.a ? ELEMENTS[rule.a].name : '';
    cursorTag(ctx, x + 16, y - 34, made ? `YOU \u00b7 painting ${element.name} \u2192 ${made}` : `YOU \u00b7 painting ${element.name}`, element.color);
  }
}

/** Dotted approach paths: where the nearest creatures will walk to reach the Core, following the flow field. */
const step = { x: 0, y: 0 };
function drawApproachPaths(ctx, game) {
  const cx = CORE.col + 0.5;
  const cy = CORE.row + 0.5;
  const walkers = game.creatures
    .filter((c) => !c.dead && c.frozen <= 0 && KINDS[c.kind] && !KINDS[c.kind].boss && Math.hypot(c.x - cx, c.y - cy) > 5)
    .sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))
    .slice(0, 9);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.setLineDash([2, 9]);
  ctx.lineCap = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,224,150,0.5)';
  for (const c of walkers) {
    let x = c.x;
    let y = c.y;
    ctx.beginPath();
    ctx.moveTo(toScreenX(x), toScreenY(y));
    for (let n = 0; n < 40 && Math.hypot(x - cx, y - cy) > 2.2; n += 1) {
      if (KINDS[c.kind].flies) {
        const len = Math.hypot(cx - x, cy - y) || 1;
        step.x = (cx - x) / len;
        step.y = (cy - y) / len;
      } else flowDirection(game.flow, x, y, step);
      x += step.x * 0.7;
      y += step.y * 0.7;
      ctx.lineTo(toScreenX(x), toScreenY(y));
    }
    ctx.stroke();
  }
  ctx.restore();
}

let bloomCanvas = null;
let grain = null;
let lightCanvas = null;

/** The camera's scale and (clamped) centre in world pixels. */
function viewOf(cam) {
  const scale = VIEW_SCALE * cam.zoom;
  const halfW = W / (2 * scale);
  const halfH = H / (2 * scale);
  return { scale, cx: Math.min(FIELD.w - halfW, Math.max(halfW, cam.cx)), cy: Math.min(FIELD.h - halfH, Math.max(halfH, cam.cy)) };
}

/** Convert a canvas pixel (mouse) to a world pixel, through the camera. */
export function screenToWorld(cam, px, py) {
  const v = viewOf(cam);
  return { x: (px - W / 2) / v.scale + v.cx, y: (py - H / 2) / v.scale + v.cy };
}

/**
 * Night-time lighting: the world is darkened by multiplying a low-resolution light map, which has a
 * dim ambient plus additive light from every energy source: the Core (strongest), lava and fire,
 * lightning and charged water (flickering), rifts, ice, magnetite, the boss, some creatures and the brush.
 */
function drawLighting(ctx, game, time) {
  if (!lightCanvas) {
    lightCanvas = document.createElement('canvas');
    lightCanvas.width = Math.ceil(FIELD.w / 4);
    lightCanvas.height = Math.ceil(FIELD.h / 4);
  }
  const g = lightCanvas.getContext('2d');
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  g.fillStyle = 'rgb(58,64,96)';
  g.fillRect(0, 0, lightCanvas.width, lightCanvas.height);
  g.globalCompositeOperation = 'lighter';
  const light = (x, y, r, color, alpha) => {
    g.globalAlpha = Math.min(1, alpha);
    g.drawImage(glowSprite(color), (x - r) / 4, (y - r) / 4, r / 2, r / 2);
  };
  const grid = game.grid;
  for (let i = 0; i < grid.type.length; i += 1) {
    const type = grid.type[i];
    if (type === 0) continue;
    const x = (i % COLS) * CELL + 10;
    const y = Math.floor(i / COLS) * CELL + 10;
    if (type === 1 || type === 6) light(x, y, 95, '#ff8a3a', 0.5);
    else if (type === 7 || type === 4 || type === 10) light(x, y, 100, '#c9b8ff', (type === 10 ? 0.3 : 0.5) * (0.65 + 0.35 * Math.sin(time * 26 + i * 1.7)));
    else if (type === 8) light(x, y, 70, '#8fc0ff', 0.28);
    else if (type === 9) light(x, y, 60, '#ff7a9a', 0.22);
  }
  light((CORE.col + 0.5) * CELL, (CORE.row + 0.5) * CELL, 330, '#ffe6a8', 1);
  light((CORE.col + 0.5) * CELL, (CORE.row + 0.5) * CELL, 160, '#fff4d0', 1);
  for (const gate of Object.values(GATES)) light((gate.col + 0.5) * CELL + (gate.col === 0 ? 38 : gate.col > 0 && gate.row === CORE.row ? -38 : 0), (gate.row + 0.5) * CELL + (gate.row === 0 ? 38 : gate.row === GATES.S.row ? -38 : 0), 140, '#a66cff', 0.8);
  for (const bolt of game.fx.bolts) {
    const fade = Math.max(0, bolt.life / bolt.max);
    for (const [x, y] of [bolt.points[0], bolt.points[bolt.points.length - 1]]) light(x, y, 130, '#d6c8ff', 0.9 * fade);
  }
  for (const c of game.creatures) {
    const x = c.x * CELL;
    const y = c.y * CELL;
    if (c.kind === 'colossus') light(x, y, 220, '#ffb070', 0.7);
    else if (c.kind === 'imp') light(x, y, 60, '#ff8a3a', 0.4);
    else if (c.kind === 'wraith') light(x, y, 70, '#9fd8ff', 0.3);
    else if (c.kind === 'beetle') light(x, y, 60, '#ffe23a', 0.3);
  }
  if (game.cursor.inField) light(game.cursor.x * CELL, game.cursor.y * CELL, 90, ELEMENTS[BRUSHES[game.brush]].glow, 0.55);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(lightCanvas, 0, 0, FIELD.w, FIELD.h);
  ctx.restore();
}

/**
 * Soft bloom (the bright parts of the picture, blurred by downscaling and added back), a faint paper
 * grain and a vignette, over the whole canvas.
 */
function drawBloomAndGrain(ctx) {
  if (!bloomCanvas) {
    bloomCanvas = document.createElement('canvas');
    bloomCanvas.width = 192;
    bloomCanvas.height = 120;
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
  b.drawImage(ctx.canvas, 0, 0, W, H, 0, 0, 192, 120);
  b.filter = 'none';
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.3;
  ctx.drawImage(bloomCanvas, 0, 0, W, H);
  ctx.globalAlpha = 0.05;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = grain;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
  const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.66);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
}

/** Paint the whole battlefield, full-bleed: through the camera, with night lighting, shake, bloom and vignette. */
export function drawBattlefield(ctx, game, time) {
  const shake = game.fx.shake;
  const v = viewOf(game.cam);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(v.scale, v.scale);
  ctx.translate(-v.cx + Math.sin(time * 91) * shake, -v.cy + Math.cos(time * 73) * shake);
  ctx.drawImage(getGround(), FIELD.x, FIELD.y);
  ctx.globalAlpha = game.cursor.down ? 0.07 : 0.035;
  ctx.drawImage(getGridLines(), FIELD.x, FIELD.y);
  ctx.globalAlpha = 1;
  drawGates(ctx, game, time);
  drawMaterials(ctx, game, time);
  drawCore(ctx, game, time);
  drawBossWarning(ctx, game);
  drawApproachPaths(ctx, game);
  drawCreatures(ctx, game, time);
  drawLighting(ctx, game, time);
  drawParticles(ctx, game.fx);
  drawCursor(ctx, game, time);
  drawTexts(ctx, game.fx);
  drawLabels(ctx, game);
  ctx.restore();
  drawBloomAndGrain(ctx);
  if (game.fx.flash > 0) {
    ctx.globalAlpha = Math.min(0.45, game.fx.flash * 0.5);
    ctx.fillStyle = game.fx.flashColor;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
}
