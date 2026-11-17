// Procedural creature art, drawn with canvas paths: nothing is loaded. Used on the battlefield and,
// at small sizes, for the incoming-queue icons in the HUD. `st` is the creature (or {}).
import { drawColossus } from './colossus.js';

const TAU = Math.PI * 2;

/** Each creature's element-coloured glow. */
const GLOW_COLORS = {
  imp: 'rgba(255,90,30,0.4)',
  golem: 'rgba(160,200,70,0.28)',
  wraith: 'rgba(170,110,255,0.45)',
  beetle: 'rgba(255,230,60,0.4)',
  swarm: 'rgba(255,140,40,0.4)',
  ram: 'rgba(150,190,255,0.3)',
};

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
}

function outlined(ctx, fill, line, width) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = width;
  ctx.strokeStyle = line;
  ctx.stroke();
}

function eyes(ctx, r, face, color, spread = 0.38, y = -0.12) {
  ctx.fillStyle = color;
  for (const side of [-1, 1]) {
    circle(ctx, (side * spread + face * 0.1) * r, y * r, r * 0.16);
    ctx.fill();
  }
}

const painters = {
  imp(ctx, r, t, st, c) {
    const flick = Math.sin(t * 14) * 0.15;
    ctx.fillStyle = c('#ffb347');
    ctx.beginPath();
    ctx.moveTo(-r * 0.4, -r * 0.7);
    ctx.quadraticCurveTo(-r * 0.2, -r * (1.5 + flick), 0, -r * 1.05);
    ctx.quadraticCurveTo(r * 0.3, -r * (1.7 - flick), r * 0.45, -r * 0.7);
    ctx.fill();
    ctx.fillStyle = c('#7a1a0a');
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * r * 0.45, -r * 0.6);
      ctx.lineTo(side * r * 0.95, -r * 1.15);
      ctx.lineTo(side * r * 0.75, -r * 0.35);
      ctx.fill();
    }
    circle(ctx, 0, 0, r);
    outlined(ctx, c('#e2431f'), '#2b0803', 2);
    eyes(ctx, r, st.face ?? 1, c('#ffee88'));
    ctx.fillStyle = '#2b0803';
    ctx.fillRect(-r * 0.3, r * 0.25, r * 0.6, r * 0.14);
  },
  golem(ctx, r, t, st, c) {
    ctx.beginPath();
    ctx.roundRect(-r * 1.0, -r * 0.95, r * 2, r * 1.9, r * 0.35);
    outlined(ctx, c('#6d4d2a'), '#1b1208', 2.5);
    ctx.fillStyle = c('#5f8f3a');
    ctx.fillRect(-r * 0.8, -r * 0.95, r * 0.7, r * 0.3);
    ctx.fillRect(r * 0.2, r * 0.5, r * 0.6, r * 0.3);
    ctx.fillStyle = c('#4a3720');
    ctx.fillRect(-r * 1.25, -r * 0.2, r * 0.3, r * 0.9);
    ctx.fillRect(r * 0.95, -r * 0.2, r * 0.3, r * 0.9);
    ctx.fillStyle = c('#ffb347');
    ctx.fillRect(-r * 0.55, -r * 0.35, r * 0.35, r * 0.22);
    ctx.fillRect(r * 0.2, -r * 0.35, r * 0.35, r * 0.22);
    if (st.gnawing) {
      ctx.fillStyle = '#1b1208';
      ctx.fillRect(-r * 0.4, r * 0.15, r * 0.8, r * 0.25);
    }
  },
  wraith(ctx, r, t, st, c) {
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(-r * 0.95, r * 0.9);
    ctx.lineTo(-r * 0.95, -r * 0.1);
    ctx.arc(0, -r * 0.1, r * 0.95, Math.PI, 0);
    ctx.lineTo(r * 0.95, r * 0.9);
    for (let i = 4; i >= 0; i -= 1) {
      ctx.lineTo(-r * 0.95 + (i / 4) * r * 1.9 - r * 0.2, r * (1.1 + Math.sin(t * 6 + i) * 0.25));
    }
    ctx.closePath();
    outlined(ctx, c('#cdbcff'), '#3b2a73', 2.2);
    ctx.restore();
    ctx.fillStyle = '#221244';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(side * r * 0.38, -r * 0.2, r * 0.17, r * 0.28, 0, 0, TAU);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(166,92,255,0.25)';
    circle(ctx, 0, 0, r * 1.5);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  },
  beetle(ctx, r, t, st, c) {
    const charge = st.charge ?? 0;
    if (charge > 0.05) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,226,58,${0.15 + charge * 0.35})`;
      circle(ctx, 0, 0, r * (1.4 + charge * 1.4 + Math.sin(t * 30) * 0.1));
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.strokeStyle = '#231b00';
    ctx.lineWidth = 2;
    for (const side of [-1, 1]) {
      for (let i = -1; i <= 1; i += 1) {
        ctx.beginPath();
        ctx.moveTo(side * r * 0.5, i * r * 0.4);
        ctx.lineTo(side * r * 1.2, i * r * 0.7 + Math.sin(t * 12 + i) * 2);
        ctx.stroke();
      }
    }
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.85, r, 0, 0, TAU);
    outlined(ctx, c(charge > 0.5 && Math.sin(t * 28) > 0 ? '#ffffff' : '#e8c321'), '#231b00', 2.2);
    ctx.fillStyle = '#231b00';
    ctx.fillRect(-r * 0.85, -r * 0.1, r * 1.7, r * 0.22);
    circle(ctx, 0, -r * 0.95, r * 0.4);
    ctx.fill();
    ctx.fillStyle = c('#ffe23a');
    circle(ctx, -r * 0.15, -r * 1.0, r * 0.1);
    ctx.fill();
    circle(ctx, r * 0.15, -r * 1.0, r * 0.1);
    ctx.fill();
  },
  swarm(ctx, r, t, st, c) {
    for (let i = 0; i < 3; i += 1) {
      const a = t * 5 + i * 2.1;
      const x = Math.cos(a) * r * 0.9;
      const y = Math.sin(a * 1.3) * r * 0.9;
      circle(ctx, x, y, r * 0.55);
      outlined(ctx, c('#ff7a2a'), '#4a1404', 1.6);
      ctx.fillStyle = c('#ffe9a8');
      circle(ctx, x, y, r * 0.22);
      ctx.fill();
    }
  },
  ram(ctx, r, t, st, c) {
    ctx.strokeStyle = c('#e8dcc0');
    ctx.lineWidth = r * 0.28;
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(side * r * 0.75, -r * 0.35, r * 0.62, side > 0 ? -1.2 : Math.PI - 0.2, side > 0 ? 3.1 : 4.4, side < 0);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.95, r * 0.85, 0, 0, TAU);
    outlined(ctx, c('#8c919e'), '#1d2028', 2.5);
    ctx.fillStyle = c('#5b606d');
    ctx.fillRect(-r * 0.5, r * 0.1, r * 1.0, r * 0.5);
    eyes(ctx, r, st.face ?? 1, c('#ff6a3a'), 0.4, -0.2);
  },
};

/**
 * Draw creature `kindId` centred at canvas pixel (x, y) with body radius `r` pixels.
 * `t` is time in seconds for animation; `st` carries flash, frozen, charge, plates, exposed.
 */
export function drawCreatureSprite(ctx, kindId, x, y, r, t, st) {
  const flashing = (st.flash ?? 0) > 0;
  const c = (color) => (flashing ? '#ffffff' : color);
  ctx.save();
  ctx.translate(x, y);
  if (kindId !== 'colossus') {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.95, r * 1.0, r * 0.3, 0, 0, TAU);
    ctx.fill();
    const glow = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 2);
    glow.addColorStop(0, GLOW_COLORS[kindId]);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = glow;
    ctx.fillRect(-r * 2, -r * 2, r * 4, r * 4);
    ctx.globalCompositeOperation = 'source-over';
  }
  if (kindId === 'colossus') drawColossus(ctx, r, t, st);
  else {
    const bob = kindId === 'golem' || kindId === 'ram' ? Math.sin(t * 6) * r * 0.05 : Math.sin(t * 9) * r * 0.08;
    ctx.translate(0, bob);
    painters[kindId](ctx, r, t, st, c);
  }
  if ((st.frozen ?? 0) > 0) {
    ctx.globalAlpha = 0.65;
    ctx.fillStyle = '#bfeaff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-r * 1.1, -r * 1.1, r * 2.2, r * 2.2, r * 0.3);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if ((st.steamed ?? 0) > 0) {
    ctx.fillStyle = 'rgba(230,245,250,0.45)';
    circle(ctx, 0, -r * 0.2, r * 1.2);
    ctx.fill();
  }
  ctx.restore();
}
