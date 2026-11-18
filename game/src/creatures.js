// The rift creatures: their stats and weaknesses, spawning, walking, status effects (steam blinds,
// ice freezes, magnetite pulls, water soaks), taking damage from the cell they stand in, dying,
// and reaching the Core. Boss-specific behaviour lives in boss.js.
import { CELL, COLS, CORE, GATES, MAX_CREATURES, ROWS } from './config.js';
import { CHARGED, EARTH, ELEMENTS, EMPTY, ICE, LAVA, MAGNET, STEAM, STORM, WATER } from './elements.js';
import { clearRadius, inGrid, setCell, toScreenX, toScreenY } from './grid.js';
import { flowDirection } from './pathing.js';
import { addShake, addText, burst } from './particles.js';
import { addScore, damageCore } from './score.js';
import { sfx } from './audio.js';
import { drawCreatureSprite } from './sprites.js';

/**
 * Creature stats. `mul` scales damage by element class (fire, water, storm, ice; `lava` overrides
 * fire for lava cells); a missing class means 1. A multiplier of 0 is an immunity.
 */
export const KINDS = {
  imp: { name: 'Cinder Imp', plural: 'Cinder Imps', hp: 44, speed: 2.3, r: 0.7, core: 5, pts: 60, mul: { fire: 0, water: 6 }, tip: 'Immune to fire. Drown it in WATER.' },
  golem: { name: 'Mud Golem', plural: 'Mud Golems', hp: 280, speed: 0.95, r: 1.0, core: 10, pts: 160, gnaw: 14, mul: { fire: 0.5, water: 0.25, storm: 0.5 }, tip: 'Slow and tanky. Freeze it, then shatter it.' },
  wraith: { name: 'Mist Wraith', plural: 'Mist Wraiths', hp: 85, speed: 1.9, r: 0.75, core: 6, pts: 120, flies: true, mul: { fire: 0, water: 0, ice: 0, storm: 1.2 }, tip: 'Floats over walls. Only STORM hurts it.' },
  beetle: { name: 'Spark Beetle', plural: 'Spark Beetles', hp: 50, speed: 2.1, r: 0.65, core: 8, pts: 100, mul: { fire: 1.4, storm: 0 }, tip: 'Charges near storm, then explodes. Burn it first.' },
  swarm: { name: 'Ember Swarm', plural: 'Ember Swarm', hp: 15, speed: 2.8, r: 0.45, core: 2, pts: 18, mul: { fire: 0.3, water: 1.6, storm: 1.5 }, tip: 'Dozens of tiny embers. Chain them.' },
  ram: { name: 'Stone Ram', plural: 'Stone Rams', hp: 170, speed: 1.6, r: 0.9, core: 9, pts: 140, smash: true, mul: { fire: 0.4, lava: 1.5 }, tip: 'Smashes earth walls. Lava melts it.' },
  colossus: { name: 'Hollow Colossus', plural: 'Hollow Colossus', hp: 1300, speed: 0.55, r: 4.2, core: 35, pts: 3000, straight: true, noFreeze: true, boss: true, mul: {}, tip: 'Break its armour plates in order.' },
};

const dir = { x: 0, y: 0 };
const DEATH_COLORS = {
  imp: ['#ff5a1f', '#ffb347', '#ffe27a'],
  golem: ['#8a6a3a', '#6aa23a', '#c9a36a'],
  wraith: ['#c58aff', '#ffffff', '#8f5cff'],
  beetle: ['#ffe23a', '#ffffff', '#ffa43a'],
  swarm: ['#ff7a2a', '#ffd24a'],
  ram: ['#aab4cc', '#e8dcc0', '#ff6a3a'],
  colossus: ['#c58aff', '#ffd24a', '#ffffff', '#ff6a1f'],
};

/** Walk out of a rift gate; returns the new creature (also pushed to game.creatures). */
export function spawnCreature(game, kindId, gateKey, hpMul = 1) {
  if (game.creatures.length >= MAX_CREATURES) return null;
  const kind = KINDS[kindId];
  const gate = GATES[gateKey];
  const jitter = game.rng.range(-1.4, 1.4);
  const horizontal = gateKey === 'W' || gateKey === 'E';
  const x = horizontal ? gate.col + 0.5 + (gateKey === 'W' ? 1.2 : -1.2) : gate.col + 0.5 + jitter;
  const y = horizontal ? gate.row + 0.5 + jitter : gate.row + 0.5 + (gateKey === 'N' ? 1.2 : -1.2);
  const hp = Math.round(kind.hp * (kind.boss ? 1 : hpMul));
  const creature = {
    id: game.nextId++, kind: kindId, x, y, hp, maxHp: hp, age: 0, flash: 0, face: gateKey === 'W' ? 1 : -1,
    frozen: 0, frozenCd: 0, steamed: 0, wet: 0, stun: 0, charge: 0, gnawing: false, dmgAcc: 0, dmgTimer: 0,
    plates: 0, exposed: 0, stompTimer: 7, stompWarn: 0, crushTimer: 0, vx: 0, vy: 0, gate: gateKey,
  };
  game.creatures.push(creature);
  if (!game.seen[kindId]) {
    game.seen[kindId] = true;
    game.tip = { text: `${kind.name.toUpperCase()}: ${kind.tip}`, timer: 7, kind: kindId };
  }
  burst(game.fx, 'ember', toScreenX(x), toScreenY(y), kind.boss ? 40 : 6, ['#c58aff', '#8f5cff', '#ffffff']);
  return creature;
}

