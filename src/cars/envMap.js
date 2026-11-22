import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// Mapa de entorno generado por código (sin archivos): da reflejos a la pintura y los vidrios
const cache = new WeakMap();
export function applyEnvironment(renderer, scene, intensity = 1) {
  let tex = cache.get(renderer);
  if (!tex) {
    const pm = new THREE.PMREMGenerator(renderer);
    tex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    cache.set(renderer, tex);
  }
  scene.environment = tex;
  scene.environmentIntensity = intensity;
}
