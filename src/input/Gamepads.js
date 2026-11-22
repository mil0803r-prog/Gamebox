// Gamepad API (mapeo estándar). A=acelerar, X=frenar, B=turbo, RB=derrape, LB/Y=ítem, RT/LT analógicos, Start=pausa
export class Gamepads {
  constructor() {
    this.prev = [{}, {}, {}, {}];
    this.connected = 0;
    window.addEventListener('gamepadconnected', () => this.connected++);
    window.addEventListener('gamepaddisconnected', () => this.connected = Math.max(0, this.connected - 1));
  }
  list() {
    let pads = [];
    try { pads = navigator.getGamepads ? navigator.getGamepads() : []; } catch { pads = []; } // bloqueado en algunos iframes
    const out = [];
    for (const p of pads) if (p && p.connected) out.push(p);
    return out;
  }
  read(pad, slot) {
    const b = i => (pad.buttons[i] ? pad.buttons[i].value || (pad.buttons[i].pressed ? 1 : 0) : 0);
    let steer = pad.axes[0] || 0;
    if (Math.abs(steer) < 0.15) steer = 0; else steer = (steer - Math.sign(steer) * 0.15) / 0.85;
    if (b(14)) steer = -1; if (b(15)) steer = 1;
    const throttle = Math.max(b(0), b(7), b(12) ? 1 : 0);
    const brake = Math.max(b(2), b(6), b(13) ? 1 : 0);
    const st = {
      steer, throttle, brake: brake > 0.1 ? brake : 0,
      drift: b(5) > 0.5, boost: b(1) > 0.5,
      item: b(4) > 0.5 || b(3) > 0.5,
      pause: b(9) > 0.5,
    };
    const prev = this.prev[slot] || {};
    st.itemPressed = st.item && !prev.item;
    st.pausePressed = st.pause && !prev.pause;
    st.confirmPressed = b(0) > 0.5 && !prev.confirm;
    st.confirm = b(0) > 0.5;
    this.prev[slot] = st;
    return st;
  }
}
