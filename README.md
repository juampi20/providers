# Nuvio Providers

Personal provider repository for Nuvio.

## Providers

| Provider | File | Source | Servers |
|----------|------|--------|---------|
| SoloLatino | `providers/sololatino.js` | embed69 player (`/f/` and `/video/`) used by sololatino.net (Latino, Castellano, Subtitulado) | vidhide |

## Setup

1. Push this repo to GitHub (public, on `main`).
2. In Nuvio, add the repository URL:
   `https://raw.githubusercontent.com/<user>/<repo>/main/manifest.json`

## Adding a provider

1. Create `providers/<name>.js` exporting `getStreams(tmdbId, mediaType, season, episode)` and returning a Promise of `{ name, title, url, quality, headers }`. Use `.then()` chains: Nuvio's Hermes engine has trouble with `async/await` in dynamic code. For TMDB calls use the global `TMDB_API_KEY` Nuvio injects (the user's key, else Nuvio's default) and never declare your own; older builds (desktop 1.1.21) inject none, so keep a keyless fallback like SoloLatino's Wikidata lookup.
2. Add an entry to `scrapers` in `manifest.json` with `filename` pointing to it.
3. Add tests in `test/` with saved HTML fixtures.

## Development

```sh
npm install
npm test                            # offline tests against saved fixtures
npm run live -- tt0903747-1x01      # SoloLatino against the real sites
```

SoloLatino notes: it queries `embed69.org/video/<id>`, which redirects to the encrypted `/f/` page when the title is there and otherwise serves a plain server list (e.g. The 100). voe sits behind a captcha and streamwish behind an obfuscated loader, so only vidhide is supported.
