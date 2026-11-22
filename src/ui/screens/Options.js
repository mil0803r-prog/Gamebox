import { Settings, Records } from '../../game/Storage.js';
import { el } from '../dom.js';
import { showMainMenu } from './MainMenu.js';

const ROWS = [
  ['Jugabilidad', [
    ['steerMode', 'Dirección en celular', [['buttons', 'Botones ◀ ▶'], ['tilt', 'Inclinar 📱']]],
    ['tiltSens', 'Sensibilidad de inclinación', [['low', 'Baja'], ['medium', 'Media'], ['high', 'Alta']]],
    ['tiltInvert', 'Invertir inclinación', [[false, 'No'], [true, 'Sí']]],
    ['orientation', 'Orientación en celular', [['landscape', 'Horizontal'], ['any', 'Libre']]],
    ['autoAccel', 'Acelerar automático (táctil)', [[true, 'Sí'], [false, 'Botón']]],
    ['showKeys', 'Mostrar teclas en pantalla (PC)', [[true, 'Sí'], [false, 'No']]],
    ['split', 'División de pantalla', [['auto', 'Auto'], ['horizontal', 'Arriba/abajo'], ['vertical', 'Lado a lado']]],
  ]],
  ['Gráficos', [
    ['camera', 'Cámara inicial (C para cambiar)', [['interior', 'Interior'], ['near', 'Cercana'], ['far', 'Lejana'], ['vfar', 'Muy lejana']]],
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
      <div class="tilt-note hidden"></div>
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
    if (k === 'orientation') ui.checkOrientation();
    if (k === 'steerMode' && s.steerMode === 'tilt') testTilt();
  });
  // prueba del sensor: pide permiso (toque del usuario) y muestra si responde
  const note = n.querySelector('.tilt-note');
  const testTilt = async () => {
    const t = ui.game.input.tilt;
    const r = await t.request();
    note.classList.remove('hidden');
    if (r !== 'ok') { note.textContent = r === 'denied' ? 'Permiso del sensor denegado. Actívalo en los ajustes del navegador.' : 'Este dispositivo no tiene sensor de inclinación.'; return; }
    note.textContent = 'Probando sensor… inclina el celular';
    setTimeout(() => {
      note.textContent = t.receiving ? '✓ Sensor funcionando. Solo se usa en 1 jugador.' : 'El sensor no responde aquí. Necesita HTTPS (tu sitio publicado) y un celular con giroscopio.';
    }, 1200);
  };
  if (s.steerMode === 'tilt' && ui.game.isTouch) setTimeout(testTilt, 0);
  ui.click(n, '[data-a=clear]', (e, b) => {
    if (b.dataset.confirm) { Records.clear(); b.textContent = '✓ Borrados'; }
    else { b.dataset.confirm = 1; b.textContent = '¿Seguro?'; }
  });
  ui.click(n, '[data-a=back]', () => showMainMenu(ui));
  upd();
  ui.screen(n, { back: () => showMainMenu(ui), demo: true });
}
