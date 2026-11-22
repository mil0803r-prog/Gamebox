import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Modelos low-poly: la carrocería es un perfil lateral extruido a lo ancho (silueta real
// de auto con capó, parabrisas y maletero). El auto mira hacia +Z.

// Perfiles laterales [z (adelante), y (arriba)] y medidas por forma
const SHAPES = {
  sport: {
    body: [[-2.15, 0.28], [2.2, 0.28], [2.3, 0.5], [2.05, 0.68], [0.75, 0.82], [-1.5, 0.9], [-2.15, 0.92], [-2.25, 0.55]],
    cabin: [[0.8, 0.8], [0.05, 1.28], [-0.95, 1.3], [-1.6, 0.9]],
    width: 2.0, cabinW: 1.55, wheel: { x: 0.92, zf: 1.38, zr: -1.38, r: 0.42 }, spoiler: [-2.0, 1.15], intake: true,
  },
  wedge: {
    body: [[-2.25, 0.26], [2.35, 0.26], [2.45, 0.36], [1.6, 0.58], [0.35, 0.74], [-1.7, 0.84], [-2.3, 0.86], [-2.35, 0.5]],
    cabin: [[0.4, 0.72], [-0.3, 1.1], [-1.2, 1.12], [-1.75, 0.84]],
    width: 2.05, cabinW: 1.4, wheel: { x: 0.95, zf: 1.5, zr: -1.45, r: 0.43 }, spoiler: [-2.1, 1.12], fins: true,
  },
  buggy: {
    body: [[-1.7, 0.35], [1.75, 0.35], [1.85, 0.62], [1.4, 0.8], [0.4, 0.85], [-1.3, 0.9], [-1.75, 0.9], [-1.8, 0.6]],
    cabin: [[0.4, 0.84], [-0.1, 1.45], [-0.9, 1.48], [-1.3, 0.9]],
    width: 1.75, cabinW: 1.35, wheel: { x: 1.0, zf: 1.15, zr: -1.15, r: 0.5 }, roll: true, lift: 0.1,
  },
  truck: {
    body: [[-2.2, 0.35], [2.25, 0.35], [2.3, 0.75], [2.1, 1.0], [0.9, 1.05], [-2.2, 1.05], [-2.25, 0.7]],
    cabin: [[0.95, 1.02], [0.6, 1.75], [-0.7, 1.78], [-0.85, 1.02]],
    width: 2.25, cabinW: 2.0, wheel: { x: 1.05, zf: 1.45, zr: -1.4, r: 0.52 }, bull: true, bed: true, lift: 0.15,
  },
};

const shared = {};
function sharedMats() {
  if (shared.dark) return shared;
  shared.dark = new THREE.MeshLambertMaterial({ color: 0x1b1b22 });
  shared.chrome = new THREE.MeshPhongMaterial({ color: 0xbfc6d0, shininess: 100, specular: 0xffffff });
  shared.glass = new THREE.MeshPhongMaterial({ color: 0x1a2a44, shininess: 120, specular: 0xaaccff });
  shared.tire = new THREE.MeshLambertMaterial({ color: 0x141414 });
  shared.rim = new THREE.MeshPhongMaterial({ color: 0xd8dde6, shininess: 80, specular: 0xffffff });
  shared.light = new THREE.MeshBasicMaterial({ color: 0xfff6d8 });
  shared.wheelGeo = new THREE.CylinderGeometry(1, 1, 0.36, 12).rotateZ(Math.PI / 2);
  shared.rimGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.62, 0.62, 0.38, 8).rotateZ(Math.PI / 2),
    new THREE.BoxGeometry(0.4, 1.5, 0.18), new THREE.BoxGeometry(0.4, 0.18, 1.5),
  ]);
  shared.flameGeo = new THREE.ConeGeometry(0.22, 1.4, 6).rotateX(-Math.PI / 2).translate(0, 0, -0.7);
  // textura de resplandor para faros
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,255,255,0.6)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  shared.glowTex = new THREE.CanvasTexture(c);
  // cono de luz de los faros sobre el piso
  const c2 = document.createElement('canvas'); c2.width = 64; c2.height = 128;
  const g2 = c2.getContext('2d');
  const grd2 = g2.createRadialGradient(32, 128, 4, 32, 100, 110);
  grd2.addColorStop(0, 'rgba(255,240,200,0.55)'); grd2.addColorStop(1, 'rgba(255,240,200,0)');
  g2.fillStyle = grd2; g2.beginPath(); g2.moveTo(26, 128); g2.lineTo(0, 0); g2.lineTo(64, 0); g2.lineTo(38, 128); g2.fill();
  shared.beamTex = new THREE.CanvasTexture(c2);
  return shared;
}

