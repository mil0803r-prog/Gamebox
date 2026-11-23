import { el, money } from '../dom.js';
import { MISSIONS, missionState, claimMission } from '../../game/Progress.js';
import { showMainMenu } from './MainMenu.js';

export function showMissions(ui) {
  const n = el(`<div class="screen missions">
    <header class="scr-head"><span class="step">COMPLETA OBJETIVOS Y GANA DINERO</span><h2>MISIONES</h2></header>
    <div class="mis-list"></div>
    <div class="menu-row bottom"><button class="btn" data-a="back" data-focus>‹ Volver</button></div>
  </div>`);
  const list = n.querySelector('.mis-list');
  const render = () => {
    // primero las que se pueden cobrar, luego en progreso, al final las cobradas
    const order = m => { const s = missionState(m); return s.ready ? 0 : s.claimed ? 2 : 1; };
    list.innerHTML = MISSIONS.slice().sort((a, b) => order(a) - order(b)).map(m => {
      const s = missionState(m);
      return `<div class="mis ${s.ready ? 'ready' : ''} ${s.claimed ? 'claimed' : ''}">
        <span class="mis-ico">${m.icon}</span>
        <div class="mis-txt"><b>${m.title}</b><small>${m.desc}</small>
          <div class="mis-bar"><i style="width:${(s.v / m.goal * 100).toFixed(1)}%"></i></div></div>
        <span class="mis-prog">${s.v}/${m.goal}</span>
        ${s.claimed ? '<span class="mis-done">✓ Cobrada</span>' : `<button class="btn ${s.ready ? 'go' : ''} sm focusable" data-m="${m.id}" ${s.ready ? '' : 'disabled'}>${money(m.prize)}</button>`}
      </div>`;
    }).join('');
    list.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => {
      const m = MISSIONS.find(x => x.id === b.dataset.m);
      if (claimMission(m)) { ui.game.audio?.fanfare(); ui.updateMoney(true); render(); }
    }));
  };
  render();
  ui.click(n, '[data-a=back]', () => showMainMenu(ui));
  ui.screen(n, { back: () => showMainMenu(ui), demo: true });
}
