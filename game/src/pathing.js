// Where creatures walk: a distance-to-Core field over the grid, recomputed a few times a second so
// painted walls, lava and storms bend the routes. Earth is passable only at a heavy price (the
// creature has to gnaw through), so a wall makes them take the long way when there is one.
import { COLS, CORE } from './config.js';
import { CELLS, inGrid } from './grid.js';
import { CHARGED, CLOUD, EARTH, EMPTY, FIRE, ICE, LAVA, STORM } from './elements.js';

const UNREACHED = 1e9;
const queue = new Int32Array(CELLS * 8);
const queued = new Uint8Array(CELLS);

/** What it costs a walker to stand in a cell of this type. */
function stepCost(type, bold) {
  if (type === EMPTY) return 1;
  if (type === EARTH) return 9;
  if (type === LAVA || type === FIRE || type === CHARGED || type === STORM) return bold ? 1 : 2.5;
  if (type === ICE || type === CLOUD) return 2;
  return 1;
}

export function createFlow() {
  return new Float32Array(CELLS).fill(UNREACHED);
}

/**
 * Fill `flow` with the cheapest walking cost from every cell to the Core. When `bold` is set
 * (a rift has dragged on) creatures stop detouring around fire, lava and storm.
 */
export function computeFlow(flow, grid, bold = false) {
  flow.fill(UNREACHED);
  queued.fill(0);
  let head = 0;
  let tail = 0;
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      const i = (CORE.row + dr) * COLS + CORE.col + dc;
      flow[i] = 0;
      queue[tail++] = i;
      queued[i] = 1;
    }
  }
  const dirs = [1, -1, COLS, -COLS];
  while (head !== tail) {
    const i = queue[head];
    head = (head + 1) % queue.length;
    queued[i] = 0;
    const col = i % COLS;
    for (let d = 0; d < 4; d += 1) {
      const j = i + dirs[d];
      if (j < 0 || j >= CELLS) continue;
      if (d === 0 && col === COLS - 1) continue;
      if (d === 1 && col === 0) continue;
      const nd = flow[i] + stepCost(grid.type[j], bold);
      if (nd < flow[j]) {
        flow[j] = nd;
        if (!queued[j]) {
          queued[j] = 1;
          queue[tail] = j;
          tail = (tail + 1) % queue.length;
        }
      }
    }
  }
}

/**
 * The unit direction a walker at (x, y) should head: toward the neighbouring cell with the lowest
 * cost, ties broken toward the Core so routes look natural instead of staircase-y.
 */
export function flowDirection(flow, x, y, out) {
  const col = Math.floor(x);
  const row = Math.floor(y);
  let best = null;
  let bestScore = Infinity;
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if ((dr === 0 && dc === 0) || !inGrid(col + dc, row + dr)) continue;
      if (dr !== 0 && dc !== 0) {
        // No cutting a corner past a wall: both orthogonal neighbours must be walkable too.
        if (flow[row * COLS + col + dc] > 1e8 || flow[(row + dr) * COLS + col] > 1e8) continue;
      }
      const cost = flow[(row + dr) * COLS + col + dc] + (dr !== 0 && dc !== 0 ? 0.4 : 0);
      const bend = Math.hypot(CORE.col + 0.5 - (col + dc + 0.5), CORE.row + 0.5 - (row + dr + 0.5)) * 0.01;
      if (cost + bend < bestScore) {
        bestScore = cost + bend;
        best = [dc, dr];
      }
    }
  }
  if (!best) {
    out.x = 0;
    out.y = 0;
    return out;
  }
  const tx = col + best[0] + 0.5 - x;
  const ty = row + best[1] + 0.5 - y;
  const len = Math.hypot(tx, ty) || 1;
  out.x = tx / len;
  out.y = ty / len;
  return out;
}
