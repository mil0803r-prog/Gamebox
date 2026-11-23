import { el } from '../dom.js';
import { showMainMenu } from './MainMenu.js';

// Pantalla de inicio: logo animado y "presiona cualquier tecla" (también activa el sonido)
export function showSplash(ui) {
  const touch = ui.game.isTouch;
  const n = el(`<div class="screen splash">
    <div class="sp-rays"></div>
    <div class="sp-logo">
      <div class="sp-streaks"><i></i><i></i><i></i><i></i></div>
      <span class="sp-l1">TURBO</span>
      <span class="sp-l2">DUELO</span>
      <div class="sp-tag">CARRERAS ARCADE · 24 AUTOS · 4 PISTAS</div>
    </div>
    <button class="sp-press" data-focus>${touch ? 'TOCA PARA EMPEZAR' : 'PRESIONA CUALQUIER TECLA'}</button>
    <div class="sp-foot">Turbo Duelo · hecho con Three.js</div>
  </div>`);
  let done = false;
  const go = () => {
    if (done) return; done = true;
    ui.game.audio?.unlock();
    ui.game.audio?.chest('turbo');
    n.classList.add('launch');
    setTimeout(() => showMainMenu(ui), 380);
  };
  n.addEventListener('pointerdown', go);
  ui.screen(n, { demo: true, noNav: true, noMoney: true });
  ui.keyHandler = () => { go(); return true; };
}
