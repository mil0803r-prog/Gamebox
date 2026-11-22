// Música procedural con Web Audio: bajo, arpegio, acordes y batería sintetizados
const SONGS = {
  menu:    { bpm: 108, prog: [[57, 'm'], [53, 'M'], [48, 'M'], [55, 'M']], lead: 'triangle', drums: 'soft' },
  city:    { bpm: 124, prog: [[57, 'm'], [53, 'M'], [48, 'M'], [55, 'M']], lead: 'sawtooth', drums: 'four' },
  desert:  { bpm: 132, prog: [[52, 'm'], [48, 'M'], [50, 'M'], [47, 'm']], lead: 'square', drums: 'break' },
  snow:    { bpm: 128, prog: [[48, 'M'], [55, 'M'], [57, 'm'], [53, 'M']], lead: 'triangle', drums: 'four' },
  results: { bpm: 100, prog: [[48, 'M'], [53, 'M'], [55, 'M'], [48, 'M']], lead: 'triangle', drums: 'soft' },
};
const ARP = [0, 1, 2, 1, 0, 2, 1, 2, 0, 1, 2, 3, 2, 1, 2, 1];
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

export class Music {
  constructor(ctx, out) {
    this.ctx = ctx;
    this.out = out;
    this.song = null;
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
    this.noise = this.makeNoise();
  }

  makeNoise() {
    const b = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.5, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  play(name) {
    const song = SONGS[name] || SONGS.menu;
    if (this.song === song) return;
    this.song = song;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    if (!this.timer) this.timer = setInterval(() => this.schedule(), 40);
  }

  stop() { clearInterval(this.timer); this.timer = null; this.song = null; }

  schedule() {
    if (!this.song || this.ctx.state !== 'running') return;
    const spb = 60 / this.song.bpm / 4; // semicorchea
    while (this.nextTime < this.ctx.currentTime + 0.15) {
      this.playStep(this.step, this.nextTime, spb);
      this.nextTime += spb;
      this.step = (this.step + 1) % 64;
    }
  }

  chordNotes(root, q) { return q === 'm' ? [root, root + 3, root + 7, root + 12] : [root, root + 4, root + 7, root + 12]; }

  playStep(step, t, spb) {
    const s = this.song;
    const bar = Math.floor(step / 16) % s.prog.length;
    const st = step % 16;
    const [root, q] = s.prog[bar];
    const notes = this.chordNotes(root, q);
    // bajo
    if (st % 2 === 0) this.tone(mtof(root - 24 + (st % 8 === 6 ? 12 : 0)), t, spb * 1.6, 'square', 0.13, 500);
    // arpegio
    if (s.drums !== 'soft' || st % 2 === 0) this.tone(mtof(notes[ARP[st]] + 12), t, spb * 0.9, s.lead, 0.045, 2400);
    // pad de acorde al inicio del compás
    if (st === 0) notes.slice(0, 3).forEach(n => this.tone(mtof(n), t, spb * 15, 'triangle', 0.025, 1200, 0.3));
    // batería
    if (s.drums === 'four') {
      if (st % 4 === 0) this.kick(t);
      if (st === 4 || st === 12) this.snare(t);
      if (st % 2 === 1) this.hat(t, 0.03);
    } else if (s.drums === 'break') {
      if (st === 0 || st === 6 || st === 10) this.kick(t);
      if (st === 4 || st === 12) this.snare(t);
      this.hat(t, st % 2 ? 0.02 : 0.035);
    } else {
      if (st === 0 || st === 8) this.kick(t, 0.5);
      if (st % 4 === 2) this.hat(t, 0.015);
    }
  }

  tone(freq, t, dur, type, vol, cutoff, attack = 0.005) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = type; o.frequency.value = freq;
    f.type = 'lowpass'; f.frequency.value = cutoff;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(this.out);
    o.start(t); o.stop(t + dur + 0.05);
  }

  kick(t, v = 1) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(0.4 * v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g); g.connect(this.out);
    o.start(t); o.stop(t + 0.2);
  }

  noiseHit(t, dur, vol, type, freq) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.out);
    src.start(t, Math.random() * 0.3); src.stop(t + dur + 0.02);
  }
  snare(t) { this.noiseHit(t, 0.14, 0.18, 'bandpass', 1800); }
  hat(t, v) { this.noiseHit(t, 0.04, v, 'highpass', 7000); }
}
