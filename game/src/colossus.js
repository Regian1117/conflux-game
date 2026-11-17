// The Hollow Colossus's art: a stone and crystal titan with a hollow glowing chest, drawn with
// canvas paths. Its four armour plates (config PLATES) are drawn as glowing slabs in the colour
// of the reaction that breaks them; broken ones are gone and their shards fall away.
import { PLATES } from './config.js';

const TAU = Math.PI * 2;
const STONE = ['#3a4066', '#1b1f33'];

function limb(ctx, x1, y1, x2, y2, width) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#05060a';
  ctx.lineWidth = width + 5;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.strokeStyle = '#2f3556';
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(190,200,255,0.25)';
  ctx.lineWidth = width * 0.25;
  ctx.beginPath();
  ctx.moveTo(x1 - width * 0.2, y1);
  ctx.lineTo(x2 - width * 0.2, y2);
  ctx.stroke();
}

/** Outline of armour plate `i` in unit `u`: left pauldron, right pauldron, chest slab, helm. */
function plateShape(ctx, i, u) {
  const shapes = [
    [[-1.75, -1.35], [-0.95, -1.6], [-0.85, -0.95], [-1.6, -0.8]],
    [[1.75, -1.35], [0.95, -1.6], [0.85, -0.95], [1.6, -0.8]],
    [[-0.62, -1.0], [0.62, -1.0], [0.5, -0.1], [0, 0.1], [-0.5, -0.1]],
    [[-0.5, -2.0], [0.5, -2.0], [0.62, -2.3], [0, -2.55], [-0.62, -2.3]],
  ];
  ctx.beginPath();
  shapes[i].forEach(([x, y], k) => ctx[k === 0 ? 'moveTo' : 'lineTo'](x * u, y * u));
  ctx.closePath();
}

function drawPlate(ctx, i, u, t, current) {
  ctx.save();
  plateShape(ctx, i, u);
  ctx.fillStyle = PLATES[i].color;
  ctx.globalAlpha = current ? 0.78 + Math.sin(t * 8) * 0.2 : 0.62;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#05060a';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (current) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 6;
    ctx.strokeStyle = PLATES[i].color;
    ctx.globalAlpha = 0.5;
    ctx.stroke();
  }
  ctx.restore();
}

