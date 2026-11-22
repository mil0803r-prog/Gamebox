import './ui/styles.css';
import { Game } from './game/Game.js';
import { CARS, COLORS } from './cars/carData.js';

const game = new Game(document.getElementById('app'));
window.__game = game;

// Etapa 1: carrera rápida de 2 jugadores
game.startRace({
  trackId: new URLSearchParams(location.search).get('track') || 'neon',
  laps: 3,
  entries: [
    { car: CARS[0], color: COLORS[0].hex, human: true, humanIndex: 0, name: 'J1' },
    { car: CARS[0], color: COLORS[1].hex, human: true, humanIndex: 1, name: 'J2' },
  ],
});
