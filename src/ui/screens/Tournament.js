import { TRACKS } from '../../tracks/trackData.js';
import { carById } from '../../cars/carData.js';
import { Settings, Profile } from '../../game/Storage.js';
import { el, money, THEME_GRAD, THEME_ICON } from '../dom.js';
import { showMainMenu } from './MainMenu.js';

// =====================================================================
//  Torneo: 4 carreras seguidas (una en cada pista) contra los mismos
//  rivales. Puntos por puesto; premio grande para el podio final.
// =====================================================================
export const CUP_POINTS = [10, 6, 4, 2, 1];
export const CUP_PRIZE = [60000, 30000, 15000];

export function showTournament(ui) {
  const s = ui.s;
  const car = carById(s.p1.car);
  const n = el(`<div class="screen cup">
    <header class="scr-head"><span class="step">4 CARRERAS · LOS MISMOS RIVALES · PUNTOS POR PUESTO</span><h2>TORNEO</h2></header>
    <div class="cup-body">
      <div class="cup-tracks">${TRACKS.map((t, i) => `
        <div class="cup-track" style="--grad:${THEME_GRAD[t.theme]}">
          <span class="cup-n">${i + 1}</span>
          <span class="cup-tn"><small>${THEME_ICON[t.theme]} ${t.subtitle}</small><b>${t.name}</b></span>
        </div>`).join('')}
      </div>
      <div class="glass cup-info">
        <div class="cup-row"><span>Tu auto</span><b>${car.brand} ${car.name}</b></div>
        <div class="cup-row"><span>Puntos</span><b>${CUP_POINTS.map((p, i) => `${i + 1}º ${p}`).join(' · ')}</b></div>
        <div class="cup-prizes">
          ${CUP_PRIZE.map((p, i) => `<div class="cup-prize p${i + 1}"><span>${['🥇', '🥈', '🥉'][i]}</span><b>${money(p)}</b></div>`).join('')}
        </div>
        <div class="opt"><span>Dificultad</span>
          <div class="seg" data-o="diff">${['Fácil', 'Normal', 'Difícil'].map((t, i) => `<button class="segb ${i === s.difficulty ? 'on' : ''}" data-v="${i}">${t}</button>`).join('')}</div>
        </div>
      </div>
    </div>
    <div class="menu-row bottom">
      <button class="btn" data-a="back">‹ Volver</button>
      <button class="btn go" data-a="go" data-focus>¡Empezar torneo! 🏆</button>
    </div>
  </div>`);
  ui.click(n, '.segb', (e, b) => {
    s.difficulty = +b.dataset.v;
    n.querySelectorAll('.segb').forEach(x => x.classList.toggle('on', x === b));
  });
  ui.click(n, '[data-a=back]', () => showMainMenu(ui));
  ui.click(n, '[data-a=go]', () => startCup(ui));
  ui.screen(n, { back: () => showMainMenu(ui), demo: true });
}

export function startCup(ui) {
  const s = ui.s;
  ui.mode = 1;
  if (s.rivals1p < 3) s.rivals1p = 3;
  ui.cup = { round: 0, tracks: TRACKS.map((_, i) => i), points: {}, entries: null, laps: 3 };
  s.track = 0;
  Settings.save();
  ui.startRace();
}

// suma los puntos de la carrera y devuelve el HTML de la tabla del torneo
export function cupAfterRace(ui, rows) {
  const cup = ui.cup;
  rows.forEach((row, i) => { cup.points[row.r.name] = (cup.points[row.r.name] || 0) + (CUP_POINTS[i] || 0); });
  cup.round++;
  cup.done = cup.round >= cup.tracks.length;
  const table = Object.entries(cup.points).sort((a, b) => b[1] - a[1]);
  let banner = '';
  if (cup.done) {
    const place = table.findIndex(([name]) => name === 'Jugador 1');
    const prize = CUP_PRIZE[place] || 0;
    if (prize) Profile.earn(prize);
    if (place === 0) Profile.stat('cups');
    cup.final = { place, prize };
    banner = `<div class="cup-final ${place === 0 ? 'win' : ''}">${place === 0 ? '👑 ¡CAMPEÓN DEL TORNEO!' : place < 3 ? `🏆 Terminaste ${place + 1}º en el torneo` : `Terminaste ${place + 1}º en el torneo`}${prize ? ` <b>+${money(prize)}</b>` : ''}</div>`;
  }
  return `<div class="cup-standings glass">
    <div class="cup-sh"><b>TORNEO</b><span>Carrera ${cup.round} de ${cup.tracks.length}</span></div>
    ${table.map(([name, pts], i) => `<div class="cup-st ${name.startsWith('Jugador') ? 'me' : ''}"><span>${i + 1}º</span><b>${name}</b><i>${pts} pts</i></div>`).join('')}
  </div>${banner}`;
}
