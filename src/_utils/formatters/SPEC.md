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
fields this repo can measure: `provider`, `server`, `language`, `languageTag`, `quality`, `resolution`,
`protocol`, `index`, `star`, and the media (`title`, `year`, `seasonEpisode`). A part that resolves to nothing
is dropped, so one config reads right for a movie and for an episode.

The layout follows AnimES: what qualifies the row sits on top, what describes the source sits under it. Nuvio
draws `name` on the first line and `quality` on the second, so the formatter's `line2` is what travels in the
`quality` field.

- **`standard`** (active):
  ```
  ⭐ AnimeAV1 • S1E1
     MP4Upload · Subtitulado · 1080p
  ```
  description: `One Piece (1999) · S1E1 · Subtitulado · MP4Upload · 1080p`
- **`compact`**: everything on the first line, only the quality below.
- **`verbose`**: quality also on the first line, resolution below.

`languageTag` is the language unless it is Latino, the normal case in this catalogue and therefore noise. The
star only appears on a stream whose quality was measured well (`variants.js` `best`).

## Trade-off worth knowing

Because `line2` travels in the `quality` field, that field no longer holds a bare quality: a client that sorts
or filters by it sees `MP4Upload · Subtitulado · 1080p`. The measured value is kept beside it in
`measuredQuality` (and in `fields.quality`) for anything that needs the plain number.