/** Damage multiplier for a creature taking damage of this element class from this cell type. */
function multiplier(c, cls, type) {
  const kind = KINDS[c.kind];
  let m = kind.mul[cls] ?? 1;
  if (type === LAVA && kind.mul.lava !== undefined) m = kind.mul.lava;
  if (cls === 'storm' && c.wet > 0) m *= 1.4;
  if (c.frozen > 0 && c.kind === 'golem' && cls !== 'ice') m *= 6;
  if (kind.boss && c.exposed <= 0) m *= 0.03;
  return m;
}

/** Hurt a creature with `base` damage of an element class; returns the damage it really took. */
export function damageCreature(game, c, base, cls, type = 0) {
  if (c.hp <= 0) return 0;
  const dealt = base * multiplier(c, cls, type) * (cls === 'storm' ? 1 + (game.mods.stormBonus ?? 0) : 1) * (cls === 'fire' && game.omen === 0 ? 1.25 : 1);
  if (dealt <= 0) return 0;
  c.hp -= dealt;
  if (dealt >= 4) c.flash = 0.1;
  if (dealt >= 5 && (c.numberAt ?? 0) <= game.t) {
    c.numberAt = game.t + 0.3;
    addText(game.fx, toScreenX(c.x) + 14, toScreenY(c.y) + 8, `-${Math.round(dealt)}`, { size: 13, color: '#ffffff', life: 0.55, vy: -26 });
  }
  c.dmgAcc += dealt;
  if (c.hp <= 0) killCreature(game, c);
  return dealt;
}

/** Damage every creature within `radius` cells of (x, y). */
export function damageArea(game, x, y, radius, amount, cls) {
  let hits = 0;
  for (const c of game.creatures) {
    if (c.hp <= 0) continue;
    if (Math.hypot(c.x - x, c.y - y) <= radius + KINDS[c.kind].r) {
      damageCreature(game, c, amount, cls, 0);
      if (cls === 'ice' || cls === 'storm') c.dmgTimer = 0;
      hits += 1;
    }
  }
  return hits;
}

function killCreature(game, c) {
  const kind = KINDS[c.kind];
  c.hp = 0;
  c.dead = true;
  game.stats.kills += 1;
  game.stats.byKind[c.kind] = (game.stats.byKind[c.kind] ?? 0) + 1;
  const px = toScreenX(c.x);
  const py = toScreenY(c.y);
  const points = addScore(game, kind.pts, undefined);
  addText(game.fx, px, py - 12, `+${points}`, { color: '#ffe9a8', size: kind.boss ? 46 : kind.pts > 100 ? 24 : 17, life: kind.boss ? 2 : 0.9 });
  const gain = (1.5 + kind.pts / 22) * (1 + (game.mods.siphon ?? 0));
  for (let i = 0; i < 4; i += 1) game.essence[i] = Math.min(game.mods.essenceMax, game.essence[i] + gain);
  const shatter = c.frozen > 0;
  const palette = DEATH_COLORS[c.kind];
  burst(game.fx, shatter ? 'shard' : 'spark', px, py, kind.boss ? 80 : shatter ? 18 : 16, shatter ? undefined : palette);
  burst(game.fx, 'ember', px, py, kind.boss ? 40 : 8, palette);
  burst(game.fx, 'spark', px, py, kind.boss ? 50 : 6);
  if (shatter) addText(game.fx, px, py - 30, 'SHATTERED!', { color: '#dff6ff', size: 24, life: 1.2 });
  addShake(game.fx, kind.boss ? 14 : kind.hp > 150 ? 5 : 1.5);
  sfx.kill(kind.hp > 150);
}

