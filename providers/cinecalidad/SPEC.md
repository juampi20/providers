---
id: cinecalidad
type: module-design
status: draft
title: CineCalidad provider
parent: architecture
---

## Responsibility

Turn a TMDB movie id into playable Vimeos and Streamwish streams from cinecalidad.vg
(`providers/cinecalidad.js`, one manifest entry). Movies only — the site carries no episodes, and the
provider answers `[]` for `tv` without touching the network.

## Boundary

Lives in `src/providers/cinecalidad.js` and ships as the built `providers/cinecalidad.js`. It owns slug guessing and
the year guard, and takes HTTP, base64 decoding, the unpacker, the resolvers and quality inference from
[core](core); no npm dependency, no import of another site.

## Resolving a movie

The site has no search endpoint: a movie is addressed by its own slug, `pelicula/<slug>/`.

1. TMDB (`language=es-MX`) gives the Spanish title and the original title plus the release year.
2. Every title × `''`/`'-2'`/`'-3'` variant is requested **at once** — the site appends a counter when two
   movies collide — and only the pages that actually carry players are kept.
3. The page's `<h1>` carries its release year. A page whose year contradicts TMDB is **dropped, not used**:
   handing back another movie's streams is worse than handing back none. A page whose `<h1>` has no year
   cannot be disproved and is accepted.

That last rule matters in practice: the site's slugs follow its own naming (often the English title), so a
slug collision can serve a different movie entirely. The consequence is a known limitation — **coverage
depends on TMDB's titles reproducing the site's slug**. When they don't, the provider returns `[]`.

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
([goal](goal#principles)).

The site also links some players through an intermediate page (a `btn_enlace` button) instead of a direct
player host. That path is **not** followed: those embeds look like unknown hosts and are dropped. Only
seen on pages where a direct player is absent, so it costs coverage, not correctness.
