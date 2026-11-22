// Récords y opciones en localStorage (con try/catch por modo privado)
const KEY_REC = 'turboDuelo.records.v1';
const KEY_SET = 'turboDuelo.settings.v1';

function load(key, def) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ? { ...def, ...v } : { ...def }; } catch { return { ...def }; }
}
function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* sin almacenamiento */ } }

export const DEFAULT_SETTINGS = {
  laps: 3, items: false, difficulty: 1, rivals1p: 3, rivals2p: 0,
  autoAccel: true, split: 'auto', quality: 'auto', music: true, sfx: true, muted: false, showFps: false,
  p1: { car: 0, color: 0 }, p2: { car: 1, color: 1 }, track: 0,
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
