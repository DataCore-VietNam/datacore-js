# Changelog

## [0.2.0](https://github.com/DataCore-VietNam/datacore-js/compare/sdk-v0.1.0...sdk-v0.2.0) (2026-05-30)


### Features

* upgrade .github/workflows/ci.yml ([c4c353c](https://github.com/DataCore-VietNam/datacore-js/commit/c4c353c408d7137986065135c894d4f640fb8381))
* upgrade examples/quickstart.ts ([779a54a](https://github.com/DataCore-VietNam/datacore-js/commit/779a54adf6f2c9bde54e4b7e8e7cab43affde40b))
* upgrade README.md ([09b22f5](https://github.com/DataCore-VietNam/datacore-js/commit/09b22f54b098c403af78ba61fd1d2c9e7aa5ca28))
* upgrade src/client.ts ([87bd80a](https://github.com/DataCore-VietNam/datacore-js/commit/87bd80a315a8ebabe1e06b3ec14babc92bd824e0))
* upgrade src/dataset.ts ([ad344cd](https://github.com/DataCore-VietNam/datacore-js/commit/ad344cd46e36073169e0f049e618c999061d6af2))
* upgrade src/types.ts ([49d06e9](https://github.com/DataCore-VietNam/datacore-js/commit/49d06e9db5bff1dc8b64c931dd9c29d86c38c726))


### Bug Fixes

* crypto.randomUUID compatibility + explicit err type ([9b5c534](https://github.com/DataCore-VietNam/datacore-js/commit/9b5c5348646747390168ce3049e1895cf1322ea3))
* crypto.randomUUID compatibility + explicit err type ([0cc1ab4](https://github.com/DataCore-VietNam/datacore-js/commit/0cc1ab4cd9723bd901ad86888036b441570a8aec))
* npm install instead of npm ci (no lockfile yet) ([4ed3ca6](https://github.com/DataCore-VietNam/datacore-js/commit/4ed3ca6ded47c7d203fc9f63361aa8065f62b120))
* simplify eslint config to avoid type-check requirement ([e3f170d](https://github.com/DataCore-VietNam/datacore-js/commit/e3f170d0724ddc466acce77117030001a1eb17e6))

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
