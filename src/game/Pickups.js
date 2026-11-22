import * as THREE from 'three';

// =====================================================================
//  Monedas y cajones sorpresa en la pista (en todas las carreras).
//  Monedas: $100 cada una. Cajones: premio al azar.
//  El dinero se cobra al terminar la carrera (pantalla de resultados).
// =====================================================================
export const COIN_VALUE = 50;
const COIN_RESPAWN = 14, CHEST_RESPAWN = 16;

// premios del cajón: [tipo, probabilidad]
const PRIZES = [['bolsa', 0.38], ['turbo', 0.24], ['escudo', 0.14], ['iman', 0.16], ['jackpot', 0.08]];
export const PRIZE_TEXT = {
  bolsa: a => [`¡BOLSA DE DINERO!`, `+$${a.toLocaleString('es-ES')}`],
  turbo: () => ['¡TURBO LLENO!', 'Barra al 100%'],
  escudo: () => ['¡ESCUDO!', 'Protegido 6 segundos'],
  iman: () => ['¡IMÁN DE MONEDAS!', 'Atrae monedas 8 segundos'],
  jackpot: a => ['💰 ¡PREMIO MAYOR! 💰', `+$${a.toLocaleString('es-ES')}`],
};

function chestTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, '#ffe680'); grd.addColorStop(0.5, '#f5b400'); grd.addColorStop(1, '#b86e00');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#7a3e00'; g.fillRect(0, 54, 128, 12);          // franja de la tapa
  g.fillRect(56, 0, 16, 128);                                   // correa
  g.strokeStyle = '#fff3c0'; g.lineWidth = 6; g.strokeRect(4, 4, 120, 120);
  g.fillStyle = '#fff'; g.font = 'bold 64px Arial Black, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 8; g.strokeStyle = '#7a3e00'; g.strokeText('?', 64, 66); g.fillText('?', 64, 66);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,220,90,0.9)'); grd.addColorStop(1, 'rgba(255,200,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class Pickups {
  constructor(scene, track) {
    this.scene = scene;
    this.track = track;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.coins = [];
    this.chests = [];
    this.time = 0;
    const m = track.main, L = track.length;

    // ---- monedas: filas de 6 a lo largo del circuito, alternando el carril
    let row = 0;
    for (let s = 70; s < L - 40; s += 105) {
      const hw = m.pointAt(s).hw;
      const lat0 = Math.sin(row * 1.7) * (hw - 3);
      for (let k = 0; k < 6; k++) {
        const lat = lat0 + Math.sin(k * 0.6 + row) * 1.5;
        const p = m.pointAt(s + k * 4, lat);
        this.coins.push({ x: p.x, y: p.y + 1.1, z: p.z, t: 0 });
      }
      row++;
    }
    // atajos: más monedas (recompensa por el riesgo)
    for (const sc of track.shortcuts) {
      for (let s = 12; s < sc.length - 10; s += 5) {
        const p = sc.pointAt(s, 0);
        this.coins.push({ x: p.x, y: p.y + 1.1, z: p.z, t: 0 });
      }
    }
    // en el aire, siguiendo el salto de cada rampa
    for (const r of track.ramps) {
      for (let k = 1; k <= 5; k++) {
        const s = r.s0 + r.len + k * 5;
        const p = r.surf.pointAt(s, r.lat);
        const h = r.h + 1.6 + Math.sin(Math.PI * k / 6) * 2.2 - k * 0.35;
        this.coins.push({ x: p.x, y: p.y + h, z: p.z, t: 0 });
      }
    }
    for (const co of this.coins) co.home = [co.x, co.y, co.z];
    const coinGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.12, 20).rotateX(Math.PI / 2);
    const coinMat = new THREE.MeshStandardMaterial({ color: 0xffc61f, metalness: 1, roughness: 0.22, emissive: 0x7a4a00, emissiveIntensity: 0.6 });
    this.coinMesh = new THREE.InstancedMesh(coinGeo, coinMat, this.coins.length);
    this.coinMesh.frustumCulled = false;
    this.group.add(this.coinMesh);

    // ---- cajones sorpresa
    const fracs = [0.17, 0.42, 0.66, 0.88];
    fracs.forEach((f, i) => {
      const s = f * L;
      const hw = m.pointAt(s).hw;
      const p = m.pointAt(s, (i % 2 ? 1 : -1) * (hw * 0.45));
      this.chests.push({ x: p.x, y: p.y, z: p.z, t: 0 });
    });
    for (const sc of track.shortcuts) {
      const p = sc.pointAt(sc.length * 0.6, 0);
      this.chests.push({ x: p.x, y: p.y, z: p.z, t: 0, shortcut: true });
    }
    const tex = chestTexture();
    const chestMat = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.6, roughness: 0.3, emissive: 0x553300, emissiveMap: tex, emissiveIntensity: 0.5 });
    const chestGeo = new THREE.BoxGeometry(1.5, 1.2, 1.1);
    const glowMat = new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    for (const c of this.chests) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(chestGeo, chestMat));
      const glow = new THREE.Sprite(glowMat); glow.scale.setScalar(4.2); g.add(glow);
      g.position.set(c.x, c.y + 1.3, c.z);
      this.group.add(g);
      c.mesh = g;
    }
    this.tmp = new THREE.Object3D();
  }

  pickPrize() {
    let r = Math.random();
    for (const [k, p] of PRIZES) { if ((r -= p) <= 0) return k; }
    return 'bolsa';
  }

  give(racer, race) {
    const c = racer.car;
    const kind = this.pickPrize();
    let amount = 0;
    if (kind === 'bolsa') amount = 1000 + Math.floor(Math.random() * 5) * 500;
    if (kind === 'jackpot') amount = 10000;
    if (kind === 'turbo') { c.turboBar = 1; c.addBoost(1.0, 50, 1.3, 0xffc61f); }
    if (kind === 'escudo') c.shieldTimer = Math.max(c.shieldTimer, 6);
    if (kind === 'iman') c.magnetTimer = 8;
    racer.bonus = (racer.bonus || 0) + amount;
    race.events.push({ type: 'chest', racer, kind, amount, x: c.x, y: c.y, z: c.z });
  }

  update(dt, race) {
    this.time += dt;
    const spin = this.time * 3;
    // ---- monedas
    for (let i = 0; i < this.coins.length; i++) {
      const co = this.coins[i];
      if (co.t > 0) co.t -= dt;
      for (const r of race.racers) {
        if (co.t > 0) break;
        const c = r.car;
        const magnet = c.magnetTimer > 0;
        const dx = c.x - co.x, dz = c.z - co.z, dy = (c.y + 0.8) - co.y;
        const d2 = dx * dx + dz * dz;
        if (magnet && d2 < 14 * 14 && d2 > 1) { // el imán acerca la moneda al auto
          const k = Math.min(1, dt * 9);
          co.x += dx * k; co.z += dz * k; co.y += dy * k * 0.5;
        }
        if (d2 < (magnet ? 3.2 : 1.9) ** 2 && Math.abs(dy) < 2.2) {
          co.t = COIN_RESPAWN;
          co.x = co.home[0]; co.y = co.home[1]; co.z = co.home[2];
          r.coins = (r.coins || 0) + 1;
          race.events.push({ type: 'coin', racer: r, x: c.x, y: c.y + 1, z: c.z });
        }
      }
      const o = this.tmp;
      const vis = co.t <= 0;
      o.position.set(co.x, co.y + Math.sin(this.time * 2 + i) * 0.12, co.z);
      o.rotation.set(0, spin + i * 0.3, 0);
      o.scale.setScalar(vis ? 1 : 0.0001);
      o.updateMatrix();
      this.coinMesh.setMatrixAt(i, o.matrix);
    }
    this.coinMesh.instanceMatrix.needsUpdate = true;
    // ---- cajones
    for (const ch of this.chests) {
      if (ch.t > 0) { ch.t -= dt; ch.mesh.visible = ch.t <= 0; continue; }
      ch.mesh.rotation.y = this.time * 1.2;
      ch.mesh.position.y = ch.y + 1.3 + Math.sin(this.time * 2.4) * 0.2;
      for (const r of race.racers) {
        const c = r.car;
        if ((c.x - ch.x) ** 2 + (c.z - ch.z) ** 2 < 2.6 * 2.6 && Math.abs(c.y - ch.y) < 3) {
          ch.t = CHEST_RESPAWN; ch.mesh.visible = false;
          this.give(r, race);
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
