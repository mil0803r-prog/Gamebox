import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BODIES } from './bodies.js';

// =====================================================================
//  Modelo 3D de auto: la carrocería es una superficie suave generada por
//  secciones transversales (superelipses) a lo largo del auto, con cintura,
//  invernadero de vidrio y pasos de rueda. Pintura con barniz y reflejos.
//  El auto mira hacia +Z. API usada por Car.js y Effects.js.
// =====================================================================

// Interpolación Catmull-Rom sobre puntos [u, valor]
function sampler(keys) {
  const n = keys.length;
  return u => {
    if (u <= keys[0][0]) return keys[0][1];
    if (u >= keys[n - 1][0]) return keys[n - 1][1];
    let i = 0;
    while (u > keys[i + 1][0]) i++;
    const p0 = keys[Math.max(0, i - 1)][1], p1 = keys[i][1], p2 = keys[i + 1][1], p3 = keys[Math.min(n - 1, i + 2)][1];
    const t = (u - keys[i][0]) / (keys[i + 1][0] - keys[i][0]), t2 = t * t, t3 = t2 * t;
    return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
  };
}
// mezcla de Catmull-Rom (acotado) y smoothstep: curvas suaves sin oscilaciones
function smoothSampler(keys) {
  const cr = sampler(keys);
  return u => {
    const n = keys.length;
    if (u <= keys[0][0]) return keys[0][1];
    if (u >= keys[n - 1][0]) return keys[n - 1][1];
    let i = 0;
    while (u > keys[i + 1][0]) i++;
    const t = (u - keys[i][0]) / (keys[i + 1][0] - keys[i][0]);
    const ss = keys[i][1] + (keys[i + 1][1] - keys[i][1]) * (t * t * (3 - 2 * t));
    const v = cr(u);
    const lo = Math.min(keys[i][1], keys[i + 1][1]), hi = Math.max(keys[i][1], keys[i + 1][1]);
    return 0.65 * Math.max(lo - 0.04, Math.min(hi + 0.04, v)) + 0.35 * ss;
  };
}

const spow = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);

