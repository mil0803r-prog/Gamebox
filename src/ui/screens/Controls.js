import { el } from '../dom.js';
import { showMainMenu } from './MainMenu.js';

const k = s => s.split(' ').map(x => `<kbd>${x}</kbd>`).join('');

// Pantalla "Controles": teclado, mando y táctil
export function showControls(ui, back) {
  const goBack = back || (() => showMainMenu(ui));
  const n = el(`<div class="screen controls">
    <header class="scr-head"><h2>CONTROLES</h2></header>
    <div class="ctl-grid">
      <div class="ctl-card j1">
        <div class="ctl-title"><span class="pbadge">J1</span>Teclado</div>
        <div class="ctl-keys">
          <div class="wasd"><div>${k('W')}</div><div>${k('A S D')}</div></div>
          <div class="ctl-lbl">Acelerar · Girar · Frenar / reversa</div>
        </div>
        <div class="ctl-row">${k('Shift')}<span>Derrape</span></div>
        <div class="ctl-row">${k('Espacio')}<span>Turbo</span></div>
        <div class="ctl-row">${k('E')}<span>Usar ítem</span></div>
        <div class="ctl-row">${k('C')}<span>Cambiar cámara</span></div>
      </div>
      <div class="ctl-card j2">
        <div class="ctl-title"><span class="pbadge">J2</span>Teclado</div>
        <div class="ctl-keys">
          <div class="wasd"><div>${k('↑')}</div><div>${k('← ↓ →')}</div></div>
          <div class="ctl-lbl">Acelerar · Girar · Frenar / reversa</div>
        </div>
        <div class="ctl-row">${k('Ctrl')}<small>derecho</small><span>Derrape</span></div>
        <div class="ctl-row">${k('Enter')}<span>Turbo</span></div>
        <div class="ctl-row">${k('Shift')}<small>derecho</small><span>Usar ítem</span></div>
        <div class="ctl-row">${k('/')}<span>Cambiar cámara</span></div>
      </div>
      <div class="ctl-card">
        <div class="ctl-title">🎮 Mando</div>
        <div class="ctl-row">${k('Stick')}<span>Dirigir</span></div>
        <div class="ctl-row">${k('A')}${k('RT')}<span>Acelerar</span></div>
        <div class="ctl-row">${k('X')}${k('LT')}<span>Frenar</span></div>
        <div class="ctl-row">${k('RB')}<span>Derrape</span></div>
        <div class="ctl-row">${k('B')}<span>Turbo</span></div>
        <div class="ctl-row">${k('LB')}${k('Y')}<span>Ítem</span></div>
        <div class="ctl-row">${k('Select')}<span>Cámara</span></div>
      </div>
      <div class="ctl-card tips">
        <div class="ctl-title">💡 Trucos</div>
        <p>Mantén <b>derrape</b> en una curva: las chispas pasan de <b class="c1">azul</b> a <b class="c2">naranja</b> y <b class="c3">morado</b>. Suelta para un <b>mini-turbo</b>.</p>
        <p>Ve detrás del rival para cargar turbo con el <b>rebufo</b>.</p>
        <p>Busca los <b>atajos</b> (amarillo en el mini-mapa).</p>
        <p>${k('Esc')} o ${k('P')} pausa la carrera.</p>
      </div>
    </div>
    <div class="menu-row bottom"><button class="btn go" data-a="back" data-focus>‹ Volver</button></div>
  </div>`);
  ui.click(n, '[data-a=back]', goBack);
  ui.screen(n, { back: goBack, demo: !back, overlay: !!back });
}
