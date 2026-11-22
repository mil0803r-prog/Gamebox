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

  if (t === 'coast') {
    const b = track.bounds;
    // ---- mar con olas (textura que se desplaza)
    const wc = document.createElement('canvas'); wc.width = wc.height = 256;
    const wg = wc.getContext('2d');
    wg.fillStyle = '#1d6db3'; wg.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) {
      wg.fillStyle = `rgba(${200 + rand() * 55 | 0},${230 + rand() * 25 | 0},255,${0.08 + rand() * 0.18})`;
      wg.fillRect(rand() * 256, rand() * 256, 6 + rand() * 18, 1.5);
    }
    const wtex = new THREE.CanvasTexture(wc); wtex.colorSpace = THREE.SRGBColorSpace;
    wtex.wrapS = wtex.wrapT = THREE.RepeatWrapping; wtex.repeat.set(60, 60);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: wtex, color: 0xffffff, roughness: 0.18, metalness: 0.25 }));
    sea.position.set(b.center.x, -0.55, b.center.z - 1200 - 70);
    group.add(sea);
    updaters.push(dt => { wtex.offset.x += dt * 0.004; wtex.offset.y += dt * 0.007; });

    const vmat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    // ---- puerto: contenedores apilados en el muelle
    const contCols = [0xd9332b, 0x2f6fd0, 0x2fa05a, 0xf0a020, 0x8a8f9c, 0xe8e8e8, 0x1f8f9a, 0xa04ad0];
    const conts = [];
    for (let x = 120; x < 690; x += 7) {
      for (let z = -150; z < -60; z += 3.2) {
        if (rand() < 0.35) continue;
        const h = 1 + Math.floor(rand() * 4);
        for (let k = 0; k < h; k++) conts.push({ x, y: 0.6 + k * 2.6, z, c: contCols[(rand() * contCols.length) | 0] });
      }
    }
    const cm = instanced(new THREE.BoxGeometry(6, 2.5, 2.9).translate(0, 1.25, 0), new THREE.MeshLambertMaterial({ color: 0xffffff }), conts);
    conts.forEach((c, i) => cm.setColorAt(i, new THREE.Color(c.c)));
    if (cm.instanceColor) cm.instanceColor.needsUpdate = true;
    group.add(cm);
    // ---- grúas del puerto
    const crane = mergeGeometries([
      colored(new THREE.BoxGeometry(1.4, 34, 1.4).translate(-5, 17, 0), 0xf2b51f),
      colored(new THREE.BoxGeometry(1.4, 34, 1.4).translate(5, 17, 0), 0xf2b51f),
      colored(new THREE.BoxGeometry(12, 1.6, 1.6).translate(0, 30, 0), 0xf2b51f),
      colored(new THREE.BoxGeometry(2, 2, 52).translate(0, 36, -14), 0xf2b51f),
      colored(new THREE.BoxGeometry(4, 3, 4).translate(0, 38.5, 4), 0xe8e8e8),
      colored(new THREE.BoxGeometry(0.2, 18, 0.2).translate(0, 26, -30), 0x333333),
    ]);
    const cranes = [180, 320, 470, 620].map(x => ({ x, y: 0.6, z: -165, rot: 0 }));
    group.add(instanced(crane, vmat, cranes));
    // ---- barcos en el mar
    const ship = mergeGeometries([
      colored(new THREE.BoxGeometry(14, 6, 70).translate(0, 1, 0), 0x2a3a5a),
      colored(new THREE.BoxGeometry(12, 6, 14).translate(0, 7, -24), 0xf2f2f2),
      colored(new THREE.BoxGeometry(13, 5, 40).translate(0, 6, 8), 0xd9332b),
    ]);
    group.add(instanced(ship, vmat, [{ x: 250, y: -0.5, z: -260, rot: 1.4 }, { x: 640, y: -0.5, z: -330, rot: 1.7 }, { x: -100, y: -0.5, z: -400, rot: 1.2 }]));
    // ---- ciudad de día al norte
    const bm = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const blds = scatter(track, Math.round(110 * dens), 40, 260, rand).filter(p => p.z > 120).map(p => ({ ...p, rot: rand() * 0.3, w: 14 + rand() * 20, h: 20 + rand() * 70 * (p.d > 120 ? 1.5 : 1) }));
    const bi = instanced(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), bm, blds, (o, it) => o.scale.set(it.w, it.h, it.w * (0.7 + rand() * 0.6)));
    const bcols = [0xdfe6ee, 0x9fb8d0, 0xc9d3dc, 0x7fa0c0, 0xe8e0d0, 0xb0c4d8];
    blds.forEach((_, i) => bi.setColorAt(i, new THREE.Color(bcols[i % bcols.length])));
    if (bi.instanceColor) bi.instanceColor.needsUpdate = true;
    group.add(bi);
    // ---- palmeras junto a la autopista
    const palm = mergeGeometries([
      colored(new THREE.CylinderGeometry(0.22, 0.32, 7, 6).translate(0, 3.5, 0), 0x8a6a42),
      ...[0, 1, 2, 3, 4, 5].map(i => colored(new THREE.BoxGeometry(0.5, 0.12, 3.4).translate(0, 0, 1.6).rotateX(0.5).rotateY(i * Math.PI / 3).translate(0, 7, 0), 0x2f8f3a)),
    ]);
    const palms = scatter(track, Math.round(120 * dens), 4, 40, rand).filter(p => p.y > -0.2).map(p => ({ ...p, rot: rand() * 6 }));
    group.add(instanced(palm, vmat, palms, (o, it) => o.scale.setScalar(0.9 + rand() * 0.5)));
  }

  return { update(dt, time) { updaters.forEach(u => u(dt, time)); } };
}
