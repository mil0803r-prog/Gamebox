import { Records, Profile, Settings } from '../../game/Storage.js';
import { el, hex, fmtTime, money } from '../dom.js';
import { COIN_VALUE } from '../../game/Pickups.js';
import { showTrackSelect } from './TrackSelect.js';
import { cupAfterRace } from './Tournament.js';

export function showResults(ui) {
  const race = ui.game.race;
  ui.resultsShown = true;
  ui.game.audio?.music('results');
  const L = race.track.length;
  // estimar el tiempo de los que no terminaron
  const rows = race.racers.map(r => {
    let total = r.finished ? r.finishTime : null;
    if (!r.finished) {
      const remaining = race.laps * L - Math.max(0, r.raceDist);
      const avg = Math.max(20, r.raceDist / Math.max(1, race.time));
      total = race.time + remaining / avg;
    }
    return { r, total, est: !r.finished, best: r.lapTimes.length ? Math.min(...r.lapTimes) : null };
  }).sort((a, b) => a.total - b.total);
  const winner = rows[0];
  const trackId = race.track.def.id;
  const recMsgs = [];
  for (const row of rows) {
    if (row.r.human && row.r.finished) {
      const res = Records.submit(trackId, race.laps, row.r.lapTimes, row.total, row.r.name);
      if (res.lap) recMsgs.push(`¡Nuevo récord de vuelta! ${row.r.name} · ${fmtTime(row.best)}`);
      if (res.race) recMsgs.push(`¡Nuevo récord de carrera (${race.laps} v.)! ${row.r.name} · ${fmtTime(row.total)}`);
    }
  }
  // ---- premios en dinero: según el puesto, vueltas, rivales y dificultad
  const PRIZE = [15000, 9000, 5500, 3000];
  const hasAI = race.racers.some(r => !r.human);
  const diffMul = hasAI ? [0.75, 1, 1.4][Settings.data.difficulty] : 0.7;
  const lapMul = Math.max(0.5, race.laps / 3);
  const earnings = [];
  rows.forEach((row, i) => {
    if (!row.r.human || !row.r.finished) return;
    let prize = Math.round(PRIZE[Math.min(3, i)] * diffMul * lapMul / 100) * 100;
    const bonus = [];
    if (recMsgs.some(m => m.includes(row.r.name) && m.includes('vuelta'))) { prize += 2500; bonus.push('récord de vuelta +$2.500'); }
    if (recMsgs.some(m => m.includes(row.r.name) && m.includes('carrera'))) { prize += 5000; bonus.push('récord de carrera +$5.000'); }
    // monedas y cajones sorpresa recogidos en la pista
    const coinCash = (row.r.coins || 0) * COIN_VALUE;
    if (coinCash) { prize += coinCash; bonus.push(`🪙 ${row.r.coins} monedas +${money(coinCash)}`); }
    if (row.r.bonus) { prize += row.r.bonus; bonus.push(`🎁 cajones +${money(row.r.bonus)}`); }
    earnings.push({ name: row.r.name, place: i + 1, prize, bonus });
    Profile.earn(prize);
  });
  // estadísticas para las misiones
  rows.forEach((row, i) => {
    if (!row.r.human) return;
    if (row.r.coins) Profile.stat('coins', row.r.coins);
    if (!row.r.finished) return;
    Profile.stat('races');
    if (i === 0) { Profile.stat('wins'); if (hasAI && Settings.data.difficulty === 2) Profile.stat('hardWins'); }
  });
  const cupHtml = ui.cup ? cupAfterRace(ui, rows) : '';
  const cup = ui.cup;
  ui.updateMoney(true);

  const allBest = Math.min(...rows.map(r => r.best ?? Infinity));
  const pod = [rows[1], rows[0], rows[2]];
  const confetti = Array.from({ length: 36 }, (_, i) =>
    `<i style="left:${Math.random() * 100}%;animation-delay:${(Math.random() * 2).toFixed(2)}s;animation-duration:${(2.5 + Math.random() * 2).toFixed(2)}s;background:${['#ffe14d', '#ff2bd6', '#00e5ff', '#2fe07a', '#ff8a1f'][i % 5]}"></i>`).join('');
  const n = el(`<div class="screen overlay results">
    <div class="confetti">${confetti}</div>
    <header class="scr-head"><span class="step">${race.track.def.name.toUpperCase()} · ${race.laps} VUELTAS</span><h2>${winner.r.human ? '¡GANA ' + winner.r.name.toUpperCase() + '!' : 'RESULTADOS'}</h2></header>
    <div class="podium">${pod.map((row, k) => row ? `
      <div class="pod p${[2, 1, 3][k]}">
        <div class="pcrown">${[2, 1, 3][k] === 1 ? '👑' : ''}</div>
        <div class="pcar" style="--c:${hex(row.r.color)}"><i></i><i></i></div>
        <div class="pname">${row.r.name}</div>
        <div class="ptime">${row.est ? '~' : ''}${fmtTime(row.total)}</div>
        <div class="pblock"><span>${[2, 1, 3][k]}</span></div>
      </div>` : '<div class="pod empty"></div>').join('')}</div>
    ${recMsgs.map(m => `<div class="newrec">🏆 ${m}</div>`).join('')}
    ${earnings.length ? `<div class="earnings">${earnings.map(e => `<div class="earn"><span>${e.name} · ${e.place}º</span><b data-count="${e.prize}" data-pre="+">+$0</b>${e.bonus.length ? `<small>${e.bonus.join(' · ')}</small>` : ''}</div>`).join('')}
      <div class="earn total"><span>Saldo</span><b data-count="${Profile.data.money}" data-from="${Profile.data.money - earnings.reduce((a, e) => a + e.prize, 0)}">${money(Profile.data.money)}</b></div></div>` : ''}
    ${cupHtml}
    <div class="table-wrap"><table class="rtable">
      <tr><th>#</th><th>Piloto</th><th>Total</th><th>Mejor vuelta</th><th>Vueltas</th></tr>
      ${rows.map((row, i) => `<tr class="${row.r.human ? 'human' : ''}">
        <td>${i + 1}º</td><td><i class="dot" style="background:${hex(row.r.color)}"></i>${row.r.name}</td>
        <td>${row.est ? '~' : ''}${fmtTime(row.total)}</td>
        <td class="${row.best === allBest ? 'fast' : ''}">${fmtTime(row.best)}${row.best === allBest ? ' ⚡' : ''}</td>
        <td class="laps">${row.r.lapTimes.map(fmtTime).join(' · ') || '—'}</td></tr>`).join('')}
    </table></div>
    <div class="menu-row bottom">${ui.net ? (ui.net.isHost
      ? '<button class="btn go" data-a="lobby" data-focus>↻ Volver a la sala</button><button class="btn" data-a="menu">Salir</button>'
      : '<button class="btn" disabled>Esperando al anfitrión…</button><button class="btn" data-a="menu" data-focus>Salir</button>') : cup ? (cup.done
      ? '<button class="btn go" data-a="menu" data-focus>⌂ Menú</button>'
      : `<button class="btn go" data-a="next" data-focus>Siguiente carrera ${cup.round + 1}/${cup.tracks.length} ›</button><button class="btn" data-a="menu">Abandonar torneo</button>`) : `
      <button class="btn go" data-a="again" data-focus>↻ Revancha</button>
      <button class="btn" data-a="track">🗺 Cambiar pista</button>
      <button class="btn" data-a="menu">⌂ Menú</button>`}
    </div>
  </div>`);
  ui.click(n, '[data-a]', (e, b) => {
    const a = b.dataset.a;
    if (a === 'again') ui.startRace();
    if (a === 'lobby') ui.net.backToLobby();
    if (a === 'next') { ui.s.track = cup.tracks[cup.round]; ui.startRace(); }
    if (a === 'track') { ui.game.endRace(); ui.showPauseButton(false); showTrackSelect(ui); }
    if (a === 'menu') ui.exitToMenu();
  });
  ui.screen(n, { overlay: true, showMoney: true });
  // el dinero ganado sube contando, con un tic de sonido
  n.querySelectorAll('[data-count]').forEach(b => {
    const to = +b.dataset.count, from = +(b.dataset.from || 0), pre = b.dataset.pre || '';
    const t0 = performance.now() + 700, dur = 1100;
    let lastTick = 0;
    const tick = now => {
      const k = Math.max(0, Math.min(1, (now - t0) / dur));
      const e = 1 - Math.pow(1 - k, 3);
      b.textContent = pre + money(from + (to - from) * e);
      if (k > 0 && k < 1 && now - lastTick > 70) { lastTick = now; ui.game.audio?.beep(1200 + e * 800, 0.03, 0.04, 'square'); }
      if (k < 1 && b.isConnected) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  ui.showPauseButton(false);
}
