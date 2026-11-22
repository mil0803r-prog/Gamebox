// =====================================================================
//  Voz de motor de un auto: simula RPM, caja de cambios, ralentí,
//  acelerones, limitador, punta-tacón y turbo (silbido + "pssh").
//  Usa el AudioWorklet si está disponible; si no, osciladores.
// =====================================================================

// carácter de motor por tipo de carrocería
export const ENGINE_PROFILES = {
  compact:   { cyl: 4,  idle: 950, red: 7000, tone: 1.25, gears: 5, turbo: false, vol: 0.8 },
  hatch:     { cyl: 4,  idle: 900, red: 7300, tone: 1.15, gears: 6, turbo: true,  vol: 0.85 },
  tuner:     { cyl: 6,  idle: 900, red: 8300, tone: 1.05, gears: 6, turbo: true,  vol: 0.9 },
  muscle:    { cyl: 8,  idle: 700, red: 6600, tone: 0.72, gears: 6, turbo: false, vol: 1.0 },
  truck:     { cyl: 8,  idle: 650, red: 5600, tone: 0.62, gears: 6, turbo: true,  vol: 1.0 },
  sedan:     { cyl: 6,  idle: 800, red: 7200, tone: 0.95, gears: 7, turbo: true,  vol: 0.85 },
  gt:        { cyl: 12, idle: 900, red: 8800, tone: 1.0,  gears: 7, turbo: false, vol: 0.95 },
  curvy:     { cyl: 8,  idle: 950, red: 9000, tone: 1.12, gears: 7, turbo: false, vol: 0.95 },
  wedge:     { cyl: 12, idle: 950, red: 8800, tone: 0.95, gears: 7, turbo: false, vol: 1.0 },
  hyper:     { cyl: 10, idle: 1000, red: 9200, tone: 1.1, gears: 7, turbo: true,  vol: 1.0 },
  speedster: { cyl: 12, idle: 900, red: 8800, tone: 1.02, gears: 7, turbo: false, vol: 0.95 },
  electric:  { ev: true, idle: 0, red: 16000, gears: 1, vol: 0.7 },
};

export class EngineVoice {
  constructor(ctx, dest, def, useWorklet, noiseBuf) {
    this.ctx = ctx;
    this.p = ENGINE_PROFILES[def.body] || ENGINE_PROFILES.curvy;
    this.def = def;
    this.rpm = this.p.idle || 0;
    this.gear = 0;
    this.shiftT = 0; this.limiterT = 0; this.spool = 0; this.prevLoad = 0;
    this.t = Math.random() * 10;
    // fracciones de la velocidad máxima donde termina cada marcha
    const G = this.p.gears;
    this.gearTop = Array.from({ length: G }, (_, i) => Math.pow((i + 1) / G, 0.78));
    this.out = ctx.createGain(); this.out.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000;
    lp.connect(this.out); this.out.connect(dest);
    this.lp = lp;
    this.worklet = null;
    if (useWorklet) {
      try {
        this.worklet = new AudioWorkletNode(ctx, 'engine-processor', {
          numberOfInputs: 0, outputChannelCount: [1],
          processorOptions: { cyl: this.p.cyl, tone: this.p.tone, ev: !!this.p.ev, seed: (Math.random() * 1e9) | 0 },
        });
        this.worklet.connect(lp);
        this.prm = { rpm: this.worklet.parameters.get('rpm'), load: this.worklet.parameters.get('load'), gain: this.worklet.parameters.get('gain') };
        this.prm.gain.value = 1;
      } catch { this.worklet = null; }
    }
    if (!this.worklet) {
      // respaldo: osciladores (menos realista)
      this.o1 = ctx.createOscillator(); this.o1.type = 'sawtooth';
      this.o2 = ctx.createOscillator(); this.o2.type = 'square';
      const g2 = ctx.createGain(); g2.gain.value = 0.4;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 4; this.f = f;
      this.o1.connect(f); this.o2.connect(g2); g2.connect(f); f.connect(lp);
      this.o1.start(); this.o2.start();
    }
    // turbo: silbido
    if (this.p.turbo) {
      this.whistle = ctx.createOscillator(); this.whistle.type = 'sine';
      this.whG = ctx.createGain(); this.whG.gain.value = 0;
      this.whistle.connect(this.whG); this.whG.connect(this.out);
      this.whistle.start();
    }
    this.noiseBuf = noiseBuf;
    this.dest = dest;
  }

