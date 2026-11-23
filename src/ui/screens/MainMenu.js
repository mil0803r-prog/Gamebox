import { CARS, CLASSES, carById } from '../../cars/carData.js';
import { TRACKS } from '../../tracks/trackData.js';
import { Profile, Settings } from '../../game/Storage.js';
import { level, league, missionsReady, dailyInfo } from '../../game/Progress.js';
import { carThumb } from '../components/Thumbs.js';
import { el, money, THEME_GRAD } from '../dom.js';
import { showCarSelect } from './CarSelect.js';
import { showTrackSelect } from './TrackSelect.js';
import { showOptions } from './Options.js';
import { showRecords } from './Records.js';
import { showControls } from './Controls.js';
import { showDealer } from './Dealer.js';
import { showArmory } from './Armory.js';
import { showTournament } from './Tournament.js';
import { showMissions } from './Missions.js';
import { showRewards } from './Rewards.js';
import { showMultiplayer } from './Multiplayer.js';

// =====================================================================
//  Menú principal estilo juego de carreras para celular/consola:
//  barra de perfil y monedas arriba, logo, modos a la izquierda,
//  eventos a la derecha, el auto en 3D al centro (showroom de fondo),
//  accesos rápidos + botón JUGAR abajo y el carrusel de autos.
// =====================================================================

