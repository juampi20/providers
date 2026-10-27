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
- **Quality.** `inferQuality` reads the tier list out of a multi-quality master URL, so a label costs no
  request; anything unrecognised is `Auto` rather than a lie.
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
