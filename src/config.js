// =====================================================================
//  CONFIGURACIÓN DE MANEJO Y JUEGO
//  Todos los valores de "feeling" están aquí para ajustarlos fácilmente.
//  Unidades: metros, segundos, m/s, radianes.
// =====================================================================

export const CONFIG = {
  // ------------------------------------------------------------ MANEJO
  handling: {
    maxSpeed: 52,            // velocidad máxima base (m/s) ≈ 187 km/h
    accel: 34,               // aceleración desde parado (m/s²)
    accelFalloff: 1.7,       // >1 = la aceleración se mantiene fuerte hasta cerca del tope
    brake: 60,               // frenado fuerte (m/s²)
    reverseAccel: 20,
    reverseMax: 15,
    coastDecel: 5,           // desaceleración al soltar el acelerador
    overSpeedDecay: 1.4,     // qué tan rápido se pierde el exceso de velocidad tras un turbo

    turnRate: 2.5,           // giro máximo (rad/s)
    turnFullSpeed: 11,       // velocidad a la que el giro está disponible al 100%
    turnHighSpeedFactor: 0.62, // multiplicador del giro a velocidad máxima
    steerResponse: 9,        // suavizado de la dirección (más alto = más directo)

    grip: 9.5,               // agarre lateral (más alto = menos deslizamiento)
    gripMomentumKeep: 0.35,  // fracción de la velocidad lateral perdida que se transforma en avance
    airControl: 0.25,        // fracción del giro disponible en el aire
    gravity: 32,

    wallBounce: 0.35,        // rebote contra paredes
    wallSpeedLoss: 0.55,     // pérdida de velocidad en choque frontal contra pared
    carRadius: 1.15,
    carBumpRestitution: 0.6, // rebote entre autos
    carBumpExtra: 5,         // empujón extra en choques entre autos (m/s)
  },

  // ------------------------------------------------------------ DERRAPE
  drift: {
    minSpeed: 13,            // velocidad mínima para derrapar
    grip: 2.4,               // agarre lateral durante el derrape
    momentumKeep: 0.75,      // conserva velocidad mientras derrapa
    baseTurn: 1.45,          // giro automático hacia el lado del derrape (rad/s)
    steerRange: 1.05,        // cuánto puede abrir/cerrar el derrape el jugador (rad/s)
    speedLoss: 0.035,        // pérdida de velocidad por segundo (fracción)
    visualAngle: 0.32,       // ángulo extra visual de la carrocería
    barChargeRate: 0.16,     // cuánto llena la barra de turbo por segundo de derrape
    // tiempos de carga del mini-turbo (s): azul, naranja, morado
    levelTimes: [1.5, 2.6, 3.8],
    // duración del mini-turbo al soltar (s) por nivel
    miniTurboTime: [0.6, 0.95, 1.35],
    miniTurboAccel: 45,      // empuje del mini-turbo (m/s²)
    miniTurboSpeedMul: 1.2,
    sparkColors: [0xfff2a8, 0x3aa8ff, 0xff8a1f, 0xc04bff],
  },

  // ------------------------------------------------------------ TURBO
  turbo: {
    drainRate: 0.42,         // barra consumida por segundo al mantener el turbo
    accel: 48,               // empujón del turbo (m/s²)
    speedMul: 1.32,          // velocidad máxima durante el turbo
    startBar: 0.25,          // barra al empezar la carrera
    padTime: 1.1,            // duración del pad de turbo en la pista (s)
    padAccel: 60,
    padSpeedMul: 1.38,
    fovAdd: 12,
    shake: 0.07,
  },

  // ------------------------------------------------------------ REBUFO
  slipstream: {
    maxDist: 30,
    minDist: 2.5,
    maxLateral: 3.2,         // qué tan alineado tienes que estar detrás del rival
    timeToActivate: 1.4,     // segundos detrás del rival para empezar a cargar
    barChargeRate: 0.28,     // carga extra de turbo por segundo
    speedMul: 1.05,          // menos resistencia del aire
  },

  // ------------------------------------------------------------ CÁMARA
  camera: {
    // cámara cercana y baja (el auto se ve grande, como en los juegos de autopista)
    distance: 4.7,
    distanceSpeedAdd: 0.9,   // se aleja con la velocidad
    height: 1.75,
    heightSpeedAdd: 0.25,
    maxStretch: 1.08,        // cuánto puede quedarse atrás la cámara (1 = pegada)
    lookAhead: 7,
    lookHeight: 1.25,
    // cámara lejana (opción en el menú)
    far: { distance: 6.8, distanceSpeedAdd: 2.4, height: 2.8, heightSpeedAdd: 0.5, lookAhead: 5, lookHeight: 1.1, maxStretch: 1.25 },
    vfar: { distance: 10.5, distanceSpeedAdd: 3, height: 4.6, heightSpeedAdd: 0.8, lookAhead: 6, lookHeight: 1.0, maxStretch: 1.3 },
    interiorFov: 74,
    fov: 66,
    fovSpeedAdd: 14,         // FOV extra a velocidad máxima
    posSmooth: 9,            // suavizado de posición (más alto = más pegada)
    yawSmooth: 6,            // suavizado de dirección
    fovSmooth: 4,
  },

  // ------------------------------------------------------------ CARRERA
  race: {
    laps: 3,
    checkpoints: 12,
    countdownStep: 0.9,      // segundos por número del semáforo
  },

  // ------------------------------------------------------------ ÍTEMS
  items: {
    respawnTime: 4,
    oilLifetime: 25,
    oilSpinTime: 1.1,
    shieldTime: 8,
    turboTime: 1.6,
  },
};

