// Teclado: guarda teclas presionadas por e.code
export const KEYMAPS = [
  { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], drift: ['ShiftLeft'], boost: ['Space'], item: ['KeyE', 'KeyQ'], cam: ['KeyC'], fire: ['KeyF'], next: ['KeyR'] },
  { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], drift: ['ControlRight'], boost: ['Enter', 'NumpadEnter'], item: ['ShiftRight', 'Numpad0'], cam: ['Slash', 'Numpad1', 'Minus'], fire: ['Period', 'NumpadAdd'], next: ['Comma', 'NumpadSubtract'] },
];

const PREVENT = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'ShiftLeft', 'ShiftRight', 'ControlRight', 'Enter', 'Tab']);

export class Keyboard {
  constructor() {
    this.down = new Set();
    this.pressedOnce = new Set();
    window.addEventListener('keydown', e => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
      if (PREVENT.has(e.code) && this.captureGameKeys) e.preventDefault();
      if (!this.down.has(e.code)) this.pressedOnce.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', e => { this.down.delete(e.code); });
    window.addEventListener('blur', () => this.down.clear());
    this.captureGameKeys = true;
  }
  any(codes) { for (const c of codes) if (this.down.has(c)) return true; return false; }
  consume(code) { const h = this.pressedOnce.has(code); this.pressedOnce.delete(code); return h; }
  endFrame() { this.pressedOnce.clear(); }
}
