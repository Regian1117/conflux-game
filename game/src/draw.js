// Small canvas drawing helpers shared by the HUD and the screens: outlined text, rounded panels,
// progress bars and number formatting.
import { FONT, PALETTE as P, THEME } from './config.js';

let inkText = false;
/** While on (bright theme only), light text colours are darkened to ink so they read on parchment plates. */
export function setInkText(on) {
  inkText = on && THEME.bright;
}

function inkColor(c) {
  const m = /^#([0-9a-f]{6})$/i.exec(c ?? '');
  if (!m) return '#2B2118';
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (r > 235 && g > 235 && b > 235) return '#2B2118';
  if (lum <= 0.45) return c;
  const k = 0.4 / lum;
  return `rgb(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)})`;
}

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
    ctx.strokeStyle = options.outlineColor ?? (inkText && !options.raw ? '#f3e9cc' : '#05060a');
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = inkText && !options.raw ? inkColor(options.color ?? P.text) : options.color ?? P.text;
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
