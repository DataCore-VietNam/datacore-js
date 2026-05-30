import type { DataCore } from './client.js';
import type { Column, DatasetMetadata, FetchParams } from './types.js';

/** A single row returned by the API. */
export type Row = Record<string, unknown>;

interface RawEnvelope<T> { data?: T[]; rows?: T[]; results?: T[]; }
function unwrap<T>(p: T[] | RawEnvelope<T>): T[] {
  return Array.isArray(p) ? p : (p.data ?? p.rows ?? p.results ?? []);
}

/** Result returned by `download()`. */
export interface DownloadResult {
  /** Bytes written (CSV) or rows written (JSON). */
  bytesWritten: number;
  rowsWritten: number;
  pagesDownloaded: number;
}

/**
 * A typed handle to a single DataCore dataset. Obtain one via
 * `client.dataset(id)`. All methods are lazy — no network call is made
 * until you invoke one.
 *
 * ```ts
 * const ds = dc.dataset('equity.vn30.daily');
 *
 * // Preview (no key required)
 * const preview = await DataCore.preview('equity.vn30.daily', 5);
 *
 * // Single page
 * const page = await ds.fetch({ start: '2024-01-01' }, 1, 100);
 *
 * // All pages combined
 * const all = await ds.fetchAll({ start: '2024-01-01', end: '2024-12-31' });
 *
 * // Stream row-by-row (constant memory)
 * for await (const row of ds.stream({ start: '2024-01-01' })) { ... }
 * ```
 */
export class Dataset {
  constructor(private readonly client: DataCore, public readonly id: string) {}

  /** Full metadata: frequency, coverage, columns, tags, etc. */
  async metadata(): Promise<DatasetMetadata> {
    return this.client.request<DatasetMetadata>('GET', `/datasets/${encodeURIComponent(this.id)}`);
  }

  /** Column schema as a typed array. */
  async schema(): Promise<Column[]> {
    const d = await this.client.request<Column[] | { columns: Column[] }>('GET', `/datasets/${encodeURIComponent(this.id)}/schema`);
    return Array.isArray(d) ? d : (d.columns ?? []);
  }

  /** Fetch up to `n` random sample rows. Useful for exploration before pulling the full dataset. */
  async sample(n = 10): Promise<Row[]> {
    const d = await this.client.request<Row[] | RawEnvelope<Row>>('GET', `/datasets/${encodeURIComponent(this.id)}/sample`, { query: { n } });
    return unwrap(d);
  }

  /** Get the total row count for the given filter. Useful for progress estimation before a large `fetchAll()`. */
  async count(params: FetchParams = {}): Promise<number> {
    const query: Record<string, string | number | boolean | undefined | null> = { count_only: true };
    for (const [k, v] of Object.entries(params)) {
      if (v == null) continue;
      query[k] = k === 'symbols' && Array.isArray(v) ? (v as string[]).join(',') : (v as string | number | boolean);
    }
    const d = await this.client.request<{ count: number } | { total: number }>('GET', `/datasets/${encodeURIComponent(this.id)}/data`, { query });
    return (d as { count?: number; total?: number }).count ?? (d as { count?: number; total?: number }).total ?? 0;
  }

  /**
   * Fetch one page of rows.
   *
   * @param params - Date range, symbol list, and any extra query params.
   * @param page   - 1-based page number (default 1).
   * @param limit  - Rows per request (default 100, server maximum).
   */
  async fetch(params: FetchParams = {}, page = 1, limit = 100): Promise<Row[]> {
    const query: Record<string, string | number | boolean | undefined | null> = { page, limit };
    for (const [k, v] of Object.entries(params)) {
      if (v == null) continue;
      if (k === 'symbols' && Array.isArray(v)) { query.symbols = (v as string[]).join(','); }
      else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') { query[k] = v; }
      else { query[k] = JSON.stringify(v); }
    }
    const d = await this.client.request<Row[] | RawEnvelope<Row>>('GET', `/datasets/${encodeURIComponent(this.id)}/data`, { query });
    return unwrap(d);
  }

