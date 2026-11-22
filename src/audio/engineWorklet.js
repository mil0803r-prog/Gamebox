// =====================================================================
//  Procesador de audio del motor (AudioWorklet).
//  Simula las explosiones de cada cilindro según las RPM: cada explosión
//  es un pulso que decae y pasa por resonancias de escape, admisión y
//  carrocería. La carga (acelerador) cambia la fuerza de las explosiones.
//  Sin carga a altas RPM aparecen petardeos (crackles) en el escape.
//  Se carga como texto (Blob) para no depender de archivos externos.
// =====================================================================
export const ENGINE_PROCESSOR = `
class EngineProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'rpm', defaultValue: 900, minValue: 0, maxValue: 20000, automationRate: 'k-rate' },
      { name: 'load', defaultValue: 0, minValue: 0, maxValue: 1.5, automationRate: 'k-rate' },
      { name: 'gain', defaultValue: 0, minValue: 0, maxValue: 2, automationRate: 'k-rate' },
    ];
  }
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    this.cyl = o.cyl || 8;
    this.tone = o.tone || 1;
    this.ev = !!o.ev;
    this.seed = (o.seed || 1) >>> 0;
    this.phase = 0; this.pulse = 0; this.amp = 0; this.cylIdx = 0;
    this.crackle = 0; this.crackleCool = 0;
    this.st = [[0, 0], [0, 0], [0, 0], [0, 0]]; // filtros (lp, bp)
    this.evPh = 0; this.evPh2 = 0;
    this.dc = 0; this.rumble = 0;
  }
  rand() { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 4294967296; }
  // filtro de estado variable (Chamberlin): devuelve paso de banda
  svf(s, x, f, q) { const hp = x - s[0] - q * s[1]; s[1] += f * hp; s[0] += f * s[1]; return s[1]; }
  coef(fc) { return 2 * Math.sin(Math.PI * Math.min(0.11, fc / sampleRate)); }
  process(inputs, outputs, params) {
    const out = outputs[0];
    const ch0 = out[0];
    const N = ch0.length;
    const rpm = params.rpm[0], load = params.load[0], gain = params.gain[0];
    if (this.ev) {
      // motor eléctrico: zumbido del inversor + armónicos + leve ruido
      const f = 90 + rpm * 0.055;
      for (let i = 0; i < N; i++) {
        this.evPh += f / sampleRate; if (this.evPh > 1) this.evPh -= 1;
        this.evPh2 += (f * 2.97) / sampleRate; if (this.evPh2 > 1) this.evPh2 -= 1;
        const n = this.rand() * 2 - 1;
        let y = Math.sin(this.evPh * 6.283) * 0.5 + Math.sin(this.evPh2 * 6.283) * 0.18 * (0.4 + load) + n * 0.02;
        ch0[i] = y * gain * (0.5 + 0.5 * load);
      }
    } else {
      const fireRate = (rpm / 60) * (this.cyl / 2);         // explosiones por segundo
      const fEx = this.coef((55 + rpm * 0.016) * this.tone);  // resonancia del escape (grave)
      const fEx2 = this.coef((140 + rpm * 0.03) * this.tone); // segunda resonancia del escape
      const fIn = this.coef((420 + rpm * 0.065) * this.tone); // admisión (rugido medio)
      const fBody = this.coef(1500 + rpm * 0.11);             // vibración mecánica (aguda)
      const decay = Math.exp(-1 / (sampleRate * (0.0012 + 0.0012 * (1 - Math.min(1, rpm / 9000)))));
      const crackleDecay = Math.exp(-1 / (sampleRate * 0.006));
      for (let i = 0; i < N; i++) {
        this.phase += fireRate / sampleRate;
        if (this.phase >= 1) {
          this.phase -= 1;
          this.cylIdx = (this.cylIdx + 1) % this.cyl;
          let a = (0.3 + 0.7 * Math.min(1, load)) * (0.82 + 0.36 * this.rand());
          // V8 de cigüeñal cruzado: explosiones desparejas (el "borboteo" típico)
          if (this.cyl === 8 && (this.cylIdx === 1 || this.cylIdx === 6)) a *= 1.35;
          // 4 cilindros: más áspero
          if (this.cyl === 4 && (this.cylIdx & 1)) a *= 0.9;
          this.amp = a; this.pulse = 1;
          // petardeo al soltar el acelerador a altas RPM
          this.crackleCool -= 1;
          if (load < 0.08 && rpm > 3200 && this.crackleCool <= 0 && this.rand() < 0.05) {
            this.crackle = 0.6 + this.rand() * 0.9; this.crackleCool = 6;
          }
        }
        this.pulse *= decay;
        const n = this.rand() * 2 - 1;
        let x = this.pulse * this.amp;
        x += n * 0.035 * (0.25 + load) * Math.min(1.2, rpm / 7000);   // turbulencia/combustión
        if (this.crackle > 0.002) { x += n * this.crackle; this.crackle *= crackleDecay; }
        const ex = this.svf(this.st[0], x, fEx, 0.32);
        const ex2 = this.svf(this.st[1], x, fEx2, 0.45);
        const inn = this.svf(this.st[2], x, fIn, 0.55);
        const body = this.svf(this.st[3], x, fBody, 0.9);
        let y = ex * 1.5 + ex2 * 0.7 + inn * (0.25 + 0.55 * Math.min(1, load)) + body * 0.1 + x * 0.18;
        // quitar continua y saturar suavemente (le da "grano" al sonido)
        this.dc += (y - this.dc) * 0.0015;
        y = Math.tanh((y - this.dc) * 1.6);
        ch0[i] = y * gain;
      }
    }
    for (let c = 1; c < out.length; c++) out[c].set(ch0);
    return true;
  }
}
registerProcessor('engine-processor', EngineProcessor);
`;
