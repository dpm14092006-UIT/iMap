import { InMemoryTrafficReportRepository } from './modules/traffic/infrastructure/repositories/InMemoryTrafficReportRepository.js';
import { CreateTrafficReportUseCase } from './modules/traffic/application/use-cases/CreateTrafficReportUseCase.js';
import { ListTrafficReportsUseCase } from './modules/traffic/application/use-cases/ListTrafficReportsUseCase.js';
import { UpdateRoadClearanceUseCase } from './modules/traffic/application/use-cases/UpdateRoadClearanceUseCase.js';
import { TrafficController } from './modules/traffic/presentation/TrafficController.js';
import { PhotonPlaceSearchProvider } from './modules/places/infrastructure/providers/PhotonPlaceSearchProvider.js';
import { SearchPlacesUseCase } from './modules/places/application/use-cases/SearchPlacesUseCase.js';
import { ReverseGeocodeUseCase } from './modules/places/application/use-cases/ReverseGeocodeUseCase.js';
import { PlaceSearchController } from './modules/places/presentation/PlaceSearchController.js';
import { VietmapRouteProvider } from './modules/navigation/infrastructure/providers/VietmapRouteProvider.js';
import { CalculateRouteUseCase } from './modules/navigation/application/use-cases/CalculateRouteUseCase.js';
import { RouteController } from './modules/navigation/presentation/RouteController.js';
import { OsmFileGraphSource } from './modules/navigation/infrastructure/osm/OsmFileGraphSource.js';
import { DijkstraSolver } from './modules/navigation/domain/algorithms/DijkstraSolver.js';
import { AStarSolver } from './modules/navigation/domain/algorithms/AStarSolver.js';
import { FindPathUseCase } from './modules/navigation/application/use-cases/FindPathUseCase.js';
import { GetRoadGraphInfoUseCase } from './modules/navigation/application/use-cases/GetRoadGraphInfoUseCase.js';
import { PathfindingController } from './modules/navigation/presentation/PathfindingController.js';
import { env } from './config/env.js';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

/** Thư mục gốc của apps/api (file này nằm trong src/ khi dev hoặc dist/ khi build). */
const apiRoot = fileURLToPath(new URL('..', import.meta.url));
/** Composition root – chỉ nơi này biết class implementation cụ thể. */
export function createContainer() {
  const trafficRepository = new InMemoryTrafficReportRepository();
  const trafficController = new TrafficController(
    new CreateTrafficReportUseCase(trafficRepository),
    new ListTrafficReportsUseCase(trafficRepository),
    new UpdateRoadClearanceUseCase(trafficRepository),
  );
  const placeProvider = new PhotonPlaceSearchProvider();
  const placeSearchController = new PlaceSearchController(
    new SearchPlacesUseCase(placeProvider),
    new ReverseGeocodeUseCase(placeProvider),
  );
  const routeController = new RouteController(new CalculateRouteUseCase(new VietmapRouteProvider(env.VIETMAP_API_KEY)));

  // Thuật toán tự cài đặt: đồ thị OSM nạp từ file một lần, dùng chung cho mọi request.
  const roadGraphSource = new OsmFileGraphSource(resolve(apiRoot, env.OSM_GRAPH_FILE));
  const pathfindingController = new PathfindingController(
    new FindPathUseCase(roadGraphSource, { dijkstra: new DijkstraSolver(), astar: new AStarSolver() }),
    new GetRoadGraphInfoUseCase(roadGraphSource),
  );
  return { trafficController, placeSearchController, routeController, pathfindingController };
}
