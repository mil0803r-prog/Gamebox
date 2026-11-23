import { CARS, carById } from '../cars/carData.js';
import { TRACKS } from '../tracks/trackData.js';
import { Settings, Profile } from '../game/Storage.js';
import { paintOf } from './screens/CarSelect.js';
import { el, money } from './dom.js';
import { showMainMenu } from './screens/MainMenu.js';
import { showPauseMenu } from './screens/PauseMenu.js';
import { showResults } from './screens/Results.js';
import { showSplash } from './screens/Splash.js';
import { THEME_GRAD } from './dom.js';

// elementos que entran escalonados y tarjetas que se inclinan con el mouse
const STAGGER = '.mm-item, .panel, .card, .lot-card, .arm-card, .reccard, .ctl-card, .opt, .ogroup, .pod, .rtable tr, .glass .btn, .earn, .newrec';
const TILT = '.card, .lot-card, .arm-card, .reccard, .mm-car, .panel';
const TIPS = [
  'Mantén el derrape en las curvas: las chispas moradas dan el mini-turbo más fuerte.',
  'Ve detrás de un rival un par de segundos para cargar turbo con el rebufo.',
  'Los atajos (en amarillo en el mini-mapa) ahorran tiempo, pero son angostos.',
  'Cada moneda vale dinero al final… o munición para tus armas.',
  'Los cajones dorados pueden darte el premio mayor de $10.000.',
  'Presiona C para cambiar de cámara. Prueba la vista interior.',
  'Saltar o chocar con una pared cancela la carga del mini-turbo.',
  'El escudo de los cajones bloquea minas, misiles y láseres.',
];

