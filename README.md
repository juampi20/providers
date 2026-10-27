# Nuvio Providers

Personal provider repository for Nuvio.

## Providers

| Provider | File | Source | Servers |
|----------|------|--------|---------|
| Embed69 | `providers/embed69.js` | embed69.org player (`/f/` and `/video/`), el que usa sololatino.net (Latino, Castellano, Subtitulado) | vidhide, streamwish, voe, … |
| HackStore | `providers/hackstore.js` | hackstore2.com REST API (Latino, Castellano, Subtitulado) | vimeos, streamwish |
| CineCalidad | `providers/cinecalidad.js` | cinecalidad.vg movie slugs — Latino | vimeos, streamwish |
| Vimeus | `providers/vimeus.js` | vimeus.com, keyed by TMDB id — no API key needed, Latino | vimeos, streamwish, vidhide |

## Setup

1. In Nuvio, open the plugins settings (not addons) and add this repository:
   `https://raw.githubusercontent.com/juampi20/providers/main/manifest.json`
2. Optional: paste your TMDB v3 key in Embed69's settings. Nuvio desktop 1.1.21 does not share its own key with plugins, so without yours the provider looks titles up in Wikidata, which misses some. The key stays in Nuvio, never in this repo.

## Adding a provider

1. Copiá el template: `cp -r src/_template src/<name>` y renombrá `PROVIDER_NAME`.
   - `index.js` — la entrada que llama Nuvio; exporta `getStreams` y `onSettings`, atrapa errores y delega.
   - `extractor.js` — el flujo del sitio: ids, URLs, parseo, qué servidores confía.
   - `log.js` — logger con prefijo `[Proveedor]`.
   - `scraper.json` — la entrada del manifest (`id`, `name`, `description`, `version`, `supportedTypes`, …); se mergea sobre `scraper-defaults.json` y el `filename` se deriva.
2. Lo compartido va a `src/_utils/`: `http.js`, `packed.js` (players empaquetados y resolvers), `quality.js`, `matcher.js` (títulos), `labels.js` (forma del stream y corte por idioma), `tmdb.js`, `jsunpack.js`, `useragent.js`.
3. `npm run build` buildea a `providers/<name>.js` y regenera el `scrapers` de `manifest.json`.
4. Probá el provider en el Plugin Tester (o con un `test.js` temporal) antes de dar por buena la versión.

`providers/*.js` y el bloque `scrapers` de `manifest.json` son salida de build: se edita `src/`, nunca ellos.

Nuvio runs providers in QuickJS on desktop and Hermes on TV/mobile, wrapped in a function. For TMDB calls, read the global `TMDB_API_KEY` that Nuvio injects and never declare your own, since a local one hides it. Older builds inject none, so let users save a key through `onSettings` (it comes back in `SCRAPER_SETTINGS`, and the manifest entry needs `hasSettings: true`) and keep a fallback that needs no key.

HackStore and CineCalidad are the exception: both address titles by a slug built from the Spanish title and year, so they need TMDB metadata and return nothing without a key. Embed69 falls back to Wikidata, which needs none, and Vimeus needs no key at all — it is addressed by TMDB id.

FireTV runs providers on Hermes, which has no `Buffer` and may lack `AbortController`, `String.prototype.normalize` and newer `Promise` helpers. Providers fold accents with a table and build URLs by hand. `async`/`await` is fine in `src/` even though Hermes rejects it in plugins: esbuild lowers it to generators on the way into `providers/`, which is why the built file is what gets tested.

## Source layout

Cada provider vive en su carpeta: `src/<provider>/{index.js, extractor.js, log.js, scraper.json}`. Lo compartido está en `src/_utils/` y el punto de partida para uno nuevo es `src/_template/`. `build.js` (esbuild, `target: es2016`) buildea cada uno a `providers/<provider>.js` — lo que Nuvio descarga — y regenera `manifest.json` desde los `scraper.json` + `scraper-defaults.json`.

**`providers/` y el bloque `scrapers` de `manifest.json` son salida de build — se edita `src/` y se rebuildea.** `crypto-js` y `cheerio` quedan **externos**: los provee el runtime de Nuvio, así que el artifact pesa ~17 KB en vez de 200 KB y hace `require("crypto-js")`. `async`/`await` está permitido en `src/`: esbuild lo baja a generadores para el target es2016.

`src/baechu-squad/` es un provider de ejemplo que vino con el template (variedades coreanas, en inglés): queda deshabilitado y no forma parte del catálogo latino.

## Development

```sh
npm install
npm run build                       # src/<provider>/ -> providers/*.js + manifest.json (readable output)
npm run build:min                   # same, minified, for a release
npm start                           # local server on :3000 for Nuvio's Plugin Tester
```

Antes de publicar, se prueba **en la app**: `npm start` levanta el repo por HTTP y un Nuvio *debug build* lo consume desde **Settings > Developer Section > Plugin Tester** — el *Repo Tester* apunta a la URL del manifest, el *Individual Plugin* a la URL de un provider compilado. Ese tester corre en el mismo Hermes que la app final, así que es la única prueba que vale para el runtime; para una comprobación suelta contra el sitio real, un `test.js` temporal en la raíz (como propone la guía) alcanza.

El workflow completo de providers de Nuvio está en [`DOCUMENTATION.md`](DOCUMENTATION.md) (copia de `autovalue/nuvio-plugins`, GPL-3.0) — es la referencia del contrato, y su encabezado anota en qué se diferencia este repo.

Para una comprobación ad-hoc contra el sitio real, un `test.js` temporal en la raíz:

```js
const { getStreams } = require('./providers/vimeus.js');
getStreams('27205', 'movie').then(console.log);
```

Embed69 asks `embed69.org/video/<id>` for each title. That page redirects to the encrypted `/f/` page when the title is there, and otherwise lists the servers in plain HTML (The 100 is one such title). Each call returns a single language: embeds are grouped and resolved latino → castellano → subtitulado, and the first language that yields a playable link ends the search, so the others are never fetched. Streamwish links are read through vibuxer.com, which serves the same packed player as vidhide. Links are returned without probing them: Nuvio waits for every pending request before it shows a plugin's results, and a dead CDN can hang past its 60 s plugin limit. It never returns hls4: those segments carry a PNG header that Nuvio's player (libmpv) refuses. Los embeds se resuelven por host con `src/_utils/resolvers.js`: vimeos, streamwish, vidhide, VOE, goodstream, uqload, audinifer, ok.ru y doodstream.
