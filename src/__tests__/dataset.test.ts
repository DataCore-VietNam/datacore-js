import { describe, expect, it } from 'vitest';
import { DataCore } from '../client.js';
import type { FetchLike } from '../types.js';

function fakeFetch(handler: (url:string)=>{status?:number;body:unknown}): {fn:FetchLike;calls:Array<{url:string;init?:RequestInit}>} {
  const calls: Array<{url:string;init?:RequestInit}> = [];
  const fn: FetchLike = async (input,init) => {
    const url=String(input); calls.push({url,init});
    const {status=200,body}=handler(url);
    return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
  };
  return {fn,calls};
}

describe('Dataset.fetch() pagination', () => {
  it('passes page and limit', async () => {
    const f = fakeFetch(()=>({body:[]}));
    await new DataCore({apiKey:'k',fetch:f.fn}).dataset('ds').fetch({start:'2024-01-01'},2,50);
    const url = new URL(f.calls[0]!.url);
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('limit')).toBe('50');
  });
  it('defaults page=1 limit=100', async () => {
    const f = fakeFetch(()=>({body:[]}));
    await new DataCore({apiKey:'k',fetch:f.fn}).dataset('ds').fetch();
    const url = new URL(f.calls[0]!.url);
    expect(url.searchParams.get('page')).toBe('1');
    expect(url.searchParams.get('limit')).toBe('100');
  });
});

describe('Dataset.fetchAll()', () => {
  it('stops on empty page', async () => {
    let c=0; const f=fakeFetch(()=>({body:c++===0?[{id:1},{id:2}]:[]}));
    const rows = await new DataCore({apiKey:'k',fetch:f.fn}).dataset('ds').fetchAll({},{limit:2});
    expect(rows).toHaveLength(2); expect(f.calls).toHaveLength(2);
  });
  it('respects maxRows', async () => {
    const f=fakeFetch(()=>({body:[1,2,3,4,5].map(id=>({id}))}));
    const rows = await new DataCore({apiKey:'k',fetch:f.fn}).dataset('ds').fetchAll({},{limit:5,maxRows:3});
    expect(rows).toHaveLength(3);
  });
});

describe('Dataset.stream()', () => {
  it('yields rows and paginates', async () => {
    let c=0; const f=fakeFetch(()=>({body:c++===0?[{id:1},{id:2}]:[{id:3}]}));
    const out: unknown[] = [];
    for await (const row of new DataCore({apiKey:'k',fetch:f.fn}).dataset('ds').stream({},{limit:2})) out.push(row);
    expect(out).toHaveLength(3); expect(f.calls).toHaveLength(2);
  });
});