// Extruye un perfil lateral a lo ancho, centrado en x
function extrudeProfile(points, width, bevel = 0.05) {
  const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: width - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 1 });
  g.rotateY(-Math.PI / 2);
  g.translate(width / 2 - bevel, 0, 0);
  g.computeVertexNormals();
  return g;
}

export function buildCarModel(shape, colorHex, opts = {}) {
  const m = sharedMats();
  const d = SHAPES[shape] || SHAPES.sport;
  const lift = d.lift || 0;
  const root = new THREE.Group();
  const body = new THREE.Group(); // gira con derrape/inclinación
  root.add(body);

  const paint = new THREE.MeshPhongMaterial({ color: colorHex, shininess: 70, specular: 0x777777 });
  const bodyGeos = [extrudeProfile(d.body, d.width).translate(0, lift, 0)];
  // franja decorativa (más oscura) a los lados
  if (d.spoiler) {
    const [z, y] = d.spoiler;
    bodyGeos.push(new THREE.BoxGeometry(d.width - 0.05, 0.07, 0.5).translate(0, y + lift, z));
    bodyGeos.push(new THREE.BoxGeometry(0.08, 0.3, 0.32).translate(d.width * 0.36, y - 0.17 + lift, z));
    bodyGeos.push(new THREE.BoxGeometry(0.08, 0.3, 0.32).translate(-d.width * 0.36, y - 0.17 + lift, z));
  }
  if (d.fins) {
    bodyGeos.push(new THREE.BoxGeometry(0.06, 0.32, 0.9).translate(d.width * 0.47, 0.95 + lift, -1.7));
    bodyGeos.push(new THREE.BoxGeometry(0.06, 0.32, 0.9).translate(-d.width * 0.47, 0.95 + lift, -1.7));
  }
  if (d.bed) bodyGeos.push(new THREE.BoxGeometry(d.width, 0.3, 0.12).translate(0, 1.2 + lift, -2.15));
  body.add(new THREE.Mesh(mergeGeometries(bodyGeos.map(g => g.index ? g.toNonIndexed() : g)), paint));

  // cabina de vidrio
  body.add(new THREE.Mesh(extrudeProfile(d.cabin, d.cabinW, 0.04).translate(0, lift, 0), m.glass));

  // piezas oscuras: zócalo, arcos, parrilla, retrovisores, barra antivuelco
  const halfL = Math.max(...d.body.map(p => Math.abs(p[0])));
  const darkGeos = [
    new THREE.BoxGeometry(d.width + 0.04, 0.2, halfL * 1.9).translate(0, 0.32 + lift, 0),
    new THREE.BoxGeometry(d.width * 0.62, 0.16, 0.06).translate(0, 0.45 + lift, halfL + 0.06), // parrilla
    new THREE.BoxGeometry(0.22, 0.12, 0.1).translate(d.cabinW / 2 + 0.12, 1.0 + lift, 0.55),   // retrovisores
    new THREE.BoxGeometry(0.22, 0.12, 0.1).translate(-d.cabinW / 2 - 0.12, 1.0 + lift, 0.55),
    new THREE.BoxGeometry(d.width * 0.8, 0.14, 0.08).translate(0, 0.38 + lift, -halfL - 0.03), // difusor
  ];
  if (d.intake) darkGeos.push(new THREE.BoxGeometry(0.7, 0.04, 0.6).translate(0, 0.79 + lift, 1.25));
  if (d.roll) {
    darkGeos.push(new THREE.BoxGeometry(0.12, 0.8, 0.12).translate(0.62, 1.55, -1.1));
    darkGeos.push(new THREE.BoxGeometry(0.12, 0.8, 0.12).translate(-0.62, 1.55, -1.1));
    darkGeos.push(new THREE.BoxGeometry(1.36, 0.12, 0.12).translate(0, 1.95, -1.1));
    darkGeos.push(new THREE.BoxGeometry(1.9, 0.18, 0.2).translate(0, 0.55, 1.85));
  }
  if (d.bull) {
    darkGeos.push(new THREE.BoxGeometry(2.0, 0.12, 0.12).translate(0, 0.95, 2.4));
    darkGeos.push(new THREE.BoxGeometry(2.0, 0.12, 0.12).translate(0, 0.55, 2.4));
    darkGeos.push(new THREE.BoxGeometry(0.12, 0.55, 0.12).translate(0.6, 0.75, 2.4));
    darkGeos.push(new THREE.BoxGeometry(0.12, 0.55, 0.12).translate(-0.6, 0.75, 2.4));
  }
  body.add(new THREE.Mesh(mergeGeometries(darkGeos), m.dark));
  // escapes cromados
  const pipes = mergeGeometries([0.42, -0.42].map(x => new THREE.CylinderGeometry(0.09, 0.09, 0.3, 8).rotateX(Math.PI / 2).translate(x, 0.4 + lift, -halfL - 0.08)));
  body.add(new THREE.Mesh(pipes, m.chrome));

  // faros y luces traseras
  const headY = 0.55 + lift;
  const lights = mergeGeometries([0.62, -0.62].map(x => new THREE.BoxGeometry(0.42, 0.13, 0.08).translate(x * d.width / 2, headY, halfL + 0.03)));
  body.add(new THREE.Mesh(lights, m.light));
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xaa1020 });
  const tails = mergeGeometries([0.62, -0.62].map(x => new THREE.BoxGeometry(0.5, 0.13, 0.06).translate(x * d.width / 2, headY + 0.12, -halfL - 0.02)));
  body.add(new THREE.Mesh(tails, tailMat));
  // resplandores (sprites)
  const glowMat = new THREE.SpriteMaterial({ map: m.glowTex, color: 0xfff2cc, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7 });
  const tailGlowMat = new THREE.SpriteMaterial({ map: m.glowTex, color: 0xff2030, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.35 });
  for (const x of [0.62, -0.62]) {
    const s = new THREE.Sprite(glowMat); s.scale.setScalar(opts.night ? 1.3 : 0.7); s.position.set(x * d.width / 2, headY, halfL + 0.15); body.add(s);
    const t = new THREE.Sprite(tailGlowMat); t.scale.setScalar(0.9); t.position.set(x * d.width / 2, headY + 0.12, -halfL - 0.12); body.add(t);
  }
  // cono de luz en el piso (solo de noche)
  if (opts.night) {
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(5, 14).rotateX(-Math.PI / 2).translate(0, 0.06, halfL + 7),
      new THREE.MeshBasicMaterial({ map: m.beamTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 }));
    beam.renderOrder = 2;
    root.add(beam);
    // luz de neón bajo el auto
    const under = new THREE.Mesh(new THREE.PlaneGeometry(d.width + 1.2, halfL * 2 + 1).rotateX(-Math.PI / 2).translate(0, 0.05, 0),
      new THREE.MeshBasicMaterial({ map: m.glowTex, color: colorHex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7 }));
    under.renderOrder = 2;
    root.add(under);
  }

  // ruedas
  const W = d.wheel;
  const wheels = [];
  for (const [x, z] of [[W.x, W.zf], [-W.x, W.zf], [W.x, W.zr], [-W.x, W.zr]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, W.r, z);
    const spin = new THREE.Group();
    const tire = new THREE.Mesh(m.wheelGeo, m.tire); tire.scale.set(1, W.r, W.r);
    const rim = new THREE.Mesh(m.rimGeo, m.rim); rim.scale.set(1, W.r, W.r); rim.position.x = x > 0 ? 0.01 : -0.01;
    spin.add(tire, rim);
    pivot.add(spin);
    root.add(pivot);
    wheels.push({ pivot, spin, front: z > 0 });
  }

  // llamas del escape
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xff8a1f, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const flameCore = new THREE.MeshBasicMaterial({ color: 0xfff2a0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const flames = [];
  for (const x of [0.42, -0.42]) {
    const f = new THREE.Mesh(m.flameGeo, flameMat);
    f.position.set(x, 0.4 + lift, -halfL - 0.2);
    const core = new THREE.Mesh(m.flameGeo, flameCore);
    core.scale.set(0.5, 0.5, 0.6);
    f.add(core);
    f.visible = false;
    body.add(f);
    flames.push(f);
  }

  // escudo (ítem)
  const shield = new THREE.Mesh(new THREE.SphereGeometry(2.7, 14, 10), new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending }));
  shield.position.y = 0.8; shield.scale.z = 1.2;
  shield.visible = false;
  root.add(shield);

  return {
    root, body, wheels, flames, flameMat, flameCore, shield, tailMat, tailGlowMat, paint,
    rearWheelLocal: [new THREE.Vector3(W.x, 0.05, W.zr), new THREE.Vector3(-W.x, 0.05, W.zr)],
    halfLength: halfL,
    setBraking(on) {
      tailMat.color.setHex(on ? 0xff2030 : 0xaa1020);
      tailGlowMat.opacity = on ? 0.9 : 0.35;
    },
  };
}
