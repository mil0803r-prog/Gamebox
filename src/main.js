import './ui/styles/base.css';
import './ui/styles/hud.css';
import './ui/styles/menus.css';
import './ui/styles/touch.css';
import { Game } from './game/Game.js';
import { UIManager } from './ui/UIManager.js';

const game = new Game(document.getElementById('app'));
const ui = new UIManager(game);
window.__game = game;
window.__ui = ui;

// evitar zoom y gestos del navegador
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('touchmove', e => { if (!e.target.closest('.screen')) e.preventDefault(); }, { passive: false });

// Service worker para jugar sin conexión (solo en el build de producción)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
