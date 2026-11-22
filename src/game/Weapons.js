import * as THREE from 'three';
import { WEAPONS, weaponById } from './weaponData.js';

// =====================================================================
//  Disparos: láser, minas, misil guiado y pulso EMP.
//  Cada disparo gasta monedas recogidas en la carrera (racer.coins).
//  El escudo (cajón sorpresa / ítem) bloquea los impactos.
// =====================================================================
const LASER_SPEED = 150, MISSILE_SPEED = 78;

function glowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.3, 'rgba(255,255,255,0.6)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class Weapons {
  constructor(scene, track, race, ownedForHumans) {
    this.scene = scene;
    this.track = track;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.shots = [];
    this.time = 0;
    const tex = glowTex();
    this.mat = {
      laser: new THREE.MeshBasicMaterial({ color: 0xff3355, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
      laserCore: new THREE.MeshBasicMaterial({ color: 0xffffff }),
      missile: new THREE.MeshStandardMaterial({ color: 0xdfe3ea, metalness: 0.7, roughness: 0.3 }),
      fin: new THREE.MeshStandardMaterial({ color: 0xd4141e, metalness: 0.3, roughness: 0.5 }),
      mine: new THREE.MeshStandardMaterial({ color: 0x22252c, metalness: 0.6, roughness: 0.4 }),
      ring: new THREE.MeshBasicMaterial({ color: 0x40c8ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      glow: tex,
    };
    this.geo = {
      laser: new THREE.CylinderGeometry(0.07, 0.07, 3.2, 6).rotateX(Math.PI / 2),
      laserCore: new THREE.CylinderGeometry(0.025, 0.025, 3.0, 4).rotateX(Math.PI / 2),
      missile: new THREE.CylinderGeometry(0.13, 0.13, 1.2, 10).rotateX(Math.PI / 2),
      nose: new THREE.ConeGeometry(0.13, 0.35, 10).rotateX(Math.PI / 2).translate(0, 0, 0.77),
      fin: new THREE.BoxGeometry(0.5, 0.04, 0.25).translate(0, 0, -0.5),
      mine: new THREE.CylinderGeometry(0.55, 0.65, 0.22, 14),
      ring: new THREE.RingGeometry(0.85, 1, 48).rotateX(-Math.PI / 2),
    };
    // armas de cada corredor
    for (const r of race.racers) {
      r.weapons = r.human ? WEAPONS.filter(w => ownedForHumans.includes(w.id)).map(w => w.id)
        : (r.aiLevel >= 1 ? ['laser'] : []);
      if (!r.human && r.aiLevel >= 2) r.weapons.push('missile');
      r.weaponIdx = 0; r.fireCd = 0; r.aiFireT = 1 + Math.random() * 3;
    }
  }

  current(r) { return r.weapons && r.weapons.length ? weaponById(r.weapons[r.weaponIdx % r.weapons.length]) : null; }

  update(dt, race, ins) {
    this.time += dt;
    race.racers.forEach((r, i) => {
      r.fireCd -= dt;
      if (!r.weapons || !r.weapons.length || r.finished) return;
      const inp = ins[i] || {};
      if (inp.weaponNextPressed && r.weapons.length > 1) {
        r.weaponIdx = (r.weaponIdx + 1) % r.weapons.length;
        race.events.push({ type: 'weaponSwitch', racer: r, weapon: this.current(r) });
      }
      let fire = !!inp.firePressed || (!!inp.fire && this.current(r).id === 'laser');
      if (!r.human) fire = this.aiWantsFire(r, race, dt);
      if (fire && r.fireCd <= 0) this.fire(r, race);
    });
    this.updateShots(dt, race);
  }

  aiWantsFire(r, race, dt) {
    r.aiFireT -= dt;
    if (r.aiFireT > 0) return false;
    const c = r.car, w = this.current(r);
    const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
    for (const o of race.racers) {
      if (o === r) continue;
      const dx = o.car.x - c.x, dz = o.car.z - c.z;
      const along = dx * fx + dz * fz, side = Math.abs(-dx * fz + dz * fx);
      if (along > 5 && along < (w.id === 'missile' ? 120 : 60) && side < 3 + along * 0.05) {
        r.aiFireT = w.id === 'missile' ? 6 + Math.random() * 6 : 0.12 + (Math.random() < 0.15 ? 2 + Math.random() * 3 : 0);
        if (w.id === 'missile' && r.weapons.length > 1 && Math.random() < 0.6) r.weaponIdx = 0;
        return true;
      }
    }
    if (r.weapons.length > 1 && Math.random() < 0.01) r.weaponIdx = (r.weaponIdx + 1) % r.weapons.length;
    r.aiFireT = 0.3;
    return false;
  }

  fire(r, race) {
    const w = this.current(r);
    if ((r.coins || 0) < w.cost) {
      if (r.human && !r.noCoinsWarned) { r.noCoinsWarned = 1.5; race.events.push({ type: 'noCoins', racer: r, weapon: w }); }
      return;
    }
    r.coins -= w.cost;
    r.coinsSpent = (r.coinsSpent || 0) + w.cost;
    r.fireCd = w.cooldown;
    const c = r.car, m = c.model;
    const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
    if (w.id === 'laser') {
      const mesh = new THREE.Mesh(this.geo.laser, this.mat.laser);
      mesh.add(new THREE.Mesh(this.geo.laserCore, this.mat.laserCore));
      const side = (r.laserSide = -(r.laserSide || 1));
      const x = c.x + fx * (m.halfLength + 1.6) + fz * 0.5 * side, z = c.z + fz * (m.halfLength + 1.6) - fx * 0.5 * side;
      mesh.position.set(x, c.y + 0.65, z);
      mesh.rotation.y = c.heading;
      this.group.add(mesh);
      this.shots.push({ type: 'laser', mesh, x, z, y: c.y + 0.65, vx: c.vx + fx * LASER_SPEED, vz: c.vz + fz * LASER_SPEED, life: 0.55, owner: r });
    } else if (w.id === 'missile') {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(this.geo.missile, this.mat.missile), new THREE.Mesh(this.geo.nose, this.mat.fin));
      const f1 = new THREE.Mesh(this.geo.fin, this.mat.fin); g.add(f1);
      const f2 = new THREE.Mesh(this.geo.fin, this.mat.fin); f2.rotation.z = Math.PI / 2; g.add(f2);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.mat.glow, color: 0xffa020, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.position.z = -0.8; glow.scale.setScalar(1.1); g.add(glow);
      const x = c.x + fx * (m.halfLength + 1.5), z = c.z + fz * (m.halfLength + 1.5);
      g.position.set(x, c.y + 1.0, z);
      this.group.add(g);
      const target = this.findTarget(r, race);
      this.shots.push({ type: 'missile', mesh: g, x, z, y: c.y + 1.0, heading: c.heading, speed: Math.max(MISSILE_SPEED, c.speed + 30), life: 5, owner: r, target, q: this.track.newQuery() });
    } else if (w.id === 'mine') {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(this.geo.mine, this.mat.mine));
      const led = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.mat.glow, color: 0xff2020, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      led.position.y = 0.25; led.scale.setScalar(0.9); g.add(led);
      const x = c.x - fx * (m.halfLength + 2), z = c.z - fz * (m.halfLength + 2);
      const q = this.track.query(x, z, this.track.newQuery().hints, this.track.newQuery());
      g.position.set(x, q.groundY + 0.12, z);
      this.group.add(g);
      this.shots.push({ type: 'mine', mesh: g, led, x, z, y: q.groundY, life: 30, owner: r, safe: 1.0 });
      if (this.shots.filter(s => s.type === 'mine').length > 12) this.remove(this.shots.find(s => s.type === 'mine'));
    } else if (w.id === 'emp') {
      const ring = new THREE.Mesh(this.geo.ring, this.mat.ring.clone());
      ring.position.set(c.x, c.y + 0.5, c.z);
      this.group.add(ring);
      this.shots.push({ type: 'emp', mesh: ring, life: 0.6, max: 0.6, owner: r });
      for (const o of race.racers) {
        if (o === r) continue;
        const d = Math.hypot(o.car.x - c.x, o.car.z - c.z);
        if (d < 22 && Math.abs(o.car.y - c.y) < 4) this.hit(o, 'emp', r, race);
      }
    }
    race.events.push({ type: 'shot', racer: r, weapon: w, x: c.x, y: c.y, z: c.z });
  }

  // el auto que va justo adelante en la carrera (o el más cercano por delante)
  findTarget(r, race) {
    const ahead = race.racers.find(o => o.place === r.place - 1);
    if (ahead && Math.hypot(ahead.car.x - r.car.x, ahead.car.z - r.car.z) < 220) return ahead;
    let best = null, bd = 200;
    const fx = Math.sin(r.car.heading), fz = Math.cos(r.car.heading);
    for (const o of race.racers) {
      if (o === r) continue;
      const dx = o.car.x - r.car.x, dz = o.car.z - r.car.z, along = dx * fx + dz * fz;
      if (along > 0 && along < bd) { bd = along; best = o; }
    }
    return best;
  }

  hit(victim, type, by, race) {
    const c = victim.car;
    if (c.shieldTimer > 0) {
      if (type !== 'laser') c.shieldTimer = 0;
      race.events.push({ type: 'shieldBlock', racer: victim });
      return;
    }
    if (type === 'laser') {
      c.vx *= 0.94; c.vz *= 0.94; c.slowTimer = Math.max(c.slowTimer || 0, 0.5);
    } else if (type === 'missile' || type === 'mine') {
      c.spinTimer = 1.0; c.vx *= 0.5; c.vz *= 0.5; c.vy = Math.max(c.vy, 6); c.airborne = true;
      if (c.drifting) c.endDrift(false);
    } else if (type === 'emp') {
      c.turboBar *= 0.3; c.slowTimer = 1.6;
      if (c.drifting) c.endDrift(false);
    }
    race.events.push({ type: 'hit', racer: victim, by, weapon: type, x: c.x, y: c.y + 0.8, z: c.z });
  }

  remove(s) {
    if (!s) return;
    this.group.remove(s.mesh);
    this.shots.splice(this.shots.indexOf(s), 1);
  }

  updateShots(dt, race) {
    for (const r of race.racers) if (r.noCoinsWarned > 0) r.noCoinsWarned -= dt;
    for (const s of this.shots.slice()) {
      s.life -= dt;
      if (s.life <= 0) { this.remove(s); continue; }
      if (s.type === 'laser') {
        const ox = s.x, oz = s.z;
        s.x += s.vx * dt; s.z += s.vz * dt;
        s.mesh.position.set(s.x, s.y, s.z);
        // impacto: distancia del auto al segmento recorrido
        for (const o of race.racers) {
          if (o === s.owner) continue;
          const c = o.car;
          const sx = s.x - ox, sz = s.z - oz, l2 = sx * sx + sz * sz || 1;
          const t = Math.max(0, Math.min(1, ((c.x - ox) * sx + (c.z - oz) * sz) / l2));
          const d = Math.hypot(c.x - (ox + sx * t), c.z - (oz + sz * t));
          if (d < 1.5 && Math.abs(c.y + 0.6 - s.y) < 1.6) { this.hit(o, 'laser', s.owner, race); this.remove(s); break; }
        }
        // contra paredes: si sale de la pista se apaga
        if (this.shots.includes(s) && this.track.distToRoad && this.track.distToRoad(s.x, s.z) > 1.5) this.remove(s);
      } else if (s.type === 'missile') {
        if (s.target && !s.target.finished) {
          const tx = s.target.car.x - s.x, tz = s.target.car.z - s.z;
          let d = Math.atan2(tx, tz) - s.heading;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          s.heading += Math.max(-3.2 * dt, Math.min(3.2 * dt, d));
        }
        s.x += Math.sin(s.heading) * s.speed * dt;
        s.z += Math.cos(s.heading) * s.speed * dt;
        const q = this.track.query(s.x, s.z, s.q.hints, s.q);
        s.y += ((q.groundY + 0.9) - s.y) * Math.min(1, dt * 6);
        s.mesh.position.set(s.x, s.y, s.z);
        s.mesh.rotation.y = s.heading;
        s.mesh.rotation.z += dt * 8;
        race.events.push({ type: 'trail', x: s.x - Math.sin(s.heading), y: s.y, z: s.z - Math.cos(s.heading) });
        for (const o of race.racers) {
          if (o === s.owner) continue;
          if (Math.hypot(o.car.x - s.x, o.car.z - s.z) < 2.2 && Math.abs(o.car.y + 0.8 - s.y) < 2.5) { this.hit(o, 'missile', s.owner, race); this.remove(s); break; }
        }
        if (this.shots.includes(s) && !q.inside && Math.abs(q.proj.lat) > q.proj.hw + 2) {
          race.events.push({ type: 'boom', x: s.x, y: s.y, z: s.z }); this.remove(s);
        }
      } else if (s.type === 'mine') {
        s.safe -= dt;
        s.led.material.opacity = (Math.sin(this.time * 10) > 0) ? 1 : 0.2;
        for (const o of race.racers) {
          if (o === s.owner && s.safe > 0) continue;
          if (o.car.airborne) continue;
          if (Math.hypot(o.car.x - s.x, o.car.z - s.z) < 2.2) { this.hit(o, 'mine', s.owner, race); this.remove(s); break; }
        }
      } else if (s.type === 'emp') {
        const k = 1 - s.life / s.max;
        s.mesh.scale.setScalar(2 + k * 22);
        s.mesh.material.opacity = 0.85 * (1 - k);
      }
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.shots = [];
  }
}
