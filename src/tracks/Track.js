import * as THREE from 'three';

// Superficie conducible: una polilínea muestreada (cerrada para el circuito, abierta para atajos)
export class Surface {
  constructor(points3, closed, width, spacing = 2) {
    this.closed = closed;
    const curve = new THREE.CatmullRomCurve3(points3, closed, 'centripetal', 0.5);
    const approxLen = curve.getLength();
    const n = Math.max(8, Math.round(approxLen / spacing));
    const pts = curve.getSpacedPoints(n);
    if (closed) pts.pop(); // el último repite el primero
    this.n = pts.length;
    this.px = new Float32Array(this.n);
    this.py = new Float32Array(this.n);
    this.pz = new Float32Array(this.n);
    this.fx = new Float32Array(this.n); // tangente horizontal normalizada
    this.fz = new Float32Array(this.n);
    this.s = new Float32Array(this.n);  // distancia acumulada
    this.seg = new Float32Array(this.n); // largo del segmento i -> i+1
    this.hw = new Float32Array(this.n);  // medio ancho
    for (let i = 0; i < this.n; i++) {
      this.px[i] = pts[i].x; this.py[i] = pts[i].y; this.pz[i] = pts[i].z;
    }
    let acc = 0;
    for (let i = 0; i < this.n; i++) {
      const j = this.next(i);
      let dx, dz, dy;
      if (j < 0) { // último punto de una superficie abierta
        dx = this.px[i] - this.px[i - 1]; dz = this.pz[i] - this.pz[i - 1]; dy = 0;
        this.seg[i] = 0;
      } else {
        dx = this.px[j] - this.px[i]; dz = this.pz[j] - this.pz[i]; dy = this.py[j] - this.py[i];
        this.seg[i] = Math.hypot(dx, dz, dy);
      }
      const l = Math.hypot(dx, dz) || 1;
      this.fx[i] = dx / l; this.fz[i] = dz / l;
      this.s[i] = acc;
      acc += this.seg[i];
    }
    // suavizar tangentes (promedio con vecinos) para normales sin quiebres
    const fx2 = new Float32Array(this.n), fz2 = new Float32Array(this.n);
    for (let i = 0; i < this.n; i++) {
      const a = this.prev(i), b = this.next(i);
      let x = this.fx[i] * 2, z = this.fz[i] * 2;
      if (a >= 0) { x += this.fx[a]; z += this.fz[a]; }
      if (b >= 0) { x += this.fx[b]; z += this.fz[b]; }
      const l = Math.hypot(x, z) || 1;
      fx2[i] = x / l; fz2[i] = z / l;
    }
    this.fx = fx2; this.fz = fz2;
    this.length = acc;
    const w = typeof width === 'function' ? width : () => width;
    for (let i = 0; i < this.n; i++) this.hw[i] = w(i / this.n) / 2;
  }

  next(i) { return i + 1 < this.n ? i + 1 : (this.closed ? 0 : -1); }
  prev(i) { return i > 0 ? i - 1 : (this.closed ? this.n - 1 : -1); }
  wrap(i) { return ((i % this.n) + this.n) % this.n; }

  // derecha = (-fz, fx)
  rightX(i) { return -this.fz[i]; }
  rightZ(i) { return this.fx[i]; }

