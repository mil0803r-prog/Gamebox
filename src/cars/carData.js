// =====================================================================
//  CATÁLOGO DE AUTOS (marcas y modelos ficticios, inspirados en estilos reales)
//  top: velocidad máxima (km/h) · zero: 0-100 km/h (s) · hp: potencia · kg: peso
//  handling / turbo: 1..10 · body: tipo de carrocería (ver bodies.js)
//  El precio se calcula según el rendimiento (ver más abajo).
// =====================================================================

const RAW = [
  // ---------------- Clase C · Calle
  { id: 'pulga',      brand: 'Pulga',   name: 'Mini',        body: 'compact',   top: 185, zero: 8.5, hp: 130,  kg: 950,  handling: 7,  turbo: 4,  wing: 'none', color: 0xffd21f, starter: true },
  { id: 'rayo',       brand: 'Rayo',    name: 'GTi',         body: 'hatch',     top: 210, zero: 7.0, hp: 220,  kg: 1250, handling: 6,  turbo: 5,  wing: 'lip',  color: 0xff3344, starter: true },
  { id: 'kaze',       brand: 'Mirai',   name: 'Kaze',        body: 'tuner',     top: 235, zero: 5.8, hp: 280,  kg: 1300, handling: 7,  turbo: 6,  wing: 'wing', color: 0xf2f2f2 },
  { id: 'raptor',     brand: 'Titán',   name: 'Raptor',      body: 'truck',     top: 205, zero: 6.4, hp: 450,  kg: 2300, handling: 3,  turbo: 8,  wing: 'none', color: 0x2a2a33 },
  { id: 'b69',        brand: 'Brutus',  name: '69',          body: 'muscle',    top: 250, zero: 5.2, hp: 420,  kg: 1650, handling: 4,  turbo: 6,  wing: 'lip',  color: 0xff8a1f },
  { id: 's4',         brand: 'Nordik',  name: 'S4',          body: 'sedan',     top: 255, zero: 4.8, hp: 450,  kg: 1700, handling: 6,  turbo: 5,  wing: 'lip',  color: 0x2f7bff },
  // ---------------- Clase B · Deportivo
  { id: 'tsubasa',    brand: 'Mirai',   name: 'Tsubasa R',   body: 'tuner',     top: 280, zero: 4.2, hp: 500,  kg: 1450, handling: 8,  turbo: 7,  wing: 'big',  color: 0x2fdc6a },
  { id: 'hellfire',   brand: 'Brutus',  name: 'Hellfire',    body: 'muscle',    top: 300, zero: 3.9, hp: 710,  kg: 1800, handling: 5,  turbo: 8,  wing: 'lip',  color: 0x14141a },
  { id: 'gte',        brand: 'Nordik',  name: 'GT-E',        body: 'gt',        top: 305, zero: 3.8, hp: 600,  kg: 1600, handling: 7,  turbo: 6,  wing: 'lip',  color: 0x9aa4b4 },
  { id: 'corsa',      brand: 'Aurelia', name: 'Corsa',       body: 'curvy',     top: 310, zero: 3.5, hp: 610,  kg: 1450, handling: 8,  turbo: 6,  wing: 'lip',  color: 0xd4141e },
  { id: 'vento',      brand: 'Taurex',  name: 'Vento',       body: 'wedge',     top: 320, zero: 3.3, hp: 640,  kg: 1500, handling: 7,  turbo: 6,  wing: 'wing', color: 0x8ad420 },
  { id: 'evolt',      brand: 'Kinetik', name: 'E-Volt',      body: 'electric',  top: 300, zero: 2.6, hp: 700,  kg: 1900, handling: 6,  turbo: 4,  wing: 'none', color: 0xe8eef6 },
  // ---------------- Clase A · Súper
  { id: 'furia',      brand: 'Aurelia', name: 'Furia 812',   body: 'gt',        top: 340, zero: 2.9, hp: 800,  kg: 1550, handling: 8,  turbo: 7,  wing: 'lip',  color: 0xc8102e },
  { id: 'tempesta',   brand: 'Taurex',  name: 'Tempesta',    body: 'wedge',     top: 345, zero: 2.8, hp: 770,  kg: 1550, handling: 7,  turbo: 7,  wing: 'wing', color: 0xff8a00 },
  { id: 'strada',     brand: 'Vulcan',  name: 'Strada',      body: 'hyper',     top: 335, zero: 2.9, hp: 720,  kg: 1400, handling: 9,  turbo: 6,  wing: 'wing', color: 0x1d4ed8 },
  { id: 'hayabusa',   brand: 'Mirai',   name: 'Hayabusa GT', body: 'tuner',     top: 330, zero: 3.0, hp: 650,  kg: 1350, handling: 9,  turbo: 8,  wing: 'big',  color: 0x7a4bff },
  { id: 'phantom',    brand: 'Nordik',  name: 'Phantom',     body: 'gt',        top: 350, zero: 2.8, hp: 820,  kg: 1650, handling: 7,  turbo: 7,  wing: 'none', color: 0x1a1a22 },
  { id: 'monza',      brand: 'Aurelia', name: 'Monza SP',    body: 'speedster', top: 355, zero: 2.7, hp: 830,  kg: 1450, handling: 8,  turbo: 7,  wing: 'none', color: 0xb5121b },
  // ---------------- Clase S · Híper
  { id: 'fulmine',    brand: 'Taurex',  name: 'Fulmine',     body: 'wedge',     top: 370, zero: 2.5, hp: 1000, kg: 1550, handling: 8,  turbo: 8,  wing: 'big',  color: 0x00b7d4 },
  { id: 'plasma',     brand: 'Kinetik', name: 'Plasma',      body: 'electric',  top: 380, zero: 1.9, hp: 1900, kg: 2100, handling: 7,  turbo: 6,  wing: 'wing', color: 0x22d3ee },
  { id: 'apex',       brand: 'Vulcan',  name: 'Apex',        body: 'hyper',     top: 390, zero: 2.3, hp: 1150, kg: 1300, handling: 10, turbo: 7,  wing: 'big',  color: 0xffd21f },
  { id: 'inferno',    brand: 'Aurelia', name: 'Inferno',     body: 'curvy',     top: 395, zero: 2.4, hp: 1200, kg: 1450, handling: 9,  turbo: 9,  wing: 'wing', color: 0xe11d2e },
  { id: 'centauro',   brand: 'Taurex',  name: 'Centauro',    body: 'wedge',     top: 410, zero: 2.3, hp: 1250, kg: 1500, handling: 8,  turbo: 9,  wing: 'big',  color: 0x3b3b46 },
  { id: 'absolut',    brand: 'Vulcan',  name: 'Absolut',     body: 'hyper',     top: 430, zero: 2.2, hp: 1600, kg: 1350, handling: 9,  turbo: 10, wing: 'big',  color: 0xf2f2f2 },
];

