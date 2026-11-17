// The Hollow Colossus, boss of rift 7. Its armour has four plates that break only to a named
// reaction sequence (config PLATES) happening near it; once all four are gone it is exposed for a
// few seconds and every reaction beside it bites. Then the armour reforms. It also stomps away
// painted cells, so the player has to keep re-laying the trap.
import { CELL, CORE, FIELD, PLATES } from './config.js';
import { clearRadius, toScreenX, toScreenY } from './grid.js';
import { addFlash, addShake, addText, burst } from './particles.js';
import { damageCreature, spawnCreature } from './creatures.js';
import { addScore, damageCore } from './score.js';
import { sfx } from './audio.js';

/** How close (in cells) a reaction must be to the Colossus to count against it. */
const REACH = 8;
const EXPOSED_SECONDS = 12;
const STOMP_EVERY = 9;

export function spawnColossus(game, gateKey) {
  const boss = spawnCreature(game, 'colossus', gateKey, 1);
  if (!boss) return null;
  boss.hp = Math.round(boss.hp * (game.mods.bossHpMul ?? 1));
  boss.maxHp = boss.hp;
  game.boss = boss;
  addText(game.fx, FIELD.x + FIELD.w / 2, FIELD.y + 180, 'THE HOLLOW COLOSSUS', { color: '#c58aff', size: 52, life: 2.6, vy: -8, pop: 0.4 });
  addText(game.fx, FIELD.x + FIELD.w / 2, FIELD.y + 226, 'Break its plates in order', { color: '#ffffff', size: 26, life: 2.6, vy: -8 });
  addShake(game.fx, 12);
  addFlash(game.fx, 0.5, '#a65cff');
  sfx.riftOpen();
  return boss;
}

/** Called for every reaction (name, position in cells): breaks the current plate or bites. */
export function noteReaction(game, name, x, y) {
  const boss = game.boss;
  if (!boss || boss.dead) return;
  if (Math.hypot(boss.x - x, boss.y - y) > REACH) return;
  const reaction = name === 'QUENCH' ? 'STEAM' : name;
  const px = toScreenX(boss.x);
  const py = toScreenY(boss.y);
  if (boss.exposed > 0) {
    if (boss.biteCooldown > 0) return;
    boss.biteCooldown = 0.3;
    damageCreature(game, boss, 70, 'burst');
    burst(game.fx, 'spark', toScreenX(x), toScreenY(y), 4);
    return;
  }
  const plate = PLATES[boss.plates];
  if (!plate || plate.need !== reaction) return;
  boss.plates += 1;
  burst(game.fx, 'shard', px, py, 26, [plate.color, '#ffffff']);
  burst(game.fx, 'spark', px, py, 20, [plate.color, '#ffffff']);
  addShake(game.fx, 11);
  addFlash(game.fx, 0.3, plate.color);
  sfx.plate();
  addScore(game, 400);
  if (boss.plates >= PLATES.length) {
    boss.exposed = EXPOSED_SECONDS;
    addText(game.fx, px, py - 70, 'EXPOSED! HIT IT!', { color: '#ffd24a', size: 44, life: 2, pop: 0.4 });
  } else {
    addText(game.fx, px, py - 70, `PLATE ${boss.plates} BROKEN!`, { color: plate.color, size: 36, life: 1.6, pop: 0.4 });
  }
}

/** Per-step boss behaviour: exposure timer, plate regrowth, stomp, and crushing the Core. */
export function updateBoss(game, dt) {
  const boss = game.boss;
  if (!boss || boss.dead) return;
  boss.biteCooldown = Math.max(0, (boss.biteCooldown ?? 0) - dt);
  if (boss.exposed > 0) {
    boss.exposed -= dt;
    if (boss.exposed <= 0) {
      boss.plates = 0;
      addText(game.fx, toScreenX(boss.x), toScreenY(boss.y) - 70, 'ARMOUR REFORMS', { color: '#c58aff', size: 34, life: 1.6, pop: 0.3 });
      addShake(game.fx, 6);
    }
  }
  boss.stompTimer -= dt;
  boss.stompWarn = boss.stompTimer < 1.1 ? 1.1 - boss.stompTimer : 0;
  if (boss.stompTimer <= 0) {
    boss.stompTimer = STOMP_EVERY;
    boss.stompWarn = 0;
    const wiped = clearRadius(game.grid, boss.x, boss.y, 5.2);
    burst(game.fx, 'dust', toScreenX(boss.x), toScreenY(boss.y), 40);
    addShake(game.fx, 13);
    addText(game.fx, toScreenX(boss.x), toScreenY(boss.y) - 70, wiped > 0 ? 'STOMP!' : 'STOMP', { color: '#ff8a5a', size: 36, life: 1.2, pop: 0.3 });
    sfx.coreHit();
  }
  if (Math.hypot(boss.x - CORE.col - 0.5, boss.y - CORE.row - 0.5) < 3.8) {
    boss.crushTimer -= dt;
    if (boss.crushTimer <= 0) {
      boss.crushTimer = 1.6;
      damageCore(game, 35);
    }
  }
}

/** Draw the stomp warning ring under the Colossus. */
export function drawBossWarning(ctx, game) {
  const boss = game.boss;
  if (!boss || boss.stompWarn <= 0) return;
  const radius = 5.2 * CELL * Math.min(1, boss.stompWarn / 1.1);
  ctx.strokeStyle = `rgba(255,90,60,${0.4 + 0.5 * Math.min(1, boss.stompWarn)})`;
  ctx.lineWidth = 4;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.arc(toScreenX(boss.x), toScreenY(boss.y), 5.2 * CELL, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(255,90,60,0.7)';
  ctx.beginPath();
  ctx.arc(toScreenX(boss.x), toScreenY(boss.y), radius, 0, Math.PI * 2);
  ctx.stroke();
}
