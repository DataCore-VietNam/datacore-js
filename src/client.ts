import { Dataset } from './dataset.js';
import type { Row } from './dataset.js';
import { AuthenticationError, DataCoreError, NotFoundError, RateLimitError, ServerError, ValidationError } from './errors.js';
import type { DataCoreClientOptions, Domain, DatasetStub, FetchLike, Product, SearchResult } from './types.js';

const DEFAULT_BASE_URL = 'https://api.datacore.vn/v1';
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_INITIAL_DELAY_MS = 500;

export interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  signal?: AbortSignal;
  /** Skip automatic retries for this request. */
  noRetry?: boolean;
}

function resolveApiKey(explicit?: string): string | undefined {
  if (explicit) return explicit;
  try {
    if (typeof process !== 'undefined' && process?.env?.DATACORE_API_KEY) return process.env.DATACORE_API_KEY;
  } catch { /* not in Node */ }
  try {
    const g = (globalThis as unknown as Record<string, unknown>).DATACORE_API_KEY;
    if (typeof g === 'string' && g) return g;
  } catch { /* not available */ }
  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * DataCore API client.
 *
 * Automatically retries on 429 (rate limit) and 5xx errors with
 * exponential back-off.
 *
 * ```ts
 * import { DataCore } from '@datacore/sdk';
 *
 * const dc = new DataCore({ apiKey: process.env.DATACORE_API_KEY });
 *
 * // Fetch all VN30 daily data for 2024
 * const rows = await dc.dataset('equity.vn30.daily').fetchAll({
 *   start: '2024-01-01',
 *   end:   '2024-12-31',
 * });
 * ```
 */
export class DataCore {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: FetchLike;

  constructor(opts: DataCoreClientOptions = {}) {
    const apiKey = resolveApiKey(opts.apiKey);
    if (!apiKey) {
      throw new AuthenticationError(
        'Missing DataCore API key. Pass apiKey to new DataCore({...}) or set DATACORE_API_KEY.',
      );
    }
    this.apiKey = apiKey;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.timeout = opts.timeout ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;

    const f = opts.fetch ?? (globalThis as { fetch?: FetchLike }).fetch;
    if (!f) throw new DataCoreError('No fetch implementation. Run on Node 18+, Deno, Bun, or a modern browser, or pass opts.fetch.');
    this.fetchImpl = f;
  }

  /** Returns true if an API key is configured. */
  isAuthenticated(): boolean { return this.apiKey.length > 0; }

  /** Free-text search across the dataset catalog. */
  async search(query: string, limit = 20): Promise<SearchResult[]> {
    const data = await this.request<{ results: SearchResult[] } | SearchResult[]>('POST', '/search', { body: { query, limit } });
    return Array.isArray(data) ? data : (data.results ?? []);
  }

  /** List all data domains. */
  async listDomains(): Promise<Domain[]> {
    const data = await this.request<{ domains: Domain[] } | Domain[]>('GET', '/domains');
    return Array.isArray(data) ? data : (data.domains ?? []);
  }

  /** List products within a domain. */
  async listProducts(domain: string): Promise<Product[]> {
    if (!domain) throw new ValidationError('`domain` is required');
    const data = await this.request<{ products: Product[] } | Product[]>('GET', `/domains/${encodeURIComponent(domain)}/products`);
    return Array.isArray(data) ? data : (data.products ?? []);
  }

  /** List datasets, optionally filtered by product. */
  async listDatasets(opts: { product?: string } = {}): Promise<DatasetStub[]> {
    const data = await this.request<{ datasets: DatasetStub[] } | DatasetStub[]>('GET', '/datasets', { query: { product: opts.product } });
    return Array.isArray(data) ? data : (data.datasets ?? []);
  }

  /** Get a Dataset handle for the given id (no network call). */
  dataset(id: string): Dataset {
    if (!id) throw new ValidationError('`id` is required');
    return new Dataset(this, id);
  }

  /**
   * Preview rows from a dataset without an API key.
   *
   * ```ts
   * const rows = await DataCore.preview('equity.vn30.daily', 5);
   * ```
   */
  static async preview(datasetId: string, n = 10, baseUrl = DEFAULT_BASE_URL): Promise<Row[]> {
    if (!datasetId) throw new ValidationError('`datasetId` is required');
    const f = (globalThis as { fetch?: FetchLike }).fetch;
    if (!f) throw new DataCoreError('No fetch implementation available.');
    const url = new URL(`${baseUrl.replace(/\/+$/, '')}/datasets/${encodeURIComponent(datasetId)}/preview`);
    url.searchParams.set('n', String(n));
    const resp = await f(url, { method: 'GET', headers: { Accept: 'application/json', 'User-Agent': '@datacore/sdk-js' } });
    if (!resp.ok) await throwForStatus(resp);
    const data = (await resp.json()) as Row[] | { data?: Row[]; rows?: Row[] };
    return Array.isArray(data) ? data : (data.data ?? data.rows ?? []);
  }

  /** @internal Low-level request with automatic retry. */
  async request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
    const url = new URL(this.baseUrl + path);
    if (opts.query) {
      for (const [k, v] of Object.entries(opts.query)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      }
    }
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: 'application/json',
      'User-Agent': '@datacore/sdk-js',
      'X-Request-ID': crypto.randomUUID?.() ?? String(Date.now()),
    };
    let body: BodyInit | undefined;
    if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(opts.body);
    }

    const maxRetries = opts.noRetry ? 0 : this.maxRetries;
    let attempt = 0;

    for (;;) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);
      const signal = opts.signal ? anySignal([opts.signal, controller.signal]) : controller.signal;

      let response: Response;
      try {
        response = await this.fetchImpl(url, { method, headers, body, signal });
      } catch (err) {
        clearTimeout(timer);
        if (err instanceof DataCoreError) throw err;
        throw new DataCoreError(`Network error: ${err instanceof Error ? err.message : String(err)}`);
      }
      clearTimeout(timer);

      if (!response.ok) {
        const status = response.status;
        const isRetryable = (status === 429 || status >= 500) && attempt < maxRetries;
        if (isRetryable) {
          const retryAfterHeader = response.headers.get('retry-after');
          const retryAfterSec = retryAfterHeader && Number.isFinite(Number(retryAfterHeader)) ? Number(retryAfterHeader) : 0;
          const backoffMs = retryAfterSec > 0
            ? retryAfterSec * 1000
            : Math.min(DEFAULT_INITIAL_DELAY_MS * 2 ** attempt, 30_000);
          attempt++;
          await sleep(backoffMs);
          continue;
        }
        await throwForStatus(response);
      }

      if (response.status === 204) return undefined as T;
      const ct = response.headers.get('content-type') ?? '';
      if (!ct.includes('application/json')) {
        const text = await response.text();
        throw new DataCoreError(`Unexpected non-JSON response (status ${response.status}): ${text.slice(0, 200)}`);
      }
      return (await response.json()) as T;
    }
  }
}

function anySignal(signals: AbortSignal[]): AbortSignal {
  const c = new AbortController();
  for (const s of signals) {
    if (s.aborted) { c.abort(s.reason); break; }
    s.addEventListener('abort', () => c.abort(s.reason), { once: true });
  }
  return c.signal;
}

async function throwForStatus(r: Response): Promise<never> {
  const status = r.status;
  let msg = `${status} ${r.statusText}`;
  try {
    const text = await r.text();
    if (text) {
      try { const p = JSON.parse(text) as { message?: string; error?: string }; msg += `: ${p.message ?? p.error ?? text}`; }
      catch { msg += `: ${text.slice(0, 200)}`; }
    }
  } catch { /* ignore */ }
  if (status === 401 || status === 403) throw new AuthenticationError(msg);
  if (status === 404) throw new NotFoundError(msg);
  if (status === 429) {
    const h = r.headers.get('retry-after');
    throw new RateLimitError(msg, h && Number.isFinite(Number(h)) ? Number(h) : undefined);
  }
  if (status >= 400 && status < 500) throw new ValidationError(msg, status);
  if (status >= 500) throw new ServerError(msg, status);
  throw new DataCoreError(msg, status);
}
