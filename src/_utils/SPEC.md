---
id: utils
type: module-design
status: draft
title: Shared provider utilities (src/_utils)
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

Constraints inherited from the runtime contract: no `Buffer`, no
`atob` assumption, no `String.prototype.normalize`, no `Promise.any`/`allSettled`/`matchAll`, promise
chains rather than `async`/`await`.

## What it decides

- **Playable links.** `packedLinks` unpacks the player and keeps only `hls2`/`hls3` — `hls4` segments carry
  a PNG header libmpv refuses — and it never probes a link, because Nuvio waits on every pending request
  (a recorded non-goal). `resolveStreamWish` is `packedLinks` behind the `vibuxer.com` rewrite.
- **Liveness.** `verify.js` acts on requests the resolvers already make: an HLS stream is verified by the
  manifest fetch in `variants.js`, a direct file by the HEAD that measures its size. A stream whose own request
  failed is dropped instead of offered, and both verdicts are cached for 30 minutes — a dead CDN costs one
  request per session, not one per search. No stream is probed beyond that, and nothing waits on a link that
  has not already been fetched.
- **Quality.** `variants.js` reads an HLS master once and returns its highest `RESOLUTION` variant, labelling
  the stream with that real height. The masters these CDNs hand out list variants lowest first
  (`852x480 → 1280x720 → 1920x1080`), so handing the master over and guessing a label from the URL's tier
  letters produced rows that said 1080p while the player showed 480p. A link that is already a media playlist
  keeps whatever its URL says, and `Auto` when it says nothing. Costs one text request per stream, no segment
  is ever touched, and `resolverFor` applies it to every resolver so no provider can skip it.
- **The language cut.** `groupByLanguage` + `resolveFirstLanguage` implement the recorded rule — one
  language per call, in the order the site file passes, stopping at the first that resolves — so a site
  cannot accidentally reintroduce "fetch everything".
- **The id/keys contract.** `tmdbApiKey` reads `SCRAPER_SETTINGS` then the injected `TMDB_API_KEY`, never
  declaring either; `tmdbSettings` renders the field Nuvio shows.
- **`labeled`** shapes a stream through a formatter ([formatters](formatters)): `name` carries provider,
  language and server, `quality` travels in its own field, and `title` mirrors the language. Nuvio draws
  `name` on the first line and `quality` on the second and never shows `title`, so putting quality in the
  name is what made every row read "1080P" above and "1080p" below while the language stayed invisible.

- **Which title is this?** `titlesFor` harvests the Spanish title, the original one and the regional
  alternatives from TMDB in three parallel requests; `titleSimilarity` scores word sets rather than
  substrings; `bestTitleMatch` returns `null` below `TITLE_MATCH_THRESHOLD` (0.7) and drops a candidate
  whose year is off by more than one. Returning nothing is the recorded preference over returning another
  title's streams (a recorded product principle); the threshold is the only knob, and it is strict on purpose.

## Testing

El repo no mantiene una suite. Estos módulos se comprueban contra el sitio real desde el Plugin Tester, o con
un `test.js` temporal en la raíz que llame a un provider y mire lo que devuelve.