/** The Spark Beetle's blast: wipes painted cells around it and dents the Core if close. */
function explodeBeetle(game, c) {
  const px = toScreenX(c.x);
  const py = toScreenY(c.y);
  const wiped = clearRadius(game.grid, c.x, c.y, 2.8);
  burst(game.fx, 'spark', px, py, 34, ['#ffe23a', '#ffffff', '#ffa43a']);
  burst(game.fx, 'zap', px, py, 20);
  addText(game.fx, px, py - 20, wiped > 0 ? 'OVERLOAD!' : 'BOOM', { color: '#ffe23a', size: 28, life: 1 });
  addShake(game.fx, 8);
  sfx.strike();
  if (Math.hypot(c.x - (CORE.col + 0.5), c.y - (CORE.row + 0.5)) < 3.8) damageCore(game, KINDS.beetle.core);
  c.hp = 0;
  c.dead = true;
}

function coreDistance(c) {
  return Math.hypot(c.x - (CORE.col + 0.5), c.y - (CORE.row + 0.5));
}

/** The nearest magnetite cell within `range` cells, or null. */
function nearestMagnet(game, c, range) {
  let best = null;
  let bestDist = range;
  for (const m of game.magnets) {
    const d = Math.hypot(m.x - c.x, m.y - c.y);
    if (d < bestDist) {
      bestDist = d;
      best = m;
    }
  }
  return best;
}

/** What the cells under a creature do to it this step. `weight` splits damage across sample points. */
function applyCell(game, c, type, weight, dt) {
  if (type === EMPTY) return;
  const el = ELEMENTS[type];
  if (el.dps > 0) damageCreature(game, c, el.dps * weight * dt, el.cls, type);
  if (type === STEAM) c.steamed = 0.35;
  else if (type === WATER || type === CHARGED) c.wet = 1.4;
  else if (type === ICE && c.frozenCd <= 0 && c.frozen <= 0 && !KINDS[c.kind].noFreeze) {
    c.frozen = 2.8;
    c.frozenCd = 6;
    burst(game.fx, 'shard', toScreenX(c.x), toScreenY(c.y), 8);
    addText(game.fx, toScreenX(c.x), toScreenY(c.y) - 22, 'FROZEN', { color: '#dff6ff', size: 16, life: 0.9 });
  }
}

const OFFSETS = [[0, 0], [0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]];

