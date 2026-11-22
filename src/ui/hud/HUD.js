import { Minimap } from './Minimap.js';
import { KeyHints } from './KeyHints.js';
import { Settings } from '../../game/Storage.js';
import { fmtTime, hex } from '../dom.js';

export { fmtTime };
export const COUNT_TEXT = { 3: '3', 2: '2', 1: '1', 0: '¡YA!' };
const ITEM_ICON = { turbo: '🔥', oil: '🛢️', shield: '🛡️' };
const ITEM_NAME = { turbo: 'Turbo', oil: 'Aceite', shield: 'Escudo' };

// Velocímetro circular (SVG): arco de velocidad + anillo interior de turbo
const R1 = 52, R2 = 42, C1 = 2 * Math.PI * R1, C2 = 2 * Math.PI * R2, ARC = 0.75;
const MAX_KMH = 440;
function gaugeSVG() {
  let ticks = '';
  for (let i = 0; i <= 10; i++) {
    const a = (135 + i * 27) * Math.PI / 180;
    const r0 = i % 5 === 0 ? 57 : 59, r1 = 62;
    ticks += `<line x1="${60 + Math.cos(a) * r0}" y1="${60 + Math.sin(a) * r0}" x2="${60 + Math.cos(a) * r1}" y2="${60 + Math.sin(a) * r1}"/>`;
  }
  return `<svg viewBox="0 0 120 120" class="g-svg">
    <defs>
      <linearGradient id="gSpd" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#00e5ff"/><stop offset="0.6" stop-color="#ffffff"/><stop offset="1" stop-color="#ff2bd6"/></linearGradient>
    </defs>
    <circle cx="60" cy="60" r="64" class="g-bg"/>
    <g class="g-ticks">${ticks}</g>
    <circle cx="60" cy="60" r="${R1}" class="g-track" stroke-dasharray="${C1 * ARC} ${C1}" transform="rotate(135 60 60)"/>
    <circle cx="60" cy="60" r="${R1}" class="g-spd" stroke-dasharray="${C1 * ARC} ${C1}" stroke-dashoffset="${C1 * ARC}" transform="rotate(135 60 60)"/>
    <circle cx="60" cy="60" r="${R2}" class="g-track thin" stroke-dasharray="${C2 * ARC} ${C2}" transform="rotate(135 60 60)"/>
    <circle cx="60" cy="60" r="${R2}" class="g-turbo" stroke-dasharray="${C2 * ARC} ${C2}" stroke-dashoffset="${C2 * ARC}" transform="rotate(135 60 60)"/>
  </svg>`;
}

// HUD de un jugador, posicionado sobre su viewport
export class PlayerHUD {
  constructor(parent, track, racer, opts) {
    this.racer = racer;
    this.opts = opts;
    const el = this.el = document.createElement('div');
    el.className = 'phud';
    el.style.setProperty('--pc', hex(racer.color));
    el.innerHTML = `
      <div class="ph-tl">
        <div class="ph-pos"><b class="ph-posn">1</b><sup>º</sup><span class="ph-post">/2</span></div>
        <div class="ph-lap"><span>VUELTA</span> <b class="ph-lapn">1/3</b></div>
        <div class="ph-lapbar"><i></i></div>
        <div class="ph-time">0:00.00</div>
        <div class="ph-best"></div>
        <div class="ph-board"></div>
      </div>
      <div class="ph-tr"><div class="ph-map"></div>
        <div class="ph-item ${opts.items ? '' : 'hidden'}"><span class="ph-item-i"></span><small class="ph-item-n">ÍTEM</small></div>
      </div>
      <div class="ph-gauge">
        ${gaugeSVG()}
        <div class="g-center"><b class="ph-spd">0</b><small>km/h</small></div>
        <div class="g-label">TURBO <span class="ph-tpct">0%</span></div>
      </div>
      <div class="ph-center"><div class="ph-msg"></div><div class="ph-sub"></div></div>
      <div class="ph-wrong hidden">⟲ ¡SENTIDO CONTRARIO!</div>
      <div class="ph-tag">J${racer.humanIndex + 1}</div>
    `;
    parent.appendChild(el);
    const q = s => el.querySelector(s);
    this.posEl = q('.ph-pos'); this.posn = q('.ph-posn'); this.post = q('.ph-post');
    this.lapn = q('.ph-lapn'); this.lapbar = q('.ph-lapbar i'); this.time = q('.ph-time'); this.best = q('.ph-best');
    this.board = q('.ph-board');
    this.gauge = q('.ph-gauge'); this.spd = q('.ph-spd'); this.tpct = q('.ph-tpct');
    this.spdArc = q('.g-spd'); this.turboArc = q('.g-turbo');
    this.msg = q('.ph-msg'); this.sub = q('.ph-sub'); this.wrong = q('.ph-wrong');
    this.itemBox = q('.ph-item'); this.itemEl = q('.ph-item-i'); this.itemName = q('.ph-item-n');
    if (opts.isTouch) q('.ph-tr').appendChild(this.gauge); // en táctil, los botones ocupan la parte de abajo
    this.minimap = new Minimap(track, 120);
    q('.ph-map').appendChild(this.minimap.canvas);
    this.keys = !opts.isTouch && Settings.data.showKeys !== false ? new KeyHints(el, racer.humanIndex, opts.humans, opts.items) : null;
    this.msgTimer = 0;
    this.last = {};
    this.mapTimer = 0;
    this.boardTimer = 0;
  }

