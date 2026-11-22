import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { windowsTexture } from './textures.js';

function colored(geo, color) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(color);
  const arr = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < arr.length; i += 3) { arr[i] = c.r; arr[i + 1] = c.g; arr[i + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (g.attributes.uv) g.deleteAttribute('uv');
  return g;
}

// generador pseudoaleatorio determinista
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function scatter(track, count, minD, maxD, rand, tries = 30) {
  const b = track.bounds, out = [];
  const pad = maxD;
  for (let i = 0; i < count * tries && out.length < count; i++) {
    const x = b.minx - pad + rand() * (b.maxx - b.minx + pad * 2);
    const z = b.minz - pad + rand() * (b.maxz - b.minz + pad * 2);
    const d = track.distToRoad(x, z);
    if (d < minD || d > maxD) continue;
    out.push({ x, z, d, y: track.terrainHeight(x, z) });
  }
  return out;
}

function instanced(geo, mat, items, setup) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length));
  const o = new THREE.Object3D();
  items.forEach((it, i) => {
    o.position.set(it.x, it.y, it.z);
    o.rotation.set(0, it.rot || 0, 0);
    o.scale.set(1, 1, 1);
    setup && setup(o, it, i);
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
  });
  m.count = items.length;
  m.instanceMatrix.needsUpdate = true;
  m.computeBoundingSphere();
  return m;
}

