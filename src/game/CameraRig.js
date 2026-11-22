import * as THREE from 'three';
import { CONFIG } from '../config.js';

const C = CONFIG.camera;
export const CAM_MODES = ['interior', 'near', 'far', 'vfar'];
export const CAM_NAMES = { interior: 'INTERIOR', near: 'CERCANA', far: 'LEJANA', vfar: 'MUY LEJANA' };

function angLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export class CameraRig {
  constructor(index) {
    this.index = index;
    this.camera = new THREE.PerspectiveCamera(C.fov, 1, 0.3, 1700);
    this.camera.layers.enable(index + 1); // capa propia para efectos por jugador
    // capas 10/11 = auto de cada jugador en cámara interior: se ve el del otro, no el propio
    this.camera.layers.enable(10); this.camera.layers.enable(11);
    this.camera.layers.disable(10 + index);
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.yaw = 0;
    this.fov = C.fov;
    this.shake = 0;
    this.mode = 'near';
  }

  cycle() {
    this.mode = CAM_MODES[(CAM_MODES.indexOf(this.mode) + 1) % CAM_MODES.length];
    return this.mode;
  }

  // cámara desde el asiento del piloto
  updateInterior(dt, car) {
    const m = car.model, e = m.eye;
    const h = car.heading + (m.body.rotation ? -m.body.rotation.y * 0.5 : 0);
    const fx = Math.sin(h), fz = Math.cos(h);
    const lx = fz, lz = -fx; // izquierda
    const cam = this.camera;
    cam.position.set(car.x + fx * e.z + lx * e.x, car.y + e.y, car.z + fz * e.z + lz * e.x);
    this.look.set(cam.position.x + fx * 30, cam.position.y - 0.9 + Math.sin(-car.pitch) * 30 * 0.6, cam.position.z + fz * 30);
    cam.up.set(Math.cos(h) * car.roll * 0.6, 1, -Math.sin(h) * car.roll * 0.6);
    cam.lookAt(this.look);
    const ratio = Math.min(1.3, car.speed / CONFIG.handling.maxSpeed);
    const tf = C.interiorFov + 8 * Math.min(1, ratio) + (car.boosting ? 6 : 0);
    this.fov += (tf - this.fov) * Math.min(1, dt * 4);
    if (Math.abs(cam.fov - this.fov) > 0.05) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
    // vibración leve con turbo
    if (car.usingTurbo) { cam.position.x += (Math.random() - 0.5) * 0.03; cam.position.y += (Math.random() - 0.5) * 0.03; }
    this.yaw = car.heading;
    this.pos.copy(cam.position);
  }

  snap(car) {
    this.yaw = car.heading;
    this.update(0, car, true);
  }

  update(dt, car, snap = false) {
    if (this.mode === 'interior') { this.updateInterior(dt, car); return; }
    this.camera.up.set(0, 1, 0);
    const speed = car.speed;
    const ratio = Math.min(1.3, speed / CONFIG.handling.maxSpeed);
    // dirección: mezcla del rumbo del auto y de la velocidad (se ve el derrape)
    let target = car.heading;
    if (speed > 6 && car.vf > 0) {
      const vel = Math.atan2(car.vx, car.vz);
      target = angLerp(car.heading, vel, car.drifting ? 0.55 : 0.3);
    }
    if (car.spinTimer > 0) target = this.yaw; // no girar la cámara con el trompo
    this.yaw = snap ? target : angLerp(this.yaw, target, 1 - Math.exp(-C.yawSmooth * dt));

    const V = this.mode === 'far' ? C.far : this.mode === 'vfar' ? C.vfar : C;
    const dist = V.distance + V.distanceSpeedAdd * ratio;
    const h = V.height + V.heightSpeedAdd * ratio;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const tx = car.x - fx * dist, tz = car.z - fz * dist;
    const ty = car.y + h;
    if (snap) this.pos.set(tx, ty, tz);
    else {
      const k = 1 - Math.exp(-C.posSmooth * dt);
      this.pos.x += (tx - this.pos.x) * k;
      this.pos.z += (tz - this.pos.z) * k;
      this.pos.y += (ty - this.pos.y) * (1 - Math.exp(-C.posSmooth * 0.7 * dt));
    }
    // mantener la distancia horizontal estable (evita que se acerque demasiado a alta velocidad)
    const dx = this.pos.x - car.x, dz = this.pos.z - car.z;
    const d = Math.hypot(dx, dz);
    const maxD = dist * (V.maxStretch || 1.25);
    if (d > maxD) { this.pos.x = car.x + dx / d * maxD; this.pos.z = car.z + dz / d * maxD; }
    if (this.pos.y < car.y + 1.2) this.pos.y = car.y + 1.2;

    this.look.set(car.x + fx * V.lookAhead, car.y + V.lookHeight, car.z + fz * V.lookAhead);

    // FOV con la velocidad y el turbo
    const boost = car.boosting ? 1 : 0;
    const tf = C.fov + C.fovSpeedAdd * Math.min(1, ratio) + CONFIG.turbo.fovAdd * boost;
    this.fov = snap ? tf : this.fov + (tf - this.fov) * (1 - Math.exp(-C.fovSmooth * dt));

    const cam = this.camera;
    cam.position.copy(this.pos);
    // vibración leve con turbo
    const targetShake = car.usingTurbo ? CONFIG.turbo.shake : car.boosting ? CONFIG.turbo.shake * 0.6 : 0;
    this.shake += (targetShake - this.shake) * Math.min(1, dt * 6);
    if (this.shake > 0.001) {
      cam.position.x += (Math.random() - 0.5) * this.shake * 2;
      cam.position.y += (Math.random() - 0.5) * this.shake * 2;
    }
    cam.lookAt(this.look);
    if (Math.abs(cam.fov - this.fov) > 0.05) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
  }
}