  layout(v) {
    const s = this.el.style;
    s.left = v.x + 'px'; s.top = v.y + 'px'; s.width = v.w + 'px'; s.height = v.h + 'px';
    const base = Math.max(10, Math.min(v.w / 34, v.h / 19, 24));
    s.fontSize = base + 'px';
    this.el.classList.toggle('compact', v.h < 330 || v.w < 420);
    const mm = Math.round(Math.min(v.w * 0.24, v.h * 0.32, 180));
    if (mm !== this.minimap.size) this.minimap.setSize(mm);
  }

  flash(text, sub = '', time = 1.2, cls = '') {
    this.msg.textContent = text;
    this.sub.textContent = sub;
    this.msg.className = 'ph-msg show ' + cls;
    this.msg.style.animation = 'none';
    void this.msg.offsetWidth;
    this.msg.style.animation = '';
    this.msgTimer = time;
  }

  set(key, el, val, prop = 'textContent') {
    if (this.last[key] !== val) { this.last[key] = val; el[prop] = val; }
  }

  update(dt, race, kb) {
    const r = this.racer, c = r.car;
    this.set('pos', this.posn, String(r.place));
    this.set('posc', this.posEl, 'ph-pos p' + Math.min(4, r.place), 'className');
    this.set('post', this.post, '/' + race.racers.length);
    this.set('lap', this.lapn, `${Math.max(1, Math.min(r.lap, race.laps))}/${race.laps}`);
    const L = race.track.length;
    const frac = r.finished ? 1 : r.lap < 1 ? 0 : Math.max(0, Math.min(1, ((r.raceDist % L) + L) % L / L));
    const fp = Math.round(frac * 200) / 200;
    if (this.last.frac !== fp) { this.last.frac = fp; this.lapbar.style.transform = `scaleX(${fp})`; }
    const t = r.finished ? r.finishTime : Math.max(0, race.time);
    this.set('time', this.time, fmtTime(t));
    const bestLap = r.lapTimes.length ? Math.min(...r.lapTimes) : null;
    this.set('best', this.best, bestLap ? 'Mejor ' + fmtTime(bestLap) : '');

    // velocímetro
    const kmh = Math.round(c.speed * 3.6 * (c.displayScale || 1));
    this.set('spd', this.spd, String(kmh));
    const sp = Math.round(Math.min(1, kmh / MAX_KMH) * 100);
    if (this.last.sp !== sp) { this.last.sp = sp; this.spdArc.setAttribute('stroke-dashoffset', C1 * ARC * (1 - sp / 100)); }
    const tb = Math.round(c.turboBar * 100);
    if (this.last.tb !== tb) { this.last.tb = tb; this.turboArc.setAttribute('stroke-dashoffset', C2 * ARC * (1 - tb / 100)); this.tpct.textContent = tb + '%'; }
    let gcls = 'ph-gauge';
    if (c.turboBar >= 0.999) gcls += ' full';
    if (c.usingTurbo) gcls += ' active';
    else if (c.boosting) gcls += ' boost';
    if (c.drifting && c.driftLevel > 0 && c.driftCharge) gcls += ' lvl' + c.driftLevel;
    if (c.slipActive) gcls += ' slip';
    this.set('gcls', this.gauge, gcls, 'className');

    this.set('wrong', this.wrong, r.wrongWay > 1.2 && !r.finished ? 'ph-wrong' : 'ph-wrong hidden', 'className');
    if (this.opts.items) {
      this.set('item', this.itemEl, c.item ? ITEM_ICON[c.item] : '');
      this.set('itemn', this.itemName, c.item ? ITEM_NAME[c.item] : 'ÍTEM');
      this.set('itemc', this.itemBox, 'ph-item' + (c.item ? ' has' : '') + (c.shieldTimer > 0 ? ' shield' : ''), 'className');
    }
    if (this.msgTimer > 0) {
      this.msgTimer -= dt;
      if (this.msgTimer <= 0) { this.msg.className = 'ph-msg'; this.sub.textContent = ''; }
    }
    this.mapTimer -= dt;
    if (this.mapTimer <= 0) { this.mapTimer = 1 / 30; this.minimap.draw(race.racers, r.index); }
    // clasificación (solo con más de 2 autos)
    this.boardTimer -= dt;
    if (this.boardTimer <= 0 && race.racers.length > 2) {
      this.boardTimer = 0.25;
      const rows = race.racers.slice().sort((a, b) => a.place - b.place)
        .map(x => `<div class="${x === r ? 'me' : ''}"><b>${x.place}</b><i style="background:${hex(x.color)}"></i>${x.human ? 'J' + (x.humanIndex + 1) : x.name.replace('CPU ', '')}</div>`).join('');
      this.set('board', this.board, rows, 'innerHTML');
    }
    if (this.keys && kb) this.keys.update(kb);
  }

  dispose() { this.el.remove(); }
}
