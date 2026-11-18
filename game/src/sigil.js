// The Alchemist's Sigil: the floor of the whole field is one giant engraved alchemical diagram in
// gold, centred on the Core: concentric rings, two interlocked triangles, rune bands, the four
// element glyphs at the cardinal points and lines out to every rift. paintSigil draws it (gold on
// the cached floor, or as a white mask); drawSigilFlashes lights the sigil's lines in an element's
// colour around every reaction, so the floor itself shows the chain.
import { CELL, CORE, FIELD, THEME } from './config.js';
import { drawGlyph, GLYPH_COLORS } from './glyphs.js';

const TAU = Math.PI * 2;
const CX = (CORE.col + 0.5) * CELL;
const CY = (CORE.row + 0.5) * CELL;

/** Reaction name -> "r,g,b" of the colour its flash lights the sigil in. */
export const SIGIL_COLORS = {
  STEAM: '223,243,251',
  QUENCH: '95,212,255',
  LAVA: '255,138,42',
  MELT: '255,170,90',
  SHOCK: '127,240,255',
  FROST: '155,220,255',
  SHATTER: '190,235,255',
  MAGNET: '201,168,255',
  STORMSTEAM: '197,138,255',
  STRIKE: '230,220,255',
};

const hash = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** One small runic mark (stem plus a few strokes), rotated to lie along a ring. */
function rune(g, x, y, angle, size, seed) {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  g.beginPath();
  g.moveTo(0, -size);
  g.lineTo(0, size);
  const k = Math.floor(hash(seed) * 6);
  if (k === 0 || k === 3) {
    g.moveTo(0, -size);
    g.lineTo(size * 0.7, -size * 0.25);
  }
  if (k === 1 || k === 3) {
    g.moveTo(0, size * 0.1);
    g.lineTo(-size * 0.7, size * 0.65);
  }
  if (k === 2 || k === 4) {
    g.moveTo(-size * 0.6, -size * 0.5);
    g.lineTo(size * 0.6, size * 0.2);
  }
  if (k === 4 || k === 5) {
    g.moveTo(size * 0.65, size * 0.5);
    g.lineTo(0, size * 0.1);
  }
  g.stroke();
  g.restore();
}

