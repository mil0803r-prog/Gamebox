import { Music } from './Music.js';
import { CONFIG } from '../config.js';

// Todo el sonido se genera con Web Audio API (sin archivos)
export class AudioSys {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.engines = [];
    this.pendingMusic = 'menu';
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend(); else if (!this.paused) this.ctx.resume();
    });
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended' && !document.hidden) this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(ctx.destination);
    this.musicGain = ctx.createGain(); this.musicGain.connect(this.master);
    this.sfxGain = ctx.createGain(); this.sfxGain.connect(this.master);
    this.noiseBuf = this.makeNoise(2);
    this.music_ = new Music(ctx, this.musicGain);
    this.applySettings();
    if (this.pendingMusic) this.music(this.pendingMusic);
    if (this.pendingRace) this.attach(this.pendingRace, this.pendingRigs, this.pendingCols);
  }

  makeNoise(sec) {
    const b = this.ctx.createBuffer(1, this.ctx.sampleRate * sec, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  applySettings() {
    if (!this.ctx) return;
    const s = this.settings;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.muted ? 0 : 0.9, t, 0.05);
    this.musicGain.gain.setTargetAtTime(s.music ? (this.paused ? 0.15 : 0.35) : 0, t, 0.1);
    this.sfxGain.gain.setTargetAtTime(s.sfx ? 1 : 0, t, 0.05);
  }
  setMuted(m) { this.settings.muted = m; this.applySettings(); }
  setPaused(p) {
    this.paused = p;
    this.applySettings();
    for (const e of this.engines) e.out.gain.setTargetAtTime(p ? 0 : 1, this.ctx.currentTime, 0.05);
  }

  music(name) {
    this.pendingMusic = name;
    if (this.music_) this.music_.play(name);
  }

  // ---------------------------------------------------------------- motores
  attach(race, rigs, cols) {
    this.detach();
    this.pendingRace = race; this.pendingRigs = rigs; this.pendingCols = cols;
    if (!this.ctx) return;
    const ctx = this.ctx;
    rigs.forEach((rig, i) => {
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (pan) pan.pan.value = rigs.length === 1 ? 0 : (i === 0 ? -1 : 1) * (cols ? 0.6 : 0.25);
      const out = ctx.createGain(); out.gain.value = 1;
      if (pan) { out.connect(pan); pan.connect(this.sfxGain); } else out.connect(this.sfxGain);
      const vol = rigs.length === 1 ? 0.22 : 0.16;
      // motor: dos osciladores + filtro
      const o1 = ctx.createOscillator(); o1.type = 'sawtooth';
      const o2 = ctx.createOscillator(); o2.type = 'square';
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 3;
      const g = ctx.createGain(); g.gain.value = 0;
      const g2 = ctx.createGain(); g2.gain.value = 0.5;
      o1.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(out);
      o1.start(); o2.start();
      // derrape (ruido)
      const dn = this.loopNoise(), df = ctx.createBiquadFilter(), dg = ctx.createGain();
      df.type = 'bandpass'; df.frequency.value = 1400; df.Q.value = 1.4; dg.gain.value = 0;
      dn.connect(df); df.connect(dg); dg.connect(out);
      // turbo (ruido grave)
      const bn = this.loopNoise(), bf = ctx.createBiquadFilter(), bg = ctx.createGain();
      bf.type = 'lowpass'; bf.frequency.value = 500; bg.gain.value = 0;
      bn.connect(bf); bf.connect(bg); bg.connect(out);
      // viento (rebufo)
      const wn = this.loopNoise(), wf = ctx.createBiquadFilter(), wg = ctx.createGain();
      wf.type = 'highpass'; wf.frequency.value = 2500; wg.gain.value = 0;
      wn.connect(wf); wf.connect(wg); wg.connect(out);
      this.engines.push({ rig, o1, o2, f, g, vol, out, pan, dn, df, dg, bn, bf, bg, wn, wf, wg, srcs: [o1, o2, dn, bn, wn] });
    });
  }

  loopNoise() {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf; s.loop = true;
    s.start(0, Math.random() * 1.5);
    return s;
  }

  detach() {
    for (const e of this.engines) {
      e.srcs.forEach(s => { try { s.stop(); } catch { /* ya detenido */ } });
      e.out.disconnect();
    }
    this.engines = [];
    this.pendingRace = null;
  }

  update(dt, race) {
    if (!this.ctx || this.paused) return;
    const t = this.ctx.currentTime;
    const vmax = CONFIG.handling.maxSpeed;
    for (const e of this.engines) {
      const c = e.rig.racer.car;
      const v = Math.abs(c.vf);
      // marchas simuladas
      const ratio = Math.min(1.4, v / vmax);
      const gears = [0, 0.18, 0.36, 0.56, 0.78, 1.0, 2];
      let g = 0; while (ratio > gears[g + 1]) g++;
      const frac = (ratio - gears[g]) / (gears[g + 1] - gears[g]);
      const rpm = 0.3 + Math.min(1.2, frac) * 0.7;
      const base = 45 + rpm * 110 + g * 6 + (c.airborne ? 25 : 0);
      e.o1.frequency.setTargetAtTime(base, t, 0.04);
      e.o2.frequency.setTargetAtTime(base * 0.5, t, 0.04);
      e.f.frequency.setTargetAtTime(400 + rpm * 1400 + (c.boosting ? 900 : 0), t, 0.05);
      const load = race.state === 'countdown' ? 0.55 : 0.7 + 0.3 * Math.min(1, v / 20);
      e.g.gain.setTargetAtTime(e.vol * load, t, 0.05);
      const drifting = c.drifting && !c.airborne;
      e.dg.gain.setTargetAtTime(drifting ? 0.11 : (Math.abs(c.vr) > 6 && !c.airborne ? 0.05 : 0), t, 0.04);
      e.df.frequency.setTargetAtTime(1200 + (c.driftCharge ? c.driftLevel : 0) * 450, t, 0.05);
      e.bg.gain.setTargetAtTime(c.boosting ? 0.22 : 0, t, 0.06);
      e.bf.frequency.setTargetAtTime(c.usingTurbo ? 900 : 600, t, 0.1);
      e.wg.gain.setTargetAtTime(c.slipTime > 0.3 ? 0.06 : 0, t, 0.2);
      // eventos de un frame
      const pan = e.pan ? e.pan.pan.value : 0;
      if (c.ev.wall > 3) this.crash(Math.min(1, c.ev.wall / 25), pan);
      if (c.ev.bump > 4) this.crash(Math.min(0.8, c.ev.bump / 20), pan, 900);
      if (c.ev.land > 6) this.thud(Math.min(1, c.ev.land / 15), pan);
      if (c.ev.miniTurbo) this.whoosh(0.25 + c.ev.miniTurbo * 0.1, 1 + c.ev.miniTurbo * 0.25, pan);
      if (c.ev.pad) this.whoosh(0.35, 1.6, pan);
      if (c.usingTurbo && !e.wasTurbo) this.whoosh(0.4, 0.8, pan);
      e.wasTurbo = c.usingTurbo;
    }
  }

  // ---------------------------------------------------------------- efectos
  env(node, t, vol, dur) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    node.connect(g);
    return g;
  }
  out(node, pan = 0) {
    if (this.ctx.createStereoPanner && pan) {
      const p = this.ctx.createStereoPanner(); p.pan.value = pan; node.connect(p); p.connect(this.sfxGain);
    } else node.connect(this.sfxGain);
  }
  noise(t, dur) {
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
    return s;
  }
  osc(type, f, t, dur) {
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = f;
    o.start(t); o.stop(t + dur + 0.05);
    return o;
  }

  crash(strength, pan = 0, freq = 600) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const n = this.noise(t, 0.35);
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq + strength * 1500;
    n.connect(f);
    this.out(this.env(f, t, 0.5 * strength + 0.1, 0.3), pan);
    const o = this.osc('square', 90, t, 0.15);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    this.out(this.env(o, t, 0.15 * strength, 0.15), pan);
  }
  thud(strength, pan = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.osc('sine', 110, t, 0.25);
    o.frequency.exponentialRampToValueAtTime(35, t + 0.25);
    this.out(this.env(o, t, 0.4 * strength, 0.25), pan);
  }
  whoosh(vol, pitch, pan = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const n = this.noise(t, 0.7);
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(300 * pitch, t);
    f.frequency.exponentialRampToValueAtTime(2500 * pitch, t + 0.5);
    n.connect(f);
    this.out(this.env(f, t, vol, 0.6), pan);
  }
  beep(freq, dur = 0.18, vol = 0.25, type = 'square') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.osc(type, freq, t, dur);
    this.out(this.env(o, t, vol, dur));
  }
  ui() { this.beep(880, 0.06, 0.12, 'triangle'); }
  count(v) { if (v > 0) this.beep(440, 0.25, 0.3); else this.beep(880, 0.6, 0.35); }
  lap(final) {
    if (!this.ctx) return;
    [0, 0.1, 0.2].forEach((d, i) => setTimeout(() => this.beep([660, 880, final ? 1320 : 990][i], 0.15, 0.2, 'triangle'), d * 1000));
  }
  fanfare() {
    if (!this.ctx) return;
    [523, 659, 784, 1046, 784, 1046].forEach((f, i) => setTimeout(() => this.beep(f, i === 5 ? 0.6 : 0.16, 0.22, 'triangle'), i * 140));
  }
  coin() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [1320, 1980].forEach((f, i) => { const o = this.osc('square', f, t + i * 0.055, 0.09); this.out(this.env(o, t + i * 0.055, 0.09, 0.09)); });
  }
  chest(kind) {
    if (!this.ctx) return;
    const notes = kind === 'jackpot' ? [523, 659, 784, 1046, 1318, 1568] : [659, 880, 1175];
    notes.forEach((f, i) => setTimeout(() => this.beep(f, 0.14, 0.2, 'triangle'), i * 90));
  }
  item(kind) {
    if (!this.ctx) return;
    if (kind === 'get') [700, 900, 1200].forEach((f, i) => setTimeout(() => this.beep(f, 0.08, 0.15, 'triangle'), i * 60));
    if (kind === 'oil') this.crash(0.4, 0, 300);
    if (kind === 'shield') this.beep(300, 0.4, 0.2, 'sine');
  }
}
