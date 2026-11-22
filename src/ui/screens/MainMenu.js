import { el } from '../dom.js';
import { showCarSelect } from './CarSelect.js';
import { showOptions } from './Options.js';
import { showRecords } from './Records.js';
import { showControls } from './Controls.js';
import { showDealer } from './Dealer.js';

export function showMainMenu(ui) {
  ui.game.audio?.music('menu');
  ui.showPauseButton(false);
  const n = el(`<div class="screen main">
    <div class="main-left">
      <div class="logo">
        <div class="logo-streaks"><i></i><i></i><i></i></div>
        <span class="l1">TURBO</span><span class="l2">DUELO</span>
        <div class="logo-sub">ARCADE · 2 JUGADORES · PANTALLA DIVIDIDA</div>
      </div>
      <nav class="menu-col">
        <button class="btn mbtn primary" data-a="1"><span class="mi">🏎️</span><span class="mt">1 JUGADOR<small>Contra la IA</small></span><span class="ma">›</span></button>
        <button class="btn mbtn pink" data-a="2"><span class="mi">👥</span><span class="mt">2 JUGADORES<small>Pantalla dividida</small></span><span class="ma">›</span></button>
        <button class="btn mbtn shop" data-a="shop"><span class="mi">🏪</span><span class="mt">CONCESIONARIO<small>24 autos · compra con lo que ganes</small></span><span class="ma">›</span></button>
        <div class="menu-grid">
          <button class="btn mbtn small" data-a="ctl"><span class="mi">🎮</span><span class="mt">Controles</span></button>
          <button class="btn mbtn small" data-a="rec"><span class="mi">🏆</span><span class="mt">Récords</span></button>
          <button class="btn mbtn small" data-a="opt"><span class="mi">⚙️</span><span class="mt">Opciones</span></button>
        </div>
      </nav>
    </div>
    <div class="main-foot">${ui.game.isTouch ? 'Cada jugador usa su mitad de la pantalla' : 'J1: <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> · J2: <kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd> · Mandos compatibles'}</div>
  </div>`);
  ui.click(n, '[data-a]', (e, b) => {
    ui.game.audio?.unlock();
    const a = b.dataset.a;
    if (a === '1' || a === '2') { ui.mode = +a; showCarSelect(ui); }
    if (a === 'opt') showOptions(ui);
    if (a === 'rec') showRecords(ui);
    if (a === 'ctl') showControls(ui);
    if (a === 'shop') showDealer(ui);
  });
  ui.screen(n, { demo: true });
}
