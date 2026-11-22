// Mini-mapa en canvas 2D: la pista se dibuja una vez y luego solo los puntos
export class Minimap {
  constructor(track, size) {
    this.track = track;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'minimap';
    this.setSize(size);
  }

  setSize(size) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.size = size;
    this.canvas.width = this.canvas.height = Math.round(size * dpr);
    this.canvas.style.width = this.canvas.style.height = size + 'px';
    this.dpr = dpr;
    this.prerender();
  }

  prerender() {
    const t = this.track, b = t.bounds;
    const S = this.canvas.width, pad = S * 0.08;
    const span = Math.max(b.maxx - b.minx, b.maxz - b.minz);
    this.scale = (S - pad * 2) / span;
    this.ox = pad + ((S - pad * 2) - (b.maxx - b.minx) * this.scale) / 2 - b.minx * this.scale;
    this.oz = pad + ((S - pad * 2) - (b.maxz - b.minz) * this.scale) / 2 - b.minz * this.scale;
    const off = document.createElement('canvas');
    off.width = off.height = S;
    const g = off.getContext('2d');
    g.lineJoin = 'round'; g.lineCap = 'round';
    const drawSurf = (surf, w, color) => {
      g.strokeStyle = color; g.lineWidth = w;
      g.beginPath();
      for (let i = 0; i < surf.n; i += 2) {
        const x = surf.px[i] * this.scale + this.ox, y = surf.pz[i] * this.scale + this.oz;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      if (surf.closed) g.closePath(); else g.lineTo(surf.px[surf.n - 1] * this.scale + this.ox, surf.pz[surf.n - 1] * this.scale + this.oz);
      g.stroke();
    };
    const lw = Math.max(3, S * 0.035);
    t.surfaces.forEach(s => drawSurf(s, lw + 4 * this.dpr, 'rgba(0,0,0,0.55)'));
    t.shortcuts.forEach(s => drawSurf(s, lw * 0.7, 'rgba(255,200,80,0.85)'));
    drawSurf(t.main, lw, 'rgba(255,255,255,0.9)');
    // meta
    const st = t.main.pointAt(0);
    g.fillStyle = '#ff2b5a';
    g.beginPath(); g.arc(st.x * this.scale + this.ox, st.z * this.scale + this.oz, lw * 0.8, 0, 7); g.fill();
    this.bg = off;
  }

  draw(racers, meIndex, traffic) {
    const g = this.canvas.getContext('2d');
    const S = this.canvas.width;
    g.clearRect(0, 0, S, S);
    g.drawImage(this.bg, 0, 0);
    if (traffic) {
      g.fillStyle = 'rgba(200,205,215,0.85)';
      const tr = S * 0.018;
      for (const v of traffic.vehicles) g.fillRect(v.x * this.scale + this.ox - tr, v.z * this.scale + this.oz - tr, tr * 2, tr * 2);
    }
    const r0 = S * 0.04;
    // primero los rivales, luego yo encima
    const order = racers.slice().sort((a, b) => (a.index === meIndex) - (b.index === meIndex));
    for (const r of order) {
      const x = r.car.x * this.scale + this.ox, y = r.car.z * this.scale + this.oz;
      const me = r.index === meIndex;
      g.fillStyle = '#' + r.color.toString(16).padStart(6, '0');
      g.strokeStyle = me ? '#fff' : '#000';
      g.lineWidth = me ? 3 * this.dpr : 1.5 * this.dpr;
      g.beginPath(); g.arc(x, y, me ? r0 * 1.3 : r0, 0, 7); g.fill(); g.stroke();
    }
  }
}
