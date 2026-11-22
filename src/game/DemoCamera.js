import * as THREE from 'three';
import { CameraRig } from './CameraRig.js';

// Cámara cinematográfica para la carrera de demostración de fondo en los menús.
// Alterna tomas: persecución, órbita, cámara junto a la pista y helicóptero.
const SHOTS = ['chase', 'orbit', 'trackside', 'heli', 'chase', 'low'];

export class DemoCamera {
  constructor(race) {
    this.race = race;
    this.index = 0;
    this.chase = new CameraRig(0);
    this.camera = this.chase.camera;
    this.camera.fov = 55;
    this.shotTime = 0;
    this.shotI = 0;
    this.target = 0;
    this.racer = race.racers[0];
    this.look = new THREE.Vector3();
    this.pos = new THREE.Vector3();
    this.fixed = new THREE.Vector3();
    this.nextShot(true);
  }

  nextShot(first = false) {
    this.shotI = first ? 0 : (this.shotI + 1) % SHOTS.length;
    this.shot = SHOTS[this.shotI];
    this.shotTime = 0;
    this.duration = 4.5 + Math.random() * 2;
    // alternar el auto seguido
    if (!first) this.target = (this.target + 1) % this.race.racers.length;
    this.racer = this.race.racers[this.target];
    const c = this.racer.car;
    if (this.shot === 'chase') this.chase.snap(c);
    if (this.shot === 'trackside') {
      // punto fijo adelante del auto, al costado de la pista
      const tr = this.race.track;
      const s = c.progress + 70;
      const side = Math.random() < 0.5 ? -1 : 1;
      const p = tr.main.pointAt(s, side * (tr.main.pointAt(s).hw + 4));
      this.fixed.set(p.x, p.y + 2.2, p.z);
    }
    this.orbitA = Math.random() * Math.PI * 2;
  }

  update(dt) {
    this.shotTime += dt;
    if (this.shotTime > this.duration) this.nextShot();
    const c = this.racer.car;
    const cam = this.camera;
    const target = this.look.set(c.x, c.y + 0.9, c.z);
    switch (this.shot) {
      case 'chase':
        this.chase.update(dt, c);
        return;
      case 'orbit': {
        this.orbitA += dt * 0.45;
        cam.position.set(c.x + Math.sin(this.orbitA) * 9, c.y + 2.6, c.z + Math.cos(this.orbitA) * 9);
        break;
      }
      case 'trackside':
        cam.position.copy(this.fixed);
        break;
      case 'heli': {
        const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
        this.pos.set(c.x - fx * 26 + fz * 10, c.y + 22, c.z - fz * 26 - fx * 10);
        if (this.shotTime < dt * 2) cam.position.copy(this.pos);
        cam.position.lerp(this.pos, 1 - Math.exp(-2 * dt));
        break;
      }
      case 'low': {
        const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
        cam.position.set(c.x + fx * 6 + fz * 2.5, c.y + 0.6, c.z + fz * 6 - fx * 2.5);
        target.set(c.x - fx * 2, c.y + 0.7, c.z - fz * 2);
        break;
      }
    }
    cam.lookAt(target);
    if (cam.fov !== 55) { cam.fov = 55; cam.updateProjectionMatrix(); }
  }
}
