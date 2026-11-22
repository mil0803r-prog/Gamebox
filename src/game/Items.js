import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { itemBoxTexture, oilTexture } from '../tracks/textures.js';

const I = CONFIG.items;

// Modo ítems: cajas en la pista con turbo extra, mancha de aceite o escudo
export class Items {
  constructor(scene, track) {
    this.scene = scene;
    this.track = track;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.boxes = [];
    this.oils = [];
    const boxGeo = new THREE.BoxGeometry(1.6, 1.6, 1.6);
    const boxMat = new THREE.MeshBasicMaterial({ map: itemBoxTexture(), transparent: true, opacity: 0.92 });
    for (const s of track.itemRows) {
      const hw = track.main.pointAt(s).hw;
      const n = 4;
      for (let k = 0; k < n; k++) {
        const lat = (-0.75 + 1.5 * k / (n - 1)) * (hw - 2);
        const p = track.main.pointAt(s, lat);
        const m = new THREE.Mesh(boxGeo, boxMat);
        m.position.set(p.x, p.y + 1.4, p.z);
        this.group.add(m);
        this.boxes.push({ x: p.x, y: p.y, z: p.z, mesh: m, t: 0, phase: Math.random() * 6 });
      }
    }
    this.oilGeo = new THREE.PlaneGeometry(4.2, 4.2).rotateX(-Math.PI / 2);
    this.oilMat = new THREE.MeshBasicMaterial({ map: oilTexture(), transparent: true, depthWrite: false });
    this.time = 0;
  }

  pick(place, total) {
    // los que van atrás reciben más turbo y escudo
    const back = total > 1 ? (place - 1) / (total - 1) : 0.5;
    const r = Math.random();
    if (r < 0.25 + back * 0.25) return 'turbo';
    if (r < 0.65) return 'oil';
    return 'shield';
  }

  use(r, race) {
    const c = r.car;
    const it = c.item;
    if (!it) return;
    c.item = null;
    if (it === 'turbo') c.addBoost(I.turboTime, 58, 1.36, 0xff7a1a);
    if (it === 'shield') c.shieldTimer = I.shieldTime;
    if (it === 'oil') {
      const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
      const x = c.x - fx * 4.5, z = c.z - fz * 4.5;
      const q = race.track.query(x, z, race.track.newQuery().hints, race.track.newQuery());
      const m = new THREE.Mesh(this.oilGeo, this.oilMat);
      m.position.set(x, q.groundY + 0.1, z);
      m.rotation.y = Math.random() * 6;
      m.renderOrder = 3;
      this.group.add(m);
      this.oils.push({ x, z, y: q.groundY, mesh: m, life: I.oilLifetime, owner: r, safe: 0.8 });
      if (this.oils.length > 8) this.removeOil(this.oils[0]);
    }
    race.events.push({ type: 'itemUse', racer: r, item: it });
  }

  removeOil(o) {
    this.group.remove(o.mesh);
    this.oils.splice(this.oils.indexOf(o), 1);
  }

  update(dt, race, ins) {
    this.time += dt;
    for (const b of this.boxes) {
      if (b.t > 0) { b.t -= dt; b.mesh.visible = b.t <= 0; }
      b.mesh.rotation.y = this.time * 1.5 + b.phase;
      b.mesh.rotation.x = Math.sin(this.time + b.phase) * 0.3;
      b.mesh.position.y = b.y + 1.4 + Math.sin(this.time * 2 + b.phase) * 0.2;
    }
    race.racers.forEach((r, i) => {
      const c = r.car;
      if (c.shieldTimer > 0) c.shieldTimer -= dt;
      // recoger caja
      for (const b of this.boxes) {
        if (b.t > 0) continue;
        if ((c.x - b.x) ** 2 + (c.z - b.z) ** 2 < 2.6 * 2.6 && Math.abs(c.y - b.y) < 3) {
          b.t = I.respawnTime; b.mesh.visible = false;
          if (!c.item) {
            c.item = this.pick(r.place, race.racers.length);
            race.events.push({ type: 'itemGet', racer: r, item: c.item });
          }
        }
      }
      // usar
      const inp = ins[i];
      if (inp && inp.itemPressed && c.item) this.use(r, race);
    });
    // aceite
    for (const o of this.oils.slice()) {
      o.life -= dt; o.safe -= dt;
      if (o.life <= 0) { this.removeOil(o); continue; }
      o.mesh.material.opacity = Math.min(1, o.life);
      for (const r of race.racers) {
        const c = r.car;
        if (r === o.owner && o.safe > 0) continue;
        if (c.airborne) continue;
        if ((c.x - o.x) ** 2 + (c.z - o.z) ** 2 < 2.3 * 2.3) {
          if (c.shieldTimer <= 0) {
            c.spinTimer = I.oilSpinTime;
            c.vx *= 0.55; c.vz *= 0.55;
            if (c.drifting) c.endDrift(false);
            race.events.push({ type: 'oilHit', racer: r });
          } else {
            c.shieldTimer = 0; // el escudo se consume
            race.events.push({ type: 'shieldBlock', racer: r });
          }
          this.removeOil(o);
          break;
        }
      }
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  }
}
