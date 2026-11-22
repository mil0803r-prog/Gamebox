import { CONFIG } from '../config.js';
import { Car } from '../cars/Car.js';

const SUB = 1 / 120; // subpaso de física

export class Race {
  constructor(track, entries, opts) {
    this.track = track;
    this.opts = opts;
    this.laps = opts.laps || CONFIG.race.laps;
    this.numCp = CONFIG.race.checkpoints;
    this.cpS = [];
    for (let k = 0; k < this.numCp; k++) this.cpS.push((k + 0.5) / this.numCp * track.length);
    this.racers = entries.map((e, i) => {
      const car = new Car(track, e.car, e.color, i);
      return {
        index: i, car, name: e.name, human: e.human, humanIndex: e.humanIndex, ai: null, aiLevel: e.aiLevel,
        lap: 0, nextCp: this.numCp, lapStart: 0, lapTimes: [], finished: false, finishTime: 0, place: i + 1,
        prevProgress: 0, wrongWay: 0, coins: 0, bonus: 0, color: e.color, carDef: e.car, raceDist: 0, padCooldown: 0,
      };
    });
    this.placeGrid();
    this.time = -CONFIG.race.countdownStep * 3; // cuenta regresiva negativa
    this.state = 'countdown';
    this.finishOrder = [];
    this.events = []; // eventos para UI/sonido {type, racer, ...}
  }

  placeGrid() {
    const L = this.track.length;
    this.racers.forEach((r, i) => {
      const row = Math.floor(i / 2), col = i % 2;
      const s = L - 10 - row * 9 - col * 3;
      const p = this.track.main.pointAt(s, (col ? 1 : -1) * 4.2);
      r.car.reset(p.x, p.z, Math.atan2(p.fx, p.fz));
      r.prevProgress = r.car.progress;
      r.raceDist = this.raceDistOf(r);
    });
  }

  raceDistOf(r) { return (r.lap - 1) * this.track.length + r.car.progress; }

  get countdownValue() { // 3,2,1,0(=¡YA!)
    if (this.time >= 0) return 0;
    return Math.ceil(-this.time / CONFIG.race.countdownStep);
  }

  update(dt, inputs, aiSystem, items, pickups) {
    const prevCount = this.countdownValue;
    this.time += dt;
    if (this.state === 'countdown') {
      const c = this.countdownValue;
      if (c !== prevCount) this.events.push({ type: 'count', value: c });
      if (this.time >= 0) {
        this.state = 'racing';
        this.racers.forEach(r => { r.lapStart = 0; });
      }
    }
    const racing = this.state !== 'countdown';
    const zero = { steer: 0, throttle: 0, brake: 0, drift: false, boost: false };

    // entradas por corredor
    const ins = this.racers.map(r => {
      if (!racing) return zero;
      if (r.finished && r.human) {
        // al terminar, la IA conduce el auto del jugador
        return aiSystem ? aiSystem.control(r, this, dt) : zero;
      }
      if (r.human) return inputs[r.humanIndex] || zero;
      return aiSystem ? aiSystem.control(r, this, dt) : zero;
    });

    for (const r of this.racers) {
      const c = r.car;
      c.ev.wall = 0; c.ev.land = 0; c.ev.miniTurbo = 0; c.ev.pad = false; c.ev.bump = 0; c.ev.backfire = false;
    }
    const steps = Math.max(1, Math.ceil(dt / SUB));
    const h = dt / steps;
    for (let s = 0; s < steps; s++) {
      for (let i = 0; i < this.racers.length; i++) this.racers[i].car.step(h, ins[i], this.time);
      this.collideCars();
    }
    if (this.traffic) this.traffic.update(dt, this);
    if (racing) {
      this.updateSlipstream(dt);
      this.updatePads(dt);
      for (const r of this.racers) {
        if (r.car.shieldTimer > 0) r.car.shieldTimer -= dt;
        if (r.car.magnetTimer > 0) r.car.magnetTimer -= dt;
      }
      if (items) items.update(dt, this, ins);
      if (pickups) pickups.update(dt, this);
      for (const r of this.racers) this.updateProgress(r, dt);
      this.updatePlaces();
    }
    for (const r of this.racers) r.car.updateVisual(dt);
  }

