import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/barlow-condensed/latin-800-italic.css';
import '@fontsource/barlow/latin-500.css';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/barlow/latin-700.css';
import './ui/styles/base.css';
import './ui/styles/hud.css';
import './ui/styles/menus.css';
import './ui/styles/touch.css';
import { Game } from './game/Game.js';
import { UIManager } from './ui/UIManager.js';
import { Profile } from './game/Storage.js';

const game = new Game(document.getElementById('app'));
const ui = new UIManager(game);
window.__game = game;
window.__ui = ui;
window.__profile = Profile; // útil para depurar

// evitar zoom y gestos del navegador
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('touchmove', e => { if (!e.target.closest('.screen')) e.preventDefault(); }, { passive: false });

// Service worker para jugar sin conexión (solo en el build de producción)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
