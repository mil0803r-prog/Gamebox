import { CARS, COLORS } from '../cars/carData.js';
import { TRACKS } from '../tracks/trackData.js';
import { Track } from '../tracks/Track.js';
import { Settings, Records } from '../game/Storage.js';
import { CarPreview } from './CarPreview.js';
import { fmtTime } from './HUD.js';

const STAT_LABELS = { speed: 'Velocidad', accel: 'Aceleración', handling: 'Manejo', turbo: 'Turbo' };
const DIFF = ['Fácil', 'Normal', 'Difícil'];
const THEME_GRAD = {
  city: 'linear-gradient(135deg,#2a0a4a,#ff2bd6 140%)',
  desert: 'linear-gradient(135deg,#f2a64a,#c0503a)',
  snow: 'linear-gradient(135deg,#9cc8f0,#4a6fa8)',
};
const hex = n => '#' + n.toString(16).padStart(6, '0');
const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

export class UI {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('ui');
    this.s = Settings.data;
    this.previews = [];
    this.cur = null;
    this.mode = 1;
    this.trackPreviewCache = {};
    this.padPrev = [{}, {}, {}, {}];

    // barra superior (silencio, pausa, pantalla completa)
    this.topbar = el(`<div class="topbar">
      <button class="icon-btn b-pause hidden" title="Pausa">⏸</button>
      <button class="icon-btn b-mute" title="Silenciar">🔊</button>
      <button class="icon-btn b-full" title="Pantalla completa">⛶</button>
    </div>`);
    this.root.appendChild(this.topbar);
    this.topbar.querySelector('.b-pause').onclick = () => this.togglePause();
    this.topbar.querySelector('.b-mute').onclick = () => this.toggleMute();
    this.topbar.querySelector('.b-full').onclick = () => this.toggleFullscreen();
    if (!document.fullscreenEnabled && !document.webkitFullscreenEnabled) this.topbar.querySelector('.b-full').classList.add('hidden');
    this.updateMuteIcon();

    this.sema = el(`<div class="sema hidden"><i></i><i></i><i></i></div>`);
    this.root.appendChild(this.sema);
    this.fps = el(`<div class="fps hidden"></div>`);
    this.root.appendChild(this.fps);

