export interface Domain { id: string; name: string; description?: string; }
export interface Product { id: string; name: string; domain: string; }
export interface DatasetStub { id: string; name: string; domain: string; product: string; }
export interface Column { name: string; type: string; description?: string; nullable?: boolean; unit?: string; }
export interface DatasetMetadata extends DatasetStub { description?: string; frequency?: string; start?: string; end?: string; rowCount?: number; columns?: Column[]; tags?: string[]; updatedAt?: string; [key: string]: unknown; }
export interface SearchResult extends DatasetStub { score?: number; }
export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;
export interface DataCoreClientOptions { apiKey?: string; baseUrl?: string; timeout?: number; fetch?: FetchLike; }
export interface FetchParams { start?: string; end?: string; symbols?: string | string[]; [key: string]: unknown; }
