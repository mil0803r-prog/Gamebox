import * as THREE from 'three';
import { roadTexture, checkerTexture, boostPadTexture, groundTexture } from './textures.js';
import { buildEnvironment } from './Environment.js';
import { buildTrackside } from './Trackside.js';

export const THEMES = {
  city: {
    sky: ['#05010f', '#1a0838', '#3a1050'], fog: 0x1a0a30, fogNear: 60, fogFar: 520,
    hemi: [0x8080ff, 0x201030, 0.9], sun: [0xc0a0ff, 0.6], sunDir: [-0.4, 0.35, -0.6], sunCol: 0xfff0d8, sunSize: 0.9994, stars: 1, clouds: 0, wallA: 0x15152a, wallB: [0xff2bd6, 0x00e5ff], wallH: 1.3,
    basic: true,
  },
  desert: {
    sky: ['#3d7fd6', '#9cc8f0', '#ffe2b0'], fog: 0xf0d2a0, fogNear: 120, fogFar: 750,
    hemi: [0xfff1d6, 0x9a6a3a, 1.0], sun: [0xfff0d0, 1.4], sunDir: [0.5, 0.28, 0.4], sunCol: 0xfff3c0, sunSize: 0.9988, stars: 0, clouds: 0.35, wallA: 0xd94a2b, wallB: [0xf5f0e6, 0xd94a2b], wallH: 1.0,
  },
  snow: {
    sky: ['#5d8fcf', '#b8d4f0', '#eef4fb'], fog: 0xdfe9f5, fogNear: 90, fogFar: 600,
    hemi: [0xeaf3ff, 0x8090a8, 1.05], sun: [0xffffff, 1.1], sunDir: [0.4, 0.45, -0.5], sunCol: 0xffffff, sunSize: 0.9991, stars: 0, clouds: 0.6, wallA: 0xffffff, wallB: [0xe23b3b, 0xf8f8f8], wallH: 1.1,
  },
};

// Hash espacial de muestras de las superficies, para distancia a la pista
class TrackHash {
  constructor(track, cell = 24) {
    this.cell = cell; this.map = new Map();
    for (const surf of track.surfaces) {
      for (let i = 0; i < surf.n; i++) {
        const k = this.key(Math.floor(surf.px[i] / cell), Math.floor(surf.pz[i] / cell));
        let arr = this.map.get(k); if (!arr) this.map.set(k, arr = []);
        arr.push(surf.px[i], surf.pz[i], surf.py[i], surf.hw[i]);
      }
    }
  }
  key(a, b) { return a * 73856093 ^ b * 19349663; }
  // devuelve {d: distancia al borde, y: altura de la muestra más cercana}
  nearest(x, z, maxCells = 3, out = {}) {
    const cx = Math.floor(x / this.cell), cz = Math.floor(z / this.cell);
    let best = Infinity, by = 0, bd = Infinity;
    for (let a = -maxCells; a <= maxCells; a++) for (let b = -maxCells; b <= maxCells; b++) {
      const arr = this.map.get(this.key(cx + a, cz + b));
      if (!arr) continue;
      for (let i = 0; i < arr.length; i += 4) {
        const d = Math.hypot(arr[i] - x, arr[i + 1] - z) - arr[i + 3];
        if (d < best) { best = d; by = arr[i + 2]; bd = d; }
      }
    }
    out.d = bd; out.y = by;
    return out;
  }
}

function vnoise(x, z) {
  return Math.sin(x * 0.013 + Math.sin(z * 0.007) * 2) * 0.5 + Math.sin(z * 0.011 + x * 0.004) * 0.5
    + Math.sin((x + z) * 0.031) * 0.18 + Math.sin((x - z) * 0.023 + 1.3) * 0.2;
}

