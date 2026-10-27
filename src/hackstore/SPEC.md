---
id: hackstore
type: module-design
status: draft
title: HackStore provider
parent: architecture
---

## Responsibility

Turn a TMDB id into playable Vimeos and Streamwish streams from hackstore2.com
(`providers/hackstore.js`, one manifest entry, movies and episodes). The site exposes a REST API that
answers the player list as JSON, so only the players themselves are parsed — there is no page scraping.

## Boundary

Lives in `src/providers/hackstore.js` and ships as the built `providers/hackstore.js`. It owns the site's API calls
and slug rules and takes HTTP, the unpacker, the language cut and quality inference from [utils](utils); no
npm dependency, no import of another site.

## Resolving a title

HackStore has no search endpoint: a title is addressed by a slug it derives itself.

- **Movies** — `pelicula-slug-<year>`, looked up at `api/rest/single?post_name=…&post_type=movies`, which
  answers the post id in `data._id`.
- **Episodes** — `<series-slug>-temporada-<season>-episodio-<episode>` (no year, no zero padding) against
  `post_type=episodes`, which answers one level deeper, in `data.episode._id`.

The slug is the **Spanish** title, so it comes from TMDB (`language=es-MX`): **this provider cannot resolve
without a TMDB key**, from the plugin settings or Nuvio's injected `TMDB_API_KEY`. Without one it returns
`[]` and warns, which is the recorded cost of a slug-addressed site.

The player list then comes from `api/rest/player?post_id=…` as `[{ url, lang, quality }]` — the language is
the site's own, so the cut is on real data, not a guess ([goal](goal#principles)). Castilian spellings the
site uses (`Castellano`, `Latinoamericano`) are folded onto the three canonical names.

The `single` endpoint also returns the post's title, and that is checked before its id is used: every
harvested title is tried as a slug, and `core.bestTitleMatch` has to accept the title that comes back
(otherwise `[]`). A colliding slug would otherwise hand back another movie's players, and episodes are
matched with the season as well, so "temporada 4" is not accepted for a season 1 request.

## Servers

Only hosts with a resolver become streams; everything else is dropped before any request.

- **Vimeos** — the embed serves a packed player whose m3u8 sits in the unpacked source as a bare string.
  Requested with the site's own `Referer`.
- **Streamwish** — mirrors are rewritten to `vibuxer.com/e/<id>`, the packed player is unpacked, and only
  `hls2`/`hls3` survive (`hls4` segments carry a PNG header libmpv refuses). Known to hand out dead CDN
  links; kept because it costs nothing and may recover.
- **VOE is not resolved** ([goal](goal#non-goals)), and neither are hosts with no resolver (`doodstream`, …).

`quality` is read from the tier list inside a multi-quality master URL (`_,n,h,.urlset`) — a pure function,
so no link is ever probed. A URL with no tier and no `<n>p` in it reports `Auto`.

Streams are labelled as [utils](utils) shapes them — `name` = `Provider • CALIDAD • Servidor`, `title` = the
language, numbered suffix in `title` when one server yields several links — and carry the player
`User-Agent` plus the embed `Referer` the CDN expects.
