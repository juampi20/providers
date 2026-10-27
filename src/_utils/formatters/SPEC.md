---
id: formatters
type: module-design
status: draft
title: Stream formatters
---

## Responsibility

Turn a resolved stream's fields into what the client draws. One place decides field order, separators and
what belongs in `name`, `title` and `quality`, so every provider reports in the same shape and changing the
look is a one-line change here.

## Boundary

Knows nothing about sites or servers: it receives `{ provider, language, server, quality, index }` and
returns the three display fields. Providers call `labeled` ([utils](utils)); no provider composes a label by
itself.

## Why it exists

Nuvio draws `name` on the first line and `quality` on the second, and does not show `title`. A provider that
wrote `Provider • 1080P • Server` as the name produced a list where the quality appeared twice and the
language — the thing that actually distinguishes one row from the next in a Spanish catalogue — appeared
nowhere. The fix is not a per-provider convention but a formatter: language in the name, quality only in its
field.

## The presets

A formatter is a declarative list of parts per line, in the spirit of AIOStreams' formatters but limited to
fields this repo can measure: `provider`, `server`, `language`, `quality`, `resolution`, `protocol`,
`index`, and the media (`title`, `year`, `seasonEpisode`). A part that resolves to nothing is dropped, so one
config reads right for a movie and for an episode.

- **`standard`** (active): name `Provider • S1E1 • Idioma • Servidor`; description
  `Título (año) · S1E1 · Idioma · Servidor · Calidad`. `title` mirrors the language.
- **`compact`**: episode only in `title` and the description, never in the name.
- **`verbose`**: quality also inside the name, for a client that does not draw `quality`.

Switching is `DEFAULT_FORMATTER` in `formatters.js`; it changes every provider at once.

## Where each field comes from

`provider`/`language`/`server` come from the resolver that produced the stream, `quality` and `resolution`
are measured (HLS master `RESOLUTION`, or the mp4's `tkhd`), `protocol` says `hls` or `mp4`, and
`seasonEpisode`/`title`/`year` are supplied by the provider's entry point through `applyContext`, because the
resolver is nested deep inside `extractStreams` and does not know what was asked for.

## The star

`⭐` prefixes the name of a stream that measured at the top of what this repo can prove: 1080p or better on
an HLS variant, or a direct `.mp4` measured at 720p or better (a direct file is the source itself, not a
rendition). It comes from `variants.js`'s `best` flag, so an unmeasured link never earns one — the star means
"verified good", not "looks good". A part written `+star` glues to the following part instead of taking a
separator of its own.

## Known rough edge

When nothing measurable is available the field says `Auto`, so the second line reads `Auto`. It is honest —
nothing was measured — but noisy; suppressing it would mean sending an empty `quality`, which the client also
uses for sorting.
