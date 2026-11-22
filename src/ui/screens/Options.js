import { Settings, Records } from '../../game/Storage.js';
import { el } from '../dom.js';
import { showMainMenu } from './MainMenu.js';

const ROWS = [
  ['Jugabilidad', [
    ['autoAccel', 'Acelerar automático (táctil)', [[true, 'Sí'], [false, 'Botón']]],
    ['showKeys', 'Mostrar teclas en pantalla (PC)', [[true, 'Sí'], [false, 'No']]],
    ['split', 'División de pantalla', [['auto', 'Auto'], ['horizontal', 'Arriba/abajo'], ['vertical', 'Lado a lado']]],
  ]],
  ['Gráficos', [
    ['quality', 'Calidad', [['auto', 'Auto'], ['low', 'Baja'], ['medium', 'Media'], ['high', 'Alta']]],
    ['showFps', 'Mostrar FPS', [[false, 'No'], [true, 'Sí']]],
  ]],
  ['Sonido', [
    ['music', 'Música', [[true, 'Sí'], [false, 'No']]],
    ['sfx', 'Efectos', [[true, 'Sí'], [false, 'No']]],
  ]],
];

export function showOptions(ui) {
  const s = ui.s;
  const n = el(`<div class="screen options">
    <header class="scr-head"><h2>OPCIONES</h2></header>
    <div class="opts list">
      ${ROWS.map(([group, rows]) => `<div class="ogroup">${group}</div>` + rows.map(([k, label, vals]) => `
        <div class="opt"><span>${label}</span><div class="seg" data-k="${k}">${vals.map((v, i) => `<button class="segb" data-i="${i}">${v[1]}</button>`).join('')}</div></div>`).join('')).join('')}
      <div class="ogroup">Datos</div>
      <div class="opt"><span>Borrar récords</span><button class="btn sm danger" data-a="clear">Borrar</button></div>
    </div>
    <div class="menu-row bottom"><button class="btn go" data-a="back" data-focus>‹ Volver</button></div>
  </div>`);
  const all = ROWS.flatMap(r => r[1]);
  const upd = () => all.forEach(([k, , vals]) => {
    n.querySelectorAll(`[data-k=${k}] .segb`).forEach(b => b.classList.toggle('on', vals[+b.dataset.i][0] === s[k]));
  });
  ui.click(n, '[data-k] .segb', (e, b) => {
    const k = b.parentElement.dataset.k;
    s[k] = all.find(r => r[0] === k)[2][+b.dataset.i][0];
    upd(); Settings.save();
    ui.game.applySettings(s);
  });
  ui.click(n, '[data-a=clear]', (e, b) => {
    if (b.dataset.confirm) { Records.clear(); b.textContent = '✓ Borrados'; }
    else { b.dataset.confirm = 1; b.textContent = '¿Seguro?'; }
  });
  ui.click(n, '[data-a=back]', () => showMainMenu(ui));
  upd();
  ui.screen(n, { back: () => showMainMenu(ui), demo: true });
}
