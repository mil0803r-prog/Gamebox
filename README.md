# Turbo Duelo 🏁

Juego de carreras arcade 3D para 2 jugadores en pantalla dividida (o 1 jugador contra la IA).
Corre en el navegador (PC y celular), hecho con **Vite + Three.js**, sin motores pesados ni archivos externos.

## Ejecutar

```bash
npm install
npm run dev        # abre http://localhost:5173 (también accesible desde el celular en la misma red)
```

## Publicar

```bash
npm run build      # genera la carpeta dist/
npm run preview    # prueba local del build
```

Sube **el contenido de `dist/`** a cualquier hosting estático (Netlify, Vercel, GitHub Pages, Cloudflare Pages, Firebase Hosting, un servidor Apache/Nginx…).
Usa rutas relativas, así que funciona en la raíz o en una subcarpeta. Tras la primera carga, un service worker guarda todo y el juego funciona **sin conexión** (requiere HTTPS, o `localhost`).

## Controles

| | Jugador 1 | Jugador 2 |
|---|---|---|
| Dirección / acelerar / frenar | W A S D | Flechas |
| Derrape | Shift izq. | Ctrl der. |
| Turbo | Espacio | Enter |
| Ítem (modo ítems) | E / Q | Shift der. / Num 0 |
| Pausa | Esc / P | Esc / P |

**Mandos** (Gamepad API, hasta 2): stick/cruceta = dirección, A/RT = acelerar, X/LT = frenar, RB = derrape, B = turbo, LB/Y = ítem, Start = pausa.

**Celular (pensado para horizontal):** si el celular está en vertical aparece un aviso para girarlo, y al empezar la carrera se intenta pantalla completa en horizontal. Cada jugador usa su mitad de la pantalla (◀ ▶, derrape, turbo, freno). El acelerador es automático o con botón (Opciones). Multitouch real para que jueguen los dos a la vez.

**Inclinar para conducir (1 jugador):** en Opciones → Dirección en celular → *Inclinar*. Giras el celular como un volante; el botón CENTRAR recalibra. Hay sensibilidad (baja/media/alta) e inversión. Requiere HTTPS (tu sitio publicado) y un celular con giroscopio; en iPhone pide permiso.

## Mecánicas

- **Derrape:** mantén el botón de derrape girando. Llena la barra de turbo. A los 1.5 s las chispas se vuelven azules, luego naranjas y moradas: al soltar das un **mini-turbo**. Chocar con una pared o saltar cancela la carga.
- **Turbo:** gasta la barra para un empujón fuerte (llamas, líneas de velocidad, FOV más amplio y vibración de cámara).
- **Rebufo:** ve detrás del rival un par de segundos para cargar turbo extra (líneas de viento).
- **Pads de turbo**, **rampas** y **atajos** (camino amarillo en el mini-mapa) en cada pista.
- **Modo ítems** (opcional): turbo extra, mancha de aceite y escudo.

## Autos y concesionario

- **24 autos** de marcas ficticias inspiradas en estilos reales (superdeportivo italiano curvo y en cuña, hiperautos, GT, muscle, japoneses, eléctricos, pickup), en 4 clases: **C Calle, B Deportivo, A Súper, S Híper**.
- Cada auto tiene velocidad máxima, 0-100 km/h, potencia, peso, manejo y turbo; el **precio sube según el rendimiento** (de gratis a $560.000).
- Empiezas con 2 autos y $25.000. Ganas dinero en cada carrera según el puesto, las vueltas y la dificultad (+bonos por récord) y compras en el **Concesionario**.
- Los rivales de la IA usan autos de rendimiento parecido al tuyo (más fuertes en Difícil).
- El catálogo y la fórmula de precios están en `src/cars/carData.js`; las formas de carrocería en `src/cars/bodies.js`.

## Ajustar el manejo

Todos los valores de agarre, aceleración, giro, derrape, turbo, rebufo y cámara están en **`src/config.js`**.

## Estructura

```
src/
  config.js              valores de manejo y juego
  main.js                arranque
  game/                  Game (bucle y carrera), Race, CameraRig, DemoCamera, Viewports,
                         RaceFeedback, Effects, AI, Items, Quality, Storage
  cars/                  datos de autos, modelos low-poly (perfil extruido), física
  tracks/                datos de pistas, geometría, escenarios, decoración junto a la pista, texturas
  ui/UIManager.js        cambio de pantallas y navegación con teclado/mando
  ui/screens/            MainMenu, CarSelect, TrackSelect, PauseMenu, Results, Options, Records, Controls
  ui/hud/                HUD por jugador, mini-mapa, guía de teclas
  ui/components/         vista previa 3D del auto
  ui/styles/             base, hud, menus, touch
  audio/                 motor, efectos y música (Web Audio API)
  input/                 teclado, mandos y controles táctiles
```

La guía de teclas en pantalla (PC) se puede ocultar en **Opciones → Mostrar teclas en pantalla**.
