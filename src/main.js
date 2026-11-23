import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/barlow-condensed/latin-800-italic.css';
import '@fontsource/barlow-condensed/latin-700-italic.css';
import '@fontsource/barlow/latin-500.css';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/barlow/latin-700.css';
import './ui/styles/base.css';
import './ui/styles/hud.css';
import './ui/styles/menus.css';
import './ui/styles/touch.css';
import './ui/styles/theme.css';
import './ui/styles/home.css';
import { Game } from './game/Game.js';
import { UIManager } from './ui/UIManager.js';
import { Profile } from './game/Storage.js';

// Si algo falla al arrancar, mostrar el error en pantalla (en vez de quedar en negro)
function showFatal(err) {
  if (document.getElementById('fatal')) return;
  const msg = String((err && (err.message || err.reason || err)) || 'Error desconocido');
  const webgl = /webgl|context|gpu/i.test(msg);
  const d = document.createElement('div');
  d.id = 'fatal';
  d.style.cssText = 'position:fixed;inset:0;z-index:99;display:flex;align-items:center;justify-content:center;padding:24px;background:#05070d;color:#fff;font:16px system-ui,sans-serif;text-align:center';
  d.innerHTML = `<div style="max-width:560px"><h1 style="font-size:28px;margin:0 0 10px">Turbo Duelo no pudo iniciar</h1>
    <p style="opacity:.8">${webgl ? 'Tu navegador no pudo activar los gráficos 3D (WebGL). Activa la <b>aceleración por hardware</b> en la configuración del navegador o prueba con Chrome/Edge actualizado.' : 'Recarga la página con <b>Ctrl + Shift + R</b>. Si sigue igual, envía este mensaje:'}</p>
    <pre style="white-space:pre-wrap;background:#111826;padding:10px;font-size:13px;text-align:left">${msg.replace(/</g, '&lt;')}</pre>
    <button onclick="location.reload()" style="font:600 16px system-ui;padding:10px 20px;margin-top:8px;cursor:pointer">Recargar</button></div>`;
  document.body.appendChild(d);
}
let game, ui;
try {
  game = new Game(document.getElementById('app'));
  ui = new UIManager(game);
  window.__game = game;
  window.__ui = ui;
  window.__profile = Profile; // útil para depurar
} catch (e) {
  console.error(e);
  showFatal(e);
}
// errores tempranos (antes de que aparezca el menú) también se muestran
window.addEventListener('error', e => { if (!window.__ui) showFatal(e.error || e.message); });
window.addEventListener('unhandledrejection', e => { if (!window.__ui) showFatal(e.reason); });

// evitar zoom y gestos del navegador
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('touchmove', e => { if (!e.target.closest('.screen')) e.preventDefault(); }, { passive: false });

// Service worker para jugar sin conexión (solo en el build de producción)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
