// The seven rifts (waves). Each rift is a list of spawn groups; startRift flattens one into a
// timed spawn queue, updateRift releases creatures on schedule and reports when the rift is
// cleared, and upcoming() summarises what is still to come for the HUD's NEXT line.
import { FIELD, GATES, RIFT_COUNT } from './config.js';
import { spawnColossus } from './boss.js';
import { spawnCreature } from './creatures.js';
import { addShake, addText } from './particles.js';
import { NODE_TYPES } from './path.js';
import { sfx } from './audio.js';

/** group: kind, count, gap between spawns (s), start time (s), gate key or list of gate keys. */
export const RIFT_PLANS = [
  { title: 'THE FIRST CRACK', groups: [
    { kind: 'imp', n: 5, gap: 2.6, at: 0, gate: 'W' },
    { kind: 'swarm', n: 8, gap: 0.45, at: 17, gate: 'E' },
    { kind: 'imp', n: 3, gap: 1.8, at: 28, gate: 'N' },
  ] },
  { title: 'MUD AND EMBERS', groups: [
    { kind: 'golem', n: 1, gap: 1, at: 0, gate: 'E' },
    { kind: 'imp', n: 6, gap: 1.8, at: 5, gate: 'W' },
    { kind: 'swarm', n: 12, gap: 0.4, at: 22, gate: 'N' },
    { kind: 'golem', n: 1, gap: 1, at: 30, gate: 'S' },
  ] },
  { title: 'THE MIST RISES', groups: [
    { kind: 'wraith', n: 4, gap: 3, at: 0, gate: ['N', 'S'] },
    { kind: 'imp', n: 6, gap: 1.6, at: 9, gate: ['W', 'E'] },
    { kind: 'golem', n: 2, gap: 5, at: 20, gate: 'W' },
    { kind: 'swarm', n: 12, gap: 0.35, at: 32, gate: 'S' },
  ] },
  { title: 'RAMS AT THE GATE', groups: [
    { kind: 'ram', n: 2, gap: 6, at: 0, gate: ['W', 'E'] },
    { kind: 'swarm', n: 14, gap: 0.35, at: 9, gate: 'S' },
    { kind: 'beetle', n: 3, gap: 3.5, at: 15, gate: ['E', 'N', 'W'] },
    { kind: 'imp', n: 7, gap: 1.4, at: 30, gate: ['N', 'S'] },
  ] },
  { title: 'STORM FRONT', groups: [
    { kind: 'wraith', n: 5, gap: 2.2, at: 0, gate: ['N', 'S', 'W'] },
    { kind: 'golem', n: 3, gap: 5, at: 7, gate: ['E', 'W'] },
    { kind: 'beetle', n: 4, gap: 3, at: 16, gate: ['N', 'S'] },
    { kind: 'ram', n: 2, gap: 5, at: 24, gate: 'W' },
    { kind: 'swarm', n: 16, gap: 0.3, at: 34, gate: ['E', 'S'] },
  ] },
  { title: 'EVERYTHING AT ONCE', groups: [
    { kind: 'imp', n: 10, gap: 1.2, at: 0, gate: ['W', 'E', 'N'] },
    { kind: 'golem', n: 4, gap: 4.5, at: 5, gate: ['N', 'S'] },
    { kind: 'wraith', n: 6, gap: 2.2, at: 12, gate: ['E', 'W'] },
    { kind: 'ram', n: 3, gap: 5, at: 18, gate: ['S', 'E'] },
    { kind: 'beetle', n: 5, gap: 2.6, at: 24, gate: ['W', 'N', 'S'] },
    { kind: 'swarm', n: 20, gap: 0.28, at: 36, gate: ['S', 'W', 'N', 'E'] },
  ] },
  { title: 'THE HOLLOW COLOSSUS', groups: [
    { kind: 'imp', n: 6, gap: 1.5, at: 0, gate: ['W', 'E'] },
    { kind: 'wraith', n: 4, gap: 2.5, at: 6, gate: ['N', 'S'] },
    { kind: 'colossus', n: 1, gap: 1, at: 14, gate: 'N' },
    { kind: 'swarm', n: 14, gap: 0.3, at: 34, gate: ['W', 'E'] },
    { kind: 'golem', n: 2, gap: 6, at: 40, gate: ['W', 'E'] },
    { kind: 'beetle', n: 3, gap: 4, at: 52, gate: ['S'] },
  ] },
];

