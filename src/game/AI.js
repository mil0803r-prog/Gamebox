import { CONFIG } from '../config.js';

const H = CONFIG.handling;

// Niveles: Fácil, Normal, Difícil
export const AI_LEVELS = [
  { speed: 0.84, corner: 0.80, noise: 0.22, drift: 0.0, turbo: 0.35, rubber: 0.10, line: 0.6, react: 0.5, itemDelay: 3 },
  { speed: 0.94, corner: 0.90, noise: 0.10, drift: 0.5, turbo: 0.75, rubber: 0.06, line: 0.85, react: 0.25, itemDelay: 1.5 },
  { speed: 1.00, corner: 0.97, noise: 0.03, drift: 1.0, turbo: 1.0, rubber: 0.04, line: 1.0, react: 0.1, itemDelay: 0.5 },
];

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

export class AISystem {
  control(r, race, dt) {
    const c = r.car, tr = race.track, m = tr.main;
    const L = AI_LEVELS[r.aiLevel ?? 1] || AI_LEVELS[1];
    const ai = r.ai || (r.ai = { bias: 0, noise: 0, noiseT: 0, stuck: 0, reverse: 0, drift: false, itemT: 0, rubber: 1, seed: Math.random() * 10 });
    const out = { steer: 0, throttle: 0, brake: 0, drift: false, boost: false, item: false, itemPressed: false };

    const mp = c.q.tmp[0]; // proyección sobre el circuito principal
    if (!mp) return out;
    const s = c.progress;
    const speed = c.speed;
    const vmax = c.maxSpeed;

    // ---------- atascado / al revés
    const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
    const dirDot = fx * mp.fx + fz * mp.fz;
    if (race.state !== 'countdown' && (speed < 3 || dirDot < -0.2)) ai.stuck += dt; else ai.stuck = Math.max(0, ai.stuck - dt * 2);
    if (ai.stuck > 1.3 && ai.reverse <= 0) { ai.reverse = 1.1; ai.stuck = 0; }
    if (ai.reverse > 0) {
      ai.reverse -= dt;
      out.brake = 1;
      const side = mp.lat > 0 ? 1 : -1;
      out.steer = dirDot > 0 ? side : -side;
      return out;
    }

    // ---------- ruido y rubber-band
    ai.noiseT -= dt;
    if (ai.noiseT <= 0) { ai.noiseT = 0.4 + Math.random() * 0.6; ai.noise = (Math.random() - 0.5) * 2 * L.noise; }
    const humans = race.racers.filter(x => x.human && !x.finished);
    if (humans.length && !r.human) {
      const best = Math.max(...humans.map(x => x.raceDist));
      const diff = r.raceDist - best;
      const target = diff > 60 ? 1 - L.rubber : diff < -60 ? 1 + L.rubber : 1;
      ai.rubber += (target - ai.rubber) * Math.min(1, dt * 0.5);
    } else ai.rubber = 1;

    // ---------- evitar autos y adelantar
    let bias = ai.bias;
    for (const o of race.racers) {
      if (o === r) continue;
      const oc = o.car;
      const dx = oc.x - c.x, dz = oc.z - c.z;
      const along = dx * fx + dz * fz;
      if (along < 0 || along > 16) continue;
      const side = -dx * fz + dz * fx; // + = derecha
      if (Math.abs(side) < 3 && oc.speed < speed + 2) {
        const pref = mp.lat > 0 ? -1 : 1; // hacia donde hay más espacio
        bias += pref * dt * 6;
      }
    }
    // evitar manchas de aceite
    if (race.items) for (const oil of race.items.oils) {
      const dx = oil.x - c.x, dz = oil.z - c.z;
      const along = dx * fx + dz * fz;
      if (along > 0 && along < 25) {
        const side = -dx * fz + dz * fx;
        if (Math.abs(side) < 3) bias += (side > 0 ? -1 : 1) * dt * 8;
      }
    }
    ai.bias = clamp(bias * Math.exp(-dt * 0.6), -6, 6);

    // ---------- punto objetivo
    const look = 9 + speed * 0.42;
    const ti = m.indexAt(s + look);
    let lat = tr.racingOffset[ti] * L.line + ai.bias;
    const hw = m.hw[ti];
    lat = clamp(lat, -hw + 2.2, hw - 2.2);
    const p = m.pointAt(s + look, lat);
    const dx = p.x - c.x, dz = p.z - c.z;
    const ang = Math.atan2(dx * (-fz) + dz * fx, dx * fx + dz * fz);
    let steer = clamp(ang * 2.8 + ai.noise, -1, 1);

    // ---------- velocidad objetivo según curvas próximas
    const handling = c.sm.handling * c.trackGrip;
    const omega = v => H.turnRate * handling * (1 + (H.turnHighSpeedFactor - 1) * Math.min(1, v / H.maxSpeed));
    const decel = H.brake * 0.55;
    let target = vmax * L.speed * ai.rubber;
    const brakeDist = speed * speed / (2 * decel) + 20;
    for (let d = 0; d <= brakeDist; d += 5) {
      const k = tr.absCurv[m.indexAt(s + d)];
      if (k < 0.002) continue;
      let v = 60;
      for (let it = 0; it < 3; it++) v = omega(v) * 0.9 / k;
      v *= L.corner;
      if (ai.drift) v *= 1.15;
      const allowed = Math.sqrt(v * v + 2 * decel * Math.max(0, d - 8));
      if (allowed < target) target = allowed;
    }
    target = Math.max(14, target);

    out.throttle = speed < target ? 1 : 0;
    if (speed > target + 4) out.brake = clamp((speed - target) / 10, 0.3, 1);

    // ---------- derrape
    const kAhead = Math.max(tr.absCurv[m.indexAt(s + 15)], tr.absCurv[m.indexAt(s + 30)]);
    const canDrift = L.drift > 0 && (L.drift >= 1 || (ai.seed + race.time * 0.05) % 1 < L.drift);
    if (!ai.drift && canDrift && kAhead > 0.011 && speed > 24 && Math.abs(steer) > 0.35 && Math.abs(mp.lat) < hw - 4) ai.drift = true;
    if (ai.drift) {
      const kNow = tr.absCurv[m.indexAt(s + 8)];
      if (kNow < 0.005 || Math.abs(mp.lat) > hw - 2.5 || (c.drifting && c.driftLevel >= 3) || speed < 15) ai.drift = false;
      if (!c.drifting && speed > 15 && Math.abs(steer) < 0.3) ai.drift = false;
    }
    out.drift = ai.drift;
    if (ai.drift) { out.throttle = 1; out.brake = 0; }
    out.steer = steer;

    // ---------- turbo
    if (c.turboBar > 0.25 && Math.random() < L.turbo) {
      let straight = true;
      for (let d = 10; d < 140; d += 10) if (tr.absCurv[m.indexAt(s + d)] > 0.006) { straight = false; break; }
      if (straight && ai.rubber >= 1) ai.boosting = true;
    }
    if (ai.boosting && (c.turboBar <= 0.01 || tr.absCurv[m.indexAt(s + 40)] > 0.008)) ai.boosting = false;
    out.boost = !!ai.boosting;

    // ---------- ítems
    if (c.item) {
      ai.itemT += dt;
      if (ai.itemT > L.itemDelay) {
        let use = false;
        if (c.item === 'shield') use = true;
        if (c.item === 'turbo') use = tr.absCurv[m.indexAt(s + 40)] < 0.006;
        if (c.item === 'oil') {
          // alguien cerca detrás
          use = race.racers.some(o => o !== r && r.raceDist - o.raceDist > 4 && r.raceDist - o.raceDist < 40) || ai.itemT > 12;
        }
        if (use) { out.itemPressed = true; ai.itemT = 0; }
      }
    } else ai.itemT = 0;

    return out;
  }
}