  indexAt(s) {
    if (this.closed) s = ((s % this.length) + this.length) % this.length;
    else s = Math.max(0, Math.min(this.length - 0.001, s));
    // búsqueda binaria
    let lo = 0, hi = this.n - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.s[mid] <= s) lo = mid; else hi = mid - 1;
    }
    return lo;
  }

  // punto en la superficie a distancia s con desplazamiento lateral lat
  pointAt(s, lat = 0, out = {}) {
    if (this.closed) s = ((s % this.length) + this.length) % this.length;
    const i = this.indexAt(s);
    const j = this.next(i) < 0 ? i : this.next(i);
    const t = this.seg[i] > 0 ? (s - this.s[i]) / this.seg[i] : 0;
    const fx = this.fx[i] + (this.fx[j] - this.fx[i]) * t;
    const fz = this.fz[i] + (this.fz[j] - this.fz[i]) * t;
    const l = Math.hypot(fx, fz) || 1;
    out.fx = fx / l; out.fz = fz / l;
    out.x = this.px[i] + (this.px[j] - this.px[i]) * t - out.fz * lat;
    out.z = this.pz[i] + (this.pz[j] - this.pz[i]) * t + out.fx * lat;
    out.y = this.py[i] + (this.py[j] - this.py[i]) * t;
    out.hw = this.hw[i] + (this.hw[j] - this.hw[i]) * t;
    out.i = i;
    return out;
  }

  _projectSeg(i, x, z, out) {
    const j = this.next(i);
    if (j < 0) return Infinity;
    const ax = this.px[i], az = this.pz[i];
    const dx = this.px[j] - ax, dz = this.pz[j] - az;
    const l2 = dx * dx + dz * dz || 1;
    let t = ((x - ax) * dx + (z - az) * dz) / l2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = ax + dx * t, cz = az + dz * t;
    const d2 = (x - cx) ** 2 + (z - cz) ** 2;
    if (out && d2 < out.d2) {
      out.d2 = d2; out.i = i; out.t = t;
    }
    return d2;
  }

  // Proyecta (x,z) en la superficie. hint = índice anterior para búsqueda local.
  project(x, z, hint = -1, out = {}) {
    out.d2 = Infinity; out.i = 0; out.t = 0;
    if (hint >= 0 && hint < this.n) {
      const W = 24;
      for (let k = -W; k <= W; k++) {
        let i = hint + k;
        if (this.closed) i = this.wrap(i); else if (i < 0 || i >= this.n - 1) continue;
        this._projectSeg(i, x, z, out);
      }
    }
    if (out.d2 > 900 || hint < 0) { // búsqueda global
      out.d2 = Infinity;
      const last = this.closed ? this.n : this.n - 1;
      for (let i = 0; i < last; i++) this._projectSeg(i, x, z, out);
    }
    const i = out.i, j = this.next(i) < 0 ? i : this.next(i), t = out.t;
    const fx = this.fx[i] + (this.fx[j] - this.fx[i]) * t;
    const fz = this.fz[i] + (this.fz[j] - this.fz[i]) * t;
    const l = Math.hypot(fx, fz) || 1;
    out.fx = fx / l; out.fz = fz / l;
    const cx = this.px[i] + (this.px[j] - this.px[i]) * t;
    const cz = this.pz[i] + (this.pz[j] - this.pz[i]) * t;
    out.lat = (x - cx) * (-out.fz) + (z - cz) * out.fx;
    out.y = this.py[i] + (this.py[j] - this.py[i]) * t;
    out.hw = this.hw[i] + (this.hw[j] - this.hw[i]) * t;
    out.s = this.s[i] + this.seg[i] * t;
    const hz = Math.hypot(this.px[j] - this.px[i], this.pz[j] - this.pz[i]) || 1;
    out.slope = (this.py[j] - this.py[i]) / hz;
    out.frac = this.closed ? out.s / this.length : out.s / this.length;
    return out;
  }
}

// Pista completa: circuito principal + atajos + rampas + pads + ítems
export class Track {
  constructor(def) {
    this.def = def;
    const scale = def.scale || 1;
    const pts = def.points.map(p => new THREE.Vector3(p[0] * scale, p[2] || 0, p[1] * scale));
    this.main = new Surface(pts, true, def.width || 18);
    this.length = this.main.length;
    this.shortcuts = [];
    for (const sc of def.shortcuts || []) {
      if (sc.fromXZ) sc.from = this.main.project(sc.fromXZ[0] * scale, sc.fromXZ[1] * scale).s / this.length;
      if (sc.toXZ) sc.to = this.main.project(sc.toXZ[0] * scale, sc.toXZ[1] * scale).s / this.length;
      const a = this.main.pointAt(sc.from * this.length);
      const b = this.main.pointAt(sc.to * this.length);
      const lead = sc.lead || 14;
      const p = [];
      p.push(new THREE.Vector3(a.x, a.y, a.z));
      p.push(new THREE.Vector3(a.x + a.fx * lead, a.y, a.z + a.fz * lead));
      const mids = sc.points.map(q => [q[0] * scale, q[1] * scale, q[2]]);
      mids.forEach((q, k) => {
        const f = (k + 1) / (mids.length + 1);
        const y = q[2] !== undefined ? q[2] : a.y + (b.y - a.y) * f;
        p.push(new THREE.Vector3(q[0], y, q[1]));
      });
      p.push(new THREE.Vector3(b.x - b.fx * lead, b.y, b.z - b.fz * lead));
      p.push(new THREE.Vector3(b.x, b.y, b.z));
      const surf = new Surface(p, false, sc.width || 11);
      surf.fromS = sc.from * this.length;
      surf.toS = sc.to * this.length;
      if (surf.toS < surf.fromS) surf.toS += this.length;
      this.shortcuts.push(surf);
    }
    this.surfaces = [this.main, ...this.shortcuts];

    const frac = (o, surf) => o.atXZ ? surf.project(o.atXZ[0] * scale, o.atXZ[1] * scale).s / surf.length : o.at;
    // rampas: {surface, s0, len, h, hw}
    this.ramps = (def.ramps || []).map(r => {
      const surf = r.shortcut !== undefined ? this.shortcuts[r.shortcut] : this.main;
      return { surf, surfIndex: r.shortcut !== undefined ? r.shortcut + 1 : 0, s0: frac(r, surf) * surf.length, len: r.len || 14, h: r.height || 2, lat: r.lat || 0, w: r.width || 0 };
    });
    this.pads = (def.pads || []).map(p => {
      const surf = p.shortcut !== undefined ? this.shortcuts[p.shortcut] : this.main;
      const s = frac(p, surf) * surf.length;
      const pt = surf.pointAt(s, p.lat || 0);
      return { x: pt.x, z: pt.z, y: pt.y, fx: pt.fx, fz: pt.fz, s, len: 7, w: 5, surf };
    });
    this.itemRows = (def.items || []).map(f => (Array.isArray(f) ? frac({ atXZ: f }, this.main) : f) * this.length);

    // checkpoints a lo largo del circuito principal
    this.computeRacingLine();
  }

