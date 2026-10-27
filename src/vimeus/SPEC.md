---
id: vimeus
type: module-design
status: draft
title: Vimeus provider
---

## Responsibility

Turn a **TMDB id** into playable streams from vimeus.com (`src/vimeus/`, one manifest entry, movies and
episodes). Vimeus answers one page per title whose payload already lists the embeds, so this provider has no
title to match and no search to fake.

## Boundary

Lives in `src/vimeus/` (`index.js` entry, `extractor.js` flow, `log.js`, `scraper.json`) and takes HTTP,
the resolvers, quality inference and the label shape from [utils](utils). It imports no other provider.

## Resolving a title

One request, keyed by id:

```
GET https://vimeus.com/e/movie?tmdb=<id>&view_key=<KEY>
GET https://vimeus.com/e/serie?tmdb=<id>&se=<n>&ep=<n>&view_key=<KEY>
```

The page carries `<script type="text/json" id="data">` with `{ type, title, season, episode, tmdb_id,
embeds: [{ server, url }] }`. That payload is the whole contract: no TMDB metadata, no title similarity, no
Cloudflare. **This is the only provider that needs no TMDB key**, which is also why it has no settings field.

The payload's `server` field is generic (`"Online"`); the real server comes from the embed URL's host, so the
stream is labelled from the resolver that handles it.

## The view key

The site does not publish `view_key`; it is the constant every client sends, kept in `VIEW_KEY`. Without it
the endpoint answers `400`, and a rotated key breaks every Vimeus request until that constant is updated —
the provider's single point of failure. A `400` is therefore turned into an explicit log line
(`view_key rechazada`) instead of a silent empty result.

## Servers

Embeds are resolved by host with the shared resolvers, so vimeos, streamwish and vidhide become streams and
everything else (`voe.sx`, `filemoon`, `goodstream`, `ok.ru`, …) is dropped before a request is made. The
verified path is vimeos: the same embed ids hackstore hands out, which means Vimeus widens the catalogue
rather than adding a new server.

The payload has no language field, so every stream is labelled `Latino` — the catalogue is Latino.

## Known composition

Vimeus is a front over vimeos: *El origen* returns the same `embed-uog0l1cy08dd` that hackstore returns. Its
value is titles hackstore's slug lookup misses, at the cost of one extra request per search.
