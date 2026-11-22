import { CARS, COLORS, CLASSES, carById } from '../../cars/carData.js';
import { Settings, Profile } from '../../game/Storage.js';
import { CarPreview } from '../components/CarPreview.js';
import { el, hex } from '../dom.js';
import { showMainMenu } from './MainMenu.js';
import { showTrackSelect } from './TrackSelect.js';
import { showDealer } from './Dealer.js';

const KEYS = {
  1: ['<kbd>A</kbd><kbd>D</kbd> auto · <kbd>W</kbd><kbd>S</kbd> color'],
  2: ['<kbd>A</kbd><kbd>D</kbd> auto · <kbd>W</kbd><kbd>S</kbd> color', '<kbd>←</kbd><kbd>→</kbd> auto · <kbd>↑</kbd><kbd>↓</kbd> color'],
};
const BARS = [['speed', 'Velocidad'], ['accel', 'Aceleración'], ['handling', 'Manejo'], ['turbo', 'Turbo']];

// color real de pintura según la opción (-1 = color de fábrica)
export const paintOf = st => st.color < 0 ? carById(st.car).color : COLORS[st.color].hex;

export function showCarSelect(ui) {
  const players = ui.mode;
  const garage = CARS.filter(c => Profile.owns(c.id));
  const n = el(`<div class="screen select">
    <header class="scr-head"><span class="step">PASO 1 / 2 · TU GARAJE (${garage.length}/${CARS.length})</span><h2>ELIGE TU AUTO</h2></header>
    <div class="panels ${players === 2 ? 'two' : ''}"></div>
    <div class="menu-row bottom">
      <button class="btn" data-a="back">‹ Atrás</button>
      <button class="btn pink" data-a="shop">🏪 Concesionario</button>
      <button class="btn go" data-a="next" data-focus>Continuar ›</button>
    </div>
  </div>`);
  const panels = n.querySelector('.panels');
  const state = [ui.s.p1, ui.s.p2];
  const refresh = [];
  const all = () => refresh.forEach(f => f());
  const pns = [];
  const swatchCols = [-1, ...COLORS.map((_, i) => i)];

  for (let p = 0; p < players; p++) {
    const pn = el(`<div class="panel p${p + 1}">
      <div class="ptitle"><span class="pbadge">J${p + 1}</span>JUGADOR ${p + 1}</div>
      <div class="carview">
        <button class="arrow" data-d="-1" aria-label="Anterior">‹</button>
        <div class="stage"><canvas></canvas><div class="pedestal"></div></div>
        <button class="arrow" data-d="1" aria-label="Siguiente">›</button>
      </div>
      <div class="cardots"></div>
      <div class="carclass"></div>
      <div class="carname"></div>
      <div class="carspecs"></div>
      <div class="stats"></div>
      <div class="swatches"></div>
      ${ui.game.isTouch ? '' : `<div class="keys">${KEYS[players][p]}</div>`}
    </div>`);
    panels.appendChild(pn);
    pns.push(pn);
    const prev = new CarPreview(pn.querySelector('canvas'));
    ui.previews.push(prev);
    const st = state[p];
    if (!Profile.owns(st.car)) st.car = garage[0].id;
    let lastKey = '';
    const upd = () => {
      const other = players === 2 ? state[1 - p] : null;
      // no repetir exactamente la misma pintura que el otro jugador
      if (other && paintOf(other) === paintOf(st)) {
        let i = swatchCols.indexOf(st.color);
        do { i = (i + (st._dir || 1) + swatchCols.length) % swatchCols.length; st.color = swatchCols[i]; } while (paintOf(other) === paintOf(st));
      }
      const car = carById(st.car);
      const gi = garage.findIndex(c => c.id === car.id);
      pn.querySelector('.cardots').innerHTML = garage.length <= 12 ? garage.map((_, i) => `<i class="${i === gi ? 'on' : ''}"></i>`).join('') : `<span class="count">${gi + 1} / ${garage.length}</span>`;
      pn.querySelector('.carclass').innerHTML = `<span style="--cc:${CLASSES[car.cls].color}">CLASE ${car.cls} · ${CLASSES[car.cls].name}</span> <small>${car.brand}</small>`;
      pn.querySelector('.carname').textContent = car.name;
      pn.querySelector('.carspecs').innerHTML = `<span><b>${car.top}</b> km/h</span><span><b>${car.zero.toFixed(1)}</b> s 0-100</span><span><b>${car.hp}</b> CV</span>`;
      pn.querySelector('.stats').innerHTML = BARS.map(([k, l]) =>
        `<div class="stat"><span>${l}</span><div class="bar"><i style="--v:${car.bars[k] / 10}"></i></div><b>${car.bars[k]}</b></div>`).join('');
      pn.querySelector('.swatches').innerHTML = swatchCols.map(ci => {
        const h = ci < 0 ? car.color : COLORS[ci].hex;
        const taken = other && paintOf(other) === h;
        return `<button class="sw ${ci === st.color ? 'sel' : ''} ${taken ? 'taken' : ''} ${ci < 0 ? 'factory' : ''}" data-c="${ci}" style="--sw:${hex(h)}" title="${ci < 0 ? 'Color de fábrica' : COLORS[ci].name}"></button>`;
      }).join('');
      pn.querySelectorAll('.sw').forEach(b => b.addEventListener('click', () => {
        if (b.classList.contains('taken')) return;
        st.color = +b.dataset.c; all(); ui.game.audio?.ui();
      }));
      const paint = paintOf(st);
      pn.style.setProperty('--pc', hex(paint));
      const key = car.id + paint;
      if (key !== lastKey) {
        if (lastKey && !lastKey.startsWith(car.id)) { pn.classList.remove('swap'); void pn.offsetWidth; pn.classList.add('swap'); }
        prev.set(car, paint);
        lastKey = key;
      }
    };
    refresh.push(upd);
    pn._car = d => {
      const gi = garage.findIndex(c => c.id === st.car);
      st.car = garage[(gi + d + garage.length) % garage.length].id;
      all(); ui.game.audio?.ui();
    };
    pn._color = d => {
      st._dir = d;
      const i = swatchCols.indexOf(st.color);
      st.color = swatchCols[(i + d + swatchCols.length) % swatchCols.length];
      all(); ui.game.audio?.ui();
    };
    pn.querySelectorAll('.arrow').forEach(b => b.addEventListener('click', () => pn._car(+b.dataset.d)));
  }
  all();
  ui.click(n, '[data-a=back]', () => showMainMenu(ui));
  ui.click(n, '[data-a=shop]', () => showDealer(ui, () => showCarSelect(ui)));
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
