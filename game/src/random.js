// A small seeded random generator (mulberry32). Everything in the simulation draws from one of
// these, so the same seed always plays out the same way: that is what makes ?shot= deterministic.

export function createRandom(seed) {
  let state = seed >>> 0;
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    range: (low, high) => low + (high - low) * next(),
    int: (count) => Math.floor(next() * count),
    chance: (p) => next() < p,
    pick: (list) => list[Math.floor(next() * list.length)],
  };
}
