import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { blobTexture, sparkTexture } from '../tracks/textures.js';

const D = CONFIG.drift;
const tmpV = new THREE.Vector3();

// --------------------------------------------------------------- partículas
class Particles {
  constructor(max) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.base = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.cursor = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { scale: { value: 400 } },
      vertexShader: `attribute float size; attribute float alpha; varying vec3 vC; varying float vA;
        uniform float scale;
        void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix*vec4(position,1.0);
          gl_PointSize = size * scale / max(0.5, -mv.z); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `varying vec3 vC; varying float vA;
        void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5, 0.05, d) * vA; if(a<0.01) discard; gl_FragColor = vec4(vC*a, a); }`,
      vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.geo = g;
    this.budget = 1;
  }

  emit(x, y, z, vx, vy, vz, color, life, size, grav = 9) {
    if (this.budget < 1 && Math.random() > this.budget) return;
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    const c = typeof color === 'number' ? tmpColor.setHex(color) : color;
    this.base[i * 3] = c.r; this.base[i * 3 + 1] = c.g; this.base[i * 3 + 2] = c.b;
    this.life[i] = life; this.maxLife[i] = life; this.size[i] = size; this.grav[i] = grav;
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const k = i * 3;
      this.vel[k + 1] -= this.grav[i] * dt;
      this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
      const t = Math.max(0, this.life[i] / this.maxLife[i]);
      this.alpha[i] = t;
      this.col[k] = this.base[k]; this.col[k + 1] = this.base[k + 1]; this.col[k + 2] = this.base[k + 2];
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.attributes.alpha.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;
  }
}
const tmpColor = new THREE.Color();

// --------------------------------------------------------------- líneas de velocidad (por cámara)
class SpeedLines {
  constructor(rig, count, color, wavy) {
    this.rig = rig; this.count = count; this.wavy = wavy;
    this.data = [];
    const pos = new Float32Array(count * 6);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false });
    this.lines = new THREE.LineSegments(g, this.mat);
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 50;
    this.lines.layers.set(rig.index + 1); // solo la ve esta cámara
    rig.camera.add(this.lines);
    this.pos = pos; this.geo = g;
    for (let i = 0; i < count; i++) this.data.push(this.spawn({}, true));
    this.intensity = 0;
  }
  spawn(d, init) {
    d.a = Math.random() * Math.PI * 2;
    d.r = 0.6 + Math.random() * 0.45;
    d.z = init ? -2 - Math.random() * 14 : -14 - Math.random() * 4;
    d.len = 1 + Math.random() * 2.5;
    d.ph = Math.random() * 6;
    return d;
  }
  update(dt, target, speed) {
    this.intensity += (target - this.intensity) * Math.min(1, dt * 5);
    this.mat.opacity = this.intensity * (this.wavy ? 0.55 : 0.75);
    this.lines.visible = this.intensity > 0.02;
    if (!this.lines.visible) return;
    const cam = this.rig.camera;
    const th = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const asp = cam.aspect;
    const sp = 20 + speed * 1.2;
    for (let i = 0; i < this.count; i++) {
      const d = this.data[i];
      d.z += sp * dt;
      if (d.z > -1.5) this.spawn(d, false);
      const zz = -d.z;
      let a = d.a;
      if (this.wavy) a += Math.sin(d.ph + d.z * 0.4) * 0.08;
      const x = Math.cos(a) * d.r * th * zz * asp, y = Math.sin(a) * d.r * th * zz;
      const len = d.len * (0.5 + this.intensity) * (this.wavy ? 0.7 : 1.4);
      const k = i * 6;
      this.pos[k] = x; this.pos[k + 1] = y; this.pos[k + 2] = d.z;
      this.pos[k + 3] = x * (zz + len) / zz; this.pos[k + 4] = y * (zz + len) / zz; this.pos[k + 5] = d.z - len;
    }
    this.geo.attributes.position.needsUpdate = true;
  }
  dispose() { this.rig.camera.remove(this.lines); this.geo.dispose(); this.mat.dispose(); }
}

// --------------------------------------------------------------- nieve (por cámara)
class Snow {
  constructor(rig, count) {
    this.rig = rig; this.count = count;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) { pos[i * 3] = (Math.random() - 0.5) * 60; pos[i * 3 + 1] = Math.random() * 30; pos[i * 3 + 2] = (Math.random() - 0.5) * 60; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.11, map: sparkTexture(), transparent: true, opacity: 0.9, depthWrite: false });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.layers.set(rig.index + 1);
    this.pos = pos; this.geo = g;
  }
  update(dt) {
    const c = this.rig.camera.position;
    this.points.position.set(Math.floor(c.x / 60) * 60, c.y - 10, Math.floor(c.z / 60) * 60);
    const ox = this.points.position.x, oz = this.points.position.z;
    for (let i = 0; i < this.count; i++) {
      const k = i * 3;
      this.pos[k + 1] -= dt * 4;
      this.pos[k] += Math.sin(this.pos[k + 1] * 0.5 + i) * dt * 0.8;
      if (this.pos[k + 1] < 0) this.pos[k + 1] += 30;
      // envolver en un cubo centrado en la cámara
      let wx = this.pos[k] + ox - c.x, wz = this.pos[k + 2] + oz - c.z;
      if (wx > 30) this.pos[k] -= 60; else if (wx < -30) this.pos[k] += 60;
      if (wz > 30) this.pos[k + 2] -= 60; else if (wz < -30) this.pos[k + 2] += 60;
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}

// --------------------------------------------------------------- marcas de neumático
class SkidMarks {
  constructor(max) {
    this.max = max;
    this.pos = new Float32Array(max * 6 * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.MeshBasicMaterial({ color: 0x050505, transparent: true, opacity: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.geo = g;
    this.cursor = 0;
    this.count = 0;
  }
  add(ax, ay, az, bx, by, bz, w) {
    const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1;
    const nx = -dz / l * w, nz = dx / l * w;
    const o = this.cursor * 18, P = this.pos;
    const v = [ax - nx, ay, az - nz, ax + nx, ay, az + nz, bx + nx, by, bz + nz, ax - nx, ay, az - nz, bx + nx, by, bz + nz, bx - nx, by, bz - nz];
    for (let i = 0; i < 18; i++) P[o + i] = v[i];
    this.cursor = (this.cursor + 1) % this.max;
    this.count = Math.min(this.max, this.count + 1);
    this.geo.setDrawRange(0, this.count * 6);
    this.geo.attributes.position.needsUpdate = true;
  }
  clear() { this.count = 0; this.cursor = 0; this.geo.setDrawRange(0, 0); }
}

// --------------------------------------------------------------- sistema de efectos
export class Effects {
  constructor(scene, quality = 2) {
    this.scene = scene;
    this.particles = new Particles(quality >= 2 ? 700 : 350);
    scene.add(this.particles.points);
    this.skids = new SkidMarks(quality >= 2 ? 900 : 450);
    scene.add(this.skids.mesh);
    this.skidLast = [];
    this.shadows = [];
    this.perRig = [];
    this.blobTex = blobTexture();
    this.dustColor = 0x888888;
    this.setQuality(quality);
  }

  setQuality(level) {
    this.level = level;
    this.particles.budget = [0.35, 0.6, 1, 1][level] ?? 1;
  }

  attach(race, rigs, theme) {
    this.detach();
    this.race = race;
    this.skids.clear();
    this.skidLast = race.racers.map(() => [null, null]);
    this.dustColor = { city: 0x777799, desert: 0xd9a35f, snow: 0xffffff }[theme] || 0x888888;
    const blobMat = new THREE.MeshBasicMaterial({ map: this.blobTex, transparent: true, depthWrite: false });
    const geo = new THREE.PlaneGeometry(2.6, 5).rotateX(-Math.PI / 2);
    for (const r of race.racers) {
      const m = new THREE.Mesh(geo, blobMat);
      m.renderOrder = 2;
      this.scene.add(m);
      this.shadows.push(m);
    }
    for (const rig of rigs) {
      const e = {
        rig,
        speed: new SpeedLines(rig, 40, 0xffffff, false),
        wind: new SpeedLines(rig, 26, 0x9fe8ff, true),
        snow: theme === 'snow' ? new Snow(rig, this.level >= 2 ? 500 : 250) : null,
      };
      if (e.snow) this.scene.add(e.snow.points);
      this.perRig.push(e);
    }
  }

  detach() {
    this.shadows.forEach(s => this.scene.remove(s));
    this.shadows = [];
    for (const e of this.perRig) {
      e.speed.dispose(); e.wind.dispose();
      if (e.snow) this.scene.remove(e.snow.points);
    }
    this.perRig = [];
  }

  setViewHeight(h) { this.particles.mat.uniforms.scale.value = h * 0.9; }

  burst(x, y, z, color, n, speed, life = 0.5, size = 0.35, grav = 9) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, u = Math.random() * 0.8 + 0.2;
      this.particles.emit(x, y, z, Math.cos(a) * speed * u, Math.random() * speed * 0.8, Math.sin(a) * speed * u, color, life * (0.6 + Math.random() * 0.6), size, grav);
    }
  }

  update(dt) {
    const race = this.race;
    if (!race) return;
    const P = this.particles;
    race.racers.forEach((r, i) => {
      const c = r.car, m = c.model;
      // sombra
      const sh = this.shadows[i];
      const gy = c.q.groundY;
      sh.position.set(c.x, gy + 0.07, c.z);
      sh.rotation.y = c.heading;
      const hgt = Math.max(0, c.y - gy);
      sh.scale.setScalar(Math.max(0.4, 1 - hgt * 0.08));
      sh.material.opacity = Math.max(0.2, 1 - hgt * 0.1);
      m.root.updateMatrixWorld();
      // marcas de neumático
      const sliding = !c.airborne && (c.drifting || Math.abs(c.vr) > 7 || c.spinTimer > 0) && c.speed > 6;
      for (let w = 0; w < 2; w++) {
        if (!sliding) { this.skidLast[i][w] = null; continue; }
        tmpV.copy(m.rearWheelLocal[w]); m.body.localToWorld(tmpV);
        const last = this.skidLast[i][w];
        const y = c.q.groundY + 0.04;
        if (last) {
          if ((tmpV.x - last.x) ** 2 + (tmpV.z - last.z) ** 2 > 0.5) {
            this.skids.add(last.x, last.y, last.z, tmpV.x, y, tmpV.z, 0.17);
            last.x = tmpV.x; last.y = y; last.z = tmpV.z;
          }
        } else this.skidLast[i][w] = { x: tmpV.x, y, z: tmpV.z };
      }
      // chispas de derrape
      if (c.drifting && !c.airborne) {
        const lvl = c.driftCharge ? c.driftLevel : 0;
        const col = D.sparkColors[lvl];
        const n = lvl > 0 ? 2 : 1;
        const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
        for (const wl of m.rearWheelLocal) {
          tmpV.copy(wl);
          m.body.localToWorld(tmpV);
          for (let k = 0; k < n; k++) {
            const side = (Math.random() - 0.5) * 4;
            P.emit(tmpV.x, tmpV.y + 0.1, tmpV.z,
              -fx * (3 + Math.random() * 4) + fz * side + c.vx * 0.5,
              1.5 + Math.random() * 3.5,
              -fz * (3 + Math.random() * 4) - fx * side + c.vz * 0.5,
              col, 0.25 + Math.random() * 0.2, lvl > 0 ? 0.32 : 0.2, 14);
          }
        }
        // humo leve del neumático
        if (Math.random() < 0.3) P.emit(c.x - fx * 2, c.y + 0.3, c.z - fz * 2, (Math.random() - 0.5) * 2, 1.2, (Math.random() - 0.5) * 2, this.dustColor, 0.6, 1.2, -0.5);
      }
      // turbo: partículas de fuego en el escape
      if (c.boosting) {
        const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
        const col = c.usingTurbo ? 0xff7a1a : (c.boostColor || 0x33ddff);
        P.emit(c.x - fx * (m.halfLength + 0.8), c.y + 0.5, c.z - fz * (m.halfLength + 0.8), -fx * 6 + (Math.random() - 0.5) * 2 + c.vx * 0.6, Math.random() * 1.5, -fz * 6 + (Math.random() - 0.5) * 2 + c.vz * 0.6, col, 0.3, 0.45, -1);
      }
      // eventos
      if (c.ev.wall > 0) this.burst(c.x, c.y + 0.6, c.z, 0xffd27a, Math.min(24, 6 + c.ev.wall | 0), 7, 0.45, 0.3, 14);
      if (c.ev.bump > 4) this.burst(c.x, c.y + 0.8, c.z, 0xffffff, 10, 6, 0.35, 0.3, 10);
      if (c.ev.land > 6) this.burst(c.x, gy + 0.3, c.z, this.dustColor, 14, 5, 0.7, 1.0, 2);
      if (c.ev.miniTurbo) this.burst(c.x, c.y + 0.6, c.z, D.sparkColors[c.ev.miniTurbo], 20 + c.ev.miniTurbo * 6, 9, 0.5, 0.4, 4);
      if (c.ev.pad) this.burst(c.x, c.y + 0.4, c.z, 0x33ddff, 14, 6, 0.4, 0.35, 2);
    });
    P.update(dt);
    for (const e of this.perRig) {
      const c = e.rig.racer.car;
      const sp = c.speed;
      const speedInt = c.boosting ? 1 : Math.max(0, (sp - CONFIG.handling.maxSpeed * 0.85) / (CONFIG.handling.maxSpeed * 0.3)) * 0.5;
      e.speed.update(dt, speedInt, sp);
      e.wind.update(dt, c.slipTime > 0.3 ? Math.min(1, c.slipTime / CONFIG.slipstream.timeToActivate) : 0, sp);
      if (e.snow) e.snow.update(dt);
    }
  }
}
