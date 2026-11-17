// Small canvas drawing helpers shared by the HUD and the screens: outlined text, rounded panels,
// progress bars and number formatting.
import { FONT, PALETTE as P } from './config.js';

/** Draw outlined text. options: size, color, align, baseline, weight, outline (px, 0 for none). */
export function drawText(ctx, str, x, y, options = {}) {
  const size = options.size ?? 18;
  ctx.font = `${options.weight ?? 800} ${size}px ${FONT}`;
  ctx.textAlign = options.align ?? 'left';
  ctx.textBaseline = options.baseline ?? 'alphabetic';
  const outline = options.outline ?? Math.max(2, size / 7);
  if (outline > 0) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = outline;
    ctx.strokeStyle = options.outlineColor ?? '#05060a';
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = options.color ?? P.text;
  ctx.fillText(str, x, y);
}

/** A rounded, filled, outlined panel. */
export function drawPanel(ctx, x, y, w, h, options = {}) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, options.radius ?? 10);
  ctx.fillStyle = options.fill ?? P.panel;
  ctx.fill();
  ctx.lineWidth = options.lineWidth ?? 2;
  ctx.strokeStyle = options.edge ?? P.panelEdge;
  ctx.stroke();
}

/** A horizontal progress bar filled to `ratio` (0-1). */
export function drawBar(ctx, x, y, w, h, ratio, color, back = '#1a1f2c') {
  ctx.fillStyle = back;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.max(0, Math.min(1, ratio)) * w, h);
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

export const formatNumber = (n) => Math.round(n).toLocaleString('en-US');
