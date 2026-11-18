// Visual feedback that is not part of the rules: particles for every element, lightning bolts,
// floating combat text, screen shake and the white hit flash. All positions are canvas pixels.
import { THEME } from './config.js';
import { FONT } from './config.js';

const MAX_PARTICLES = 1100;

export function createFx(rng) {
  return { rng, parts: [], texts: [], bolts: [], sigil: [], shake: 0, flash: 0, flashColor: '#ffffff' };
}

/**
 * Particle recipes: speed range, life range, size, gravity (px/s^2), drag, colours, draw style.
 * `style` picks how drawFx paints it: square sparks, soft puffs, glowing embers or spinning shards.
 */
const RECIPES = {
  spark: { speed: [60, 260], life: [0.25, 0.6], size: [2, 4], gravity: 260, drag: 0.5, colors: ['#ffd24a', '#ff8a2a', '#fff3b0'], style: 'glow' },
  ember: { speed: [20, 90], life: [0.6, 1.4], size: [2, 4], gravity: -60, drag: 0.8, colors: ['#ff5a1f', '#ffb347', '#ff3d00'], style: 'glow' },
  steam: { speed: [8, 40], life: [0.9, 1.8], size: [10, 20], gravity: -40, drag: 1.0, colors: ['#e9f7fb', '#cfe9f2', '#b9d6e0'], style: 'puff' },
  splash: { speed: [40, 150], life: [0.3, 0.7], size: [2, 4], gravity: 320, drag: 0.4, colors: ['#22c3ff', '#8fe3ff', '#ffffff'], style: 'solid' },
  shard: { speed: [60, 220], life: [0.5, 1.0], size: [3, 6], gravity: 380, drag: 0.3, colors: ['#ffffff', '#dff6ff', '#8fdcff'], style: 'shard' },
  zap: { speed: [100, 320], life: [0.12, 0.3], size: [2, 3], gravity: 0, drag: 1.6, colors: ['#ffe23a', '#ffffff', '#c58aff'], style: 'glow' },
  dust: { speed: [20, 110], life: [0.4, 0.9], size: [3, 6], gravity: 120, drag: 1.2, colors: ['#8a6a3a', '#5f8f3a', '#3d3220'], style: 'solid' },
  blood: { speed: [40, 170], life: [0.3, 0.8], size: [2, 4], gravity: 200, drag: 0.5, colors: ['#ff3b4e', '#ffb0b8'], style: 'solid' },
};

/** Throw `count` particles of the named recipe from pixel (x, y), optionally overriding colours. */
export function burst(fx, name, x, y, count, colors) {
  const recipe = RECIPES[name];
  for (let n = 0; n < count; n += 1) {
    if (fx.parts.length >= MAX_PARTICLES) fx.parts.shift();
    const angle = fx.rng.range(0, Math.PI * 2);
    const speed = fx.rng.range(recipe.speed[0], recipe.speed[1]);
    const life = fx.rng.range(recipe.life[0], recipe.life[1]);
    const palette = colors ?? recipe.colors;
    fx.parts.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life,
      max: life,
      size: fx.rng.range(recipe.size[0], recipe.size[1]),
      gravity: recipe.gravity,
      drag: recipe.drag,
      color: palette[fx.rng.int(palette.length)],
      style: recipe.style,
      spin: fx.rng.range(-8, 8),
      angle: fx.rng.range(0, 6.28),
    });
  }
}

/** Floating text that rises and fades: damage, kills, chain callouts. */
export function addText(fx, x, y, text, options = {}) {
  fx.texts.push({
    x,
    y,
    text,
    color: options.color ?? '#ffffff',
    size: options.size ?? 22,
    life: options.life ?? 1.1,
    max: options.life ?? 1.1,
    vy: options.vy ?? -38,
    pop: options.pop ?? 0,
    angle: options.angle ?? 0,
  });
  if (fx.texts.length > 40) fx.texts.shift();
}

/** A jagged lightning bolt between two pixel points that fades in a fraction of a second. */
export function addBolt(fx, x1, y1, x2, y2, color = '#ffe23a', life = 0.22, width = 1) {
  const points = [[x1, y1]];
  const segments = Math.max(3, Math.floor(Math.hypot(x2 - x1, y2 - y1) / 22));
  for (let i = 1; i < segments; i += 1) {
    const t = i / segments;
    points.push([x1 + (x2 - x1) * t + fx.rng.range(-9, 9), y1 + (y2 - y1) * t + fx.rng.range(-9, 9)]);
  }
  points.push([x2, y2]);
  fx.bolts.push({ points, color, life, max: life, width });
  if (fx.bolts.length > 30) fx.bolts.shift();
}