// Gestor de la interfaz: cambia de pantalla, navegación con teclado/mando,
// barra superior, semáforo y la carrera demo de fondo.
export class UIManager {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('ui');
    this.s = Settings.data;
    this.previews = [];
    this.cur = null;
    this.mode = 1;
    this.cache = {};
    this.padPrev = [{}, {}, {}, {}];

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
    this.fps = el(`<div class="fps hidden"></div>`);
    this.navhelp = el(`<div class="navhelp hidden"><span><kbd>↑</kbd><kbd>↓</kbd> Mover</span><span><kbd>Enter</kbd> Elegir</span><span class="nh-back"><kbd>Esc</kbd> Atrás</span></div>`);
    this.moneyEl = el(`<div class="money-pill hidden"><span class="mp-ico">$</span><b></b></div>`);
    // aviso para girar el celular (el juego está pensado para horizontal)
    this.rotateEl = el(`<div class="rotate-hint hidden">
      <div class="rh-phone"><i></i></div>
      <b>Gira tu celular</b>
      <span>Turbo Duelo se juega en horizontal</span>
      <button class="btn sm" data-a="portrait">Seguir en vertical</button>
    </div>`);
    this.rotateEl.querySelector('[data-a=portrait]').onclick = () => { this.portraitOk = true; this.checkOrientation(); };
    // transición de barrido entre pantallas y pantalla de carga
    this.wipe = el(`<div class="wipe"><i></i><i></i><i></i></div>`);
    this.loading = el(`<div class="loading hidden">
      <div class="ld-bg"></div>
      <div class="ld-box">
        <small class="ld-sub"></small>
        <b class="ld-title"></b>
        <div class="ld-bar"><i></i></div>
        <p class="ld-tip"></p>
      </div>
    </div>`);
    this.root.append(this.sema, this.fps, this.navhelp, this.moneyEl, this.rotateEl, this.wipe, this.loading);
    // inclinación 3D de tarjetas (solo con mouse)
    window.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || !this.cur) return;
      const c = e.target.closest && e.target.closest(TILT);
      if (this.tilted && this.tilted !== c) { this.tilted.style.removeProperty('--rx'); this.tilted.style.removeProperty('--ry'); }
      this.tilted = c;
      if (!c) return;
      const r = c.getBoundingClientRect();
      c.style.setProperty('--ry', (((e.clientX - r.left) / r.width - 0.5) * 9).toFixed(2) + 'deg');
      c.style.setProperty('--rx', (-((e.clientY - r.top) / r.height - 0.5) * 9).toFixed(2) + 'deg');
      c.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
      c.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
    });
    window.addEventListener('resize', () => this.checkOrientation());
    window.addEventListener('orientationchange', () => setTimeout(() => this.checkOrientation(), 250));
    this.checkOrientation();
    this.updateMoney();

    game.on('pauseToggle', () => this.togglePause());
    game.on('layout', () => {
      const split = game.race && !game.isDemo && game.rigs.length === 2 ? game.splitMode() : '';
      this.topbar.classList.toggle('on-rows', split === 'rows');
      this.topbar.classList.toggle('on-cols', split === 'cols');
    });
    game.on('raceEvent', e => {
      if (e.type === 'allFinished') setTimeout(() => { if (this.game.race && !this.resultsShown) showResults(this); }, 2600);
    });
    game.on('raceTick', () => this.updateSemaphore());
    game.on('frame', dt => this.onFrame(dt));
    window.addEventListener('keydown', e => this.onKey(e));
    showSplash(this);
  }

  // ------------------------------------------------------------ pantallas
  // opts: { overlay: menú sobre la carrera, back: acción de Esc, demo: mostrar carrera demo de fondo }
  screen(node, opts = {}) {
    const keep = this.previews.filter(p => node && node.contains(p.canvas));
    this.previews.filter(p => !keep.includes(p)).forEach(p => p.dispose());
    this.previews = keep;
    // barrido diagonal al cambiar entre pantallas completas
    if (node && this.cur && !opts.overlay && !this.cur.classList.contains('overlay')) this.playWipe();
    if (this.cur) {
      const old = this.cur;
      old.classList.add('leaving');
      old.style.pointerEvents = 'none';
      setTimeout(() => old.remove(), 180);
    }
    this.cur = node;
    this.keyHandler = null;
    this.backAction = opts.back || null;
    this.topbar.classList.toggle('menu', !!node);
    if (node) {
      node.querySelectorAll(STAGGER).forEach((e, i) => e.style.setProperty('--i', Math.min(i, 14)));
      this.root.appendChild(node);
      const first = node.querySelector('[data-focus]') || node.querySelector('.btn');
      if (first && !this.game.isTouch) first.focus({ preventScroll: true });
      if (opts.demo && !this.game.race) this.game.startDemo();
    }
    this.navhelp.classList.toggle('hidden', !node || this.game.isTouch || opts.noNav);
    this.moneyEl.classList.toggle('hidden', !node || opts.noMoney || !!opts.overlay && !opts.showMoney);
    this.updateMoney();
    this.navhelp.querySelector('.nh-back').classList.toggle('hidden', !opts.back);
    this.game.input.kb.captureGameKeys = !node;
  }

  playWipe() {
    this.wipe.classList.remove('go'); void this.wipe.offsetWidth; this.wipe.classList.add('go');
  }

  click(node, sel, fn) {
    node.querySelectorAll(sel).forEach(b => b.addEventListener('click', e => { this.game.audio?.ui(); fn(e, b); }));
  }

  focusMove(dir) {
    if (!this.cur) return;
    const btns = [...this.cur.querySelectorAll('.btn, .focusable')].filter(b => b.offsetParent !== null);
    if (!btns.length) return;
    let i = btns.indexOf(document.activeElement);
    i = i < 0 ? 0 : (i + dir + btns.length) % btns.length;
    btns[i].focus({ preventScroll: true });
    this.game.audio?.beep(660, 0.03, 0.06, 'triangle');
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
    } else if (e.code === 'Escape' && this.backAction) { this.game.audio?.ui(); this.backAction(); }
  }

  // mandos en menús: genera "teclas" virtuales
  pollPadsForMenu() {
    this.game.input.pads.list().forEach((p, i) => {
      if (i > 1) return;
      const prev = this.padPrev[i];
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      const st = {
        l: ax < -0.5 || p.buttons[14]?.pressed, r: ax > 0.5 || p.buttons[15]?.pressed,
        u: ay < -0.5 || p.buttons[12]?.pressed, d: ay > 0.5 || p.buttons[13]?.pressed,
        a: p.buttons[0]?.pressed, b: p.buttons[1]?.pressed,
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
      if (this.fpsAcc > 0.5) {
        this.fps.textContent = Math.round(this.fpsN / this.fpsAcc) + ' fps · calidad ' + this.game.quality.level;
        this.fpsAcc = 0; this.fpsN = 0;
      }
    }
    this.fps.classList.toggle('hidden', !this.s.showFps);
  }

  checkOrientation() {
    const portrait = window.innerHeight > window.innerWidth;
    const show = this.game.isTouch && portrait && this.s.orientation === 'landscape' && !this.portraitOk;
    this.rotateEl.classList.toggle('hidden', !show);
  }

  // en celular: pantalla completa + bloquear horizontal (si el navegador lo permite)
  enterLandscape() {
    if (!this.game.isTouch || this.s.orientation !== 'landscape') return;
    const de = document.documentElement;
    const lock = () => screen.orientation?.lock?.('landscape').catch(() => {});
    if (document.fullscreenElement || document.webkitFullscreenElement) { lock(); return; }
    try {
      const p = (de.requestFullscreen || de.webkitRequestFullscreen)?.call(de, { navigationUI: 'hide' });
      if (p && p.then) p.then(lock).catch(() => {});
    } catch { /* sin pantalla completa */ }
  }

  updateMoney(anim) {
    this.moneyEl.querySelector('b').textContent = money(Profile.data.money).slice(1);
    if (anim) { this.moneyEl.classList.remove('bump'); void this.moneyEl.offsetWidth; this.moneyEl.classList.add('bump'); }
  }

  // ------------------------------------------------------------ barra superior
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
  showPauseButton(v) { this.topbar.querySelector('.b-pause').classList.toggle('hidden', !v); }

  // ------------------------------------------------------------ carrera
  buildEntries() {
    const s = this.s, entries = [], usedPaint = new Set(), usedCar = new Set();
    const ps = [s.p1, s.p2];
    for (let i = 0; i < this.mode; i++) {
      const car = carById(ps[i].car);
      entries.push({ car, color: paintOf(ps[i]), human: true, humanIndex: i, name: 'Jugador ' + (i + 1) });
      usedPaint.add(paintOf(ps[i])); usedCar.add(car.id);
    }
    // rivales de la IA: autos de rendimiento parecido al mejor auto humano (más fuertes en difícil)
    const riv = this.mode === 1 ? s.rivals1p : s.rivals2p;
    const ranked = CARS.slice().sort((a, b) => a.pi - b.pi);
    const best = Math.max(...entries.map(e => ranked.indexOf(e.car)));
    const range = [[-3, 0], [-2, 2], [0, 4]][s.difficulty];
    const names = ['Turbo', 'Chispa', 'Nitro'];
    for (let k = 0; k < riv; k++) {
      let car = null;
      for (let tries = 0; tries < 30 && !car; tries++) {
        const idx = Math.max(0, Math.min(ranked.length - 1, best + range[0] + Math.floor(Math.random() * (range[1] - range[0] + 1))));
        if (!usedCar.has(ranked[idx].id) || tries > 20) car = ranked[idx];
      }
      usedCar.add(car.id);
      let color = car.color;
      if (usedPaint.has(color)) color = [0xd4141e, 0x1d4ed8, 0xffc61f, 0x22b85a, 0xff7a00, 0x7a3bff].find(c => !usedPaint.has(c));
      usedPaint.add(color);
      entries.push({ car, color, human: false, aiLevel: s.difficulty, name: 'CPU ' + names[k] });
    }
    // humanos al fondo de la parrilla para que haya a quién alcanzar
    return [...entries.filter(e => !e.human), ...entries.filter(e => e.human)];
  }

  // pantalla de carga con el nombre de la pista y un consejo, luego arranca la carrera
  startRace() {
    const s = this.s, t = TRACKS[s.track];
    if (this.game.isTouch && s.steerMode === 'tilt' && this.mode === 1) this.game.input.tilt.request();
    this.enterLandscape();
    const L = this.loading;
    L.querySelector('.ld-bg').style.background = THEME_GRAD[t.theme];
    L.querySelector('.ld-sub').textContent = `${t.subtitle} · ${s.laps} vueltas`;
    L.querySelector('.ld-title').textContent = t.name;
    L.querySelector('.ld-tip').textContent = '💡 ' + TIPS[(Math.random() * TIPS.length) | 0];
    L.classList.remove('hidden', 'out'); void L.offsetWidth; L.classList.add('in');
    this.screen(null);
    setTimeout(() => {
      this.startRaceNow();
      setTimeout(() => { L.classList.add('out'); setTimeout(() => L.classList.add('hidden'), 450); }, 650);
    }, 120);
  }

  startRaceNow() {
    const s = this.s;
    this.game.settings.split = s.split;
    this.game.startRace({ trackId: TRACKS[s.track].id, laps: s.laps, items: s.items, entries: this.buildEntries(), autoAccel: s.autoAccel, steerMode: s.steerMode, pickups: s.pickups !== false, weapons: s.weapons !== false });
    this.showPauseButton(true);
    this.resultsShown = false;
    this.game.audio?.music(TRACKS[s.track].theme);
  }

  exitToMenu() {
    this.game.endRace();
    this.sema.classList.add('hidden');
    this.showPauseButton(false);
    showMainMenu(this);
  }

  updateSemaphore() {
    const race = this.game.race;
    if (!race) return;
    const c = race.countdownValue;
    if (race.state === 'countdown' || race.time < 1.0) {
      this.sema.classList.remove('hidden');
      const lights = this.sema.children;
      for (let i = 0; i < 3; i++) lights[i].className = race.time >= 0 ? 'g' : (3 - c >= i ? 'r' : '');
    } else this.sema.classList.add('hidden');
  }

  togglePause() {
    const g = this.game;
    if (!g.race || g.isDemo || this.resultsShown) return;
    if (g.paused) { g.paused = false; this.screen(null); g.audio?.setPaused(false); return; }
    g.paused = true;
    g.audio?.setPaused(true);
    showPauseMenu(this);
  }
}
