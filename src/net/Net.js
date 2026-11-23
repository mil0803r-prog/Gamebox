import { Peer } from 'peerjs';

// =====================================================================
//  Multijugador online (WebRTC con PeerJS). Uno crea la sala y le da el
//  código a los demás; los datos van directo entre los equipos (P2P).
//  Topología en estrella: el anfitrión reenvía los mensajes de cada
//  invitado a los demás. Cada equipo simula SU auto (el anfitrión también
//  los de la IA) y manda su estado 20 veces por segundo; los otros autos
//  se dibujan interpolando esos estados con ~120 ms de retraso.
// =====================================================================
const PREFIX = 'gamebox-turbo-duelo-';
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const MAX_PLAYERS = 4;
const SEND_HZ = 20;
const DELAY = 0.12; // s de retraso para interpolar suave

// servidor de señalización: el gratuito de PeerJS, o uno propio con ?peer=host:puerto
function peerOptions() {
  const q = new URLSearchParams(location.search).get('peer');
  const base = { debug: 0, config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }] } };
  if (!q) return base;
  const [host, port] = q.split(':');
  return { ...base, host, port: +port || 9000, path: '/', secure: location.protocol === 'https:' && host !== 'localhost' };
}

const lerpAng = (a, b, t) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * t; };

export class NetSession {
  constructor() {
    this.peer = null;
    this.conns = new Map(); // id → DataConnection
    this.isHost = false;
    this.code = '';
    this.myId = '';
    this.players = []; // [{ id, name, car, color }]
    this.settings = { track: 0, laps: 3, rivals: 0, difficulty: 1 };
    this.handlers = {};
    this.buffers = new Map(); // índice de corredor → [{t, s}]
    this.sendT = 0;
    this.closed = false;
  }

  on(type, fn) { (this.handlers[type] ||= []).push(fn); return this; }
  emit(type, data) { (this.handlers[type] || []).forEach(f => f(data)); }

  // ------------------------------------------------------------ conexión
  host(me) {
    this.isHost = true;
    return new Promise((resolve, reject) => {
      const tryCode = (left) => {
        this.code = Array.from({ length: 4 }, () => ALPHA[(Math.random() * ALPHA.length) | 0]).join('');
        const peer = new Peer(PREFIX + this.code, peerOptions());
        peer.on('open', id => {
          this.peer = peer; this.myId = id;
          this.players = [{ ...me, id }];
          peer.on('connection', c => this.acceptGuest(c));
          resolve(this.code);
        });
        peer.on('error', err => {
          if (err.type === 'unavailable-id' && left > 0) { peer.destroy(); tryCode(left - 1); return; }
          if (!this.peer) reject(err); else this.emit('error', err);
        });
        peer.on('disconnected', () => { if (!this.closed) peer.reconnect(); });
      };
      tryCode(3);
    });
  }

  join(code, me) {
    this.isHost = false;
    this.code = code.toUpperCase().trim();
    return new Promise((resolve, reject) => {
      const peer = new Peer(peerOptions());
      let done = false;
      const fail = err => { if (!done) { done = true; reject(err); } else this.emit('error', err); };
      const timer = setTimeout(() => fail({ type: 'timeout' }), 15000);
      peer.on('open', id => {
        this.peer = peer; this.myId = id;
        const c = peer.connect(PREFIX + this.code, { reliable: true, serialization: 'json', metadata: me });
        c.on('open', () => {
          this.conns.set(c.peer, c);
          c.send({ t: 'hello', me });
        });
        c.on('data', m => {
          if (!done && m.t === 'lobby') { done = true; clearTimeout(timer); resolve(); }
          if (m.t === 'full') { clearTimeout(timer); fail({ type: 'full' }); return; }
          this.onMessage(m, c.peer);
        });
        c.on('close', () => { if (!this.closed) this.emit('hostLeft'); });
        c.on('error', fail);
      });
      peer.on('error', err => fail(err.type === 'peer-unavailable' ? { type: 'no-room' } : err));
    });
  }

  acceptGuest(c) {
    c.on('open', () => {
      if (this.players.length >= MAX_PLAYERS || this.inRace) { c.send({ t: 'full' }); setTimeout(() => c.close(), 300); return; }
      this.conns.set(c.peer, c);
    });
    c.on('data', m => {
      if (m.t === 'hello') {
        if (!this.players.find(p => p.id === c.peer)) this.players.push({ ...m.me, id: c.peer });
        this.broadcastLobby();
        return;
      }
      // reenviar a los demás invitados
      if (m.t === 's' || m.t === 'fin') for (const [id, o] of this.conns) if (id !== c.peer && o.open) o.send(m);
      this.onMessage(m, c.peer);
    });
    c.on('close', () => this.dropPeer(c.peer));
    c.on('error', () => this.dropPeer(c.peer));
  }

  dropPeer(id) {
    if (!this.conns.has(id)) return;
    this.conns.delete(id);
    this.players = this.players.filter(p => p.id !== id);
    if (this.isHost) { this.broadcast({ t: 'left', id }); this.broadcastLobby(); }
    this.emit('left', id);
  }

  send(m) { for (const c of this.conns.values()) if (c.open) c.send(m); }
  broadcast(m) { this.send(m); }
  broadcastLobby() { this.broadcast({ t: 'lobby', players: this.players, settings: this.settings }); this.emit('lobby'); }

