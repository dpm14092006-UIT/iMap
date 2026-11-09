import { readFile } from 'node:fs/promises';
import { AppError } from '../../../../shared/errors/AppError.js';
import type { LoadedRoadGraph, RoadGraphSource } from '../../application/ports/RoadGraphSource.js';
import { OsmGraphBuilder } from './OsmGraphBuilder.js';
import type { OsmExtract } from './osmTypes.js';

/**
 * Nạp đồ thị từ file JSON do script import OSM tạo ra.
 * Chỉ đọc file và dựng đồ thị MỘT lần (lần gọi đầu), các lần sau dùng lại bản trong bộ nhớ.
 */
export class OsmFileGraphSource implements RoadGraphSource {
  private loading: Promise<LoadedRoadGraph> | null = null;

  constructor(private readonly filePath: string, private readonly builder = new OsmGraphBuilder()) {}

  load(): Promise<LoadedRoadGraph> {
    this.loading ??= this.readAndBuild().catch((error: unknown) => {
      this.loading = null; // cho phép thử lại ở request sau (vd. vừa chạy xong script import)
      throw error;
    });
    return this.loading;
  }

  private async readAndBuild(): Promise<LoadedRoadGraph> {
    let extract: OsmExtract;
    try {
      extract = JSON.parse(await readFile(this.filePath, 'utf8')) as OsmExtract;
    } catch {
      throw new AppError(503, 'ROAD_GRAPH_UNAVAILABLE', 'Chưa có dữ liệu đồ thị OSM. Hãy chạy "npm run osm:import" trước.');
    }
    return {
      graph: this.builder.build(extract),
      coverage: extract.meta.bbox,
      attribution: `© OpenStreetMap contributors (${extract.meta.license})`,
    };
  }
}
