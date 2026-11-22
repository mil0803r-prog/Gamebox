import { CARS, CLASSES, carById } from '../../cars/carData.js';
import { Profile } from '../../game/Storage.js';
import { carThumb } from '../components/Thumbs.js';
import { el, money } from '../dom.js';
import { showCarSelect } from './CarSelect.js';
import { showOptions } from './Options.js';
import { showRecords } from './Records.js';
import { showControls } from './Controls.js';
import { showDealer } from './Dealer.js';
import { showArmory } from './Armory.js';

// Iconos de línea (SVG) para el menú
const ICON = {
  race: '<path d="M5 21V4m0 0h11l-2 4 2 4H5"/>',
  duo: '<circle cx="8" cy="8" r="3"/><circle cx="16.5" cy="9" r="2.5"/><path d="M2.5 20c.5-3.5 3-5.5 5.5-5.5s5 2 5.5 5.5M14 15c3 0 5.5 1.5 6 5"/>',
  shop: '<path d="M4 9h16l-1.5-5h-13zM5 9v11h14V9M9 20v-6h6v6"/>',
  pad: '<path d="M7 9h10a4 4 0 014 4v1a3 3 0 01-5.2 2l-1.3-1.5h-5l-1.3 1.5A3 3 0 013 14v-1a4 4 0 014-4z"/><path d="M8 11.5v3M6.5 13h3"/><circle cx="16" cy="12.5" r=".6"/><circle cx="17.6" cy="14" r=".6"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 01-8 0zM8 6H4.5c0 3 1.5 4.5 3.7 4.8M16 6h3.5c0 3-1.5 4.5-3.7 4.8M12 13v4M8.5 20h7l-1-3h-5z"/>',
  aim: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
};
const svg = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</svg>`;

const ITEMS = [
  ['1', 'race', 'Carrera', 'Un jugador contra pilotos de la IA'],
  ['2', 'duo', 'Dos jugadores', 'Pantalla dividida en el mismo equipo'],
  ['shop', 'shop', 'Concesionario', 'Compra autos con el dinero que ganas'],
  ['arm', 'aim', 'Armería', 'Compra armas: disparar gasta monedas'],
  ['rec', 'trophy', 'Récords', 'Tus mejores tiempos en cada pista'],
  ['ctl', 'pad', 'Controles', 'Teclado, mando y pantalla táctil'],
  ['opt', 'gear', 'Opciones', 'Cámara, gráficos, sonido y celular'],
];

// nivel de piloto según el dinero ganado en total
function level() {
  const e = Profile.data.earned || 0;
  const lv = 1 + Math.floor(Math.sqrt(e / 6000));
  const cur = (lv - 1) ** 2 * 6000, next = lv ** 2 * 6000;
  return { lv, pct: Math.min(100, Math.round((e - cur) / (next - cur) * 100)) };
}

export function showMainMenu(ui) {
  ui.game.audio?.music('menu');
  ui.showPauseButton(false);
  const car = carById(ui.s.p1.car);
  const owned = CARS.filter(c => Profile.owns(c.id)).length;
  const { lv, pct } = level();
  const now = new Date();
  const n = el(`<div class="screen main mm">
    <header class="mm-top">
      <div class="mm-brand"><b>TURBO</b><i>DUELO</i></div>
      <div class="mm-status">
        <div class="mm-profile">
          <span class="mm-avatar">${lv}</span>
          <div class="mm-pinfo"><b>Piloto</b><small>Nivel ${lv}</small><span class="mm-xp"><i style="width:${pct}%"></i></span></div>
        </div>
        <div class="mm-stat"><small>Saldo</small><b class="mm-money">${money(Profile.data.money)}</b></div>
        <div class="mm-stat"><small>Garaje</small><b>${owned}<span>/${CARS.length}</span></b></div>
        <div class="mm-clock">${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}</div>
      </div>
    </header>
    <nav class="mm-nav">
      ${ITEMS.map(([a, ic, t, d], i) => `<button class="mm-item${i === 0 ? ' first' : ''}" data-a="${a}" ${i === 0 ? 'data-focus' : ''}>
        <span class="mm-ico">${svg(ic)}</span>
        <span class="mm-txt"><b>${t}</b><small>${d}</small></span>
        <span class="mm-arrow">›</span>
      </button>`).join('')}
    </nav>
    <aside class="mm-car" data-a="garage">
      <div class="mm-car-head"><small>Tu auto</small><span class="mm-cls" style="--cc:${CLASSES[car.cls].color}">Clase ${car.cls}</span></div>
      <img class="mm-car-img" alt="">
      <div class="mm-car-name"><small>${car.brand}</small><b>${car.name}</b></div>
      <div class="mm-car-specs">
        <div><b>${car.top}</b><small>km/h</small></div>
        <div><b>${car.zero.toFixed(1)}s</b><small>0-100</small></div>
        <div><b>${car.hp}</b><small>CV</small></div>
      </div>
    </aside>
    <footer class="mm-prompts">
      ${ui.game.isTouch ? '<span>Toca una opción para continuar</span>' : '<span><kbd>↑</kbd><kbd>↓</kbd> Navegar</span><span><kbd>Enter</kbd> Seleccionar</span><span class="mm-hint">J1 <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> · J2 <kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd> · Mandos compatibles</span>'}
    </footer>
  </div>`);
  carThumb(car, url => { const img = n.querySelector('.mm-car-img'); img.src = url; img.classList.add('ok'); });
  ui.click(n, '[data-a]', (e, b) => {
    ui.game.audio?.unlock();
    const a = b.dataset.a;
    if (a === '1' || a === '2') { ui.mode = +a; showCarSelect(ui); }
    if (a === 'garage') { ui.mode = 1; showCarSelect(ui); }
    if (a === 'opt') showOptions(ui);
    if (a === 'rec') showRecords(ui);
    if (a === 'ctl') showControls(ui);
    if (a === 'shop') showDealer(ui);
    if (a === 'arm') showArmory(ui);
  });
  ui.screen(n, { demo: true, noNav: true, noMoney: true });
}