export function updateCreatures(game, dt) {
  const grid = game.grid;
  const list = game.creatures;
  const coreX = CORE.col + 0.5;
  const coreY = CORE.row + 0.5;
  // A rift that drags on (everything has spawned, a few creatures linger) speeds them up.
  const stallBoost = game.rift !== null ? 1 + Math.min(1.5, Math.max(0, game.rift.doneFor - 25) / 25) : 1;
  for (const c of list) {
    if (c.dead) continue;
    const kind = KINDS[c.kind];
    c.age += dt;
    c.flash = Math.max(0, c.flash - dt);
    c.steamed = Math.max(0, c.steamed - dt);
    c.wet = Math.max(0, c.wet - dt);
    c.stun = Math.max(0, c.stun - dt);
    if (c.frozen > 0) c.frozen -= dt;
    else c.frozenCd = Math.max(0, c.frozenCd - dt);

    // Standing in painted cells: damage and status effects. Big creatures sample several points.
    const samples = kind.boss ? OFFSETS.length : 1;
    for (let s = 0; s < samples; s += 1) {
      const col = Math.floor(c.x + OFFSETS[s][0] * kind.r);
      const row = Math.floor(c.y + OFFSETS[s][1] * kind.r);
      if (inGrid(col, row)) applyCell(game, c, grid.type[row * COLS + col], 1 / samples, dt);
    }
    if (c.dead) continue;

    // Floating damage numbers: gather ticks of damage into one readable number.
    c.dmgTimer += dt;
    if (c.dmgTimer > 0.6 && c.dmgAcc >= 1) {
      addText(game.fx, toScreenX(c.x) + game.rng.range(-8, 8), toScreenY(c.y) - 18, String(Math.round(c.dmgAcc)), { color: '#ffffff', size: c.dmgAcc > 60 ? 24 : 16, life: 0.7 });
      c.dmgAcc = 0;
      c.dmgTimer = 0;
    }

    if (c.kind === 'beetle') {
      let near = false;
      for (let dr = -1; dr <= 1 && !near; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          const t = inGrid(Math.floor(c.x) + dc, Math.floor(c.y) + dr) ? grid.type[(Math.floor(c.y) + dr) * COLS + Math.floor(c.x) + dc] : 0;
          if (t === STORM || t === CHARGED) {
            near = true;
            break;
          }
        }
      }
      c.charge = near ? Math.min(1, c.charge + dt * 0.55) : Math.max(0, c.charge - dt * 0.15);
      if (c.charge >= 1) {
        explodeBeetle(game, c);
        continue;
      }
    }

    // Movement.
    let speed = kind.speed * (c.steamed > 0 ? 0.5 : 1) * (c.wet > 0 ? 0.88 : 1) * (game.mods.creatureSpeed ?? 1) * stallBoost;
    if (c.frozen > 0 || c.stun > 0) speed = 0;
    if (kind.flies || kind.straight) {
      const dx = coreX - c.x;
      const dy = coreY - c.y;
      const len = Math.hypot(dx, dy) || 1;
      dir.x = dx / len;
      dir.y = dy / len;
    } else flowDirection(game.flow, c.x, c.y, dir);
    if (c.steamed > 0 && !kind.boss && c.kind !== 'wraith') {
      const turn = Math.sin(c.age * 6 + c.id) * 1.3;
      const cos = Math.cos(turn);
      const sin = Math.sin(turn);
      const rx = dir.x * cos - dir.y * sin;
      dir.y = dir.x * sin + dir.y * cos;
      dir.x = rx;
    }
    let mx = dir.x * speed;
    let my = dir.y * speed;
    if (!kind.boss && game.magnets.length > 0) {
      const magnet = nearestMagnet(game, c, 5);
      if (magnet) {
        const dx = magnet.x - c.x;
        const dy = magnet.y - c.y;
        const len = Math.hypot(dx, dy) || 1;
        const pull = c.frozen > 0 ? 0 : 3.4;
        mx = mx * 0.3 + (dx / len) * pull;
        my = my * 0.3 + (dy / len) * pull;
      }
    }
    c.vx += (mx - c.vx) * Math.min(1, dt * 10);
    c.vy += (my - c.vy) * Math.min(1, dt * 10);
    if (Math.abs(c.vx) > 0.2) c.face = c.vx > 0 ? 1 : -1;
    const nx = c.x + c.vx * dt;
    const ny = c.y + c.vy * dt;
    c.gnawing = false;
    const ncol = Math.floor(nx);
    const nrow = Math.floor(ny);
    const blocked = !kind.flies && !kind.boss && inGrid(ncol, nrow) && grid.type[nrow * COLS + ncol] === EARTH;
    if (blocked) {
      if (kind.smash) {
        setCell(grid, ncol, nrow, EMPTY);
        burst(game.fx, 'dust', toScreenX(ncol + 0.5), toScreenY(nrow + 0.5), 12);
        addShake(game.fx, 2.5);
        c.stun = 0.25;
      } else {
        c.gnawing = true;
        grid.life[nrow * COLS + ncol] -= (kind.gnaw ?? 6) * dt;
        if (game.rng.chance(dt * 6)) burst(game.fx, 'dust', toScreenX(ncol + 0.5), toScreenY(nrow + 0.5), 1);
      }
    } else {
      c.x = Math.min(COLS - 0.3, Math.max(0.3, nx));
      c.y = Math.min(ROWS - 0.3, Math.max(0.3, ny));
    }

    // Reaching the Core.
    if (!kind.boss && coreDistance(c) < CORE.hitRadius + kind.r * 0.3) {
      damageCore(game, kind.core);
      game.stats.leaks += 1;
      c.dead = true;
    }
  }

  // Creatures push each other apart a little so swarms spread into a crowd rather than a point.
  if (list.length < 100) {
    for (let a = 0; a < list.length; a += 1) {
      for (let b = a + 1; b < list.length; b += 1) {
        const p = list[a];
        const q = list[b];
        const min = (KINDS[p.kind].r + KINDS[q.kind].r) * 0.7;
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0.0001 && d2 < min * min) {
          const d = Math.sqrt(d2);
          const push = ((min - d) / d) * 0.25;
          if (!KINDS[p.kind].boss) {
            p.x -= dx * push;
            p.y -= dy * push;
          }
          if (!KINDS[q.kind].boss) {
            q.x += dx * push;
            q.y += dy * push;
          }
        }
      }
    }
  }
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (list[i].dead) {
      if (list[i].kind === 'colossus') game.boss = null;
      list.splice(i, 1);
    }
  }
}

/** Paint every creature (the Colossus gets its own look in boss.js via the sprite). */
export function drawCreatures(ctx, game, time) {
  const sorted = [...game.creatures].sort((a, b) => a.y - b.y);
  for (const c of sorted) {
    const kind = KINDS[c.kind];
    const px = toScreenX(c.x);
    const py = toScreenY(c.y);
    drawCreatureSprite(ctx, c.kind, px, py, kind.boss ? kind.r * CELL * 0.83 : kind.r * CELL * 1.55, time + c.id, c);
    if (c.hp < c.maxHp && !kind.boss) {
      const w = Math.max(22, kind.r * CELL * 2.6);
      const top = py - kind.r * CELL * 1.55 - 12;
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(px - w / 2 - 1, top, w + 2, 6);
      ctx.fillStyle = c.hp / c.maxHp > 0.4 ? '#6dffb0' : '#ff5a6a';
      ctx.fillRect(px - w / 2, top + 1, w * (c.hp / c.maxHp), 4);
    }
  }
}