  collideCars() {
    const R = CONFIG.handling.carRadius;
    const rs = this.racers;
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
      const a = rs[i].car, b = rs[j].car;
      if (Math.abs(a.y - b.y) > 2) continue;
      // dos círculos por auto (delante y detrás) para que se sienta más largo
      let dx = b.x - a.x, dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      const minD = R * 2.15;
      if (d >= minD || d < 1e-4) continue;
      const nx = dx / d, nz = dz / d;
      const ima = a.shieldTimer > 0 ? 0.15 : 1 / a.mass;
      const imb = b.shieldTimer > 0 ? 0.15 : 1 / b.mass;
      const sum = ima + imb;
      const overlap = minD - d;
      a.x -= nx * overlap * ima / sum; a.z -= nz * overlap * ima / sum;
      b.x += nx * overlap * imb / sum; b.z += nz * overlap * imb / sum;
      const rv = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
      if (rv < 0) {
        const e = CONFIG.handling.carBumpRestitution;
        const jimp = (-(1 + e) * rv + CONFIG.handling.carBumpExtra) / sum;
        a.vx -= jimp * ima * nx; a.vz -= jimp * ima * nz;
        b.vx += jimp * imb * nx; b.vz += jimp * imb * nz;
        const strength = -rv;
        a.ev.bump = Math.max(a.ev.bump, strength); b.ev.bump = Math.max(b.ev.bump, strength);
        if (strength > 6) {
          if (a.drifting && a.shieldTimer <= 0) { a.driftCharge = false; a.driftLevel = 0; }
          if (b.drifting && b.shieldTimer <= 0) { b.driftCharge = false; b.driftLevel = 0; }
        }
      }
    }
  }

  updateSlipstream(dt) {
    const S = CONFIG.slipstream;
    for (const r of this.racers) {
      const c = r.car;
      let behind = false;
      if (c.speed > 20 && !c.airborne) {
        const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
        for (const o of this.racers) {
          if (o === r) continue;
          const oc = o.car;
          const dx = oc.x - c.x, dz = oc.z - c.z;
          const along = dx * fx + dz * fz;
          const side = Math.abs(-dx * fz + dz * fx);
          if (along > S.minDist && along < S.maxDist && side < S.maxLateral && oc.speed > 15) { behind = true; break; }
        }
      }
      if (behind) c.slipTime += dt; else c.slipTime = Math.max(0, c.slipTime - dt * 2);
      c.slipActive = behind && c.slipTime >= S.timeToActivate;
      if (c.slipActive) c.turboBar = Math.min(1, c.turboBar + S.barChargeRate * dt);
    }
  }

  updatePads(dt) {
    const T = CONFIG.turbo;
    for (const r of this.racers) {
      const c = r.car;
      r.padCooldown -= dt;
      if (c.airborne || r.padCooldown > 0) continue;
      for (const p of this.track.pads) {
        const dx = c.x - p.x, dz = c.z - p.z;
        const along = dx * p.fx + dz * p.fz;
        const side = -dx * p.fz + dz * p.fx;
        if (Math.abs(along) < p.len / 2 + 1 && Math.abs(side) < p.w / 2 + 0.8 && Math.abs(c.y - p.y) < 2.5) {
          c.addBoost(T.padTime, T.padAccel, T.padSpeedMul, 0x33ddff);
          c.ev.pad = true;
          r.padCooldown = 0.6;
          break;
        }
      }
    }
  }

  updateProgress(r, dt) {
    const L = this.track.length;
    const s = r.car.progress, ps = r.prevProgress;
    r.prevProgress = s;
    if (r.finished) return;
    // checkpoints en orden
    if (r.nextCp < this.numCp) {
      const cs = this.cpS[r.nextCp];
      if (ps < cs && s >= cs && s - ps < 60) r.nextCp++;
    }
    // cruzar la meta hacia adelante
    if (ps > L * 0.75 && s < L * 0.25) {
      if (r.nextCp >= this.numCp) {
        const now = this.time;
        if (r.lap >= 1) r.lapTimes.push(now - r.lapStart);
        r.prevLapStart = r.lapStart;
        r.lap++;
        r.lapStart = now;
        r.nextCp = 0;
        if (r.lap > this.laps) {
          r.finished = true;
          r.finishTime = now;
          r.lap = this.laps;
          this.finishOrder.push(r);
          r.place = this.finishOrder.length;
          this.events.push({ type: 'finish', racer: r });
        } else {
          this.events.push({ type: 'lap', racer: r, lap: r.lap });
        }
      }
    } else if (ps < L * 0.25 && s > L * 0.75) {
      // retrocedió sobre la meta
      if (r.nextCp === 0 && r.lap >= 1) {
        r.lap--; r.nextCp = this.numCp;
        if (r.lap >= 1 && r.lapTimes.length) r.lapTimes.pop();
        r.lapStart = r.prevLapStart || 0;
      }
    }
    // sentido contrario
    const c = r.car;
    const p = c.q.proj;
    if (p) {
      const vd = c.vx * p.fx + c.vz * p.fz;
      if (vd < -4) r.wrongWay += dt; else r.wrongWay = Math.max(0, r.wrongWay - dt * 2);
    }
    r.raceDist = this.raceDistOf(r);
  }

  updatePlaces() {
    const unfinished = this.racers.filter(r => !r.finished).sort((a, b) => b.raceDist - a.raceDist);
    unfinished.forEach((r, i) => { r.place = this.finishOrder.length + i + 1; });
    const humans = this.racers.filter(r => r.human);
    if (this.state === 'racing' && humans.length && humans.every(r => r.finished)) {
      this.state = 'finished';
      this.finishedAt = this.time;
      this.events.push({ type: 'allFinished' });
    }
  }
}
