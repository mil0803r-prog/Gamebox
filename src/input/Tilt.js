// Dirección por inclinación del celular (como un volante), con DeviceOrientation.
// Requiere HTTPS. En iPhone hay que pedir permiso desde un toque del usuario.
const SENS = { low: 30, medium: 22, high: 15 }; // grados para girar al máximo

export class Tilt {
  constructor() {
    this.supported = typeof window.DeviceOrientationEvent !== 'undefined';
    this.enabled = false;
    this.receiving = false;   // llegaron lecturas reales del sensor
    this.raw = 0;             // inclinación lateral en grados (según la orientación de pantalla)
    this.center = 0;
    this.value = 0;           // dirección -1..1 suavizada
    this.sens = 'medium';
    this.invert = false;
    this.listening = false;
    this.onReading = this.onReading.bind(this);
  }

  // Debe llamarse desde un toque/clic (iOS pide permiso)
  async request() {
    if (!this.supported) return 'unsupported';
    try {
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        const r = await DeviceOrientationEvent.requestPermission();
        if (r !== 'granted') return 'denied';
      }
    } catch { return 'denied'; }
    this.listen();
    return 'ok';
  }

  listen() {
    if (this.listening) return;
    window.addEventListener('deviceorientation', this.onReading);
    this.listening = true;
  }

  screenAngle() {
    const a = (screen.orientation && typeof screen.orientation.angle === 'number') ? screen.orientation.angle : (window.orientation || 0);
    return ((a % 360) + 360) % 360;
  }

  onReading(e) {
    if (e.beta === null || e.gamma === null) return;
    this.receiving = true;
    const a = this.screenAngle();
    let t;
    if (a === 90) t = e.beta;
    else if (a === 270) t = -e.beta;
    else if (a === 180) t = -e.gamma;
    else t = e.gamma;
    if (t > 90) t = 180 - t; else if (t < -90) t = -180 - t; // evita saltos si el celular se voltea
    this.raw = t;
  }

  calibrate() { this.center = this.raw; }

  update(dt) {
    const range = SENS[this.sens] || 22;
    let s = (this.raw - this.center) / range;
    if (this.invert) s = -s;
    const dead = 0.06;
    s = Math.abs(s) < dead ? 0 : (s - Math.sign(s) * dead) / (1 - dead);
    s = Math.max(-1, Math.min(1, s));
    this.value += (s - this.value) * Math.min(1, dt * 18);
    return this.value;
  }
}
