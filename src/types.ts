/** A high-level data domain (e.g. "equities", "fx", "macro"). */
export interface Domain { id: string; name: string; description?: string; }
/** A product within a domain (e.g. "HOSE daily bars"). */
export interface Product { id: string; name: string; domain: string; }
/** Lightweight dataset descriptor returned by listing and search endpoints. */
export interface DatasetStub { id: string; name: string; domain: string; product: string; }
/** A schema column descriptor. */
export interface Column { name: string; type: string; description?: string; nullable?: boolean; unit?: string; }
/** Full dataset metadata. */
export interface DatasetMetadata extends DatasetStub {
  description?: string; frequency?: string; start?: string; end?: string;
  rowCount?: number; columns?: Column[]; tags?: string[]; updatedAt?: string;
  [key: string]: unknown;
}
/** A search result, optionally annotated with a relevance score. */
export interface SearchResult extends DatasetStub { score?: number; }
/** Minimal fetch shape compatible with globalThis.fetch, undici, node-fetch, etc. */
export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;
/** Client construction options. */
export interface DataCoreClientOptions {
  /** API key. Falls back to DATACORE_API_KEY env var then globalThis.DATACORE_API_KEY. */
  apiKey?: string;
  /** Override the API base URL. Default: https://api.datacore.vn/v1 */
  baseUrl?: string;
  /** Per-request timeout in milliseconds. Default: 30000 */
  timeout?: number;
  /** Maximum number of automatic retries on 429/5xx. Default: 3 */
  maxRetries?: number;
  /** Custom fetch implementation (undici, node-fetch, etc.). Default: globalThis.fetch */
  fetch?: FetchLike;
}
/** Parameters for Dataset.fetch() / fetchAll() / stream() / download(). */
export interface FetchParams {
  /** Inclusive start date, e.g. "2024-01-01". */
  start?: string;
  /** Inclusive end date, e.g. "2024-12-31". */
  end?: string;
  /** Ticker symbol or list of symbols to filter by. */
  symbols?: string | string[];
  [key: string]: unknown;
}
