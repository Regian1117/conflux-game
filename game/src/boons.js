// Boons: after each rift the player picks 1 of 3. They stack up to `max` times and change the
// numbers in game.mods, which the rest of the simulation reads (brush size, lava spread, frost...).
import { BRUSH, CORE, ESSENCE } from './config.js';

/** rarity: common / rare / epic (colours in RARITY); `glyph` names the glyph drawn on its card and in the HUD. */
export const BOONS = [
  { id: 'frost', name: 'Frost Touch', desc: 'Water freezes to ICE after a moment.', synergy: 'Pairs with STORM: frozen ice shatters.', glyph: 'frost', rarity: 'rare', color: '#bfeaff', icon: '*', max: 1 },
  { id: 'wide', name: 'Wider Brush', desc: 'Your brush paints a bigger disc.', synergy: 'Pairs with Essence Overflow.', glyph: 'ring', rarity: 'common', color: '#ffd24a', icon: 'O', max: 2 },
  { id: 'lava', name: 'Lava Spreads Faster', desc: 'Lava creeps into earth much quicker.', synergy: 'Pairs with EARTH walls.', glyph: 'lava', rarity: 'rare', color: '#ff6a1f', icon: '~', max: 3 },
  { id: 'arc', name: 'Chain Lightning +1', desc: 'Storm cells arc to one more creature.', synergy: 'Pairs with Charged Water.', glyph: 'shock', rarity: 'epic', color: '#ffe23a', icon: 'Z', max: 3 },
  { id: 'overflow', name: 'Essence Overflow', desc: 'Bigger essence pools, refilled faster.', synergy: 'Pairs with Wider Brush.', glyph: 'water', rarity: 'common', color: '#6dffb0', icon: '+', max: 3 },
  { id: 'shield', name: 'Core Shield', desc: 'The Core gains a 40 point shield each rift.', synergy: 'Pairs with Core Mend.', glyph: 'shield', rarity: 'common', color: '#6ff0ff', icon: 'S', max: 2 },
  { id: 'slowdecay', name: 'Slow Decay', desc: 'Painted cells last 35% longer.', synergy: 'Pairs with Frost Touch: ice lasts.', glyph: 'hourglass', rarity: 'common', color: '#c9a36a', icon: 'T', max: 2 },
  { id: 'mend', name: 'Core Mend', desc: 'Heal the Core for 35 right now.', synergy: 'Pairs with Core Shield.', glyph: 'cross', rarity: 'common', color: '#ff7aa0', icon: 'H', max: 9 },
  { id: 'siphon', name: 'Kill Siphon', desc: 'Kills return 60% more essence.', synergy: 'Pairs with Swarm kills.', glyph: 'spiral', rarity: 'epic', color: '#c58aff', icon: 'K', max: 2 },
];

/** Essence taken from every pool for a reroll when no free reroll is held. */
export const REROLL_COST = 40;

export const RARITY = {
  common: { label: 'COMMON', color: '#9fb3d9' },
  rare: { label: 'RARE', color: '#4aa8ff' },
  epic: { label: 'EPIC', color: '#c25cff' },
};

export function boonById(id) {
  return BOONS.find((b) => b.id === id);
}

/** Recompute game.mods from the boons the player holds. */
export function deriveMods(game) {
  const n = (id) => game.boons[id] ?? 0;
  game.mods = {
    brushRadius: BRUSH.radius + 0.7 * n('wide'),
    lavaSpread: 0.15 * n('lava'),
    arcs: n('arc'),
    frost: n('frost') > 0,
    essenceMax: ESSENCE.max + 40 * n('overflow'),
    regen: ESSENCE.regen * game.tuning.regen * (1 + 0.3 * n('overflow')),
    lifeMul: 1 + 0.35 * n('slowdecay'),
    shieldMax: 40 * n('shield'),
    siphon: 0.6 * n('siphon'),
    stormBonus: 0,
    creatureSpeed: 1,
    bossHpMul: game.tuning.hp,
  };
}

/** Pick three different boons that are not yet maxed. */
export function offerBoons(game, bias = null) {
  const pool = BOONS.filter((b) => (game.boons[b.id] ?? 0) < b.max);
  const offer = [];
  while (offer.length < 3 && pool.length > 0) offer.push(pool.splice(game.rng.int(pool.length), 1)[0]);
  // A rare or epic rift guarantees a boon of at least that rarity.
  if (bias) {
    const order = ['common', 'rare', 'epic'];
    const need = order.indexOf(bias);
    if (!offer.some((b) => order.indexOf(b.rarity) >= need)) {
      const candidates = BOONS.filter((b) => (game.boons[b.id] ?? 0) < b.max && order.indexOf(b.rarity) >= need && !offer.includes(b));
      if (candidates.length > 0) offer[0] = candidates[game.rng.int(candidates.length)];
    }
  }
  return offer;
}

export function takeBoon(game, id) {
  game.boons[id] = (game.boons[id] ?? 0) + 1;
  deriveMods(game);
  if (id === 'mend') game.core.hp = Math.min(CORE.maxHp, game.core.hp + 35);
  if (id === 'shield') game.core.shield = game.mods.shieldMax;
  if (id === 'overflow') for (let i = 0; i < 4; i += 1) game.essence[i] = Math.min(game.mods.essenceMax, game.essence[i] + 40);
}
