import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSupabaseClient } from '../../auth/services/supabaseClient';
import type { Place } from '../types';
import { RecentPlacesRepository } from './recentPlacesStore';

vi.mock('../../auth/services/supabaseClient', () => ({ getSupabaseClient: vi.fn() }));

afterEach(() => vi.mocked(getSupabaseClient).mockReset());

const place: Place = {
  id: 'p',
  name: 'Chợ Bến Thành',
  address: 'Quận 1',
  category: 'Chợ',
  lat: 10.7725,
  lng: 106.698,
  source: 'vietmap',
};

/** Truy vấn delete() giả: chuỗi .eq().eq() rồi await ra `result`. */
function deleteQuery(result: { error: { message: string } | null }) {
  const query = {
    eq: vi.fn(() => query),
    then: (resolve: (value: typeof result) => void) => resolve(result),
  };
  return query;
}

describe('RecentPlacesRepository (review #9)', () => {
  it('record() ném lỗi khi Supabase trả { error } thay vì im lặng', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: { message: 'permission denied' } });
    vi.mocked(getSupabaseClient).mockResolvedValue({ rpc } as never);
    await expect(new RecentPlacesRepository().record('origin', place)).rejects.toThrow('permission denied');
  });

  it('record() thành công thì không ném lỗi', async () => {
    vi.mocked(getSupabaseClient).mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ error: null }),
    } as never);
    await expect(new RecentPlacesRepository().record('origin', place)).resolves.toBeUndefined();
  });

  it('remove() ném lỗi khi xóa thất bại', async () => {
    const from = vi.fn(() => ({ delete: () => deleteQuery({ error: { message: 'network' } }) }));
    vi.mocked(getSupabaseClient).mockResolvedValue({ from } as never);
    await expect(new RecentPlacesRepository().remove('destination', place)).rejects.toThrow('network');
  });
});
