// Controles táctiles: cada jugador usa su mitad de la pantalla.
// Multitouch real con Pointer Events: cada dedo (pointerId) se asigna al botón bajo él,
// y puede deslizarse entre botones (por ejemplo de ◀ a ▶) sin levantarlo.
export class TouchControls {
  constructor(root, input) {
    this.root = root;
    this.input = input;
    input.touch = this;
    this.zones = [];
    this.used = [false, false];
    this.autoAccel = true;
    this.enabled = false;
  }

  build(views, opts) {
    this.clear();
    this.enabled = true;
    this.autoAccel = opts.autoAccel;
    views.forEach((v, i) => {
      const z = document.createElement('div');
      z.className = 'tzone p' + (i + 1) + (views.length > 1 ? ' split' : '') + (opts.tilt ? ' tilt' : '');
      z.innerHTML = opts.tilt ? `
        <div class="tcl left">
          <div class="tbtn brake" data-b="brake">▼<small>FRENO</small></div>
          <div class="tbtn drift" data-b="drift">⟲<small>DERRAPE</small></div>
        </div>
        <div class="twheel"><div class="tw-ring"><i></i></div><button class="tw-center" data-b="center">CENTRAR</button></div>
        <div class="tcl right">
          ${opts.autoAccel ? '' : '<div class="tbtn gas" data-b="gas">▲<small>ACEL.</small></div>'}
          ${opts.items ? '<div class="tbtn item" data-b="item">★<small>ÍTEM</small></div>' : ''}
          <div class="tbtn boost" data-b="boost">🔥<small>TURBO</small></div>
        </div>` : `
        <div class="tcl left">
          <div class="tbtn steer" data-b="left">◀</div>
          <div class="tbtn steer" data-b="right">▶</div>
        </div>
        <div class="tcl right">
          ${opts.autoAccel ? '' : '<div class="tbtn gas" data-b="gas">▲<small>ACEL.</small></div>'}
          <div class="tbtn brake" data-b="brake">▼<small>FRENO</small></div>
          ${opts.items ? '<div class="tbtn item" data-b="item">★<small>ÍTEM</small></div>' : ''}
          <div class="tbtn drift" data-b="drift">⟲<small>DERRAPE</small></div>
          <div class="tbtn boost" data-b="boost">🔥<small>TURBO</small></div>
        </div>`;
      z.insertAdjacentHTML('beforeend', '<div class="tbtn cam" data-b="cam">🎥</div>');
      if (opts.weapons) z.insertAdjacentHTML('beforeend', '<div class="tbtn fire" data-b="fire">🎯<small>DISPARO</small></div><div class="tbtn wnext" data-b="wnext">⇄</div>');
      this.root.appendChild(z);
      const zone = { el: z, pointers: new Map(), state: {}, btns: [...z.querySelectorAll('.tbtn, .tw-center')], wheel: z.querySelector('.tw-ring') };
      if (opts.tilt) this.used[i] = true; // con inclinación, acelera solo aunque no toques la pantalla
      this.zones.push(zone);
      this.bind(zone, i);
    });
    this.layout(views);
  }

  layout(views) {
    this.zones.forEach((z, i) => {
      const v = views[i]; if (!v) return;
      const s = z.el.style;
      s.left = v.x + 'px'; s.top = v.y + 'px'; s.width = v.w + 'px'; s.height = v.h + 'px';
      const size = Math.round(Math.max(54, Math.min(v.h * 0.26, v.w * 0.17, 110)));
      s.setProperty('--bs', size + 'px');
      z.rects = null;
    });
  }

  bind(zone, i) {
    const el = zone.el;
    const hit = (x, y) => {
      // botón más cercano bajo el dedo (con margen generoso)
      let best = null, bd = Infinity;
      for (const b of zone.btns) {
        const r = b.getBoundingClientRect();
        const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
        const rad = r.width * 0.75;
        const d = Math.hypot(x - cx, y - cy);
        if (d < rad && d < bd) { bd = d; best = b; }
      }
      return best;
    };
    const update = () => {
      const st = {};
      for (const b of zone.pointers.values()) if (b) st[b.dataset.b] = true;
      zone.state = st;
      zone.btns.forEach(b => b.classList.toggle('on', !!st[b.dataset.b]));
    };
    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      this.used[i] = true;
      try { el.setPointerCapture(e.pointerId); } catch { /* sin captura */ }
      zone.pointers.set(e.pointerId, hit(e.clientX, e.clientY));
      update();
      if (navigator.vibrate && zone.pointers.get(e.pointerId)) navigator.vibrate(8);
    });
    el.addEventListener('pointermove', e => {
      if (!zone.pointers.has(e.pointerId)) return;
      const prev = zone.pointers.get(e.pointerId);
      const b = hit(e.clientX, e.clientY);
      // deslizar: desde nada a un botón, o entre ◀ y ▶. Derrape/turbo se mantienen aunque el dedo se mueva.
      const next = !prev ? b : (prev.classList.contains('steer') && b && b.classList.contains('steer') ? b : prev);
      if (next !== prev) { zone.pointers.set(e.pointerId, next); update(); }
    });
    const up = e => { zone.pointers.delete(e.pointerId); update(); };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
  }

  apply(p, st, humans) {
    if (!this.enabled) return;
    const zones = humans === 1 ? this.zones.slice(0, 1) : [this.zones[p]];
    for (const z of zones) {
      if (!z) continue;
      const s = z.state;
      if (s.left) st.steer = Math.max(-1, st.steer - 1);
      if (s.right) st.steer = Math.min(1, st.steer + 1);
      if (s.drift) st.drift = true;
      if (s.boost) st.boost = true;
      if (s.item) st.item = true;
      if (s.brake) st.brake = 1;
      if (s.gas) st.throttle = 1;
      if (s.center && this.onCenter) { this.onCenter(); s.center = false; }
      if (s.cam && !z.camWas) st.camPressed = true;
      z.camWas = !!s.cam;
      if (s.fire) { st.fire = true; if (!z.fireWas) st.firePressed = true; }
      z.fireWas = !!s.fire;
      if (s.wnext && !z.nextWas) st.weaponNextPressed = true;
      z.nextWas = !!s.wnext;
      if (this.autoAccel && this.used[humans === 1 ? 0 : p] && !s.brake) st.throttle = 1;
    }
  }

  // muestra el giro actual en el volante (modo inclinación)
  showSteer(v, ok) {
    const z = this.zones[0];
    if (!z || !z.wheel) return;
    z.wheel.style.transform = `rotate(${(v * 90).toFixed(1)}deg)`;
    z.wheel.parentElement.classList.toggle('nosensor', !ok);
  }

  clear() {
    this.zones.forEach(z => z.el.remove());
    this.zones = [];
    this.used = [false, false];
    this.enabled = false;
  }
}
