import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { buildCarModel } from './CarModel.js';

const H = CONFIG.handling;
const D = CONFIG.drift;
const T = CONFIG.turbo;

export class Car {
  constructor(track, def, color, index) {
    this.track = track;
    this.def = def;
    this.color = color;
    this.index = index;
    this.mass = def.mass;
    this.sm = { ...def.phys }; // multiplicadores derivados del catálogo (carData.js)
    this.displayScale = def.displayScale || 1;
    this.trackGrip = track.def.grip || 1;
    this.model = buildCarModel(def, color, { night: track.def.theme === 'city' });
    this.q = track.newQuery();
    this.reset(0, 0, 0);
  }

  reset(x, z, heading) {
    this.x = x; this.z = z; this.heading = heading;
    this.vx = 0; this.vz = 0; this.vf = 0; this.vr = 0;
    this.track.query(x, z, this.q.hints, this.q, 1);
    this.y = this.q.groundY; this.vy = 0;
    this.airborne = false; this.airTime = 0;
    this.steer = 0;
    this.turboBar = T.startBar;
    this.boostTimer = 0; this.boostAccel = 0; this.boostMul = 1;
    this.usingTurbo = false;
    // derrape
    this.drifting = false; this.driftDir = 0; this.driftTime = 0; this.driftLevel = 0; this.driftCharge = true;
    this.driftVisual = 0;
    // rebufo
    this.slipTime = 0; this.slipActive = false;
    // ítems
    this.shieldTimer = 0; this.spinTimer = 0; this.item = null; this.magnetTimer = 0;
    // eventos de este frame (para sonido / efectos)
    this.ev = { wall: 0, land: 0, miniTurbo: 0, pad: false, bump: 0, backfire: false };
    this.progress = this.q.progress;
    this.surface = 0;
    this.wheelRot = 0;
    this.pitch = 0; this.roll = 0;
    this.lastWallTime = -10;
  }

  get speed() { return Math.hypot(this.vx, this.vz); }
  get maxSpeed() { return H.maxSpeed * this.sm.speed; }
  get boosting() { return this.boostTimer > 0 || this.usingTurbo; }

  addBoost(time, accel, mul, color = 0x33ddff) {
    this.boostColor = color;
    this.boostTimer = Math.max(this.boostTimer, time);
    this.boostAccel = Math.max(this.boostTimer > 0 ? this.boostAccel : 0, accel);
    this.boostMul = Math.max(this.boostMul, mul);
  }