  // cambios de auto / ajustes
  updateMe(me) {
    const p = this.players.find(x => x.id === this.myId);
    if (p) Object.assign(p, me);
    if (this.isHost) this.broadcastLobby(); else this.send({ t: 'pick', me });
  }
  updateSettings(s) { Object.assign(this.settings, s); if (this.isHost) this.broadcastLobby(); }

  onMessage(m, from) {
    switch (m.t) {
      case 'lobby': this.players = m.players; this.settings = m.settings; this.emit('lobby'); break;
      case 'pick': if (this.isHost) { const p = this.players.find(x => x.id === from); if (p) Object.assign(p, m.me); this.broadcastLobby(); } break;
      case 'start': this.inRace = true; this.emit('start', m); break;
      case 'toLobby': this.inRace = false; this.emit('toLobby'); break;
      case 'left': this.emit('left', m.id); break;
      case 's': this.onState(m); break;
      case 'fin': this.emit('fin', m); break;
    }
  }

  // ------------------------------------------------------------ carrera
  // el anfitrión arma la lista de corredores (jugadores + IA) y la manda a todos
  startRace(aiEntries) {
    const entries = this.players.map(p => ({ owner: p.id, kind: 'human', name: p.name, car: p.car, color: p.color }));
    for (const a of aiEntries) entries.push({ owner: this.myId, kind: 'ai', ...a });
    const m = { t: 'start', track: this.settings.track, laps: this.settings.laps, difficulty: this.settings.difficulty, entries };
    this.inRace = true;
    this.broadcast(m);
    this.emit('start', m);
  }
  backToLobby() { this.inRace = false; this.broadcast({ t: 'toLobby' }); this.emit('toLobby'); }

  attach(race) {
    this.race = race;
    race.net = this;
    this.buffers.clear();
    this.sendT = 0;
    this.t0 = performance.now();
  }

  now() { return (performance.now() - this.t0) / 1000; }

  onState(m) {
    if (!this.race) return;
    const t = this.now();
    for (const [i, ...s] of m.c) {
      const r = this.race.racers[i];
      if (!r || !r.remote) continue;
      let b = this.buffers.get(i);
      if (!b) this.buffers.set(i, b = []);
      // tiempo del emisor convertido a reloj local (se ajusta suave con la llegada)
      const ts = m.ts;
      if (r.offset === undefined) r.offset = t - ts;
      else r.offset += ((t - ts) - r.offset) * 0.05;
      b.push({ t: ts + r.offset, s });
      if (b.length > 30) b.shift();
    }
  }

  // aplica a cada auto remoto su estado interpolado (llamado por Race antes de la física)
  applyRemote(race) {
    const t = this.now() - DELAY;
    for (const r of race.racers) {
      if (!r.remote) continue;
      const b = this.buffers.get(r.index);
      if (!b || !b.length) continue;
      let a = b[0], c = b[b.length - 1], k = 0;
      if (t <= a.t) { c = a; k = 0; }
      else if (t >= c.t) { a = c; k = Math.min(0.25, t - c.t); } // extrapola un poco con la velocidad
      else {
        for (let j = 0; j < b.length - 1; j++) if (b[j].t <= t && b[j + 1].t >= t) { a = b[j]; c = b[j + 1]; break; }
        k = (t - a.t) / Math.max(1e-4, c.t - a.t);
      }
      const A = a.s, C = c.s;
      let st;
      if (a === c) {
        st = { x: A[0] + A[4] * k, y: A[1], z: A[2] + A[5] * k, h: A[3], vx: A[4], vz: A[5], vf: A[6], st: A[7], fl: A[8] };
      } else {
        const L = (i) => A[i] + (C[i] - A[i]) * k;
        st = { x: L(0), y: L(1), z: L(2), h: lerpAng(A[3], C[3], k), vx: L(4), vz: L(5), vf: L(6), st: L(7), fl: k < 0.5 ? A[8] : C[8] };
      }
      r.car.applyNet(st);
    }
  }

  // manda el estado de los autos que simula este equipo
  tick(dt, race) {
    this.sendT += dt;
    if (this.sendT < 1 / SEND_HZ) return;
    this.sendT = 0;
    const c = race.racers.filter(r => !r.remote).map(r => [r.index, ...r.car.netState()]);
    if (c.length) this.send({ t: 's', ts: Math.round(this.now() * 1000) / 1000, c });
  }

  sendFinish(r) { this.send({ t: 'fin', i: r.index, time: r.finishTime, laps: r.lapTimes }); }

  close() {
    this.closed = true;
    for (const c of this.conns.values()) try { c.close(); } catch { /* */ }
    this.conns.clear();
    try { this.peer && this.peer.destroy(); } catch { /* */ }
    this.peer = null;
  }
}

export function netErrorText(e) {
  const t = e && e.type;
  if (t === 'no-room') return 'No existe una sala con ese código. Revisa las letras.';
  if (t === 'full') return 'La sala está llena o la carrera ya empezó.';
  if (t === 'timeout') return 'No se pudo conectar (tiempo agotado). Revisa tu conexión.';
  if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') return 'Sin conexión con el servidor de salas. Revisa tu Internet.';
  if (t === 'browser-incompatible') return 'Tu navegador no soporta juego en red (WebRTC).';
  return 'Error de conexión' + (t ? ` (${t})` : '') + '.';
}
