import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSupabaseClient } from '../../auth/services/supabaseClient';
import { HttpClient } from '../../../shared/api/HttpClient';
import { TrafficApiClient, TrafficPhotoStorage } from './trafficApi';

vi.mock('../../auth/services/supabaseClient', () => ({ getSupabaseClient: vi.fn() }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(getSupabaseClient).mockReset();
});

describe('traffic report submission', () => {
  it('uploads the selected photo to the private user folder', async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ upload });
    vi.mocked(getSupabaseClient).mockResolvedValue({ storage: { from } } as never);
    vi.stubGlobal('crypto', { randomUUID: () => '11111111-1111-4111-8111-111111111111' });

    const image = new File([new Uint8Array([1, 2, 3])], 'traffic.png', { type: 'image/png' });
    const path = await new TrafficPhotoStorage().upload(image, '22222222-2222-4222-8222-222222222222');

    expect(path).toBe(
      '22222222-2222-4222-8222-222222222222/traffic-reports/11111111-1111-4111-8111-111111111111.png',
    );
    expect(from).toHaveBeenCalledWith('traffic-images');
    expect(upload).toHaveBeenCalledWith(path, image, expect.objectContaining({ contentType: 'image/png' }));
  });

  it('sends the user-selected severity and image path to the report API', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { id: '33333333-3333-4333-8333-333333333333' } }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetcher);
    const api = new TrafficApiClient(new HttpClient({ baseUrl: 'https://api.test', timeoutMs: 1000 }));

    await api.create(
      {
        incidentType: 'traffic_jam',
        severity: 'high',
        lat: 10,
        lng: 106,
        imagePath:
          '22222222-2222-4222-8222-222222222222/traffic-reports/11111111-1111-4111-8111-111111111111.png',
      },
      'test-access-token',
    );

    const [url, request] = fetcher.mock.calls[0]!;
    expect(String(url)).toBe('https://api.test/traffic-reports');
    expect(new Headers(request?.headers).get('Authorization')).toBe('Bearer test-access-token');
    expect(JSON.parse(String(request?.body))).toMatchObject({
      severity: 'high',
      imagePath: expect.stringContaining('.png'),
    });
  });
});
