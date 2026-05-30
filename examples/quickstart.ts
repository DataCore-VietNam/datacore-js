import { DataCore } from '../src/index.js';

async function main() {
  // Preview without a key
  const preview = await DataCore.preview('equity.vn30.daily', 3);
  console.log('Preview rows:', preview.length);

  const apiKey = process.env.DATACORE_API_KEY;
  if (!apiKey) { console.log('Set DATACORE_API_KEY to run authenticated examples.'); return; }

  const dc = new DataCore({ apiKey, maxRetries: 3 });

  // Catalog
  const domains = await dc.listDomains();
  console.log('Domains:', domains.map(d => d.id).join(', '));

  // Metadata
  const ds = dc.dataset('equity.vn30.daily');
  const meta = await ds.metadata();
  console.log('Dataset:', meta.name, '|', meta.frequency, '|', meta.start, '-', meta.end);

  // FetchAll
  const rows = await ds.fetchAll({ start: '2024-01-01', end: '2024-01-31' });
  console.log('Rows for Jan 2024:', rows.length);

  // Stream first 5
  let n = 0;
  for await (const row of ds.stream({ start: '2024-01-01' })) {
    console.log(row); if (++n >= 5) break;
  }

  // Download to CSV
  const result = await ds.download('./vn30_jan2024.csv', { start: '2024-01-01', end: '2024-01-31' });
  console.log('Downloaded', result.rowsWritten, 'rows,', result.bytesWritten, 'bytes');
}

main().catch(console.error);
