import { TRACKS } from '../../tracks/trackData.js';
import { Records } from '../../game/Storage.js';
import { el, fmtTime, THEME_GRAD, THEME_ICON } from '../dom.js';
import { showMainMenu } from './MainMenu.js';

export function showRecords(ui) {
  const n = el(`<div class="screen records">
    <header class="scr-head"><h2>RÉCORDS</h2></header>
    <div class="reccards">${TRACKS.map(t => {
      const r = Records.get(t.id);
      const races = Object.keys(r).filter(k => k.startsWith('race')).sort().map(k =>
        `<div class="rrow"><span>Carrera ${k.slice(4)} v.</span><b>${fmtTime(r[k].t)}</b><small>${r[k].who}</small></div>`).join('');
      return `<div class="reccard" style="--grad:${THEME_GRAD[t.theme]}">
        <div class="rtitle">${THEME_ICON[t.theme]} ${t.name}</div>
        <div class="rrow big"><span>Mejor vuelta</span><b>${r.bestLap ? fmtTime(r.bestLap.t) : '--:--.--'}</b><small>${r.bestLap ? r.bestLap.who : ''}</small></div>
        ${races || '<div class="rrow empty">Aún sin carreras completas</div>'}
      </div>`;
    }).join('')}</div>
    <div class="menu-row bottom"><button class="btn go" data-a="back" data-focus>‹ Volver</button></div>
  </div>`);
  ui.click(n, '[data-a=back]', () => showMainMenu(ui));
  ui.screen(n, { back: () => showMainMenu(ui), demo: true });
}
