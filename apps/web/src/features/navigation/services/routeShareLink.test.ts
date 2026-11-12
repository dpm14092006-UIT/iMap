import { describe, expect, it } from 'vitest';
import type { Place } from '../../places/types';
import { buildRouteShareUrl, parseRouteShareLink } from './routeShareLink';

const place = (name: string, lat: number, lng: number): Place => ({
  id: name,
  name,
  address: '',
  category: '',
  lat,
  lng,
  source: 'map',
});

describe('route share link', () => {
  it('mã hóa rồi đọc lại đúng điểm đi, điểm đến và phương tiện', () => {
    const url = buildRouteShareUrl(
      {
        origin: place('Chợ Bến Thành, Quận 1', 10.7725, 106.698),
        destination: place('Sân bay', 10.8185, 106.652),
        vehicle: 'car',
      },
      'https://imap.example/app?x=1#top',
    );
    expect(url.startsWith('https://imap.example/app?from=')).toBe(true);
    const parsed = parseRouteShareLink(new URL(url).search);
    expect(parsed?.vehicle).toBe('car');
    expect(parsed?.origin).toMatchObject({ name: 'Chợ Bến Thành, Quận 1', lat: 10.7725, lng: 106.698 });
    expect(parsed?.destination).toMatchObject({ name: 'Sân bay', lat: 10.8185, lng: 106.652 });
  });

  it('dùng xe máy khi mode thiếu hoặc không hợp lệ', () => {
    expect(parseRouteShareLink('?from=10,106,A&to=11,107,B')?.vehicle).toBe('motorcycle');
    expect(parseRouteShareLink('?from=10,106,A&to=11,107,B&mode=plane')?.vehicle).toBe('motorcycle');
  });

  it('từ chối tọa độ sai hoặc thiếu điểm', () => {
    expect(parseRouteShareLink('?from=10,106,A')).toBeNull();
    expect(parseRouteShareLink('?from=abc,106,A&to=11,107,B')).toBeNull();
    expect(parseRouteShareLink('?from=95,106,A&to=11,107,B')).toBeNull();
    expect(parseRouteShareLink('')).toBeNull();
  });
});