// ------------------------------------------------------------------ carrocería
function buildBody(b) {
  const top = smoothSampler(b.top), belt = smoothSampler(b.belt), hwf = smoothSampler(b.hw);
  const L = b.L, W = b.W;
  const N = 58;             // estaciones a lo largo
  const K = 7;              // puntos por cuarto de sección
  const zOf = u => (u - 0.5) * L;
  const wheelZ = b.wheels.map(zOf);
  const archR = b.r * 1.16;
  const positions = [], paintIdx = [], glassIdx = [], trimIdx = [];
  const ringSize = (K + 1) * 2 * 2; // mitad derecha (2K+2) + mitad izquierda
  const half = 2 * K + 2;
  const sta = [];
  // 1) perfiles crudos por estación
  for (let s = 0; s <= N; s++) {
    // más estaciones cerca de los extremos para redondear nariz y cola
    const lin = s / N;
    const u = lin < 0.5 ? 0.5 - 0.5 * Math.pow(1 - lin * 2, 1.25) : 0.5 + 0.5 * Math.pow(lin * 2 - 1, 1.25);
    const z = zOf(u);
    let bot = b.clear + 0.04, archTop = 0;
    // pasos de rueda: la parte baja sube formando el arco
    for (const wz of wheelZ) {
      const dz = Math.abs(z - wz);
      if (dz < archR) { const y = b.r + Math.sqrt(archR * archR - dz * dz) - 0.02; bot = Math.max(bot, y); archTop = Math.max(archTop, y); }
    }
    let bl = belt(u), tp = top(u);
    // guardabarros: la cintura sube sobre la rueda (abultamiento)
    if (archTop) { bl = Math.max(bl, archTop + 0.07); }
    const endF = Math.min(1, Math.min(u, 1 - u) / 0.035);
    const hw = hwf(u) * W / 2 * (0.55 + 0.45 * Math.sqrt(endF));
    const inCabin = u >= b.cabin[0] && u <= b.cabin[1];
    const slope = Math.abs(top(Math.min(1, u + 0.01)) - top(Math.max(0, u - 0.01))) / (0.02 * L);
    sta.push({ u, z, bot, bl, tp, hw, inCabin, steep: slope > 0.35 });
  }
  // 2) suavizado de cintura y techo (evita quiebres sobre las ruedas)
  for (let pass = 0; pass < 3; pass++) {
    const bl2 = sta.map((st, i) => i === 0 || i === N ? st.bl : (sta[i - 1].bl + st.bl * 2 + sta[i + 1].bl) / 4);
    sta.forEach((st, i) => { st.bl = Math.max(bl2[i], st.bot + 0.08); });
  }
  sta.forEach(st => { st.tp = Math.max(st.tp, st.bl + 0.015); });
  for (let pass = 0; pass < 2; pass++) {
    const tp2 = sta.map((st, i) => i === 0 || i === N ? st.tp : (sta[i - 1].tp + st.tp * 2 + sta[i + 1].tp) / 4);
    sta.forEach((st, i) => { st.tp = Math.max(tp2[i], st.bl + 0.015); });
  }
  // 3) secciones transversales
  for (let s = 0; s <= N; s++) {
    const { z, bot, bl, tp, hw, inCabin } = sta[s];
    const ring = [];
    // mitad derecha: de abajo (centro) a la cintura, luego vidrio/techo hasta arriba (centro)
    // parte baja: ancho máximo a media puerta, costado casi vertical hasta la cintura
    const ym = bot + (bl - bot) * 0.42;
    for (let k = 0; k <= K; k++) {
      const t = k / K;
      if (t <= 0.5) {
        const a = -Math.PI / 2 + t * 2 * (Math.PI / 2);
        ring.push([hw * spow(Math.cos(a), 2 / b.n), ym + (ym - bot) * spow(Math.sin(a), 2 / b.n)]);
      } else {
        const f = (t - 0.5) * 2;
        ring.push([hw * (1 - 0.06 * f * f), ym + (bl - ym) * f]);
      }
    }
    const hwU = hw * (inCabin ? 0.96 : 1);
    const upH = tp - bl;
    for (let k = 0; k <= K; k++) {
      const a = (k / K) * Math.PI / 2;
      const tum = inCabin ? 1 - (1 - b.tumble) * Math.pow(k / K, 1.2) : 1 - 0.1 * (k / K);
      const x = hwU * tum * spow(Math.cos(a), 2 / (inCabin ? 2.4 : 6));
      const y = bl + upH * spow(Math.sin(a), 2 / (inCabin ? 2.4 : 1.6));
      ring.push([x, y]);
    }
    for (const [x, y] of ring) positions.push(x, y, z);
    for (const [x, y] of ring) positions.push(-x, y, z);
  }
  // caras
  for (let s = 0; s < N; s++) {
    const a = s * ringSize, c = (s + 1) * ringSize;
    const glassRow = sta[s].inCabin && sta[s + 1].inCabin;
    const steepRow = sta[s].steep || sta[s + 1].steep; // parabrisas / luneta: todo vidrio
    for (let side = 0; side < 2; side++) {
      const off = side * half;
      for (let k = 0; k < half - 1; k++) {
        const i0 = a + off + k, i1 = a + off + k + 1, j0 = c + off + k, j1 = c + off + k + 1;
        const upper = k >= K + 1;
        // ventanas laterales (parte baja del invernadero) y parabrisas en vidrio; el techo va pintado
        const isGlass = glassRow && upper && (steepRow || k <= K + 3) && !(b.cabin[1] - b.cabin[0] < 0.1 && !steepRow);
        // marco negro: junta de la ventana (repisa de la cintura) y pilares del parabrisas/luneta
        // parte baja negra (zócalo/difusor visual) en los superdeportivos: el auto se ve más bajo
        const isTrim = (glassRow && (k === K || (steepRow && k === K + 1))) || (b.lowerBlack && k <= 2);
        const target = isTrim ? trimIdx : isGlass ? glassIdx : paintIdx;
        if (side === 0) target.push(i0, i1, j0, i1, j1, j0);
        else target.push(i0, j0, i1, i1, j0, j1);
      }
    }
  }
  // tapas delantera y trasera
  for (const [s, dir] of [[0, -1], [N, 1]]) {
    const st = sta[s];
    const ci = positions.length / 3;
    positions.push(0, (st.bot + st.tp) / 2, st.z + dir * 0.01);
    const base = s * ringSize;
    for (let side = 0; side < 2; side++) {
      for (let k = 0; k < half - 1; k++) {
        const i0 = base + side * half + k, i1 = i0 + 1;
        if ((dir > 0) === (side === 0)) paintIdx.push(ci, i0, i1); else paintIdx.push(ci, i1, i0);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex([...paintIdx, ...glassIdx, ...trimIdx]);
  g.addGroup(0, paintIdx.length, 0);
  g.addGroup(paintIdx.length, glassIdx.length, 1);
  g.addGroup(paintIdx.length + glassIdx.length, trimIdx.length, 2);
  g.computeVertexNormals();
  // unir normales en la línea central (techo, capó, piso) para que no se vea una costura
  const nrm = g.attributes.normal, pos = g.attributes.position;
  for (let s = 0; s <= N; s++) {
    for (const k of [0, half - 1]) {
      const a = s * ringSize + k, b2 = s * ringSize + half + k;
      const nx = 0, ny = nrm.getY(a) + nrm.getY(b2), nz = nrm.getZ(a) + nrm.getZ(b2);
      const l = Math.hypot(nx, ny, nz) || 1;
      nrm.setXYZ(a, 0, ny / l, nz / l); nrm.setXYZ(b2, 0, ny / l, nz / l);
    }
  }
  void pos;
  return { geo: g, sta, top, belt, hwf, positions, ringSize, K };
}

// ------------------------------------------------------------------ materiales y recursos compartidos
const R = {};
function res() {
  if (R.tire) return R;
  R.tire = new THREE.MeshStandardMaterial({ color: 0x151517, roughness: 0.88, metalness: 0 });
  R.rim = new THREE.MeshStandardMaterial({ color: 0xc9ced6, roughness: 0.22, metalness: 1 });
  R.rimDark = new THREE.MeshStandardMaterial({ color: 0x2a2c33, roughness: 0.3, metalness: 0.9 });
  R.disc = new THREE.MeshStandardMaterial({ color: 0x5a5e66, roughness: 0.5, metalness: 0.8 });
  R.black = new THREE.MeshStandardMaterial({ color: 0x0c0c0f, roughness: 0.6, metalness: 0.2 });
  R.carbon = new THREE.MeshStandardMaterial({ color: 0x18191d, roughness: 0.35, metalness: 0.5 });
  R.chrome = new THREE.MeshStandardMaterial({ color: 0xe8ecf2, roughness: 0.08, metalness: 1 });
  R.trim = new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 0.18, metalness: 0.4 });
  R.seam = new THREE.LineBasicMaterial({ color: 0x050506, transparent: true, opacity: 0.55 });
  R.lens = new THREE.MeshStandardMaterial({ color: 0xdfe8ff, emissive: 0xcfe0ff, emissiveIntensity: 1.2, roughness: 0.05, metalness: 0.5 });
  R.blur = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.35, metalness: 1, transparent: true, opacity: 0.9 });
  R.blurDark = new THREE.MeshStandardMaterial({ color: 0x34363c, roughness: 0.35, metalness: 1, transparent: true, opacity: 0.9 });
  R.plates = {};
  { // rejilla de panal (textura)
    const c = document.createElement('canvas'); c.width = 64; c.height = 32;
    const g = c.getContext('2d');
    g.fillStyle = '#060607'; g.fillRect(0, 0, 64, 32);
    g.strokeStyle = '#3a3c42'; g.lineWidth = 1.5;
    for (let y = 0; y < 34; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < 66; x += 8) { g.beginPath(); for (let a = 0; a < 6; a++) { const an = a * Math.PI / 3; g.lineTo(x + Math.cos(an) * 3.5, y + Math.sin(an) * 3.5); } g.closePath(); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 1);
    R.mesh = new THREE.MeshStandardMaterial({ map: t, roughness: 0.5, metalness: 0.6 });
  }
  R.well = new THREE.MeshBasicMaterial({ color: 0x050506, side: THREE.DoubleSide });
  R.glass = new THREE.MeshPhysicalMaterial({ color: 0x0b1220, roughness: 0.04, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6 });
  R.head = new THREE.MeshBasicMaterial({ color: 0xf4f8ff });
  R.headHousing = new THREE.MeshStandardMaterial({ color: 0x20242c, roughness: 0.1, metalness: 0.9 });
  R.calipers = [0xd4141e, 0xffc61f, 0x1d4ed8, 0x22b85a].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, metalness: 0.3 }));
  R.flameGeo = new THREE.ConeGeometry(0.09, 0.75, 8).rotateX(-Math.PI / 2).translate(0, 0, -0.37);
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,255,255,0.55)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  R.glowTex = new THREE.CanvasTexture(c);
  const c2 = document.createElement('canvas'); c2.width = 64; c2.height = 128;
  const g2 = c2.getContext('2d');
  const grd2 = g2.createRadialGradient(32, 128, 4, 32, 100, 110);
  grd2.addColorStop(0, 'rgba(255,240,200,0.55)'); grd2.addColorStop(1, 'rgba(255,240,200,0)');
  g2.fillStyle = grd2; g2.beginPath(); g2.moveTo(26, 128); g2.lineTo(0, 0); g2.lineTo(64, 0); g2.lineTo(38, 128); g2.fill();
  R.beamTex = new THREE.CanvasTexture(c2);
  R.wheelCache = {};
  return R;
}

