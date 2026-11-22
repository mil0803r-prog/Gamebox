import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Decoración común junto a la pista: gradas con público, carteles, arcos de neón y parrilla de salida

function adTexture(lines, bg, fg, accent) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 512, 128);
  grd.addColorStop(0, bg[0]); grd.addColorStop(1, bg[1]);
  g.fillStyle = grd; g.fillRect(0, 0, 512, 128);
  g.fillStyle = accent; g.fillRect(0, 0, 512, 10); g.fillRect(0, 118, 512, 10);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'italic 900 64px Arial Black, Arial, sans-serif';
  g.fillText(lines[0], 256, lines[1] ? 52 : 66);
  if (lines[1]) { g.font = 'bold 26px Arial, sans-serif'; g.fillText(lines[1], 256, 98); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const ADS = [
  [['TURBO DUELO', 'CARRERAS ARCADE'], ['#ff2bd6', '#6a0fd0'], '#ffffff', '#ffe14d'],
  [['NITRO ⚡', 'MÁS RÁPIDO QUE TÚ'], ['#00b7d4', '#003a8a'], '#ffffff', '#00e5ff'],
  [['¡DERRAPA!', 'CARGA EL MINI-TURBO'], ['#ff8a1f', '#c0301a'], '#ffffff', '#ffe14d'],
  [['GOMAS PULGA', 'AGARRE TOTAL'], ['#1f1f2a', '#3a3a50'], '#ffe14d', '#ff2bd6'],
];

function inst(geo, mat, list) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
  list.forEach((mtx, i) => m.setMatrixAt(i, mtx));
  m.count = list.length;
  m.instanceMatrix.needsUpdate = true;
  m.computeBoundingSphere();
  return m;
}

const tmpO = new THREE.Object3D();
function mat4(x, y, z, ry, sx = 1, sy = 1, sz = 1) {
  tmpO.position.set(x, y, z); tmpO.rotation.set(0, ry, 0); tmpO.scale.set(sx, sy, sz);
  tmpO.updateMatrix();
  return tmpO.matrix.clone();
}

