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
src/core.js          ──┐
src/providers/*.js     ─┴─▶ npm run build (esbuild) ──▶ providers/<site>.js ──▶ Nuvio
                                                 ▲
                            test/<site>.test.js (fixtures)   scripts/<site>-live.js (real sites)
```

`src/core.js` holds everything that is not site-specific — HTTP, the packed-player unpacker, the vimeos and
streamwish resolvers, quality inference, slug folding, the language cut, the TMDB key/settings helpers. A
site file holds only its own flow: ids, URLs, page parsing, which servers it trusts. esbuild bundles core
and the site file into the single file Nuvio loads, `crypto-js` included, so the artifact issues no runtime
`require` — that is what makes it safe on FireTV.

`manifest.json` points at the built files. Editing `providers/*.js` by hand is a dead end: `npm run build`
overwrites them, and `npm test` builds before it tests, so the tests always run against what would ship.
The `_test` export surface a provider exposes is what the tests and the live scripts call.

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
  loads carries everything it needs. Sharing happens at build time through [core](core), never at runtime,
  and a site file must not reach into another site's code.
- [core](core) knows nothing about any site: it holds the parts every site repeats and nothing that only one
  site needs. When a second site needs a helper, it moves there instead of being copied again.
- A provider that addresses titles by id works without any key; a provider that addresses them by a
  site-derived slug needs TMDB metadata, declares the settings field, and returns `[]` with a warning when
  no key is available.
- Providers never declare Nuvio's injected globals.
- Network access happens only inside `getStreams` and its helpers; HTML parsing functions are pure, so
  fixtures can drive them.
- `module.exports` always exposes `getStreams` and `onSettings`, plus a `_test` object for the offline
  tests and the live script.
- The manifest entry is the source of truth for a provider's identity; a provider file that no manifest
  entry names is unreachable by Nuvio.

## Verification

`npm test` builds first and then runs `node --test` against saved fixtures — so the artifact under test is
the one that would ship, and the run stays network-free: it catches parser regressions from site layout
changes but not site-side outages. The per-site live scripts skip TMDB and hit the real pages, the only
check that notices a source going dark.

## Providers

- [sololatino](sololatino) — embed69-backed Latino / Castellano / subtitled source (Vidhide plays).
- [hackstore](hackstore) — hackstore2.com API, Vimeos and Streamwish (Vimeos plays).
- [cinecalidad](cinecalidad) — cinecalidad.vg movie slugs, Vimeos and Streamwish (Vimeos plays).

## Sites without a provider

Of the Latin sites surveyed, some are not worth a provider: `xupalace.org` redirects to `embed69.org`, so
it is the same backend as [sololatino](sololatino); `detodopeliculas.nu` answers Cloudflare 403. A site
only earns a provider when it reaches a different backend or a different catalogue.
