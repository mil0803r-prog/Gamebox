import { Minimap } from './Minimap.js';
import { CONFIG } from '../config.js';

const ORD = n => n + 'º';
export function fmtTime(t) {
  if (t === undefined || t === null || !isFinite(t)) return '--:--.--';
  t = Math.max(0, t);
  const m = Math.floor(t / 60), s = Math.floor(t % 60), c = Math.floor((t * 100) % 100);
  return `${m}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
}
const ITEM_ICON = { turbo: '🔥', oil: '🛢️', shield: '🛡️' };

// HUD de un jugador, posicionado sobre su viewport
export class PlayerHUD {
  constructor(parent, track, racer, opts) {
    this.racer = racer;
    this.opts = opts;
    const el = this.el = document.createElement('div');
    el.className = 'phud';
    el.innerHTML = `
      <div class="ph-tl">
        <div class="ph-pos"><span class="ph-posn">1º</span><span class="ph-post">/2</span></div>
        <div class="ph-lap">VUELTA <b class="ph-lapn">1/3</b></div>
        <div class="ph-time">0:00.00</div>
      </div>
      <div class="ph-tr"></div>
      <div class="ph-item ${opts.items ? '' : 'hidden'}"><span></span></div>
      <div class="ph-br">
        <div class="ph-speed"><span class="ph-spd">0</span><small>km/h</small></div>
        <div class="ph-turbo"><div class="ph-turbo-fill"></div><div class="ph-turbo-label">TURBO</div></div>
      </div>
      <div class="ph-center"><div class="ph-msg"></div><div class="ph-sub"></div></div>
      <div class="ph-wrong hidden">⟲ ¡SENTIDO CONTRARIO!</div>
      <div class="ph-tag">J${racer.humanIndex + 1}</div>
    `;
    parent.appendChild(el);
    this.q = s => el.querySelector(s);
    this.posn = this.q('.ph-posn'); this.post = this.q('.ph-post');
    this.lapn = this.q('.ph-lapn'); this.time = this.q('.ph-time');
    this.spd = this.q('.ph-spd'); this.fill = this.q('.ph-turbo-fill'); this.turbo = this.q('.ph-turbo');
    this.msg = this.q('.ph-msg'); this.sub = this.q('.ph-sub'); this.wrong = this.q('.ph-wrong');
    this.itemEl = this.q('.ph-item span');
    this.minimap = new Minimap(track, 120);
    this.q('.ph-tr').appendChild(this.minimap.canvas);
    this.msgTimer = 0;
    this.last = {};
    this.mapTimer = 0;
  }

  layout(v) {
    const s = this.el.style;
    s.left = v.x + 'px'; s.top = v.y + 'px'; s.width = v.w + 'px'; s.height = v.h + 'px';
    const base = Math.max(11, Math.min(v.w / 26, v.h / 15, 30));
    s.fontSize = base + 'px';
    const mm = Math.round(Math.min(v.w * 0.26, v.h * 0.34, 190));
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

  update(dt, race) {
    const r = this.racer, c = r.car;
    this.set('pos', this.posn, ORD(r.place));
    this.set('post', this.post, '/' + race.racers.length);
    this.set('lap', this.lapn, `${Math.max(1, Math.min(r.lap, race.laps))}/${race.laps}`);
    const t = r.finished ? r.finishTime : Math.max(0, race.time);
    this.set('time', this.time, fmtTime(t));
    this.set('spd', this.spd, String(Math.round(c.speed * 3.6)));
    const pct = Math.round(c.turboBar * 100);
    if (this.last.pct !== pct) { this.last.pct = pct; this.fill.style.transform = `scaleX(${c.turboBar})`; }
    let tcls = 'ph-turbo';
    if (c.turboBar >= 0.999) tcls += ' full';
    if (c.usingTurbo) tcls += ' active';
    if (c.drifting && c.driftLevel > 0 && c.driftCharge) tcls += ' lvl' + c.driftLevel;
    if (c.slipActive) tcls += ' slip';
    this.set('tcls', this.turbo, tcls, 'className');
    this.set('wrong', this.wrong, r.wrongWay > 1.2 && !r.finished ? 'ph-wrong' : 'ph-wrong hidden', 'className');
    if (this.opts.items) this.set('item', this.itemEl, c.item ? ITEM_ICON[c.item] : '');
    if (this.msgTimer > 0) {
      this.msgTimer -= dt;
      if (this.msgTimer <= 0) { this.msg.className = 'ph-msg'; this.sub.textContent = ''; }
    }
    this.mapTimer -= dt;
    if (this.mapTimer <= 0) { this.mapTimer = 1 / 30; this.minimap.draw(race.racers, r.index); }
  }

  dispose() { this.el.remove(); }
}

export const COUNT_TEXT = { 3: '3', 2: '2', 1: '1', 0: '¡YA!' };
export { CONFIG };
