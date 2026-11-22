import { el } from '../dom.js';
import { showControls } from './Controls.js';

export function showPauseMenu(ui) {
  const g = ui.game;
  const muteTxt = () => ui.s.muted ? '🔇 Activar sonido' : '🔊 Silenciar';
  const n = el(`<div class="screen overlay pause">
    <div class="glass">
      <h2>PAUSA</h2>
      <div class="menu-col">
        <button class="btn big go" data-a="cont" data-focus>▶ Continuar</button>
        <button class="btn" data-a="restart">↻ Reiniciar carrera</button>
        <button class="btn" data-a="ctl">🎮 Controles</button>
        <button class="btn" data-a="mute">${muteTxt()}</button>
        <button class="btn" data-a="menu">⌂ Salir al menú</button>
      </div>
    </div>
  </div>`);
  const resume = () => { g.paused = false; g.audio?.setPaused(false); };
  ui.click(n, '[data-a]', (e, b) => {
    const a = b.dataset.a;
    if (a === 'cont') ui.togglePause();
    if (a === 'restart') { resume(); ui.startRace(); }
    if (a === 'ctl') showControls(ui, () => showPauseMenu(ui));
    if (a === 'mute') { ui.toggleMute(); b.textContent = muteTxt(); }
    if (a === 'menu') { resume(); ui.exitToMenu(); }
  });
  ui.screen(n, { overlay: true, back: () => ui.togglePause() });
}
