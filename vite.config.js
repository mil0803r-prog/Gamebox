import { defineConfig } from 'vite';

// Genera sw.js con la lista de archivos del build para que el juego funcione sin conexión
function offlineServiceWorker() {
  return {
    name: 'offline-sw',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = Object.keys(bundle).filter(f => !f.endsWith('.map'));
      const assets = ['./', './index.html', './manifest.webmanifest', './icon.svg', ...files.map(f => './' + f)];
      const version = Date.now().toString(36);
      const sw = `// Generado automáticamente en el build
const CACHE = 'turbo-duelo-${version}';
const ASSETS = ${JSON.stringify([...new Set(assets)])};
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // páginas: primero la red (así siempre carga la versión nueva); sin conexión, la guardada
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then(res => { const c = res.clone(); caches.open(CACHE).then(k => k.put('./index.html', c)); return res; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request).then(res => {
    if (res.ok && new URL(e.request.url).origin === location.origin) {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy));
    }
    return res;
  }).catch(() => caches.match('./index.html'))));
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: sw });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [offlineServiceWorker()],
  build: { target: 'es2020', chunkSizeWarningLimit: 1200 },
});