export function buildTrackScene(track, scene, quality = 2) {
  const theme = THEMES[track.def.theme];
  const group = new THREE.Group();
  scene.add(group);
  const disposables = [];

  // ---- límites
  let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity, miny = Infinity;
  for (const s of track.surfaces) for (let i = 0; i < s.n; i++) {
    minx = Math.min(minx, s.px[i]); maxx = Math.max(maxx, s.px[i]);
    minz = Math.min(minz, s.pz[i]); maxz = Math.max(maxz, s.pz[i]);
    miny = Math.min(miny, s.py[i]);
  }
  const center = new THREE.Vector3((minx + maxx) / 2, 0, (minz + maxz) / 2);
  const bounds = { minx, maxx, minz, maxz, center, size: Math.max(maxx - minx, maxz - minz) };
  const hash = new TrackHash(track);

  // ---- altura natural del terreno
  const tmp = {};
  const natural = (x, z) => {
    if (track.def.theme === 'city') return 0;
    const dc = Math.hypot(x - center.x, z - center.z);
    if (track.def.theme === 'desert') {
      return 2 + vnoise(x, z) * 5 + Math.max(0, dc - bounds.size * 0.6) * 0.15;
    }
    return 6 + vnoise(x * 1.3, z * 1.3) * 9 + Math.max(0, dc - bounds.size * 0.45) * 0.35;
  };
  const terrainHeight = (x, z) => {
    const n = natural(x, z);
    hash.nearest(x, z, 3, tmp);
    if (tmp.d === Infinity) return n;
    const t = THREE.MathUtils.smoothstep(tmp.d, 5, 45);
    return THREE.MathUtils.lerp(tmp.y - 0.45, n, t);
  };
  track.terrainHeight = terrainHeight;
  track.distToRoad = (x, z) => hash.nearest(x, z, 2, tmp).d;
  track.bounds = bounds;

  // ---- cielo
  // cielo procedural: degradado + sol/luna con halo + estrellas + nubes
  const sunDir = new THREE.Vector3(...theme.sunDir).normalize();
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(theme.sky[0]) }, mid: { value: new THREE.Color(theme.sky[1]) }, bot: { value: new THREE.Color(theme.sky[2]) },
      sunDir: { value: sunDir }, sunCol: { value: new THREE.Color(theme.sunCol) }, sunSize: { value: theme.sunSize },
      stars: { value: theme.stars }, clouds: { value: theme.clouds },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position.z = gl_Position.w; }',
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform vec3 sunDir; uniform vec3 sunCol; uniform float sunSize; uniform float stars; uniform float clouds;
      varying vec3 vP;
      float hash(vec3 p){ p = fract(p*0.3183099+0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        float a=hash(vec3(i,0.0)), b=hash(vec3(i+vec2(1,0),0.0)), c=hash(vec3(i+vec2(0,1),0.0)), d=hash(vec3(i+vec2(1,1),0.0));
        return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
      void main(){
        vec3 d = normalize(vP); float h = d.y;
        vec3 c = h>0.0 ? mix(mid, top, smoothstep(0.0,0.6,h)) : mix(mid, bot, smoothstep(0.0,0.15,-h));
        float s = dot(d, sunDir);
        c += sunCol * pow(max(s,0.0), 8.0) * 0.35;
        c += sunCol * smoothstep(sunSize, sunSize+0.0004, s) * 1.2;
        if (stars > 0.0 && h > 0.0) {
          vec3 q = floor(d*260.0);
          float st = step(0.9965, hash(q));
          c += vec3(st) * stars * smoothstep(0.0, 0.3, h) * (0.6+0.4*hash(q+3.0));
        }
        if (clouds > 0.0 && h > 0.02) {
          vec2 uv = d.xz / (h+0.15) * 2.2;
          float n = noise(uv) * 0.55 + noise(uv*2.3+7.0) * 0.3 + noise(uv*5.1) * 0.15;
          float cl = smoothstep(0.55, 0.8, n) * smoothstep(0.02, 0.25, h) * clouds;
          c = mix(c, vec3(1.0), cl);
        }
        gl_FragColor = vec4(c,1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), skyMat);
  sky.scale.setScalar(900);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  sky.userData.isSky = true;
  group.add(sky);
  scene.fog = new THREE.Fog(theme.fog, theme.fogNear, theme.fogFar);
  scene.background = new THREE.Color(theme.fog);

  // ---- luces
  const hemi = new THREE.HemisphereLight(theme.hemi[0], theme.hemi[1], theme.hemi[2]);
  group.add(hemi);
  const sun = new THREE.DirectionalLight(theme.sun[0], theme.sun[1]);
  sun.position.copy(sunDir).multiplyScalar(10).setY(Math.max(4, sunDir.y * 10 + 5));
  group.add(sun);

  // ---- terreno
  const size = bounds.size + 900;
  const segs = quality >= 2 ? 110 : 80;
  const tg = new THREE.PlaneGeometry(size, size, segs, segs);
  tg.rotateX(-Math.PI / 2);
  const pos = tg.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + center.x, z = pos.getZ(i) + center.z;
    pos.setXYZ(i, x, terrainHeight(x, z), z);
  }
  tg.computeVertexNormals();
  const uv = tg.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * size / 40, uv.getY(i) * size / 40);
  const gtex = groundTexture(track.def.theme);
  const ground = new THREE.Mesh(tg, new THREE.MeshLambertMaterial({ map: gtex }));
  group.add(ground);
  disposables.push(tg, gtex);

  // ---- carretera
  const rtex = roadTexture(track.def.theme);
  const roadMat = new THREE.MeshLambertMaterial({ map: rtex });
  if (track.def.theme === 'city') roadMat.emissive = new THREE.Color(0x0a0a18);
  track.surfaces.forEach((surf, k) => {
    const g = surfaceStrip(surf, -1, 1, k === 0 ? 0.02 : 0.05, 14);
    const m = new THREE.Mesh(g, roadMat);
    group.add(m);
    disposables.push(g);
  });
  disposables.push(rtex);

  // ---- paredes
  const wallMeshes = buildWalls(track, theme);
  wallMeshes.forEach(m => group.add(m));

  // ---- rampas
  const rampMat = new THREE.MeshLambertMaterial({ map: rampTexture(), side: THREE.DoubleSide });
  for (const r of track.ramps) {
    const g = rampGeometry(r);
    group.add(new THREE.Mesh(g, rampMat));
  }

  // ---- pads de turbo
  const ptex = boostPadTexture();
  ptex.repeat.set(1, 2);
  const padMat = new THREE.MeshBasicMaterial({ map: ptex, transparent: true, opacity: 0.95, depthWrite: false });
  const padGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  for (const p of track.pads) {
    const m = new THREE.Mesh(padGeo, padMat);
    m.scale.set(p.w, 1, p.len);
    m.position.set(p.x, p.y + 0.08, p.z);
    m.rotation.y = Math.atan2(p.fx, p.fz);
    m.renderOrder = 1;
    group.add(m);
  }

  // ---- línea de meta + arco
  const st = track.main.pointAt(0);
  const ctex = checkerTexture();
  ctex.wrapS = THREE.RepeatWrapping; ctex.repeat.set(st.hw * 2 / 8, 1);
  const finish = new THREE.Mesh(new THREE.PlaneGeometry(st.hw * 2, 3).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: ctex }));
  finish.position.set(st.x, st.y + 0.06, st.z);
  finish.rotation.y = Math.atan2(st.fx, st.fz);
  group.add(finish);
  const arch = new THREE.Group();
  const postMat = new THREE.MeshLambertMaterial({ color: 0x333344 });
  const bannerMat = new THREE.MeshBasicMaterial({ color: track.def.theme === 'city' ? 0xff2bd6 : 0xff3b3b });
  for (const sgn of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.8, 8, 0.8), postMat);
    post.position.set(sgn * (st.hw + 1.2), 4, 0);
    arch.add(post);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(st.hw * 2 + 3.2, 1.6, 0.6), bannerMat);
  beam.position.y = 8;
  arch.add(beam);
  const chk = new THREE.Mesh(new THREE.PlaneGeometry(st.hw * 2 + 3, 1.2), new THREE.MeshBasicMaterial({ map: ctex, side: THREE.DoubleSide }));
  chk.position.set(0, 8, 0.32); arch.add(chk);
  arch.position.set(st.x, st.y, st.z);
  arch.rotation.y = Math.atan2(st.fx, st.fz);
  group.add(arch);

  // ---- decoración del tema
  const env = buildEnvironment(track, theme, group, quality);
  buildTrackside(track, theme, group, Math.random, quality);

  return {
    sky,
    group, theme, padTex: ptex, env,
    update(dt, t) {
      ptex.offset.y -= dt * 2.5;
      env.update && env.update(dt, t);
    },
    dispose() {
      scene.remove(group);
      group.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
        }
      });
      disposables.forEach(d => d.dispose && d.dispose());
      scene.fog = null;
    },
  };
}

