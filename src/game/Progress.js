import { Profile } from './Storage.js';
import { CARS } from '../cars/carData.js';

// =====================================================================
//  Progreso del jugador: nivel, liga, misiones y recompensa diaria.
// =====================================================================

// nivel según el dinero ganado en total
export function level() {
  const e = Profile.data.earned || 0;
  const lv = 1 + Math.floor(Math.sqrt(e / 6000));
  const cur = (lv - 1) ** 2 * 6000, next = lv ** 2 * 6000;
  return { lv, pct: Math.min(100, Math.round((e - cur) / (next - cur) * 100)) };
}

export const LEAGUES = [
  { min: 1, name: 'BRONCE', c1: '#e3a06a', c2: '#8a4b23' },
  { min: 5, name: 'PLATA', c1: '#f1f4f8', c2: '#8792a3' },
  { min: 10, name: 'ORO', c1: '#ffe27a', c2: '#c98a12' },
  { min: 18, name: 'DIAMANTE', c1: '#9ff3ff', c2: '#3b7bff' },
  { min: 28, name: 'LEYENDA', c1: '#ff9ad5', c2: '#a020f0' },
];
export const league = (lv = level().lv) => LEAGUES.filter(l => lv >= l.min).pop();

const st = () => Profile.stats;
const owned = () => Profile.data.owned.length;
export const MISSIONS = [
  { id: 'r1', icon: '🏁', title: 'Primera vuelta', desc: 'Termina 1 carrera', goal: 1, val: () => st().races || 0, prize: 3000 },
  { id: 'w1', icon: '🥇', title: 'Primera victoria', desc: 'Gana 1 carrera', goal: 1, val: () => st().wins || 0, prize: 6000 },
  { id: 'c100', icon: '🪙', title: 'Cazamonedas', desc: 'Recoge 100 monedas en pista', goal: 100, val: () => st().coins || 0, prize: 8000 },
  { id: 'buy', icon: '🚗', title: 'Auto nuevo', desc: 'Compra un auto en la tienda', goal: 3, val: owned, prize: 10000 },
  { id: 'r10', icon: '🛣️', title: 'Kilómetros', desc: 'Termina 10 carreras', goal: 10, val: () => st().races || 0, prize: 15000 },
  { id: 'arm', icon: '🎯', title: 'Armado', desc: 'Compra un arma en la Armería', goal: 1, val: () => (Profile.data.weapons || []).length, prize: 8000 },
  { id: 'w5', icon: '🏆', title: 'Imparable', desc: 'Gana 5 carreras', goal: 5, val: () => st().wins || 0, prize: 25000 },
  { id: 'hard', icon: '🔥', title: 'Sin piedad', desc: 'Gana una carrera en Difícil', goal: 1, val: () => st().hardWins || 0, prize: 20000 },
  { id: 'cup', icon: '👑', title: 'Campeón', desc: 'Gana un Torneo', goal: 1, val: () => st().cups || 0, prize: 40000 },
  { id: 'c500', icon: '💰', title: 'Lluvia de oro', desc: 'Recoge 500 monedas en pista', goal: 500, val: () => st().coins || 0, prize: 30000 },
  { id: 'g6', icon: '🏢', title: 'Coleccionista', desc: 'Ten 6 autos en tu garaje', goal: 6, val: owned, prize: 50000 },
  { id: 'w20', icon: '⭐', title: 'Leyenda del asfalto', desc: 'Gana 20 carreras', goal: 20, val: () => st().wins || 0, prize: 80000 },
  { id: 'all', icon: '💎', title: 'Garaje completo', desc: `Consigue los ${CARS.length} autos`, goal: CARS.length, val: owned, prize: 250000 },
];
export const missionState = m => {
  const v = Math.min(m.goal, m.val());
  const claimed = (Profile.data.claimed || []).includes(m.id);
  return { v, done: v >= m.goal, claimed, ready: v >= m.goal && !claimed };
};
export const missionsReady = () => MISSIONS.filter(m => missionState(m).ready).length;
export function claimMission(m) {
  if (!missionState(m).ready) return false;
  (Profile.data.claimed ||= []).push(m.id);
  Profile.earn(m.prize);
  return true;
}

// ---------------------------------------------------------------- recompensa diaria (7 días seguidos)
export const DAILY = [2000, 3000, 4500, 6000, 8000, 10000, 25000];
const dayKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
export function dailyInfo() {
  const d = Profile.data.daily || { last: '', streak: 0 };
  const today = dayKey();
  const yest = dayKey(new Date(Date.now() - 864e5));
  const available = d.last !== today;
  // si se saltó un día la racha vuelve a empezar
  const streak = d.last === today || d.last === yest ? d.streak : 0;
  const day = available ? streak % 7 : (streak - 1) % 7; // índice del día que toca (o el que ya se cobró)
  return { available, streak, day, prize: DAILY[available ? streak % 7 : day] };
}
export function claimDaily() {
  const info = dailyInfo();
  if (!info.available) return 0;
  Profile.data.daily = { last: dayKey(), streak: info.streak + 1 };
  Profile.earn(info.prize);
  return info.prize;
}
