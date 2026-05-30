# Changelog

## [0.1.0] - 2025-05-30

### Features

- Initial release
- `DataCore` client with retry and exponential back-off
- `DataCore.preview()` — no API key required
- `Dataset.fetch()` — single page with explicit pagination
- `Dataset.fetchAll()` — auto-paginates all pages
- `Dataset.stream()` — async iterator, constant memory
- `Dataset.download()` — write pages to CSV or NDJSON (Node.js)
- `Dataset.count()` — get row count without pulling data
- `Dataset.metadata()`, `schema()`, `sample()`
- Full error hierarchy: `AuthenticationError`, `NotFoundError`, `RateLimitError`, `ValidationError`, `ServerError`
- Works in Node.js 18+, Deno, Bun, and modern browsers
