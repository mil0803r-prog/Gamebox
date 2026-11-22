import { Music } from './Music.js';
import { ENGINE_PROCESSOR } from './engineWorklet.js';
import { EngineVoice } from './Engine.js';

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
    if (this.rival) this.rival.out.gain.setTargetAtTime(p ? 0 : 1, this.ctx.currentTime, 0.05);
  }

  music(name) {
    this.pendingMusic = name;
    if (this.music_) this.music_.play(name);
  }

  // ---------------------------------------------------------------- motores
  // carga el procesador del motor (AudioWorklet) desde texto; si falla se usan osciladores
  loadWorklet() {
    if (this.workletPromise) return this.workletPromise;
    this.workletPromise = (async () => {
      try {
        if (!this.ctx.audioWorklet) return false;
        const url = URL.createObjectURL(new Blob([ENGINE_PROCESSOR], { type: 'application/javascript' }));
        await this.ctx.audioWorklet.addModule(url);
        this.workletOk = true;
      } catch { this.workletOk = false; }
      return this.workletOk;
    })();
    return this.workletPromise;
  }

  async attach(race, rigs, cols) {
    this.detach();
    this.pendingRace = race; this.pendingRigs = rigs; this.pendingCols = cols;
    if (!this.ctx) return;
    await this.loadWorklet();
    if (this.pendingRace !== race) return; // la carrera cambió mientras cargaba
    const ctx = this.ctx;
    rigs.forEach((rig, i) => {
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (pan) pan.pan.value = rigs.length === 1 ? 0 : (i === 0 ? -1 : 1) * (cols ? 0.6 : 0.25);
      const out = ctx.createGain(); out.gain.value = 1;
      if (pan) { out.connect(pan); pan.connect(this.sfxGain); } else out.connect(this.sfxGain);
      const engine = new EngineVoice(ctx, out, rig.racer.carDef, this.workletOk, this.noiseBuf);
      // chirrido de llantas: ruido con filtro resonante (más tonal que antes)
      const dn = this.loopNoise(), df = ctx.createBiquadFilter(), df2 = ctx.createBiquadFilter(), dg = ctx.createGain();
      df.type = 'bandpass'; df.frequency.value = 1100; df.Q.value = 7;
      df2.type = 'bandpass'; df2.frequency.value = 2300; df2.Q.value = 5;
      dg.gain.value = 0;
      dn.connect(df); dn.connect(df2); df.connect(dg); df2.connect(dg); dg.connect(out);
      // turbo/nitro: soplido grave
      const bn = this.loopNoise(), bf = ctx.createBiquadFilter(), bg = ctx.createGain();
      bf.type = 'lowpass'; bf.frequency.value = 500; bg.gain.value = 0;
      bn.connect(bf); bf.connect(bg); bg.connect(out);
      // viento: sube con la velocidad (y con el rebufo)
      const wn = this.loopNoise(), wf = ctx.createBiquadFilter(), wg = ctx.createGain();
      wf.type = 'bandpass'; wf.frequency.value = 900; wf.Q.value = 0.5; wg.gain.value = 0;
      wn.connect(wf); wf.connect(wg); wg.connect(out);
      // rodadura: ruido grave del asfalto
      const rn = this.loopNoise(), rf = ctx.createBiquadFilter(), rg = ctx.createGain();
      rf.type = 'lowpass'; rf.frequency.value = 180; rg.gain.value = 0;
      rn.connect(rf); rf.connect(rg); rg.connect(out);
      this.engines.push({ rig, engine, out, pan, dn, df, df2, dg, bn, bf, bg, wn, wf, wg, rg, srcs: [dn, bn, wn, rn] });
    });
    // 1 jugador: el rival más cercano también suena (con efecto Doppler)
    if (rigs.length === 1 && race.racers.length > 1) {
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      const out = ctx.createGain();
      if (pan) { out.connect(pan); pan.connect(this.sfxGain); } else out.connect(this.sfxGain);
      this.rival = { pan, out, voice: null, racer: null, pick: 0 };
    }
  }

  loopNoise() {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf; s.loop = true;
    s.start(0, Math.random() * 1.5);
    return s;
  }

  detach() {
    for (const e of this.engines) {
      e.engine.stop();
      e.srcs.forEach(s => { try { s.stop(); } catch { /* ya detenido */ } });
      e.out.disconnect();
    }
    this.engines = [];
    if (this.rival) { if (this.rival.voice) this.rival.voice.stop(); this.rival.out.disconnect(); this.rival = null; }
    this.pendingRace = null;
  }

  update(dt, race, inputs) {
    if (!this.ctx || this.paused) return;
    const t = this.ctx.currentTime;
    const racing = race.state !== 'countdown';
    for (const e of this.engines) {
      const r = e.rig.racer, c = r.car;
      // en la cuenta regresiva el auto no se mueve, pero el motor responde al acelerador (acelerones)
      const inp = inputs && inputs[r.humanIndex];
      const throttle = racing ? (r.finished ? 0.6 : c.throttleIn || 0) : (inp ? inp.throttle : 0);
      e.engine.update(dt, c, throttle, racing);
      const v = c.speed;
      const ground = !c.airborne;
      const slide = ground ? Math.min(1, Math.max(0, (Math.abs(c.vr) - 3) / 10)) : 0;
      const sq = ground && v > 5 ? (c.drifting ? 0.12 : 0) + slide * 0.1 : 0;
      e.dg.gain.setTargetAtTime(sq, t, 0.04);
      const lvl = c.driftCharge ? c.driftLevel : 0;
      e.df.frequency.setTargetAtTime(1000 + lvl * 160 + Math.sin(t * 13) * 40, t, 0.05);
      e.bg.gain.setTargetAtTime(c.boosting ? 0.2 : 0, t, 0.06);
      e.bf.frequency.setTargetAtTime(c.usingTurbo ? 900 : 600, t, 0.1);
      const sp = Math.min(1.4, v / 55);
      e.wg.gain.setTargetAtTime(sp * sp * 0.07 + (c.slipTime > 0.3 ? 0.05 : 0), t, 0.2);
      e.wf.frequency.setTargetAtTime(500 + sp * 1200, t, 0.2);
      e.rg.gain.setTargetAtTime(ground ? Math.min(1, v / 30) * 0.12 : 0, t, 0.1);
      // eventos de un frame
      const pan = e.pan ? e.pan.pan.value : 0;
      if (c.ev.wall > 3) this.crash(Math.min(1, c.ev.wall / 25), pan);
      if (c.ev.bump > 4) this.crash(Math.min(0.8, c.ev.bump / 20), pan, 900);
      if (c.ev.land > 6) this.thud(Math.min(1, c.ev.land / 15), pan);
      if (c.ev.miniTurbo) this.whoosh(0.25 + c.ev.miniTurbo * 0.1, 1 + c.ev.miniTurbo * 0.25, pan);
      if (c.ev.pad) this.whoosh(0.35, 1.6, pan);
      if (c.usingTurbo && !e.wasTurbo) this.whoosh(0.4, 0.8, pan);
      if (c.ev.backfire) this.pop(pan);
      e.wasTurbo = c.usingTurbo;
    }
    // rival cercano
    const rv = this.rival;
    if (rv && this.engines[0]) {
      const me = this.engines[0].rig.racer.car;
      rv.pick -= dt;
      if (rv.pick <= 0) {
        rv.pick = 0.6;
        let best = null, bd = 70;
        for (const o of race.racers) {
          if (o.human) continue;
          const d = Math.hypot(o.car.x - me.x, o.car.z - me.z);
          if (d < bd) { bd = d; best = o; }
        }
        if (best !== rv.racer) {
          if (rv.voice) rv.voice.stop();
          rv.racer = best;
          rv.voice = best ? new EngineVoice(this.ctx, rv.out, best.carDef, this.workletOk, this.noiseBuf) : null;
        }
      }
      if (rv.voice && rv.racer) {
        const c = rv.racer.car;
        const dx = c.x - me.x, dz = c.z - me.z;
        const d = Math.hypot(dx, dz) || 1;
        // Doppler: velocidad relativa en la dirección que los une (exagerado un poco)
        const rel = ((c.vx - me.vx) * dx + (c.vz - me.vz) * dz) / d;
        const doppler = Math.max(0.75, Math.min(1.3, 1 - rel / 340 * 3));
        const gm = Math.min(1, 7 / (d + 3));
        rv.voice.update(dt, c, racing ? 0.85 : 0.1, racing, doppler, gm * 0.8);
        if (rv.pan) {
          const side = -dx * Math.cos(me.heading) + dz * Math.sin(me.heading);
          rv.pan.pan.setTargetAtTime(Math.max(-0.9, Math.min(0.9, -side / (d + 2))), t, 0.05);
        }
      }
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
  // petardeo del escape: dos golpes secos
  pop(pan = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const d of [0, 0.07]) {
      const n = this.noise(t + d, 0.08);
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
      n.connect(f);
      this.out(this.env(f, t + d, 0.5, 0.07), pan);
    }
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
