# ⛳ Golf con el celu como palo

Juego de golf 2D (vista desde arriba) que corre todo en tu red local:

- **La compu** es la pantalla: muestra la cancha, la pelota y el resultado de cada golpe.
- **El celu** es el palo: con el giróscopo detecta **qué tan rápido** hacés el swing
  (→ distancia) y **cuánto giraste la cara del palo** en el impacto (→ si la pelota sale
  derecha, con slice o con hook).

## Cómo arrancar

```bash
cd golf
npm install
npm start
```

La consola te muestra dos direcciones:

1. **Pantalla:** abrí `http://localhost:3000` en la compu.
2. **Palo:** en el celu abrí `https://<IP-de-tu-compu>:3443/palo` (o escaneá el QR
   que aparece abajo a la izquierda de la pantalla).
   - El celu y la compu tienen que estar en **el mismo Wi-Fi**.
   - Vas a ver una advertencia de certificado: tocá *Avanzado → Continuar*. Es tu propio
     servidor; hace falta HTTPS porque los navegadores solo dan acceso a los sensores de
     movimiento en páginas seguras.
   - Tocá **Activar sensores** (en iPhone te pide permiso).

## Cómo pegarle

1. Agarrá el celu con las dos manos como si fuera el grip, con **la parte de arriba
   del celu apuntando al piso** (a la pelota).
2. Quedate quieto hasta que el celu diga **¡Pegale!** (vibra).
3. Hacé el swing: backswing, y después bajá rápido. Lo que cuenta es la velocidad
   del **downswing**.
4. Si la pelota se te va siempre para el lado contrario al que esperás, activá
   *Soy zurdo / invertir efecto* en el celu.

Desde el celu también podés apuntar (◀ ▶) y cambiar de palo. Si la potencia te
queda muy corta o muy larga, mové **Sensibilidad** en la pantalla: es la velocidad
de giro (°/s) que equivale a un golpe al 100 %.

**Sin celu:** en la compu, `←` `→` apuntar, `↑` `↓` palo, mantené `Espacio` y soltá
para pegar (sirve para probar).

## Cómo funciona la detección

- El celu manda la velocidad angular del giróscopo (`devicemotion.rotationRate`).
- El swing empieza cuando el giro supera 140 °/s. El primer giro fuerte es el
  backswing; el **downswing** se reconoce porque gira en sentido contrario, y su
  pico de velocidad es el "impacto".
- **Potencia** = pico del downswing comparado con la sensibilidad. La velocidad de
  la cabeza que se muestra es una estimación (pico × 1,6 m de brazo + palo).
- **Dirección**: se integra el giróscopo desde la posición quieta (address) hasta el
  impacto y se calcula cuánto giró el celu alrededor de su eje largo (el "shaft").
  Eso es la cara del palo: abierta → la pelota sale y curva a la derecha (slice),
  cerrada → a la izquierda (hook).

## Archivos

- `server.js` — servidor HTTP (3000) + HTTPS (3443, certificado autofirmado que se
  genera solo en `.cert/`) + WebSocket que reenvía mensajes entre celu y pantalla.
- `public/screen.html`, `public/game.js` — la pantalla y el juego (física, 3 hoyos,
  viento, agua, bunkers, árboles, tarjeta).
- `public/club.html` — el palo (detector de swing).

Puertos configurables con `PORT` y `HTTPS_PORT`.

## Ideas para seguir

- Pasar a 3D (Three.js) con cámara detrás de la pelota.
- Calibración guiada del swing de cada jugador.
- Varios jugadores por turnos (ya se pueden conectar varios celus).
- Pendientes en el green.
