import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Track } from '../tracks/Track.js';
import { TRACKS } from '../tracks/trackData.js';
import { buildTrackScene } from '../tracks/TrackBuilder.js';
import { Race } from './Race.js';
import { CameraRig } from './CameraRig.js';
import { InputManager } from '../input/Input.js';
import { PlayerHUD, COUNT_TEXT } from '../ui/HUD.js';
import { Effects } from './Effects.js';

export class Game {
  constructor(container) {
    this.container = container;
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.renderer = new THREE.WebGLRenderer({ antialias: !this.isTouch, powerPreference: 'high-performance' });
    this.renderer.setScissorTest(true);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.input = new InputManager();
    this.effects = new Effects(this.scene, 2);
    this.hudLayer = document.getElementById('hud');
    this.settings = { split: 'auto', laps: CONFIG.race.laps };
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, this.isTouch ? 1.5 : 2);
    this.state = 'idle';
    this.views = [];
    this.huds = [];
    this.rigs = [];
    this.clock = new THREE.Clock();
    this.listeners = {};
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  on(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  emit(ev, data) { (this.listeners[ev] || []).forEach(f => f(data)); }

  setPixelRatio(pr) {
    this.pixelRatio = pr;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  resize() {
    this.W = window.innerWidth; this.H = window.innerHeight;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(this.W, this.H);
    this.computeViews();
  }

  splitMode() {
    const s = this.settings.split;
    if (s === 'horizontal') return 'rows';   // uno arriba, otro abajo
    if (s === 'vertical') return 'cols';     // lado a lado
    const portrait = this.H > this.W;
    if (this.isTouch) return portrait ? 'rows' : 'cols';
    return 'rows';
  }

  computeViews() {
    const n = this.rigs.length || 1;
    const W = this.W, H = this.H;
    if (n === 1) this.views = [{ x: 0, y: 0, w: W, h: H }];
    else if (this.splitMode() === 'rows') {
      const h = Math.floor(H / 2);
      this.views = [{ x: 0, y: 0, w: W, h: h - 1 }, { x: 0, y: h + 1, w: W, h: H - h - 1 }];
    } else {
      const w = Math.floor(W / 2);
      this.views = [{ x: 0, y: 0, w: w - 1, h: H }, { x: w + 1, y: 0, w: W - w - 1, h: H }];
    }
    this.huds.forEach((h, i) => this.views[i] && h.layout(this.views[i]));
    this.rigs.forEach((r, i) => { const v = this.views[i]; if (v) { r.camera.aspect = v.w / v.h; r.camera.updateProjectionMatrix(); } });
    this.emit('layout', this.views);
  }

  // cfg: { trackId, laps, items, entries:[{car, color, human, humanIndex, aiLevel, name}] }
  startRace(cfg) {
    this.endRace();
    this.cfg = cfg;
    const def = TRACKS.find(t => t.id === cfg.trackId) || TRACKS[0];
    this.track = new Track(def);
    this.trackScene = buildTrackScene(this.track, this.scene, this.quality ? this.quality.level : 2);
    this.race = new Race(this.track, cfg.entries, { laps: cfg.laps, items: cfg.items });
    for (const r of this.race.racers) this.scene.add(r.car.model.root);
    const humans = this.race.racers.filter(r => r.human).sort((a, b) => a.humanIndex - b.humanIndex);
    this.input.setHumans(humans.length);
    this.rigs = humans.map((r, i) => {
      const rig = new CameraRig(i);
      rig.racer = r;
      rig.snap(r.car);
      this.scene.add(rig.camera);
      return rig;
    });
    this.effects.attach(this.race, this.rigs, def.theme);
    this.huds = humans.map(r => new PlayerHUD(this.hudLayer, this.track, r, { items: !!cfg.items }));
    this.emit('raceCreated', this.race);
    this.computeViews();
    this.state = 'race';
    this.paused = false;
    this.clock.getDelta();
  }

  endRace() {
    if (this.trackScene) this.trackScene.dispose();
    if (this.race) for (const r of this.race.racers) this.scene.remove(r.car.model.root);
    this.effects.detach();
    this.rigs.forEach(r => this.scene.remove(r.camera));
    this.huds.forEach(h => h.dispose());
    this.huds = []; this.rigs = []; this.race = null; this.trackScene = null;
    this.emit('raceEnded');
    this.state = 'idle';
  }

  frame() {
    let dt = this.clock.getDelta();
    if (dt > 0.05) dt = 0.05;
    this.emit('frame', dt);
    const inputs = this.input.poll();
    if (this.state === 'race' && this.race) {
      if (inputs.pausePressed) this.emit('pauseToggle');
      if (!this.paused) this.updateRace(dt, inputs);
      this.render();
    } else if (this.state === 'idle') {
      this.renderer.setViewport(0, 0, this.W, this.H);
      this.renderer.setScissor(0, 0, this.W, this.H);
      this.renderer.setClearColor(0x0b0618);
      this.renderer.clear();
    }
  }

  updateRace(dt, inputs) {
    const race = this.race;
    race.update(dt, inputs, this.ai, this.items);
    this.trackScene.update(dt, race.time);
    for (const rig of this.rigs) rig.update(dt, rig.racer.car);
    this.effects.update(dt);
    for (const h of this.huds) h.update(dt, race);
    this.emit('raceTick', dt);
    // eventos
    for (const e of race.events) {
      if (e.type === 'count') this.huds.forEach(h => h.flash(COUNT_TEXT[e.value], '', e.value === 0 ? 0.9 : 0.85, e.value === 0 ? 'go' : 'count'));
      if (e.type === 'lap') {
        const h = this.huds.find(h => h.racer === e.racer);
        if (h) h.flash(e.lap === race.laps ? '¡VUELTA FINAL!' : `VUELTA ${e.lap}`, e.racer.lapTimes.length ? 'Última: ' + fmt(e.racer.lapTimes[e.racer.lapTimes.length - 1]) : '', 1.6, 'lap');
      }
      if (e.type === 'finish') {
        const h = this.huds.find(h => h.racer === e.racer);
        if (h) h.flash(`¡META! ${e.racer.place}º`, '', 99, 'finish');
      }
      this.emit('raceEvent', e);
    }
    race.events.length = 0;
    for (const h of this.huds) {
      const c = h.racer.car;
      if (c.ev.miniTurbo) h.flash('¡MINI-TURBO!', '', 0.7, 'mini lvl' + c.ev.miniTurbo);
    }
  }

  // Depuración/pruebas: simula N segundos sin renderizar
  simulate(seconds, inputsFn) {
    const dt = 1 / 60;
    const t0 = performance.now();
    for (let t = 0; t < seconds; t += dt) {
      const ins = inputsFn ? inputsFn(this.race) : [];
      this.updateRace(dt, ins);
    }
    return (performance.now() - t0) / (seconds * 60); // ms por frame (CPU)
  }

  render() {
    const r = this.renderer;
    r.setViewport(0, 0, this.W, this.H);
    r.setScissor(0, 0, this.W, this.H);
    r.setClearColor(0x000000);
    r.clear();
    this.rigs.forEach((rig, i) => {
      const v = this.views[i];
      if (!v) return;
      const y = this.H - v.y - v.h; // WebGL: origen abajo
      r.setViewport(v.x, y, v.w, v.h);
      r.setScissor(v.x, y, v.w, v.h);
      // el cielo sigue a la cámara
      this.trackScene.group.children[0].position.copy(rig.camera.position);
      this.effects.setViewHeight(v.h);
      r.render(this.scene, rig.camera);
    });
  }
}

function fmt(t) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60), c = Math.floor((t * 100) % 100);
  return `${m}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
}