  /**
   * Fetch ALL rows across all pages and return them as a single array.
   *
   * Automatically paginates until the server signals the last page.
   *
   * @param params       - Date range, symbol list, and extra filters.
   * @param opts.limit   - Rows per request (default 100).
   * @param opts.maxRows - Hard cap on total rows returned.
   *
   * @example
   * ```ts
   * const rows = await dc.dataset('equity.vn30.daily').fetchAll({
   *   start: '2024-01-01', end: '2024-12-31',
   * });
   * ```
   */
  async fetchAll(params: FetchParams = {}, opts: { limit?: number; maxRows?: number } = {}): Promise<Row[]> {
    const limit = opts.limit ?? 100;
    const pages: Row[][] = [];
    let page = 1;
    let total = 0;
    for (;;) {
      const chunk = await this.fetch(params, page, limit);
      if (!chunk.length) break;
      if (opts.maxRows != null && total + chunk.length >= opts.maxRows) {
        pages.push(chunk.slice(0, opts.maxRows - total));
        break;
      }
      pages.push(chunk);
      total += chunk.length;
      if (chunk.length < limit) break;
      page++;
    }
    return pages.flat();
  }

  /**
   * Stream rows one at a time, paginating automatically.
   *
   * Memory usage is constant regardless of dataset size — each page is
   * fetched and yielded before the next is requested.
   *
   * @param params     - Date range, symbol list, and extra filters.
   * @param opts.limit - Rows per page (default 100).
   *
   * @example
   * ```ts
   * for await (const row of dc.dataset('equity.vn30.daily').stream({ start: '2024-01-01' })) {
   *   console.log(row.symbol, row.close);
   * }
   * ```
   */
  async *stream(params: FetchParams = {}, opts: { limit?: number } = {}): AsyncIterableIterator<Row> {
    const limit = opts.limit ?? 100;
    let page = 1;
    for (;;) {
      const rows = await this.fetch(params, page, limit);
      for (const row of rows) yield row;
      if (rows.length < limit) break;
      page++;
    }
  }

  /**
   * Download all rows to a file (Node.js / Deno / Bun only).
   *
   * Writes pages as they arrive — memory usage stays constant regardless
   * of dataset size. Supports CSV and NDJSON (newline-delimited JSON).
   *
   * @param outputPath - Destination file path.
   * @param params     - Date range, symbol list, and extra filters.
   * @param opts.format  - `"csv"` (default) or `"ndjson"`.
   * @param opts.limit   - Rows per page (default 100).
   *
   * @example
   * ```ts
   * const result = await dc.dataset('equity.vn30.daily').download('./vn30_2024.csv', {
   *   start: '2024-01-01', end: '2024-12-31',
   * });
   * console.log(`Downloaded ${result.rowsWritten} rows`);
   * ```
   */
  async download(
    outputPath: string,
    params: FetchParams = {},
    opts: { format?: 'csv' | 'ndjson'; limit?: number } = {},
  ): Promise<DownloadResult> {
    // Dynamic import so this method still type-checks in browser environments
    // (it will throw at runtime if fs is not available).
    const { createWriteStream } = await import('node:fs');
    const format = opts.format ?? 'csv';
    const limit = opts.limit ?? 100;
    const stream = createWriteStream(outputPath, { encoding: 'utf8' });

    let headerWritten = false;
    let rowsWritten = 0;
    let bytesWritten = 0;
    let pagesDownloaded = 0;
    let page = 1;

    const write = (s: string) => { stream.write(s); bytesWritten += Buffer.byteLength(s, 'utf8'); };

    for (;;) {
      const chunk = await this.fetch(params, page, limit);
      if (!chunk.length) break;
      pagesDownloaded++;

      if (format === 'csv') {
        if (!headerWritten && chunk[0]) {
          write(Object.keys(chunk[0]).map(csvEscape).join(',') + '\n');
          headerWritten = true;
        }
        for (const row of chunk) write(Object.values(row).map(csvEscape).join(',') + '\n');
      } else {
        for (const row of chunk) write(JSON.stringify(row) + '\n');
      }
      rowsWritten += chunk.length;
      if (chunk.length < limit) break;
      page++;
    }

    await new Promise<void>((resolve, reject) => stream.end((err: Error|null) => err ? reject(err) : resolve()));
    return { bytesWritten, rowsWritten, pagesDownloaded };
  }
}

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}
