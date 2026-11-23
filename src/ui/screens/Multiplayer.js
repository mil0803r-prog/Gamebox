import { CARS, CLASSES, carById } from '../../cars/carData.js';
import { TRACKS } from '../../tracks/trackData.js';
import { Profile, Settings } from '../../game/Storage.js';
import { NetSession, MAX_PLAYERS, netErrorText } from '../../net/Net.js';
import { carThumb } from '../components/Thumbs.js';
import { el, hex, THEME_GRAD, THEME_ICON } from '../dom.js';
import { paintOf } from './CarSelect.js';
import { showMainMenu } from './MainMenu.js';
import { showCarSelect } from './CarSelect.js';

const me = ui => ({ name: Profile.data.name || 'Piloto', car: ui.s.p1.car, color: paintOf(ui.s.p1) });
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ------------------------------------------------------------ elegir tipo de multijugador
export function showMultiplayer(ui, joinCode = '') {
  const n = el(`<div class="screen mp">
    <header class="scr-head"><span class="step">JUEGA CON TUS AMIGOS</span><h2>MULTIJUGADOR</h2></header>
    <div class="mp-cards">
      <button class="mp-card focusable" data-a="split" style="--grad:${THEME_GRAD.snow}">
        <span class="mp-ico">🎮</span><b>Mismo equipo</b>
        <small>Pantalla dividida para 2 jugadores en este celular, tablet o PC. Puedes conectar mandos por Bluetooth.</small>
      </button>
      <button class="mp-card focusable" data-a="host" style="--grad:${THEME_GRAD.city}">
        <span class="mp-ico">📡</span><b>Crear sala online</b>
        <small>Hasta ${MAX_PLAYERS} jugadores, cada uno en su celular o PC. Por Wi-Fi o datos: comparte el código.</small>
      </button>
      <div class="mp-card mp-join" style="--grad:${THEME_GRAD.coast}">
        <span class="mp-ico">🔑</span><b>Unirse a una sala</b>
        <small>Escribe el código de 4 letras que te pasó tu amigo.</small>
        <div class="mp-joinrow">
          <input class="mp-code" maxlength="4" placeholder="ABCD" autocomplete="off" autocapitalize="characters" spellcheck="false" value="${esc(joinCode)}">
          <button class="btn go" data-a="join">Unirse</button>
        </div>
      </div>
    </div>
    <div class="mp-status"></div>
    <div class="menu-row bottom"><button class="btn" data-a="back" data-focus>‹ Volver</button></div>
  </div>`);
  const status = n.querySelector('.mp-status');
  const input = n.querySelector('.mp-code');
  input.addEventListener('input', () => { input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  input.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') n.querySelector('[data-a=join]').click(); });
  const busy = (txt, err) => { status.textContent = txt; status.classList.toggle('err', !!err); n.querySelectorAll('button').forEach(b => { if (b.dataset.a !== 'back') b.disabled = !!txt && !err; }); };

  ui.click(n, '[data-a]', async (e, b) => {
    const a = b.dataset.a;
    if (a === 'back') { if (ui.net) { ui.net.close(); ui.net = null; } showMainMenu(ui); return; }
    if (a === 'split') { ui.mode = 2; showCarSelect(ui); return; }
    if (a === 'host' || a === 'join') {
      const code = input.value.trim();
      if (a === 'join' && code.length !== 4) { busy('El código tiene 4 letras o números.', true); input.focus(); return; }
      busy(a === 'host' ? 'Creando sala…' : 'Conectando con la sala ' + code + '…');
      const net = new NetSession();
      wire(ui, net);
      try {
        if (a === 'host') await net.host(me(ui)); else await net.join(code, me(ui));
        ui.net = net;
        showLobby(ui);
      } catch (err) {
        net.close();
        busy(netErrorText(err), true);
      }
    }
  });
  ui.screen(n, { back: () => showMainMenu(ui), demo: true });
  if (joinCode.length === 4) setTimeout(() => n.querySelector('[data-a=join]').click(), 300);
}

// eventos de red → interfaz (una vez por sesión)
function wire(ui, net) {
  net.on('lobby', () => { if (ui.cur && ui.cur.classList.contains('lobby')) ui.cur._render(); });
  net.on('start', m => ui.startOnline(m));
  net.on('toLobby', () => { ui.game.endRace(); ui.sema.classList.add('hidden'); ui.showPauseButton(false); showLobby(ui); });
  net.on('hostLeft', () => {
    net.close(); ui.net = null;
    if (ui.game.race && !ui.game.isDemo) { ui.game.endRace(); ui.sema.classList.add('hidden'); ui.showPauseButton(false); }
    showMainMenu(ui);
    ui.toast('El anfitrión cerró la sala');
  });
  net.on('left', id => {
    const race = ui.game.race;
    if (race && race.net === net) for (const r of race.racers) if (r.owner === id && r.netHuman) { r.dropped = true; r.car.model.root.visible = false; r.finished = true; r.finishTime = Infinity; ui.toast(r.name + ' salió de la carrera'); }
  });
  net.on('fin', m => {
    const race = ui.game.race;
    const r = race && race.racers[m.i];
    if (!r || !r.remote) return;
    if (!r.finished) { r.finished = true; r.lap = race.laps; race.finishOrder.push(r); r.place = race.finishOrder.length; }
    r.finishTime = m.time; r.lapTimes = m.laps;
  });
}

// ------------------------------------------------------------ sala de espera
export function showLobby(ui) {
  const net = ui.net;
  if (!net) { showMainMenu(ui); return; }
  const owned = CARS.filter(c => Profile.owns(c.id));
  const share = location.origin + location.pathname + '?sala=' + net.code;
  const n = el(`<div class="screen lobby">
    <header class="scr-head"><span class="step">SALA ONLINE · ${net.isHost ? 'ERES EL ANFITRIÓN' : 'INVITADO'}</span><h2>SALA ${net.code}</h2></header>
    <div class="lb-body">
      <div class="glass lb-code">
        <small>Código de la sala</small>
        <b>${net.code.split('').map(ch => `<i>${ch}</i>`).join('')}</b>
        <div class="lb-share"><button class="btn sm" data-a="copy">📋 Copiar enlace</button>${navigator.share ? '<button class="btn sm" data-a="share">📤 Compartir</button>' : ''}</div>
        <small class="lb-tip">Tus amigos abren el juego, tocan <b>Multijugador → Unirse</b> y escriben el código (o abren el enlace).</small>
      </div>
      <div class="lb-players"></div>
      <div class="glass lb-set"></div>
    </div>
    <div class="menu-row bottom">
      <button class="btn" data-a="leave">‹ Salir de la sala</button>
      <button class="btn go" data-a="start" data-focus></button>
    </div>
  </div>`);

  const render = () => {
    const s = net.settings;
    const t = TRACKS[s.track] || TRACKS[0];
    n.querySelector('.lb-players').innerHTML = Array.from({ length: MAX_PLAYERS }, (_, i) => {
      const p = net.players[i];
      if (!p) return `<div class="lb-p empty"><span class="lb-wait"></span><b>Esperando jugador…</b></div>`;
      const c = carById(p.car) || CARS[0];
      const mine = p.id === net.myId;
      return `<div class="lb-p ${mine ? 'me' : ''}" style="--pc:${hex(p.color)}">
        <img data-thumb="${c.id}" alt="">
        <div class="lb-pinfo"><b>${esc(p.name)}</b><small><i style="--cc:${CLASSES[c.cls].color}">${c.cls}</i>${c.brand} ${c.name}</small></div>
        <span class="lb-tags">${i === 0 ? '<em class="host">👑 Anfitrión</em>' : ''}${mine ? '<em>Tú</em>' : ''}</span>
        ${mine ? '<span class="lb-carsel"><button class="arrow sm" data-car="-1">‹</button><button class="arrow sm" data-car="1">›</button></span>' : ''}
      </div>`;
    }).join('');
    n.querySelectorAll('img[data-thumb]').forEach(img => carThumb(carById(img.dataset.thumb), url => { img.src = url; img.classList.add('ok'); }));
    n.querySelectorAll('[data-car]').forEach(b => b.onclick = () => changeCar(+b.dataset.car));
    const H = net.isHost;
    n.querySelector('.lb-set').innerHTML = `
      <div class="lb-track" style="--grad:${THEME_GRAD[t.theme]}">
        ${H ? '<button class="arrow sm" data-o="trk-">‹</button>' : ''}
        <span><small>${THEME_ICON[t.theme]} ${t.subtitle}</small><b>${t.name}</b></span>
        ${H ? '<button class="arrow sm" data-o="trk+">›</button>' : ''}
      </div>
      <div class="opt"><span>Vueltas</span>${H ? `<div class="stepper"><button class="btn sm" data-o="lap-">−</button><b>${s.laps}</b><button class="btn sm" data-o="lap+">+</button></div>` : `<b>${s.laps}</b>`}</div>
      <div class="opt"><span>Rivales IA</span>${H ? `<div class="stepper"><button class="btn sm" data-o="riv-">−</button><b>${s.rivals}</b><button class="btn sm" data-o="riv+">+</button></div>` : `<b>${s.rivals}</b>`}</div>
      <div class="opt"><span>Dificultad IA</span>${H ? `<div class="seg">${['Fácil', 'Normal', 'Difícil'].map((d, i) => `<button class="segb ${i === s.difficulty ? 'on' : ''}" data-o="dif${i}">${d}</button>`).join('')}</div>` : `<b>${['Fácil', 'Normal', 'Difícil'][s.difficulty]}</b>`}</div>
      <small class="lb-note">Online: sin disparos ni ítems; las monedas y cajones sí están.</small>`;
    n.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { ui.game.audio?.ui(); setting(b.dataset.o); });
    const start = n.querySelector('[data-a=start]');
    if (H) {
      start.disabled = false;
      start.textContent = net.players.length > 1 ? `¡Empezar carrera! (${net.players.length} jugadores) 🏁` : 'Empezar solo (esperando amigos…) 🏁';
    } else { start.disabled = true; start.textContent = 'Esperando al anfitrión…'; }
    const mine = net.players.find(p => p.id === net.myId);
    if (mine) ui.showCar(carById(mine.car), mine.color, 'right');
  };
  n._render = render;

  const changeCar = d => {
    const i = owned.findIndex(c => c.id === ui.s.p1.car);
    ui.s.p1.car = owned[(i + d + owned.length) % owned.length].id;
    ui.s.p1.color = -1;
    Settings.save();
    ui.game.audio?.ui();
    net.updateMe(me(ui));
    render();
  };
  const setting = o => {
    const s = { ...net.settings };
    if (o === 'trk-') s.track = (s.track - 1 + TRACKS.length) % TRACKS.length;
    if (o === 'trk+') s.track = (s.track + 1) % TRACKS.length;
    if (o === 'lap-') s.laps = Math.max(1, s.laps - 1);
    if (o === 'lap+') s.laps = Math.min(9, s.laps + 1);
    if (o === 'riv-') s.rivals = Math.max(0, s.rivals - 1);
    if (o === 'riv+') s.rivals = Math.min(6 - net.players.length, s.rivals + 1);
    if (o.startsWith('dif')) s.difficulty = +o.slice(3);
    net.updateSettings(s);
    render();
  };

  ui.click(n, '[data-a]', (e, b) => {
    const a = b.dataset.a;
    if (a === 'leave') { net.close(); ui.net = null; showMainMenu(ui); }
    if (a === 'copy') { navigator.clipboard?.writeText(share).then(() => ui.toast('Enlace copiado'), () => ui.toast(share)); }
    if (a === 'share') navigator.share({ title: 'Turbo Duelo', text: `¡Corre conmigo en Turbo Duelo! Sala ${net.code}`, url: share }).catch(() => {});
    if (a === 'start' && net.isHost) {
      // rivales de la IA (los simula el anfitrión)
      const ranked = CARS.slice().sort((x, y) => x.pi - y.pi);
      const best = Math.max(...net.players.map(p => ranked.findIndex(c => c.id === p.car)));
      const names = ['Turbo', 'Chispa', 'Nitro', 'Rayo', 'Bala'];
      const ai = Array.from({ length: Math.min(net.settings.rivals, 6 - net.players.length) }, (_, k) => {
        const c = ranked[Math.max(0, Math.min(ranked.length - 1, best - 1 + Math.floor(Math.random() * 3)))];
        return { name: 'CPU ' + names[k], car: c.id, color: c.color };
      });
      net.startRace(ai);
    }
  });
  render();
  ui.screen(n, { back: () => { net.close(); ui.net = null; showMainMenu(ui); }, demo: true });
}

