import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Track } from '../tracks/Track.js';
import { TRACKS } from '../tracks/trackData.js';
import { buildTrackScene } from '../tracks/TrackBuilder.js';
import { CARS } from '../cars/carData.js';
import { Race } from './Race.js';
import { CameraRig, CAM_NAMES } from './CameraRig.js';
import { DemoCamera } from './DemoCamera.js';
import { Effects } from './Effects.js';
import { AISystem } from './AI.js';
import { Items } from './Items.js';
import { Pickups } from './Pickups.js';
import { Traffic } from './Traffic.js';
import { Quality } from './Quality.js';
import { Settings } from './Storage.js';
import { splitMode, computeViews } from './Viewports.js';
import { handleRaceEvents } from './RaceFeedback.js';
import { InputManager } from '../input/Input.js';
import { TouchControls } from '../input/Touch.js';
import { AudioSys } from '../audio/Audio.js';
import { PlayerHUD } from '../ui/hud/HUD.js';
import { applyEnvironment } from '../cars/envMap.js';

// Núcleo del juego: renderer, bucle principal y ciclo de vida de la carrera
export class Game {
  constructor(container) {
    this.container = container;
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.renderer = new THREE.WebGLRenderer({ antialias: !this.isTouch, powerPreference: 'high-performance' });
    this.renderer.setScissorTest(true);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    applyEnvironment(this.renderer, this.scene, 1);

    this.input = new InputManager();
    this.touch = new TouchControls(document.getElementById('touch'), this.input);
    this.effects = new Effects(this.scene, 2);
    this.ai = new AISystem();
    this.audio = new AudioSys(Settings.data);
    this.items = null;

    this.hudLayer = document.getElementById('hud');
    this.hudLayer.classList.toggle('touch', this.isTouch);
    this.settings = { split: Settings.data.split, laps: CONFIG.race.laps };
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, this.isTouch ? 1.5 : 2);
    this.state = 'idle';
    this.views = []; this.huds = []; this.rigs = [];
    this.clock = new THREE.Clock();
    this.listeners = {};

    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 200));
    this.resize();
    this.quality = new Quality(this, Settings.data.quality);
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // ------------------------------------------------------------ eventos simples
  on(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  emit(ev, data) { (this.listeners[ev] || []).forEach(f => f(data)); }

  // ------------------------------------------------------------ pantalla
  // pr = resolución elegida por la calidad; la carrera de fondo de los menús usa menos (va oscurecida)
  setPixelRatio(pr) {
    this.pixelRatio = pr;
    this.applyPixelRatio();
  }
  applyPixelRatio() {
    const pr = this.cfg && this.cfg.demo ? Math.min(this.pixelRatio, 0.75) : this.pixelRatio;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  resize() {
    this.W = window.innerWidth; this.H = window.innerHeight;
    if (this.renderer) this.applyPixelRatio();
    this.computeViews();
  }

  splitMode() { return splitMode(this.settings.split, this.W, this.H, this.isTouch); }

  computeViews() {
    this.views = computeViews(this.rigs.length || 1, this.splitMode(), this.W, this.H);
    this.huds.forEach((h, i) => this.views[i] && h.layout(this.views[i]));
    this.rigs.forEach((r, i) => {
      const v = this.views[i];
      if (v) { r.camera.aspect = v.w / v.h; r.camera.updateProjectionMatrix(); }
    });
    if (this.touch.enabled) this.touch.layout(this.views);
    this.emit('layout', this.views);
  }

  get isDemo() { return !!(this.race && this.cfg && this.cfg.demo); }

  // ------------------------------------------------------------ carrera
  // cfg: { trackId, laps, items, autoAccel, demo, entries:[{car, color, human, humanIndex, aiLevel, name}] }
  startRace(cfg) {
    this.endRace();
    this.cfg = cfg;
    const def = TRACKS.find(t => t.id === cfg.trackId) || TRACKS[0];
    this.track = new Track(def);
    this.trackScene = buildTrackScene(this.track, this.scene, this.quality ? this.quality.level : 2);
    this.captureEnvironment(def.theme); // reflejos reales del escenario en la pintura
    this.race = new Race(this.track, cfg.entries, { laps: cfg.laps, items: cfg.items });
    for (const r of this.race.racers) this.scene.add(r.car.model.root);
    // sombras reales (solo con calidad media o alta)
    this.shadows = this.quality.level >= 1 && !cfg.demo;
    this.renderer.shadowMap.enabled = this.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.trackScene.sun.castShadow = this.shadows;
    if (this.shadows) for (const r of this.race.racers) r.car.model.root.traverse(o => {
      if (o.isMesh && !o.material.transparent && o.material.type !== 'ShaderMaterial' && o.material.type !== 'MeshBasicMaterial') o.castShadow = true;
    });
    if (cfg.items) { this.items = new Items(this.scene, this.track); this.race.items = this.items; }
    this.pickups = cfg.pickups !== false ? new Pickups(this.scene, this.track) : null;
    this.traffic = def.traffic ? new Traffic(this.scene, this.track) : null;
    this.race.traffic = this.traffic;

    const humans = this.race.racers.filter(r => r.human).sort((a, b) => a.humanIndex - b.humanIndex);
    this.input.setHumans(Math.max(1, humans.length));
    if (cfg.demo) {
      this.race.time = 0; this.race.state = 'racing';
      this.rigs = [new DemoCamera(this.race)];
    } else {
      this.rigs = humans.map((r, i) => {
        const rig = new CameraRig(i);
        rig.mode = ['interior', 'near', 'far', 'vfar'].includes(Settings.data.camera) ? Settings.data.camera : 'near';
        rig.racer = r;
        rig.snap(r.car);
        return rig;
      });
    }
    this.rigs.forEach(r => this.scene.add(r.camera));
    this.effects.attach(this.race, this.rigs, def.theme);
    this.huds = humans.map(r => new PlayerHUD(this.hudLayer, this.track, r, { items: !!cfg.items, isTouch: this.isTouch, humans: humans.length }));
    this.huds.forEach((h, i) => this.rigs[i] && h.setInterior(this.rigs[i].mode === 'interior'));
    this.computeViews();
    if (!cfg.demo) {
      const tilt = this.input.tilt;
      tilt.enabled = this.isTouch && cfg.steerMode === 'tilt' && humans.length === 1;
      tilt.sens = Settings.data.tiltSens; tilt.invert = Settings.data.tiltInvert;
      if (tilt.enabled) { tilt.listen(); tilt.calibrate(); this.touch.onCenter = () => tilt.calibrate(); }
      if (this.isTouch) this.touch.build(this.views, { autoAccel: cfg.autoAccel !== false, items: !!cfg.items, tilt: tilt.enabled });
      this.audio.attach(this.race, this.rigs, this.splitMode() === 'cols');
    }
    this.applyPixelRatio();
    this.emit('raceCreated', this.race);
    this.state = 'race';
    this.paused = false;
    this.clock.getDelta();
  }

  // Genera un mapa de reflejos desde un punto de la pista (cielo, edificios, luces, terreno)
  captureEnvironment(theme) {
    const p = this.track.main.pointAt(this.track.length * 0.5);
    const y = p.y + 4;
    const g = this.trackScene.group;
    g.position.set(-p.x, -y, -p.z);
    this.trackScene.sky.position.set(p.x, y, p.z);
    g.updateMatrixWorld(true);
    const r = this.renderer;
    r.setScissorTest(false);
    const pm = new THREE.PMREMGenerator(r);
    const rt = pm.fromScene(this.scene, 0.02, 0.5, 1500);
    pm.dispose();
    r.setScissorTest(true);
    g.position.set(0, 0, 0);
    g.updateMatrixWorld(true);
    if (this.envRT) this.envRT.dispose();
    this.envRT = rt;
    this.scene.environment = rt.texture;
    this.scene.environmentIntensity = { city: 1.6, desert: 1.0, snow: 0.95, coast: 1.0 }[theme] ?? 1;
  }

  // Carrera de demostración (solo IA) que se ve detrás de los menús
  startDemo() {
    const t = TRACKS[Math.floor(Math.random() * TRACKS.length)];
    const pool = CARS.filter(c => c.cls === 'A' || c.cls === 'S').sort(() => Math.random() - 0.5).slice(0, 4);
    this.startRace({
      demo: true, trackId: t.id, laps: 99, items: false,
      entries: pool.map(car => ({ car, color: car.color, human: false, aiLevel: 2, name: car.name })),
    });
  }

  endRace() {
    if (this.trackScene) this.trackScene.dispose();
    if (this.items) { this.items.dispose(); this.items = null; }
    if (this.pickups) { this.pickups.dispose(); this.pickups = null; }
    if (this.traffic) { this.traffic.dispose(); this.traffic = null; }
    if (this.race) for (const r of this.race.racers) this.scene.remove(r.car.model.root);
    this.effects.detach();
    this.touch.clear();
    this.input.tilt.enabled = false;
    this.audio.detach();
    this.rigs.forEach(r => this.scene.remove(r.camera));
    this.huds.forEach(h => h.dispose());
    this.huds = []; this.rigs = []; this.race = null; this.trackScene = null; this.cfg = null;
    this.emit('raceEnded');
    this.state = 'idle';
  }

  // ------------------------------------------------------------ bucle
  frame() {
    let dt = this.clock.getDelta();
    if (this.state === 'race' && !this.paused && !this.isDemo) this.quality.sample(dt);
    if (dt > 0.05) dt = 0.05;
    this.emit('frame', dt);
    const inputs = this.input.poll();
    if (this.state === 'race' && this.race) {
      if (inputs.pausePressed && !this.isDemo) this.emit('pauseToggle');
      if (!this.paused) this.updateRace(dt, inputs);
      this.render();
    } else {
      this.renderer.setViewport(0, 0, this.W, this.H);
      this.renderer.setScissor(0, 0, this.W, this.H);
      this.renderer.setClearColor(0x0b0618);
      this.renderer.clear();
    }
  }

  updateRace(dt, inputs) {
    const race = this.race;
    race.update(dt, inputs, this.ai, this.items, this.pickups);
    this.trackScene.update(dt, race.time);
    // cambio de cámara (tecla C / "/" , botón Select del mando o botón táctil)
    this.rigs.forEach((rig, i) => {
      if (inputs[i] && inputs[i].camPressed && rig.cycle) {
        const mode = rig.cycle();
        const h = this.huds[i];
        if (h) { h.flash('CÁMARA ' + CAM_NAMES[mode], '', 0.8, 'cam'); h.setInterior(mode === 'interior'); }
      }
    });
    for (const rig of this.rigs) rig.update(dt, rig.racer.car);
    this.effects.update(dt);
    if (this.shadows && this.rigs[0]) {
      const c = this.rigs[0].racer.car, sun = this.trackScene.sun, d = this.trackScene.sunDir;
      const ax = Math.sin(c.heading) * 6, az = Math.cos(c.heading) * 6; // un poco adelante del auto
      sun.target.position.set(c.x + ax, c.y, c.z + az);
      sun.position.set(c.x + ax + d.x * 60, c.y + Math.max(25, d.y * 60), c.z + az + d.z * 60);
      sun.target.updateMatrixWorld();
    }
    if (this.isDemo) { race.events.length = 0; return; }
    this.audio.update(dt, race);
    for (const h of this.huds) h.update(dt, race, this.input.kb);
    this.emit('raceTick', dt);
    handleRaceEvents(this, race);
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
      this.trackScene.sky.position.copy(rig.camera.position); // el cielo sigue a la cámara
      this.effects.setViewHeight(v.h);
      r.render(this.scene, rig.camera);
    });
  }

  applySettings(s) {
    this.settings.split = s.split;
    this.computeViews();
    this.quality.setMode(s.quality);
    this.audio.applySettings();
  }

  // Depuración/pruebas: simula N segundos sin renderizar; devuelve ms de CPU por frame
  simulate(seconds, inputsFn) {
    const dt = 1 / 60;
    const t0 = performance.now();
    for (let t = 0; t < seconds; t += dt) this.updateRace(dt, inputsFn ? inputsFn(this.race) : []);
    return (performance.now() - t0) / (seconds * 60);
  }
}
