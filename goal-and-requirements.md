---
id: goal
type: goal-and-requirements
status: draft
title: Nuvio Providers — personal provider collection
---

## Goal

A personal Nuvio plugin repository that adds Spanish-language stream sources Nuvio does not ship itself.
Nuvio installs it from `manifest.json` and runs each provider as a separate plugin.

## Problem

Nuvio's built-in providers don't cover Latino / Castellano / subtitled sources, and its TMDB-only lookup
path leaves gaps for titles that only exist in the Spanish-language scene. The sources that do carry them
(embed69-backed players) need per-site work — proof-of-work decryption, packed players, mirror juggling —
that no generic scraper handles.

## Audience

The repository owner, installing it into their own Nuvio client (desktop and mobile). Growth to several
providers is a deliberate goal, so the shape stays per-provider-file rather than one monolithic scraper.

## Capabilities

- **Provider collection** — each provider is its own file under `providers/`, listed as an entry in
  `manifest.json`, and independently enabled, versioned, and configured in Nuvio.
- **Stream resolution** — a provider answers `getStreams(tmdbId, mediaType, season, episode)` with a list
  of candidate streams (`name`, `title`, `url`, `quality`, `headers`) that Nuvio's player can play.
- **Per-provider settings** — a provider may declare settings fields (e.g. a TMDB key) that Nuvio renders
  and hands back at call time.
- **SoloLatino** — resolves movies and TV episodes from embed69's player into separate Vidhide and
  Streamwish streams, labelled by language (Latino, Castellano, Subtitulado) and server.
- **HackStore** — resolves movies and episodes from hackstore2.com's API into Vimeos and Streamwish
  streams, labelled by the site's own language.
- **Vimeus** — resolves movies and episodes from vimeus.com, addressed by TMDB id; the only provider that
  needs no API key at all.
- **CineCalidad** — resolves movies from cinecalidad.vg into Vimeos and Streamwish streams (the site
  carries no language metadata, so everything is Latino).
- **Latino first** — a provider resolves one language per call: it tries Latino, then Castellano, then
  Subtitulado, and stops at the first that yields a playable link. Nothing is fetched for the languages
  after it.
- **Verification** — a provider is proved in Nuvio's Plugin Tester, against the real sites, on the same
  engine the app ships. The repo keeps no test suite.

## Non-goals

- **VOE support.** VOE mirrors ask for a human check, so no provider resolves them.
- **Probing stream links.** Links are returned unverified: Nuvio waits for every pending request before
  showing results, and a dead CDN can outlast its 60 s plugin limit. A dead link reaches the user instead
  of stalling the provider.
- **Searching the source site directly.** SoloLatino goes to embed69, the player sololatino.net embeds,
  because the site's own search sits behind Cloudflare.

## Principles

- Each provider stands alone: no provider imports another, and a provider is one self-contained file.
- Spanish coverage beats per-language breadth: latino content is the point, so a provider spends Nuvio's
  time budget on the first language that works instead of collecting every language at once.
- A doubtful result is not returned. When a site is searched by title, the provider matches against every
  title TMDB knows and reports nothing if the match is weak — another title's stream is worse than an empty
  result.
- A label states only what is known: a quality read from the link itself, a language the site declares. No
  guessed codec, audio or HDR.
- Nuvio owns the plugin's runtime. Providers read Nuvio's injected globals instead of declaring them, and
  keep a fallback path that works on builds that inject nothing.
- A provider's parsers are pure functions over HTML, so they can be driven from a throwaway script without
  touching the network.
