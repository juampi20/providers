---
id: embed69
type: module-design
status: draft
title: Embed69 provider
---

## Responsibility

Turn a TMDB id into playable Vidhide and Streamwish streams from embed69 (`providers/sololatino.js`, one
manifest entry). It owns the whole chain: TMDB id → IMDb id → embed69 page → decrypted or scraped server
list → packed-player links.

## Boundary

Lives in `src/providers/sololatino.js` and ships as the built `providers/sololatino.js`. It owns the embed69-specific
parts — the POW/AES page, the `/video/` server list, the IMDb id chain — and takes everything generic from
[utils](utils); it never reaches into another site's file.

## Resolving a title

`getStreams` asks embed69 for `https://embed69.org/video/<id>`, where the id is the IMDb id for a movie and
`<imdb>-<season>x<episode>` for an episode. That page redirects to the encrypted `/f/` layout when the title
is there and otherwise serves a plain server list — the provider parses both, so one request covers both
cases. Embeds it cannot turn into a playable link are dropped before any further fetching.

## Two page layouts

- **Encrypted `/f/`** — the page carries a proof-of-work challenge (`POW_CHALLENGE`, `POW_DIFFICULTY`,
  `POW_SALT`) and a `dataLink` blob. The AES key is `SHA-256(challenge + nonce + salt)`, with the nonce
  brute-forced until `SHA-256(challenge + nonce)` starts with `difficulty` zeros; each embed link is
  base64 of `iv[16] + AES-256-CBC ciphertext`. This is why `crypto-js` is a dependency.
- **Plain `/video/`** — language tabs map a `data-lang` index to a language code, and each
  `playServerVast('<url>')` entry carries its own index. Server names come from the URL host.

Either layout can change without notice; a page that matches neither yields `[]` rather than an error, so a
layout change degrades to "no streams" instead of a crashing plugin.

## Ids and keys

TMDB has no IMDb id, and embed69 keys on IMDb. The lookup order is: the key saved in plugin settings, then
Nuvio's injected `TMDB_API_KEY`, then Wikidata's SPARQL endpoint (P4947 movies / P4983 TV → P345), which
needs no key. Wikidata is also the fallback when TMDB answers without an `imdb_id` — a bad key lands there
too. This exists because Nuvio desktop 1.1.21 injects no key at all.

## Languages

A call returns one language, never a mix. Embeds are grouped by their language code and resolved in the
order Latino, Castellano, Subtitulado — unknown codes last, in page order — and the first group that yields
at least one playable link ends the call: the following groups are never fetched. Within a group, servers
resolve in parallel.

The cut is deliberate, not an oversight: it is what makes one language fit Nuvio's 60 s budget instead of
all of them (a recorded product principle). The cost is that Castellano and Subtitulado go unoffered whenever
latino resolves. Because embed69 states each embed's language on the page, the cut happens before any
resolution — no request is spent discovering that a language is unnecessary.

## Servers

Only Vidhide and Streamwish are playable. Streamwish mirrors serve an obfuscated loader, so the provider
rewrites them to `vibuxer.com/e/<id>`, which serves the same file as a packed player; Vidhide links are used
as-is. Both are then unpacked (Dean Edwards' `p,a,c,k,e,d`) to reach the player's `var links` object, from
which only `hls2` and `hls3` become streams. `hls4` is excluded because its segments carry a PNG header
libmpv refuses; nothing is probed (a recorded non-goal).

Streams are labelled as [utils](utils) shapes them — `name` = `Provider • CALIDAD • Servidor`, `title` = the
language, numbered suffix in `title` when one server yields several links — and carry the player
`User-Agent` plus the embed `Referer` the CDN expects. `quality` comes from the tier list in the link
itself (`_,l,n,h,.urlset`) and is `Auto` when the link carries no tier — a Vidhide `/hls2/…/…_n/master.m3u8`
says nothing a label could repeat, so it says nothing. This is the only provider that bundles a dependency:
`crypto-js` is compiled into the built file, so the artifact has no runtime `require` and works on FireTV.