  // Calcula la mejor superficie para el punto (x,z). info: estado por auto {hints[]}
  query(x, z, hints, out, margin = 0) {
    let best = null, bestExcess = Infinity, bestInside = null, bestInsideRatio = Infinity;
    for (let k = 0; k < this.surfaces.length; k++) {
      const surf = this.surfaces[k];
      const r = out.tmp[k] || (out.tmp[k] = {});
      surf.project(x, z, hints[k], r);
      hints[k] = r.i;
      if (!surf.closed && (r.s <= 0.01 || r.s >= surf.length - 0.01)) {
        r.excess = Infinity; continue; // fuera de los extremos del atajo
      }
      const excess = Math.abs(r.lat) - (r.hw - margin);
      r.excess = excess;
      if (excess <= 0) {
        const ratio = Math.abs(r.lat) / (r.hw - margin);
        if (ratio < bestInsideRatio) { bestInsideRatio = ratio; bestInside = k; }
      }
      if (excess < bestExcess) { bestExcess = excess; best = k; }
    }
    const k = bestInside !== null ? bestInside : best;
    out.surface = k;
    out.inside = bestInside !== null;
    out.proj = out.tmp[k];
    // progreso equivalente en el circuito principal
    if (k === 0) out.progress = out.proj.s;
    else {
      const sc = this.surfaces[k];
      const f = out.proj.s / sc.length;
      out.progress = (sc.fromS + (sc.toS - sc.fromS) * f) % this.length;
    }
    // altura del piso + rampas
    let y = out.proj.y;
    out.onRamp = false; out.rampSlope = 0;
    for (const r of this.ramps) {
      if (r.surfIndex !== k) continue;
      const ds = out.proj.s - r.s0;
      if (ds >= 0 && ds <= r.len && (r.w === 0 || Math.abs(out.proj.lat - r.lat) < r.w / 2)) {
        y += r.h * (ds / r.len);
        out.onRamp = true;
        out.rampSlope = r.h / r.len;
      }
    }
    out.groundY = y;
    return out;
  }

  newQuery() {
    return { tmp: [], hints: this.surfaces.map(() => -1) };
  }

  // Línea de carrera (para la IA) y velocidad segura por curvatura
  computeRacingLine() {
    const m = this.main, n = m.n;
    const curv = new Float32Array(n);
    const K = 6;
    for (let i = 0; i < n; i++) {
      const a = m.wrap(i - K), b = m.wrap(i + K);
      const ang1 = Math.atan2(m.fx[a], m.fz[a]);
      const ang2 = Math.atan2(m.fx[b], m.fz[b]);
      let d = ang2 - ang1;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      const dist = (m.s[b] - m.s[a] + m.length) % m.length || 1;
      curv[i] = d / dist; // >0 = gira a la izquierda (ángulo crece), <0 derecha
    }
    this.curvature = curv;
    const off = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      // hacia el interior de la curva: curva a la derecha (curv<0) => lat positivo
      let c = 0;
      for (let k = -10; k <= 10; k++) c += curv[m.wrap(i + k)];
      c /= 21;
      off[i] = Math.max(-0.55, Math.min(0.55, -c * 18)) * m.hw[i];
    }
    this.racingOffset = off;
    // radio por muestra (suavizado)
    const absC = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let c = 0;
      for (let k = -4; k <= 4; k++) c = Math.max(c, Math.abs(curv[m.wrap(i + k)]));
      absC[i] = c;
    }
    this.absCurv = absC;
  }
}
