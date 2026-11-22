// Ajuste automático de calidad según los FPS reales
export const QUALITY_LEVELS = [
  { name: 'Baja', pixelRatio: 0.7, particles: 0.35 },
  { name: 'Media', pixelRatio: 1.0, particles: 0.6 },
  { name: 'Alta', pixelRatio: 1.5, particles: 1 },
  { name: 'Ultra', pixelRatio: 2.0, particles: 1 },
];

export class Quality {
  constructor(game, mode) {
    this.game = game;
    this.setMode(mode);
  }

  setMode(mode) {
    this.mode = mode;
    const map = { low: 0, medium: 1, high: 2 };
    if (mode in map) this.maxLevel = this.level = map[mode];
    else this.maxLevel = this.level = this.game.isTouch ? 2 : 3;
    this.apply();
    this.acc = 0; this.frames = 0; this.good = 0; this.cooldown = 2;
  }

  apply() {
    const L = QUALITY_LEVELS[this.level];
    const dpr = window.devicePixelRatio || 1;
    this.game.setPixelRatio(Math.min(dpr, L.pixelRatio));
    this.game.effects.setQuality(this.level);
  }

  // se llama cada frame durante la carrera con el dt real (sin límite)
  sample(dt) {
    if (this.mode !== 'auto') return;
    if (this.cooldown > 0) { this.cooldown -= dt; return; }
    this.acc += dt; this.frames++;
    if (this.acc < 1.5) return;
    const fps = this.frames / this.acc;
    this.acc = 0; this.frames = 0;
    if (fps < 50 && this.level > 0) {
      this.level--; this.maxLevel = this.level; this.good = 0; this.cooldown = 2.5; this.apply();
    } else if (fps > 58.5 && this.level < this.maxLevel) {
      if (++this.good >= 4) { this.level++; this.good = 0; this.cooldown = 2.5; this.apply(); }
    } else this.good = 0;
  }
}
