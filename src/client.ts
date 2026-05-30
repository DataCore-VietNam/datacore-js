import { Dataset } from './dataset.js';
import type { Row } from './dataset.js';
import {
  AuthenticationError,
  DataCoreError,
  NotFoundError,
  RateLimitError,
  ServerError,
  ValidationError,
} from './errors.js';
import type {
  DataCoreClientOptions,
  Domain,
  DatasetStub,
  FetchLike,
  Product,
  SearchResult,
} from './types.js';

const DEFAULT_BASE_URL = 'https://api.datacore.vn/v1';
const DEFAULT_TIMEOUT_MS = 30_000;

export interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  signal?: AbortSignal;
}

function resolveApiKey(explicit?: string): string | undefined {
  if (explicit) return explicit;
  try {
    if (typeof process !== 'undefined' && process?.env?.DATACORE_API_KEY) {
      return process.env.DATACORE_API_KEY;
    }
  } catch {
    // not available in this runtime
  }
  try {
    const fromGlobal = (globalThis as unknown as Record<string, unknown>).DATACORE_API_KEY;
    if (typeof fromGlobal === 'string' && fromGlobal.length > 0) return fromGlobal;
  } catch {
    // not available in this runtime
  }
  return undefined;
}

export class DataCore {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly fetchImpl: FetchLike;

  constructor(opts: DataCoreClientOptions = {}) {
    const apiKey = resolveApiKey(opts.apiKey);
    if (!apiKey) { throw new AuthenticationError('Missing DataCore API key.'); }
    this.apiKey = apiKey;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.timeout = opts.timeout ?? DEFAULT_TIMEOUT_MS;
    const f = opts.fetch ?? (globalThis as { fetch?: FetchLike }).fetch;
    if (!f) { throw new DataCoreError('No fetch implementation available.'); }
    this.fetchImpl = f;
  }
  async search(q: string, limit = 20): Promise<SearchResult[]> {
    const d = await this.request<{ results: SearchResult[] } | SearchResult[]>('POST', '/search', { body: { query: q, limit } });
    return Array.isArray(d) ? d : (d.results ?? []);
  }
  async listDomains(): Promise<Domain[]> {
    const d = await this.request<{ domains: Domain[] } | Domain[]>('GET', '/domains');
    return Array.isArray(d) ? d : (d.domains ?? []);
  }
  async listProducts(domain: string): Promise<Product[]> {
    if (!domain) throw new ValidationError('`domain` is required');
    const d = await this.request<{ products: Product[] } | Product[]>('GET', `/domains/${encodeURIComponent(domain)}/products`);
    return Array.isArray(d) ? d : (d.products ?? []);
  }
  async listDatasets(opts: { product?: string } = {}): Promise<DatasetStub[]> {
    const d = await this.request<{ datasets: DatasetStub[] } | DatasetStub[]>('GET', '/datasets', { query: { product: opts.product } });
    return Array.isArray(d) ? d : (d.datasets ?? []);
  }
  dataset(id: string): Dataset {
    if (!id) throw new ValidationError('`id` is required');
    return new Dataset(this, id);
  }
  static async preview(datasetId: string, n = 10, baseUrl = DEFAULT_BASE_URL): Promise<Row[]> {
    if (!datasetId) throw new ValidationError('`datasetId` is required');
    const f = (globalThis as { fetch?: FetchLike }).fetch;
    if (!f) throw new DataCoreError('No fetch implementation available.');
    const url = new URL(`${baseUrl.replace(/\/+$/, '')}/datasets/${encodeURIComponent(datasetId)}/preview`);
    url.searchParams.set('n', String(n));
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), DEFAULT_TIMEOUT_MS);
    let r: Response;
    try { r = await f(url, { method: 'GET', headers: { Accept: 'application/json', 'User-Agent': '@datacore/sdk-js' }, signal: c.signal }); }
    catch (err) { clearTimeout(t); throw new DataCoreError(`Network error: ${err instanceof Error ? err.message : String(err)}`); }
    clearTimeout(t);
    if (!r.ok) await throwForStatus(r);
    const data = (await r.json()) as Row[] | { data?: Row[]; rows?: Row[] };
    return Array.isArray(data) ? data : (data.data ?? data.rows ?? []);
  }
  async request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
    const url = new URL(this.baseUrl + path);
    if (opts.query) for (const [k, v] of Object.entries(opts.query)) { if (v != null) url.searchParams.set(k, String(v)); }
    const headers: Record<string, string> = { Authorization: `Bearer ${this.apiKey}`, Accept: 'application/json', 'User-Agent': '@datacore/sdk-js' };
    let body: BodyInit | undefined;
    if (opts.body !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(opts.body); }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    const signal = opts.signal ? anySignal([opts.signal, controller.signal]) : controller.signal;
    let response: Response;
    try { response = await this.fetchImpl(url, { method, headers, body, signal }); }
    catch (err) { clearTimeout(timer); if (err instanceof DataCoreError) throw err; throw new DataCoreError(`Network error: ${err instanceof Error ? err.message : String(err)}`); }
    clearTimeout(timer);
    if (!response.ok) await throwForStatus(response);
    if (response.status === 204) return undefined as T;
    const ct = response.headers.get('content-type') ?? '';
    if (!ct.includes('application/json')) throw new DataCoreError(`Unexpected response: ${await response.text()}`);
    return (await response.json()) as T;
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
  try { const t = await r.text(); if (t) { try { const p = JSON.parse(t) as { message?: string; error?: string }; msg += ': ' + (p.message ?? p.error ?? t); } catch { msg += ': ' + t; } } } catch { /* ignore */ }
  if (status === 401 || status === 403) throw new AuthenticationError(msg);
  if (status === 404) throw new NotFoundError(msg);
  if (status === 429) { const h = r.headers.get('retry-after'); throw new RateLimitError(msg, h && Number.isFinite(Number(h)) ? Number(h) : undefined); }
  if (status >= 400 && status < 500) throw new ValidationError(msg, status);
  if (status >= 500) throw new ServerError(msg, status);
  throw new DataCoreError(msg, status);
}