export function buildEnvironment(track, theme, group, quality) {
  const rand = rng(track.def.id.length * 977 + 13);
  const dens = quality >= 2 ? 1 : 0.6;
  const t = track.def.theme;
  const updaters = [];

  if (t === 'city') {
    const wtex = windowsTexture();
    const bmat = new THREE.MeshLambertMaterial({ map: wtex, emissive: 0xffffff, emissiveMap: wtex, emissiveIntensity: 0.9 });
    const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    // suelo del techo sin textura: aceptable en low-poly
    const items = scatter(track, Math.round(170 * dens), 16, 170, rand).map(p => ({ ...p, rot: rand() * Math.PI, w: 12 + rand() * 18, dd: 12 + rand() * 18, h: 14 + rand() * 60 * (p.d > 60 ? 1.4 : 1) }));
    // evitar solapes groseros
    const kept = [];
    for (const it of items) {
      if (kept.every(k => Math.hypot(k.x - it.x, k.z - it.z) > (k.w + it.w) * 0.55)) kept.push(it);
    }
    group.add(instanced(box, bmat, kept, (o, it) => { o.scale.set(it.w, it.h, it.dd); o.position.y = -0.2; }));
    // letreros de neón en algunos edificios
    const neonCols = [0xff2bd6, 0x00e5ff, 0xffe14d, 0x7cff4d];
    neonCols.forEach((c, ci) => {
      const signs = kept.filter((_, i) => i % 5 === ci);
      const g = new THREE.BoxGeometry(1, 1, 1);
      group.add(instanced(g, new THREE.MeshBasicMaterial({ color: c }), signs, (o, it) => {
        o.scale.set(it.w * 1.02, 1.2, it.dd * 1.02);
        o.position.y = it.h * (0.55 + (ci * 0.1));
      }));
    });
    // farolas a lo largo de la pista
    const lamps = [];
    for (let s = 0; s < track.length; s += 34) {
      for (const side of [-1, 1]) {
        const p = track.main.pointAt(s, side * (track.main.pointAt(s).hw + 2.2));
        if (track.distToRoad(p.x, p.z) < 1.2) continue;
        lamps.push({ x: p.x, y: p.y, z: p.z });
      }
    }
    const pole = new THREE.CylinderGeometry(0.15, 0.2, 7, 5).translate(0, 3.5, 0);
    group.add(instanced(pole, new THREE.MeshLambertMaterial({ color: 0x333344 }), lamps));
    const head = new THREE.SphereGeometry(0.45, 6, 4).translate(0, 7.2, 0);
    group.add(instanced(head, new THREE.MeshBasicMaterial({ color: 0xffe9b0 }), lamps));
  }

  if (t === 'desert') {
    // cactus
    const parts = [
      colored(new THREE.CylinderGeometry(0.45, 0.55, 5, 6).translate(0, 2.5, 0), 0x3f8f3a),
      colored(new THREE.CylinderGeometry(0.3, 0.3, 2, 6).rotateZ(Math.PI / 2).translate(0.9, 2.2, 0), 0x3f8f3a),
      colored(new THREE.CylinderGeometry(0.3, 0.3, 1.8, 6).translate(1.8, 3, 0), 0x3f8f3a),
      colored(new THREE.CylinderGeometry(0.28, 0.28, 1.6, 6).rotateZ(Math.PI / 2).translate(-0.8, 3.0, 0), 0x3f8f3a),
      colored(new THREE.CylinderGeometry(0.28, 0.28, 1.5, 6).translate(-1.55, 3.6, 0), 0x3f8f3a),
    ];
    const cactus = mergeGeometries(parts);
    const vmat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    const cs = scatter(track, Math.round(160 * dens), 6, 160, rand).map(p => ({ ...p, rot: rand() * 6, s: 0.8 + rand() * 0.8 }));
    group.add(instanced(cactus, vmat, cs, (o, it) => o.scale.setScalar(it.s)));
    // rocas
    const rock = colored(new THREE.DodecahedronGeometry(1, 0), 0xa0623a);
    const rs = scatter(track, Math.round(110 * dens), 5, 200, rand).map(p => ({ ...p, rot: rand() * 6, s: 1 + rand() * 3 }));
    group.add(instanced(rock, vmat, rs, (o, it) => { o.scale.set(it.s, it.s * 0.7, it.s * 1.2); }));
    // mesetas lejanas
    const mesa = mergeGeometries([
      colored(new THREE.CylinderGeometry(0.8, 1, 1, 7).translate(0, 0.5, 0), 0xc0643a),
      colored(new THREE.CylinderGeometry(0.82, 0.82, 0.08, 7).translate(0, 1, 0), 0xe08a50),
    ]);
    const ms = scatter(track, 22, 90, 420, rand).map(p => ({ ...p, rot: rand() * 6, r: 25 + rand() * 45, h: 25 + rand() * 55 }));
    group.add(instanced(mesa, vmat, ms, (o, it) => { o.scale.set(it.r, it.h, it.r * (0.7 + rand() * 0.6)); o.position.y -= 3; }));
  }

  if (t === 'snow') {
    const vmat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    const pine = mergeGeometries([
      colored(new THREE.CylinderGeometry(0.25, 0.3, 1.6, 5).translate(0, 0.8, 0), 0x6b4a2b),
      colored(new THREE.ConeGeometry(2.2, 3.4, 7).translate(0, 2.8, 0), 0x1f5a3a),
      colored(new THREE.ConeGeometry(1.7, 2.8, 7).translate(0, 4.4, 0), 0x2a6b45),
      colored(new THREE.ConeGeometry(1.0, 2.0, 7).translate(0, 5.9, 0), 0xf2f7fb),
    ]);
    const ps = scatter(track, Math.round(320 * dens), 5, 190, rand).map(p => ({ ...p, rot: rand() * 6, s: 0.8 + rand() * 1.1 }));
    group.add(instanced(pine, vmat, ps, (o, it) => o.scale.setScalar(it.s)));
    const rock = colored(new THREE.DodecahedronGeometry(1, 0), 0x7d8794);
    const rs = scatter(track, Math.round(60 * dens), 5, 150, rand).map(p => ({ ...p, rot: rand() * 6, s: 1 + rand() * 2.5 }));
    group.add(instanced(rock, vmat, rs, (o, it) => o.scale.set(it.s, it.s * 0.8, it.s)));
    // montañas lejanas con nieve
    const mount = mergeGeometries([
      colored(new THREE.ConeGeometry(1, 0.62, 8).translate(0, 0.31, 0), 0x6a7a92),
      colored(new THREE.ConeGeometry(0.42, 0.28, 8).translate(0, 0.62 - 0.14 + 0.001, 0), 0xffffff),
    ]);
    const ms = scatter(track, 18, 160, 480, rand).map(p => ({ ...p, rot: rand() * 6, r: 70 + rand() * 90 }));
    group.add(instanced(mount, vmat, ms, (o, it) => { o.scale.set(it.r, it.r * (1.1 + rand() * 0.6), it.r); o.position.y -= 5; }));
  }

  return { update(dt, time) { updaters.forEach(u => u(dt, time)); } };
}