export function addShake(fx, amount) {
  fx.shake = Math.min(14, Math.max(fx.shake, amount));
}

export function addFlash(fx, amount, color = '#ffffff') {
  fx.flash = Math.max(fx.flash, amount);
  fx.flashColor = color;
}

export function updateFx(fx, dt) {
  for (let i = fx.sigil.length - 1; i >= 0; i -= 1) {
    fx.sigil[i].t += dt;
    if (fx.sigil[i].t > 1.4) fx.sigil.splice(i, 1);
  }
  fx.shake = Math.max(0, fx.shake - dt * 22);
  fx.flash = Math.max(0, fx.flash - dt * 2.2);
  for (let i = fx.parts.length - 1; i >= 0; i -= 1) {
    const p = fx.parts[i];
    p.life -= dt;
    if (p.life <= 0) {
      fx.parts[i] = fx.parts[fx.parts.length - 1];
      fx.parts.pop();
      continue;
    }
    p.vy += p.gravity * dt;
    const damp = Math.max(0, 1 - p.drag * dt);
    p.vx *= damp;
    p.vy *= damp;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.angle += p.spin * dt;
  }
  for (let i = fx.texts.length - 1; i >= 0; i -= 1) {
    const t = fx.texts[i];
    t.life -= dt;
    t.y += t.vy * dt;
    t.vy *= 0.97;
    if (t.life <= 0) fx.texts.splice(i, 1);
  }
  for (let i = fx.bolts.length - 1; i >= 0; i -= 1) {
    fx.bolts[i].life -= dt;
    if (fx.bolts[i].life <= 0) fx.bolts.splice(i, 1);
  }
}

/** Paint particles and bolts (under the HUD) in canvas pixels. */
export function drawParticles(ctx, fx) {
  {
    for (const p of fx.parts) {
      const a = Math.max(0, p.life / p.max);
      if (p.style === 'puff') {
        ctx.globalAlpha = a * 0.35;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.6 - a * 0.6), 0, 6.283);
        ctx.fill();
      } else if (p.style === 'glow') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        ctx.globalAlpha = a * 0.3;
        ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
        ctx.globalCompositeOperation = 'source-over';
      } else if (p.style === 'shard') {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.beginPath();
        ctx.moveTo(0, -p.size * 1.4);
        ctx.lineTo(p.size * 0.7, p.size);
        ctx.lineTo(-p.size * 0.7, p.size);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
    ctx.lineJoin = 'round';
    for (const b of fx.bolts) {
      const a = Math.max(0, b.life / b.max);
      ctx.globalCompositeOperation = THEME.bright ? 'source-over' : 'lighter';
      for (const pass of THEME.bright ? [['#2B1A5A', 6.5 * (b.width ?? 1), 0.85], [b.color, 4 * (b.width ?? 1), 1], ['#ffffff', 1.8 * (b.width ?? 1), 1]] : [[b.color, 7 * (b.width ?? 1), 0.28], ['#ffffff', 2.2 * (b.width ?? 1), 1]]) {
        ctx.strokeStyle = pass[0];
        ctx.lineWidth = pass[1];
        ctx.globalAlpha = a * pass[2];
        ctx.beginPath();
        b.points.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt[0], pt[1]) : ctx.lineTo(pt[0], pt[1])));
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  }
}

/** Paint the floating texts (drawn after creatures so they stay readable). */
export function drawTexts(ctx, fx) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  for (const t of fx.texts) {
    const a = Math.min(1, t.life / (t.max * 0.5));
    const grow = t.pop > 0 ? 1 + t.pop * Math.max(0, 1 - (t.max - t.life) * 6) : 1;
    const size = t.size * grow;
    ctx.globalAlpha = a;
    ctx.font = `900 ${size}px ${FONT}`;
    ctx.lineWidth = Math.max(3, size / 5);
    ctx.strokeStyle = '#05060a';
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate(t.angle);
    ctx.strokeText(t.text, 0, 0);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