// Tira de carretera entre lat a..b (en fracciones del medio ancho)
function surfaceStrip(surf, a, b, yOff, vScale) {
  const n = surf.n, closed = surf.closed;
  const count = closed ? n + 1 : n;
  const positions = new Float32Array(count * 2 * 3);
  const uvs = new Float32Array(count * 2 * 2);
  const normals = new Float32Array(count * 2 * 3);
  for (let k = 0; k < count; k++) {
    const i = k % n;
    const rx = surf.rightX(i), rz = surf.rightZ(i), hw = surf.hw[i];
    const s = k === n ? surf.length : surf.s[i];
    for (let side = 0; side < 2; side++) {
      const f = side ? b : a;
      const o = (k * 2 + side);
      positions[o * 3] = surf.px[i] + rx * hw * f;
      positions[o * 3 + 1] = surf.py[i] + yOff;
      positions[o * 3 + 2] = surf.pz[i] + rz * hw * f;
      uvs[o * 2] = side;
      uvs[o * 2 + 1] = s / vScale;
      normals[o * 3 + 1] = 1;
    }
  }
  const idx = [];
  for (let k = 0; k < count - 1; k++) {
    const a0 = k * 2, a1 = k * 2 + 1, b0 = k * 2 + 2, b1 = k * 2 + 3;
    // orientación: derecha = (-fz, fx); generamos caras hacia arriba
    idx.push(a0, b0, a1, a1, b0, b1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  g.setIndex(idx);
  // asegurar normales hacia arriba
  g.computeVertexNormals();
  if (g.attributes.normal.getY(0) < 0) {
    const ix = g.index.array;
    for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
    g.computeVertexNormals();
  }
  return g;
}

function buildWalls(track, theme) {
  const pos = [], col = [];
  const cA = new THREE.Color(theme.wallA);
  const cB = theme.wallB.map(c => new THREE.Color(c));
  const H = theme.wallH;
  const tmp = {};
  const insideOther = (x, z, selfK) => {
    for (let k = 0; k < track.surfaces.length; k++) {
      if (k === selfK) continue;
      const s = track.surfaces[k];
      s.project(x, z, -1, tmp);
      if (!s.closed && (tmp.s <= 0.5 || tmp.s >= s.length - 0.5)) continue;
      if (Math.abs(tmp.lat) < tmp.hw - 0.3) return true;
    }
    return false;
  };
  const pushQuad = (a, b, c, d, ca, cb) => {
    // a,b abajo; c,d arriba (a->b a lo largo)
    pos.push(...a, ...b, ...d, ...a, ...d, ...c);
    col.push(ca.r, ca.g, ca.b, ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cb.r, cb.g, cb.b);
  };
  track.surfaces.forEach((surf, k) => {
    for (const side of [-1, 1]) {
      const n = surf.n;
      const pts = [];
      for (let i = 0; i < n; i++) {
        const off = surf.hw[i] + 0.5;
        const x = surf.px[i] + surf.rightX(i) * off * side;
        const z = surf.pz[i] + surf.rightZ(i) * off * side;
        const skip = insideOther(x, z, k);
        pts.push({ x, z, y: surf.py[i], skip, ox: x + surf.rightX(i) * side * 0.6, oz: z + surf.rightZ(i) * side * 0.6 });
      }
      const last = surf.closed ? n : n - 1;
      for (let i = 0; i < last; i++) {
        const p = pts[i], q = pts[(i + 1) % n];
        if (p.skip || q.skip) continue;
        const stripe = Math.floor(surf.s[i] / 4) % 2;
        const top = theme.basic ? cB[side > 0 ? 1 : 0] : cB[stripe];
        const base = theme.basic ? cA : (track.def.theme === 'snow' ? cA : cB[stripe]);
        // cara interior
        pushQuad([p.x, p.y - 0.5, p.z], [q.x, q.y - 0.5, q.z], [p.x, p.y + H, p.z], [q.x, q.y + H, q.z], base, top);
        // parte superior
        pushQuad([p.x, p.y + H, p.z], [q.x, q.y + H, q.z], [p.ox, p.y + H, p.oz], [q.ox, q.y + H, q.oz], top, top);
        // cara exterior
        pushQuad([p.ox, p.y + H, p.oz], [q.ox, q.y + H, q.oz], [p.ox, p.y - 1, p.oz], [q.ox, q.y - 1, q.oz], base, base);
      }
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const mat = theme.basic
    ? new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })
    : new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  return [new THREE.Mesh(g, mat)];
}

function rampTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#ffcc00'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#222';
  for (let i = -64; i < 128; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 16, 0); g.lineTo(i + 80, 64); g.lineTo(i + 64, 64); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function rampGeometry(r) {
  const surf = r.surf, steps = 8;
  const pos = [], uvs = [];
  const P = (s, lat, h) => { const p = surf.pointAt(s, lat); return [p.x, p.y + h + 0.03, p.z]; };
  const hwAt = s => surf.pointAt(s).hw;
  const quad = (a, b, c, d, u0, u1, v0, v1) => {
    pos.push(...a, ...b, ...c, ...b, ...d, ...c);
    uvs.push(u0, v0, u1, v0, u0, v1, u1, v0, u1, v1, u0, v1);
  };
  for (let k = 0; k < steps; k++) {
    const s0 = r.s0 + r.len * k / steps, s1 = r.s0 + r.len * (k + 1) / steps;
    const h0 = r.h * k / steps, h1 = r.h * (k + 1) / steps;
    const w0 = r.w ? r.w / 2 : hwAt(s0), w1 = r.w ? r.w / 2 : hwAt(s1);
    quad(P(s0, r.lat - w0, h0), P(s0, r.lat + w0, h0), P(s1, r.lat - w1, h1), P(s1, r.lat + w1, h1), 0, w0 / 2, k / 2, (k + 1) / 2);
    // laterales
    quad(P(s0, r.lat - w0, 0), P(s1, r.lat - w1, 0), P(s0, r.lat - w0, h0), P(s1, r.lat - w1, h1), 0, 1, 0, 0.3);
    quad(P(s0, r.lat + w0, 0), P(s1, r.lat + w1, 0), P(s0, r.lat + w0, h0), P(s1, r.lat + w1, h1), 0, 1, 0, 0.3);
  }
  const se = r.s0 + r.len, we = r.w ? r.w / 2 : hwAt(se);
  quad(P(se, r.lat - we, 0), P(se, r.lat + we, 0), P(se, r.lat - we, r.h), P(se, r.lat + we, r.h), 0, 4, 0, 0.5);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  return g;
}
