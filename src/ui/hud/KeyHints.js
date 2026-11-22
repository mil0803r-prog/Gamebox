// Guía de teclas en pantalla (solo PC). Cada tecla se ilumina al presionarla.
const KEY_LABEL = {
  KeyW: 'W', KeyA: 'A', KeyS: 'S', KeyD: 'D', KeyE: 'E',
  ArrowUp: '↑', ArrowLeft: '←', ArrowDown: '↓', ArrowRight: '→',
  ShiftLeft: '⇧ Shift', ShiftRight: '⇧ Der.', ControlRight: 'Ctrl Der.', Space: 'Espacio', Enter: 'Enter', Escape: 'Esc',
};

const SETS = [
  { move: ['KeyW', 'KeyA', 'KeyS', 'KeyD'], drift: 'ShiftLeft', boost: 'Space', item: 'KeyE' },
  { move: ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'], drift: 'ControlRight', boost: 'Enter', item: 'ShiftRight' },
];

const cap = (code, extra = '') => `<kbd data-k="${code}" class="${extra}">${KEY_LABEL[code] || code}</kbd>`;
const cluster = m => `<div class="kh-cluster"><div>${cap(m[0])}</div><div>${cap(m[1])}${cap(m[2])}${cap(m[3])}</div></div>`;

export class KeyHints {
  constructor(parent, humanIndex, humans, items) {
    const el = this.el = document.createElement('div');
    el.className = 'keyhints';
    const sets = humans === 1 ? SETS : [SETS[humanIndex]];
    const s = sets[0];
    if (humans === 1) {
      el.innerHTML = `
        <div class="kh-group">${cluster(SETS[0].move)}<span class="kh-or">/</span>${cluster(SETS[1].move)}<span class="kh-lbl">Dirigir</span></div>
        <div class="kh-group">${cap('ShiftLeft', 'wide')}<span class="kh-lbl">Derrape</span></div>
        <div class="kh-group">${cap('Space', 'wide')}<span class="kh-lbl">Turbo</span></div>
        ${items ? `<div class="kh-group">${cap('KeyE')}<span class="kh-lbl">Ítem</span></div>` : ''}
        <div class="kh-group">${cap('Escape')}<span class="kh-lbl">Pausa</span></div>`;
    } else {
      el.innerHTML = `
        <div class="kh-group">${cluster(s.move)}<span class="kh-lbl">Dirigir</span></div>
        <div class="kh-group">${cap(s.drift, 'wide')}<span class="kh-lbl">Derrape</span></div>
        <div class="kh-group">${cap(s.boost, 'wide')}<span class="kh-lbl">Turbo</span></div>
        ${items ? `<div class="kh-group">${cap(s.item, s.item.length > 4 ? 'wide' : '')}<span class="kh-lbl">Ítem</span></div>` : ''}`;
    }
    // en 1 jugador también valen Ctrl der. y Enter
    this.alias = humans === 1 ? { ShiftLeft: ['ShiftLeft', 'ControlRight'], Space: ['Space', 'Enter'], KeyE: ['KeyE', 'ShiftRight'] } : {};
    this.caps = [...el.querySelectorAll('kbd')];
    parent.appendChild(el);
    this.last = '';
  }

  update(kb) {
    let sig = '';
    for (const c of this.caps) {
      const codes = this.alias[c.dataset.k] || [c.dataset.k];
      const on = codes.some(k => kb.down.has(k));
      sig += on ? '1' : '0';
      c._on = on;
    }
    if (sig === this.last) return;
    this.last = sig;
    for (const c of this.caps) c.classList.toggle('on', c._on);
  }
}
