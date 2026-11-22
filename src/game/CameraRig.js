import * as THREE from 'three';
import { CONFIG } from '../config.js';

const C = CONFIG.camera;

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
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.yaw = 0;
    this.fov = C.fov;
    this.shake = 0;
  }

  snap(car) {
    this.yaw = car.heading;
    this.update(0, car, true);
  }

  update(dt, car, snap = false) {
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

    const dist = C.distance + C.distanceSpeedAdd * ratio;
    const h = C.height + C.heightSpeedAdd * ratio;
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
    if (d > dist * 1.25) { this.pos.x = car.x + dx / d * dist * 1.25; this.pos.z = car.z + dz / d * dist * 1.25; }
    if (this.pos.y < car.y + 1.2) this.pos.y = car.y + 1.2;

    this.look.set(car.x + fx * C.lookAhead, car.y + C.lookHeight, car.z + fz * C.lookAhead);

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
