import { CARS, CLASSES } from '../../cars/carData.js';
import { Profile } from '../../game/Storage.js';
import { CarPreview } from '../components/CarPreview.js';
import { carThumb } from '../components/Thumbs.js';
import { el, money } from '../dom.js';
import { showMainMenu } from './MainMenu.js';

const SPEC_BARS = [['speed', 'Velocidad'], ['accel', 'Aceleración'], ['handling', 'Manejo'], ['turbo', 'Turbo']];

// Concesionario: comprar autos con el dinero ganado en las carreras
export function showDealer(ui, back, opts = {}) {
  const goBack = back || (() => showMainMenu(ui));
  let filter = opts.filter || 'all';
  let sel = (opts.sel && CARS.find(c => c.id === opts.sel)) || CARS.find(c => !Profile.owns(c.id) && c.price > 0) || CARS[0];
  const n = el(`<div class="screen dealer">
    <header class="scr-head"><span class="step">COMPRA, COLECCIONA Y CORRE</span><h2>CONCESIONARIO</h2></header>
    <div class="dealer-body">
      <section class="showroom">
        <div class="sr-stage"><canvas></canvas><div class="sr-floor"></div><div class="sr-badge"></div></div>
        <div class="sr-info">
          <div class="sr-brand"></div>
          <div class="sr-name"></div>
          <div class="sr-specs"></div>
          <div class="sr-bars"></div>
          <div class="sr-buy">
            <div class="sr-price"></div>
            <button class="btn go big" data-a="buy">Comprar</button>
          </div>
        </div>
      </section>
      <section class="lot">
        <div class="tabs">
          <button class="tab ${filter === 'all' ? 'on' : ''}" data-f="all">Todos</button>
          ${Object.entries(CLASSES).map(([k, c]) => `<button class="tab ${filter === k ? 'on' : ''}" data-f="${k}" style="--cc:${c.color}">${k} · ${c.name}</button>`).join('')}
          <button class="tab" data-f="own">Mi garaje</button>
        </div>
        <div class="lot-grid"></div>
      </section>
    </div>
    <div class="menu-row bottom"><button class="btn" data-a="back" data-focus>‹ Volver</button></div>
  </div>`);

  const prev = new CarPreview(n.querySelector('.sr-stage canvas'));
  ui.previews.push(prev);
  const grid = n.querySelector('.lot-grid');

  const renderGrid = () => {
    const list = CARS.filter(c => filter === 'all' || (filter === 'own' ? Profile.owns(c.id) : c.cls === filter));
    grid.innerHTML = list.map(c => {
      const own = Profile.owns(c.id);
      const afford = Profile.canAfford(c.price);
      return `<button class="lot-card focusable ${c.id === sel.id ? 'sel' : ''} ${own ? 'own' : afford ? 'afford' : 'locked'}" data-id="${c.id}">
        <span class="lc-cls" style="--cc:${CLASSES[c.cls].color}">${c.cls}</span>
        <img alt="" data-thumb="${c.id}">
        <span class="lc-name"><small>${c.brand}</small>${c.name}</span>
        <span class="lc-row"><span>${c.top} km/h</span><b>${own ? '✓ Tuyo' : c.price === 0 ? 'Gratis' : money(c.price)}</b></span>
      </button>`;
    }).join('');
    grid.querySelectorAll('img[data-thumb]').forEach(img => {
      const def = CARS.find(c => c.id === img.dataset.thumb);
      carThumb(def, url => { img.src = url; img.classList.add('ok'); });
    });
    grid.querySelectorAll('.lot-card').forEach(b => b.addEventListener('click', () => {
      sel = CARS.find(c => c.id === b.dataset.id);
      ui.game.audio?.ui();
      grid.querySelectorAll('.lot-card').forEach(x => x.classList.toggle('sel', x === b));
      renderInfo();
    }));
  };

  const renderInfo = () => {
    const c = sel, own = Profile.owns(c.id), afford = Profile.canAfford(c.price);
    prev.set(c, c.color);
    ui.showCar(c, c.color, 'center'); // se ve en grande en el showroom
    n.querySelector('.sr-badge').innerHTML = `<span style="--cc:${CLASSES[c.cls].color}">CLASE ${c.cls} · ${CLASSES[c.cls].name.toUpperCase()}</span>`;
    n.querySelector('.sr-brand').textContent = c.brand.toUpperCase();
    n.querySelector('.sr-name').textContent = c.name;
    n.querySelector('.sr-specs').innerHTML = `
      <div><b>${c.top}</b><small>km/h máx.</small></div>
      <div><b>${c.zero.toFixed(1)}s</b><small>0-100 km/h</small></div>
      <div><b>${c.hp}</b><small>CV</small></div>
      <div><b>${c.kg}</b><small>kg</small></div>`;
    n.querySelector('.sr-bars').innerHTML = SPEC_BARS.map(([k, l]) =>
      `<div class="stat"><span>${l}</span><div class="bar"><i style="--v:${c.bars[k] / 10}"></i></div><b>${c.bars[k]}</b></div>`).join('');
    const price = n.querySelector('.sr-price');
    const btn = n.querySelector('[data-a=buy]');
    btn.classList.remove('confirm');
    delete btn.dataset.confirm;
    if (own) {
      price.innerHTML = '<span class="owned">✓ EN TU GARAJE</span>';
      btn.textContent = 'Elegir para correr';
      btn.disabled = false;
    } else {
      price.innerHTML = c.price === 0 ? 'GRATIS' : money(c.price);
      btn.disabled = !afford;
      btn.textContent = afford ? 'Comprar' : `Te faltan ${money(c.price - Profile.data.money)}`;
    }
  };

  n.querySelector('[data-a=buy]').addEventListener('click', e => {
    const btn = e.currentTarget;
    const c = sel;
    if (Profile.owns(c.id)) {
      ui.s.p1.car = c.id; ui.s.p1.color = -1;
      ui.game.audio?.ui();
      btn.textContent = '✓ Elegido para el Jugador 1';
      return;
    }
    if (!btn.dataset.confirm) {
      btn.dataset.confirm = 1;
      btn.classList.add('confirm');
      btn.textContent = `¿Confirmar ${money(c.price)}?`;
      ui.game.audio?.ui();
      return;
    }
    if (Profile.buy(c)) {
      ui.game.audio?.fanfare();
      ui.updateMoney(true);
      n.querySelector('.showroom').classList.remove('bought'); void n.offsetWidth;
      n.querySelector('.showroom').classList.add('bought');
      renderGrid(); renderInfo();
    }
  });
  ui.click(n, '.tab', (e, b) => {
    filter = b.dataset.f;
    n.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t === b));
    renderGrid();
  });
  ui.click(n, '[data-a=back]', goBack);
  ui.screen(n, { back: goBack, demo: true });
  renderGrid(); renderInfo(); // después de screen() para que el showroom muestre este auto
  ui.keyHandler = code => {
    if (code !== 'KeyA' && code !== 'KeyD') return false;
    const list = [...grid.querySelectorAll('.lot-card')];
    const i = list.findIndex(x => x.classList.contains('sel'));
    const nb = list[(i + (code === 'KeyD' ? 1 : -1) + list.length) % list.length];
    nb && nb.click();
    nb && nb.scrollIntoView({ block: 'nearest' });
    return true;
  };
}
