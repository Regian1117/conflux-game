// Small tag chips that explain the field: a dark plate with an element-coloured border and bold
// text on each material area ("LAVA - burns"), on the Core and on the boss. In play a tag shows
// when its area is first created and while the brush hovers over it; scenes may ask for all of them.
import { CELL, COLS, CORE, FIELD, ROWS } from './config.js';
import { CHARGED, CLOUD, EARTH, FIRE, ICE, LAVA, MAGNET, STEAM, STORM, WATER } from './elements.js';
import { toScreenX, toScreenY } from './grid.js';
import { drawText } from './draw.js';

/** [name, note, colour] for each element area worth a tag. */
const TAGS = {
  [LAVA]: ['LAVA', 'burns', '#ff8a2a', 0],
  [CHARGED]: ['CHARGED WATER', 'shocks', '#5ff0ff', -26],
  [STEAM]: ['STEAM', 'slows', '#dff3fb', -30],
  [ICE]: ['ICE', 'freezes', '#bfeaff', 38],
  [CLOUD]: ['STORMCLOUD', 'strikes', '#a8b4ff', -4],
  [MAGNET]: ['MAGNETITE', 'pulls', '#ff7a9a', 26],
  [EARTH]: ['EARTH WALL', 'blocks', '#c9a36a', -90],
  [FIRE]: ['FIRE', 'burns', '#ff6a2a'],
  [WATER]: ['WATER', 'soaks', '#2ec8ff'],
  [STORM]: ['STORM', 'zaps', '#ffe23a'],
};

const seen = new Int32Array(COLS * ROWS);
const stack = [];

/** The largest connected area of each element type: {type, size, cx, cy, minCol, maxCol, minRow, maxRow}. */
function areas(game) {
  const grid = game.grid;
  seen.fill(0);
  const best = new Map();
  for (let start = 0; start < grid.type.length; start += 1) {
    const type = grid.type[start];
    if (type === 0 || seen[start] || !TAGS[type]) continue;
    stack.length = 0;
    stack.push(start);
    seen[start] = 1;
    let size = 0;
    let sx = 0;
    let sy = 0;
    let minCol = COLS;
    let maxCol = 0;
    let minRow = ROWS;
    let maxRow = 0;
    while (stack.length > 0) {
      const i = stack.pop();
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      size += 1;
      sx += col;
      sy += row;
      minCol = Math.min(minCol, col);
      maxCol = Math.max(maxCol, col);
      minRow = Math.min(minRow, row);
      maxRow = Math.max(maxRow, row);
      for (const j of [col > 0 ? i - 1 : -1, col < COLS - 1 ? i + 1 : -1, row > 0 ? i - COLS : -1, row < ROWS - 1 ? i + COLS : -1]) {
        if (j >= 0 && !seen[j] && grid.type[j] === type) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    const known = best.get(type);
    if (size >= 3 && (!known || size > known.size)) best.set(type, { type, size, cx: sx / size + 0.5, cy: sy / size + 0.5, minCol, maxCol, minRow, maxRow });
  }
  return [...best.values()];
}

const placed = [];

/** One tag chip centred near canvas pixel (px, py): the name in the element colour, the note in white. It slides up or down until it clears the chips already placed. */
function chip(ctx, px, py, name, note, color) {
  ctx.font = '800 12px sans-serif';
  const wName = ctx.measureText(name).width;
  const wNote = note ? ctx.measureText(` \u00b7 ${note}`).width : 0;
  const w = wName + wNote + 16;
  const x = Math.min(FIELD.x + FIELD.w - w - 4, Math.max(FIELD.x + 4, px - w / 2));
  let y = Math.min(FIELD.y + FIELD.h - 26, Math.max(FIELD.y + 4, py - 10));
  for (const dy of [0, 24, -24, 48, -48, 72, -72]) {
    const top = Math.min(FIELD.y + FIELD.h - 26, Math.max(FIELD.y + 4, py - 10 + dy));
    if (!placed.some((r) => x < r.x + r.w + 4 && x + w + 4 > r.x && top < r.y + 24 && top + 24 > r.y)) {
      y = top;
      break;
    }
  }
  placed.push({ x, y, w });
  ctx.beginPath();
  ctx.roundRect(x, y, w, 20, 6);
  ctx.fillStyle = 'rgba(4,6,10,0.9)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.stroke();
  drawText(ctx, name, x + 8, y + 15, { size: 12, color, align: 'left', weight: 800, outline: 0 });
  if (note) drawText(ctx, ` \u00b7 ${note}`, x + 8 + wName, y + 15, { size: 12, color: '#ffffff', align: 'left', weight: 800, outline: 0 });
}

/** Draw the field's tags. `game.showAllTags` forces every tag on (the cover shot). */
export function drawLabels(ctx, game) {
  const first = (game.labelSeen ??= {});
  const hover = game.cursor.inField ? game.cursor : null;
  placed.length = 0;
  // The boss and the Core first, so the area tags make way for them.
  const boss = game.boss;
  if (boss) chip(ctx, toScreenX(boss.x), toScreenY(boss.y) + 96, 'COLOSSUS', 'break plates in order', '#ff9a5a');
  const coreX = CORE.col + 0.5;
  const coreY = CORE.row + 0.5;
  const nearCore = hover && Math.hypot(hover.x - coreX, hover.y - coreY) < 4;
  if (game.showAllTags || game.t < 10 || nearCore) chip(ctx, toScreenX(coreX), toScreenY(coreY) + 120, 'CORE', 'defend', '#ffe3a0');
  for (const area of areas(game)) {
    if (game.tagTypes && !game.tagTypes.includes(area.type)) continue;
    first[area.type] ??= game.t;
    const fresh = game.t - first[area.type] < 4.5;
    const hovered = hover && hover.x >= area.minCol - 1.5 && hover.x <= area.maxCol + 2.5 && hover.y >= area.minRow - 1.5 && hover.y <= area.maxRow + 2.5;
    if (!(game.showAllTags || fresh || hovered)) continue;
    const [name, note, color, dy = 0] = TAGS[area.type];
    const right = area.type === CLOUD;
    chip(ctx, toScreenX(right ? area.maxCol - 2 : area.cx), toScreenY(right ? area.minRow + 0.5 : area.cy) + dy, name, note, color);
  }
  void CELL;
}
