// Boot and the one loop. The simulation advances in fixed 1/60 s steps; the screen state machine
// moves between title (with attract mode), how-to-play, the Rift Path (map and boon pick), play,
// pause, win and lose.
//
// ?seed=N fixes the random seed. ?shot=cover|title|path|results (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, DIFFICULTIES, DIFFICULTY_KEY, H, RECORD_KEY, SEED_KEY, STEP, W, THEME } from './config.js';
import { createInput } from './input.js';
import { autoAdvance, callRift, createGame, pickNode, rerollBoons, resolveShrine, selectBrush, setCursor, tryProceed, updateGame } from './game.js';
import { drawBattlefield, screenToWorld } from './render.js';
import { brushCardAt, drawHud, overHud } from './hud.js';
import { OVERLAY_OFFSET, drawHelp, drawPause } from './screens.js';
import { drawTitle, titleHit } from './menus.js';
import { OMENS, OMEN_KEY } from './omens.js';
import { recordRunHistory } from './history.js';
import { drawResults, resultsButtons } from './results.js';
import { drawPath, drawShrine, pathBoonAt, pathNodeAt, rerollHit, shrineChoiceAt } from './pathscreen.js';
import { takeBoon } from './boons.js';
import { createBot, botStep } from './autopilot.js';
import { isMuted, sfx, toggleMute, unlockAudio, updateMusic } from './audio.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
THEME.bright = params.get('theme') === 'bright' || Boolean(shot && shot.endsWith('_d'));
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const baseSeed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
canvas.width = W;
canvas.height = H;
const ctx = canvas.getContext('2d');