export function buildTrackside(track, theme, group, rand, quality) {
  const m = track.main, L = track.length;
  const free = (x, z, r) => track.distToRoad(x, z) > r;

  // ---------------------------------------------------------------- parrilla de salida
  const gridMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false });
  const gridMarks = [];
  for (let i = 0; i < 4; i++) {
    const row = Math.floor(i / 2), col = i % 2;
    const s = L - 10 - row * 9 - col * 3 + 2.6;
    const p = m.pointAt(s, (col ? 1 : -1) * 4.2);
    gridMarks.push(mat4(p.x, p.y + 0.07, p.z, Math.atan2(p.fx, p.fz), 3.2, 1, 0.35));
  }
  const gm = inst(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), gridMat, gridMarks);
  gm.renderOrder = 1;
  group.add(gm);

  // ---------------------------------------------------------------- gradas con público junto a la meta
  const st0 = m.pointAt(0);
  let side = 1;
  {
    const a = m.pointAt(0, st0.hw + 16), b = m.pointAt(0, -st0.hw - 16);
    side = track.distToRoad(a.x, a.z) >= track.distToRoad(b.x, b.z) ? 1 : -1;
  }
  const standMat = new THREE.MeshLambertMaterial({ color: theme.basic ? 0x2a2a44 : 0x8a8f9c });
  const roofMat = new THREE.MeshLambertMaterial({ color: theme.basic ? 0xff2bd6 : 0xd94a2b, emissive: theme.basic ? 0x550040 : 0x000000 });
  const steps = [], roofs = [], posts = [];
  const crowd = [];
  const crowdColors = [];
  const palette = [0xff3344, 0x2f7bff, 0xffd21f, 0x2fdc6a, 0xff4fd8, 0xffffff, 0xff8a1f, 0x7a4bff];
  for (let s = -50; s <= 50; s += 10) {
    const hw = m.pointAt(s).hw;
    const base = m.pointAt(s, side * (hw + 4));
    if (!free(base.x, base.z, hw * 0 + 2.5)) continue;
    const ry = Math.atan2(base.fx, base.fz);
    const rx = -base.fz * side, rz = base.fx * side; // hacia afuera
    for (let t = 0; t < 4; t++) {
      const off = 1.2 + t * 1.6;
      const x = base.x + rx * off, z = base.z + rz * off;
      steps.push(mat4(x, base.y + 0.5 + t * 0.9, z, ry, 1, 1 + t * 1.8, 1));
      // público
      for (let k = -4; k <= 4; k++) {
        if (rand() < 0.2) continue;
        const px = x + base.fx * k * 1.05, pz = z + base.fz * k * 1.05;
        crowd.push(mat4(px, base.y + 1.2 + t * 0.9 * 2 + 0.05, pz, ry, 1, 0.8 + rand() * 0.3, 1));
        crowdColors.push(palette[(rand() * palette.length) | 0]);
      }
    }
    const rx2 = base.x + rx * 7.5, rz2 = base.z + rz * 7.5;
    posts.push(mat4(rx2, base.y + 4.5, rz2, ry, 1, 1, 1));
    roofs.push(mat4(base.x + rx * 4, base.y + 9, base.z + rz * 4, ry, 1, 1, 1));
  }
  if (steps.length) {
    group.add(inst(new THREE.BoxGeometry(1.6, 0.9, 10.2), standMat, steps));
    group.add(inst(new THREE.BoxGeometry(0.4, 9, 0.4), standMat, posts));
    group.add(inst(new THREE.BoxGeometry(9, 0.3, 10.2), roofMat, roofs));
    const person = mergeGeometries([new THREE.BoxGeometry(0.42, 0.55, 0.3).translate(0, -0.12, 0), new THREE.BoxGeometry(0.26, 0.26, 0.26).translate(0, 0.3, 0)]);
    const cm = inst(person, new THREE.MeshLambertMaterial({ color: 0xffffff }), crowd);
    crowdColors.forEach((c, i) => cm.setColorAt(i, new THREE.Color(c)));
    if (cm.instanceColor) cm.instanceColor.needsUpdate = true;
    group.add(cm);
  }

  // ---------------------------------------------------------------- carteles publicitarios
  const adMats = ADS.map(a => new THREE.MeshBasicMaterial({ map: adTexture(...a), side: THREE.DoubleSide, fog: true }));
  const boards = ADS.map(() => []);
  const legs = [];
  let k = 0;
  for (let s = 120; s < L - 60; s += 170) {
    const sd = (k % 2 ? 1 : -1);
    const p = m.pointAt(s, 0);
    const q = m.pointAt(s, sd * (p.hw + 5));
    if (!free(q.x, q.z, 3.5)) { k++; continue; }
    // mirando hacia los autos que se acercan (algo girado hacia la pista)
    const ry = Math.atan2(p.fx, p.fz) + Math.PI + sd * 0.35;
    boards[k % ADS.length].push(mat4(q.x, q.y + 4.2, q.z, ry, 1, 1, 1));
    const lx = Math.cos(ry) * 4.2, lz = -Math.sin(ry) * 4.2;
    legs.push(mat4(q.x + lx, q.y + 1.6, q.z + lz, ry), mat4(q.x - lx, q.y + 1.6, q.z - lz, ry));
    k++;
  }
  const boardGeo = new THREE.PlaneGeometry(10, 2.5);
  boards.forEach((list, i) => list.length && group.add(inst(boardGeo, adMats[i], list)));
  if (legs.length) group.add(inst(new THREE.BoxGeometry(0.3, 3.2, 0.3), new THREE.MeshLambertMaterial({ color: 0x333340 }), legs));

  // ---------------------------------------------------------------- arcos de neón (ciudad) / banderines (resto)
  const arches = [[], []], archPosts = [];
  let a = 0;
  for (let s = 260; s < L - 120; s += 230) {
    const p = m.pointAt(s);
    const ry = Math.atan2(p.fx, p.fz);
    const w = p.hw * 2 + 2.4;
    arches[a % 2].push(mat4(p.x, p.y + 7.2, p.z, ry, w, 1, 1));
    for (const sd of [-1, 1]) {
      const q = m.pointAt(s, sd * (p.hw + 1.2));
      archPosts.push(mat4(q.x, q.y + 3.6, q.z, ry));
    }
    a++;
  }
  if (archPosts.length) {
    const colA = theme.basic ? 0x00e5ff : 0xffffff, colB = theme.basic ? 0xff2bd6 : 0xff3b3b;
    const beam = new THREE.BoxGeometry(1, 0.6, 0.5);
    group.add(inst(beam, new THREE.MeshBasicMaterial({ color: colA }), arches[0]));
    group.add(inst(beam, new THREE.MeshBasicMaterial({ color: colB }), arches[1]));
    group.add(inst(new THREE.BoxGeometry(0.5, 7.2, 0.5), new THREE.MeshLambertMaterial({ color: theme.basic ? 0x222233 : 0x555560 }), archPosts));
  }
}
