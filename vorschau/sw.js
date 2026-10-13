const KONFIG = {"kanal":"vorschau","version":"2026-10-13.f66523d","dateien":[{"pfad":"assets/index-Bf8YHdsL.css","pruefsumme":"b95609aadacd561eaccff98008f8eba8c66105b86f4a54adaee75b20e8e3a7c3"},{"pfad":"assets/index-Bk080NB9.js","pruefsumme":"01dd5a32f7c4a8065067cee0a307bfb2a7ca488c045787bcfb98de361e0b560b"},{"pfad":"index.html","pruefsumme":"a9e4802f7e271579b1cb253454d6da3f0c64cf115ca59cb7968f4a32fd500072"},{"pfad":"manifest.webmanifest","pruefsumme":"7f62b3cd27fd6b77cc996b5d08d4e0fc9539c96058da65e8b1cd820289c6fb87"},{"pfad":"symbole/apple-touch-icon.png","pruefsumme":"699a21effd77b6bed8a7d6c8a9990ffb0690bb094209083a5dd1767a08017eaf"},{"pfad":"symbole/symbol-192.png","pruefsumme":"431087f9926aab59ac16fdf8f6f1a8fe89afc292691cf53a5124b4a09f4b125b"},{"pfad":"symbole/symbol-512.png","pruefsumme":"afa9c761be8cbb2d42580dc15d23e8cb163251c3f175a6c7eb492d13cb909f2b"}]};
// Service Worker (SOL-01 REQ-17), ohne Bibliothek. Das Bauwerkzeug (vite.config.ts) stellt `KONFIG` voran:
// { kanal, version, dateien: [{ pfad, pruefsumme }] } – alle Dateien des Builds mit SHA-256.
/* global KONFIG, self, caches, fetch, crypto, URL */
const PRAEFIX = `solitaer-${KONFIG.kanal}-`;
const CACHE = `${PRAEFIX}${KONFIG.version}`;

function hex(puffer) {
  return [...new Uint8Array(puffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Lädt alle Dateien am HTTP-Cache vorbei, prüft die Prüfsummen und legt sie erst dann ab.
// Stimmt eine nicht, schlägt die Installation fehl: die bisherige Version bleibt aktiv.
async function lade() {
  const cache = await caches.open(CACHE);
  try {
    for (const datei of KONFIG.dateien) {
      const antwort = await fetch(new self.Request(datei.pfad, { cache: 'reload' }));
      if (!antwort.ok) throw new Error(`${datei.pfad}: HTTP ${antwort.status}`);
      const kopie = antwort.clone();
      if (hex(await crypto.subtle.digest('SHA-256', await antwort.arrayBuffer())) !== datei.pruefsumme) {
        throw new Error(`${datei.pfad}: Prüfsumme stimmt nicht`);
      }
      await cache.put(datei.pfad, kopie);
    }
  } catch (fehler) {
    await caches.delete(CACHE);
    throw fehler;
  }
}

self.addEventListener('install', (ereignis) => {
  // Kein skipWaiting hier: die neue Version wartet, bis die Seite sie freigibt (Start oder zwischen zwei Partien).
  ereignis.waitUntil(lade());
});

self.addEventListener('activate', (ereignis) => {
  // Nur eigene Caches dieses Kanals; fremde Caches derselben Herkunft bleiben.
  ereignis.waitUntil(
    caches
      .keys()
      .then((namen) => Promise.all(namen.filter((n) => n.startsWith(PRAEFIX) && n !== CACHE).map((n) => caches.delete(n)))),
  );
});

self.addEventListener('message', (ereignis) => {
  if (ereignis.data === 'aktivieren') self.skipWaiting();
});

self.addEventListener('fetch', (ereignis) => {
  const anfrage = ereignis.request;
  const url = new URL(anfrage.url);
  if (anfrage.method !== 'GET' || url.origin !== self.location.origin) return;
  ereignis.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const treffer =
        (await cache.match(anfrage, { ignoreSearch: true })) ??
        (anfrage.mode === 'navigate' ? await cache.match('index.html') : undefined);
      return treffer ?? fetch(anfrage);
    })(),
  );
});