function readNumber(key) {
  try {
    return Number.parseInt(window.localStorage.getItem(key) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function writeNumber(key, value) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Storage can be off (private windows): records then last this visit only.
  }
}

/** Scale the fixed 1280x800 canvas to the window, keeping its shape. */
function fitCanvas() {
  const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
  canvas.style.width = `${Math.floor(W * scale)}px`;
  canvas.style.height = `${Math.floor(H * scale)}px`;
}

/**
 * Paint one complete frame for the current screen. `ui` carries what the screens need beyond the
 * game: { difficulty, sameSeed, hit } for the title, { hoverNode, hoverBoon } for the path.
 */
function paintScreen(game, screen, bests, time, ui = {}) {
  if (screen === 'win' || screen === 'lose') {
    drawResults(ctx, game, bests, screen === 'win', time);
    return;
  }
  if (screen === 'path') {
    drawPath(ctx, game, time, ui);
    if (game.phase === 'shrine') drawShrine(ctx, game, time);
    return;
  }
  ctx.fillStyle = '#05060a';
  ctx.fillRect(0, 0, W, H);
  drawBattlefield(ctx, game, time);
  if (screen === 'title') {
    // No game HUD behind the title: the attract battlefield, enlarged, blurred and darkened.
    ctx.save();
    ctx.filter = 'blur(4px) brightness(0.95) saturate(1.1)';
    ctx.drawImage(canvas, 0, 0);
    ctx.restore();
    drawTitle(ctx, time, ui.difficulty ?? 1, ui.hit ?? null, Boolean(ui.sameSeed), ui.seed ?? 0, ui.omen ?? 0);
    return;
  }
  drawHud(ctx, game, bests, time);
  ctx.save();
  ctx.translate(0, OVERLAY_OFFSET);
  if (screen === 'help') drawHelp(ctx, time);
  else if (screen === 'pause') drawPause(ctx);
  ctx.restore();
}

function runShot(name) {
  const scene = stageShot(name, baseSeed);
  let painted = 0;
  function frame() {
    paintScreen(scene.game, scene.screen, scene.bests, scene.time, { difficulty: scene.difficulty ?? 1, omen: scene.omen ?? 0, sameSeed: false, seed: scene.game.seed, hit: null, hoverNode: scene.hoverNode, hoverBoon: scene.hoverBoon });
    painted += 1;
    if (painted < 2) requestAnimationFrame(frame);
    else window.__shotReady = true;
  }
  requestAnimationFrame(frame);
}

function runGame() {
  const input = createInput(canvas);
  const bests = { score: readNumber(BEST_KEY), chain: readNumber(RECORD_KEY) };
  let screen = 'title';
  let difficulty = Math.min(DIFFICULTIES.length - 1, readNumber(`${DIFFICULTY_KEY}.set`) ? readNumber(DIFFICULTY_KEY) : 1);
  let sameSeed = readNumber(`${SEED_KEY}.same`) === 1;
  let omen = Math.min(OMENS.length - 1, readNumber(OMEN_KEY));
  let lastSeed = readNumber(SEED_KEY) || baseSeed;
  let game = createGame(baseSeed, difficulty);
  let attract = createGame(baseSeed + 1);
  autoAdvance(attract);
  const bot = createBot();
  let accumulator = 0;
  let last = performance.now();
  let endedAt = 0;

  function announce(message) {
    status.textContent = message;
  }

  /** Start a run: a fresh random seed, or the last run's seed when "Same seed" is on. */
  function newRun(forceSame = false) {
    const seed = sameSeed || forceSame ? lastSeed : Number.isInteger(seedParam) ? baseSeed : Math.floor(Math.random() * 4294967296);
    lastSeed = seed;
    writeNumber(SEED_KEY, seed);
    game = createGame(seed, difficulty, omen);
    screen = 'path';
    accumulator = 0;
    announce('The Rift Path. Pick your first rift.');
  }

  function recordRun() {
    game.history = recordRunHistory(game, game.phase === 'won');
    if (game.score > bests.score) {
      bests.score = game.score;
      writeNumber(BEST_KEY, bests.score);
    }
    if (game.stats.bestChain > bests.chain) {
      bests.chain = game.stats.bestChain;
      writeNumber(RECORD_KEY, bests.chain);
    }
  }

  function setDifficulty(index) {
    difficulty = (index + DIFFICULTIES.length) % DIFFICULTIES.length;
    writeNumber(DIFFICULTY_KEY, difficulty);
    writeNumber(`${DIFFICULTY_KEY}.set`, 1);
    sfx.click();
  }

  function setOmen(index) {
    omen = (index + OMENS.length) % OMENS.length;
    writeNumber(OMEN_KEY, omen);
    sfx.click();
  }

  function toggleSameSeed() {
    sameSeed = !sameSeed;
    writeNumber(`${SEED_KEY}.same`, sameSeed ? 1 : 0);
    sfx.click();
  }

  /** After a path-screen action: if the rift is ready to start, go to play. */
  function afterPathAction() {
    if (game.phase === 'prep') {
      screen = 'play';
      announce(`Rift ${game.riftNum + 1} opens soon. Paint your defences.`);
    }
  }

  function chooseBoon(index) {
    const boon = game.offer[index];
    if (!boon) return;
    takeBoon(game, boon.id);
    game.offer = [];
    sfx.boon();
    tryProceed(game);
    afterPathAction();
    announce(`Boon taken: ${boon.name}. Now pick a rift.`);
  }

  function handleKeys() {
    for (const code of input.takeKeys()) {
      unlockAudio();
      if (code === 'KeyM') {
        toggleMute();
        announce(isMuted() ? 'Sound off.' : 'Sound on.');
        continue;
      }
      if (screen === 'title') {
        if (code === 'Space' || code === 'Enter') newRun();
        else if (code === 'KeyH') screen = 'help';
        else if (code === 'KeyS') toggleSameSeed();
        else if (code === 'KeyO') setOmen(omen + 1);
        else if (code === 'ArrowLeft' || code === 'KeyA') setDifficulty(difficulty - 1);
        else if (code === 'ArrowRight' || code === 'KeyD') setDifficulty(difficulty + 1);
        else if (code === 'Digit1' || code === 'Digit2' || code === 'Digit3') setDifficulty(Number(code.slice(5)) - 1);
      } else if (screen === 'help') {
        if (code === 'Space' || code === 'Enter') newRun();
      } else if (screen === 'play') {
        if (code.startsWith('Digit')) selectBrush(game, Number(code.slice(5)) - 1);
        else if (code === 'Space' || code === 'Enter') callRift(game);
        else if (code === 'KeyP' || code === 'Escape') screen = 'pause';
      } else if (screen === 'pause') {
        if (code === 'KeyP' || code === 'Escape' || code === 'Space') screen = 'play';
        else if (code === 'KeyR') newRun();
      } else if (screen === 'path') {
        if (game.phase === 'shrine') {
          if (code === 'KeyH') resolveShrine(game, 'heal');
          else if (code === 'KeyR') resolveShrine(game, 'reroll');
        } else if (code === 'Digit1' || code === 'Digit2' || code === 'Digit3') chooseBoon(Number(code.slice(5)) - 1);
        else if (code === 'KeyQ' && rerollBoons(game)) sfx.click();
      } else if ((screen === 'win' || screen === 'lose') && performance.now() - endedAt > 900) {
        if (code === 'KeyR' || code === 'Space' || code === 'Enter') newRun();
        else if (code === 'KeyS') newRun(true);
        else if (code === 'KeyT') screen = 'title';
      }
    }
  }

  function handleClicks() {
    for (const click of input.takeClicks()) {
      unlockAudio();
      if (screen === 'title') {
        const hit = titleHit(click.x, click.y);
        if (hit && hit.type === 'diff') setDifficulty(hit.index);
        else if (hit && hit.type === 'omen') setOmen(hit.index);
        else if (hit && hit.type === 'seed') toggleSameSeed();
        else if (hit && hit.type === 'start') newRun();
      } else if (screen === 'help') newRun();
      else if (screen === 'path') {
        if (game.phase === 'shrine') {
          const choice = shrineChoiceAt(click.x, click.y);
          if (choice) resolveShrine(game, choice);
          continue;
        }
        const card = pathBoonAt(click.x, click.y);
        if (card >= 0) chooseBoon(card);
        else if (rerollHit(click.x, click.y)) {
          if (rerollBoons(game)) sfx.click();
        } else {
          const node = pathNodeAt(game, click.x, click.y);
          if (node && pickNode(game, node.id)) {
            sfx.click();
            afterPathAction();
          }
        }
      } else if (screen === 'play') {
        const card = brushCardAt(click.x, click.y);
        if (card >= 0) selectBrush(game, card);
      } else if ((screen === 'win' || screen === 'lose') && performance.now() - endedAt > 900) {
        const buttons = resultsButtons(game, screen === 'win');
        const b = buttons.title;
        const s = buttons.seed;
        if (click.x >= b.x && click.x < b.x + b.w && click.y >= b.y && click.y < b.y + b.h) screen = 'title';
        else if (click.x >= s.x && click.x < s.x + s.w && click.y >= s.y && click.y < s.y + s.h) newRun(true);
        else newRun();
      }
    }
  }

  function step() {
    if (screen === 'title' || screen === 'help') {
      autoAdvance(attract);
      if (attract.phase === 'prep' && attract.prepTimer > 3) callRift(attract);
      botStep(bot, attract, STEP);
      updateGame(attract, STEP);
      if (attract.phase === 'won' || attract.phase === 'lost') {
        attract = createGame(baseSeed + attract.riftNum + 7);
        autoAdvance(attract);
      }
      return;
    }
    if (screen !== 'play') return;
    const world = screenToWorld(input.pointer.x, input.pointer.y);
    setCursor(game, world.x, world.y, input.pointer.down && !overHud(input.pointer.x, input.pointer.y));
    updateGame(game, STEP);
    if (game.phase === 'path') {
      screen = 'path';
      announce(`Rift ${game.riftNum} cleared. Take a boon and pick the next rift.`);
    } else if (game.phase === 'won' || game.phase === 'lost') {
      screen = game.phase === 'won' ? 'win' : 'lose';
      endedAt = performance.now();
      recordRun();
      announce(game.phase === 'won' ? `Conflux mastered. Score ${game.score}.` : `The Core shatters. Score ${game.score}.`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleKeys();
    handleClicks();
    let guard = 0;
    while (accumulator >= STEP && guard < 6) {
      step();
      accumulator -= STEP;
      guard += 1;
    }
    if (guard === 6) accumulator = 0;
    // The end screens' backdrops keep animating through the particles of the finished run.
    if (screen === 'win' || screen === 'lose') updateGame(game, STEP);
    const showing = screen === 'title' || screen === 'help' ? attract : game;
    const ui = { difficulty, omen, sameSeed, seed: lastSeed, hit: screen === 'title' ? titleHit(input.pointer.x, input.pointer.y) : null };
    if (screen === 'path') {
      const node = pathNodeAt(game, input.pointer.x, input.pointer.y);
      ui.hoverNode = node ? node.id : null;
      ui.hoverBoon = pathBoonAt(input.pointer.x, input.pointer.y);
    }
    const intensity = screen === 'title' || screen === 'help' ? 0.25 : screen === 'path' ? 0.15 : game.boss ? 1 : 0.2 + (game.riftNum / 7) * 0.65;
    updateMusic(screen === 'pause' ? 0 : intensity);
    paintScreen(showing, screen, bests, now / 1000, ui);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') screen = 'pause';
  });
  announce('CONFLUX. Choose a difficulty, then press Space or click Start.');
  requestAnimationFrame(frame);
}

fitCanvas();
window.addEventListener('resize', fitCanvas);
if (shot) runShot(shot);
else runGame();
