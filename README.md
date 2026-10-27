# Nuvio Providers

Personal provider repository for Nuvio.

## Providers

| Provider | File | Source | Servers |
|----------|------|--------|---------|
| SoloLatino | `providers/sololatino.js` | embed69 player (`/f/` and `/video/`) used by sololatino.net (Latino, Castellano, Subtitulado) | vidhide, streamwish |
| HackStore | `providers/hackstore.js` | hackstore2.com REST API (Latino, Castellano, Subtitulado) | vimeos, streamwish |

## Setup

1. In Nuvio, open the plugins settings (not addons) and add this repository:
   `https://raw.githubusercontent.com/juampi20/providers/main/manifest.json`
2. Optional: paste your TMDB v3 key in SoloLatino's settings. Nuvio desktop 1.1.21 does not share its own key with plugins, so without yours the provider looks titles up in Wikidata, which misses some. The key stays in Nuvio, never in this repo.

## Adding a provider

1. Create `src/<name>/index.js` that exports `getStreams(tmdbId, mediaType, season, episode)` and resolves to a list of `{ name, title, url, quality, headers }`. Site-specific flow only — HTTP, the unpacker, the resolvers, the language cut, the title matcher and quality inference come from `src/core.js`. If the provider grows, split it into `extractor.js`, `http.js`, … next to `index.js` and require them.
2. Add `src/<name>/provider.json` with the manifest entry (`id`, `name`, `description`, `version`, `supportedTypes`, …). `filename` is derived, so it can't point at the wrong file.
3. `npm run build` bundles it into `providers/<name>.js` and regenerates the `scrapers` array of `manifest.json`.
4. Add tests in `test/` with saved fixtures and a `scripts/<name>-live.js` that hits the real site.

`providers/*.js` and the `scrapers` block of `manifest.json` are build output: edit `src/`, never them.

Nuvio runs providers in QuickJS on desktop and Hermes on TV/mobile, wrapped in a function. For TMDB calls, read the global `TMDB_API_KEY` that Nuvio injects and never declare your own, since a local one hides it. Older builds inject none, so let users save a key through `onSettings` (it comes back in `SCRAPER_SETTINGS`, and the manifest entry needs `hasSettings: true`) and keep a fallback that needs no key.

HackStore and CineCalidad are the exception: both address titles by a slug built from the Spanish title and year, so they need TMDB metadata and return nothing without a key. SoloLatino falls back to Wikidata, which needs none.

FireTV runs providers on Hermes, which has no `Buffer` and may lack `AbortController`, `String.prototype.normalize` and newer `Promise` helpers. Providers fold accents with a table and build URLs by hand. `async`/`await` is fine in `src/` even though Hermes rejects it in plugins: esbuild lowers it to generators on the way into `providers/`, which is why the built file is what gets tested.

## Source layout

`src/<provider>/index.js` holds one provider's own flow and `src/<provider>/provider.json` its manifest entry; `src/core.js` holds what they share — HTTP, the packed-player unpacker, the vimeos/streamwish resolvers, quality inference, the language cut, the title matcher, the TMDB key helpers. `npm run build` (esbuild, `target: es2016`) bundles each into `providers/<provider>.js`, which is what Nuvio downloads, and regenerates the manifest from the `provider.json` files.

**`providers/` y el bloque `scrapers` de `manifest.json` son salida de build — se edita `src/` y se rebuildea.** El bundle inlinea `crypto-js`, así que un provider no llama a `require` en runtime, que es lo que lo mantiene vivo en el Hermes de FireTV.

## Development

```sh
npm install
npm run build                       # src/<provider>/ -> providers/*.js + manifest.json (readable output)
npm run build:min                   # same, minified, for a release
npm test                            # build, then the offline tests
npm start                           # local server on :3000 for Nuvio's Plugin Tester
```

Antes de publicar, se prueba **en la app**: `npm start` levanta el repo por HTTP y un Nuvio *debug build* lo consume desde **Settings > Developer Section > Plugin Tester** — el *Repo Tester* apunta a la URL del manifest, el *Individual Plugin* a la URL de un provider compilado. Ese tester corre en el mismo Hermes que la app final, así que es la única prueba que vale para el runtime; `npm test` y los scripts live cubren la lógica.

El workflow completo de providers de Nuvio está vendorizado en [`docs/nuvio-provider-guide.md`](docs/nuvio-provider-guide.md) (copia de `autovalue/nuvio-plugins`, GPL-3.0) — es la referencia del contrato, y su encabezado anota en qué se diferencia este repo.

Para los sitios reales:

```sh
npm run live -- tt0903747-1x01      # SoloLatino
node scripts/hackstore-live.js el-origen-2010
node scripts/cinecalidad-live.js amor-y-tesoro 2008
```

SoloLatino asks `embed69.org/video/<id>` for each title. That page redirects to the encrypted `/f/` page when the title is there, and otherwise lists the servers in plain HTML (The 100 is one such title). Each call returns a single language: embeds are grouped and resolved latino → castellano → subtitulado, and the first language that yields a playable link ends the search, so the others are never fetched. Streamwish links are read through vibuxer.com, which serves the same packed player as vidhide. Links are returned without probing them: Nuvio waits for every pending request before it shows a plugin's results, and a dead CDN can hang past its 60 s plugin limit. It never returns hls4: those segments carry a PNG header that Nuvio's player (libmpv) refuses. VOE is not supported: its mirrors ask for a human check.