/** Turn rift `number` (1-7) into a sorted list of {t, kind, gate}. */
function buildSpawnList(number, count = 1, type = null) {
  const node = NODE_TYPES[type];
  const list = [];
  for (const group of RIFT_PLANS[number - 1].groups) {
    const gates = Array.isArray(group.gate) ? group.gate : [group.gate];
    let kind = group.kind;
    let amount = group.n;
    if (kind !== 'colossus' && node?.swap?.[kind]) {
      kind = node.swap[kind];
      amount *= node.scale?.[kind] ?? 1;
    }
    const n = kind === 'colossus' ? 1 : Math.max(1, Math.round(amount * count));
    for (let i = 0; i < n; i += 1) list.push({ t: group.at + i * group.gap, kind, gate: gates[i % gates.length] });
  }
  return list.sort((a, b) => a.t - b.t);
}

export function startRift(game, number) {
  const spawns = buildSpawnList(number, game.tuning.count * (NODE_TYPES[game.node?.type]?.count ?? 1), game.node?.type);
  game.rift = { number, spawns, next: 0, clock: 0, total: spawns.length, done: false, doneFor: 0 };
  game.riftNum = number;
  addText(game.fx, FIELD.x + FIELD.w / 2, FIELD.y + 120, `RIFT ${number} OPENS`, { color: '#ffd9a0', size: 54, life: 2, vy: -10, pop: 0.4 });
  addText(game.fx, FIELD.x + FIELD.w / 2, FIELD.y + 168, RIFT_PLANS[number - 1].title, { color: '#ffffff', size: 28, life: 2, vy: -10 });
  addShake(game.fx, 6);
  sfx.riftOpen();
}

/** Release due spawns. Returns true once every creature of the rift has spawned and died. */
export function updateRift(game, dt) {
  const rift = game.rift;
  rift.clock += dt;
  const hpMul = (1 + 0.09 * (rift.number - 1)) * game.tuning.hp * (NODE_TYPES[game.node?.type]?.hp ?? 1);
  while (rift.next < rift.spawns.length && rift.spawns[rift.next].t <= rift.clock) {
    const s = rift.spawns[rift.next];
    rift.next += 1;
    if (s.kind === 'colossus') spawnColossus(game, s.gate);
    else spawnCreature(game, s.kind, s.gate, hpMul);
  }
  rift.done = rift.next >= rift.spawns.length;
  if (rift.done) rift.doneFor += dt;
  return rift.done && game.creatures.length === 0;
}

/**
 * What is still to come, grouped for the HUD queue: [{kind, count, gate, seconds}] for the next
 * few distinct groups, with `seconds` until each group's first creature.
 */
export function upcoming(game, limit = 6) {
  let rift = game.rift;
  if (game.phase === 'prep') {
    const number = game.riftNum + 1;
    if (!game.preview || game.preview.number !== number) game.preview = { number, spawns: buildSpawnList(number, game.tuning.count * (NODE_TYPES[game.node?.type]?.count ?? 1), game.node?.type) };
    rift = { spawns: game.preview.spawns, next: 0, clock: -game.prepTimer };
  }
  const out = [];
  if (!rift) return out;
  for (let i = rift.next; i < rift.spawns.length && out.length <= limit; i += 1) {
    const s = rift.spawns[i];
    const last = out[out.length - 1];
    if (last && last.kind === s.kind && s.t - last.lastT < 8) {
      last.count += 1;
      last.lastT = s.t;
    } else out.push({ kind: s.kind, count: 1, gate: GATES[s.gate].name, seconds: Math.max(0, s.t - rift.clock), lastT: s.t });
  }
  return out.slice(0, limit);
}

export const riftCount = () => RIFT_COUNT;
