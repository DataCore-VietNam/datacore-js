# @datacore/sdk

Official JavaScript / TypeScript client for [DataCore](https://datacore.vn) — Vietnamese financial and alternative data.

[![CI](https://github.com/DataCore-VietNam/datacore-js/actions/workflows/ci.yml/badge.svg)](https://github.com/DataCore-VietNam/datacore-js/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@datacore/sdk.svg)](https://www.npmjs.com/package/@datacore/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Works in **Node.js 18+**, **Deno**, **Bun**, and modern **browsers**. Fully typed. Auto-retries on 429 and 5xx.

## Installation

```bash
npm install @datacore/sdk
# or
yarn add @datacore/sdk
# or
pnpm add @datacore/sdk
```

## Authentication

Get a free API key at [datacore.vn/keys](https://datacore.vn/keys).

```bash
# Recommended: set in environment — never hardcode keys
export DATACORE_API_KEY=dc_...
```

```ts
// Or pass explicitly
const dc = new DataCore({ apiKey: process.env.DATACORE_API_KEY });
```

## Quick start

```ts
import { DataCore } from '@datacore/sdk';

const dc = new DataCore({ apiKey: process.env.DATACORE_API_KEY });

// Fetch all VN30 daily rows for 2024 — auto-paginates
const rows = await dc.dataset('equity.vn30.daily').fetchAll({
  start: '2024-01-01',
  end:   '2024-12-31',
});
console.log(rows.length, 'rows');
```

## Preview without an API key

```ts
// No API key required — public preview endpoint
const sample = await DataCore.preview('equity.vn30.daily', 5);
```

## Pagination

```ts
// Single page (explicit control)
const page2 = await dc.dataset('equity.vn30.daily').fetch(
  { start: '2024-01-01' },
  2,   // page
  100, // limit
);

// All pages combined into one array
const all = await dc.dataset('equity.vn30.daily').fetchAll({ start: '2024-01-01' });

// Cap at 500 rows
const capped = await dc.dataset('equity.vn30.daily').fetchAll(
  { start: '2023-01-01' },
  { maxRows: 500 },
);

// Stream row by row — constant memory regardless of dataset size
for await (const row of dc.dataset('equity.vn30.daily').stream({ start: '2024-01-01' })) {
  process(row);
}
```

## Download to file (Node.js)

```ts
const result = await dc.dataset('equity.vn30.daily').download('./vn30_2024.csv', {
  start: '2024-01-01',
  end:   '2024-12-31',
});
console.log(`${result.rowsWritten} rows, ${result.bytesWritten} bytes`);

// NDJSON format
await dc.dataset('equity.vn30.daily').download('./vn30_2024.ndjson', {}, { format: 'ndjson' });
```

## Catalog browsing

```ts
const domains  = await dc.listDomains();
const products = await dc.listProducts('equity');
const datasets = await dc.listDatasets({ product: 'vn30' });
const results  = await dc.search('VN30 fundamentals', 10);

const meta   = await dc.dataset('equity.vn30.daily').metadata();
const schema = await dc.dataset('equity.vn30.daily').schema();
const sample = await dc.dataset('equity.vn30.daily').sample(5);
const count  = await dc.dataset('equity.vn30.daily').count({ start: '2024-01-01' });
```

## Retry behavior

The client automatically retries failed requests (429 and 5xx) with
exponential back-off. The `Retry-After` header is respected on 429 responses.

```ts
const dc = new DataCore({
  apiKey: process.env.DATACORE_API_KEY,
  maxRetries: 5,    // default: 3
  timeout:    60_000, // ms, default: 30000
});
```

## Error handling

All errors extend `DataCoreError`:

```ts
import { DataCore, DataCoreError, RateLimitError, AuthenticationError } from '@datacore/sdk';

try {
  await dc.dataset('equity.vn30.daily').fetchAll();
} catch (err) {
  if (err instanceof RateLimitError) {
    console.log('Rate limited, retry after', err.retryAfter, 's');
  } else if (err instanceof AuthenticationError) {
    console.error('Check your API key');
  } else if (err instanceof DataCoreError) {
    console.error(err.message, 'HTTP', err.status);
  }
}
```

| Class | Status | When |
|---|---|---|
| `AuthenticationError` | 401/403 | Missing or invalid API key |
| `NotFoundError` | 404 | Dataset does not exist |
| `RateLimitError` | 429 | Too many requests; has `.retryAfter` (seconds) |
| `ValidationError` | 4xx | Bad request parameters |
| `ServerError` | 5xx | Server-side error |

## API reference

### `new DataCore(opts)`

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string` | `DATACORE_API_KEY` env | DataCore API key |
| `baseUrl` | `string` | `https://api.datacore.vn/v1` | Override API base URL |
| `timeout` | `number` | `30000` | Per-request timeout (ms) |
| `maxRetries` | `number` | `3` | Max retries on 429/5xx |
| `fetch` | `FetchLike` | `globalThis.fetch` | Custom fetch implementation |

### `DataCore` static methods

| Method | Key required | Description |
|---|---|---|
| `DataCore.preview(id, n?)` | No | Preview rows, public endpoint |

### `DataCore` instance methods

| Method | Description |
|---|---|
| `dc.dataset(id)` | Get a Dataset handle (no network call) |
| `dc.search(query, limit?)` | Free-text catalog search |
| `dc.listDomains()` | List all data domains |
| `dc.listProducts(domain)` | Products within a domain |
| `dc.listDatasets(opts?)` | List datasets, optionally filtered by product |
| `dc.isAuthenticated()` | Returns `true` if an API key is configured |

### `Dataset` methods

| Method | Description |
|---|---|
| `ds.fetch(params?, page?, limit?)` | One page of rows |
| `ds.fetchAll(params?, opts?)` | All pages combined into one array |
| `ds.stream(params?, opts?)` | Async iterator, auto-paginates (constant memory) |
| `ds.download(path, params?, opts?)` | Download to CSV or NDJSON file (Node.js) |
| `ds.count(params?)` | Total row count for filter |
| `ds.sample(n?)` | Random sample rows |
| `ds.schema()` | Column schema |
| `ds.metadata()` | Full dataset metadata |

## License

MIT