  // dt, auto, acelerador del jugador (0..1), ¿carrera en marcha?, multiplicador de tono (Doppler)
  update(dt, car, throttle, racing, pitchMul = 1, gainMul = 1) {
    const p = this.p, t = this.ctx.currentTime;
    this.t += dt;
    const v = Math.abs(car.vf);
    const vTop = car.maxSpeed * 1.06;
    let load = throttle;
    if (car.boosting) load = Math.min(1.3, load + 0.3);
    let target;
    if (p.ev) {
      target = p.red * Math.min(1.2, v / vTop);
    } else {
      // ---- caja de cambios
      if (this.shiftT > 0) this.shiftT -= dt;
      const rpmIn = g => p.red * v / (vTop * this.gearTop[g]);
      if (this.shiftT <= 0) {
        if (this.gear < p.gears - 1 && rpmIn(this.gear) > p.red * 0.94 && throttle > 0.2) {
          this.gear++; this.shiftT = 0.16;                       // subir: corte de aceleración
        } else if (this.gear > 0 && rpmIn(this.gear) < p.red * 0.42) {
          this.gear--; this.shiftT = 0.08;
          if (throttle < 0.2 && v > 8) this.blipT = 0.12;        // punta-tacón al rebajar frenando
        }
      }
      if (v < 1 && racing) this.gear = 0;
      const wheel = rpmIn(this.gear);
      if (car.airborne) target = p.idle + throttle * (p.red * 0.9 - p.idle);      // en el aire: revoluciona libre
      else if (this.gear === 0 && v < vTop * this.gearTop[0] * 0.55) {
        target = Math.max(wheel, p.idle + throttle * p.red * (racing ? 0.55 : 0.62)); // embrague patinando / acelerones
      } else target = Math.max(p.idle, wheel);
      if (car.drifting) target *= 1.08;                                            // patinan las ruedas
      if (this.blipT > 0) { this.blipT -= dt; target += p.red * 0.18; load = 0.6; }
      if (this.shiftT > 0) load = 0;
      // limitador de revoluciones
      if (target >= p.red * 0.985 && throttle > 0.3) {
        this.limiterT -= dt;
        if (this.limiterT <= 0) { this.limiterT = 0.07; this.rpm = p.red * 0.94; load = 0; }
      }
      target = Math.min(target, p.red);
      // ralentí con su temblor natural
      target += Math.sin(this.t * 2.3) * 12 + Math.sin(this.t * 7.1) * 6;
    }
    const rising = target > this.rpm;
    this.rpm += (target - this.rpm) * Math.min(1, dt * (rising ? (this.shiftT > 0 ? 14 : 5.5 + throttle * 3) : 7));

    // ---- volumen: más fuerte con carga y revoluciones
    const rr = this.rpm / p.red;
    const gain = p.vol * (0.42 + 0.5 * Math.min(1, load) + 0.25 * rr) * gainMul;
    this.out.gain.setTargetAtTime(gain * 0.3, t, 0.03);
    this.lp.frequency.setTargetAtTime(2500 + rr * 6000 + load * 1500, t, 0.05);
    const rpmOut = this.rpm * pitchMul;
    if (this.worklet) {
      this.prm.rpm.setTargetAtTime(rpmOut, t, 0.015);
      this.prm.load.setTargetAtTime(load, t, 0.02);
    } else {
      const fire = rpmOut / 60 * ((p.cyl || 8) / 2);
      this.o1.frequency.setTargetAtTime(Math.max(20, fire), t, 0.02);
      this.o2.frequency.setTargetAtTime(Math.max(10, fire / 2), t, 0.02);
      this.f.frequency.setTargetAtTime(300 + rr * 1800 + load * 600, t, 0.04);
    }
    // ---- turbo: el silbido sube con la carga; "pssh" al soltar el acelerador
    if (this.whistle) {
      this.spool += ((load > 0.5 ? rr : 0) - this.spool) * Math.min(1, dt * (load > 0.5 ? 1.5 : 4));
      this.whistle.frequency.setTargetAtTime(1600 + this.spool * 3200, t, 0.05);
      this.whG.gain.setTargetAtTime(this.spool * 0.05 * gainMul, t, 0.05);
      if (this.prevLoad > 0.6 && load < 0.1 && this.spool > 0.35) this.blowOff(gainMul);
    }
    this.prevLoad = load;
  }

  blowOff(gm) {
    const ctx = this.ctx, t = ctx.currentTime;
    const n = ctx.createBufferSource(); n.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.8;
    f.frequency.setValueAtTime(3800, t); f.frequency.exponentialRampToValueAtTime(1400, t + 0.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18 * gm, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    n.connect(f); f.connect(g); g.connect(this.dest);
    n.start(t, Math.random()); n.stop(t + 0.5);
  }

  stop() {
    try { this.worklet && this.worklet.disconnect(); } catch { /* */ }
    for (const o of [this.o1, this.o2, this.whistle]) if (o) { try { o.stop(); } catch { /* */ } }
    this.out.disconnect();
  }
}
