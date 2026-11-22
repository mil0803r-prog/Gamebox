import { Keyboard, KEYMAPS } from './Keyboard.js';
import { Gamepads } from './Gamepads.js';

// Combina teclado, mandos y táctil en un estado por jugador
export class InputManager {
  constructor() {
    this.kb = new Keyboard();
    this.pads = new Gamepads();
    this.touch = null; // se asigna desde TouchControls
    this.humans = 1;
    this.prevItem = [false, false];
  }

  setHumans(n) { this.humans = n; }

  poll() {
    const out = [];
    const pads = this.pads.list();
    for (let p = 0; p < this.humans; p++) {
      const st = { steer: 0, throttle: 0, brake: 0, drift: false, boost: false, item: false, itemPressed: false, pausePressed: false };
      const maps = this.humans === 1 ? KEYMAPS : [KEYMAPS[p]];
      for (const m of maps) {
        const kb = this.kb;
        if (kb.any(m.left)) st.steer -= 1;
        if (kb.any(m.right)) st.steer += 1;
        if (kb.any(m.up)) st.throttle = 1;
        if (kb.any(m.down)) st.brake = 1;
        if (kb.any(m.drift)) st.drift = true;
        if (kb.any(m.boost)) st.boost = true;
        if (kb.any(m.item)) st.item = true;
      }
      st.steer = Math.max(-1, Math.min(1, st.steer));
      // mandos
      const myPads = this.humans === 1 ? pads.map((pd, i) => [pd, i]) : (pads[p] ? [[pads[p], p]] : []);
      for (const [pad, slot] of myPads) {
        const g = this.pads.read(pad, slot);
        if (Math.abs(g.steer) > Math.abs(st.steer)) st.steer = g.steer;
        st.throttle = Math.max(st.throttle, g.throttle);
        st.brake = Math.max(st.brake, g.brake);
        st.drift = st.drift || g.drift;
        st.boost = st.boost || g.boost;
        st.item = st.item || g.item;
        st.pausePressed = st.pausePressed || g.pausePressed;
      }
      // táctil
      if (this.touch) this.touch.apply(p, st, this.humans);
      st.itemPressed = st.item && !this.prevItem[p];
      this.prevItem[p] = st.item;
      out.push(st);
    }
    if (this.kb.consume('Escape') || this.kb.consume('KeyP')) out.pausePressed = true;
    for (const s of out) if (s.pausePressed) out.pausePressed = true;
    this.kb.endFrame();
    return out;
  }
}
