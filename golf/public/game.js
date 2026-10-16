// Golf 2D (vista desde arriba). Unidades del mundo: metros.
// x hacia la derecha, y hacia abajo (como el canvas). El tee está abajo y el
// green arriba. La altura de la pelota es z.
(() => {
  'use strict';

  const G = 9.8;
  const SIM_SPEED = 1.7;   // el vuelo corre un poco más rápido que la realidad
  const CUP_R = 0.11;      // radio de captura del hoyo (m)
  const LEVER_M = 1.6;     // brazo + palo, para estimar la velocidad de la cabeza

  // ---- Palos ---------------------------------------------------------------
  const CLUBS = [
    { name: 'Driver', carry: 230, loft: 13 },
    { name: 'Madera 3', carry: 205, loft: 15 },
    { name: 'Hierro 5', carry: 170, loft: 21 },
    { name: 'Hierro 7', carry: 145, loft: 27 },
    { name: 'Hierro 9', carry: 120, loft: 34 },
    { name: 'Wedge', carry: 85, loft: 45 },
    { name: 'Sand wedge', carry: 60, loft: 55 },
    { name: 'Putter', carry: 30, loft: 0, putter: true },
  ];
  for (const c of CLUBS) {
    if (!c.putter) c.v0 = Math.sqrt((c.carry * G) / Math.sin((2 * c.loft * Math.PI) / 180));
  }
  const PUTTER = CLUBS.length - 1;

  // ---- Terrenos ------------------------------------------------------------
  // bounce: rebote vertical · keep: cuánto conserva de velocidad horizontal al picar
  // decel: frenado rodando (m/s²) · lie: factor de distancia al pegar desde ahí
  const TERRAIN = {
    tee:     { name: 'Tee',     bounce: 0.35, keep: 0.65, decel: 2.2, lie: 1 },
    fairway: { name: 'Fairway', bounce: 0.35, keep: 0.65, decel: 2.2, lie: 1 },
    rough:   { name: 'Rough',   bounce: 0.2,  keep: 0.45, decel: 5.5, lie: 0.82 },
    fringe:  { name: 'Antegreen', bounce: 0.3, keep: 0.6, decel: 1.6, lie: 1 },
    green:   { name: 'Green',   bounce: 0.3,  keep: 0.6,  decel: 0.9, lie: 1 },
    sand:    { name: 'Bunker',  bounce: 0.05, keep: 0.15, decel: 12,  lie: 0.6 },
    water:   { name: 'Agua' },
    oob:     { name: 'Fuera de límites' },
  };

  // ---- Hoyos ---------------------------------------------------------------
  const HOLES = [
    {
      par: 4,
      tee: [0, 0], pin: [28, -322],
      bounds: [-90, -375, 115, 30],
      fairway: { w: 34, pts: [[0, -25], [0, -170], [12, -250], [26, -300]] },
      green: [28, -322, 17, 13],
      bunkers: [[-21, -205, 10, 6, 0.3], [54, -318, 7, 5, 0.4], [10, -341, 9, 4, -0.2], [32, -238, 8, 5, 0]],
      water: [],
      trees: [[-45, -60, 7], [-52, -110, 8], [-44, -150, 6], [-55, -250, 9], [42, -40, 7], [50, -100, 8],
              [46, -160, 6], [68, -210, 9], [-10, -300, 7], [-30, -330, 8], [70, -350, 7]],
    },
    {
      par: 3,
      tee: [0, 0], pin: [-12, -152],
      bounds: [-85, -205, 75, 30],
      fairway: { w: 24, pts: [[-10, -112], [-11, -132]] },
      green: [-12, -152, 15, 12],
      bunkers: [[9, -162, 6, 5, 0.5], [-31, -146, 5, 8, 0.2], [-14, -171, 9, 3.5, 0]],
      water: [[-6, -72, 40, 24, 0.15]],
      trees: [[-55, -20, 8], [45, -30, 7], [-60, -120, 9], [40, -135, 8], [-45, -185, 7], [28, -190, 7]],
    },
    {
      par: 5,
      tee: [0, 0], pin: [-150, -442],
      bounds: [-225, -500, 95, 30],
      fairway: { w: 36, pts: [[0, -25], [0, -220], [-35, -310], [-95, -385], [-138, -420]] },
      green: [-150, -442, 16, 13],
      bunkers: [[26, -238, 10, 7, 0.2], [-122, -450, 6, 8, 0.1], [-160, -418, 8, 4, 0], [-30, -260, 7, 5, 0]],
      water: [[-75, -235, 34, 46, 0.4], [-185, -470, 18, 12, 0]],
      trees: [[45, -60, 8], [-40, -70, 7], [50, -140, 9], [-38, -150, 7], [48, -300, 9], [20, -360, 8],
              [-40, -420, 8], [-90, -450, 7], [-200, -400, 9], [-170, -360, 7], [-130, -310, 8], [-115, -480, 7]],
    },
  ];

  // ---- Utilidades de geometría --------------------------------------------
  function inEllipse(px, py, e) {
    const [cx, cy, rx, ry, rot = 0] = e;
    const c = Math.cos(-rot), s = Math.sin(-rot);
    const dx = px - cx, dy = py - cy;
    const x = dx * c - dy * s, y = dx * s + dy * c;
    return (x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1;
  }
  function distToSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const deg = (r) => (r * 180) / Math.PI;
  const rad = (d) => (d * Math.PI) / 180;

  function terrainAt(hole, x, y) {
    const [x0, y0, x1, y1] = hole.bounds;
    if (x < x0 || x > x1 || y < y0 || y > y1) return 'oob';
    for (const w of hole.water) if (inEllipse(x, y, w)) return 'water';
    for (const b of hole.bunkers) if (inEllipse(x, y, b)) return 'sand';
    const [gx, gy, grx, gry] = hole.green;
    if (inEllipse(x, y, hole.green)) return 'green';
    if (inEllipse(x, y, [gx, gy, grx + 3, gry + 3])) return 'fringe';
    if (Math.abs(x - hole.tee[0]) < 5 && Math.abs(y - hole.tee[1]) < 4) return 'tee';
    const p = hole.fairway.pts;
    for (let i = 0; i < p.length - 1; i++) {
      if (distToSeg(x, y, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]) < hole.fairway.w / 2) return 'fairway';
    }
    return 'rough';
  }

  // ---- Estado del juego ----------------------------------------------------
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, DPR = 1;

  const game = {
    holeIdx: 0,
    scores: [],
    strokes: 0,
    state: 'aim', // aim | flight | holed | card
    ball: null,
    lastPos: null,
    aim: 0,
    club: 0,
    wind: { x: 0, y: 0 },
    trail: [],
    launch: null,
    shotInfo: null,
  };
  const cam = { x: 0, y: 0, s: 2, init: false };

  let sensitivity = 1400;
  const hole = () => HOLES[game.holeIdx];

  function startHole(i) {
    game.holeIdx = i;
    game.strokes = 0;
    const h = hole();
    game.ball = { x: h.tee[0], y: h.tee[1], z: 0, vx: 0, vy: 0, vz: 0, lie: 'tee' };
    game.lastPos = { x: h.tee[0], y: h.tee[1] };
    const ws = Math.random() * 6;
    const wa = Math.random() * Math.PI * 2;
    game.wind = { x: Math.cos(wa) * ws, y: Math.sin(wa) * ws };
    game.trail = [];
    cam.init = false;
    readyToAim();
  }

  function distToPin() {
    const h = hole();
    return Math.hypot(h.pin[0] - game.ball.x, h.pin[1] - game.ball.y);
  }

  function autoClub() {
    const d = distToPin();
    if (game.ball.lie === 'green' || (game.ball.lie === 'fringe' && d < 25)) return PUTTER;
    let best = 0;
    for (let i = 0; i < PUTTER; i++) if (CLUBS[i].carry >= d * 0.97) best = i;
    if (game.ball.lie === 'sand' && best < 5) return Math.max(best, 4);
    return best;
  }

  function readyToAim() {
    const h = hole();
    game.state = 'aim';
    game.aim = Math.atan2(h.pin[1] - game.ball.y, h.pin[0] - game.ball.x);
    game.club = autoClub();
    updateHud();
    sendStatus();
  }

  // ---- Golpe ---------------------------------------------------------------
  // power: 0..~1.1 · face: grados (+ = cara abierta → se va a la derecha)
  function shoot(power, face, headKmh) {
    if (game.state !== 'aim') return;
    const club = CLUBS[game.club];
    const lie = TERRAIN[game.ball.lie] || TERRAIN.rough;
    let lieFactor = lie.lie;
    if (game.ball.lie === 'sand' && club.name === 'Sand wedge') lieFactor = 0.95;

    face = clamp(face, club.putter ? -8 : -20, club.putter ? 8 : 20);
    const startDir = game.aim + rad(face * 0.5);
    const b = game.ball;
    game.lastPos = { x: b.x, y: b.y };
    game.launch = { x: b.x, y: b.y };
    game.trail = [{ x: b.x, y: b.y }];
    game.strokes++;

    let v;
    if (club.putter) {
      const decel = TERRAIN[game.ball.lie]?.decel || TERRAIN.green.decel;
      v = Math.sqrt(2 * decel * club.carry * Math.max(0, power));
      b.vz = 0;
      b.vx = Math.cos(startDir) * v;
      b.vy = Math.sin(startDir) * v;
      b.curve = 0;
    } else {
      v = club.v0 * Math.sqrt(Math.max(0, power) * lieFactor);
      const loft = rad(club.loft);
      b.vz = v * Math.sin(loft);
      const vh = v * Math.cos(loft);
      b.vx = Math.cos(startDir) * vh;
      b.vy = Math.sin(startDir) * vh;
      // efecto lateral (slice/hook): aceleración perpendicular a la salida
      b.curve = face * 0.45 * (1 - club.loft / 90) * Math.min(1, v / 60);
      b.curveDir = startDir + Math.PI / 2;
    }
    b.z = 0;
    b.loft = club.loft;
    b.hitTrees = new Set();
    b.inAir = !club.putter;
    game.state = 'flight';

    game.shotInfo = { power, face, headKmh, club: club.name };
    updateHud();
    showShot();
    sendStatus();
    const faceTxt = Math.abs(face) < 2 ? 'cara recta' : face > 0 ? `cara abierta ${face.toFixed(0)}°` : `cara cerrada ${(-face).toFixed(0)}°`;
    send({ t: 'result', text: `${Math.round(headKmh)} km/h · ${Math.round(power * 100)}% · ${faceTxt}` });
  }

  function onPhoneSwing(msg) {
    if (game.state !== 'aim') return;
    const club = CLUBS[game.club];
    const peak = Number(msg.peak) || 0;
    let power;
    if (club.putter) power = clamp((peak - 80) / (sensitivity * 0.45 - 80), 0.02, 1.1);
    else power = clamp((peak - 200) / (sensitivity - 200), 0.03, 1.12);
    const face = (Number(msg.face) || 0) * 0.5;
    const headKmh = rad(peak) * LEVER_M * 3.6;
    lastPeak = peak;
    shoot(power, face, headKmh);
  }

  // ---- Física --------------------------------------------------------------
  function step(dt) {
    const b = game.ball;
    const h = hole();

    if (b.inAir) {
      b.vx += (game.wind.x * 0.18 + Math.cos(b.curveDir) * b.curve) * dt;
      b.vy += (game.wind.y * 0.18 + Math.sin(b.curveDir) * b.curve) * dt;
      b.vz -= G * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;

      // árboles
      h.trees.forEach((t, i) => {
        if (b.hitTrees.has(i) || b.z > 11) return;
        if (Math.hypot(b.x - t[0], b.y - t[1]) < t[2]) {
          b.hitTrees.add(i);
          b.vx *= -0.25 + (Math.random() - 0.5) * 0.3;
          b.vy *= 0.25 + (Math.random() - 0.5) * 0.3;
          b.vz = Math.min(b.vz, 0);
          toast('¡Árbol!');
        }
      });

      if (b.z <= 0) {
        b.z = 0;
        const t = terrainAt(h, b.x, b.y);
        if (t === 'water' || t === 'oob') return penalty(t);
        if (Math.hypot(b.x - h.pin[0], b.y - h.pin[1]) < 0.2) return holed();
        const T = TERRAIN[t];
        if (Math.abs(b.vz) > 2.5) {
          const spin = b.loft ? 1 - b.loft / 110 : 1;
          b.vz = -b.vz * T.bounce;
          b.vx *= T.keep * spin;
          b.vy *= T.keep * spin;
        } else {
          b.vz = 0;
          b.inAir = false;
        }
      }
      game.trail.push({ x: b.x, y: b.y });
      return;
    }

    // rodando
    const sp = Math.hypot(b.vx, b.vy);
    const t = terrainAt(h, b.x, b.y);
    if (t === 'water' || t === 'oob') return penalty(t);
    const decel = TERRAIN[t].decel;
    const nsp = sp - decel * dt;
    const px = b.x, py = b.y;
    if (nsp <= 0.03) {
      b.vx = b.vy = 0;
      return stopBall();
    }
    b.vx *= nsp / sp;
    b.vy *= nsp / sp;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // hoyo
    if (distToSeg(h.pin[0], h.pin[1], px, py, b.x, b.y) < CUP_R) {
      if (nsp < 1.7) return holed();
      if (nsp < 3.2 && !b.lipped) {
        b.lipped = true;
        const a = (Math.random() < 0.5 ? 1 : -1) * rad(25 + Math.random() * 30);
        const c = Math.cos(a), s = Math.sin(a);
        [b.vx, b.vy] = [(b.vx * c - b.vy * s) * 0.6, (b.vx * s + b.vy * c) * 0.6];
        toast('¡Hizo la vuelta al hoyo!');
      }
    }
  }

  function stopBall() {
    const b = game.ball;
    b.lie = terrainAt(hole(), b.x, b.y);
    b.lipped = false;
    if (game.strokes >= hole().par + 5) {
      toast('Levantás la pelota');
      finishHole();
      return;
    }
    readyToAim();
  }

  function penalty(kind) {
    game.strokes++;
    toast(kind === 'water' ? '¡Al agua! +1' : '¡Afuera! +1');
    const b = game.ball;
    Object.assign(b, { x: game.lastPos.x, y: game.lastPos.y, z: 0, vx: 0, vy: 0, vz: 0, inAir: false });
    game.state = 'wait';
    setTimeout(() => {
      b.lie = terrainAt(hole(), b.x, b.y);
      readyToAim();
    }, 1400);
  }

  const RESULT_NAMES = { '-3': '¡Albatros!', '-2': '¡Eagle!', '-1': '¡Birdie!', '0': 'Par', '1': 'Bogey', '2': 'Doble bogey', '3': 'Triple bogey' };

  function holed() {
    const b = game.ball;
    const h = hole();
    Object.assign(b, { x: h.pin[0], y: h.pin[1], z: 0, vx: 0, vy: 0, vz: 0, inAir: false });
    const diff = game.strokes - h.par;
    toast(game.strokes === 1 ? '¡¡HOYO EN UNO!!' : RESULT_NAMES[diff] || `+${diff}`);
    finishHole();
  }

  function finishHole() {
    game.state = 'holed';
    game.scores[game.holeIdx] = game.strokes;
    sendStatus();
    updateHud();
    setTimeout(() => {
      if (game.holeIdx + 1 < HOLES.length) startHole(game.holeIdx + 1);
      else showCard();
    }, 2800);
  }

  // ---- Cámara --------------------------------------------------------------
  function cameraTarget() {
    const b = game.ball;
    const h = hole();
    const pts = [[b.x, b.y], h.pin];
    if (game.state === 'aim') {
      const club = CLUBS[game.club];
      const d = club.putter ? Math.min(distToPin() * 1.15 + 1, club.carry) : club.carry;
      pts.push([b.x + Math.cos(game.aim) * d, b.y + Math.sin(game.aim) * d]);
    } else if (game.launch) {
      pts.push([game.launch.x, game.launch.y]);
    }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const span = 10;
    const w = Math.max(x1 - x0, span), hh = Math.max(y1 - y0, span);
    const s = Math.min(W / (w * 1.5), H / (hh * 1.5), 40);
    return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, s };
  }

  // ---- Dibujo --------------------------------------------------------------
  function stripePattern(c1, c2, size) {
    const p = document.createElement('canvas');
    p.width = p.height = size * 2;
    const g = p.getContext('2d');
    g.fillStyle = c1; g.fillRect(0, 0, size * 2, size * 2);
    g.fillStyle = c2; g.fillRect(0, 0, size, size * 2);
    return ctx.createPattern(p, 'repeat');
  }
  let PAT = null;
  function patterns() {
    if (PAT) return PAT;
    PAT = {
      rough: stripePattern('#3d7a30', '#3a752e', 6),
      fairway: stripePattern('#62ad4b', '#5aa344', 6),
      green: stripePattern('#83cf62', '#7cc85b', 2),
    };
    return PAT;
  }

  function ellipsePath(e, grow = 0) {
    const [cx, cy, rx, ry, rot = 0] = e;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx + grow, ry + grow, rot, 0, Math.PI * 2);
  }

  function drawWorld(time) {
    const h = hole();
    const P = patterns();
    const s = cam.s;
    ctx.setTransform(DPR * s, 0, 0, DPR * s, DPR * (W / 2 - cam.x * s), DPR * (H / 2 - cam.y * s));

    // fuera de límites
    ctx.fillStyle = '#25461f';
    ctx.fillRect(cam.x - W / s, cam.y - H / s, (2 * W) / s, (2 * H) / s);
    const [x0, y0, x1, y1] = h.bounds;
    ctx.fillStyle = P.rough;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.strokeStyle = 'rgba(255,255,255,.6)';
    ctx.lineWidth = 2 / s;
    ctx.setLineDash([6 / s, 6 / s]);
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    ctx.setLineDash([]);

    // fairway
    const fp = h.fairway.pts;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(fp[0][0], fp[0][1]);
    for (const p of fp.slice(1)) ctx.lineTo(p[0], p[1]);
    ctx.strokeStyle = '#4f9a3e';
    ctx.lineWidth = h.fairway.w + 3;
    ctx.stroke();
    ctx.strokeStyle = P.fairway;
    ctx.lineWidth = h.fairway.w;
    ctx.stroke();

    // tee
    ctx.fillStyle = '#6fbb55';
    ctx.fillRect(h.tee[0] - 5, h.tee[1] - 4, 10, 8);
    ctx.fillStyle = '#e33';
    for (const dx of [-3, 3]) { ctx.beginPath(); ctx.arc(h.tee[0] + dx, h.tee[1] - 2, 0.5, 0, 7); ctx.fill(); }

    // green
    ellipsePath(h.green, 3);
    ctx.fillStyle = '#6cb950';
    ctx.fill();
    ellipsePath(h.green);
    ctx.fillStyle = P.green;
    ctx.fill();

    // bunkers
    for (const bk of h.bunkers) {
      ellipsePath(bk, 0.6);
      ctx.fillStyle = '#c9b77a';
      ctx.fill();
      ellipsePath(bk);
      ctx.fillStyle = '#ead9a2';
      ctx.fill();
    }

    // agua
    for (const w of h.water) {
      ellipsePath(w, 1);
      ctx.fillStyle = '#9fd3ff';
      ctx.fill();
      ellipsePath(w);
      ctx.fillStyle = '#2f7fc1';
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,.25)';
      ctx.lineWidth = 0.6;
      for (let i = -3; i <= 3; i++) {
        const yy = w[1] + i * w[3] * 0.28 + Math.sin(time / 900 + i) * 1.2;
        ctx.beginPath();
        ctx.moveTo(w[0] - w[2] * 0.5, yy);
        ctx.lineTo(w[0] + w[2] * 0.2, yy);
        ctx.stroke();
      }
      ctx.restore();
    }

    // sombras de árboles, después copas
    for (const t of h.trees) {
      ctx.beginPath();
      ctx.ellipse(t[0] + t[2] * 0.4, t[1] + t[2] * 0.3, t[2], t[2] * 0.85, 0, 0, 7);
      ctx.fillStyle = 'rgba(0,0,0,.25)';
      ctx.fill();
    }
    for (const t of h.trees) {
      ctx.beginPath();
      ctx.arc(t[0], t[1], t[2], 0, 7);
      ctx.fillStyle = '#2b6327';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(t[0] - t[2] * 0.25, t[1] - t[2] * 0.25, t[2] * 0.55, 0, 7);
      ctx.fillStyle = '#3a7d33';
      ctx.fill();
    }

    // estela
    if (game.trail.length > 1) {
      ctx.beginPath();
      ctx.moveTo(game.trail[0].x, game.trail[0].y);
      for (const p of game.trail) ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = 'rgba(255,255,255,.45)';
      ctx.lineWidth = 1.5 / s;
      ctx.stroke();
    }

    // línea de tiro
    if (game.state === 'aim') {
      const b = game.ball;
      const club = CLUBS[game.club];
      const d = club.putter ? Math.min(distToPin() + 1, club.carry) : club.carry * (TERRAIN[b.lie]?.lie || 1);
      const ex = b.x + Math.cos(game.aim) * d, ey = b.y + Math.sin(game.aim) * d;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(ex, ey);
      ctx.setLineDash([8 / s, 6 / s]);
      ctx.strokeStyle = 'rgba(255,255,255,.85)';
      ctx.lineWidth = 2 / s;
      ctx.stroke();
      ctx.setLineDash([]);
      if (!club.putter) {
        ctx.beginPath();
        ctx.arc(ex, ey, Math.max(d * 0.06, 2), 0, 7);
        ctx.fillStyle = 'rgba(255,255,255,.18)';
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  function drawScreenSpace(time) {
    const h = hole();
    const s = cam.s;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const toScreen = (x, y) => [W / 2 + (x - cam.x) * s, H / 2 + (y - cam.y) * s];

    // hoyo y bandera
    const [hx, hy] = toScreen(h.pin[0], h.pin[1]);
    ctx.beginPath();
    ctx.arc(hx, hy, Math.max(0.054 * s, 3), 0, 7);
    ctx.fillStyle = '#111';
    ctx.fill();
    if (!(game.state === 'aim' && game.ball.lie === 'green' && distToPin() < 3)) {
      ctx.strokeStyle = '#eee';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx, hy - 42);
      ctx.stroke();
      const wave = Math.sin(time / 250) * 3;
      ctx.beginPath();
      ctx.moveTo(hx, hy - 42);
      ctx.quadraticCurveTo(hx + 10, hy - 40 + wave, hx + 20, hy - 36);
      ctx.lineTo(hx, hy - 30);
      ctx.fillStyle = '#e43b3b';
      ctx.fill();
    }

    // pelota
    const b = game.ball;
    const [bx, by] = toScreen(b.x, b.y);
    const off = b.z * 0.45 * Math.min(s, 4);
    ctx.beginPath();
    ctx.ellipse(bx + off, by + off * 0.6, 4, 3, 0, 0, 7);
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fill();
    const r = Math.min(4 + b.z * 0.3, 13);
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, 7);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  let lastFrame = 0;
  function frame(time) {
    const realDt = Math.min(0.05, (time - (lastFrame || time)) / 1000);
    lastFrame = time;

    if (game.state === 'flight') {
      let simT = realDt * SIM_SPEED;
      const DT = 1 / 240;
      while (simT > 0 && game.state === 'flight') {
        step(Math.min(DT, simT));
        simT -= DT;
      }
    }

    const tgt = cameraTarget();
    if (!cam.init) { Object.assign(cam, tgt, { init: true }); }
    const k = 1 - Math.exp(-realDt * 3);
    cam.x += (tgt.x - cam.x) * k;
    cam.y += (tgt.y - cam.y) * k;
    cam.s += (tgt.s - cam.s) * k;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawWorld(time);
    drawScreenSpace(time);
    updateMeter(realDt);
    if (game.state === 'flight' || game.state === 'aim') updateLiveHud();
    requestAnimationFrame(frame);
  }

  function resize() {
    DPR = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    PAT = null;
  }
  window.addEventListener('resize', resize);

  // ---- HUD -----------------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  function totalVsPar() {
    let diff = 0;
    game.scores.forEach((sc, i) => { if (sc != null) diff += sc - HOLES[i].par; });
    return diff === 0 ? 'E' : diff > 0 ? `+${diff}` : `${diff}`;
  }
  function updateHud() {
    const h = hole();
    $('hHole').textContent = `${game.holeIdx + 1}/${HOLES.length}`;
    $('hPar').textContent = h.par;
    $('hStrokes').textContent = game.strokes;
    $('hTotal').textContent = totalVsPar();
    const club = CLUBS[game.club];
    $('cName').textContent = club.name;
    $('cSub').textContent = club.putter ? `rueda hasta ~${club.carry} m` : `vuela hasta ~${club.carry} m`;
    const ws = Math.hypot(game.wind.x, game.wind.y);
    $('windTxt').textContent = `Viento ${Math.round(ws * 3.6)} km/h`;
    $('windArrow').style.transform = `rotate(${deg(Math.atan2(game.wind.x, -game.wind.y))}deg)`;
    updateLiveHud();
  }
  function updateLiveHud() {
    $('hDist').textContent = `${Math.round(distToPin())} m`;
    $('hLie').textContent = game.state === 'flight' ? '…' : TERRAIN[game.ball.lie]?.name || '–';
  }

  let toastTimer = null;
  function toast(text) {
    const el = $('toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  function showShot() {
    const i = game.shotInfo;
    $('shot').style.display = 'block';
    $('sTitle').textContent = i.club;
    $('sSpeed').textContent = `${Math.round(i.headKmh)} km/h`;
    $('sPower').textContent = `${Math.round(i.power * 100)}%`;
    const f = i.face;
    $('sFace').textContent = Math.abs(f) < 2 ? 'Recta' : f > 0 ? `Abierta ${f.toFixed(0)}° →` : `← Cerrada ${(-f).toFixed(0)}°`;
  }

  function showCard() {
    game.state = 'card';
    let html = '<tr><th>Hoyo</th>' + HOLES.map((_, i) => `<th>${i + 1}</th>`).join('') + '<th>Total</th></tr>';
    html += '<tr><td>Par</td>' + HOLES.map((h) => `<td>${h.par}</td>`).join('') + `<td>${HOLES.reduce((a, h) => a + h.par, 0)}</td></tr>`;
    html += '<tr><td>Vos</td>' + game.scores.map((sc) => `<td><b>${sc}</b></td>`).join('') + `<td><b>${game.scores.reduce((a, b) => a + b, 0)} (${totalVsPar()})</b></td></tr>`;
    $('cardTable').innerHTML = html;
    $('card').style.display = 'block';
    sendStatus();
  }
  $('again').addEventListener('click', () => {
    $('card').style.display = 'none';
    $('shot').style.display = 'none';
    game.scores = [];
    startHole(0);
  });

  // medidor de velocidad del celu
  let liveW = 0, lastPeak = 0, liveAt = 0;
  let keyCharge = null;
  function updateMeter() {
    let frac;
    if (keyCharge != null) frac = chargePower() / 1.12;
    else {
      if (performance.now() - liveAt > 300) liveW *= 0.85;
      frac = liveW / sensitivity;
    }
    $('meterFill').style.height = `${clamp(frac, 0, 1) * 100}%`;
    $('meterPeak').style.bottom = `${clamp(lastPeak / sensitivity, 0, 1) * 100}%`;
  }

  const sens = $('sens');
  try { const v = Number(localStorage.getItem('golf-sens')); if (v) sens.value = v; } catch {}
  function applySens() {
    sensitivity = Number(sens.value);
    $('sensVal').textContent = sensitivity;
    try { localStorage.setItem('golf-sens', String(sensitivity)); } catch {}
  }
  sens.addEventListener('input', applySens);
  applySens();

  // ---- Controles ------------------------------------------------------------
  function nudgeAim(d) {
    if (game.state !== 'aim') return;
    game.aim += rad(d * (CLUBS[game.club].putter ? 0.4 : 1));
  }
  function changeClub(d) {
    if (game.state !== 'aim') return;
    game.club = clamp(game.club + d, 0, CLUBS.length - 1);
    updateHud();
    sendStatus();
  }

  function chargePower() {
    if (keyCharge == null) return 0;
    const t = (performance.now() - keyCharge) / 1000;
    return Math.min(1.12, t / 1.3);
  }
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowLeft') nudgeAim(-1);
    else if (e.key === 'ArrowRight') nudgeAim(1);
    else if (e.key === 'ArrowUp') changeClub(-1);
    else if (e.key === 'ArrowDown') changeClub(1);
    else if (e.code === 'Space') {
      e.preventDefault();
      if (keyCharge == null && game.state === 'aim') keyCharge = performance.now();
    } else return;
    e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    if (e.code !== 'Space' || keyCharge == null) return;
    const p = chargePower();
    keyCharge = null;
    const club = CLUBS[game.club];
    const head = club.putter ? 15 + p * 20 : 60 + p * 90;
    shoot(p, (Math.random() - 0.5) * 6, head);
  });

  // ---- Red -----------------------------------------------------------------
  let ws = null;
  let clubs = 0;
  function connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws`);
    ws.onopen = () => { ws.send(JSON.stringify({ t: 'hello', role: 'screen' })); sendStatus(); };
    ws.onclose = () => { setClubs(0); setTimeout(connect, 1000); };
    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      switch (msg.t) {
        case 'clubs': setClubs(msg.n); break;
        case 'need-status': sendStatus(); break;
        case 'swing': onPhoneSwing(msg); break;
        case 'aim': nudgeAim(msg.d > 0 ? 1 : -1); break;
        case 'club': changeClub(msg.d > 0 ? 1 : -1); break;
        case 'live': liveW = msg.w; liveAt = performance.now(); break;
        case 'phase': setPhase(msg.mode); break;
      }
    };
  }
  function send(msg) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }
  function sendStatus() {
    const h = hole();
    send({
      t: 'status',
      canSwing: game.state === 'aim',
      hole: game.holeIdx + 1,
      par: h.par,
      club: CLUBS[game.club].name,
      dist: game.ball ? Math.round(distToPin()) : null,
      finished: game.state === 'card',
      message: game.state === 'card' ? `Total: ${game.scores.reduce((a, b) => a + b, 0)} (${totalVsPar()})` : undefined,
    });
  }
  function setClubs(n) {
    clubs = n;
    $('dot').classList.toggle('on', n > 0);
    $('connTxt').textContent = n === 0 ? 'Ningún palo conectado' : n === 1 ? '1 palo conectado' : `${n} palos conectados`;
    if (n === 0) setPhase(null);
  }
  function setPhase(m) {
    const names = { address: 'Posición…', ready: '¡LISTO!', swinging: 'SWING', wait: 'Esperando' };
    const el = $('phase');
    el.textContent = names[m] || '—';
    el.style.color = m === 'ready' ? '#5ee08a' : m === 'swinging' ? '#ffd447' : '';
  }

  async function showUrl() {
    try {
      const info = await (await fetch('/info')).json();
      const ip = info.ips[0];
      if (!ip) { $('url').textContent = 'No hay IP de red local (¿Wi-Fi?)'; return; }
      const url = `https://${ip}:${info.httpsPort}/palo`;
      $('url').textContent = url;
      if (window.QRCode) new QRCode($('qr'), { text: url, width: 110, height: 110 });
    } catch {
      $('url').textContent = 'Mirá la consola del servidor para la URL del celu';
    }
  }

  // ---- Arranque --------------------------------------------------------------
  resize();
  startHole(0);
  connect();
  showUrl();
  requestAnimationFrame(frame);
})();
