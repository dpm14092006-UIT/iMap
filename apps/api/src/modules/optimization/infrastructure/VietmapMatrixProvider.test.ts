import { afterEach, describe, expect, it, vi } from 'vitest';
import { VietmapMatrixProvider } from './VietmapMatrixProvider.js';
const input = { points:[{lat:10.77,lng:106.69},{lat:10.78,lng:106.7}],vehicle:'car' as const,objective:'duration' as const,returnToStart:false };
afterEach(() => vi.unstubAllGlobals());
describe('VietMap directed costs', () => {
  it('preserves one-way costs and treats provider -1/null as unreachable, never a free edge', async () => {
    const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({code:'OK',durations:[[0,-1],[10,0]],distances:[[0,null],[100,0]]})));
    vi.stubGlobal('fetch',fetcher);
    expect(await new VietmapMatrixProvider('test-key').getCosts(input)).toEqual([[0,Infinity],[10,0]]);
    const url=new URL(fetcher.mock.calls[0]![0]);
    expect(url.searchParams.getAll('point')).toEqual(['10.77,106.69','10.78,106.7']);
    expect(url.searchParams.get('vehicle')).toBe('car');
  });
  it('requires a complete square matrix instead of optimizing a partial response', async () => {
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({code:'OK',durations:[[0,1]]}))));
    await expect(new VietmapMatrixProvider('test-key').getCosts(input)).rejects.toMatchObject({code:'MATRIX_INVALID'});
  });
  it('selects distances for distance objective', async () => {
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({code:'OK',durations:[[0,1],[2,0]],distances:[[0,10],[20,0]]}))));
    expect(await new VietmapMatrixProvider('test-key').getCosts({...input,objective:'distance'})).toEqual([[0,10],[20,0]]);
  });
  it('reports disabled Matrix/quota without switching to straight-line estimates', async () => {
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}',{status:423})));
    await expect(new VietmapMatrixProvider('test-key').getCosts(input)).rejects.toMatchObject({code:'MATRIX_QUOTA'});
  });
});
