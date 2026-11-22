import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Modelos low-poly hechos con primitivas. El auto mira hacia +Z.
const shared = {};
function sharedMats() {
  if (shared.dark) return shared;
  shared.dark = new THREE.MeshLambertMaterial({ color: 0x1b1b22 });
  shared.glass = new THREE.MeshPhongMaterial({ color: 0x223344, shininess: 90, specular: 0x88aacc });
  shared.tire = new THREE.MeshLambertMaterial({ color: 0x151515 });
  shared.rim = new THREE.MeshLambertMaterial({ color: 0xcfd3da });
  shared.light = new THREE.MeshBasicMaterial({ color: 0xfff6d8 });
  shared.tail = new THREE.MeshBasicMaterial({ color: 0xff2030 });
  const wheel = new THREE.CylinderGeometry(0.42, 0.42, 0.36, 10).rotateZ(Math.PI / 2);
  const rim = new THREE.CylinderGeometry(0.24, 0.24, 0.38, 6).rotateZ(Math.PI / 2);
  shared.wheelGeo = wheel; shared.rimGeo = rim;
  shared.flameGeo = new THREE.ConeGeometry(0.22, 1.4, 6).rotateX(-Math.PI / 2).translate(0, 0, -0.7);
  return shared;
}

const SHAPES = {
  sport: { body: [[2.0, 0.55, 4.2, 0, 0.55, 0], [1.9, 0.25, 1.2, 0, 0.75, 1.4]], cabin: [1.55, 0.5, 1.8, 0, 1.08, -0.3], wheel: [0.95, 1.35, 1.0], spoiler: true },
  wedge: { body: [[2.0, 0.45, 4.5, 0, 0.5, 0], [1.8, 0.2, 1.6, 0, 0.67, 1.3]], cabin: [1.4, 0.42, 1.6, 0, 0.95, -0.5], wheel: [0.95, 1.5, 0.95], spoiler: true, nose: true },
  buggy: { body: [[1.8, 0.5, 3.4, 0, 0.6, 0]], cabin: [1.4, 0.65, 1.4, 0, 1.15, -0.2], wheel: [1.0, 1.1, 1.15], roll: true },
  truck: { body: [[2.2, 0.8, 4.4, 0, 0.75, 0]], cabin: [1.9, 0.7, 1.8, 0, 1.5, 0.4], wheel: [1.05, 1.4, 1.2], bull: true },
};

export function buildCarModel(shape, colorHex) {
  const m = sharedMats();
  const def = SHAPES[shape] || SHAPES.sport;
  const root = new THREE.Group();
  const body = new THREE.Group(); // gira con derrape/inclinación
  root.add(body);
  const paint = new THREE.MeshPhongMaterial({ color: colorHex, shininess: 60, specular: 0x666666 });
  const bodyGeos = def.body.map(b => new THREE.BoxGeometry(b[0], b[1], b[2]).translate(b[3], b[4], b[5]));
  if (def.spoiler) {
    bodyGeos.push(new THREE.BoxGeometry(1.9, 0.08, 0.5).translate(0, 1.15, -1.95));
    bodyGeos.push(new THREE.BoxGeometry(0.1, 0.35, 0.3).translate(0.7, 0.95, -1.95));
    bodyGeos.push(new THREE.BoxGeometry(0.1, 0.35, 0.3).translate(-0.7, 0.95, -1.95));
  }
  if (def.nose) bodyGeos.push(new THREE.BoxGeometry(1.6, 0.25, 0.6).translate(0, 0.4, 2.45));
  const bodyMesh = new THREE.Mesh(mergeGeometries(bodyGeos), paint);
  body.add(bodyMesh);
  const c = def.cabin;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(c[0], c[1], c[2]).translate(c[3], c[4], c[5]), m.glass);
  body.add(cabin);
  const darkGeos = [new THREE.BoxGeometry(def.body[0][0] + 0.02, 0.18, def.body[0][2] * 0.98).translate(0, 0.32, 0)];
  if (def.roll) {
    darkGeos.push(new THREE.BoxGeometry(0.12, 0.9, 0.12).translate(0.65, 1.3, -0.9));
    darkGeos.push(new THREE.BoxGeometry(0.12, 0.9, 0.12).translate(-0.65, 1.3, -0.9));
    darkGeos.push(new THREE.BoxGeometry(1.42, 0.12, 0.12).translate(0, 1.75, -0.9));
  }
  if (def.bull) darkGeos.push(new THREE.BoxGeometry(2.0, 0.5, 0.25).translate(0, 0.7, 2.3));
  body.add(new THREE.Mesh(mergeGeometries(darkGeos), m.dark));
  const halfL = def.body[0][2] / 2;
  const lights = mergeGeometries([
    new THREE.BoxGeometry(0.45, 0.15, 0.05).translate(0.65, def.body[0][4] + 0.05, halfL + 0.01),
    new THREE.BoxGeometry(0.45, 0.15, 0.05).translate(-0.65, def.body[0][4] + 0.05, halfL + 0.01),
  ]);
  body.add(new THREE.Mesh(lights, m.light));
  const tails = mergeGeometries([
    new THREE.BoxGeometry(0.5, 0.14, 0.05).translate(0.65, def.body[0][4] + 0.08, -halfL - 0.01),
    new THREE.BoxGeometry(0.5, 0.14, 0.05).translate(-0.65, def.body[0][4] + 0.08, -halfL - 0.01),
  ]);
  const tailMat = m.tail.clone();
  body.add(new THREE.Mesh(tails, tailMat));

  // ruedas
  const [wx, wzf, wzr] = [def.wheel[0], def.wheel[1], def.wheel[1]];
  const ws = def.wheel[2];
  const wheels = [];
  const wheelPos = [[wx, wzf], [-wx, wzf], [wx, -wzr], [-wx, -wzr]];
  for (const [x, z] of wheelPos) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.42 * ws, z);
    const spin = new THREE.Group();
    spin.add(new THREE.Mesh(m.wheelGeo, m.tire));
    spin.add(new THREE.Mesh(m.rimGeo, m.rim));
    spin.scale.setScalar(ws);
    pivot.add(spin);
    root.add(pivot);
    wheels.push({ pivot, spin, front: z > 0 });
  }

  // llamas del escape
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xff8a1f, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const flameCore = new THREE.MeshBasicMaterial({ color: 0xfff2a0, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const flames = [];
  for (const x of [0.45, -0.45]) {
    const f = new THREE.Mesh(m.flameGeo, flameMat);
    f.position.set(x, def.body[0][4] - 0.05, -halfL - 0.05);
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
    root, body, wheels, flames, flameMat, flameCore, shield, tailMat, paint,
    rearWheelLocal: [new THREE.Vector3(wx, 0.05, -wzr), new THREE.Vector3(-wx, 0.05, -wzr)],
    halfLength: halfL,
  };
}
