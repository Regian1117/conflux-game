// Mouse and keyboard. The pointer is tracked in the canvas's 1280x720 logical pixels whatever size
// the window scales it to; key presses and clicks are queued so the loop takes each exactly once.
import { H, W } from './config.js';

const HANDLED = new Set(['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Space', 'Enter', 'KeyP', 'Escape', 'KeyM', 'KeyR', 'KeyH', 'ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'KeyT']);

export function createInput(canvas) {
  const pointer = { x: 0, y: 0, down: false };
  let keys = [];
  let clicks = [];

  function locate(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) * W) / rect.width;
    pointer.y = ((event.clientY - rect.top) * H) / rect.height;
  }

  canvas.addEventListener('pointermove', locate);
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    locate(event);
    pointer.down = true;
    clicks.push({ x: pointer.x, y: pointer.y });
    canvas.setPointerCapture?.(event.pointerId);
  });
  const release = () => {
    pointer.down = false;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  window.addEventListener('blur', release);
  window.addEventListener('keydown', (event) => {
    if (!HANDLED.has(event.code)) return;
    event.preventDefault();
    if (!event.repeat) keys.push(event.code);
  });

  return {
    pointer,
    takeKeys() {
      const taken = keys;
      keys = [];
      return taken;
    },
    takeClicks() {
      const taken = clicks;
      clicks = [];
      return taken;
    },
  };
}
