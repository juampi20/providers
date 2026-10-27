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

1. Create `providers/<name>.js` that exports `getStreams(tmdbId, mediaType, season, episode)` and resolves to a list of `{ name, title, url, quality, headers }`.
2. Add an entry to `scrapers` in `manifest.json` with `filename` pointing to it.
3. Add tests in `test/` with saved HTML fixtures and a `scripts/<name>-live.js` that hits the real site.

Nuvio runs providers in QuickJS, wrapped in a function. For TMDB calls, read the global `TMDB_API_KEY` that Nuvio injects and never declare your own, since a local one hides it. Older builds inject none, so let users save a key through `onSettings` (it comes back in `SCRAPER_SETTINGS`, and the manifest entry needs `hasSettings: true`) and keep a fallback that needs no key.

HackStore and CineCalidad are the exception: both address titles by a slug built from the Spanish title and year, so they need TMDB metadata and return nothing without a key. SoloLatino falls back to Wikidata, which needs none.

FireTV runs providers on Hermes, which has no `Buffer` and may lack `AbortController`, `String.prototype.normalize` and newer `Promise` helpers. Providers fold accents with a table, build URLs by hand and stick to promise chains.

## Source layout

`src/providers/<site>.js` holds one provider's own flow; `src/core.js` holds what they share — HTTP, the packed-player unpacker, the vimeos/streamwish resolvers, quality inference, the language cut, the TMDB key helpers. `npm run build` bundles each into `providers/<site>.js`, which is what Nuvio downloads.

**`providers/` is build output — edit `src/` and rebuild.** The bundle inlines `crypto-js`, so a provider never calls `require` at runtime, which is what keeps SoloLatino working on FireTV.

## Development

```sh
npm install
npm test                            # builds src/ into providers/, then runs the offline tests
npm run live -- tt0903747-1x01      # SoloLatino against the real sites
node scripts/hackstore-live.js el-origen-2010
node scripts/cinecalidad-live.js amor-y-tesoro 2008
```

SoloLatino asks `embed69.org/video/<id>` for each title. That page redirects to the encrypted `/f/` page when the title is there, and otherwise lists the servers in plain HTML (The 100 is one such title). Each call returns a single language: embeds are grouped and resolved latino → castellano → subtitulado, and the first language that yields a playable link ends the search, so the others are never fetched. Streamwish links are read through vibuxer.com, which serves the same packed player as vidhide. Links are returned without probing them: Nuvio waits for every pending request before it shows a plugin's results, and a dead CDN can hang past its 60 s plugin limit. It never returns hls4: those segments carry a PNG header that Nuvio's player (libmpv) refuses. VOE is not supported: its mirrors ask for a human check.