// Rueda: neumático con flanco, llanta de rayos, disco de freno (la pinza va fija aparte)
function wheelGeos(r, w, spokes) {
  const key = r + '_' + w + '_' + spokes;
  if (R.wheelCache[key]) return R.wheelCache[key];
  const tire = mergeGeometries([
    new THREE.CylinderGeometry(r, r, w * 0.82, 28, 1, true).rotateZ(Math.PI / 2),
    new THREE.TorusGeometry(r - w * 0.12, w * 0.12, 6, 28).rotateY(Math.PI / 2).translate(w * 0.4, 0, 0),
    new THREE.TorusGeometry(r - w * 0.12, w * 0.12, 6, 28).rotateY(Math.PI / 2).translate(-w * 0.4, 0, 0),
    new THREE.RingGeometry(r * 0.66, r - w * 0.1, 28).rotateY(Math.PI / 2).translate(w * 0.42, 0, 0),
    new THREE.RingGeometry(r * 0.66, r - w * 0.1, 28).rotateY(-Math.PI / 2).translate(-w * 0.42, 0, 0),
  ].map(g => g.index ? g.toNonIndexed() : g).map(g => { g.deleteAttribute('uv'); return g; }));
  const rr = r * 0.68;
  const parts = [
    new THREE.TorusGeometry(rr - 0.02, 0.03, 6, 28).rotateY(Math.PI / 2).translate(w * 0.36, 0, 0),
    new THREE.CylinderGeometry(rr * 0.22, rr * 0.22, 0.06, 12).rotateZ(Math.PI / 2).translate(w * 0.38, 0, 0),
  ];
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    const sp = new THREE.BoxGeometry(0.05, rr * 0.82, spokes > 6 ? 0.045 : 0.075).translate(0, rr * 0.5, 0);
    sp.rotateX(a);
    sp.translate(w * 0.36, 0, 0);
    parts.push(sp);
  }
  const rim = mergeGeometries(parts.map(g => g.index ? g.toNonIndexed() : g).map(g => { g.deleteAttribute('uv'); return g; }));
  const disc = new THREE.CylinderGeometry(rr * 0.88, rr * 0.88, 0.03, 24).rotateZ(Math.PI / 2).translate(w * 0.18, 0, 0);
  const res = { tire, rim, disc };
  R.wheelCache[key] = res;
  return res;
}

