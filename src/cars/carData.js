// 4 autos con estadísticas (1..5). Ver STAT_SCALE en config.js
export const CARS = [
  { id: 'rayo', name: 'Rayo', desc: 'Equilibrado en todo', stats: { speed: 3, accel: 3, handling: 3, turbo: 3 }, mass: 1.0, shape: 'sport' },
  { id: 'bala', name: 'Bala', desc: 'Velocidad punta brutal', stats: { speed: 5, accel: 2, handling: 2, turbo: 3 }, mass: 1.05, shape: 'wedge' },
  { id: 'pulga', name: 'Pulga', desc: 'Ágil y explosivo', stats: { speed: 2, accel: 5, handling: 5, turbo: 2 }, mass: 0.8, shape: 'buggy' },
  { id: 'titan', name: 'Titán', desc: 'Pesado, turbo enorme', stats: { speed: 3, accel: 2, handling: 2, turbo: 5 }, mass: 1.45, shape: 'truck' },
];

export const COLORS = [
  { name: 'Rojo', hex: 0xff3344 }, { name: 'Azul', hex: 0x2f7bff }, { name: 'Amarillo', hex: 0xffd21f },
  { name: 'Verde', hex: 0x2fdc6a }, { name: 'Rosa', hex: 0xff4fd8 }, { name: 'Naranja', hex: 0xff8a1f },
  { name: 'Blanco', hex: 0xf2f2f2 }, { name: 'Negro', hex: 0x2a2a33 },
];
