# @datacore/sdk

Official JavaScript / TypeScript client for [DataCore](https://datacore.vn). Works in Node.js 18+, Deno, Bun, and browsers.

## Installation

```bash
npm install @datacore/sdk
```

## Quick start

```ts
import { DataCore } from '@datacore/sdk';

const dc = new DataCore({ apiKey: process.env.DATACORE_API_KEY });

// Fetch all VN30 daily rows for 2024 (auto-paginates)
const rows = await dc.dataset('equity.vn30.daily').fetchAll({
  start: '2024-01-01',
  end: '2024-12-31',
});
```

## Preview without an API key

```ts
const rows = await DataCore.preview('equity.vn30.daily', 5);
```

## Pagination

```ts
const all = await dc.dataset('equity.vn30.daily').fetchAll({ start: '2024-01-01' });

for await (const row of dc.dataset('equity.vn30.daily').stream({ start: '2024-01-01' })) {
  console.log(row);
}
```

## License

MIT