function fallingShards(ctx, i, u, since) {
  const [px, py] = [[-1.3, -1.2], [1.3, -1.2], [0, -0.5], [0, -2.3]][i];
  ctx.fillStyle = PLATES[i].color;
  ctx.globalAlpha = 1 - since / 1.8;
  for (let k = 0; k < 5; k += 1) {
    const fx = px * u + (k - 2) * 0.35 * u * (1 + since);
    const fy = py * u + since * since * 1.5 * u + k * 0.05 * u;
    ctx.beginPath();
    ctx.moveTo(fx, fy - 0.16 * u);
    ctx.lineTo(fx + 0.14 * u, fy + 0.12 * u);
    ctx.lineTo(fx - 0.14 * u, fy + 0.1 * u);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawLegsAndArms(ctx, u, t, st, flash, exposed, ruin) {
  for (const side of [-1, 1]) {
    const lift = ruin ? 0 : Math.max(0, Math.sin(t * 1.8 + (side > 0 ? 0 : Math.PI))) * 0.14 * u;
    ctx.fillStyle = flash ? '#fff' : '#242842';
    ctx.strokeStyle = '#05060a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(side * 0.55 * u - 0.38 * u, -0.05 * u - lift, 0.76 * u, 1.0 * u, 0.12 * u);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#3a4066';
    ctx.beginPath();
    ctx.roundRect(side * 0.55 * u - 0.5 * u, 0.78 * u - lift, 1.0 * u, 0.24 * u, 0.08 * u);
    ctx.fill();
    ctx.stroke();
  }
  for (const side of [-1, 1]) {
    const swing = ruin ? 0.1 : Math.sin(t * 1.8 + (side > 0 ? Math.PI : 0)) * 0.28;
    const sx = side * 1.3 * u;
    const sy = -1.05 * u;
    const ex = side * 1.65 * u + swing * 0.3 * u;
    const ey = -0.2 * u;
    const fx = side * 1.55 * u + swing * 0.9 * u;
    const fy = 0.55 * u + Math.abs(swing) * 0.1 * u;
    limb(ctx, sx, sy, ex, ey, 0.5 * u);
    limb(ctx, ex, ey, fx, fy, 0.46 * u);
    ctx.fillStyle = flash ? '#fff' : '#3a4066';
    ctx.strokeStyle = '#05060a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(fx, fy + 0.15 * u, 0.36 * u, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = exposed ? '#ffb347' : '#a65cff';
    for (let k = -1; k <= 1; k += 1) {
      ctx.beginPath();
      ctx.moveTo(fx + k * 0.16 * u - 0.07 * u, fy + 0.38 * u);
      ctx.lineTo(fx + k * 0.16 * u, fy + 0.6 * u);
      ctx.lineTo(fx + k * 0.16 * u + 0.07 * u, fy + 0.38 * u);
      ctx.fill();
    }
  }
}

function drawTorso(ctx, u, t, flash, exposed, ruin) {
  const body = ctx.createLinearGradient(0, -1.4 * u, 0, 0.1 * u);
  body.addColorStop(0, STONE[0]);
  body.addColorStop(1, STONE[1]);
  ctx.beginPath();
  ctx.moveTo(-1.25 * u, -1.35 * u);
  ctx.lineTo(1.25 * u, -1.35 * u);
  ctx.lineTo(0.8 * u, 0.08 * u);
  ctx.lineTo(-0.8 * u, 0.08 * u);
  ctx.closePath();
  ctx.fillStyle = flash ? '#fff' : body;
  ctx.fill();
  ctx.strokeStyle = '#05060a';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(190,200,255,0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-1.15 * u, -1.28 * u);
  ctx.lineTo(1.15 * u, -1.28 * u);
  ctx.stroke();
  const core = ctx.createRadialGradient(0, -0.55 * u, 0.05 * u, 0, -0.55 * u, 0.5 * u);
  core.addColorStop(0, ruin ? '#3a3040' : exposed ? '#fff2b0' : '#e4d0ff');
  core.addColorStop(0.35, ruin ? '#1a1620' : exposed ? '#ff9a2a' : '#9a5cff');
  core.addColorStop(1, '#05060a');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, -0.55 * u, 0.5 * u, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = ruin ? '#3a4066' : exposed ? '#ffd24a' : '#c9b0ff';
  ctx.lineWidth = 3;
  ctx.stroke();
  if (!ruin) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = exposed ? `rgba(255,150,50,${0.45 + Math.sin(t * 9) * 0.2})` : 'rgba(166,92,255,0.35)';
    ctx.beginPath();
    ctx.arc(0, -0.55 * u, 0.62 * u, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
}

function drawHead(ctx, u, flash, exposed, ruin) {
  ctx.fillStyle = flash ? '#fff' : '#2a2f4e';
  ctx.strokeStyle = '#05060a';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(-0.52 * u, -2.15 * u + (ruin ? 0.1 * u : 0), 1.04 * u, 0.82 * u, 0.14 * u);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = ruin ? '#4a4f78' : exposed ? '#ffb347' : '#b78cff';
  for (const [cx, h] of [[-0.4, 0.5], [-0.14, 0.75], [0.14, 0.75], [0.4, 0.5]]) {
    ctx.beginPath();
    ctx.moveTo(cx * u - 0.1 * u, -2.12 * u);
    ctx.lineTo(cx * u, (-2.12 - h) * u);
    ctx.lineTo(cx * u + 0.1 * u, -2.12 * u);
    ctx.fill();
  }
  if (ruin) return;
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = exposed ? '#ffd24a' : '#e8d4ff';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * 0.24 * u, -1.8 * u, 0.15 * u, 0.08 * u, side * 0.25, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(side * 0.24 * u, -1.8 * u, 0.3 * u, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.globalCompositeOperation = 'source-over';
}

/**
 * Draw the Colossus centred on the current origin, `u` pixels per unit (about 3.3 units tall).
 * `st` is the creature: plates (broken count), plateT (when each broke), exposed, flash, age;
 * `st.ruin` draws the dark, cracked husk used behind the win screen.
 */
export function drawColossus(ctx, u, t, st) {
  const broken = st.plates ?? 0;
  const exposed = (st.exposed ?? 0) > 0;
  const ruin = Boolean(st.ruin);
  const flash = (st.flash ?? 0) > 0;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.ellipse(0, 1.0 * u, 1.9 * u, 0.42 * u, 0, 0, TAU);
  ctx.fill();
  const aura = ctx.createRadialGradient(0, -0.8 * u, 0.3 * u, 0, -0.8 * u, 2.6 * u);
  aura.addColorStop(0, ruin ? 'rgba(255,210,120,0.35)' : exposed ? 'rgba(255,150,40,0.6)' : 'rgba(166,92,255,0.5)');
  aura.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = aura;
  ctx.fillRect(-2.7 * u, -3.4 * u, 5.4 * u, 5.4 * u);
  ctx.globalCompositeOperation = 'source-over';
  ctx.translate(0, ruin ? 0.25 * u : -Math.abs(Math.sin(t * 1.8)) * 0.04 * u);
  drawLegsAndArms(ctx, u, t, st, flash, exposed, ruin);
  drawTorso(ctx, u, t, flash, exposed, ruin);
  drawHead(ctx, u, flash, exposed, ruin);
  for (let i = 0; i < PLATES.length; i += 1) {
    if (ruin) continue;
    if (i >= broken) drawPlate(ctx, i, u, t, i === broken && !exposed);
    else {
      const since = (st.age ?? 0) - ((st.plateT ?? [])[i] ?? -9);
      if (since >= 0 && since < 1.8) fallingShards(ctx, i, u, since);
    }
  }
}
