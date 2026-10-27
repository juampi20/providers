---
id: core
type: module-design
status: draft
title: Shared provider core
parent: architecture
---

## Responsibility

Everything the providers would otherwise repeat: HTTP with the browser `User-Agent`, the packed-player
unpacker, the vidhide/streamwish/vimeos resolvers, quality inference, slug folding, base64 decoding, the
language cut, and the TMDB key/settings plumbing. Compiled into each built provider — this file is the one
place a shared fix goes.

## Boundary

Knows nothing about any site. No provider id, no site URL, no site-specific selector may live here: those
belong to the site file, which imports from here and never the other way. A helper joins this file when a
second site needs it, not in anticipation of one.

Constraints inherited from [architecture](architecture#the-nuvio-runtime-contract): no `Buffer`, no
`atob` assumption, no `String.prototype.normalize`, no `Promise.any`/`allSettled`/`matchAll`, promise
chains rather than `async`/`await`.

## What it decides

- **Playable links.** `packedLinks` unpacks the player and keeps only `hls2`/`hls3` — `hls4` segments carry
  a PNG header libmpv refuses — and it never probes a link, because Nuvio waits on every pending request
  ([goal](goal#non-goals)). `resolveStreamWish` is `packedLinks` behind the `vibuxer.com` rewrite.
- **Quality.** `inferQuality` reads the tier list out of a multi-quality master URL, so a label costs no
  request; anything unrecognised is `Auto` rather than a lie.
- **The language cut.** `groupByLanguage` + `resolveFirstLanguage` implement the recorded rule — one
  language per call, in the order the site file passes, stopping at the first that resolves — so a site
  cannot accidentally reintroduce "fetch everything".
- **The id/keys contract.** `tmdbApiKey` reads `SCRAPER_SETTINGS` then the injected `TMDB_API_KEY`, never
  declaring either; `tmdbSettings` renders the field Nuvio shows.
- **`labeled`** shapes a stream (`name`, `<language> - <server>`, numbered suffix per extra link) so every
  provider reports the same way to Nuvio.

## Testing

Covered through the provider tests that exercise each helper against real fixtures (`unpack` and the
resolvers via the vidhide/vimeos fixtures, `inferQuality` and `buildSlug` directly, the cut via the
two-language page tests). Nothing here is tested in isolation for its own sake.
