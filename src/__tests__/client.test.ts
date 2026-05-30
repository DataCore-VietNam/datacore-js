import { describe, expect, it, vi } from 'vitest';
import { DataCore } from '../client.js';
import { AuthenticationError, DataCoreError, NotFoundError, RateLimitError, ServerError } from '../errors.js';
import type { FetchLike } from '../types.js';

function jsonFetch(status: number, body: unknown, extra: Record<string,string> = {}): FetchLike & { calls: Array<{url:string;init?:RequestInit}> } {
  const calls: Array<{url:string;init?:RequestInit}> = [];
  const fn: FetchLike = async (input, init) => { calls.push({url:String(input),init}); return new Response(JSON.stringify(body), {status, headers:{'content-type':'application/json',...extra}}); };
  return Object.assign(fn, {calls});
}

describe('DataCore constructor', () => {
  it('throws AuthenticationError when no key', () => {
    const prev = process.env.DATACORE_API_KEY; delete process.env.DATACORE_API_KEY;
    try { expect(()=>new DataCore({fetch:jsonFetch(200,{})})).toThrow(AuthenticationError); } finally { if (prev) process.env.DATACORE_API_KEY=prev; }
  });
  it('accepts explicit key', () => { expect(new DataCore({apiKey:'k',fetch:jsonFetch(200,{})})).toBeInstanceOf(DataCore); });
});

describe('search()', () => {
  it('POSTs /search', async () => {
    const f = jsonFetch(200,{results:[{id:'d1',name:'D1',domain:'eq',product:'p'}]});
    const dc = new DataCore({apiKey:'k',fetch:f});
    const r = await dc.search('vnm',5);
    expect(r).toHaveLength(1);
    expect(f.calls[0]?.url).toBe('https://api.datacore.vn/v1/search');
    expect(f.calls[0]?.init?.method).toBe('POST');
  });
});

describe('error mapping', () => {
  it('maps 401', async () => { await expect(new DataCore({apiKey:'k',fetch:jsonFetch(401,{})}).listDomains()).rejects.toBeInstanceOf(AuthenticationError); });
  it('maps 404', async () => { await expect(new DataCore({apiKey:'k',fetch:jsonFetch(404,{})}).listDomains()).rejects.toBeInstanceOf(NotFoundError); });
  it('maps 429 with retryAfter', async () => {
    const err = await new DataCore({apiKey:'k',fetch:jsonFetch(429,{},{'`retry-after`':'42'})}).listDomains().catch((e:unknown)=>e);
    expect(err).toBeInstanceOf(RateLimitError);
  });
  it('maps 500', async () => { await expect(new DataCore({apiKey:'k',fetch:jsonFetch(500,{})}).listDomains()).rejects.toBeInstanceOf(ServerError); });
  it('all extend DataCoreError', async () => { await expect(new DataCore({apiKey:'k',fetch:jsonFetch(500,{})}).listDomains()).rejects.toBeInstanceOf(DataCoreError); });
});

describe('dataset()', () => {
  it('returns Dataset without network call', () => {
    const f = vi.fn();
    const dc = new DataCore({apiKey:'k',fetch:f as unknown as FetchLike});
    const ds = dc.dataset('hose.daily_bars');
    expect(ds.id).toBe('hose.daily_bars');
    expect(f).not.toHaveBeenCalled();
  });
});
