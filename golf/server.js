// Servidor local del golf: sirve la pantalla (compu) y el palo (celu) y
// reenvía mensajes entre ellos por WebSocket.
//
// - HTTP  :3000 -> para abrir la pantalla en la compu (http://localhost:3000)
// - HTTPS :3443 -> para el celu. Los sensores de movimiento solo funcionan en
//                  "contexto seguro", así que el celu tiene que entrar por HTTPS
//                  (certificado autofirmado: hay que aceptar la advertencia).

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const https = require('https');
const { WebSocketServer } = require('ws');
const selfsigned = require('selfsigned');

const HTTP_PORT = Number(process.env.PORT || 3000);
const HTTPS_PORT = Number(process.env.HTTPS_PORT || 3443);
const PUBLIC_DIR = path.join(__dirname, 'public');
const CERT_DIR = path.join(__dirname, '.cert');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family === 'IPv4' && !a.internal) out.push(a.address);
    }
  }
  return out;
}

async function loadOrCreateCert(ips) {
  const keyFile = path.join(CERT_DIR, 'key.pem');
  const certFile = path.join(CERT_DIR, 'cert.pem');
  const ipsFile = path.join(CERT_DIR, 'ips.json');
  const wanted = JSON.stringify([...ips].sort());
  try {
    if (fs.readFileSync(ipsFile, 'utf8') === wanted) {
      return { key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) };
    }
  } catch { /* hay que generarlo */ }

  const altNames = [
    { type: 2, value: 'localhost' },
    { type: 7, ip: '127.0.0.1' },
    ...ips.map((ip) => ({ type: 7, ip })),
  ];
  const pems = await selfsigned.generate([{ name: 'commonName', value: 'golf.local' }], {
    keySize: 2048,
    algorithm: 'sha256',
    notAfterDate: new Date(Date.now() + 365 * 24 * 3600 * 1000),
    extensions: [
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'extKeyUsage', serverAuth: true },
      { name: 'subjectAltName', altNames },
    ],
  });
  fs.mkdirSync(CERT_DIR, { recursive: true });
  fs.writeFileSync(keyFile, pems.private);
  fs.writeFileSync(certFile, pems.cert);
  fs.writeFileSync(ipsFile, wanted);
  return { key: pems.private, cert: pems.cert };
}

function handleRequest(req, res) {
  const url = new URL(req.url, 'http://x');
  let pathname = decodeURIComponent(url.pathname);

  if (pathname === '/') pathname = '/screen.html';
  if (pathname === '/palo' || pathname === '/club') pathname = '/club.html';

  if (pathname === '/info') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ips: lanAddresses(), httpsPort: HTTPS_PORT, httpPort: HTTP_PORT }));
    return;
  }

  const file = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403).end('Prohibido');
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('No encontrado');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
}

// --- Relay de WebSocket -----------------------------------------------------
// Cada cliente se presenta con {t:'hello', role:'screen'|'club'}.
// Lo que manda un palo va a todas las pantallas y viceversa.

const clients = new Set();

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function broadcast(role, msg) {
  for (const c of clients) if (c.role === role) send(c, msg);
}

function clubCount() {
  let n = 0;
  for (const c of clients) if (c.role === 'club') n++;
  return n;
}

function attachWs(server) {
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });
  wss.on('connection', (ws) => {
    ws.role = null;
    clients.add(ws);

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }
      if (!msg || typeof msg.t !== 'string') return;

      if (msg.t === 'hello') {
        ws.role = msg.role === 'club' ? 'club' : 'screen';
        broadcast('screen', { t: 'clubs', n: clubCount() });
        if (ws.role === 'club') broadcast('screen', { t: 'need-status' });
        return;
      }
      if (ws.role === 'club') broadcast('screen', msg);
      else if (ws.role === 'screen') broadcast('club', msg);
    });

    ws.on('close', () => {
      clients.delete(ws);
      broadcast('screen', { t: 'clubs', n: clubCount() });
    });
  });
}

async function main() {
  const ips = lanAddresses();
  const creds = await loadOrCreateCert(ips);

  const httpServer = http.createServer(handleRequest);
  const httpsServer = https.createServer(creds, handleRequest);
  attachWs(httpServer);
  attachWs(httpsServer);

  httpServer.listen(HTTP_PORT, '0.0.0.0');
  httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
    console.log('\n⛳  Golf con el celu como palo\n');
    console.log(`  Pantalla (en la compu):  http://localhost:${HTTP_PORT}`);
    if (ips.length === 0) {
      console.log('  ⚠ No encontré una IP de red local. Conectá la compu al Wi-Fi.');
    }
    for (const ip of ips) {
      console.log(`  Palo (en el celu):       https://${ip}:${HTTPS_PORT}/palo`);
    }
    console.log('\n  El celu y la compu tienen que estar en el mismo Wi-Fi.');
    console.log('  En el celu vas a ver una advertencia de certificado: tocá');
    console.log('  "Avanzado" → "Continuar" (es tu propio servidor local).\n');
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
