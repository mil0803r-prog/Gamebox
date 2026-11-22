// Utilidades compartidas de la interfaz
export const hex = n => '#' + n.toString(16).padStart(6, '0');

export const el = html => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};

export function fmtTime(t) {
  if (t === undefined || t === null || !isFinite(t)) return '--:--.--';
  t = Math.max(0, t);
  const m = Math.floor(t / 60), s = Math.floor(t % 60), c = Math.floor((t * 100) % 100);
  return `${m}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
}

export const STAT_LABELS = { speed: 'Velocidad', accel: 'Aceleración', handling: 'Manejo', turbo: 'Turbo' };
export const DIFF = ['Fácil', 'Normal', 'Difícil'];
export const THEME_GRAD = {
  city: 'linear-gradient(135deg,#1a0638 0%,#5a0f7a 55%,#ff2bd6 140%)',
  desert: 'linear-gradient(135deg,#ffcf7a 0%,#f08a3a 50%,#a83a2a 100%)',
  snow: 'linear-gradient(135deg,#e6f2ff 0%,#8fb8e8 50%,#3d5f9a 100%)',
};
export const THEME_ICON = { city: '🌃', desert: '🏜️', snow: '🏔️' };
