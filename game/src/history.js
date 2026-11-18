// Run history: the last five finished runs (won or lost), kept in localStorage with an in-memory
// fallback, so the results screen can show real wins and losses.
import { gradeFor } from './score.js';

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
  const entry = { n, won, rift, grade: won ? gradeFor(game) : lossGrade(rift), score: Math.round(game.score) };
  memory = [entry, ...past].slice(0, KEEP);
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(memory));
  } catch {
    // Kept in memory only.
  }
  return memory;
}
