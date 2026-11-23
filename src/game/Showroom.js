import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { buildCarModel } from '../cars/CarModel.js';
import { applyEnvironment } from '../cars/envMap.js';

// =====================================================================
//  Showroom: fondo de los menús estilo "wallpaper". El auto del jugador
//  en un estudio oscuro con luces, piso espejado, el nombre del auto
//  gigante en la pared y polvo flotando en el aire. La cámara orbita lento.
// =====================================================================
export class Showroom {
  constructor(renderer, quality = 2) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    applyEnvironment(renderer, this.scene, 0.9);
    this.scene.fog = new THREE.Fog(0x05070d, 14, 34);
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    this.t = 0;
    this.angle = 0.75;

    // fondo: degradado radial oscuro
    const bg = document.createElement('canvas'); bg.width = 4; bg.height = 256;
    const g = bg.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#0b1020'); grd.addColorStop(0.55, '#070a14'); grd.addColorStop(1, '#030409');
    g.fillStyle = grd; g.fillRect(0, 0, 4, 256);
    const bgTex = new THREE.CanvasTexture(bg); bgTex.colorSpace = THREE.SRGBColorSpace;
    this.scene.background = bgTex;

    // piso espejado (reflejo real en calidad media/alta) + capa oscura encima para un reflejo suave
    if (quality >= 1) {
      const mirror = new Reflector(new THREE.CircleGeometry(40, 64), {
        textureWidth: Math.min(1024, window.innerWidth), textureHeight: Math.min(1024, window.innerHeight), color: 0x8a8f9a,
      });
      mirror.rotation.x = -Math.PI / 2;
      this.scene.add(mirror);
      this.mirror = mirror;
    }
    const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 64).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x0a0d16, roughness: 0.35, metalness: 0.6, transparent: true, opacity: quality >= 1 ? 0.82 : 1 }));
    floor.position.y = 0.005;
    floor.receiveShadow = true;
    this.scene.add(floor);
    // círculo de luz bajo el auto
    const glowC = document.createElement('canvas'); glowC.width = glowC.height = 256;
    const gg = glowC.getContext('2d');
    const gr = gg.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(120,200,255,0.55)'); gr.addColorStop(0.5, 'rgba(60,120,255,0.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    gg.fillStyle = gr; gg.fillRect(0, 0, 256, 256);
    this.pad = new THREE.Mesh(new THREE.PlaneGeometry(11, 11).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(glowC), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.pad.position.y = 0.01;
    this.scene.add(this.pad);

    // luces de estudio: principal con sombra suave + contraluces de color
    this.scene.add(new THREE.HemisphereLight(0x9fb4ff, 0x05060a, 0.35));
    const key = new THREE.SpotLight(0xffffff, 260, 30, 0.55, 0.6, 1.6);
    key.position.set(2.5, 9, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.radius = 6;
    key.shadow.bias = -0.0004;
    this.scene.add(key);
    const rimL = new THREE.PointLight(0x29c5ff, 40, 16, 1.5); rimL.position.set(-5, 2.2, -3); this.scene.add(rimL);
    const rimR = new THREE.PointLight(0xff2e63, 34, 16, 1.5); rimR.position.set(5, 2.2, -3.5); this.scene.add(rimR);
    this.rims = [rimL, rimR];

    // paneles de luz en el techo (se reflejan en la pintura y el piso)
    const stripMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let i = -1; i <= 1; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 7), stripMat);
      s.position.set(i * 1.8, 6.5, 0);
      this.scene.add(s);
    }
    // arco de neón detrás del auto
    const arc = new THREE.Mesh(new THREE.TorusGeometry(6.5, 0.05, 8, 80, Math.PI),
      new THREE.MeshBasicMaterial({ color: 0x29c5ff, transparent: true, opacity: 0.8 }));
    arc.position.set(0, 0, -7.5);
    this.scene.add(arc);
    this.arc = arc;

    // pared con el nombre del auto gigante
    this.nameCanvas = document.createElement('canvas');
    this.nameCanvas.width = 2048; this.nameCanvas.height = 512;
    this.nameTex = new THREE.CanvasTexture(this.nameCanvas);
    this.nameTex.colorSpace = THREE.SRGBColorSpace;
    this.nameMesh = new THREE.Mesh(new THREE.PlaneGeometry(20, 5),
      new THREE.MeshBasicMaterial({ map: this.nameTex, transparent: true, depthWrite: false, fog: false }));
    this.nameMesh.position.set(0, 3.2, -9);
    this.scene.add(this.nameMesh);

    // polvo flotando en la luz
    const N = 220, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 16; pos[i * 3 + 1] = Math.random() * 6; pos[i * 3 + 2] = (Math.random() - 0.5) * 12; }
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xbfd8ff, size: 0.035, transparent: true, opacity: 0.55, depthWrite: false }));
    this.scene.add(this.dust);

    this.car = null;
    this.carKey = '';
  }

  drawName(def) {
    const c = this.nameCanvas, g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'italic 800 300px "Barlow Condensed", "Arial Narrow", sans-serif';
    const grd = g.createLinearGradient(0, 0, c.width, 0);
    grd.addColorStop(0, 'rgba(255,255,255,0.02)'); grd.addColorStop(0.5, 'rgba(255,255,255,0.13)'); grd.addColorStop(1, 'rgba(255,255,255,0.02)');
    g.fillStyle = grd;
    g.fillText(def.name.toUpperCase(), c.width / 2, c.height / 2 + 20);
    g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.12)';
    g.strokeText(def.name.toUpperCase(), c.width / 2, c.height / 2 + 20);
    g.font = '700 54px "Barlow Condensed", sans-serif';
    g.fillStyle = 'rgba(41,197,255,0.5)';
    g.fillText(def.brand.toUpperCase() + '  ·  ' + def.top + ' KM/H  ·  ' + def.hp + ' CV', c.width / 2, c.height - 40);
    this.nameTex.needsUpdate = true;
  }

  setCar(def, color) {
    const key = def.id + color;
    if (key === this.carKey) return;
    this.carKey = key;
    if (this.car) this.scene.remove(this.car.root);
    this.car = buildCarModel(def, color);
    this.car.root.traverse(o => { if (o.isMesh && !o.material.transparent) o.castShadow = true; });
    this.scene.add(this.car.root);
    this.drawName(def);
    this.swapT = 0;
  }

  resize(w, h) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }

  update(dt) {
    this.t += dt;
    this.angle += dt * 0.12;
    // la cámara orbita y "respira" un poco; el auto queda a la derecha (el menú va a la izquierda)
    const r = (this.framing === 'center' ? 15 : 8.4) + Math.sin(this.t * 0.3) * 0.4;
    const a = 0.55 + Math.sin(this.angle) * 0.55;
    const cam = this.camera;
    cam.position.set(Math.sin(a) * r, 1.55 + Math.sin(this.t * 0.25) * 0.15, Math.cos(a) * r);
    const lookX = cam.aspect > 1.2 && this.framing !== 'center' ? -1.5 : 0;
    const side = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)).multiplyScalar(lookX);
    cam.lookAt(side.x, 0.65, side.z);
    // entrada del auto al cambiarlo: sube desde abajo con un giro
    if (this.car) {
      this.swapT = Math.min(1, (this.swapT || 0) + dt * 2.2);
      const e = 1 - Math.pow(1 - this.swapT, 3);
      this.car.root.position.y = (1 - e) * -0.6;
      this.car.root.rotation.y = (1 - e) * 1.4 + 0.15;
      this.car.wheels.forEach(w => w.front && (w.pivot.rotation.y = -0.35)); // ruedas giradas como en las fotos
    }
    this.pad.material.opacity = 0.8 + Math.sin(this.t * 2) * 0.15;
    this.rims[0].intensity = 36 + Math.sin(this.t * 1.3) * 8;
    this.rims[1].intensity = 30 + Math.cos(this.t * 1.1) * 8;
    this.arc.rotation.z = Math.sin(this.t * 0.4) * 0.05;
    const p = this.dust.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { let y = p.getY(i) + dt * 0.08; if (y > 6) y = 0; p.setY(i, y); }
    p.needsUpdate = true;
  }

  render(renderer, W, H) {
    renderer.setViewport(0, 0, W, H);
    renderer.setScissor(0, 0, W, H);
    renderer.render(this.scene, this.camera);
  }
}
