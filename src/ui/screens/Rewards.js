import { el, money } from '../dom.js';
import { DAILY, dailyInfo, claimDaily } from '../../game/Progress.js';
import { showMainMenu } from './MainMenu.js';

export function showRewards(ui) {
  const n = el(`<div class="screen rewards">
    <header class="scr-head"><span class="step">ENTRA CADA DÍA · EL 7º DÍA ES EL PREMIO GORDO</span><h2>RECOMPENSA DIARIA</h2></header>
    <div class="rw-days"></div>
    <div class="rw-msg"></div>
    <div class="menu-row bottom">
      <button class="btn" data-a="back">‹ Volver</button>
      <button class="btn go" data-a="claim" data-focus>Reclamar</button>
    </div>
  </div>`);
  const render = () => {
    const d = dailyInfo();
    const got = d.available ? d.streak % 7 : d.day + 1; // días ya cobrados en este ciclo
    n.querySelector('.rw-days').innerHTML = DAILY.map((p, i) => `
      <div class="rw-day ${i < got ? 'got' : ''} ${d.available && i === d.day ? 'today' : ''} ${i === 6 ? 'big' : ''}">
        <small>DÍA ${i + 1}</small><span class="rw-ico">${i === 6 ? '👑' : i < got ? '✓' : '🪙'}</span><b>${money(p)}</b>
      </div>`).join('');
    const btn = n.querySelector('[data-a=claim]');
    btn.disabled = !d.available;
    btn.textContent = d.available ? `Reclamar ${money(d.prize)}` : 'Vuelve mañana';
    n.querySelector('.rw-msg').textContent = d.available ? `Racha: ${d.streak} día${d.streak === 1 ? '' : 's'} seguidos` : `¡Ya cobraste hoy! Racha: ${d.streak} días`;
  };
  render();
  ui.click(n, '[data-a=claim]', () => {
    const p = claimDaily();
    if (p) { ui.game.audio?.fanfare(); ui.updateMoney(true); render(); }
  });
  ui.click(n, '[data-a=back]', () => showMainMenu(ui));
  ui.screen(n, { back: () => showMainMenu(ui), demo: true });
}
