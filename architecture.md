---
id: architecture
type: architecture-design
status: draft
title: Architecture — Nuvio plugin contract and repository shape
parent: goal
---

## Shape

One repository, one plugin collection. `manifest.json` is the only entry point Nuvio reads: it declares
every provider (`id`, `name`, `filename`, `supportedTypes`, `formats`, `contentLanguage`, `hasSettings`,
`enabled`). What Nuvio fetches is one self-contained CommonJS file per provider under `providers/` — but
those files are **build output**, not source:

```
src/<provider>/index.js       ──┐
src/<provider>/extractor.js    ──┤
src/<provider>/log.js          ──┼─▶ node build.js (esbuild) ──▶ providers/<provider>.js ──▶ Nuvio
src/<provider>/scraper.json    ──┘        └─▶ manifest.json (scrapers generados)

src/_utils/*.js   helpers compartidos      src/_template/   punto de partida del próximo provider
```

`src/_utils/` holds everything that is not site-specific — HTTP, the packed-player unpacker, the vimeos,
streamwish and vidhide resolvers, quality inference, the title matcher, the language cut, the stream label
shape, the TMDB key/settings helpers. A provider directory holds only its own flow: `index.js` is the entry
Nuvio calls, `extractor.js` the site logic, `log.js` the prefixed logger, and `scraper.json` the manifest
entry (merged over `scraper-defaults.json`, with `filename` derived).

`build.js` (esbuild, `target: es2016`) bundles each provider into the single file Nuvio loads. `crypto-js`
and `cheerio` stay **external** — Nuvio's plugin runtime provides them, so the artifact carries
`require("crypto-js")` instead of a 200 KB copy, and `async`/`await` in `src/` is lowered to generators on
the way out.

Both `providers/*.js` and the manifest's `scrapers` array are **build output**, and the output directory is
the repo root so the manifest URL Nuvio already has does not move. Editing `providers/*.js` by hand is a
dead end: `npm run build` overwrites them, so edit `src/` and rebuild.

`server.js` (`npm start`) serves the repo over HTTP so a Nuvio *debug build* can load a provider or the
manifest from `:3000` in its Plugin Tester — the loop that replaces pushing for every change.

The external reference for Nuvio's plugin contract is vendored at
[`docs/nuvio-provider-guide.md`](../docs/nuvio-provider-guide.md) (GPL-3.0, `autovalue/nuvio-plugins`). It
describes the guide's own layout, which differs from ours in the build command and the provider directory
shape; where they disagree, this spec and the code win, and the vendored header says so.

## The Nuvio runtime contract

Nuvio executes a provider inside QuickJS, wrapped in a function, and expects `getStreams` back. The
contract shapes every provider:

- **Injected globals.** `TMDB_API_KEY` and `SCRAPER_SETTINGS` arrive as globals. A provider must read them
  through `typeof`-guards and must never declare them locally — a local declaration shadows the injected
  one and silently disables it.
- **Settings round-trip.** `onSettings` returns field descriptors; Nuvio renders them in the plugin UI and
  hands the saved values back in `SCRAPER_SETTINGS`. The manifest entry needs `hasSettings: true`.
- **A 60 s budget, and it waits.** Nuvio waits for every pending request before showing results, so an
  unresolved fetch costs the whole provider's output. That is why links are never probed
  ([goal](goal#non-goals)).
- **The player is libmpv.** A URL that libmpv refuses is a dead stream, whatever its HTTP status.
- **The target runtime is Nuvio's plugin host, including FireTV.** Hermes on FireTV lacks `Buffer` and may
  lack `AbortController`, `String.prototype.normalize` and recent `Promise` combinators, so a provider folds
  accents with a table, builds URLs by hand, and sticks to promise chains — no `Promise.any`, no
  `allSettled`, no `matchAll`, no npm `require`.
- **Return, don't throw.** `getStreams` resolves to `[]` on failure, logging through `console.warn`, so one
  broken provider never blanks a user's stream list.

## Invariants

- Providers are independent **as built**: no built provider requires another, and the single file Nuvio
  loads carries everything it needs. Sharing happens at build time through [utils](utils), never at runtime,
  and a site file must not reach into another site's code.
- [utils](utils) knows nothing about any site: it holds the parts every site repeats and nothing that only one
  site needs. When a second site needs a helper, it moves there instead of being copied again.
- A provider that addresses titles by id works without any key; a provider that addresses them by a
  site-derived slug needs TMDB metadata, declares the settings field, and returns `[]` with a warning when
  no key is available.
- Providers never declare Nuvio's injected globals.
- Network access happens only inside `getStreams` and its helpers; page parsing functions are pure, so a
  throwaway script can drive them against saved or live HTML.
- A provider exports `getStreams` (and `onSettings` when it needs a key), plus a `_test` object with its
  parser functions for ad-hoc checks.
- The manifest entry is the source of truth for a provider's identity; a provider file that no manifest
  entry names is unreachable by Nuvio.

## Verification

The repo keeps no test suite; verification is the build and the app.

- `npm run build` proves the sources bundle and the manifest matches `src/` — nothing more.
- Nuvio's Plugin Tester (`npm start`, then the debug build's Developer Section) runs the provider on the
  same Hermes as the shipped app, so it is the gate: a Node run can pass while the plugin fails on device
  (a Node-only module, an unsupported syntax, a top-level throw).
- A throwaway `test.js` at the root covers anything in between, and is gitignored.

The cost is honest: a site layout change or a dead CDN is only noticed when someone runs the provider
there, not by a green suite.

## Providers

- [sololatino](sololatino) — embed69-backed Latino / Castellano / subtitled source (Vidhide plays).
- [hackstore](hackstore) — hackstore2.com API, Vimeos and Streamwish (Vimeos plays).
- [cinecalidad](cinecalidad) — cinecalidad.vg movie slugs, Vimeos and Streamwish (Vimeos plays).
- [vimeus](vimeus) — vimeus.com keyed by TMDB id, no API key needed (Vimeos plays).

## Sites without a provider

Of the Latin sites surveyed, some are not worth a provider: `xupalace.org` redirects to `embed69.org`, so
it is the same backend as [sololatino](sololatino); `detodopeliculas.nu` answers Cloudflare 403. A site
only earns a provider when it reaches a different backend or a different catalogue.