  step(dt, inp, time) {
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const rx = -fz, rz = fx;
    let vf = this.vx * fx + this.vz * fz;
    let vr = this.vx * rx + this.vz * rz;

    const spinning = this.spinTimer > 0;
    if (spinning) this.spinTimer -= dt;
    const steerIn = spinning ? 0 : inp.steer;
    this.steer += (steerIn - this.steer) * Math.min(1, H.steerResponse * dt);
    const throttle = spinning ? 0 : inp.throttle;
    const brake = spinning ? 0 : inp.brake;
    this.braking = brake > 0 && this.vf > 1;
    this.throttleIn = throttle;

    // ---------- turbo
    let mul = 1, extra = 0;
    this.usingTurbo = false;
    if (inp.boost && this.turboBar > 0 && !spinning) {
      this.turboBar = Math.max(0, this.turboBar - T.drainRate * dt);
      this.usingTurbo = true;
      mul = T.speedMul * (0.5 + 0.5 * this.sm.turbo);
      extra = T.accel * this.sm.turbo;
    }
    if (this.boostTimer > 0) {
      this.boostTimer -= dt;
      mul = Math.max(mul, this.boostMul);
      extra = Math.max(extra, this.boostAccel);
      if (this.boostTimer <= 0) { this.boostMul = 1; this.boostAccel = 0; }
    }
    if (this.slipActive) mul *= CONFIG.slipstream.speedMul;
    const vmax = this.maxSpeed * mul;

    // ---------- derrape: entrar / salir
    const absV = Math.abs(vf);
    if (!this.drifting && inp.drift && !this.airborne && !spinning && Math.abs(inp.steer) > 0.3 && vf > D.minSpeed) {
      this.drifting = true;
      this.driftDir = Math.sign(inp.steer);
      this.driftTime = 0; this.driftLevel = 0; this.driftCharge = true;
    }
    if (this.drifting && (!inp.drift || vf < D.minSpeed * 0.6 || spinning)) {
      this.endDrift(!inp.drift && !spinning);
    }

    let yawRate = 0;
    if (!this.airborne) {
      // ---------- aceleración longitudinal
      if (throttle > 0 && vf < vmax) {
        const ratio = Math.max(0, vf) / vmax;
        vf += H.accel * this.sm.accel * throttle * (1 - Math.pow(ratio, H.accelFalloff)) * dt;
      }
      if (brake > 0) {
        if (vf > 0.5) vf -= H.brake * brake * dt;
        else if (vf > -H.reverseMax) vf -= H.reverseAccel * brake * dt;
      }
      if (throttle <= 0 && brake <= 0) {
        const c = H.coastDecel * dt;
        vf = Math.abs(vf) < c ? 0 : vf - Math.sign(vf) * c;
      }
      if (extra > 0 && vf < vmax) vf += extra * dt;
      if (vf > vmax) vf -= (vf - vmax) * H.overSpeedDecay * dt;

      // ---------- dirección
      const speedRatio = Math.min(1, absV / H.maxSpeed);
      const avail = Math.min(1, absV / H.turnFullSpeed) * (1 + (H.turnHighSpeedFactor - 1) * speedRatio);
      let grip = H.grip * this.sm.handling * this.trackGrip, keep = H.gripMomentumKeep;
      if (this.drifting) {
        const s = D.baseTurn * this.driftDir + this.steer * D.steerRange;
        yawRate = -s * (0.85 + 0.15 * this.sm.handling);
        grip = D.grip * this.trackGrip; keep = D.momentumKeep;
        vf -= vf * D.speedLoss * dt;
        this.driftTime += dt;
        if (this.driftCharge) {
          let lvl = 0;
          for (let k = 0; k < D.levelTimes.length; k++) if (this.driftTime >= D.levelTimes[k]) lvl = k + 1;
          this.driftLevel = lvl;
        }
        this.turboBar = Math.min(1, this.turboBar + D.barChargeRate * dt);
      } else {
        yawRate = -this.steer * H.turnRate * this.sm.handling * avail * (vf >= 0 ? 1 : -1);
      }
      if (spinning) { yawRate = 9; grip = 1.2; }
      // ---------- agarre lateral
      // la velocidad lateral perdida se convierte parcialmente en avance (sin crear energía)
      const sp0 = Math.hypot(vf, vr);
      const nvr = vr * Math.exp(-grip * dt);
      const sp1 = Math.hypot(vf, nvr);
      const target = sp1 + (sp0 - sp1) * keep;
      vf = (vf >= 0 ? 1 : -1) * Math.sqrt(Math.max(0, target * target - nvr * nvr));
      vr = nvr;
    } else {
      yawRate = -this.steer * H.turnRate * H.airControl;
      this.airTime += dt;
      if (this.airTime > 0.25) this.driftCharge = false, this.driftLevel = 0;
      if (spinning) yawRate = 9;
    }

    this.heading += yawRate * dt;
    this.vx = vf * fx + vr * rx;
    this.vz = vf * fz + vr * rz;
    this.vf = vf; this.vr = vr;

    this.x += this.vx * dt;
    this.z += this.vz * dt;

    this.collideTrack(dt, time);
  }

  endDrift(release) {
    if (release && this.driftLevel > 0 && this.driftCharge) {
      const l = this.driftLevel - 1;
      this.addBoost(D.miniTurboTime[l], D.miniTurboAccel, D.miniTurboSpeedMul + l * 0.04, D.sparkColors[this.driftLevel]);
      this.ev.miniTurbo = this.driftLevel;
    }
    this.drifting = false; this.driftLevel = 0; this.driftTime = 0;
  }

