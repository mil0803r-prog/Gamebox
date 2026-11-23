import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { buildCarModel } from '../cars/CarModel.js';

// =====================================================================
//  Showroom: fondo de los menús. El auto del jugador en una plaza de una
//  ciudad al atardecer: cielo naranja/morado, rascacielos con ventanas
//  encendidas, palmeras, piso mojado que refleja todo, banderas de neón,
//  faroles y un helicóptero cruzando el cielo.
//  framing: 'hero' (centrado, menú principal), 'right' (auto a la derecha),
//  'center' (más lejos, para el concesionario).
// =====================================================================
const rnd = (a, b) => a + Math.random() * (b - a);

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// cielo del atardecer con nubes alargadas y el sol pegado al horizonte
function skyTexture() {
  return canvasTex(1024, 512, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#070615'); grd.addColorStop(0.22, '#1b1036'); grd.addColorStop(0.36, '#4a1d52');
    grd.addColorStop(0.44, '#a33a5c'); grd.addColorStop(0.49, '#f0703f'); grd.addColorStop(0.505, '#ffb35c');
    grd.addColorStop(0.53, '#3a1a2e'); grd.addColorStop(1, '#05040a');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    // sol (centrado en u=0.5 → queda detrás del auto)
    const sx = w * 0.5, sy = h * 0.5;
    const sg = g.createRadialGradient(sx, sy, 0, sx, sy, 160);
    sg.addColorStop(0, 'rgba(255,240,200,1)'); sg.addColorStop(0.08, 'rgba(255,190,110,0.95)'); sg.addColorStop(0.35, 'rgba(255,110,60,0.35)'); sg.addColorStop(1, 'rgba(255,80,60,0)');
    g.fillStyle = sg; g.fillRect(sx - 170, sy - 170, 340, 340);
    // nubes
    for (let i = 0; i < 70; i++) {
      const y = rnd(h * 0.18, h * 0.47), x = rnd(0, w), len = rnd(60, 260), th = rnd(2, 9);
      const warm = y / h;
      g.fillStyle = `rgba(${warm > 0.38 ? '255,140,90' : '170,80,140'},${rnd(0.08, 0.3)})`;
      g.beginPath(); g.ellipse(x, y, len, th, 0, 0, Math.PI * 2); g.fill();
    }
    // estrellas arriba
    for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,255,255,${rnd(0.2, 0.8)})`; g.fillRect(rnd(0, w), rnd(0, h * 0.25), 1, 1); }
  });
}

// silueta de edificios con ventanas encendidas (y palmeras en la capa cercana)
function skylineTexture({ base, haze, minH, maxH, windows, palms }) {
  return canvasTex(2048, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    let x = 0;
    while (x < w) {
      const bw = rnd(40, 120), bh = Math.min(h - 60, rnd(minH, maxH) * (Math.random() < 0.12 ? 1.5 : 1));
      const top = h - bh;
      const bg = g.createLinearGradient(0, top, 0, h);
      bg.addColorStop(0, haze); bg.addColorStop(0.35, base); bg.addColorStop(1, base);
      g.fillStyle = bg;
      g.fillRect(x, top, bw, bh);
      if (Math.random() < 0.3) g.fillRect(x + bw * 0.25, top - 18, bw * 0.5, 18); // terraza
      if (Math.random() < 0.25) { g.fillRect(x + bw / 2 - 1, top - 50, 2, 50); g.fillStyle = '#ff3040'; g.fillRect(x + bw / 2 - 2, top - 52, 4, 4); } // antena
      if (windows) {
        for (let wy = top + 8; wy < h - 6; wy += 9) for (let wx = x + 5; wx < x + bw - 6; wx += 8) {
          if (Math.random() < windows) {
            g.fillStyle = Math.random() < 0.7 ? `rgba(255,${rnd(170, 220) | 0},${rnd(90, 140) | 0},${rnd(0.5, 0.95)})` : `rgba(120,220,255,${rnd(0.4, 0.8)})`;
            g.fillRect(wx, wy, 4, 5);
          }
        }
      }
      x += bw + rnd(-10, 14);
    }
    if (palms) {
      g.strokeStyle = '#06040a';
      for (let i = 0; i < 9; i++) {
        const px = rnd(0, w), ph = rnd(170, 260), bend = rnd(-30, 30);
        g.lineWidth = 7; g.beginPath(); g.moveTo(px, h); g.quadraticCurveTo(px + bend * 0.3, h - ph * 0.5, px + bend, h - ph); g.stroke();
        for (let k = 0; k < 9; k++) {
          const a = (k / 9) * Math.PI * 2, l = rnd(45, 75);
          g.lineWidth = 5; g.beginPath(); g.moveTo(px + bend, h - ph);
          g.quadraticCurveTo(px + bend + Math.cos(a) * l * 0.6, h - ph - 22 + Math.sin(a) * 6, px + bend + Math.cos(a) * l, h - ph + Math.abs(Math.sin(a)) * 30 + 12);
          g.stroke();
        }
      }
    }
  });
}

// asfalto mojado: alfa con charcos (donde el alfa es bajo se ve el reflejo)
function puddleTexture() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#b8b8b8'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const x = rnd(0, w), y = rnd(0, h), r = rnd(10, 70);
      const pg = g.createRadialGradient(x, y, 0, x, y, r);
      pg.addColorStop(0, 'rgba(20,20,20,0.9)'); pg.addColorStop(1, 'rgba(20,20,20,0)');
      g.fillStyle = pg; g.beginPath(); g.ellipse(x, y, r * 1.6, r, rnd(0, 3), 0, Math.PI * 2); g.fill();
    }
    for (let i = 0; i < 9000; i++) { const v = rnd(120, 230) | 0; g.fillStyle = `rgba(${v},${v},${v},0.25)`; g.fillRect(rnd(0, w), rnd(0, h), 1.5, 1.5); }
  }, false);
}

function bannerTexture(c1, c2) {
  return canvasTex(128, 512, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, c1); grd.addColorStop(1, c2);
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, w, 14); g.fillRect(0, h - 14, w, 14);
    g.save(); g.translate(w / 2, h / 2 + 30); g.rotate(-Math.PI / 2);
    g.font = 'italic 800 64px "Barlow Condensed", "Arial Narrow", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#fff'; g.fillText('GAMEBOX', 0, 0);
    g.restore();
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? '#fff' : '#000'; g.fillRect(36 + j * 28, 30 + i * 14, 28, 14); }
  });
}

export class Showroom {
  constructor(renderer, quality = 2) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x1c0f24, 30, 95);
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 400);
    this.t = 0;
    this.framing = 'hero';
    this.camPos = new THREE.Vector3(5, 1.4, 6);
    this.camLook = new THREE.Vector3(0, 0.6, 0);

    // ---------------- cielo y ciudad
    const skyMat = new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false, depthWrite: false });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(200, 48, 24), skyMat);
    sky.rotation.y = Math.PI / 2; // el sol hacia -z (detrás del auto)
    this.scene.add(sky);
    const ring = (radius, height, tex, repeat, y = 0) => {
      tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(repeat, 1);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 64, 1, true),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false }));
      m.position.y = height / 2 + y;
      this.scene.add(m);
      return m;
    };
    ring(150, 34, canvasTex(1024, 256, (g, w, h) => {
      g.fillStyle = '#2b1634'; g.beginPath(); g.moveTo(0, h);
      for (let x = 0; x <= w; x += 8) g.lineTo(x, h * 0.45 + Math.sin(x * 0.012) * 40 + Math.sin(x * 0.041) * 16 + Math.sin(x * 0.007 + 1) * 30);
      g.lineTo(w, h); g.fill();
    }), 2, -6);
    ring(120, 26, skylineTexture({ base: '#1f1230', haze: '#4a2648', minH: 140, maxH: 440, windows: 0.2 }), 8, -1);
    ring(90, 24, skylineTexture({ base: '#0d0815', haze: '#2a1530', minH: 80, maxH: 380, windows: 0.3, palms: true }), 6, -1);

    // ---------------- piso mojado: espejo real + asfalto con charcos encima
    if (quality >= 1) {
      const res = quality >= 2 ? 1024 : 512;
      const mirror = new Reflector(new THREE.CircleGeometry(70, 48), {
        textureWidth: Math.min(res, window.innerWidth), textureHeight: Math.min(res, window.innerHeight), color: 0x9a9aa6,
      });
      mirror.rotation.x = -Math.PI / 2;
      this.scene.add(mirror);
    }
    const pud = puddleTexture(); pud.wrapS = pud.wrapT = THREE.RepeatWrapping; pud.repeat.set(10, 10);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(70, 48).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x0c0b12, roughness: 0.55, metalness: 0.2, transparent: quality >= 1, alphaMap: quality >= 1 ? pud : null }));
    floor.position.y = 0.006;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // reflejo de luz cálida en el piso, debajo del auto
    const glow = canvasTex(256, 256, (g) => {
      const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      gr.addColorStop(0, 'rgba(255,150,90,0.45)'); gr.addColorStop(0.5, 'rgba(255,60,90,0.15)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    });
    this.pad = new THREE.Mesh(new THREE.PlaneGeometry(12, 12).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.pad.position.y = 0.012;
    this.scene.add(this.pad);

    // ---------------- banderas de neón y faroles
    const bannerGeo = new THREE.PlaneGeometry(1.1, 4.4);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x15151c, roughness: 0.5, metalness: 0.8 });
    const banners = [[-11, -5, 0.8, '#ff2340', '#7a0016'], [-14, -9, 0.6, '#ff2bd6', '#5a0a6e'], [10, -12, -0.4, '#ff2340', '#7a0016'], [14, -6, -0.8, '#1e8bff', '#0a1f5e']];
    for (const [x, z, ry, c1, c2] of banners) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 6.4, 8), poleMat);
      pole.position.set(x, 3.2, z); this.scene.add(pole);
      const b = new THREE.Mesh(bannerGeo, new THREE.MeshBasicMaterial({ map: bannerTexture(c1, c2), side: THREE.DoubleSide, fog: false }));
      b.position.set(x + 0.62, 3.6, z); b.rotation.y = ry; this.scene.add(b);
    }
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
    for (const [x, z] of [[-13, -4], [12, -5], [-9, -18], [6, -16]]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 7, 8), poleMat);
      pole.position.set(x, 3.5, z); this.scene.add(pole);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.3), lampMat);
      head.position.set(x + 0.35, 7, z); this.scene.add(head);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffc080, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.position.copy(head.position); halo.scale.set(3, 3, 1); this.scene.add(halo);
    }

    // ---------------- luces
    this.scene.add(new THREE.HemisphereLight(0x8a6cff, 0x1a0c10, 0.55));
    const sun = new THREE.DirectionalLight(0xff9a5a, 3.2); // contraluz del atardecer
    sun.position.set(-2, 4, -12);
    this.scene.add(sun);
    const key = new THREE.SpotLight(0xdfe8ff, 230, 40, 0.6, 0.7, 1.4); // luz principal suave desde el frente
    key.position.set(5, 8, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.radius = 6;
    key.shadow.bias = -0.0004;
    this.scene.add(key);
    const rimL = new THREE.PointLight(0xff2bd6, 40, 18, 1.5); rimL.position.set(-5, 2, -2.5); this.scene.add(rimL);
    const rimR = new THREE.PointLight(0x29c5ff, 36, 18, 1.5); rimR.position.set(5, 2, -3); this.scene.add(rimR);
    this.rims = [rimL, rimR];

    // ---------------- reflejos en la pintura: mapa de entorno con el mismo cielo y luces de neón
    const envScene = new THREE.Scene();
    const envSky = new THREE.Mesh(sky.geometry, skyMat.clone()); envSky.rotation.y = sky.rotation.y; envScene.add(envSky);
    const strip = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    for (let i = -1; i <= 1; i++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.2), strip); s.position.set(i * 9, 22, 0); s.rotation.x = Math.PI / 2; envScene.add(s); }
    for (const [x, c] of [[-26, 0xff2bd6], [26, 0x29c5ff]]) {
      const neon = new THREE.Mesh(new THREE.PlaneGeometry(6, 14), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
      neon.position.set(x, 6, 0); neon.rotation.y = Math.PI / 2; envScene.add(neon);
    }
    const pm = new THREE.PMREMGenerator(renderer);
    this.scene.environment = pm.fromScene(envScene, 0.03).texture;
    pm.dispose();

    // ---------------- helicóptero (silueta con luces que parpadean)
    this.heli = new THREE.Group();
    const dark = new THREE.MeshBasicMaterial({ color: 0x07060c, fog: false });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1.4, 4, 8).rotateZ(Math.PI / 2), dark);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.15, 0.15), dark); tail.position.x = -1.8;
    this.rotor = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.04, 0.18), dark); this.rotor.position.y = 0.62;
    this.heliRed = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xff2020, map: glow, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.heliRed.scale.set(1.6, 1.6, 1); this.heliRed.position.set(-2.8, 0.1, 0);
    const spot = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffffff, map: glow, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    spot.scale.set(2.2, 2.2, 1); spot.position.set(0.9, -0.4, 0);
    this.heli.add(body, tail, this.rotor, this.heliRed, spot);
    this.scene.add(this.heli);

    // ---------------- brasas flotando
    const N = 160, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pos[i * 3] = rnd(-14, 14); pos[i * 3 + 1] = rnd(0, 7); pos[i * 3 + 2] = rnd(-12, 8); }
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xffb27a, size: 0.04, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.scene.add(this.dust);

    this.car = null;
    this.carKey = '';
    this.first = true;
  }

  setCar(def, color) {
    const key = def.id + color;
    if (key === this.carKey) return;
    this.carKey = key;
    if (this.car) this.scene.remove(this.car.root);
    this.car = buildCarModel(def, color);
    this.car.root.traverse(o => { if (o.isMesh && !o.material.transparent) o.castShadow = true; });
    this.scene.add(this.car.root);
    this.swapT = 0;
  }

  resize(w, h) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }

  // posición de cámara deseada según el encuadre
  target(out, look) {
    const t = this.t, wide = this.camera.aspect > 1.2;
    let a, r, y;
    if (this.framing === 'hero') {
      // de frente en tres cuartos, bajita, con un vaivén suave
      a = 0.62 + Math.sin(t * 0.18) * 0.16; r = wide ? 10.8 : 13; y = 1.25 + Math.sin(t * 0.25) * 0.08;
      look.set(0, 0.62, 0);
    } else if (this.framing === 'center') {
      a = 0.55 + Math.sin(t * 0.12) * 0.5; r = 13.5; y = 1.9;
      look.set(0, 0.6, 0);
    } else {
      a = 0.55 + Math.sin(t * 0.12) * 0.5; r = 8.6 + Math.sin(t * 0.3) * 0.3; y = 1.5;
      const lx = wide ? -1.5 : 0;
      look.set(Math.cos(a) * lx, 0.65, -Math.sin(a) * lx);
    }
    out.set(Math.sin(a) * r, y, Math.cos(a) * r);
  }

  update(dt) {
    this.t += dt;
    const tp = new THREE.Vector3(), tl = new THREE.Vector3();
    this.target(tp, tl);
    // transición suave al cambiar de encuadre entre pantallas
    const k = this.first ? 1 : 1 - Math.exp(-dt * 3);
    this.first = false;
    this.camPos.lerp(tp, k);
    this.camLook.lerp(tl, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);

    if (this.car) {
      this.swapT = Math.min(1, (this.swapT || 0) + dt * 2.2);
      const e = 1 - Math.pow(1 - this.swapT, 3);
      this.car.root.position.y = (1 - e) * -0.6;
      this.car.root.rotation.y = (1 - e) * 1.4 - 0.12;
      this.car.wheels.forEach(w => w.front && (w.pivot.rotation.y = 0.32)); // ruedas giradas como en las fotos
    }
    this.pad.material.opacity = 0.85 + Math.sin(this.t * 1.6) * 0.12;
    this.rims[0].intensity = 36 + Math.sin(this.t * 1.3) * 8;
    this.rims[1].intensity = 32 + Math.cos(this.t * 1.1) * 8;

    // helicóptero: cruza de lado a lado detrás de la ciudad
    const hp = ((this.t * 0.035) % 1.4) - 0.2;
    const ang = Math.PI * (0.75 - hp * 0.5);
    this.heli.position.set(Math.cos(ang) * 60, 16 + Math.sin(this.t * 0.5) * 0.6, -Math.sin(ang) * 60);
    this.heli.rotation.y = ang;
    this.rotor.rotation.y += dt * 30;
    this.heliRed.material.opacity = (this.t * 1.5 % 1) < 0.15 ? 1 : 0.1;

    const p = this.dust.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { let y = p.getY(i) + dt * 0.1; if (y > 7) y = 0; p.setY(i, y); p.setX(i, p.getX(i) + Math.sin(this.t + i) * dt * 0.05); }
    p.needsUpdate = true;
  }

  render(renderer, W, H) {
    renderer.setViewport(0, 0, W, H);
    renderer.setScissor(0, 0, W, H);
    renderer.render(this.scene, this.camera);
  }
}
