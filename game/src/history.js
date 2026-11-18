// Run history: the last five finished runs (won or lost), kept in localStorage with an in-memory
// fallback, so the results screen can show real wins and losses.
import { gradeFor } from './score.js';

/** One tip per creature, shown on the loss card when that creature did the most damage. */
export const KILLER_TIPS = {
  imp: 'Tip: drown imps in water',
  golem: 'Tip: freeze golems before they reach the Core',
  wraith: 'Tip: only STORM hurts wraiths',
  beetle: 'Tip: burn beetles before they charge',
  swarm: 'Tip: chain the swarm with a shock',
  ram: 'Tip: lava melts rams; keep earth walls up',
  colossus: 'Tip: break the Colossus plates in order',
};

/** The creature kind that did the most damage to the Core this run (or null). */
export function topKiller(game) {
  const by = Object.entries(game.stats.coreDamageBy ?? {}).sort((a, b) => b[1] - a[1]);
  return by.length > 0 ? by[0][0] : null;
}

export const HISTORY_KEY = 'conflux.history';
const KEEP = 5;
let memory = [];

/** The grade given to a lost run: the further the rifts were held, the better. */
export function lossGrade(rift) {
  if (rift >= 6) return 'B';
  return rift >= 4 ? 'C' : 'D';
}

/** The stored runs, newest first. */
export function loadRunHistory() {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Storage can be off: fall back to this visit's runs.
  }
  return memory;
}

/** Add the run that just ended and return the last five, newest first. */
export function recordRunHistory(game, won) {
  const past = loadRunHistory();
  const n = (past[0]?.n ?? 0) + 1;
  const rift = Math.max(1, game.riftNum);
  const entry = { n, won, rift, grade: won ? gradeFor(game) : lossGrade(rift), score: Math.round(game.score), killer: won ? null : topKiller(game) };
  memory = [entry, ...past].slice(0, KEEP);
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(memory));
  } catch {
    // Kept in memory only.
  }
  return memory;
}
