// Every tuning number and colour for CONFLUX in one place. The canvas is a fixed 1280x800 (16:10)
// logical area (scaled to the window by main.js); the battlefield is a 51x33 grid of 20px cells.

export const W = 1280;
export const H = 800;
/** The simulation's fixed step in seconds: 60 updates a second whatever the display rate. */
export const STEP = 1 / 60;

export const COLS = 51;
export const ROWS = 30;
export const CELL = 20;
/** Where the battlefield sits on the canvas. */
export const FIELD = { x: 12, y: 84, w: COLS * CELL, h: ROWS * CELL };

export const RIFT_COUNT = 7;
/** The Core Crystal fills the 3x3 cells around (col, row). */
export const CORE = { col: 25, row: 14, maxHp: 100, hitRadius: 1.8 };
/** Rift gates on the four edges: where creatures step out. */
export const GATES = {
  W: { col: 0, row: 14, name: 'WEST' },
  E: { col: 50, row: 14, name: 'EAST' },
  N: { col: 25, row: 0, name: 'NORTH' },
  S: { col: 25, row: 29, name: 'SOUTH' },
};

export const ESSENCE = { max: 100, regen: 7, perCell: 1.0, refreshCost: 0.4 };
export const BRUSH = { radius: 1.15, spacing: 0.7 };
/** Reactions run on a fixed tick; a chain survives this long without a new reaction. */
export const REACT = { interval: 0.25, chainWindow: 2.6 };
export const PREP_SECONDS = 9;
export const FIRST_PREP_SECONDS = 12;
export const MAX_CREATURES = 140;

export const PALETTE = {
  ground: '#07080d',
  groundLine: '#0e1119',
  panel: '#0d1018',
  panelEdge: '#2a3042',
  text: '#f2f5fb',
  muted: '#8f98ad',
  fire: '#ff5a1f',
  fireGlow: '#ffb347',
  water: '#22c3ff',
  earth: '#8a6a3a',
  moss: '#5f8f3a',
  storm: '#ffe23a',
  stormViolet: '#a65cff',
  lava: '#ff3d00',
  ice: '#dff6ff',
  steam: '#cfe9f2',
  magnet: '#b86a86',
  core: '#6ff0ff',
  danger: '#ff3b4e',
  good: '#6dffb0',
  gold: '#ffd24a',
};

export const FONT = '"Segoe UI", system-ui, -apple-system, Helvetica, Arial, sans-serif';
/**
 * Difficulty settings the title screen offers. hp scales creature (and boss) health, count scales
 * how many creatures each group sends, regen scales essence regeneration.
 */
export const DIFFICULTIES = [
  { name: 'APPRENTICE', tag: 'forgiving', hp: 0.75, count: 0.7, regen: 1.35, note: 'Creatures have 75% health and come 30% thinner. Essence refills 35% faster.' },
  { name: 'ADEPT', tag: 'the intended game', hp: 1, count: 1, regen: 1, note: 'The intended challenge: full health, full numbers, normal essence.' },
  { name: 'ARCHMAGE', tag: 'brutal', hp: 1.3, count: 1.3, regen: 0.8, note: 'Creatures have 30% more health and come 30% thicker. Essence refills 20% slower.' },
];
export const DIFFICULTY_KEY = 'conflux.difficulty';
export const SEED_KEY = 'conflux.seed';
export const BEST_KEY = 'conflux.best';
export const RECORD_KEY = 'conflux.chain';

/** The Hollow Colossus's armour: plates break only to these reactions, in this order. */
export const PLATES = [
  { need: 'STEAM', color: '#cfe9f2', hint: 'FIRE + WATER' },
  { need: 'STORMSTEAM', color: '#a65cff', hint: 'STEAM + STORM' },
  { need: 'LAVA', color: '#ff6a1f', hint: 'FIRE + EARTH' },
  { need: 'SHOCK', color: '#ffe23a', hint: 'WATER + STORM' },
];
