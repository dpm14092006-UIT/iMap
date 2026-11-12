import { afterEach, describe, expect, it, vi } from 'vitest';
import { GeminiTrafficImageAnalyzer } from './GeminiTrafficImageAnalyzer.js';

afterEach(() => vi.unstubAllGlobals());

describe('GeminiTrafficImageAnalyzer', () => {
  it('returns incident suggestions without a severity field', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            trafficRelated: true,
            incidentType: 'traffic_jam',
            summary: 'Xe xếp hàng dài trên đường.',
            evidence: ['Nhiều xe đứng sát nhau'],
            confidence: 'medium',
          }),
        }),
      ),
    );
    vi.stubGlobal('fetch', fetcher);

    const result = await new GeminiTrafficImageAnalyzer('test-key', 'test-model', true).analyze(
      Buffer.from([1, 2, 3]),
      'image/png',
      'incident',
    );

    expect(result).toMatchObject({ task: 'incident', incidentType: 'traffic_jam' });
    expect(result).not.toHaveProperty('severity');
    const request = JSON.parse(String(fetcher.mock.calls[0]![1]?.body)) as {
      input: { text: string }[];
      response_format: { schema: { properties: Record<string, unknown> } };
    };
    expect(request.input[0]!.text).toContain('Không đánh giá mức độ nghiêm trọng');
    expect(request.response_format.schema.properties).not.toHaveProperty('severity');
  });
});
