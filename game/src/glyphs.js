// The arcane-alchemy visual language: each element has an alchemical glyph (fire: upward triangle,
// water: downward triangle, earth: downward triangle with a bar, storm: upward triangle with a
// bar) and so do the reaction products and the boons. Glyphs are drawn as crisp strokes, and are
// used on the brushes, etched into painted materials, on the reaction chart and on boon cards.

export const GLYPH_COLORS = {
  fire: '#ff6a2a', water: '#2ec8ff', earth: '#b98a4a', storm: '#ffe23a', steam: '#dff3fb', lava: '#ff8a2a', shock: '#5ff0ff',
  cloud: '#c58aff', magnet: '#ff7a9a', ice: '#dff6ff', frost: '#dff6ff', ring: '#ffd24a', shield: '#7fe9ff', hourglass: '#d9b36a',
  cross: '#ff7aa0', spiral: '#c58aff', crown: '#ff4a5e',
};

function tri(ctx, s, up) {
  const d = up ? -1 : 1;
  ctx.beginPath();
  ctx.moveTo(0, d * s);
  ctx.lineTo(s * 0.9, -d * s * 0.62);
  ctx.lineTo(-s * 0.9, -d * s * 0.62);
  ctx.closePath();
}

/**
 * Stroke glyph `kind` centred at (x, y), `s` pixels from centre to tip. Elements use the
 * alchemical triangles; products and boons use simple line symbols in the same style.
 */
export function drawGlyph(ctx, kind, x, y, s, color = GLYPH_COLORS[kind], lw = 3) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  switch (kind) {
    case 'fire':
      tri(ctx, s, true);
      ctx.stroke();
      break;
    case 'water':
      tri(ctx, s, false);
      ctx.stroke();
      break;
    case 'earth':
      tri(ctx, s, false);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-s * 0.7, -s * 0.1);
      ctx.lineTo(s * 0.7, -s * 0.1);
      ctx.stroke();
      break;
    case 'storm':
      tri(ctx, s, true);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-s * 0.72, s * 0.1);
      ctx.lineTo(s * 0.72, s * 0.1);
      ctx.stroke();
      break;
    case 'steam':
      for (const dy of [-0.5, 0, 0.5]) {
        ctx.beginPath();
        ctx.moveTo(-s * 0.8, dy * s);
        ctx.quadraticCurveTo(-s * 0.4, dy * s - s * 0.35, 0, dy * s);
        ctx.quadraticCurveTo(s * 0.4, dy * s + s * 0.35, s * 0.8, dy * s);
        ctx.stroke();
      }
      break;
    case 'lava':
      tri(ctx, s, true);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, s * 0.12, s * 0.22, 0, 6.283);
      ctx.fill();
      break;
    case 'shock':
      ctx.beginPath();
      ctx.moveTo(s * 0.3, -s);
      ctx.lineTo(-s * 0.55, s * 0.1);
      ctx.lineTo(0, s * 0.1);
      ctx.lineTo(-s * 0.3, s);
      ctx.lineTo(s * 0.6, -s * 0.2);
      ctx.lineTo(0.02 * s, -s * 0.2);
      ctx.closePath();
      ctx.stroke();
      break;
    case 'cloud':
      ctx.beginPath();
      ctx.arc(-s * 0.4, s * 0.1, s * 0.4, Math.PI * 0.5, Math.PI * 1.5);
      ctx.arc(0, -s * 0.2, s * 0.5, Math.PI, 0);
      ctx.arc(s * 0.45, s * 0.1, s * 0.38, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.closePath();
      ctx.stroke();
      break;
    case 'magnet':
      ctx.beginPath();
      ctx.arc(0, -s * 0.1, s * 0.62, Math.PI, 0);
      ctx.lineTo(s * 0.62, s * 0.7);
      ctx.moveTo(-s * 0.62, -s * 0.1);
      ctx.lineTo(-s * 0.62, s * 0.7);
      ctx.stroke();
      break;
    case 'ice':
    case 'frost':
      for (let a = 0; a < 3; a += 1) {
        ctx.save();
        ctx.rotate((a * Math.PI) / 3);
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(0, s);
        ctx.stroke();
        ctx.restore();
      }
      break;
    case 'ring':
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.8, 0, 6.283);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.25, 0, 6.283);
      ctx.fill();
      break;
    case 'shield':
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.8, -s * 0.5);
      ctx.quadraticCurveTo(s * 0.8, s * 0.6, 0, s);
      ctx.quadraticCurveTo(-s * 0.8, s * 0.6, -s * 0.8, -s * 0.5);
      ctx.closePath();
      ctx.stroke();
      break;
    case 'hourglass':
      ctx.beginPath();
      ctx.moveTo(-s * 0.7, -s * 0.9);
      ctx.lineTo(s * 0.7, -s * 0.9);
      ctx.lineTo(-s * 0.7, s * 0.9);
      ctx.lineTo(s * 0.7, s * 0.9);
      ctx.closePath();
      ctx.stroke();
      break;
    case 'crown':
      ctx.beginPath();
      ctx.moveTo(-s * 0.9, s * 0.65);
      ctx.lineTo(-s * 0.9, -s * 0.5);
      ctx.lineTo(-s * 0.4, 0);
      ctx.lineTo(0, -s * 0.85);
      ctx.lineTo(s * 0.4, 0);
      ctx.lineTo(s * 0.9, -s * 0.5);
      ctx.lineTo(s * 0.9, s * 0.65);
      ctx.closePath();
      ctx.stroke();
      break;
    case 'cross':
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.9);
      ctx.lineTo(0, s * 0.9);
      ctx.moveTo(-s * 0.9, 0);
      ctx.lineTo(s * 0.9, 0);
      ctx.stroke();
      break;
    default:
      ctx.beginPath();
      for (let a = 0; a < 12; a += 0.3) ctx[a === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * s * (a / 12) * 0.9, Math.sin(a) * s * (a / 12) * 0.9);
      ctx.stroke();
  }
  ctx.restore();
}

/** A dark rounded tile with a coloured border and a glyph inside, `size` pixels square at (x, y). */
export function drawGlyphTile(ctx, kind, x, y, size, color = GLYPH_COLORS[kind]) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x - size / 2, y - size / 2, size, size, size * 0.22);
  ctx.fillStyle = '#0a0d15';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, size / 14);
  ctx.stroke();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, size * 0.42, 0, 6.283);
  ctx.fill();
  ctx.restore();
  drawGlyph(ctx, kind, x, y, size * 0.3, color, Math.max(2, size / 13));
}

/** Thin gold filigree corners over a panel: a short corner stroke with a curl and a small diamond. */
export function drawFiligree(ctx, x, y, w, h, color = '#d4aa55') {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
    ctx.beginPath();
    ctx.moveTo(cx + sx * 4, cy + sy * 20);
    ctx.lineTo(cx + sx * 4, cy + sy * 7);
    ctx.quadraticCurveTo(cx + sx * 4, cy + sy * 4, cx + sx * 7, cy + sy * 4);
    ctx.lineTo(cx + sx * 20, cy + sy * 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + sx * 11, cy + sy * 11, 3.2, 0, 6.283);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + sx * 4, cy + sy * 4);
    ctx.lineTo(cx + sx * 9, cy + sy * 4);
    ctx.lineTo(cx + sx * 4, cy + sy * 9);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
