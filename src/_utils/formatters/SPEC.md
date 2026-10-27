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

- **`standard`** (active): `Provider • Idioma • Servidor`, with the server numbered when one server yields
  several links (`Vidhide 2`). Quality stays in `quality`; `title` mirrors the language for clients that read
  it. This is the shape Nuvio draws.
- **`compact`**: `Provider • Idioma` with the server in `title`, for clients that show `title` instead of
  `quality`.
- **`verbose`**: `Provider • Idioma • Servidor • CALIDAD`, for a client that never renders `quality`.

Switching is `DEFAULT_FORMATTER` in `formatters.js`; it changes every provider at once, which is the point.

## Known rough edge

When the link carries no quality the field says `Auto`, so the second line reads `Auto`. It is honest
(nothing was measured) but noisy; suppressing it would mean sending an empty `quality`, which the client also
uses for sorting.
