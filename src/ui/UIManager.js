import { CARS, COLORS } from '../cars/carData.js';
import { TRACKS } from '../tracks/trackData.js';
import { Settings } from '../game/Storage.js';
import { el } from './dom.js';
import { showMainMenu } from './screens/MainMenu.js';
import { showPauseMenu } from './screens/PauseMenu.js';
import { showResults } from './screens/Results.js';

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
    this.root.append(this.sema, this.fps, this.navhelp);

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
    showMainMenu(this);
  }

  // ------------------------------------------------------------ pantallas
  // opts: { overlay: menú sobre la carrera, back: acción de Esc, demo: mostrar carrera demo de fondo }
  screen(node, opts = {}) {
    const keep = this.previews.filter(p => node && node.contains(p.canvas));
    this.previews.filter(p => !keep.includes(p)).forEach(p => p.dispose());
    this.previews = keep;
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
      this.root.appendChild(node);
      const first = node.querySelector('[data-focus]') || node.querySelector('.btn');
      if (first && !this.game.isTouch) first.focus({ preventScroll: true });
      if (opts.demo && !this.game.race) this.game.startDemo();
    }
    this.navhelp.classList.toggle('hidden', !node || this.game.isTouch || opts.noNav);
    this.navhelp.querySelector('.nh-back').classList.toggle('hidden', !opts.back);
    this.game.input.kb.captureGameKeys = !node;
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
    const s = this.s, entries = [], used = new Set();
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
    const s = this.s;
    this.game.settings.split = s.split;
    this.game.startRace({ trackId: TRACKS[s.track].id, laps: s.laps, items: s.items, entries: this.buildEntries(), autoAccel: s.autoAccel });
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
