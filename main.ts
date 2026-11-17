// CONFLUX hand-in (Node 22+, standard library only). The game is this directory's game/ folder:
// plain static files a desktop browser loads offline (game/index.html and its ES modules, no
// library and no network request). This program checks the entry is laid out the way the gate
// expects, copies game/ and screenshots/ to /output and writes /output/dossier.json, the summary
// the judge reads, with the vendored make.fun library.
//
// Serve the game locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** The scorer's screenshot rule: 3 or 4 images, each at most 256 KiB; the first by name is the cover. */
const SHOT_LIMITS = { min: 3, max: 4, maxBytes: 262144 };

/** Every file under `dir`, as paths relative to it, so the hand-in can count them. */
function listFiles(dir: string, prefix = ''): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) found.push(...listFiles(join(dir, entry.name), relative));
    else found.push(relative);
  }
  return found;
}

/** Refuse to hand in an entry the scorer would reject, with a message saying what to fix. */
function checkEntry(): { gameFiles: number; shots: string[] } {
  if (!existsSync(join(here, 'game', 'index.html'))) throw new Error('game/index.html is missing');
  const shotDir = join(here, 'screenshots');
  const shots = existsSync(shotDir) ? readdirSync(shotDir).filter((name) => !name.startsWith('.')).sort() : [];
  if (shots.length < SHOT_LIMITS.min || shots.length > SHOT_LIMITS.max) {
    throw new Error(`screenshots/ holds ${shots.length} images; the gate wants ${SHOT_LIMITS.min} to ${SHOT_LIMITS.max}`);
  }
  for (const name of shots) {
    const size = statSync(join(shotDir, name)).size;
    if (size > SHOT_LIMITS.maxBytes) throw new Error(`screenshots/${name} is ${size} bytes; the limit is ${SHOT_LIMITS.maxBytes}`);
  }
  return { gameFiles: listFiles(join(here, 'game')).length, shots };
}

const entry = checkEntry();
console.log(`CONFLUX: ${entry.gameFiles} game files, cover ${entry.shots[0]}, ${entry.shots.length} screenshots`);

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: SHOT_LIMITS.max, max_bytes: SHOT_LIMITS.maxBytes },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
