import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CARS } from '../cars/carData.js';
import { buildCarModel } from '../cars/CarModel.js';

// =====================================================================
//  Tráfico de la autopista: autos, camionetas y camiones que circulan
//  por sus carriles. Son obstáculos pesados: chocarlos frena y rebota.
// =====================================================================
const CIV_COLORS = [0xf2f2f2, 0x9aa4b4, 0x18181e, 0x1d4ed8, 0xd4141e, 0x8a6a42, 0x22b85a, 0xc9b27a];

function buildTruck(color) {
  const root = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.3 });
  const box = new THREE.MeshStandardMaterial({ color: [0xf2f2f2, 0xd9d9d0, 0x2f6fd0, 0xd9332b][(Math.random() * 4) | 0], roughness: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0b1220, roughness: 0.05, metalness: 0.6 });
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.6, 2.3).translate(0, 1.9, 4.1), paint);
  const win = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.9, 0.05).translate(0, 2.6, 5.27), glass);
  const trailer = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.2, 7.6).translate(0, 2.4, -0.9), box);
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.4, 10.4).translate(0, 0.7, 0.2), dark);
  const tails = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.15, 0.05).translate(0, 1.0, -4.72), new THREE.MeshBasicMaterial({ color: 0xc01020 }));
  root.add(cab, win, trailer, chassis, tails);
  const wheel = new THREE.CylinderGeometry(0.55, 0.55, 0.4, 14).rotateZ(Math.PI / 2);
  const wg = mergeGeometries([4.1, 1.2, -0.2, -3.6].flatMap(z => [1.1, -1.1].map(x => wheel.clone().translate(x, 0.55, z))));
  root.add(new THREE.Mesh(wg, dark));
  return { root, halfLen: 5.3, halfW: 1.35 };
}

export class Traffic {
  constructor(scene, track, count = 14) {
    this.scene = scene;
    this.track = track;
    this.vehicles = [];
    const m = track.main, L = track.length;
    const hw = m.hw[0];
    const lanes = [-0.72, -0.24, 0.24, 0.72].map(f => f * hw);
    const civs = CARS.filter(c => c.cls === 'C' || ['s4', 'gte', 'evolt'].includes(c.id));
    for (let i = 0; i < count; i++) {
      const truck = i % 4 === 0;
      let model;
      const color = CIV_COLORS[i % CIV_COLORS.length];
      if (truck) model = buildTruck(color);
      else {
        const def = civs[i % civs.length];
        const cm = buildCarModel(def, color);
        model = { root: cm.root, halfLen: cm.halfLength, halfW: 1.0, wheels: cm.wheels };
      }
      scene.add(model.root);
      const lane = (i * 3) % 4;
      this.vehicles.push({
        model, lane, lat: lanes[lane], targetLat: lanes[lane],
        s: 160 + (i / count) * (L - 300) + Math.random() * 30,
        speed: truck ? 19 + Math.random() * 3 : 23 + Math.random() * 7,
        x: 0, z: 0, y: 0, fx: 0, fz: 1, halfLen: model.halfLen, halfW: model.halfW, laneTimer: 4 + Math.random() * 8,
      });
    }
    this.lanes = lanes;
    this.tmp = {};
    this.update(0, null);
  }

  update(dt, race) {
    const m = this.track.main, L = this.track.length, p = this.tmp;
    for (const v of this.vehicles) {
      // a veces cambian de carril (con cuidado)
      v.laneTimer -= dt;
      if (v.laneTimer <= 0) {
        v.laneTimer = 6 + Math.random() * 10;
        const nl = Math.max(0, Math.min(3, v.lane + (Math.random() < 0.5 ? -1 : 1)));
        const free = this.vehicles.every(o => o === v || o.lane !== nl || Math.abs(((o.s - v.s + L * 1.5) % L) - L / 2) > 25);
        if (free) { v.lane = nl; v.targetLat = this.lanes[nl]; }
      }
      // no chocar al de adelante en el mismo carril
      let speed = v.speed;
      for (const o of this.vehicles) {
        if (o === v || Math.abs(o.lat - v.lat) > 3) continue;
        const gap = (o.s - v.s + L) % L;
        if (gap > 0 && gap < 18) speed = Math.min(speed, o.speed - 1);
      }
      v.cur = (v.cur ?? speed) + (speed - (v.cur ?? speed)) * Math.min(1, dt * 2);
      v.s = (v.s + v.cur * dt) % L;
      v.lat += (v.targetLat - v.lat) * Math.min(1, dt * 0.9);
      m.pointAt(v.s, v.lat, p);
      v.x = p.x; v.z = p.z; v.y = p.y; v.fx = p.fx; v.fz = p.fz;
      const r = v.model.root;
      r.position.set(p.x, p.y, p.z);
      r.rotation.y = Math.atan2(p.fx, p.fz) + (v.targetLat - v.lat) * -0.03;
      if (v.model.wheels) for (const w of v.model.wheels) w.spin.rotation.x += v.cur * dt / 0.36;
    }
    if (race) this.collide(race);
  }

  // choques auto–tráfico (el tráfico es muy pesado: no se mueve)
  collide(race) {
    for (const r of race.racers) {
      const c = r.car;
      for (const v of this.vehicles) {
        if (Math.abs(c.y - v.y) > 3) continue;
        const dx = c.x - v.x, dz = c.z - v.z;
        const along = dx * v.fx + dz * v.fz;
        const side = -dx * v.fz + dz * v.fx;
        const pa = v.halfLen + 2.0 - Math.abs(along);
        const ps = v.halfW + 1.0 - Math.abs(side);
        if (pa <= 0 || ps <= 0) continue;
        // normal de salida: por el eje con menor penetración
        let nx, nz, pen;
        if (ps < pa) { const sg = Math.sign(side) || 1; nx = -v.fz * sg; nz = v.fx * sg; pen = ps; }
        else { const sg = Math.sign(along) || 1; nx = v.fx * sg; nz = v.fz * sg; pen = pa; }
        c.x += nx * pen; c.z += nz * pen;
        // velocidad relativa al vehículo
        const tvx = v.fx * v.cur, tvz = v.fz * v.cur;
        const rvx = c.vx - tvx, rvz = c.vz - tvz;
        const vn = rvx * nx + rvz * nz;
        if (vn < 0) {
          const imp = -vn;
          c.vx += nx * imp * 1.4; c.vz += nz * imp * 1.4;
          const loss = Math.max(0.45, 1 - imp / 60);
          c.vx = tvx + (c.vx - tvx) * loss; c.vz = tvz + (c.vz - tvz) * loss;
          c.ev.bump = Math.max(c.ev.bump, imp);
          if (imp > 6 && c.drifting) { c.driftCharge = false; c.driftLevel = 0; }
        }
      }
    }
  }

  dispose() {
    for (const v of this.vehicles) this.scene.remove(v.model.root);
    this.vehicles = [];
  }
}
