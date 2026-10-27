---
id: cinecalidad
type: module-design
status: draft
title: CineCalidad provider
---

## Responsibility

Turn a TMDB movie id into playable Vimeos and Streamwish streams from cinecalidad.vg
(`providers/cinecalidad.js`, one manifest entry). Movies only — the site carries no episodes, and the
provider answers `[]` for `tv` without touching the network.

## Boundary

Lives in `src/providers/cinecalidad.js` and ships as the built `providers/cinecalidad.js`. It owns slug guessing and
the year guard, and takes HTTP, base64 decoding, the unpacker, the resolvers and quality inference from
[utils](utils); no npm dependency, no import of another site.

## Resolving a movie

The site has no search endpoint: a movie is addressed by its own slug, `pelicula/<slug>/`, whose naming
follows the site's taste rather than TMDB's (often the English title). So the provider harvests every title
TMDB knows for the id — Spanish, original and regional alternatives — turns each into a slug candidate,
requests them all at once, and lets the matcher decide.

1. `titlesFor` gives the title set and the release year (see [utils](utils)).
2. Up to three slugs × `''`/`'-2'`/`'-3'` are requested in parallel — the site appends a counter when two
   movies collide — and only the pages that actually carry players are kept.
3. `core.bestTitleMatch` scores each page's `<h1>` against the title set, with the year as a bonus and veto,
   and **returns nothing below the threshold**.

That last rule is the one that earns its keep: `pelicula/origen/` is *El Origen (2010)* while
`pelicula/el-origen/` is *El origen de los guardianes (2012)*. Matching on titles finds the first and
refuses the second; guessing a single slug would have picked whichever one the title happened to spell. A
movie the site does not carry still returns `[]` — the site's catalogue is the limit, no longer the
spelling of a slug.

The provider needs a TMDB key (plugin settings or Nuvio's injected `TMDB_API_KEY`) for the same reason
[hackstore](hackstore) does: the slug is built from a title.

## Players

The movie page carries each player as a base64-encoded `data-src` attribute. Decoding is done by hand
rather than with `atob` or `Buffer`, neither of which is reliable on FireTV's Hermes.

Hosts with a resolver become streams; everything else (`voe.sx`, `doodstream`, …) is dropped before any
request is made.

- **Vimeos** — packed player; the m3u8 sits in the unpacked source. Playable, verified live.
- **Streamwish** — mirrors are rewritten to `vibuxer.com/e/<id>`, the packed player is unpacked, only
  `hls2`/`hls3` survive. Known to hand out dead CDN links; kept because it costs nothing and may recover.

`quality` is read from the tier list inside the master URL — a pure function, nothing is probed. The site
carries no language metadata, so every stream is labelled `Latino` and the language cut is a no-op here
(a recorded product principle).

The site also links some players through an intermediate page (a `btn_enlace` button) instead of a direct
player host. That path is **not** followed: those embeds look like unknown hosts and are dropped. Only
seen on pages where a direct player is absent, so it costs coverage, not correctness.
