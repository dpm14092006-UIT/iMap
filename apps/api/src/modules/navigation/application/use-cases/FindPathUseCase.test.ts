import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AppError } from '../../../../shared/errors/AppError.js';
import { AStarSolver } from '../../domain/algorithms/AStarSolver.js';
import { DijkstraSolver } from '../../domain/algorithms/DijkstraSolver.js';
import { OsmFileGraphSource } from '../../infrastructure/osm/OsmFileGraphSource.js';
import { FindPathUseCase } from './FindPathUseCase.js';

/** Test tích hợp với dữ liệu OSM thật đã commit trong apps/api/data/osm. */
const source = new OsmFileGraphSource(
  resolve(import.meta.dirname, '../../../../../data/osm/hcmc-center.json'),
);
const useCase = new FindPathUseCase(source, { dijkstra: new DijkstraSolver(), astar: new AStarSolver() });

const benThanh = { lat: 10.7721, lng: 106.6983 };
const landmark81 = { lat: 10.7949, lng: 106.7218 };

describe('FindPathUseCase (dữ liệu OSM trung tâm TP.HCM)', () => {
  it.each(['car', 'motorcycle'] as const)(
    'Chợ Bến Thành → Landmark 81 bằng %s: hai thuật toán cùng kết quả',
    async (vehicle) => {
      const result = await useCase.execute({
        from: benThanh,
        to: landmark81,
        vehicle,
        objective: 'distance',
        algorithms: ['dijkstra', 'astar'],
      });
      const [dijkstra, astar] = result.runs;
      expect(dijkstra!.distanceMeters).toBe(astar!.distanceMeters);
      expect(astar!.visitedNodes).toBeLessThan(dijkstra!.visitedNodes);
      // Đường đi thật phải dài hơn đường chim bay (~3,5 km) nhưng không quá vô lý.
      expect(dijkstra!.distanceMeters).toBeGreaterThan(3500);
      expect(dijkstra!.distanceMeters).toBeLessThan(8000);
      // Tọa độ trả về theo GeoJSON [lng, lat].
      expect(dijkstra!.coordinates[0]![0]).toBeCloseTo(benThanh.lng, 2);
    },
  );

  it('báo lỗi 422 khi điểm nằm ngoài vùng dữ liệu', async () => {
    const outside = { lat: 10.8187, lng: 106.652 }; // sân bay Tân Sơn Nhất
    await expect(
      useCase.execute({
        from: outside,
        to: landmark81,
        vehicle: 'car',
        objective: 'duration',
        algorithms: ['astar'],
      }),
    ).rejects.toMatchObject({ statusCode: 422, code: 'OUTSIDE_GRAPH_COVERAGE' });
  });

  it('báo lỗi 503 khi chưa có file dữ liệu', async () => {
    const missing = new FindPathUseCase(new OsmFileGraphSource('/khong-ton-tai.json'), {
      dijkstra: new DijkstraSolver(),
      astar: new AStarSolver(),
    });
    await expect(
      missing.execute({
        from: benThanh,
        to: landmark81,
        vehicle: 'car',
        objective: 'duration',
        algorithms: ['astar'],
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