  collideTrack(dt, time) {
    const q = this.track.query(this.x, this.z, this.q.hints, this.q, H.carRadius * 0.85);
    this.surface = q.surface;
    this.progress = q.progress;
    if (!q.inside) {
      const p = q.proj;
      const excess = Math.abs(p.lat) - (p.hw - H.carRadius * 0.85);
      if (excess > 0) {
        const sg = Math.sign(p.lat);
        const nx = -p.fz * sg, nz = p.fx * sg; // normal hacia afuera
        this.x -= nx * excess; this.z -= nz * excess;
        const vn = this.vx * nx + this.vz * nz;
        if (vn > 0) {
          const sp = this.speed || 1;
          const frontal = vn / sp; // 0 = roce, 1 = de frente
          this.vx -= (1 + H.wallBounce) * vn * nx;
          this.vz -= (1 + H.wallBounce) * vn * nz;
          const loss = 1 - H.wallSpeedLoss * frontal * frontal - 0.04;
          this.vx *= loss; this.vz *= loss;
          if (vn > 3) {
            this.ev.wall = Math.max(this.ev.wall, vn);
            this.lastWallTime = time;
            if (this.drifting) { this.driftCharge = false; this.driftLevel = 0; }
            if (vn > 9 && this.drifting) this.endDrift(false);
          }
          // orientar levemente el auto con la pared
          const tx = p.fx, tz = p.fz;
          const along = this.vx * tx + this.vz * tz;
          const target = Math.atan2(tx * Math.sign(along || 1), tz * Math.sign(along || 1));
          let d = target - this.heading;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          if (Math.abs(d) < 1.2) this.heading += d * Math.min(1, frontal * 0.6);
        }
      }
    }
    // ---------- vertical
    const gy = q.groundY;
    if (this.airborne) {
      this.vy -= H.gravity * dt;
      this.y += this.vy * dt;
      if (this.y <= gy) {
        this.ev.land = Math.max(this.ev.land, -this.vy);
        this.y = gy; this.vy = 0; this.airborne = false;
        this.airTime = 0;
      }
    } else {
      const pred = this.y + this.vy * dt;
      if (pred > gy + 0.25 && this.vy > 2) {
        this.airborne = true; this.y = pred; this.airTime = 0;
      } else {
        const nvy = (gy - this.y) / Math.max(dt, 1e-4);
        this.vy = Math.max(-30, Math.min(30, nvy));
        this.y = gy;
      }
    }
    if (this.y < gy - 0.5) this.y = gy; // seguridad
  }

  // ---------- visual
  updateVisual(dt) {
    const m = this.model;
    m.root.position.set(this.x, this.y, this.z);
    m.root.rotation.y = this.heading;
    // inclinación por pendiente
    const q = this.q;
    let slope = q.proj ? q.proj.slope + q.rampSlope : 0;
    let along = q.proj ? Math.sin(this.heading) * q.proj.fx + Math.cos(this.heading) * q.proj.fz : 1;
    let targetPitch = -Math.atan(slope * along);
    if (this.airborne) targetPitch = -Math.atan2(this.vy, Math.max(10, Math.abs(this.vf))) * 0.7;
    this.pitch += (targetPitch - this.pitch) * Math.min(1, dt * (this.airborne ? 4 : 14));
    const targetRoll = this.drifting ? this.driftDir * 0.06 : this.steer * Math.min(1, Math.abs(this.vf) / 40) * 0.07;
    this.roll += (targetRoll - this.roll) * Math.min(1, dt * 8);
    m.root.rotation.x = this.pitch;
    m.root.rotation.order = 'YXZ';
    const dv = this.drifting ? this.driftDir * D.visualAngle : 0;
    this.driftVisual += (dv - this.driftVisual) * Math.min(1, dt * 8);
    m.body.rotation.y = -this.driftVisual;
    m.body.rotation.z = this.roll;
    this.wheelRot += this.vf * dt / 0.42;
    for (const w of m.wheels) {
      w.spin.rotation.x = this.wheelRot;
      if (w.front) w.pivot.rotation.y = -this.steer * 0.45;
    }
    // llamas
    const fl = this.boosting;
    // petardeo al soltar el turbo: fogonazo naranja corto
    if (this._wasBoosting && !fl) { this.backfireT = 0.2; this.ev.backfire = true; }
    this._wasBoosting = fl;
    if (this.backfireT > 0) this.backfireT -= dt;
    const target = fl ? (this.usingTurbo ? 1.3 : 1.0) : (this.backfireT > 0 ? 0.7 : 0);
    this.flamePower = (this.flamePower || 0) + (target - (this.flamePower || 0)) * Math.min(1, dt * 14);
    const fcol = this.backfireT > 0 && !fl ? 0xff7a1a : this.usingTurbo ? 0x2a7bff : (this.boostColor || 0x33ddff);
    m.setFlames(this.flamePower, fcol, performance.now() / 1000);
    const blur = Math.abs(this.vf) > 30;
    if (blur !== this._blurShown) { this._blurShown = blur; m.setBlur(blur); }
    if (this.braking !== this._brakeShown) { this._brakeShown = this.braking; m.setBraking(!!this.braking); }
    m.shield.visible = this.shieldTimer > 0;
    if (m.shield.visible) m.shield.rotation.y += dt * 2;
  }
}
