// Armas que se compran en la Armería. Disparar gasta monedas recogidas en la pista.
//  price: precio en dinero · cost: monedas por disparo · cooldown: segundos entre disparos
export const WEAPONS = [
  { id: 'laser',   name: 'Cañón láser',  icon: '🔫', price: 6000,  cost: 1,  cooldown: 0.16, color: 0xff3355,
    desc: 'Ráfagas rápidas en línea recta. Cada impacto frena al rival.' },
  { id: 'mine',    name: 'Minas',        icon: '💣', price: 10000, cost: 3,  cooldown: 0.8,  color: 0xff2020,
    desc: 'Se dejan detrás del auto. Quien las pisa da un trompo.' },
  { id: 'missile', name: 'Misil guiado', icon: '🚀', price: 18000, cost: 6,  cooldown: 1.2,  color: 0xffa020,
    desc: 'Persigue al auto de adelante y lo hace girar.' },
  { id: 'emp',     name: 'Pulso EMP',    icon: '⚡', price: 30000, cost: 10, cooldown: 3,    color: 0x40c8ff,
    desc: 'Onda alrededor del auto: frena y vacía el turbo de los cercanos.' },
];
export const weaponById = id => WEAPONS.find(w => w.id === id);
