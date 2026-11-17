// The battlefield grid: parallel typed arrays for each cell's element, remaining life and age,
// plus the brush that paints onto it. Creature positions elsewhere are in cell units, so a
// creature at x=24.5 stands in the middle of column 24.
import { CELL, COLS, CORE, FIELD, ROWS } from './config.js';
import { EMPTY, ELEMENTS, isBrushElement, ruleFor } from './elements.js';

export const CELLS = COLS * ROWS;

export function createGrid() {
  return { type: new Uint8Array(CELLS), life: new Float32Array(CELLS), age: new Float32Array(CELLS) };
}

export const cellIndex = (col, row) => row * COLS + col;
export const inGrid = (col, row) => col >= 0 && row >= 0 && col < COLS && row < ROWS;

export function typeAt(grid, col, row) {
  return inGrid(col, row) ? grid.type[row * COLS + col] : EMPTY;
}

/** Put element `type` in a cell with its full life times `lifeMul`. */
export function setCell(grid, col, row, type, lifeMul = 1) {
  const i = row * COLS + col;
  grid.type[i] = type;
  grid.life[i] = type === EMPTY ? 0 : ELEMENTS[type].life * lifeMul;
  grid.age[i] = 0;
}

/** Wipe every painted cell within `radius` cells of (x, y); returns how many were wiped. */
export function clearRadius(grid, x, y, radius) {
  let wiped = 0;
  for (let row = Math.floor(y - radius); row <= Math.ceil(y + radius); row += 1) {
    for (let col = Math.floor(x - radius); col <= Math.ceil(x + radius); col += 1) {
      if (!inGrid(col, row) || grid.type[row * COLS + col] === EMPTY) continue;
      const dx = col + 0.5 - x;
      const dy = row + 0.5 - y;
      if (dx * dx + dy * dy <= radius * radius) {
        setCell(grid, col, row, EMPTY);
        wiped += 1;
      }
    }
  }
  return wiped;
}

export const toScreenX = (x) => FIELD.x + x * CELL;
export const toScreenY = (y) => FIELD.y + y * CELL;
export const fromScreenX = (px) => (px - FIELD.x) / CELL;
export const fromScreenY = (py) => (py - FIELD.y) / CELL;

/** Cells nobody may paint: the Core Crystal's footprint and the edge gates. */
function isProtected(col, row) {
  if (Math.abs(col - CORE.col) <= 1 && Math.abs(row - CORE.row) <= 1) return true;
  return col === 0 || col === COLS - 1 || row === 0 || row === ROWS - 1;
}

/**
 * Paint a round dab of element `brush` centred on cell coordinates (cx, cy). A new cell costs
 * `perCell` essence, topping up an old cell of the same element costs `refreshCost`, and painting
 * onto another element reacts on the spot. Stops when `budget` essence is used up.
 * Returns { cost, events } where events lists the reactions the dab triggered.
 */
export function paintDab(grid, brush, cx, cy, radius, budget, lifeMul, perCell, refreshCost) {
  const out = { cost: 0, events: [] };
  const max = ELEMENTS[brush].life * lifeMul;
  for (let row = Math.floor(cy - radius); row <= Math.ceil(cy + radius); row += 1) {
    for (let col = Math.floor(cx - radius); col <= Math.ceil(cx + radius); col += 1) {
      if (!inGrid(col, row) || isProtected(col, row)) continue;
      const dx = col + 0.5 - cx;
      const dy = row + 0.5 - cy;
      if (dx * dx + dy * dy > radius * radius) continue;
      const i = row * COLS + col;
      const current = grid.type[i];
      if (current === brush) {
        if (grid.life[i] < max * 0.6 && out.cost + refreshCost <= budget) {
          grid.life[i] = max;
          out.cost += refreshCost;
        }
        continue;
      }
      if (out.cost + perCell > budget) return out;
      if (current === EMPTY) {
        setCell(grid, col, row, brush, lifeMul);
        out.cost += perCell;
        continue;
      }
      const rule = ruleFor(current, brush);
      if (rule) {
        setCell(grid, col, row, rule.a, lifeMul);
        out.cost += perCell;
        out.events.push({ name: rule.name, x: col + 0.5, y: row + 0.5 });
      } else if (isBrushElement(current)) {
        setCell(grid, col, row, brush, lifeMul);
        out.cost += perCell;
      }
    }
  }
  return out;
}
