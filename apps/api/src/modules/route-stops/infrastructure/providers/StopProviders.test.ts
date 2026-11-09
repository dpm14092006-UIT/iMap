import { afterEach, describe, expect, it, vi } from 'vitest';
import { OverpassStopPlaceProvider } from './OverpassStopPlaceProvider.js';
import { AiStopIntentParser } from './AiStopIntentParser.js';
const bounds = { south: 10.7, west: 106.7, north: 10.8, east: 106.8 };
afterEach(() => vi.unstubAllGlobals());
describe('Overpass adapter', () => {
  it('maps nodes/way centers, removes private entries, keeps source and unknown opening hours', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ elements: [
      { type: 'node', id: 1, lat: 10.71, lon: 106.71, tags: { amenity: 'fuel', name: 'Trạm A' } },
      { type: 'way', id: 2, center: { lat: 10.72, lon: 106.72 }, tags: { amenity: 'fuel', brand: 'Brand B', opening_hours: '24/7' } },
      { type: 'node', id: 3, lat: 10.73, lon: 106.73, tags: { amenity: 'fuel', access: 'private' } },
    ] })));
    vi.stubGlobal('fetch', fetcher);
    const provider = new OverpassStopPlaceProvider();
    const places = await provider.search('fuel', bounds);
    expect(places).toHaveLength(2); expect(places[0]).toMatchObject({ id: 'osm-node-1', name: 'Trạm A', openingHours: null });
    expect(places[1]!.osmUrl).toBe('https://www.openstreetmap.org/way/2');
    expect(decodeURIComponent(String(fetcher.mock.calls[0]![1].body))).toContain('"amenity"="fuel"');
    await provider.search('fuel', bounds); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('deduplicates simultaneous identical requests', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{"elements":[]}'));
    vi.stubGlobal('fetch', fetcher);
    const provider = new OverpassStopPlaceProvider();
    await Promise.all([provider.search('cafe', bounds), provider.search('cafe', bounds)]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('rejects partial responses rather than asserting no POIs exist', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"remark":"timeout","elements":[]}')));
    await expect(new OverpassStopPlaceProvider().search('fuel', bounds)).rejects.toMatchObject({ code: 'STOP_PLACES_UNAVAILABLE' });
  });
});
describe('AI intent adapter', () => {
  it('does not make an AI request when not configured and identifies the rules source', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    expect(await new AiStopIntentParser({ provider: 'gemini', ollamaUrl: 'http://localhost:11434' }).parse('Tìm ATM')).toMatchObject({ source: 'rules', intent: { category: 'atm' } });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('validates structured Ollama output and sends only the query', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: { content: JSON.stringify({ category: 'fuel', maxExtraDistanceMeters: 1000, maxExtraDurationSeconds: null, unsupportedRequirements: [] }) } })));
    vi.stubGlobal('fetch', fetcher);
    expect(await new AiStopIntentParser({ provider: 'ollama', model: 'test-installed-model', ollamaUrl: 'http://localhost:11434' }).parse('Cần đổ nhiên liệu, vòng thêm tối đa một cây số')).toMatchObject({ source: 'ai', intent: { category: 'fuel', maxExtraDistanceMeters: 1000 } });
    const body = JSON.parse(fetcher.mock.calls[0]![1].body);
    expect(JSON.parse(body.messages[1].content)).toEqual({ previousRequests: [], request: 'Cần đổ nhiên liệu, vòng thêm tối đa một cây số' });
    expect(body).not.toHaveProperty('points'); expect(body.format.type).toBe('object');
  });
  it('falls back on invalid output or quota without paid retry', async () => {
    for (const response of [new Response('{"message":{"content":"not JSON"}}'), new Response('', { status: 429 })]) {
      const fetcher = vi.fn().mockResolvedValue(response); vi.stubGlobal('fetch', fetcher);
      const result = await new AiStopIntentParser({ provider: 'ollama', model: 'test-installed-model', ollamaUrl: 'http://localhost:11434' }).parse('Tìm trạm xăng');
      expect(result.source).toBe('rules'); expect(result.warning).toContain('hết lượt'); expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });
});
