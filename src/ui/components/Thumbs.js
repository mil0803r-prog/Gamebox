import * as THREE from 'three';
import { buildCarModel } from '../../cars/CarModel.js';
import { applyEnvironment } from '../../cars/envMap.js';

// Miniaturas de autos para el concesionario: se renderizan una vez (de a una por frame) y se guardan
const cache = new Map();
let renderer = null, scene = null, camera = null;
const queue = [];
let running = false;

function setup() {
  const c = document.createElement('canvas');
  c.width = 360; c.height = 200;
  renderer = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  applyEnvironment(renderer, scene, 1.1);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x443366, 1.3));
  const d = new THREE.DirectionalLight(0xffffff, 1.6); d.position.set(4, 6, 3); scene.add(d);
  camera = new THREE.PerspectiveCamera(26, 360 / 200, 0.1, 100);
  camera.position.set(7.2, 2.6, 7.6);
  camera.lookAt(0, 0.55, 0);
}

function pump() {
  const job = queue.shift();
  if (!job) { running = false; return; }
  if (!cache.has(job.def.id)) {
    if (!renderer) setup();
    const m = buildCarModel(job.def, job.def.color);
    m.root.rotation.y = 0.15;
    scene.add(m.root);
    renderer.render(scene, camera);
    cache.set(job.def.id, renderer.domElement.toDataURL('image/png'));
    scene.remove(m.root);
  }
  job.cb(cache.get(job.def.id));
  requestAnimationFrame(pump);
}

export function carThumb(def, cb) {
  if (cache.has(def.id)) { cb(cache.get(def.id)); return; }
  queue.push({ def, cb });
  if (!running) { running = true; requestAnimationFrame(pump); }
}
