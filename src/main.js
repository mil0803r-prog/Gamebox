import './ui/styles.css';
import { Game } from './game/Game.js';
import { UI } from './ui/UI.js';

const game = new Game(document.getElementById('app'));
const ui = new UI(game);
window.__game = game;
window.__ui = ui;

// evitar zoom y gestos del navegador
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('touchmove', e => { if (!e.target.closest('.screen')) e.preventDefault(); }, { passive: false });
