// Run omens (a real run modifier chosen on the title screen), the bestiary (each creature's
// weakness) and the feats shown on the results screen.

/** The three omens: index = the game's `omen`. `kind` is the creature the omen brings more of. */
export const OMENS = [
  { name: 'EMBER MOON', glyph: 'fire', color: '#ff7a2a', note: 'Fire +25%. More Cinder Imps.', kind: 'imp' },
  { name: 'STORM SEASON', glyph: 'storm', color: '#ffe23a', note: 'Storm chains +1. More Wraiths.', kind: 'wraith' },
  { name: 'FROST ECLIPSE', glyph: 'ice', color: '#8fd8ff', note: 'Ice lasts longer. More Golems.', kind: 'golem' },
];
export const OMEN_KEY = 'conflux.omen';

/** [creature, weakness glyph, weakness name] */
export const BESTIARY = [
  ['imp', 'water', 'WATER'],
  ['golem', 'ice', 'ICE'],
  ['wraith', 'storm', 'STORM'],
  ['beetle', 'fire', 'FIRE'],
  ['swarm', 'storm', 'STORM'],
  ['ram', 'lava', 'LAVA'],
];

const REACTION_GROUPS = [['STEAM', 'QUENCH'], ['LAVA'], ['SHOCK'], ['FROST', 'SHATTER'], ['MAGNET'], ['STORMSTEAM', 'STRIKE']];

/** The five feats: earned from the real stats of the run. */
export const FEATS = [
  { name: 'Stormcaller', desc: '50 shocks in one rift', glyph: 'shock', color: '#5ff0ff', test: (g) => g.stats.maxShocks >= 50 },
  { name: 'Unbroken Core', desc: 'No Core hit in 3 rifts', glyph: 'shield', color: '#7fe9ff', test: (g) => g.stats.cleanRifts >= 3 },
  { name: 'Alchemist', desc: 'All 6 reactions used', glyph: 'spiral', color: '#c58aff', test: (g) => REACTION_GROUPS.every((names) => names.some((n) => (g.stats.byReaction[n] ?? 0) > 0)) },
  { name: 'Colossus Breaker', desc: 'Plates broken in perfect order', glyph: 'crown', color: '#ff9a5a', test: (g, won) => won && g.stats.plateResets === 0 },
  { name: 'Chainmaster', desc: 'A chain of x20 or more', glyph: 'cloud', color: '#ffe23a', test: (g) => g.stats.bestChain >= 20 },
];
