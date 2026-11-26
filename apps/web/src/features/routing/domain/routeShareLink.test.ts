import { describe, expect, it } from 'vitest';
import type { Place } from '../../places/types';
import {
  addressBarUrl,
  buildPlaceShareUrl,
  buildRouteShareUrl,
  parsePlaceShareLink,
  MAX_SHARED_NAME_LENGTH,
  parseRouteShareLink,
  type SharedRoute,
} from './routeShareLink';

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

  it.each([
    ['hex', '?from=0x0A,0x6A,A&to=11,107,B'],
    ['số mũ', '?from=1e1,106,A&to=11,107,B'],
    ['Infinity', '?from=Infinity,106,A&to=11,107,B'],
    ['rỗng', '?from=,,A&to=11,107,B'],
    ['khoảng trắng', '?from=%20,%20,A&to=11,107,B'],
    ['ngoài Việt Nam (Paris)', '?from=48.85,2.35,A&to=11,107,B'],
    ['đại dương (0,0)', '?from=10.77,106.69,A&to=0,0,B'],
  ])('bỏ qua link có tọa độ %s', (_label, search) => {
    expect(parseRouteShareLink(search)).toBeNull();
  });

  it('cắt tên quá dài và bỏ ký tự điều khiển trong tên từ link', () => {
    const longName = 'GỌI 0909000000 NHẬN QUÀ '.repeat(20);
    const parsed = parseRouteShareLink(
      `?from=10.77,106.69,${encodeURIComponent(longName)}&to=10.78,106.7,${encodeURIComponent('Chợ\u0000\nBến Thành')}`,
    );
    expect(Array.from(parsed!.origin.name)).toHaveLength(MAX_SHARED_NAME_LENGTH);
    expect(parsed?.destination.name).toBe('Chợ Bến Thành');
  });

  it('tên chỉ toàn ký tự điều khiển thì dùng tên mặc định', () => {
    expect(parseRouteShareLink('?from=10.77,106.69,%00%01&to=10.78,106.7,B')?.origin.name).toBe('Điểm đi');
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
  // Quét khắp vùng VietMap hỗ trợ (link ngoài vùng bị bỏ qua, xem test riêng).
  const latitude = 8.5 + index * 0.14;
  const longitude = 102.2 + index * 0.09;
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

  it('giữ điểm ghé theo thứ tự, tiêu chí "ngắn nhất" và "tránh phà"', () => {
    const route: SharedRoute = {
      origin: place('A', 10.77, 106.69),
      destination: place('B', 10.8, 106.7),
      vehicle: 'car',
      via: [place('Ghé 1, Quận 3', 10.78, 106.68), place('Ghé 2', 10.79, 106.66)],
      objective: 'distance',
      avoidFerry: true,
    };
    const parsed = parseRouteShareLink(new URL(buildRouteShareUrl(route, 'https://imap.example/')).search);
    expect(parsed?.via?.map((stop) => stop.name)).toEqual(['Ghé 1, Quận 3', 'Ghé 2']);
    expect(parsed?.via?.[0]).toMatchObject({ lat: 10.78, lng: 106.68 });
    expect(parsed?.objective).toBe('distance');
    expect(parsed?.avoidFerry).toBe(true);
  });

  it('link cũ không có các tham số mới: không điểm ghé, "nhanh nhất", không tránh phà', () => {
    expect(parseRouteShareLink('?from=10,106,A&to=11,107,B')).toMatchObject({
      via: [],
      objective: 'time',
      avoidFerry: false,
    });
  });

  it('bỏ qua điểm ghé sai định dạng thay vì làm hỏng cả link', () => {
    const parsed = parseRouteShareLink('?from=10,106,A&to=11,107,B&via=abc&via=10.5,106.5,C');
    expect(parsed?.via?.map((stop) => stop.name)).toEqual(['C']);
  });
});

describe('place links and address bar', () => {
  it('đọc lại đúng link địa điểm, kiểm tra như link tuyến', () => {
    const url = buildPlaceShareUrl(
      { name: 'Chợ Bến Thành', lat: 10.7721, lng: 106.6983 },
      'https://imap.example/?x=1',
    );
    expect(parsePlaceShareLink(new URL(url).search)).toMatchObject({
      name: 'Chợ Bến Thành',
      lat: 10.7721,
      lng: 106.6983,
    });
    expect(parsePlaceShareLink('?place=0x0A,0x6A,Fake')).toBeNull();
    expect(parsePlaceShareLink('?place=48.85,2.35,Paris')).toBeNull();
    expect(parsePlaceShareLink('?place=10.77,106.69,')?.name).toBe('Địa điểm');
  });

  it('thanh địa chỉ: tuyến → tham số tuyến, địa điểm → ?place=, không xem gì → bỏ tham số của iMap', () => {
    const base = 'https://imap.example/map?utm_source=zalo&place=1,1,old';
    const route = addressBarUrl(
      {
        kind: 'route',
        route: {
          origin: place('A', 10.77, 106.69),
          destination: place('B', 10.78, 106.7),
          vehicle: 'car',
        },
      },
      base,
    );
    expect(parseRouteShareLink(new URL(route).search)).toMatchObject({ vehicle: 'car' });
    expect(new URL(route).pathname).toBe('/map');

    const placeUrl = addressBarUrl({ kind: 'place', place: place('Chợ', 10.77, 106.69) }, route);
    expect(new URL(placeUrl).searchParams.get('from')).toBeNull();
    expect(parsePlaceShareLink(new URL(placeUrl).search)?.name).toBe('Chợ');

    const none = new URL(
      addressBarUrl(
        { kind: 'none' },
        'https://imap.example/?from=1&to=2&mode=car&via=3&by=distance&ferry=avoid&place=4&utm_source=zalo#x',
      ),
    );
    expect([...none.searchParams.keys()]).toEqual(['utm_source']);
    expect(none.hash).toBe('#x');
  });
});
