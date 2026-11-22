// Formas de carrocería paramétricas.
// Cada perfil se define a lo largo del auto con u ∈ [0 (cola) .. 1 (nariz)]:
//   top:  altura del techo/capó/maletero (m)      belt: línea de cintura (donde empieza el vidrio)
//   hw:   factor de medio ancho                   cabin: [u0, u1] zona con vidrio
//   n:    redondez de los costados (2 = redondo, 5 = anguloso)   tumble: ancho del techo respecto a la cintura
//   wheels: [uTrasera, uDelantera], r: radio de rueda, clear: altura libre al piso
export const BODIES = {
  // Superdeportivo en cuña, estilo "toro" italiano: anguloso, muy bajo
  wedge: {
    L: 4.6, W: 2.06, n: 5, tumble: 0.62, clear: 0.12, r: 0.36, wheels: [0.2, 0.79], track: 0.84,
    top: [[0, 0.64], [0.07, 0.96], [0.26, 1.06], [0.42, 1.15], [0.55, 1.15], [0.72, 0.8], [0.86, 0.64], [1, 0.4]],
    belt: [[0, 0.62], [0.26, 0.88], [0.42, 0.9], [0.72, 0.78], [0.86, 0.62], [1, 0.4]],
    hw: [[0, 0.9], [0.1, 1], [0.8, 0.98], [0.95, 0.9], [1, 0.8]],
    cabin: [0.4, 0.73], lights: 'slim', tails: 'strip', intakes: true, engineCover: true,
  },
  // Superdeportivo curvo de motor central, estilo italiano clásico
  curvy: {
    L: 4.55, W: 1.98, n: 2.7, tumble: 0.66, clear: 0.13, r: 0.36, wheels: [0.2, 0.79], track: 0.83,
    top: [[0, 0.7], [0.08, 0.98], [0.3, 1.04], [0.42, 1.17], [0.55, 1.17], [0.68, 0.9], [0.82, 0.72], [0.95, 0.55], [1, 0.4]],
    belt: [[0, 0.68], [0.3, 0.9], [0.42, 0.92], [0.68, 0.86], [0.82, 0.7], [1, 0.4]],
    hw: [[0, 0.86], [0.12, 1], [0.3, 0.94], [0.5, 0.92], [0.78, 1], [0.95, 0.9], [1, 0.78]],
    cabin: [0.4, 0.69], lights: 'slim', tails: 'round', intakes: true,
  },
  // Gran turismo de motor delantero: capó largo, cabina atrasada
  gt: {
    L: 4.7, W: 1.98, n: 2.9, tumble: 0.68, clear: 0.13, r: 0.37, wheels: [0.19, 0.8], track: 0.83,
    top: [[0, 0.76], [0.07, 0.96], [0.2, 1.04], [0.31, 1.2], [0.45, 1.25], [0.56, 1.1], [0.63, 0.92], [0.86, 0.82], [1, 0.56]],
    belt: [[0, 0.74], [0.2, 0.95], [0.31, 0.95], [0.56, 0.9], [0.63, 0.88], [1, 0.56]],
    hw: [[0, 0.88], [0.12, 1], [0.4, 0.95], [0.8, 1], [1, 0.8]],
    cabin: [0.2, 0.63], lights: 'slim', tails: 'round', hoodVent: true,
  },
  // Hiperauto: muy largo y bajo, aleta trasera
  hyper: {
    L: 4.8, W: 2.06, n: 3.6, tumble: 0.56, clear: 0.1, r: 0.37, wheels: [0.19, 0.8], track: 0.84,
    top: [[0, 0.6], [0.05, 0.94], [0.3, 1.0], [0.42, 1.1], [0.55, 1.1], [0.7, 0.75], [0.88, 0.55], [1, 0.33]],
    belt: [[0, 0.58], [0.3, 0.84], [0.42, 0.86], [0.7, 0.72], [0.88, 0.54], [1, 0.33]],
    hw: [[0, 0.92], [0.1, 1], [0.35, 0.9], [0.55, 0.88], [0.8, 1], [1, 0.75]],
    cabin: [0.42, 0.71], lights: 'slim', tails: 'strip', intakes: true, fin: true,
  },
  // Eléctrico deportivo: liso, techo tipo fastback
  electric: {
    L: 4.65, W: 1.98, n: 2.4, tumble: 0.7, clear: 0.13, r: 0.37, wheels: [0.18, 0.8], track: 0.83,
    top: [[0, 0.78], [0.1, 0.96], [0.25, 1.12], [0.45, 1.27], [0.6, 1.16], [0.72, 0.9], [0.9, 0.72], [1, 0.55]],
    belt: [[0, 0.74], [0.25, 0.9], [0.6, 0.88], [0.72, 0.84], [1, 0.55]],
    hw: [[0, 0.9], [0.12, 1], [0.85, 0.98], [1, 0.82]],
    cabin: [0.22, 0.73], lights: 'slim', tails: 'strip',
  },
  // Speedster sin techo
  speedster: {
    L: 4.55, W: 1.98, n: 2.7, tumble: 0.7, clear: 0.13, r: 0.36, wheels: [0.2, 0.79], track: 0.83,
    top: [[0, 0.7], [0.1, 0.97], [0.34, 1.02], [0.46, 0.92], [0.58, 0.92], [0.63, 1.04], [0.68, 0.86], [0.84, 0.7], [1, 0.42]],
    belt: [[0, 0.68], [0.34, 0.92], [0.46, 0.9], [0.62, 0.88], [0.7, 0.84], [0.84, 0.68], [1, 0.42]],
    hw: [[0, 0.86], [0.12, 1], [0.5, 0.92], [0.78, 1], [1, 0.78]],
    cabin: [0.6, 0.665], lights: 'slim', tails: 'round', intakes: true, humps: true,
  },
  // Coupé japonés preparado
  tuner: {
    L: 4.45, W: 1.88, n: 3.1, tumble: 0.72, clear: 0.13, r: 0.35, wheels: [0.18, 0.81], track: 0.84,
    top: [[0, 0.86], [0.08, 1.0], [0.2, 1.08], [0.31, 1.32], [0.55, 1.36], [0.68, 1.0], [0.82, 0.86], [1, 0.62]],
    belt: [[0, 0.83], [0.2, 0.98], [0.55, 0.96], [0.68, 0.92], [1, 0.62]],
    hw: [[0, 0.92], [0.1, 1], [0.9, 1], [1, 0.86]],
    cabin: [0.22, 0.69], lights: 'slim', tails: 'quad', hoodVent: true,
  },
  // Muscle car americano: cuadrado, capó con toma de aire
  muscle: {
    L: 4.8, W: 2.0, n: 4.2, tumble: 0.74, clear: 0.15, r: 0.38, wheels: [0.18, 0.8], track: 0.83,
    top: [[0, 0.96], [0.12, 1.02], [0.25, 1.06], [0.36, 1.3], [0.55, 1.32], [0.65, 1.05], [0.8, 1.0], [1, 0.86]],
    belt: [[0, 0.93], [0.25, 1.02], [0.6, 1.0], [1, 0.86]],
    hw: [[0, 0.96], [0.08, 1], [0.92, 1], [1, 0.92]],
    cabin: [0.27, 0.66], lights: 'round', tails: 'strip', scoop: true,
  },
  // Sedán deportivo
  sedan: {
    L: 4.8, W: 1.9, n: 3.3, tumble: 0.74, clear: 0.15, r: 0.36, wheels: [0.18, 0.79], track: 0.83,
    top: [[0, 0.96], [0.1, 1.08], [0.22, 1.12], [0.33, 1.42], [0.6, 1.45], [0.72, 1.05], [0.86, 0.95], [1, 0.72]],
    belt: [[0, 0.93], [0.22, 1.06], [0.62, 1.02], [0.72, 1.0], [1, 0.72]],
    hw: [[0, 0.93], [0.1, 1], [0.9, 1], [1, 0.86]],
    cabin: [0.22, 0.73], lights: 'slim', tails: 'strip',
  },
  // Compacto deportivo (hatchback)
  hatch: {
    L: 4.15, W: 1.84, n: 3.2, tumble: 0.76, clear: 0.15, r: 0.34, wheels: [0.16, 0.82], track: 0.84,
    top: [[0, 1.12], [0.05, 1.42], [0.15, 1.5], [0.55, 1.5], [0.7, 1.08], [0.86, 0.98], [1, 0.76]],
    belt: [[0, 1.0], [0.15, 1.02], [0.6, 0.98], [0.72, 0.97], [1, 0.76]],
    hw: [[0, 0.94], [0.08, 1], [0.92, 1], [1, 0.88]],
    cabin: [0.05, 0.71], lights: 'slim', tails: 'quad',
  },
  // Mini urbano
  compact: {
    L: 3.65, W: 1.74, n: 2.6, tumble: 0.8, clear: 0.15, r: 0.33, wheels: [0.15, 0.84], track: 0.85,
    top: [[0, 1.05], [0.05, 1.4], [0.55, 1.48], [0.72, 1.05], [0.88, 0.95], [1, 0.76]],
    belt: [[0, 0.95], [0.6, 0.95], [0.72, 0.93], [1, 0.76]],
    hw: [[0, 0.95], [0.08, 1], [0.92, 1], [1, 0.9]],
    cabin: [0.05, 0.73], lights: 'round', tails: 'round',
  },
  // Pickup todoterreno
  truck: {
    L: 5.1, W: 2.12, n: 4.6, tumble: 0.8, clear: 0.34, r: 0.46, wheels: [0.17, 0.79], track: 0.86,
    top: [[0, 1.24], [0.41, 1.24], [0.43, 1.86], [0.62, 1.9], [0.69, 1.46], [0.73, 1.42], [1, 1.26]],
    belt: [[0, 1.22], [0.41, 1.3], [0.69, 1.3], [1, 1.26]],
    hw: [[0, 0.97], [0.05, 1], [0.95, 1], [1, 0.94]],
    cabin: [0.42, 0.7], lights: 'square', tails: 'quad', scoop: true, bed: true,
  },
};
