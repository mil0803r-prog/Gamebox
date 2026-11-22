import { TRACKS } from '../../tracks/trackData.js';
import { Track } from '../../tracks/Track.js';
import { Settings, Records } from '../../game/Storage.js';
import { el, fmtTime, DIFF, THEME_GRAD, THEME_ICON } from '../dom.js';
import { showCarSelect } from './CarSelect.js';

// Dibuja el trazado de una pista en un canvas (se guarda en caché)
function trackPreview(ui, def) {
  if (ui.cache[def.id]) return ui.cache[def.id];
  const t = new Track(def);
  const W = 260, H = 170;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const m = t.main;
  let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9;
  for (let i = 0; i < m.n; i++) { minx = Math.min(minx, m.px[i]); maxx = Math.max(maxx, m.px[i]); minz = Math.min(minz, m.pz[i]); maxz = Math.max(maxz, m.pz[i]); }
  const sc = Math.min((W - 30) / (maxx - minx), (H - 30) / (maxz - minz));
  const ox = (W - (maxx - minx) * sc) / 2 - minx * sc, oz = (H - (maxz - minz) * sc) / 2 - minz * sc;
  const draw = (s, w, col) => {
    g.strokeStyle = col; g.lineWidth = w; g.lineJoin = 'round'; g.lineCap = 'round'; g.beginPath();
    for (let i = 0; i < s.n; i++) { const x = s.px[i] * sc + ox, y = s.pz[i] * sc + oz; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    if (s.closed) g.closePath(); g.stroke();
  };
  t.surfaces.forEach(s => draw(s, 12, 'rgba(0,0,0,0.45)'));
  t.shortcuts.forEach(s => draw(s, 4, '#ffd27a'));
  draw(m, 6, '#ffffff');
  const st = m.pointAt(0);
  g.fillStyle = '#ff2b5a'; g.beginPath(); g.arc(st.x * sc + ox, st.z * sc + oz, 6, 0, 7); g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
  let miny = 1e9, maxy = -1e9;
  for (let i = 0; i < m.n; i++) { miny = Math.min(miny, m.py[i]); maxy = Math.max(maxy, m.py[i]); }
  return (ui.cache[def.id] = { url: c.toDataURL(), length: t.length, climb: maxy - miny, ramps: t.ramps.length, pads: t.pads.length });
}

export function showTrackSelect(ui) {
  const s = ui.s;
  const n = el(`<div class="screen tracks">
    <header class="scr-head"><span class="step">PASO 2 / 2</span><h2>ELIGE LA PISTA</h2></header>
    <div class="cards">${TRACKS.map((t, i) => {
      const pv = trackPreview(ui, t);
      const rec = Records.get(t.id);
      return `<button class="card focusable" data-t="${i}" style="--grad:${THEME_GRAD[t.theme]}">
        <div class="card-top"><span class="ctheme">${THEME_ICON[t.theme]} ${t.subtitle}</span><span class="clen">${(pv.length / 1000).toFixed(2)} km</span></div>
        <img src="${pv.url}" alt="">
        <div class="cname">${t.name}</div>
        <div class="cfeat"><span>↗ ${pv.ramps} rampas</span><span>⚡ ${pv.pads} turbos</span><span>✂ atajo</span></div>
        <div class="crec"><span>🏆 Vuelta</span><b>${rec.bestLap ? fmtTime(rec.bestLap.t) : '--:--.--'}</b></div>
      </button>`;
    }).join('')}</div>
    <div class="opts">
      <div class="opt"><span>Vueltas</span><div class="stepper"><button class="btn sm" data-o="laps-">−</button><b class="v-laps"></b><button class="btn sm" data-o="laps+">+</button></div></div>
      <div class="opt"><span>Rivales IA</span><div class="stepper"><button class="btn sm" data-o="riv-">−</button><b class="v-riv"></b><button class="btn sm" data-o="riv+">+</button></div></div>
      <div class="opt o-diff"><span>Dificultad IA</span><div class="seg" data-o="diff">${DIFF.map((d, i) => `<button class="segb" data-v="${i}">${d}</button>`).join('')}</div></div>
      <div class="opt"><span>Ítems en pista</span><div class="seg" data-o="items"><button class="segb" data-v="0">No</button><button class="segb" data-v="1">Sí</button></div></div>
    </div>
    <div class="menu-row bottom">
      <button class="btn" data-a="back">‹ Atrás</button>
      <button class="btn go big" data-a="go" data-focus>¡A CORRER! 🏁</button>
    </div>
  </div>`);
  const rivKey = ui.mode === 1 ? 'rivals1p' : 'rivals2p';
  const rivMin = ui.mode === 1 ? 1 : 0, rivMax = ui.mode === 1 ? 3 : 2;
  s[rivKey] = Math.max(rivMin, Math.min(rivMax, s[rivKey]));
  const upd = () => {
    n.querySelectorAll('.card').forEach((c, i) => c.classList.toggle('sel', i === s.track));
    n.querySelector('.v-laps').textContent = s.laps;
    n.querySelector('.v-riv').textContent = s[rivKey];
    n.querySelectorAll('[data-o=diff] .segb').forEach(b => b.classList.toggle('on', +b.dataset.v === s.difficulty));
    n.querySelectorAll('[data-o=items] .segb').forEach(b => b.classList.toggle('on', +b.dataset.v === (s.items ? 1 : 0)));
    n.querySelector('.o-diff').classList.toggle('dim', s[rivKey] === 0);
  };
  ui.click(n, '.card', (e, b) => { s.track = +b.dataset.t; upd(); });
  ui.click(n, '[data-o] .segb', (e, b) => {
    const o = b.parentElement.dataset.o;
    if (o === 'diff') s.difficulty = +b.dataset.v;
    if (o === 'items') s.items = b.dataset.v === '1';
    upd();
  });
  ui.click(n, 'button[data-o]', (e, b) => {
    const o = b.dataset.o;
    if (o === 'laps-') s.laps = Math.max(1, s.laps - 1);
    if (o === 'laps+') s.laps = Math.min(9, s.laps + 1);
    if (o === 'riv-') s[rivKey] = Math.max(rivMin, s[rivKey] - 1);
    if (o === 'riv+') s[rivKey] = Math.min(rivMax, s[rivKey] + 1);
    upd();
  });
  ui.click(n, '[data-a=back]', () => showCarSelect(ui));
  ui.click(n, '[data-a=go]', () => { Settings.save(); ui.startRace(); });
  upd();
  ui.screen(n, { back: () => showCarSelect(ui), demo: true });
  ui.keyHandler = code => {
    if (code === 'KeyA' || code === 'KeyD') {
      s.track = (s.track + (code === 'KeyD' ? 1 : -1) + TRACKS.length) % TRACKS.length;
      ui.game.audio?.ui(); upd(); return true;
    }
    return false;
  };
}
