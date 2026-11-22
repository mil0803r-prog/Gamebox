import { CARS, COLORS } from '../../cars/carData.js';
import { Settings } from '../../game/Storage.js';
import { CarPreview } from '../components/CarPreview.js';
import { el, hex, STAT_LABELS } from '../dom.js';
import { showMainMenu } from './MainMenu.js';
import { showTrackSelect } from './TrackSelect.js';

const KEYS = {
  1: ['<kbd>A</kbd><kbd>D</kbd> auto · <kbd>W</kbd><kbd>S</kbd> color'],
  2: ['<kbd>A</kbd><kbd>D</kbd> auto · <kbd>W</kbd><kbd>S</kbd> color', '<kbd>←</kbd><kbd>→</kbd> auto · <kbd>↑</kbd><kbd>↓</kbd> color'],
};

export function showCarSelect(ui) {
  const players = ui.mode;
  const n = el(`<div class="screen select">
    <header class="scr-head"><span class="step">PASO 1 / 2</span><h2>ELIGE TU AUTO</h2></header>
    <div class="panels ${players === 2 ? 'two' : ''}"></div>
    <div class="menu-row bottom">
      <button class="btn" data-a="back">‹ Atrás</button>
      <button class="btn go" data-a="next" data-focus>Continuar ›</button>
    </div>
  </div>`);
  const panels = n.querySelector('.panels');
  const state = [ui.s.p1, ui.s.p2];
  const refresh = [];
  const all = () => refresh.forEach(f => f());
  const pns = [];

  for (let p = 0; p < players; p++) {
    const pn = el(`<div class="panel p${p + 1}">
      <div class="ptitle"><span class="pbadge">J${p + 1}</span>JUGADOR ${p + 1}</div>
      <div class="carview">
        <button class="arrow" data-d="-1" aria-label="Anterior">‹</button>
        <div class="stage"><canvas></canvas><div class="pedestal"></div></div>
        <button class="arrow" data-d="1" aria-label="Siguiente">›</button>
      </div>
      <div class="cardots">${CARS.map((_, i) => `<i data-i="${i}"></i>`).join('')}</div>
      <div class="carname"></div>
      <div class="cardesc"></div>
      <div class="stats"></div>
      <div class="swatches">${COLORS.map((c, i) => `<button class="sw" data-c="${i}" style="--sw:${hex(c.hex)}" title="${c.name}"></button>`).join('')}</div>
      ${ui.game.isTouch ? '' : `<div class="keys">${KEYS[players][p]}</div>`}
    </div>`);
    panels.appendChild(pn);
    pns.push(pn);
    const prev = new CarPreview(pn.querySelector('canvas'));
    ui.previews.push(prev);
    const st = state[p];
    let lastCar = -1, lastColor = -1;
    const upd = () => {
      if (players === 2 && state[1 - p].color === st.color) st.color = (st.color + (st._dir || 1) + COLORS.length) % COLORS.length;
      const car = CARS[st.car];
      pn.querySelector('.carname').textContent = car.name;
      pn.querySelector('.cardesc').textContent = car.desc;
      pn.querySelector('.stats').innerHTML = Object.entries(car.stats).map(([k, v]) =>
        `<div class="stat"><span>${STAT_LABELS[k]}</span><div class="bar"><i style="--v:${v / 5}"></i></div><b>${v}</b></div>`).join('');
      pn.querySelectorAll('.cardots i').forEach((d, i) => d.classList.toggle('on', i === st.car));
      pn.querySelectorAll('.sw').forEach((b, i) => {
        b.classList.toggle('sel', i === st.color);
        b.classList.toggle('taken', players === 2 && i === state[1 - p].color);
      });
      pn.style.setProperty('--pc', hex(COLORS[st.color].hex));
      if (lastCar !== st.car || lastColor !== st.color) {
        prev.set(car.shape, COLORS[st.color].hex);
        if (lastCar !== st.car && lastCar >= 0) { pn.classList.remove('swap'); void pn.offsetWidth; pn.classList.add('swap'); }
        lastCar = st.car; lastColor = st.color;
      }
    };
    refresh.push(upd);
    pn._car = d => { st.car = (st.car + d + CARS.length) % CARS.length; all(); ui.game.audio?.ui(); };
    pn._color = d => { st._dir = d; st.color = (st.color + d + COLORS.length) % COLORS.length; upd(); all(); ui.game.audio?.ui(); };
    pn.querySelectorAll('.arrow').forEach(b => b.addEventListener('click', () => pn._car(+b.dataset.d)));
    pn.querySelectorAll('.sw').forEach(b => b.addEventListener('click', () => {
      if (players === 2 && state[1 - p].color === +b.dataset.c) return; // color ocupado
      st.color = +b.dataset.c; all(); ui.game.audio?.ui();
    }));
    upd();
  }
  ui.click(n, '[data-a=back]', () => showMainMenu(ui));
  ui.click(n, '[data-a=next]', () => { Settings.save(); showTrackSelect(ui); });
  ui.screen(n, { back: () => showMainMenu(ui), demo: true });
  ui.keyHandler = code => {
    const map = {
      KeyA: [0, '_car', -1], KeyD: [0, '_car', 1], KeyW: [0, '_color', -1], KeyS: [0, '_color', 1],
      ArrowLeft: [1, '_car', -1], ArrowRight: [1, '_car', 1], ArrowUp: [1, '_color', -1], ArrowDown: [1, '_color', 1],
    };
    const m = map[code];
    if (!m) return false;
    pns[players === 1 ? 0 : m[0]][m[1]](m[2]);
    return true;
  };
}
