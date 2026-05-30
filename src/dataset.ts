import type { DataCore } from './client.js';
import type { Column, DatasetMetadata, FetchParams } from './types.js';

export type Row = Record<string, unknown>;

interface RawListEnvelope<T> { data?: T[]; rows?: T[]; results?: T[]; }
function unwrapRows<T>(p: T[] | RawListEnvelope<T>): T[] {
  return Array.isArray(p) ? p : (p.data ?? p.rows ?? p.results ?? []);
}

export class Dataset {
  constructor(private readonly client: DataCore, public readonly id: string) {}

  async metadata(): Promise<DatasetMetadata> {
    return this.client.request<DatasetMetadata>('GET', `/datasets/${encodeURIComponent(this.id)}`);
  }
  async schema(): Promise<Column[]> {
    const d = await this.client.request<Column[] | { columns: Column[] }>('GET', `/datasets/${encodeURIComponent(this.id)}/schema`);
    return Array.isArray(d) ? d : (d.columns ?? []);
  }
  async sample(n = 10): Promise<Row[]> {
    const d = await this.client.request<Row[] | RawListEnvelope<Row>>('GET', `/datasets/${encodeURIComponent(this.id)}/sample`, { query: { n } });
    return unwrapRows(d);
  }
  async fetch(params: FetchParams = {}, page = 1, limit = 100): Promise<Row[]> {
    const q: Record<string, string | number | boolean | undefined | null> = { page, limit };
    for (const [k, v] of Object.entries(params)) {
      if (v == null) continue;
      if (k === 'symbols' && Array.isArray(v)) { q.symbols = (v as unknown[]).join(','); }
      else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') { q[k] = v; }
      else { q[k] = JSON.stringify(v); }
    }
    const d = await this.client.request<Row[] | RawListEnvelope<Row>>('GET', `/datasets/${encodeURIComponent(this.id)}/data`, { query: q });
    return unwrapRows(d);
  }
  async fetchAll(params: FetchParams = {}, opts: { limit?: number; maxRows?: number } = {}): Promise<Row[]> {
    const limit = opts.limit ?? 100;
    const pages: Row[][] = []; let page = 1; let total = 0;
    for (;;) {
      const chunk = await this.fetch(params, page, limit);
      if (!chunk.length) break;
      if (opts.maxRows != null && total + chunk.length >= opts.maxRows) { pages.push(chunk.slice(0, opts.maxRows - total)); break; }
      pages.push(chunk); total += chunk.length;
      if (chunk.length < limit) break;
      page++;
    }
    return pages.flat();
  }
  async *stream(params: FetchParams = {}, opts: { limit?: number } = {}): AsyncIterableIterator<Row> {
    const limit = opts.limit ?? 100; let page = 1;
    for (;;) { const rows = await this.fetch(params, page, limit); for (const row of rows) yield row; if (rows.length < limit) break; page++; }
  }
}
