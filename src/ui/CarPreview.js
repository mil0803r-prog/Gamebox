import * as THREE from 'three';
import { buildCarModel } from '../cars/CarModel.js';

// Vista previa 3D giratoria de un auto (pequeño renderer propio, solo en menús)
export class CarPreview {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x443366, 1.6));
    const d = new THREE.DirectionalLight(0xffffff, 1.5); d.position.set(3, 5, 4); this.scene.add(d);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(3.4, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }));
    this.scene.add(floor);
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    this.camera.position.set(6.5, 3.6, 7.5);
    this.camera.lookAt(0, 0.6, 0);
    this.angle = 0.6;
    this.model = null;
  }
  set(shape, color) {
    if (this.model) this.scene.remove(this.model.root);
    this.model = buildCarModel(shape, color);
    this.scene.add(this.model.root);
  }
  render(dt) {
    const c = this.canvas;
    const w = c.clientWidth, h = c.clientHeight;
    if (!w || !h) return;
    if (c.width !== Math.round(w * this.renderer.getPixelRatio())) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    }
    this.angle += dt * 0.8;
    if (this.model) this.model.root.rotation.y = this.angle;
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