// ------------------------------------------------------------------ modelo completo
export function buildCarModel(def, colorHex, opts = {}) {
  const m = res();
  const b = BODIES[def.body] || BODIES.curvy;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const L = b.L, W = b.W;
  const zOf = u => (u - 0.5) * L;

  const paint = new THREE.MeshPhysicalMaterial({
    color: colorHex, metalness: 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.2,
  });
  const { geo, top, belt, hwf, sta, positions, ringSize, K } = buildBody(b);
  const shell = new THREE.Mesh(geo, [paint, m.glass, m.trim]);
  body.add(shell);
  const add = (g, mat, parent = body) => { const o = new THREE.Mesh(g, mat); parent.add(o); return o; };

  // ---- juntas de las puertas (líneas finas sobre la carrocería) y manijas
  {
    const near = u => { let bi = 0; sta.forEach((st, i) => { if (Math.abs(st.u - u) < Math.abs(sta[bi].u - u)) bi = i; }); return bi; };
    const span = b.cabin[1] - b.cabin[0];
    if (span > 0.12) {
      const dF = near(b.cabin[1] - 0.025), dR = near(Math.max(b.cabin[0] + 0.03, b.cabin[1] - 0.3));
      const P = (s, k, side) => {
        const i = (s * ringSize + side * (2 * K + 2) + k) * 3;
        return [positions[i] * 1.006, positions[i + 1], positions[i + 2]];
      };
      const seg = [];
      for (const side of [0, 1]) {
        for (const s of [dF, dR]) for (let k = 2; k < K; k++) seg.push(...P(s, k, side), ...P(s, k + 1, side));
        for (let s = Math.min(dF, dR); s < Math.max(dF, dR); s++) seg.push(...P(s, 2, side), ...P(s + 1, 2, side));
      }
      const lg = new THREE.BufferGeometry();
      lg.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
      body.add(new THREE.LineSegments(lg, m.seam));
      const hs = sta[near(sta[dR].u + 0.045)];
      for (const sd of [1, -1]) {
        const h = add(new THREE.BoxGeometry(0.03, 0.035, 0.16), m.chrome);
        h.position.set(sd * (hs.hw * 0.995 + 0.012), hs.bl - 0.09, hs.z);
      }
    }
  }

  const atU = u => ({ z: zOf(u), top: top(u), belt: belt(u), hw: hwf(u) * W / 2 });
  const front = atU(0.985), rear = atU(0.015);
  const halfL = L / 2;

  // ---- piezas negras/carbono: splitter, difusor, zócalos laterales
  const blk = [
    new THREE.BoxGeometry(W * 0.86, 0.05, 0.4).translate(0, b.clear + 0.06, halfL - 0.25),            // splitter
    new THREE.BoxGeometry(W * 0.8, 0.14, 0.35).translate(0, b.clear + 0.1, -halfL + 0.2),              // difusor
  ];
  for (const s of [1, -1]) blk.push(new THREE.BoxGeometry(0.05, 0.07, L * 0.36).translate(s * (atU(0.5).hw - 0.07), b.clear + 0.08, zOf(0.5)));
  // aletas del difusor
  for (let i = -2; i <= 2; i++) blk.push(new THREE.BoxGeometry(0.03, 0.16, 0.36).translate(i * W * 0.14, b.clear + 0.14, -halfL + 0.2));
  add(mergeGeometries(blk), m.carbon);

  // ---- pasos de rueda oscuros (para no ver a través de la carrocería)
  b.wheels.forEach(u => {
    for (const s of [1, -1]) {
      const g = new THREE.CylinderGeometry(b.r * 1.13, b.r * 1.13, 0.5, 18, 1, true, 0, Math.PI).rotateZ(Math.PI / 2);
      const o = add(g, m.well);
      o.position.set(s * (W / 2 * b.track - 0.02), b.r, zOf(u));
    }
  });

  // ---- guardabarros musculosos sobre las ruedas
  if (b.fenders) {
    const archTop = b.r * 2.16 - 0.02;
    b.wheels.forEach((u, wi) => {
      if (wi !== 0) return; // solo las "caderas" traseras; adelante el capó es más bajo
      for (const sd of [1, -1]) {
        const f = add(new THREE.SphereGeometry(1, 20, 12), paint);
        f.scale.set(0.24, 0.12, b.r * (wi ? 1.5 : 1.65));
        f.position.set(sd * (W / 2 * b.track + 0.01), archTop + 0.03, zOf(u));
      }
    });
  }

  // ---- tomas de aire laterales (motor central)
  if (b.intakes) {
    for (const s of [1, -1]) {
      const p = atU(0.33);
      const o = add(new THREE.SphereGeometry(1, 12, 8), m.black);
      o.scale.set(0.06, 0.17, 0.48);
      o.position.set(s * (p.hw - 0.03), (p.belt + b.clear) / 2 + 0.12, p.z);
    }
  }
  // ---- capó: rejillas / toma de aire
  if (b.hoodVent) {
    const p = atU(0.8);
    for (const s of [1, -1]) {
      const o = add(new THREE.BoxGeometry(0.34, 0.03, 0.4), m.black);
      o.position.set(s * 0.32, p.top + 0.005, p.z); o.rotation.x = -0.12;
    }
  }
  if (b.scoop) {
    const p = atU(0.8);
    const o = add(new THREE.BoxGeometry(0.6, 0.12, 0.7), paint);
    o.position.set(0, p.top + 0.05, p.z);
    const mouth = add(new THREE.BoxGeometry(0.5, 0.07, 0.04), m.black);
    mouth.position.set(0, p.top + 0.06, p.z + 0.36);
  }
  if (b.engineCover) {
    for (let i = 0; i < 4; i++) {
      const o = add(new THREE.BoxGeometry(W * 0.4, 0.02, 0.06), m.black);
      o.position.set(0, top(0.2 + i * 0.03) + 0.01, zOf(0.2 + i * 0.03));
    }
  }
  // ---- aleta central (hiperauto)
  if (b.fin) {
    const p0 = atU(0.42), p1 = atU(0.06);
    const len = p0.z - p1.z;
    const o = add(new THREE.BoxGeometry(0.03, 0.22, len), paint);
    o.position.set(0, (p0.top + p1.top) / 2 + 0.06, (p0.z + p1.z) / 2);
    o.rotation.x = Math.atan2(p0.top - p1.top, len);
  }
  // ---- jorobas del speedster
  if (b.humps) {
    for (const s of [0.36, -0.36]) {
      const o = add(new THREE.SphereGeometry(1, 14, 10), paint);
      o.scale.set(0.24, 0.2, 0.6);
      o.position.set(s, top(0.44) - 0.02, zOf(0.44));
    }
    // asientos
    const seats = add(new THREE.BoxGeometry(1.2, 0.25, 0.5), m.black);
    seats.position.set(0, belt(0.53) - 0.05, zOf(0.53));
  }
  // ---- caja de pickup
  if (b.bed) {
    const p = atU(0.2);
    const o = add(new THREE.BoxGeometry(W * 0.84, 0.05, L * 0.36), m.black);
    o.position.set(0, top(0.2) + 0.005, p.z);
    const bar = add(new THREE.BoxGeometry(W * 0.9, 0.08, 0.08), m.chrome);
    bar.position.set(0, top(0.42) + 0.62, zOf(0.43));
  }

  // ---- retrovisores
  {
    const p = atU(b.cabin[1] - 0.07);
    for (const s of [1, -1]) {
      const arm = add(new THREE.BoxGeometry(0.12, 0.025, 0.04), m.black);
      arm.position.set(s * (p.hw * 0.86 + 0.05), p.belt + 0.06, p.z);
      const cap = add(new THREE.SphereGeometry(1, 10, 8), paint);
      cap.scale.set(0.07, 0.05, 0.1);
      cap.position.set(s * (p.hw * 0.86 + 0.13), p.belt + 0.08, p.z - 0.02);
    }
  }

  // ---- alerón
  const wingY = top(0.04);
  if (def.wing === 'lip') {
    const o = add(new THREE.BoxGeometry(W * 0.8, 0.04, 0.16), m.carbon);
    o.position.set(0, wingY + 0.03, zOf(0.04)); o.rotation.x = 0.25;
  } else if (def.wing === 'wing' || def.wing === 'big') {
    const big = def.wing === 'big';
    const h = big ? 0.42 : 0.24, wd = W * (big ? 0.95 : 0.82), dep = big ? 0.38 : 0.3;
    const z = zOf(big ? 0.06 : 0.07);
    const g = [new THREE.BoxGeometry(wd, 0.035, dep).translate(0, wingY + h, z)];
    for (const s of [1, -1]) {
      g.push(new THREE.BoxGeometry(0.03, h, 0.1).translate(s * wd * 0.3, wingY + h / 2, z));
      g.push(new THREE.BoxGeometry(0.025, 0.16, dep + 0.06).translate(s * wd / 2, wingY + h + 0.02, z));
    }
    add(mergeGeometries(g), m.carbon);
  }

  // ---- faros
  const glowMat = new THREE.SpriteMaterial({ map: m.glowTex, color: 0xeaf2ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.75 });
  for (const s of [1, -1]) {
    const pu = atU(0.95);
    const x = s * pu.hw * 0.62;
    const y = Math.max(b.clear + 0.25, pu.belt - 0.04);
    if (b.lights === 'round') {
      const ring = add(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 16).rotateX(Math.PI / 2), m.chrome);
      ring.position.set(x, y, pu.z + 0.12);
      const lens = add(new THREE.CircleGeometry(0.09, 16), m.head);
      lens.position.set(x, y, pu.z + 0.16);
    } else if (b.lights === 'square') {
      const o = add(new THREE.BoxGeometry(0.36, 0.16, 0.06), m.head);
      o.position.set(x, y, front.z + 0.02);
    } else {
      const housing = add(new THREE.SphereGeometry(1, 14, 8), m.headHousing);
      housing.scale.set(0.24, 0.05, 0.2);
      housing.position.set(x, y, pu.z + 0.06);
      housing.rotation.y = s * 0.25;
      const drl = add(new THREE.BoxGeometry(0.34, 0.018, 0.04), m.head);
      drl.position.set(x, y - 0.02, pu.z + 0.17);
      drl.rotation.y = s * 0.3;
      // dos proyectores dentro del faro
      for (const o of [-0.07, 0.06]) {
        const lens = add(new THREE.SphereGeometry(0.035, 10, 8), m.lens);
        lens.position.set(x + o * s, y + 0.008, pu.z + 0.13 - Math.abs(o) * 0.3);
      }
    }
    const sp = new THREE.Sprite(glowMat);
    sp.scale.setScalar(opts.night ? 1.3 : 0.4);
    sp.position.set(x, y, front.z + 0.2);
    body.add(sp);
  }
  // parrilla / toma frontal
  {
    const o = add(new THREE.BoxGeometry(W * 0.5, 0.1, 0.05), m.black);
    o.position.set(0, b.clear + 0.2, front.z - 0.02);
  }

  // ---- luces traseras (cambian al frenar)
  const tailMat = new THREE.MeshBasicMaterial({ color: 0x9a0a16 });
  const ty = Math.max(b.clear + 0.3, rear.belt - 0.06);
  if (b.tails === 'strip') {
    add(new THREE.BoxGeometry(W * 0.78, 0.04, 0.04), tailMat).position.set(0, ty, rear.z - 0.04);
  } else if (b.tails === 'round' || b.tails === 'quad') {
    const xs = b.tails === 'quad' ? [0.62, 0.42] : [0.6];
    for (const s of [1, -1]) for (const f of xs) {
      const o = add(new THREE.CircleGeometry(b.tails === 'quad' ? 0.075 : 0.09, 14).rotateY(Math.PI), tailMat);
      o.position.set(s * rear.hw * f, ty, rear.z - 0.05);
    }
  }
  // luces redondas LED dobles (superdeportivos) + rejilla de panal entre ellas
  if (b.tails === 'ring') {
    const rz = rear.z - 0.05;
    for (const s of [1, -1]) {
      const x = s * rear.hw * 0.58;
      const ring = add(new THREE.TorusGeometry(0.1, 0.022, 8, 24).rotateY(Math.PI), tailMat);
      ring.position.set(x, ty, rz);
      const inner = add(new THREE.TorusGeometry(0.05, 0.012, 6, 18).rotateY(Math.PI), tailMat);
      inner.position.set(x, ty, rz - 0.005);
      const back = add(new THREE.CircleGeometry(0.12, 20).rotateY(Math.PI), m.trim);
      back.position.set(x, ty, rz + 0.02);
    }
    const grille = add(new THREE.PlaneGeometry(rear.hw * 0.8, 0.16).rotateY(Math.PI), m.mesh);
    grille.position.set(0, ty - 0.02, rear.z - 0.03);
  }
  // tercera luz de freno (arriba de la luneta)
  if (b.cabin[1] - b.cabin[0] > 0.12) {
    const u3 = b.cabin[0] + 0.012;
    add(new THREE.BoxGeometry(W * 0.22, 0.022, 0.03), tailMat).position.set(0, top(u3) - 0.015, zOf(u3));
  }
  // placa trasera
  {
    const key = def.id;
    if (!m.plates[key]) {
      const c = document.createElement('canvas'); c.width = 256; c.height = 64;
      const g = c.getContext('2d');
      g.fillStyle = '#f4f4ee'; g.fillRect(0, 0, 256, 64);
      g.fillStyle = '#1d3a8a'; g.fillRect(0, 0, 26, 64);
      g.strokeStyle = '#222'; g.lineWidth = 4; g.strokeRect(2, 2, 252, 60);
      g.fillStyle = '#151515'; g.font = 'bold 40px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(('TD ' + def.id.slice(0, 4) + ' ' + String(def.top)).toUpperCase(), 140, 34);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      m.plates[key] = new THREE.MeshStandardMaterial({ map: t, roughness: 0.4, metalness: 0.1 });
    }
    const plate = add(new THREE.PlaneGeometry(0.52, 0.13).rotateY(Math.PI), m.plates[key]);
    plate.position.set(0, b.clear + 0.36, zOf(0.004) - 0.03);
  }
  const tailGlowMat = new THREE.SpriteMaterial({ map: m.glowTex, color: 0xff2030, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.35 });
  for (const s of [1, -1]) {
    const t = new THREE.Sprite(tailGlowMat); t.scale.setScalar(0.8);
    t.position.set(s * rear.hw * (b.tails === 'ring' ? 0.58 : 0.6), ty, rear.z - 0.15); body.add(t);
  }

  // ---- escapes
  const exY = b.clear + 0.16;
  const exX = b.tails === 'ring' ? [0.4, 0.27, -0.27, -0.4] : b.tails === 'quad' ? [0.5, 0.36, -0.36, -0.5] : [0.4, -0.4];
  const pipes = mergeGeometries(exX.map(x => new THREE.CylinderGeometry(0.055, 0.06, 0.22, 10).rotateX(Math.PI / 2).translate(x, exY, -halfL + 0.02)));
  add(pipes, m.chrome);

  // ---- luz bajo el auto y haz de faros (noche)
  if (opts.night) {
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(5, 14).rotateX(-Math.PI / 2).translate(0, 0.06, halfL + 7),
      new THREE.MeshBasicMaterial({ map: m.beamTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 }));
    beam.renderOrder = 2; root.add(beam);
    const under = new THREE.Mesh(new THREE.PlaneGeometry(W + 1.2, L + 1).rotateX(-Math.PI / 2).translate(0, 0.05, 0),
      new THREE.MeshBasicMaterial({ map: m.glowTex, color: colorHex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7 }));
    under.renderOrder = 2; root.add(under);
  }

  // ---- ruedas
  const wW = b.r * (def.body === 'truck' ? 0.75 : 0.68);
  const spokes = { hyper: 10, wedge: 5, curvy: 5, gt: 10, electric: 6, speedster: 5, tuner: 6, muscle: 5, sedan: 5, hatch: 6, compact: 4, truck: 6 }[def.body] || 5;
  const wg = wheelGeos(b.r, wW, spokes);
  const rimMat = ['tuner', 'hyper', 'truck'].includes(def.body) ? m.rimDark : m.rim;
  const caliper = m.calipers[(def.id.length + def.top) % m.calipers.length];
  const wheels = [];
  const blurs = [];
  const wx = W / 2 * b.track;
  for (const [x, u] of [[wx, b.wheels[1]], [-wx, b.wheels[1]], [wx, b.wheels[0]], [-wx, b.wheels[0]]]) {
    const z = zOf(u);
    const pivot = new THREE.Group();
    pivot.position.set(x, b.r, z);
    const side = new THREE.Group(); // espejo para el lado izquierdo
    if (x < 0) side.scale.x = -1;
    pivot.add(side);
    const spin = new THREE.Group();
    const rimMesh = new THREE.Mesh(wg.rim, rimMat);
    spin.add(new THREE.Mesh(wg.tire, m.tire), rimMesh, new THREE.Mesh(wg.disc, m.disc));
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(b.r * 0.12, b.r * 0.12, 0.02, 12).rotateZ(Math.PI / 2), caliper);
    cap.position.x = wW * 0.42; spin.add(cap);
    // disco "borroso" que reemplaza los rayos a alta velocidad
    const blur = new THREE.Mesh(new THREE.CircleGeometry(b.r * 0.66, 24).rotateY(Math.PI / 2), rimMat === m.rimDark ? m.blurDark : m.blur);
    blur.position.x = wW * 0.37; blur.visible = false; spin.add(blur);
    blurs.push([rimMesh, blur]);
    side.add(spin);
    const cal = new THREE.Mesh(new THREE.BoxGeometry(0.08, b.r * 0.5, b.r * 0.28), caliper);
    cal.position.set(wW * 0.22, b.r * 0.32, -b.r * 0.2);
    side.add(cal);
    root.add(pivot);
    wheels.push({ pivot, spin, front: u > 0.5 });
  }

  // ---- llamas del escape: shader con núcleo blanco, color del turbo y parpadeo
  const flameMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(0x2a7bff) }, uTime: { value: 0 }, uPower: { value: 1 } },
    vertexShader: `varying float vT; varying float vR; uniform float uTime; uniform float uPower;
      void main(){
        vT = clamp(-position.z / 0.75, 0.0, 1.0);
        vR = length(position.xy) / 0.09;
        vec3 p = position;
        p.z *= uPower * (0.85 + 0.25 * sin(uTime * 61.0 + position.x * 40.0));
        p.xy *= 1.0 + 0.25 * sin(uTime * 47.0 + vT * 9.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `uniform vec3 uColor; uniform float uTime; varying float vT; varying float vR;
      void main(){
        float core = smoothstep(0.55, 0.0, vT) * smoothstep(0.9, 0.0, vR);
        vec3 c = mix(uColor, vec3(1.0, 0.98, 0.92), core);
        c = mix(c, uColor * 0.6 + vec3(0.05, 0.0, 0.1), smoothstep(0.5, 1.0, vT));
        float a = pow(1.0 - vT, 1.4) * (0.75 + 0.25 * sin(uTime * 83.0 + vT * 20.0));
        gl_FragColor = vec4(c * a * 1.6, a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const flameCore = flameMat; // compatibilidad
  const flames = [];
  for (const x of exX) {
    const f = new THREE.Mesh(m.flameGeo, flameMat);
    f.position.set(x, exY, -halfL - 0.08);
    f.visible = false;
    body.add(f);
    flames.push(f);
  }
  // luz del escape reflejada en el piso detrás del auto
  const exGlowMat = new THREE.MeshBasicMaterial({ map: m.glowTex, color: 0x2a7bff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const exGlow = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.6, 3.2).rotateX(-Math.PI / 2), exGlowMat);
  exGlow.position.set(0, 0.06, -halfL - 1.0);
  exGlow.renderOrder = 3;
  root.add(exGlow);
  // destello en la boca de los escapes
  const muzzleMat = new THREE.SpriteMaterial({ map: m.glowTex, color: 0x6fb4ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
  const muzzle = new THREE.Sprite(muzzleMat);
  muzzle.position.set(0, exY, -halfL - 0.15);
  muzzle.scale.set(W * 0.9, 0.5, 1);
  body.add(muzzle);

  // ---- escudo (ítem)
  const shield = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }));
  shield.scale.set(W * 0.85, 1.3, L * 0.62);
  shield.position.y = 0.7;
  shield.visible = false;
  root.add(shield);

  return {
    root, body, wheels, flames, flameMat, flameCore, shield, tailMat, tailGlowMat, paint, exGlowMat, muzzleMat,
    // turbo: power 0 = apagado; color del fuego
    setFlames(power, color, time) {
      const on = power > 0.02;
      for (const f of flames) f.visible = on;
      flameMat.uniforms.uTime.value = time;
      flameMat.uniforms.uPower.value = Math.max(0.3, power);
      flameMat.uniforms.uColor.value.setHex(color);
      exGlowMat.color.setHex(color);
      exGlowMat.opacity = Math.min(0.9, power * 0.75) * (0.8 + Math.random() * 0.2);
      muzzleMat.color.setHex(color);
      muzzleMat.opacity = Math.min(1, power) * (0.6 + Math.random() * 0.4);
    },
    rearWheelLocal: [new THREE.Vector3(wx, 0.05, zOf(b.wheels[0])), new THREE.Vector3(-wx, 0.05, zOf(b.wheels[0]))],
    halfLength: halfL,
    // ojos del piloto (cámara interior): asiento izquierdo, un poco detrás del parabrisas
    eye: (() => {
      const span = b.cabin[1] - b.cabin[0];
      const u = span < 0.12 ? b.cabin[0] - 0.08 : b.cabin[0] + span * 0.42;
      return { x: Math.min(0.34, W * 0.17), y: belt(u) + 0.27, z: zOf(u) };
    })(),
    setBlur(on) {
      for (const [rim, bl] of blurs) { rim.visible = !on; bl.visible = on; }
    },
    setBraking(on) {
      tailMat.color.setHex(on ? 0xff1a2a : 0x9a0a16);
      tailGlowMat.opacity = on ? 0.95 : 0.35;
    },
  };
}