const I = {
  flag: '<path d="M6 3v18" stroke="#fff" stroke-width="1.6"/><path d="M6 4h13l-2.5 4.5L19 13H6z" fill="#fff"/><path d="M6 4h3.25v2.25H6zM12.5 4h3.25v2.25H12.5zM9.25 6.25h3.25v2.25H9.25zM15.75 6.25H18l-.9 2.25h-1.35zM6 8.5h3.25v2.25H6zM12.5 8.5h3.25v2.25H12.5zM9.25 10.75h3.25V13H9.25zM15.75 10.75H18.5L19 13h-3.25z" fill="#111"/>',
  trophy: '<defs><linearGradient id="gt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset=".5" stop-color="#ffc83a"/><stop offset="1" stop-color="#b8740c"/></linearGradient></defs><path d="M7 3h10v5a5 5 0 01-10 0z" fill="url(#gt)"/><path d="M7 5H3.5c0 3.2 1.6 5 4.2 5.3M17 5h3.5c0 3.2-1.6 5-4.2 5.3" fill="none" stroke="url(#gt)" stroke-width="1.6"/><path d="M11 13h2v4h-2z" fill="url(#gt)"/><path d="M7.5 21h9l-1-3.5h-7z" fill="url(#gt)"/><path d="M12 4.8l.9 1.9 2 .2-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.2z" fill="#fff8d0"/>',
  globe: '<circle cx="12" cy="12" r="9" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M3 12h18M12 3c2.6 2.5 3.8 5.5 3.8 9s-1.2 6.5-3.8 9c-2.6-2.5-3.8-5.5-3.8-9S9.4 5.5 12 3z" fill="none" stroke="#fff" stroke-width="1.6"/><circle cx="18.5" cy="5.5" r="2.6" fill="#2bf07a" stroke="#0b0618" stroke-width="1"/>',
  duo: '<path d="M7 9h10a4 4 0 014 4v1a3 3 0 01-5.2 2l-1.3-1.5h-5l-1.3 1.5A3 3 0 013 14v-1a4 4 0 014-4z" fill="#fff"/><path d="M8 11.3v3.2M6.4 12.9h3.2" stroke="#5b2bd8" stroke-width="1.5" stroke-linecap="round"/><circle cx="16" cy="12.2" r=".9" fill="#ff3b6b"/><circle cx="17.8" cy="14" r=".9" fill="#2bc8ff"/>',
  clock: '<circle cx="12" cy="13.5" r="7.5" fill="none" stroke="#fff" stroke-width="1.8"/><path d="M12 9.5v4.2l2.8 1.8" stroke="#2bf0c0" stroke-width="1.8" stroke-linecap="round" fill="none"/><path d="M10 3h4M12 3v3M18.5 6.5l1.5-1.5" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>',
  car: '<path d="M3 15.5v-3l2-4.5c.4-.9 1.2-1.5 2.2-1.5h9.6c1 0 1.8.6 2.2 1.5l2 4.5v3a1 1 0 01-1 1h-1.5a2 2 0 01-4 0H9.5a2 2 0 01-4 0H4a1 1 0 01-1-1z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M5.2 11.5h13.6M7 14h1.5M15.5 14H17" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  aim: '<circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  cart: '<path d="M2.5 4h2.5l2.3 10.5h10.2L20 7.5H6.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="18.5" r="1.6" fill="currentColor"/><circle cx="16.5" cy="18.5" r="1.6" fill="currentColor"/>',
  podium: '<path d="M8.5 9h7v12h-7zM2.5 13h6v8h-6zM15.5 15h6v6h-6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 3.2l.8 1.6 1.8.3-1.3 1.2.3 1.8-1.6-.9-1.6.9.3-1.8-1.3-1.2 1.8-.3z" fill="currentColor"/>',
  list: '<rect x="5" y="4" width="14" height="17" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9 3h6v3H9z" fill="currentColor"/><path d="M8.5 11l1.5 1.5 2.5-3M8.5 16.5l1.5 1.5 2.5-3M14.5 11.5h2M14.5 17h2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  gift: '<rect x="3.5" y="9" width="17" height="4" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5 13v8h14v-8M12 9v12" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 9c-1.5-3.5-5.5-4.5-5.5-2S10 9 12 9zm0 0c1.5-3.5 5.5-4.5 5.5-2S14 9 12 9z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  gear: '<path d="M12 8.5a3.5 3.5 0 110 7 3.5 3.5 0 010-7z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10.3 2.5h3.4l.5 2.6 1.9 1.1 2.5-.9 1.7 2.9-2 1.8v2.1l2 1.8-1.7 2.9-2.5-.9-1.9 1.1-.5 2.6h-3.4l-.5-2.6-1.9-1.1-2.5.9-1.7-2.9 2-1.8V10l-2-1.8 1.7-2.9 2.5.9 1.9-1.1z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  full: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  pad: '<path d="M7 9h10a4 4 0 014 4v1a3 3 0 01-5.2 2l-1.3-1.5h-5l-1.3 1.5A3 3 0 013 14v-1a4 4 0 014-4z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8 11.5v3M6.5 13h3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
};
const ico = (k, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[k]}</svg>`;

// casco de piloto para el avatar y la tarjeta de recompensas
const HELMET = `<svg viewBox="0 0 64 64" aria-hidden="true"><defs>
  <linearGradient id="hm1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff5a6e"/><stop offset=".55" stop-color="#d0102c"/><stop offset="1" stop-color="#5a0010"/></linearGradient>
  <linearGradient id="hm2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0c1530"/><stop offset=".5" stop-color="#3a6bff"/><stop offset="1" stop-color="#9ad8ff"/></linearGradient></defs>
  <path d="M8 38C8 20 20 8 35 8c13 0 22 9 22 22v8c0 3-2 5-5 5H40l-6 9H16c-5 0-8-4-8-9z" fill="url(#hm1)"/>
  <path d="M27 24h27c2 0 3 1.5 3 3.5V35c0 2-1.5 3-3.5 3H31c-3 0-5-2.5-5-5.5v-5c0-2 .5-3.5 1-3.5z" fill="url(#hm2)"/>
  <path d="M12 30c4-10 12-16 22-17" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".55"/>
  <path d="M10 44h22l-4 6" stroke="#1a1a22" stroke-width="3" fill="none"/></svg>`;

const CROWN = `<svg viewBox="0 0 120 100" aria-hidden="true"><defs>
  <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6c0"/><stop offset=".45" stop-color="#ffc93c"/><stop offset="1" stop-color="#a8650a"/></linearGradient></defs>
  <g fill="url(#cg)">${Array.from({ length: 7 }, (_, i) => {
    const a = -0.4 - i * 0.33;
    return `<ellipse cx="${60 + Math.cos(a) * 46}" cy="${58 - Math.sin(a) * 36}" rx="5" ry="11" transform="rotate(${-a * 57 + 90} ${60 + Math.cos(a) * 46} ${58 - Math.sin(a) * 36})"/>
            <ellipse cx="${60 - Math.cos(a) * 46}" cy="${58 - Math.sin(a) * 36}" rx="5" ry="11" transform="rotate(${a * 57 - 90} ${60 - Math.cos(a) * 46} ${58 - Math.sin(a) * 36})"/>`;
  }).join('')}
  <path d="M30 70l-6-38 20 16 16-26 16 26 20-16-6 38z"/><rect x="30" y="72" width="60" height="9" rx="3"/></g>
  <circle cx="60" cy="54" r="5" fill="#ff3b5c"/><circle cx="42" cy="60" r="3.5" fill="#3bc8ff"/><circle cx="78" cy="60" r="3.5" fill="#3bc8ff"/></svg>`;

export function showMainMenu(ui) {
  ui.game.audio?.music('menu');
  ui.showPauseButton(false);
  ui.cup = null;
  ui.rivalsOverride = null;
  if (ui.net) { ui.net.close(); ui.net = null; }
  // abrió un enlace de invitación (?sala=ABCD)
  if (ui.pendingRoom) { const code = ui.pendingRoom; ui.pendingRoom = ''; showMultiplayer(ui, code); return; }
  const s = ui.s;
  const car = carById(s.p1.car);
  const { lv, pct } = level();
  const lg = league(lv);
  const owned = CARS.filter(c => Profile.owns(c.id)).length;
  const daily = dailyInfo();
  const misN = missionsReady();
  const shopDot = CARS.some(c => !Profile.owns(c.id) && c.price > 0 && Profile.canAfford(c.price));
  const legend = CARS.filter(c => c.cls === 'S').sort((a, b) => b.price - a.price)[0];
  const lineup = CARS.slice().sort((a, b) => a.price - b.price);
  const dot = (on, n = '') => on ? `<i class="hm-dot">${n}</i>` : '';

  const n = el(`<div class="screen home">
    <header class="hm-top">
      <button class="hm-profile" data-a="name" data-nav title="Cambiar nombre">
        <span class="hm-avatar" style="--p:${pct}">${HELMET}</span>
        <span class="hm-pname"><b>${escapeHtml(Profile.data.name || 'Piloto')}</b><span><em>Nv. ${lv}</em><i class="hm-xp"><i style="width:${pct}%"></i></i></span></span>
      </button>
      <button class="hm-league" data-a="rec" data-nav style="--l1:${lg.c1};--l2:${lg.c2}">
        <svg viewBox="0 0 24 24"><path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" fill="url(#lgg)" stroke="#fff" stroke-opacity=".5"/><defs><linearGradient id="lgg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${lg.c1}"/><stop offset="1" stop-color="${lg.c2}"/></linearGradient></defs><path d="M12 7l1.5 3 3.3.4-2.4 2.3.6 3.3-3-1.6-3 1.6.6-3.3-2.4-2.3 3.3-.4z" fill="#fff"/></svg>
        <b>${lg.name}</b><span>›</span>
      </button>
      <div class="hm-cur">
        <button class="hm-pill" data-a="shop" data-nav><span class="hm-coin">$</span><b class="hm-money">${money(Profile.data.money).replace('$', '')}</b><i class="hm-plus">+</i></button>
        <button class="hm-pill" data-a="missions" data-nav><span class="hm-gem">🏆</span><b>${Profile.stats.wins || 0}</b><i class="hm-plus">+</i></button>
        <button class="hm-pill" data-a="garage" data-nav><span class="hm-bolt">⚡</span><b>${owned}/${CARS.length}</b><i class="hm-plus">+</i></button>
      </div>
      <button class="hm-round" data-a="ctl" data-nav title="Controles">${ico('pad')}</button>
      ${document.fullscreenEnabled || document.webkitFullscreenEnabled ? `<button class="hm-round" data-a="full" data-nav title="Pantalla completa">${ico('full')}</button>` : ''}
      <button class="hm-round" data-a="opt" data-nav title="Opciones">${ico('gear')}</button>
    </header>

    <div class="hm-logo">
      <div class="hm-logo-main"><span class="hm-check"></span><b data-t="GAMEBOX">GAMEBOX</b></div>
      <div class="hm-logo-sub"><span class="hm-check sm"></span><b>TURBO DUELO</b></div>
    </div>

    <nav class="hm-modes">
      <button class="hm-mode m1" data-a="quick" data-nav style="--bg:${THEME_GRAD.city}">
        <img data-thumb="${car.id}" alt=""><span class="hm-mico">${ico('flag')}</span><b>CARRERA RÁPIDA</b><span class="hm-chev">›</span>
      </button>
      <button class="hm-mode m2" data-a="cup" data-nav style="--bg:${THEME_GRAD.desert}">
        <img data-thumb="${CARS.find(c => c.cls === 'A')?.id || legend.id}" alt=""><span class="hm-mico">${ico('trophy')}</span><b>TORNEOS</b>
      </button>
      <button class="hm-mode m3" data-a="mp" data-nav style="--bg:${THEME_GRAD.snow}">
        <img data-thumb="${CARS.find(c => c.cls === 'B')?.id || car.id}" alt=""><span class="hm-mico">${ico('globe')}</span><b>MULTIJUGADOR</b><i class="hm-live">ONLINE</i>
      </button>
      <button class="hm-mode m4" data-a="tt" data-nav style="--bg:${THEME_GRAD.coast}">
        <img data-thumb="${lineup[Math.floor(lineup.length / 2)].id}" alt=""><span class="hm-mico">${ico('clock')}</span><b>CONTRARRELOJ</b>
      </button>
    </nav>

    <aside class="hm-events">
      <button class="hm-ev ev1 ${daily.available ? 'ready' : ''}" data-a="rewards" data-nav>
        <span class="hm-tag">${daily.available ? '¡LISTA PARA COBRAR!' : 'CADA DÍA'}</span>
        <span class="hm-crown">${CROWN}</span>
        <b>RECOMPENSA<br>DIARIA</b>
        <small>Día ${daily.day + 1} de 7 · ${money(daily.prize)}</small>
        <span class="hm-helmet">${HELMET}</span>
        <span class="hm-evbtn">${daily.available ? 'RECLAMAR' : 'VER RECOMPENSAS'} <em>»</em></span>
      </button>
      <button class="hm-ev ev2" data-a="legend" data-nav>
        <span class="hm-tag">EVENTO ESPECIAL</span>
        <b>AUTOS<br>LEGENDARIOS</b>
        <small>Clase S · hasta ${legend.top} km/h</small>
        <img data-thumb="${legend.id}" alt="">
      </button>
    </aside>

    <div class="hm-plate"><span class="hm-cls" style="--cc:${CLASSES[car.cls].color}">${car.cls}</span><b>${car.brand} ${car.name}</b><small>${car.top} km/h · ${car.hp} CV · 0-100 ${car.zero.toFixed(1)} s</small></div>

    <div class="hm-dock">
      <div class="hm-tiles">
        <button class="hm-tile" data-a="garage" data-nav>${ico('car')}<b>GARAJE</b></button>
        <button class="hm-tile" data-a="arm" data-nav>${ico('aim')}<b>ARMERÍA</b></button>
        <button class="hm-tile" data-a="shop" data-nav>${ico('cart')}<b>TIENDA</b>${dot(shopDot)}</button>
      </div>
      <button class="hm-play" data-a="1" data-nav data-focus><b>JUGAR</b><span>»</span></button>
      <div class="hm-tiles">
        <button class="hm-tile" data-a="rec" data-nav>${ico('podium')}<b>RÉCORDS</b></button>
        <button class="hm-tile" data-a="missions" data-nav>${ico('list')}<b>MISIONES</b>${dot(misN > 0, misN)}</button>
        <button class="hm-tile" data-a="rewards" data-nav>${ico('gift')}<b>PREMIOS</b>${dot(daily.available)}</button>
      </div>
    </div>

    <div class="hm-cars">
      <button class="hm-arrow" data-scroll="-1" aria-label="Anterior">‹</button>
      <div class="hm-strip">${lineup.map(c => {
        const own = Profile.owns(c.id);
        return `<button class="hm-car ${c.id === car.id ? 'sel' : ''} ${own ? '' : 'locked'}" data-car="${c.id}" data-nav title="${c.brand} ${c.name}">
          <img data-thumb="${c.id}" alt="">
          <span class="hm-cn"><i style="--cc:${CLASSES[c.cls].color}">${c.cls}</i>${c.name}</span>
          ${own ? '' : `<span class="hm-lock">🔒 ${money(c.price)}</span>`}
        </button>`;
      }).join('')}</div>
      <button class="hm-arrow" data-scroll="1" aria-label="Siguiente">›</button>
    </div>
  </div>`);

  // miniaturas renderizadas de los autos
  n.querySelectorAll('img[data-thumb]').forEach(img => {
    const def = carById(img.dataset.thumb);
    if (def) carThumb(def, url => { img.src = url; img.classList.add('ok'); });
  });

  const strip = n.querySelector('.hm-strip');
  ui.click(n, '[data-scroll]', (e, b) => strip.scrollBy({ left: +b.dataset.scroll * strip.clientWidth * 0.8, behavior: 'smooth' }));
  // elegir auto desde el carrusel (si no lo tienes, te lleva a la tienda)
  ui.click(n, '[data-car]', (e, b) => {
    const c = carById(b.dataset.car);
    if (!Profile.owns(c.id)) { showDealer(ui, () => showMainMenu(ui), { sel: c.id }); return; }
    s.p1.car = c.id; s.p1.color = -1; Settings.save();
    showMainMenu(ui);
  });
  ui.click(n, '[data-a]', (e, b) => {
    ui.game.audio?.unlock();
    const a = b.dataset.a;
    if (a === '1') { ui.mode = 1; showCarSelect(ui); }
    if (a === '2') { ui.mode = 2; showCarSelect(ui); }
    if (a === 'garage') { ui.mode = 1; showCarSelect(ui); }
    if (a === 'quick') { // carrera rápida: tu auto, pista al azar, ¡ya!
      ui.mode = 1;
      s.track = Math.floor(Math.random() * TRACKS.length);
      if (s.rivals1p < 1) s.rivals1p = 3;
      Settings.save();
      ui.startRace();
    }
    if (a === 'tt') { ui.mode = 1; ui.rivalsOverride = 0; showTrackSelect(ui); }
    if (a === 'cup') showTournament(ui);
    if (a === 'mp') showMultiplayer(ui);
    if (a === 'legend') showDealer(ui, () => showMainMenu(ui), { filter: 'S', sel: legend.id });
    if (a === 'rewards') showRewards(ui);
    if (a === 'missions') showMissions(ui);
    if (a === 'opt') showOptions(ui);
    if (a === 'rec') showRecords(ui);
    if (a === 'ctl') showControls(ui);
    if (a === 'shop') showDealer(ui);
    if (a === 'arm') showArmory(ui);
    if (a === 'full') ui.toggleFullscreen();
    if (a === 'name') {
      const v = prompt('Tu nombre de piloto:', Profile.data.name || 'Piloto');
      if (v && v.trim()) { Profile.data.name = v.trim().slice(0, 14); Profile.save(); n.querySelector('.hm-pname b').textContent = Profile.data.name; }
    }
  });
  ui.screen(n, { demo: true, noNav: true, noMoney: true });
  ui.root.classList.add('home-on');
  ui.showCar(car, null, 'hero');
  // el auto elegido visible en el carrusel
  const sel = strip.querySelector('.sel');
  if (sel) strip.scrollLeft = sel.offsetLeft - strip.clientWidth / 2 + sel.offsetWidth / 2;

  // navegación con flechas/mando por posición en pantalla
  ui.keyHandler = code => {
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], KeyA: [-1, 0], KeyD: [1, 0], KeyW: [0, -1], KeyS: [0, 1] }[code];
    if (!dir) return false;
    const items = [...n.querySelectorAll('[data-nav]')].filter(x => x.offsetParent !== null);
    const cur = document.activeElement && n.contains(document.activeElement) ? document.activeElement : n.querySelector('[data-focus]');
    const r0 = cur.getBoundingClientRect();
    const cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2;
    let best = null, bestD = Infinity;
    for (const it of items) {
      if (it === cur) continue;
      const r = it.getBoundingClientRect();
      const dx = r.left + r.width / 2 - cx, dy = r.top + r.height / 2 - cy;
      const along = dx * dir[0] + dy * dir[1];
      if (along <= 4) continue;
      const across = Math.abs(dx * dir[1] - dy * dir[0]);
      const d = along + across * 2.2;
      if (d < bestD) { bestD = d; best = it; }
    }
    if (best) {
      best.focus({ preventScroll: true });
      if (best.classList.contains('hm-car')) best.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
      ui.game.audio?.beep(660, 0.03, 0.06, 'triangle');
    }
    return true;
  };
}

function escapeHtml(t) { return String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
