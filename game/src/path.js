// The Rift Path: the branching map of a run. Rows 1-7 are the seven rifts; each row offers two or
// three nodes joined to the next row by branching paths, and node 7 is always the Hollow Colossus.
// Each node type changes which creatures the rift sends and what clearing it rewards. The map is
// generated from the run's seed, so the same seed gives the same map.
import { RIFT_COUNT } from './config.js';

/** The node types: glyph and colour for the map, a one-line description, the reward, and creature changes. */
export const NODE_TYPES = {
  ember: { name: 'EMBER RIFT', short: 'Ember', glyph: 'fire', color: '#ff7a2a', creatures: 'Cinder Imps, Ember Swarm', reward: 'A rare boon', swap: { golem: 'imp', ram: 'swarm', wraith: 'swarm', beetle: 'imp' }, bias: 'rare' },
  tide: { name: 'TIDE RIFT', short: 'Tide', glyph: 'water', color: '#2ec8ff', creatures: 'Imps, Beetles, Swarm', reward: '+40 essence in every pool', swap: { golem: 'beetle', ram: 'beetle', wraith: 'imp' } },
  stone: { name: 'STONE RIFT', short: 'Stone', glyph: 'earth', color: '#c9a36a', creatures: 'Mud Golems, Stone Rams', reward: 'Core repair +20', swap: { imp: 'golem', swarm: 'ram', wraith: 'golem', beetle: 'ram' }, scale: { golem: 0.5, ram: 0.4 } },
  storm: { name: 'STORM RIFT', short: 'Storm', glyph: 'storm', color: '#ffe23a', creatures: 'Mist Wraiths, Spark Beetles', reward: '+600 score and a chain bonus', swap: { imp: 'wraith', golem: 'beetle', ram: 'wraith', swarm: 'beetle' }, scale: { wraith: 0.7, beetle: 0.4 } },
  elite: { name: 'ELITE RIFT', short: 'Elite', glyph: 'crown', color: '#ff4a5e', creatures: 'The usual, tougher and thicker', reward: 'An epic boon', hp: 1.3, count: 1.25, bias: 'epic' },
  shrine: { name: 'SHRINE', short: 'Shrine', glyph: 'ring', color: '#6dffb0', creatures: 'No fight', reward: 'Heal the Core +35 or gain a reroll' },
  colossus: { name: 'THE HOLLOW COLOSSUS', short: 'Colossus', glyph: 'shock', color: '#c58aff', creatures: 'The Colossus and its escort', reward: 'The rifts are sealed' },
};

const WEIGHTS = [['ember', 22], ['tide', 22], ['stone', 22], ['storm', 22], ['elite', 8], ['shrine', 6]];

function pickType(rng, row) {
  const pool = WEIGHTS.filter(([type]) => !(row === 1 && (type === 'shrine' || type === 'elite')));
  let roll = rng.next() * pool.reduce((sum, [, w]) => sum + w, 0);
  for (const [type, w] of pool) {
    roll -= w;
    if (roll <= 0) return type;
  }
  return pool[0][0];
}

/** Build the run's map: `rows[r]` is the list of nodes of rift r+1; node.next lists next-row node ids. */
export function generateMap(rng) {
  const rows = [];
  for (let row = 1; row <= RIFT_COUNT; row += 1) {
    const count = row === RIFT_COUNT ? 1 : row === 1 ? 3 : 2 + rng.int(2);
    rows.push(Array.from({ length: count }, (_, index) => ({ id: `r${row}n${index}`, row, index, count, type: row === RIFT_COUNT ? 'colossus' : pickType(rng, row), next: [] })));
  }
  for (let r = 0; r < rows.length - 1; r += 1) {
    const here = rows[r];
    const there = rows[r + 1];
    const linked = new Set();
    for (const node of here) {
      const base = Math.min(there.length - 1, Math.floor(((node.index + 0.5) / here.length) * there.length));
      node.next.push(there[base].id);
      const extra = base + (rng.chance(0.5) ? 1 : -1);
      if (extra >= 0 && extra < there.length && rng.chance(0.55)) node.next.push(there[extra].id);
      node.next.forEach((id) => linked.add(id));
    }
    // Every node must be reachable: link any orphan from the nearest node of the row before.
    for (const orphan of there) {
      if (linked.has(orphan.id)) continue;
      const nearest = here.reduce((best, n) => (Math.abs(n.index / here.length - orphan.index / there.length) < Math.abs(best.index / here.length - orphan.index / there.length) ? n : best), here[0]);
      nearest.next.push(orphan.id);
    }
  }
  return rows;
}

export const nodeById = (map, id) => map.flat().find((n) => n.id === id);

/** The nodes the player may pick next: the whole first row at the start, else the last node's links. */
export function reachableNodes(map, route) {
  if (route.length === 0) return map[0];
  const last = nodeById(map, route[route.length - 1]);
  return last.next.map((id) => nodeById(map, id));
}

/** The route as a readable line: "Ember > Storm > Shrine > ...". */
export function routeSummary(map, route) {
  return route.map((id) => NODE_TYPES[nodeById(map, id).type].short).join(' > ');
}

/** Map position of node (row 1-7, index of count) inside the map area. */
export function nodePosition(row, index, count) {
  return { x: 92 + (row - 1) * 106, y: 170 + ((index + 0.5) * 380) / count };
}