export const CLASSES = {
  C: { name: 'Calle', color: '#9aa4b4' },
  B: { name: 'Deportivo', color: '#2fdc6a' },
  A: { name: 'Súper', color: '#2f9bff' },
  S: { name: 'Híper', color: '#ff2bd6' },
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Índice de rendimiento 0..1
function perfIndex(c) {
  const sp = clamp((c.top - 180) / (430 - 180), 0, 1);
  const ac = clamp((8.5 - c.zero) / (8.5 - 1.9), 0, 1);
  const hd = (c.handling - 1) / 9;
  const tb = (c.turbo - 1) / 9;
  return clamp(0.5 * sp + 0.25 * ac + 0.15 * hd + 0.1 * tb, 0, 1);
}

// Precio: escala exponencial según rendimiento (redondeado a miles)
function priceOf(pi) {
  const p = 9000 * Math.pow(70, pi);
  const step = p > 100000 ? 5000 : 1000;
  return Math.round(p / step) * step;
}

export const CARS = RAW.map(c => {
  const pi = perfIndex(c);
  const cls = pi >= 0.78 ? 'S' : pi >= 0.6 ? 'A' : pi >= 0.4 ? 'B' : 'C';
  // multiplicadores físicos (1 = auto de referencia del config)
  const speedMs = 45 + clamp((c.top - 185) / (430 - 185), 0, 1) * 19; // 45..64 m/s en la pista
  const phys = {
    speed: speedMs / 52,
    accel: clamp(3.6 / c.zero, 0.62, 1.55),
    handling: 0.8 + (c.handling - 1) * 0.05,
    turbo: 0.85 + (c.turbo - 1) * 0.05,
  };
  // barras 1..10 para la interfaz
  const bars = {
    speed: Math.round(1 + 9 * clamp((c.top - 180) / 250, 0, 1)),
    accel: Math.round(1 + 9 * clamp((8.5 - c.zero) / 6.6, 0, 1)),
    handling: c.handling,
    turbo: c.turbo,
  };
  return {
    ...c, pi, cls, phys, bars,
    mass: c.kg / 1450,
    price: c.starter ? 0 : priceOf(pi),
    full: `${c.brand} ${c.name}`,
    displayScale: c.top / (speedMs * 3.6), // el velocímetro muestra km/h de catálogo
  };
}).sort((a, b) => a.price - b.price || a.pi - b.pi);

export const carById = id => CARS.find(c => c.id === id) || CARS[0];

export const COLORS = [
  { name: 'Rojo', hex: 0xd4141e }, { name: 'Azul', hex: 0x1d4ed8 }, { name: 'Amarillo', hex: 0xffc61f }, { name: 'Verde', hex: 0x22b85a },
  { name: 'Rosa', hex: 0xff4fd8 }, { name: 'Naranja', hex: 0xff7a00 }, { name: 'Blanco', hex: 0xf2f2f2 }, { name: 'Negro', hex: 0x18181e },
  { name: 'Plata', hex: 0xa8b0bc }, { name: 'Celeste', hex: 0x22d3ee }, { name: 'Morado', hex: 0x7a3bff }, { name: 'Lima', hex: 0x8ad420 },
];