    game.on('pauseToggle', () => this.togglePause());
    game.on('layout', () => {
      const split = game.race && game.rigs.length === 2 ? game.splitMode() : '';
      this.topbar.classList.toggle('on-rows', split === 'rows');
      this.topbar.classList.toggle('on-cols', split === 'cols');
    });
    game.on('raceEvent', e => this.onRaceEvent(e));
    game.on('raceTick', () => this.onRaceTick());
    game.on('frame', dt => this.onFrame(dt));
    window.addEventListener('keydown', e => this.onKey(e));
    this.showMain();
  }

  // ------------------------------------------------------------ utilidades
  screen(node) {
    const keep = this.previews.filter(p => node && node.contains(p.canvas));
    this.previews.filter(p => !keep.includes(p)).forEach(p => p.dispose());
    this.previews = keep;
    this.topbar.classList.toggle('menu', !!node && !node.classList.contains('overlay'));
    if (this.cur) this.cur.remove();
    this.cur = node;
    this.keyHandler = null;
    if (node) {
      this.root.appendChild(node);
      const first = node.querySelector('[data-focus]') || node.querySelector('.btn');
      if (first && !this.game.isTouch) first.focus({ preventScroll: true });
    }
    this.game.input.kb.captureGameKeys = !node || node.classList.contains('overlay-light');
  }

  click(node, sel, fn) { node.querySelectorAll(sel).forEach(b => b.addEventListener('click', e => { this.game.audio?.ui(); fn(e, b); })); }

  focusMove(dir) {
    if (!this.cur) return;
    const btns = [...this.cur.querySelectorAll('.btn, .focusable')].filter(b => b.offsetParent !== null);
    if (!btns.length) return;
    let i = btns.indexOf(document.activeElement);
    i = i < 0 ? 0 : (i + dir + btns.length) % btns.length;
    btns[i].focus({ preventScroll: true });
  }

  onKey(e) {
    if (!this.cur) return;
    if (this.keyHandler && this.keyHandler(e.code, e) === true) { e.preventDefault(); return; }
    if (['ArrowDown', 'ArrowRight', 'Tab'].includes(e.code)) { this.focusMove(1); e.preventDefault(); }
    else if (['ArrowUp', 'ArrowLeft'].includes(e.code)) { this.focusMove(-1); e.preventDefault(); }
    else if (e.code === 'Enter' || e.code === 'Space') {
      const a = document.activeElement;
      const native = e.pad === undefined && a && a.tagName === 'BUTTON' && this.cur.contains(a);
      if (native) return; // el navegador ya hace click
      const target = a && this.cur.contains(a) ? a : this.cur.querySelector('[data-focus]');
      if (target) { target.click(); e.preventDefault(); }
    } else if (e.code === 'Escape' && this.backAction) { this.backAction(); }
  }

  // mandos en menús: genera "teclas" virtuales
  pollPadsForMenu() {
    const pads = this.game.input.pads.list();
    pads.forEach((p, i) => {
      if (i > 1) return;
      const prev = this.padPrev[i];
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      const st = {
        l: ax < -0.5 || p.buttons[14]?.pressed, r: ax > 0.5 || p.buttons[15]?.pressed,
        u: ay < -0.5 || p.buttons[12]?.pressed, d: ay > 0.5 || p.buttons[13]?.pressed,
        a: p.buttons[0]?.pressed, b: p.buttons[1]?.pressed, start: p.buttons[9]?.pressed,
      };
      const press = k => st[k] && !prev[k];
      const send = code => this.onKey({ code, preventDefault() {}, pad: i });
      const P2 = i === 1 && this.mode === 2;
      if (press('l')) send(P2 ? 'ArrowLeft' : 'KeyA');
      if (press('r')) send(P2 ? 'ArrowRight' : 'KeyD');
      if (press('u')) send(P2 ? 'ArrowUp' : 'KeyW');
      if (press('d')) send(P2 ? 'ArrowDown' : 'KeyS');
      if (press('a')) send('Enter');
      if (press('b')) send('Escape');
      this.padPrev[i] = st;
    });
  }

  onFrame(dt) {
    for (const p of this.previews) p.render(dt);
    if (this.cur && this.game.input.pads.list().length) this.pollPadsForMenu();
    if (this.s.showFps) {
      this.fpsAcc = (this.fpsAcc || 0) + dt; this.fpsN = (this.fpsN || 0) + 1;
      if (this.fpsAcc > 0.5) { this.fps.textContent = Math.round(this.fpsN / this.fpsAcc) + ' fps' + (this.game.quality ? ' · Q' + this.game.quality.level : ''); this.fpsAcc = 0; this.fpsN = 0; }
    }
    this.fps.classList.toggle('hidden', !this.s.showFps);
  }

  toggleMute() {
    this.s.muted = !this.s.muted;
    Settings.save();
    this.game.audio?.setMuted(this.s.muted);
    this.updateMuteIcon();
  }
  updateMuteIcon() { this.topbar.querySelector('.b-mute').textContent = this.s.muted ? '🔇' : '🔊'; }

  toggleFullscreen() {
    const d = document, de = d.documentElement;
    if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    else {
      const p = (de.requestFullscreen || de.webkitRequestFullscreen)?.call(de, { navigationUI: 'hide' });
      if (p && p.then) p.then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
    }
  }

  // ------------------------------------------------------------ MENÚ PRINCIPAL
  showMain() {
    this.game.audio?.music('menu');
    this.topbar.querySelector('.b-pause').classList.add('hidden');
    const n = el(`<div class="screen main">
      <div class="logo"><span class="l1">TURBO</span><span class="l2">DUELO</span></div>
      <div class="tag">Carreras arcade · pantalla dividida</div>
      <div class="menu-col">
        <button class="btn big" data-a="1">1 JUGADOR <small>vs IA</small></button>
        <button class="btn big pink" data-a="2">2 JUGADORES <small>pantalla dividida</small></button>
        <div class="menu-row">
          <button class="btn" data-a="opt">⚙ Opciones</button>
          <button class="btn" data-a="rec">🏆 Récords</button>
        </div>
      </div>
      <div class="help">${this.game.isTouch ? 'Cada jugador usa su mitad de la pantalla' : 'J1: WASD + Shift (derrape) + Espacio (turbo) · J2: Flechas + Ctrl der. + Enter · Mandos compatibles'}</div>
    </div>`);
    this.click(n, '[data-a]', (e, b) => {
      this.game.audio?.unlock();
      const a = b.dataset.a;
      if (a === '1' || a === '2') { this.mode = +a; this.showCarSelect(); }
      if (a === 'opt') this.showOptions();
      if (a === 'rec') this.showRecords();
    });
    this.backAction = null;
    this.screen(n);
  }

  // ------------------------------------------------------------ SELECCIÓN DE AUTO
  showCarSelect() {
    const players = this.mode;
    const n = el(`<div class="screen select">
      <h2>ELIGE TU AUTO</h2>
      <div class="panels ${players === 2 ? 'two' : ''}"></div>
      <div class="menu-row bottom">
        <button class="btn" data-a="back">← Atrás</button>
        <button class="btn go" data-a="next" data-focus>Continuar →</button>
      </div>
    </div>`);
    const panels = n.querySelector('.panels');
    const keys = this.game.isTouch ? ['', ''] : players === 1 ? ['◀ ▶ auto · ▲ ▼ color'] : ['A / D auto · W / S color', '← / → auto · ↑ / ↓ color'];
    const state = [this.s.p1, this.s.p2];
    const refresh = [];
    for (let p = 0; p < players; p++) {
      const pn = el(`<div class="panel p${p + 1}">
        <div class="ptitle">JUGADOR ${p + 1}</div>
        <div class="carview"><button class="arrow" data-d="-1">◀</button><canvas></canvas><button class="arrow" data-d="1">▶</button></div>
        <div class="carname"></div><div class="cardesc"></div>
        <div class="stats"></div>
        <div class="swatches">${COLORS.map((c, i) => `<button class="sw" data-c="${i}" style="background:${hex(c.hex)}" title="${c.name}"></button>`).join('')}</div>
        <div class="keys">${keys[p] || ''}</div>
      </div>`);
      panels.appendChild(pn);
      const prev = new CarPreview(pn.querySelector('canvas'));
      this.previews.push(prev);
      const st = state[p];
      const upd = () => {
        const car = CARS[st.car];
        // evitar mismo color que el otro jugador
        if (players === 2) {
          const o = state[1 - p];
          if (o.color === st.color) st.color = (st.color + (st._dir || 1) + COLORS.length) % COLORS.length;
        }
        pn.querySelector('.carname').textContent = car.name;
        pn.querySelector('.cardesc').textContent = car.desc;
        pn.querySelector('.stats').innerHTML = Object.entries(car.stats).map(([k, v]) =>
          `<div class="stat"><span>${STAT_LABELS[k]}</span><div class="bar">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= v ? 'on' : ''}"></i>`).join('')}</div></div>`).join('');
        pn.querySelectorAll('.sw').forEach((b, i) => {
          b.classList.toggle('sel', i === st.color);
          b.classList.toggle('taken', players === 2 && i === state[1 - p].color);
        });
        pn.style.setProperty('--pc', hex(COLORS[st.color].hex));
        prev.set(car.shape, COLORS[st.color].hex);
      };
      refresh.push(upd);
      const all = () => refresh.forEach(f => f());
      const changeCar = d => { st.car = (st.car + d + CARS.length) % CARS.length; all(); this.game.audio?.ui(); };
      const changeColor = d => { st._dir = d; st.color = (st.color + d + COLORS.length) % COLORS.length; upd(); all(); this.game.audio?.ui(); };
      pn.querySelectorAll('.arrow').forEach(b => b.addEventListener('click', () => changeCar(+b.dataset.d)));
      pn.querySelectorAll('.sw').forEach(b => b.addEventListener('click', () => {
        if (players === 2 && state[1 - p].color === +b.dataset.c) return; // color ocupado
        st.color = +b.dataset.c; all(); this.game.audio?.ui();
      }));
      pn._car = changeCar; pn._color = changeColor;
      upd();
    }
    const pns = [...panels.children];
    this.click(n, '[data-a=back]', () => this.showMain());
    this.click(n, '[data-a=next]', () => { Settings.save(); this.showTrackSelect(); });
    this.backAction = () => this.showMain();
    this.screen(n);
    this.keyHandler = (code) => {
      const map = {
        KeyA: [0, '_car', -1], KeyD: [0, '_car', 1], KeyW: [0, '_color', -1], KeyS: [0, '_color', 1],
        ArrowLeft: [1, '_car', -1], ArrowRight: [1, '_car', 1], ArrowUp: [1, '_color', -1], ArrowDown: [1, '_color', 1],
      };
      const m = map[code];
      if (!m) return false;
      const pi = players === 1 ? 0 : m[0];
      pns[pi][m[1]](m[2]);
      return true;
    };
  }

  // ------------------------------------------------------------ SELECCIÓN DE PISTA
  trackPreview(def) {
    if (this.trackPreviewCache[def.id]) return this.trackPreviewCache[def.id];
    const t = new Track(def);
    const c = document.createElement('canvas'); c.width = 220; c.height = 160;
    const g = c.getContext('2d');
    let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9;
    const m = t.main;
    for (let i = 0; i < m.n; i++) { minx = Math.min(minx, m.px[i]); maxx = Math.max(maxx, m.px[i]); minz = Math.min(minz, m.pz[i]); maxz = Math.max(maxz, m.pz[i]); }
    const sc = Math.min(200 / (maxx - minx), 140 / (maxz - minz));
    const ox = (220 - (maxx - minx) * sc) / 2 - minx * sc, oz = (160 - (maxz - minz) * sc) / 2 - minz * sc;
    const draw = (s, w, col) => {
      g.strokeStyle = col; g.lineWidth = w; g.lineJoin = 'round'; g.beginPath();
      for (let i = 0; i < s.n; i++) { const x = s.px[i] * sc + ox, y = s.pz[i] * sc + oz; i ? g.lineTo(x, y) : g.moveTo(x, y); }
      if (s.closed) g.closePath(); g.stroke();
    };
    t.surfaces.forEach(s => draw(s, 9, 'rgba(0,0,0,0.5)'));
    t.shortcuts.forEach(s => draw(s, 4, '#ffd27a'));
    draw(m, 5, '#fff');
    const url = c.toDataURL();
    this.trackPreviewCache[def.id] = { url, length: t.length };
    return this.trackPreviewCache[def.id];
  }

  showTrackSelect() {
    const s = this.s;
    const n = el(`<div class="screen tracks">
      <h2>ELIGE LA PISTA</h2>
      <div class="cards">${TRACKS.map((t, i) => {
        const pv = this.trackPreview(t);
        const rec = Records.get(t.id);
        return `<button class="card focusable" data-t="${i}" style="background:${THEME_GRAD[t.theme]}">
          <img src="${pv.url}" alt="">
          <div class="cname">${t.name}</div><div class="csub">${t.subtitle} · ${(pv.length / 1000).toFixed(1)} km</div>
          <div class="crec">🏆 Vuelta: ${rec.bestLap ? fmtTime(rec.bestLap.t) : '--'}</div>
        </button>`;
      }).join('')}</div>
      <div class="opts">
        <div class="opt"><span>Vueltas</span><div class="stepper"><button class="btn sm" data-o="laps-">−</button><b class="v-laps"></b><button class="btn sm" data-o="laps+">+</button></div></div>
        <div class="opt"><span>Ítems en pista</span><button class="btn sm tog" data-o="items"></button></div>
        <div class="opt"><span>Rivales IA</span><div class="stepper"><button class="btn sm" data-o="riv-">−</button><b class="v-riv"></b><button class="btn sm" data-o="riv+">+</button></div></div>
        <div class="opt o-diff"><span>Dificultad IA</span><button class="btn sm tog" data-o="diff"></button></div>
      </div>
      <div class="menu-row bottom">
        <button class="btn" data-a="back">← Atrás</button>
        <button class="btn go big" data-a="go" data-focus>¡A CORRER! 🏁</button>
      </div>
    </div>`);
    const rivKey = this.mode === 1 ? 'rivals1p' : 'rivals2p';
    const rivMin = this.mode === 1 ? 1 : 0, rivMax = this.mode === 1 ? 3 : 2;
    const upd = () => {
      n.querySelectorAll('.card').forEach((c, i) => c.classList.toggle('sel', i === s.track));
      n.querySelector('.v-laps').textContent = s.laps;
      n.querySelector('[data-o=items]').textContent = s.items ? 'Sí' : 'No';
      n.querySelector('.v-riv').textContent = s[rivKey];
      n.querySelector('[data-o=diff]').textContent = DIFF[s.difficulty];
      n.querySelector('.o-diff').classList.toggle('dim', s[rivKey] === 0);
    };
    this.click(n, '.card', (e, b) => { s.track = +b.dataset.t; upd(); });
    this.click(n, '[data-o]', (e, b) => {
      const o = b.dataset.o;
      if (o === 'laps-') s.laps = Math.max(1, s.laps - 1);
      if (o === 'laps+') s.laps = Math.min(9, s.laps + 1);
      if (o === 'items') s.items = !s.items;
      if (o === 'riv-') s[rivKey] = Math.max(rivMin, s[rivKey] - 1);
      if (o === 'riv+') s[rivKey] = Math.min(rivMax, s[rivKey] + 1);
      if (o === 'diff') s.difficulty = (s.difficulty + 1) % 3;
      upd();
    });
    s[rivKey] = Math.max(rivMin, Math.min(rivMax, s[rivKey]));
    this.click(n, '[data-a=back]', () => this.showCarSelect());
    this.click(n, '[data-a=go]', () => { Settings.save(); this.startRace(); });
    this.backAction = () => this.showCarSelect();
    upd();
    this.screen(n);
    this.keyHandler = (code) => {
      if (code === 'KeyA' || code === 'KeyD') { s.track = (s.track + (code === 'KeyD' ? 1 : -1) + TRACKS.length) % TRACKS.length; upd(); return true; }
      return false;
    };
  }

  // ------------------------------------------------------------ CARRERA
  buildEntries() {
    const s = this.s, entries = [];
    const used = new Set();
    const ps = [s.p1, s.p2];
    for (let i = 0; i < this.mode; i++) {
      entries.push({ car: CARS[ps[i].car], color: COLORS[ps[i].color].hex, human: true, humanIndex: i, name: 'Jugador ' + (i + 1) });
      used.add(ps[i].color);
    }
    const riv = this.mode === 1 ? s.rivals1p : s.rivals2p;
    const names = ['Turbo', 'Chispa', 'Nitro'];
    for (let k = 0; k < riv; k++) {
      let c = (k * 3 + 2) % COLORS.length;
      while (used.has(c)) c = (c + 1) % COLORS.length;
      used.add(c);
      entries.push({ car: CARS[(k + 1 + (this.mode === 1 ? s.p1.car : 0)) % CARS.length], color: COLORS[c].hex, human: false, aiLevel: s.difficulty, name: 'CPU ' + names[k] });
    }
    // humanos al fondo de la parrilla para que haya a quién alcanzar
    return [...entries.filter(e => !e.human), ...entries.filter(e => e.human)];
  }

  startRace() {
    this.screen(null);
    this.backAction = null;
    const s = this.s;
    this.game.settings.split = s.split;
    this.game.startRace({ trackId: TRACKS[s.track].id, laps: s.laps, items: s.items, entries: this.buildEntries(), autoAccel: s.autoAccel });
    this.topbar.querySelector('.b-pause').classList.remove('hidden');
    this.resultsShown = false;
    this.semaHide = 0;
    this.game.audio?.music(TRACKS[s.track].theme);
  }

  onRaceTick() {
    const race = this.game.race;
    if (!race) return;
    const c = race.countdownValue;
    if (race.state === 'countdown' || race.time < 1.0) {
      this.sema.classList.remove('hidden');
      const lights = this.sema.children;
      for (let i = 0; i < 3; i++) {
        lights[i].className = race.time >= 0 ? 'g' : (3 - c >= i ? 'r' : '');
      }
    } else this.sema.classList.add('hidden');
  }

  onRaceEvent(e) {
    if (e.type === 'allFinished') {
      setTimeout(() => { if (this.game.race && !this.resultsShown) this.showResults(); }, 2600);
    }
  }

  togglePause() {
    const g = this.game;
    if (!g.race || this.resultsShown) return;
    if (g.paused) { g.paused = false; this.screen(null); g.audio?.setPaused(false); return; }
    g.paused = true;
    g.audio?.setPaused(true);
    const n = el(`<div class="screen overlay pause">
      <h2>PAUSA</h2>
      <div class="menu-col">
        <button class="btn big" data-a="cont" data-focus>▶ Continuar</button>
        <button class="btn" data-a="restart">↻ Reiniciar carrera</button>
        <button class="btn" data-a="mute">${this.s.muted ? '🔇 Activar sonido' : '🔊 Silenciar'}</button>
        <button class="btn" data-a="menu">⌂ Salir al menú</button>
      </div>
    </div>`);
    this.click(n, '[data-a]', (e, b) => {
      const a = b.dataset.a;
      if (a === 'cont') this.togglePause();
      if (a === 'restart') { g.paused = false; g.audio?.setPaused(false); this.startRace(); }
      if (a === 'mute') { this.toggleMute(); b.textContent = this.s.muted ? '🔇 Activar sonido' : '🔊 Silenciar'; }
      if (a === 'menu') { g.paused = false; g.audio?.setPaused(false); this.exitToMenu(); }
    });
    this.backAction = () => this.togglePause();
    this.screen(n);
  }

  exitToMenu() {
    this.game.endRace();
    this.sema.classList.add('hidden');
    this.showMain();
  }

  // ------------------------------------------------------------ RESULTADOS
  showResults() {
    const race = this.game.race;
    this.resultsShown = true;
    this.game.audio?.music('results');
    const L = race.track.length;
    // estimar tiempo de los que no terminaron
    const rows = race.racers.map(r => {
      let total = r.finished ? r.finishTime : null;
      if (!r.finished) {
        const remaining = race.laps * L - Math.max(0, r.raceDist);
        const avg = Math.max(20, r.raceDist / Math.max(1, race.time));
        total = race.time + remaining / avg;
      }
      return { r, total, est: !r.finished, best: r.lapTimes.length ? Math.min(...r.lapTimes) : null };
    }).sort((a, b) => a.total - b.total);
    const trackId = race.track.def.id;
    const recMsgs = [];
    for (const row of rows) {
      if (row.r.human && row.r.finished) {
        const res = Records.submit(trackId, race.laps, row.r.lapTimes, row.total, row.r.name);
        if (res.lap) recMsgs.push(`¡Nuevo récord de vuelta! ${row.r.name}: ${fmtTime(row.best)}`);
        if (res.race) recMsgs.push(`¡Nuevo récord de carrera (${race.laps} v.)! ${row.r.name}: ${fmtTime(row.total)}`);
      }
    }
    const pod = [rows[1], rows[0], rows[2]];
    const n = el(`<div class="screen overlay results">
      <h2>RESULTADOS</h2>
      <div class="podium">${pod.map((row, k) => row ? `
        <div class="pod p${[2, 1, 3][k]}">
          <div class="pcar" style="--c:${hex(row.r.color)}"></div>
          <div class="pname">${row.r.name}</div>
          <div class="pblock">${[2, 1, 3][k]}º</div>
        </div>` : '<div class="pod empty"></div>').join('')}</div>
      ${recMsgs.map(m => `<div class="newrec">🏆 ${m}</div>`).join('')}
      <div class="table-wrap"><table class="rtable">
        <tr><th>#</th><th>Piloto</th><th>Total</th><th>Mejor vuelta</th><th>Vueltas</th></tr>
        ${rows.map((row, i) => `<tr class="${row.r.human ? 'human' : ''}">
          <td>${i + 1}º</td><td><i class="dot" style="background:${hex(row.r.color)}"></i>${row.r.name}</td>
          <td>${row.est ? '~' : ''}${fmtTime(row.total)}</td><td>${fmtTime(row.best)}</td>
          <td class="laps">${row.r.lapTimes.map(fmtTime).join(' · ') || '—'}</td></tr>`).join('')}
      </table></div>
      <div class="menu-row bottom">
        <button class="btn go" data-a="again" data-focus>↻ Revancha</button>
        <button class="btn" data-a="track">🗺 Cambiar pista</button>
        <button class="btn" data-a="menu">⌂ Menú</button>
      </div>
    </div>`);
    this.click(n, '[data-a]', (e, b) => {
      const a = b.dataset.a;
      if (a === 'again') this.startRace();
      if (a === 'track') { this.game.endRace(); this.showTrackSelect(); this.topbar.querySelector('.b-pause').classList.add('hidden'); }
      if (a === 'menu') this.exitToMenu();
    });
    this.backAction = null;
    this.screen(n);
    this.topbar.querySelector('.b-pause').classList.add('hidden');
  }

  // ------------------------------------------------------------ OPCIONES
  showOptions() {
    const s = this.s;
    const rows = [
      ['autoAccel', 'Acelerar automático (táctil)', [[true, 'Sí'], [false, 'No (botón)']]],
      ['split', 'División de pantalla', [['auto', 'Auto'], ['horizontal', 'Arriba / abajo'], ['vertical', 'Lado a lado']]],
      ['quality', 'Calidad gráfica', [['auto', 'Auto'], ['low', 'Baja'], ['medium', 'Media'], ['high', 'Alta']]],
      ['music', 'Música', [[true, 'Sí'], [false, 'No']]],
      ['sfx', 'Efectos de sonido', [[true, 'Sí'], [false, 'No']]],
      ['showFps', 'Mostrar FPS', [[false, 'No'], [true, 'Sí']]],
    ];
    const n = el(`<div class="screen options">
      <h2>OPCIONES</h2>
      <div class="opts list">${rows.map(([k, label]) => `<div class="opt"><span>${label}</span><button class="btn sm tog" data-k="${k}"></button></div>`).join('')}
        <div class="opt"><span>Borrar récords</span><button class="btn sm danger" data-a="clear">Borrar</button></div>
      </div>
      <div class="menu-row bottom"><button class="btn go" data-a="back" data-focus>← Volver</button></div>
    </div>`);
    const upd = () => rows.forEach(([k, , vals]) => {
      const v = vals.find(x => x[0] === s[k]) || vals[0];
      n.querySelector(`[data-k=${k}]`).textContent = v[1];
    });
    this.click(n, '[data-k]', (e, b) => {
      const k = b.dataset.k, vals = rows.find(r => r[0] === k)[2];
      const i = vals.findIndex(x => x[0] === s[k]);
      s[k] = vals[(i + 1) % vals.length][0];
      upd(); Settings.save();
      this.game.applySettings?.(s);
    });
    this.click(n, '[data-a=clear]', (e, b) => {
      if (b.dataset.confirm) { Records.clear(); b.textContent = '✓ Borrados'; }
      else { b.dataset.confirm = 1; b.textContent = '¿Seguro?'; }
    });
    this.click(n, '[data-a=back]', () => this.showMain());
    this.backAction = () => this.showMain();
    upd();
    this.screen(n);
  }

  showRecords() {
    const n = el(`<div class="screen records">
      <h2>RÉCORDS</h2>
      <div class="table-wrap"><table class="rtable">
        <tr><th>Pista</th><th>Mejor vuelta</th><th>Carrera 3 v.</th><th>Otras</th></tr>
        ${TRACKS.map(t => {
          const r = Records.get(t.id);
          const others = Object.keys(r).filter(k => k.startsWith('race') && k !== 'race3').map(k => `${k.slice(4)}v: ${fmtTime(r[k].t)}`).join(' · ');
          return `<tr><td>${t.name}</td><td>${r.bestLap ? fmtTime(r.bestLap.t) + `<small> ${r.bestLap.who}</small>` : '--'}</td>
            <td>${r.race3 ? fmtTime(r.race3.t) + `<small> ${r.race3.who}</small>` : '--'}</td><td class="laps">${others || '—'}</td></tr>`;
        }).join('')}
      </table></div>
      <div class="menu-row bottom"><button class="btn go" data-a="back" data-focus>← Volver</button></div>
    </div>`);
    this.click(n, '[data-a=back]', () => this.showMain());
    this.backAction = () => this.showMain();
    this.screen(n);
  }
}
