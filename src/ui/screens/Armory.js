import { WEAPONS } from '../../game/weaponData.js';
import { Profile } from '../../game/Storage.js';
import { el, money, hex } from '../dom.js';
import { showMainMenu } from './MainMenu.js';

// Armería: comprar armas con dinero. En la carrera, cada disparo gasta monedas recogidas en la pista.
export function showArmory(ui, back) {
  const goBack = back || (() => showMainMenu(ui));
  const n = el(`<div class="screen armory">
    <header class="scr-head"><span class="step">DISPARAR GASTA MONEDAS DE LA PISTA</span><h2>ARMERÍA</h2></header>
    <div class="arm-grid"></div>
    <div class="arm-note">🪙 Recoge monedas en la carrera para disparar. Las monedas que gastes ya no se cobran al final. El 🛡️ escudo bloquea los impactos.</div>
    <div class="arm-keys">${ui.game.isTouch ? 'Celular: botón 🎯 para disparar, ⇄ para cambiar de arma' : 'J1: <kbd>F</kbd> disparar · <kbd>R</kbd> cambiar arma &nbsp;·&nbsp; J2: <kbd>.</kbd> disparar · <kbd>,</kbd> cambiar &nbsp;·&nbsp; Mando: <kbd>Y</kbd> disparar'}</div>
    <div class="menu-row bottom"><button class="btn go" data-a="back" data-focus>‹ Volver</button></div>
  </div>`);
  const grid = n.querySelector('.arm-grid');
  const render = () => {
    grid.innerHTML = WEAPONS.map(w => {
      const own = Profile.ownsWeapon(w.id), afford = Profile.canAfford(w.price);
      return `<div class="arm-card ${own ? 'own' : ''}" style="--wc:${hex(w.color)}">
        <div class="arm-ico">${w.icon}</div>
        <div class="arm-name">${w.name}</div>
        <p>${w.desc}</p>
        <div class="arm-stats"><span>Costo por disparo</span><b>🪙 ${w.cost}</b></div>
        <div class="arm-stats"><span>Recarga</span><b>${w.cooldown < 0.5 ? 'Rápida' : w.cooldown < 1.5 ? 'Media' : 'Lenta'}</b></div>
        <button class="btn ${own ? '' : 'go'} arm-buy focusable" data-w="${w.id}" ${own || !afford ? 'disabled' : ''}>
          ${own ? '✓ Comprada' : afford ? 'Comprar ' + money(w.price) : 'Faltan ' + money(w.price - Profile.data.money)}
        </button>
      </div>`;
    }).join('');
    grid.querySelectorAll('.arm-buy').forEach(b => b.addEventListener('click', () => {
      const w = WEAPONS.find(x => x.id === b.dataset.w);
      if (!b.dataset.confirm) { b.dataset.confirm = 1; b.textContent = `¿Confirmar ${money(w.price)}?`; ui.game.audio?.ui(); return; }
      if (Profile.buyWeapon(w)) { ui.game.audio?.weapon(w.id); ui.updateMoney(true); render(); }
    }));
  };
  render();
  ui.click(n, '[data-a=back]', goBack);
  ui.screen(n, { back: goBack, demo: true });
}
