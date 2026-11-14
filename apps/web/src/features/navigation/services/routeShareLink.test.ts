import { describe, expect, it } from 'vitest';
import type { Place } from '../../places/types';
import { buildRouteShareUrl, parseRouteShareLink, type SharedRoute } from './routeShareLink';

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

const routeShareScenarios: SharedRoute[] = Array.from({ length: 100 }, (_, index) => {
  const names = [
    'Chợ Bến Thành, Quận 1',
    'Cà phê & bánh',
    'Sân bay Tân Sơn Nhất',
    'Bến xe Miền Đông',
    'Đại học Quốc gia',
  ];
  const latitude = -80 + index * 1.6;
  const longitude = -170 + index * 3.4;
  return {
    origin: place(`${names[index % names.length]} ${index}`, latitude, longitude),
    destination: place(`${names[(index + 2) % names.length]} #${index}`, latitude + 0.23, longitude + 0.31),
    vehicle: index % 2 === 0 ? 'car' : 'motorcycle',
  };
});

describe('route share round-trip regression matrix', () => {
  it.each(routeShareScenarios)('round-trips $vehicle routes with unicode names', (route) => {
    const url = buildRouteShareUrl(route, 'https://imap.example/map?old=1#section');
    const parsed = parseRouteShareLink(new URL(url).search);

    expect(parsed?.origin.name).toBe(route.origin.name);
    expect(parsed?.destination.name).toBe(route.destination.name);
    expect(parsed?.vehicle).toBe(route.vehicle);
    expect(parsed?.origin.lat).toBe(Number(route.origin.lat.toFixed(6)));
    expect(parsed?.origin.lng).toBe(Number(route.origin.lng.toFixed(6)));
    expect(parsed?.destination.lat).toBe(Number(route.destination.lat.toFixed(6)));
    expect(parsed?.destination.lng).toBe(Number(route.destination.lng.toFixed(6)));
  });
});
