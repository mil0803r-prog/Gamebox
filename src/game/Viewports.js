// Cálculo de los viewports para 1 o 2 jugadores.
// 'rows' = uno arriba y otro abajo; 'cols' = lado a lado.
export function splitMode(setting, W, H, isTouch) {
  if (setting === 'horizontal') return 'rows';
  if (setting === 'vertical') return 'cols';
  if (isTouch) return H > W ? 'rows' : 'cols';
  return 'rows';
}

export function computeViews(n, mode, W, H) {
  if (n <= 1) return [{ x: 0, y: 0, w: W, h: H }];
  if (mode === 'rows') {
    const h = Math.floor(H / 2);
    return [{ x: 0, y: 0, w: W, h: h - 1 }, { x: 0, y: h + 1, w: W, h: H - h - 1 }];
  }
  const w = Math.floor(W / 2);
  return [{ x: 0, y: 0, w: w - 1, h: H }, { x: w + 1, y: 0, w: W - w - 1, h: H }];
}
