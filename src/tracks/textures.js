import * as THREE from 'three';

function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  return t;
}

function noise(g, w, h, alpha, n = 1500) {
  for (let i = 0; i < n; i++) {
    const v = Math.random() * 255 | 0;
    g.fillStyle = `rgba(${v},${v},${v},${alpha})`;
    g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
}

// Asfalto con línea central y bordes (pianos). u=ancho, v=largo
export function roadTexture(theme) {
  const pal = {
    city: { base: '#2b2d38', line: '#ffe14d', edge1: '#ff2bd6', edge2: '#1a1a24' },
    desert: { base: '#7d6450', line: '#fff3d6', edge1: '#d9332b', edge2: '#f5f0e6' },
    snow: { base: '#4a4f5a', line: '#ffffff', edge1: '#d9332b', edge2: '#f5f5f5' },
  }[theme];
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = pal.base; g.fillRect(0, 0, w, h);
    noise(g, w, h, 0.08, 3000);
    // pianos
    const e = 14;
    for (let y = 0; y < h; y += 32) {
      g.fillStyle = (y / 32) % 2 ? pal.edge1 : pal.edge2;
      g.fillRect(0, y, e, 32); g.fillRect(w - e, y, e, 32);
    }
    // línea blanca de borde
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.fillRect(e + 4, 0, 4, h); g.fillRect(w - e - 8, 0, 4, h);
    // línea central discontinua
    g.fillStyle = pal.line;
    g.fillRect(w / 2 - 3, 0, 6, h * 0.5);
  });
}

export function checkerTexture() {
  return canvasTex(128, 32, (g, w, h) => {
    const s = 16;
    for (let x = 0; x < w; x += s) for (let y = 0; y < h; y += s) {
      g.fillStyle = ((x + y) / s) % 2 ? '#111' : '#fff';
      g.fillRect(x, y, s, s);
    }
  }, false);
}

export function boostPadTexture() {
  return canvasTex(64, 128, (g, w, h) => {
    g.fillStyle = '#0a2a4a'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 2; k++) {
      const y0 = k * 64;
      g.fillStyle = '#00e5ff';
      g.beginPath();
      g.moveTo(8, y0 + 50); g.lineTo(32, y0 + 14); g.lineTo(56, y0 + 50);
      g.lineTo(46, y0 + 50); g.lineTo(32, y0 + 30); g.lineTo(18, y0 + 50);
      g.closePath(); g.fill();
    }
  });
}

export function groundTexture(theme) {
  const cfg = {
    city: ['#16161f', '#22222e', 0.15],
    desert: ['#d9a35f', '#c48848', 0.12],
    snow: ['#eef3f8', '#d5e0ea', 0.1],
  }[theme];
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = cfg[0]; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) {
      g.fillStyle = cfg[1];
      g.globalAlpha = Math.random() * 0.6;
      const r = Math.random() * 10 + 2;
      g.beginPath(); g.arc(Math.random() * w, Math.random() * h, r, 0, 7); g.fill();
    }
    g.globalAlpha = 1;
    noise(g, w, h, cfg[2], 2500);
    if (theme === 'city') { // cuadrícula de calles
      g.strokeStyle = 'rgba(80,80,120,0.35)'; g.lineWidth = 2;
      g.strokeRect(0, 0, w, h);
    }
  });
}

export function windowsTexture() {
  return canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#0c0c16'; g.fillRect(0, 0, w, h);
    const cols = ['#ffd27a', '#7ae8ff', '#ff7ae0', '#ffffff'];
    for (let y = 6; y < h; y += 14) for (let x = 6; x < w; x += 14) {
      if (Math.random() < 0.45) {
        g.fillStyle = cols[Math.random() * cols.length | 0];
        g.globalAlpha = 0.5 + Math.random() * 0.5;
        g.fillRect(x, y, 8, 9);
      }
    }
    g.globalAlpha = 1;
  });
}

export function itemBoxTexture() {
  return canvasTex(64, 64, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, w, h);
    grd.addColorStop(0, '#ff3cac'); grd.addColorStop(0.5, '#784ba0'); grd.addColorStop(1, '#2b86c5');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#fff'; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4);
    g.fillStyle = '#fff'; g.font = 'bold 44px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('?', w / 2, h / 2 + 2);
  }, false);
}

export function blobTexture() {
  return canvasTex(64, 64, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(0,0,0,0.6)'); grd.addColorStop(0.6, 'rgba(0,0,0,0.35)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  }, false);
}

export function sparkTexture() {
  return canvasTex(32, 32, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.3, 'rgba(255,255,255,0.8)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  }, false);
}

export function oilTexture() {
  return canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = 'rgba(10,10,10,0.9)';
    for (let i = 0; i < 7; i++) {
      g.beginPath();
      g.arc(w / 2 + (Math.random() - 0.5) * 24, h / 2 + (Math.random() - 0.5) * 24, 10 + Math.random() * 10, 0, 7);
      g.fill();
    }
    g.fillStyle = 'rgba(120,80,200,0.35)';
    g.beginPath(); g.arc(w / 2 - 6, h / 2 - 6, 8, 0, 7); g.fill();
  }, false);
}

export function skyTexture(top, mid, bottom) {
  const t = canvasTex(4, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, top); grd.addColorStop(0.55, mid); grd.addColorStop(1, bottom);
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  }, false);
  return t;
}
