// The element table and the pair-reaction rule table. Elements 1-4 are the brushes the player
// paints; 5-10 are products that only reactions make. `dps` is damage per second to a creature
// standing in the cell, scaled per creature by its resistances (creatures.js).
import { PALETTE as P } from './config.js';

export const EMPTY = 0;
export const FIRE = 1;
export const WATER = 2;
export const EARTH = 3;
export const STORM = 4;
export const STEAM = 5;
export const LAVA = 6;
export const CHARGED = 7;
export const ICE = 8;
export const MAGNET = 9;
export const CLOUD = 10;

export const ELEMENTS = [
  null,
  { id: FIRE, name: 'FIRE', color: P.fire, glow: P.fireGlow, life: 7, cls: 'fire', dps: 26 },
  { id: WATER, name: 'WATER', color: P.water, glow: '#8fe3ff', life: 16, cls: 'water', dps: 9 },
  { id: EARTH, name: 'EARTH', color: P.earth, glow: P.moss, life: 26, cls: 'earth', dps: 0 },
  { id: STORM, name: 'STORM', color: P.storm, glow: P.stormViolet, life: 5, cls: 'storm', dps: 32 },
  { id: STEAM, name: 'STEAM', color: P.steam, glow: '#ffffff', life: 6, cls: 'steam', dps: 0 },
  { id: LAVA, name: 'LAVA', color: P.lava, glow: '#ffae00', life: 15, cls: 'fire', dps: 46 },
  { id: CHARGED, name: 'CHARGED WATER', color: '#37e6ff', glow: P.storm, life: 9, cls: 'storm', dps: 56 },
  { id: ICE, name: 'ICE', color: P.ice, glow: '#a8e6ff', life: 14, cls: 'ice', dps: 0 },
  { id: MAGNET, name: 'MAGNETITE', color: P.magnet, glow: '#ff5d7a', life: 14, cls: 'earth', dps: 6 },
  { id: CLOUD, name: 'STORMCLOUD', color: '#6757c9', glow: P.stormViolet, life: 7, cls: 'storm', dps: 0 },
];

/** What the four brushes paint, in key order [1] [2] [3] [4]. */
export const BRUSHES = [FIRE, WATER, EARTH, STORM];
export const isBrushElement = (type) => type >= FIRE && type <= STORM;

const rules = new Map();
/** Rule: a cell of type `a` beside a cell of type `b` becomes `na`, and `b` becomes `nb`. */
function defineReactionRule(a, b, na, nb, name) {
  rules.set(a * 16 + b, { a: na, b: nb, name });
  rules.set(b * 16 + a, { a: nb, b: na, name });
}
defineReactionRule(FIRE, WATER, STEAM, STEAM, 'STEAM');
defineReactionRule(FIRE, EARTH, LAVA, LAVA, 'LAVA');
defineReactionRule(WATER, STORM, CHARGED, CHARGED, 'SHOCK');
defineReactionRule(EARTH, STORM, MAGNET, MAGNET, 'MAGNET');
defineReactionRule(STEAM, STORM, CLOUD, CLOUD, 'STORMSTEAM');
defineReactionRule(LAVA, WATER, EARTH, STEAM, 'QUENCH');
defineReactionRule(FIRE, ICE, WATER, WATER, 'MELT');
defineReactionRule(STORM, ICE, EMPTY, EMPTY, 'SHATTER');

/** The reaction between two element types, or undefined when they do not react. */
export function ruleFor(a, b) {
  return rules.get(a * 16 + b);
}
