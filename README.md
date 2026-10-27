# Nuvio Providers

Personal provider repository for Nuvio.

## Providers

| Provider | File | Source | Servers |
|----------|------|--------|---------|
| SoloLatino | `providers/sololatino.js` | embed69 player (`/f/` and `/video/`) used by sololatino.net (Latino, Castellano, Subtitulado) | vidhide, streamwish |

## Setup

1. In Nuvio, open the plugins settings (not addons) and add this repository:
   `https://raw.githubusercontent.com/juampi20/providers/main/manifest.json`
2. Optional: paste your TMDB v3 key in SoloLatino's settings. Nuvio desktop 1.1.21 does not share its own key with plugins, so without yours the provider looks titles up in Wikidata, which misses some. The key stays in Nuvio, never in this repo.

## Adding a provider

1. Create `providers/<name>.js` that exports `getStreams(tmdbId, mediaType, season, episode)` and resolves to a list of `{ name, title, url, quality, headers }`.
2. Add an entry to `scrapers` in `manifest.json` with `filename` pointing to it.
3. Add tests in `test/` with saved HTML fixtures.

Nuvio runs providers in QuickJS, wrapped in a function. For TMDB calls, read the global `TMDB_API_KEY` that Nuvio injects and never declare your own, since a local one hides it. Older builds inject none, so let users save a key through `onSettings` (it comes back in `SCRAPER_SETTINGS`, and the manifest entry needs `hasSettings: true`) and keep a fallback that needs no key.

## Development

```sh
npm install
npm test                            # offline tests against saved fixtures
npm run live -- tt0903747-1x01      # SoloLatino against the real sites
```

SoloLatino asks `embed69.org/video/<id>` for each title. That page redirects to the encrypted `/f/` page when the title is there, and otherwise lists the servers in plain HTML (The 100 is one such title). Streamwish links are read through vibuxer.com, which serves the same packed player as vidhide. Before returning a stream, the provider loads the start of its first segment and drops links whose CDN fails. VOE is not supported: its mirrors ask for a human check.
