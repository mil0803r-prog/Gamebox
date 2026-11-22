// Récords y opciones en localStorage (con try/catch por modo privado)
const KEY_REC = 'turboDuelo.records.v1';
const KEY_SET = 'turboDuelo.settings.v1';
const KEY_PRO = 'turboDuelo.profile.v1';

function load(key, def) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ? { ...def, ...v } : { ...def }; } catch { return { ...def }; }
}
function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* sin almacenamiento */ } }

export const DEFAULT_SETTINGS = {
  laps: 3, items: false, difficulty: 1, rivals1p: 3, rivals2p: 0,
  autoAccel: true, showKeys: true, steerMode: 'buttons', tiltSens: 'medium', tiltInvert: false, orientation: 'landscape', split: 'auto', quality: 'auto', music: true, sfx: true, muted: false, showFps: false,
  p1: { car: 'rayo', color: -1 }, p2: { car: 'pulga', color: -1 }, track: 0,
};

export const Settings = {
  data: load(KEY_SET, DEFAULT_SETTINGS),
  save() { save(KEY_SET, this.data); },
};

export const Records = {
  data: load(KEY_REC, {}),
  get(trackId) { return this.data[trackId] || {}; },
  // devuelve {lap: bool, race: bool} si son nuevos récords
  submit(trackId, laps, lapTimes, total, who) {
    const r = this.data[trackId] || (this.data[trackId] = {});
    const res = { lap: false, race: false };
    const best = Math.min(...lapTimes);
    if (isFinite(best) && (!r.bestLap || best < r.bestLap.t)) { r.bestLap = { t: best, who }; res.lap = true; }
    const k = 'race' + laps;
    if (isFinite(total) && (!r[k] || total < r[k].t)) { r[k] = { t: total, who }; res.race = true; }
    save(KEY_REC, this.data);
    return res;
  },
  clear() { this.data = {}; save(KEY_REC, this.data); },
};

// ---------------------------------------------------------------- dinero y garaje
export const START_MONEY = 25000;
export const Profile = {
  data: load(KEY_PRO, { money: START_MONEY, owned: ['pulga', 'rayo'], earned: 0 }),
  save() { save(KEY_PRO, this.data); },
  owns(id) { return this.data.owned.includes(id); },
  canAfford(price) { return this.data.money >= price; },
  buy(car) {
    if (this.owns(car.id) || this.data.money < car.price) return false;
    this.data.money -= car.price;
    this.data.owned.push(car.id);
    this.save();
    return true;
  },
  earn(n) { this.data.money += n; this.data.earned = (this.data.earned || 0) + n; this.save(); },
};

// migración de opciones antiguas (autos por índice)
for (const k of ['p1', 'p2']) {
  const p = Settings.data[k];
  if (!p || typeof p.car !== 'string') Settings.data[k] = { ...DEFAULT_SETTINGS[k] };
  if (!Profile.owns(Settings.data[k].car)) Settings.data[k].car = k === 'p1' ? 'rayo' : 'pulga';
  if (typeof Settings.data[k].color !== 'number' || Settings.data[k].color > 11) Settings.data[k].color = -1;
}
