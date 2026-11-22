import { COUNT_TEXT, fmtTime } from '../ui/hud/HUD.js';

// Traduce los eventos de la carrera en sonidos y mensajes del HUD
export function handleRaceEvents(game, race) {
  const hudOf = r => game.huds.find(h => h.racer === r);
  const audio = game.audio;
  for (const e of race.events) {
    const human = e.racer && e.racer.human;
    const h = e.racer ? hudOf(e.racer) : null;
    switch (e.type) {
      case 'count':
        audio.count(e.value);
        if (e.value === 0 && game.input.tilt.enabled) game.input.tilt.calibrate(); // centro del volante al arrancar
        game.huds.forEach(x => x.flash(COUNT_TEXT[e.value], '', e.value === 0 ? 0.9 : 0.85, e.value === 0 ? 'go' : 'count'));
        break;
      case 'lap':
        if (human) audio.lap(e.lap === race.laps);
        if (h) {
          const last = e.racer.lapTimes[e.racer.lapTimes.length - 1];
          h.flash(e.lap === race.laps ? '¡VUELTA FINAL!' : `VUELTA ${e.lap}`, last ? 'Última: ' + fmtTime(last) : '', 1.6, 'lap');
        }
        break;
      case 'finish':
        if (human) audio.fanfare();
        if (h) h.flash(`¡META! ${e.racer.place}º`, '', 99, 'finish');
        break;
      case 'itemGet':
        if (human) audio.item('get');
        break;
      case 'itemUse':
        if (e.item === 'shield') audio.item('shield');
        break;
      case 'shieldBlock':
        audio.item('shield');
        break;
      case 'oilHit':
        audio.item('oil');
        if (h) h.flash('¡ACEITE!', '', 0.8, 'mini lvl2');
        break;
    }
    game.emit('raceEvent', e);
  }
  race.events.length = 0;
  for (const hud of game.huds) {
    const c = hud.racer.car;
    if (c.ev.miniTurbo) hud.flash('¡MINI-TURBO!', '', 0.7, 'mini lvl' + c.ev.miniTurbo);
  }
}
