// Boot and the one loop. The simulation advances in fixed 1/60 s steps; the screen state machine
// moves between title (with attract mode), how-to-play, play, pause, boon pick, win and lose.
//
// ?seed=N fixes the random seed. ?shot=cover|title|boon|results (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, DIFFICULTIES, DIFFICULTY_KEY, H, RECORD_KEY, STEP, W } from './config.js';
import { createInput } from './input.js';
import { beginNextPrep, callRift, createGame, selectBrush, setCursor, updateGame } from './game.js';
import { drawBattlefield } from './render.js';
import { brushCardAt, drawHud } from './hud.js';
import { OVERLAY_OFFSET, boonCardAt, drawBoonPick, drawHelp, drawPause } from './screens.js';
import { drawTitle, titleHit } from './menus.js';
import { drawResults } from './results.js';
import { takeBoon } from './boons.js';
import { createBot, botStep } from './autopilot.js';
import { isMuted, sfx, toggleMute, unlockAudio, updateMusic } from './audio.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
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

/** Scale the fixed 1280x720 canvas to the window, keeping its shape. */
function fitCanvas() {
  const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
  canvas.style.width = `${Math.floor(W * scale)}px`;
  canvas.style.height = `${Math.floor(H * scale)}px`;
}

/** Paint one complete frame: battlefield, HUD, then the overlay for the current screen. */
function paint(game, screen, bests, time, hover, menu = { difficulty: 1, hit: null }) {
  if (screen === 'win' || screen === 'lose') {
    drawResults(ctx, game, bests, screen === 'win', time);
    return;
  }
  ctx.fillStyle = '#05060a';
  ctx.fillRect(0, 0, W, H);
  drawBattlefield(ctx, game, time);
  drawHud(ctx, game, bests, time);
  if (screen === 'title') drawTitle(ctx, time, menu.difficulty, menu.hit);
  ctx.save();
  ctx.translate(0, OVERLAY_OFFSET);
  if (screen === 'help') drawHelp(ctx, time);
  else if (screen === 'pause') drawPause(ctx);
  ctx.restore();
  if (screen === 'boon') drawBoonPick(ctx, game, hover, time);
}

function runShot(name) {
  const scene = stageShot(name, baseSeed);
  let painted = 0;
  function frame() {
    paint(scene.game, scene.screen, scene.bests, scene.time, scene.hover ?? -1, { difficulty: scene.difficulty ?? 1, hit: null });
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
  let difficulty = Math.min(DIFFICULTIES.length - 1, readNumber(DIFFICULTY_KEY + '.set') ? readNumber(DIFFICULTY_KEY) : 1);
  let game = createGame(baseSeed, difficulty);
  let attract = createGame(baseSeed + 1);
  const bot = createBot();
  let accumulator = 0;
  let last = performance.now();
  let endedAt = 0;

  function announce(message) {
    status.textContent = message;
  }

  function newRun() {
    game = createGame(Number.isInteger(seedParam) ? baseSeed : Math.floor(Math.random() * 4294967296), difficulty);
    screen = 'play';
    accumulator = 0;
    announce('Playing. Rift 1 opens soon. Paint with the mouse, keys 1 to 4 pick the brush.');
  }

  function recordRun() {
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
    writeNumber(DIFFICULTY_KEY + '.set', 1);
    sfx.click();
  }

  function chooseBoon(index) {
    const boon = game.offer[index];
    if (!boon) return;
    takeBoon(game, boon.id);
    sfx.boon();
    beginNextPrep(game);
    screen = 'play';
    announce(`Boon taken: ${boon.name}. Rift ${game.riftNum + 1} opens soon.`);
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
        else if (code === 'ArrowLeft' || code === 'KeyA') setDifficulty(difficulty - 1);
        else if (code === 'ArrowRight' || code === 'KeyD') setDifficulty(difficulty + 1);
        else if (code === 'Digit1' || code === 'Digit2' || code === 'Digit3') setDifficulty(Number(code.slice(5)) - 1);
      } else if (screen === 'help' && (code === 'Space' || code === 'Enter')) newRun();
      else if (screen === 'play') {
        if (code.startsWith('Digit')) selectBrush(game, Number(code.slice(5)) - 1);
        else if (code === 'Space' || code === 'Enter') callRift(game);
        else if (code === 'KeyP' || code === 'Escape') screen = 'pause';
      } else if (screen === 'pause') {
        if (code === 'KeyP' || code === 'Escape' || code === 'Space') screen = 'play';
        else if (code === 'KeyR') newRun();
      } else if (screen === 'boon') {
        if (code === 'Digit1' || code === 'Digit2' || code === 'Digit3') chooseBoon(Number(code.slice(5)) - 1);
      } else if ((screen === 'win' || screen === 'lose') && performance.now() - endedAt > 900 && (code === 'KeyR' || code === 'Space' || code === 'Enter')) newRun();
    }
  }

  function handleClicks() {
    for (const click of input.takeClicks()) {
      unlockAudio();
      if (screen === 'title') {
        const hit = titleHit(click.x, click.y);
        if (hit && hit.type === 'diff') setDifficulty(hit.index);
        else if (hit && hit.type === 'start') newRun();
      } else if (screen === 'help') newRun();
      else if (screen === 'boon') chooseBoon(boonCardAt(click.x, click.y));
      else if (screen === 'play') {
        const card = brushCardAt(click.x, click.y);
        if (card >= 0) selectBrush(game, card);
      } else if ((screen === 'win' || screen === 'lose') && performance.now() - endedAt > 900) newRun();
    }
  }

  function step() {
    if (screen === 'title' || screen === 'help') {
      botStep(bot, attract, STEP);
      updateGame(attract, STEP);
      if (attract.phase === 'won' || attract.phase === 'lost') attract = createGame(baseSeed + attract.riftNum + 7);
      return;
    }
    if (screen !== 'play') return;
    setCursor(game, input.pointer.x, input.pointer.y, input.pointer.down);
    updateGame(game, STEP);
    if (game.phase === 'boon') {
      screen = 'boon';
      announce(`Rift ${game.riftNum} cleared. Choose a boon with 1, 2 or 3.`);
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
    // Overlay screens still animate the board behind them (particles settle) at a gentle pace.
    if (screen === 'boon' || screen === 'win' || screen === 'lose') updateGame(game, STEP);
    const showing = screen === 'title' || screen === 'help' ? attract : game;
    const hover = screen === 'boon' ? boonCardAt(input.pointer.x, input.pointer.y) : -1;
    const intensity = screen === 'title' || screen === 'help' ? 0.25 : game.boss ? 1 : 0.2 + (game.riftNum / 7) * 0.65;
    updateMusic(screen === 'pause' ? 0 : intensity);
    const menu = { difficulty, hit: screen === 'title' ? titleHit(input.pointer.x, input.pointer.y) : null };
    paint(showing, screen, bests, now / 1000, hover, menu);
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