/** Draw the whole sigil. mode 'gold': engraved gold with a soft glow. mode 'mask': white lines only. */
export function paintSigil(g, mode) {
  const gold = mode === 'gold';
  const stroke = (w, a) => {
    if (mode === 'ink') {
      g.strokeStyle = `rgba(58,38,20,${Math.min(1, a + 0.32)})`;
      g.lineWidth = Math.max(2, w * 1.35);
    } else if (mode === 'goldflat') {
      g.strokeStyle = `rgba(206,150,40,${Math.min(1, a + 0.2)})`;
      g.lineWidth = w * 0.8;
    } else {
      g.strokeStyle = gold ? `rgba(228,184,98,${a})` : '#ffffff';
      g.lineWidth = gold ? w : w + 1.5;
    }
    g.lineCap = 'round';
    g.lineJoin = 'round';
  };
  if (gold) {
    g.shadowColor = 'rgba(255,190,80,0.55)';
    g.shadowBlur = 7;
  }
  const ring = (r, w, a) => {
    stroke(w, a);
    g.beginPath();
    g.arc(CX, CY, r, 0, TAU);
    g.stroke();
  };
  const ticks = (r1, r2, n, a) => {
    stroke(1.2, a);
    g.beginPath();
    for (let k = 0; k < n; k += 1) {
      const t = (k / n) * TAU;
      g.moveTo(CX + Math.cos(t) * r1, CY + Math.sin(t) * r1);
      g.lineTo(CX + Math.cos(t) * r2, CY + Math.sin(t) * r2);
    }
    g.stroke();
  };
  // Concentric rings around the Core.
  ring(78, 2.6, 0.6);
  ring(90, 1.2, 0.4);
  ring(118, 2.2, 0.6);
  ring(168, 2, 0.65);
  ring(178, 1, 0.5);
  ring(228, 2.6, 0.75);
  ring(238, 1.2, 0.5);
  ring(298, 2.6, 0.7);
  ring(308, 1.2, 0.5);
  ring(380, 2, 0.55);
  ring(470, 2, 0.45);
  if (mode === 'goldflat') {
    // Filled gold segments between the paired rings.
    for (const [r1, r2, n] of [[78, 90, 12], [228, 238, 36], [298, 308, 48], [168, 178, 24]]) {
      g.fillStyle = 'rgba(214,160,44,0.8)';
      for (let k = 0; k < n; k += 2) {
        const t0 = (k / n) * TAU;
        const t1 = ((k + 1) / n) * TAU;
        g.beginPath();
        g.arc(CX, CY, r2, t0, t1);
        g.arc(CX, CY, r1, t1, t0, true);
        g.closePath();
        g.fill();
      }
    }
  }
  ticks(168, 178, 72, 0.5);
  ticks(298, 308, 96, 0.5);
  ticks(380, 392, 120, 0.4);
  // Two interlocked triangles inscribed in the 228 ring.
  for (const turn of [-Math.PI / 2, Math.PI / 2]) {
    stroke(1.8, 0.6);
    g.beginPath();
    for (let k = 0; k <= 3; k += 1) {
      const t = turn + (k / 3) * TAU;
      g[k === 0 ? 'moveTo' : 'lineTo'](CX + Math.cos(t) * 228, CY + Math.sin(t) * 228);
    }
    g.stroke();
  }
  // Rune bands between the rings.
  stroke(1.4, 0.7);
  for (const [r, n, size, seed] of [[143, 30, 6, 1], [268, 56, 8, 100], [344, 76, 7, 300]]) {
    for (let k = 0; k < n; k += 1) {
      const t = (k / n) * TAU;
      rune(g, CX + Math.cos(t) * r, CY + Math.sin(t) * r, t + Math.PI / 2, size, seed + k);
    }
  }
  // Lines out to the four rifts, double-stranded, with small diamonds where they cross the rings.
  for (const [dx, dy, reach] of [[-1, 0, 470], [1, 0, 470], [0, -1, 275], [0, 1, 290]]) {
    for (const off of [-3.5, 3.5]) {
      stroke(1.4, 0.55);
      g.beginPath();
      g.moveTo(CX + dx * 118 - dy * off, CY + dy * 118 + dx * off);
      g.lineTo(CX + dx * reach - dy * off, CY + dy * reach + dx * off);
      g.stroke();
    }
    for (const r of [178, 238, 308, 380]) {
      stroke(1.6, 0.7);
      const px = CX + dx * r;
      const py = CY + dy * r;
      g.beginPath();
      g.moveTo(px - 6, py);
      g.lineTo(px, py - 6);
      g.lineTo(px + 6, py);
      g.lineTo(px, py + 6);
      g.closePath();
      g.stroke();
    }
  }
  g.shadowBlur = 0;
  g.shadowColor = 'transparent';
  // The four element glyphs at the cardinal points, each in a medallion.
  [['fire', 0, -233], ['water', 233, 0], ['earth', 0, 233], ['storm', -233, 0]].forEach(([kind, dx, dy]) => {
    const x = CX + dx;
    const y = CY + dy;
    if (mode === 'goldflat') return;
    g.beginPath();
    g.arc(x, y, 25, 0, TAU);
    if (gold || mode === 'ink') {
      g.fillStyle = gold ? 'rgba(8,10,16,0.92)' : 'rgba(238,224,190,0.97)';
      g.fill();
    }
    stroke(2.6, 0.85);
    g.stroke();
    drawGlyph(g, kind, x, y, 14, gold || mode === 'ink' ? GLYPH_COLORS[kind] : '#ffffff', 3.4);
  });
}

let mask = null;
let lit = null;

/** Light the sigil's lines near every recent reaction, in that reaction's colour. */
export function drawSigilFlashes(ctx, fx) {
  if (fx.sigil.length === 0) return;
  if (!mask) {
    mask = document.createElement('canvas');
    mask.width = FIELD.w;
    mask.height = FIELD.h;
    paintSigil(mask.getContext('2d'), 'mask');
    lit = document.createElement('canvas');
    lit.width = FIELD.w;
    lit.height = FIELD.h;
  }
  const g = lit.getContext('2d');
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, FIELD.w, FIELD.h);
  for (const f of fx.sigil) {
    const a = Math.max(0, 1 - f.t / 1.4);
    const glow = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, 200);
    glow.addColorStop(0, `rgba(${f.color},${a})`);
    glow.addColorStop(1, `rgba(${f.color},0)`);
    g.fillStyle = glow;
    g.fillRect(f.x - 200, f.y - 200, 400, 400);
  }
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(mask, 0, 0);
  g.globalCompositeOperation = 'source-over';
  ctx.save();
  if (THEME.bright) {
    ctx.drawImage(lit, 0, 0);
    ctx.restore();
    return;
  }
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(lit, 0, 0);
  ctx.globalAlpha = 0.3;
  ctx.filter = 'blur(3px)';
  ctx.drawImage(lit, 0, 0);
  ctx.restore();
}
