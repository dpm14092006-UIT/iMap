import { OptimizeRouteUseCase } from './modules/optimization/application/OptimizeRouteUseCase.js';
import { VietmapMatrixProvider } from './modules/optimization/infrastructure/VietmapMatrixProvider.js';
import { ExactTourStrategy } from './modules/optimization/domain/strategies/ExactTourStrategy.js';
import { TwoOptStrategy } from './modules/optimization/domain/strategies/TwoOptStrategy.js';
import { OptimizationController } from './modules/optimization/presentation/OptimizationController.js';
import { ExplorePlacesUseCase } from './modules/route-stops/application/use-cases/ExplorePlacesUseCase.js';
import { FindRouteStopsUseCase } from './modules/route-stops/application/use-cases/FindRouteStopsUseCase.js';
import { OverpassStopPlaceProvider } from './modules/route-stops/infrastructure/providers/OverpassStopPlaceProvider.js';
import { AiStopIntentParser } from './modules/route-stops/infrastructure/providers/AiStopIntentParser.js';
import { SupabaseTrafficReportRepository } from './modules/traffic/infrastructure/repositories/SupabaseTrafficReportRepository.js';
import { CreateTrafficReportUseCase } from './modules/traffic/application/use-cases/CreateTrafficReportUseCase.js';
import { ListTrafficReportsUseCase } from './modules/traffic/application/use-cases/ListTrafficReportsUseCase.js';
import { UpdateRoadClearanceUseCase } from './modules/traffic/application/use-cases/UpdateRoadClearanceUseCase.js';
import { TrafficController } from './modules/traffic/presentation/TrafficController.js';
import { AnalyzeTrafficImageUseCase } from './modules/traffic/application/use-cases/AnalyzeTrafficImageUseCase.js';
import { GeminiTrafficImageAnalyzer } from './modules/traffic/infrastructure/providers/GeminiTrafficImageAnalyzer.js';
import { VietmapPlaceSearchProvider } from './modules/places/infrastructure/providers/VietmapPlaceSearchProvider.js';
import { SearchPlacesUseCase } from './modules/places/application/use-cases/SearchPlacesUseCase.js';
import { ReverseGeocodeUseCase } from './modules/places/application/use-cases/ReverseGeocodeUseCase.js';
import { PlaceSearchController } from './modules/places/presentation/PlaceSearchController.js';
import { VietmapRouteProvider } from './modules/navigation/infrastructure/providers/VietmapRouteProvider.js';
import { CalculateRouteUseCase } from './modules/navigation/application/use-cases/CalculateRouteUseCase.js';
import { RouteController } from './modules/navigation/presentation/RouteController.js';
import { RerouteUseCase } from './modules/navigation/application/use-cases/RerouteUseCase.js';
import { RerouteController } from './modules/navigation/presentation/RerouteController.js';
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
  const trafficRepository = new SupabaseTrafficReportRepository();
  const trafficController = new TrafficController(
    new CreateTrafficReportUseCase(trafficRepository),
    new ListTrafficReportsUseCase(trafficRepository),
    new UpdateRoadClearanceUseCase(trafficRepository),
    new AnalyzeTrafficImageUseCase(
      new GeminiTrafficImageAnalyzer(env.GEMINI_API_KEY, env.GEMINI_MODEL, env.GEMINI_TRAFFIC_AI_ENABLED),
    ),
  );
  const placeProvider = new VietmapPlaceSearchProvider(env.VIETMAP_API_KEY);
  const placeSearchController = new PlaceSearchController(
    new SearchPlacesUseCase(placeProvider),
    new ReverseGeocodeUseCase(placeProvider),
    placeProvider,
  );
  const routeProvider = new VietmapRouteProvider(env.VIETMAP_API_KEY);
  // Tối ưu nhiều điểm: Held–Karp (chính xác, mặc định) hoặc NN + 2-opt (gần đúng, để so sánh).
  const optimizationController = new OptimizationController(
    new OptimizeRouteUseCase(new VietmapMatrixProvider(env.VIETMAP_API_KEY), routeProvider, {
      exact: new ExactTourStrategy(),
      heuristic: new TwoOptStrategy(),
    }),
  );
  const routeController = new RouteController(new CalculateRouteUseCase(routeProvider));
  // Dynamic Rerouting: dùng tuyến thay thế của VietMap / điểm vòng để tránh sự cố.
  const rerouteController = new RerouteController(new RerouteUseCase(routeProvider));
  const stopPlaces = new OverpassStopPlaceProvider(env.OVERPASS_API_URL);
  const stopParser = new AiStopIntentParser({
    provider: env.STOP_AI_PROVIDER,
    model: env.STOP_AI_MODEL,
    apiKey: env.GEMINI_API_KEY,
    ollamaUrl: env.OLLAMA_BASE_URL,
  });
  const findRouteStops = new FindRouteStopsUseCase(routeProvider, stopPlaces, stopParser);
  const explorePlaces = new ExplorePlacesUseCase(stopParser, stopPlaces, findRouteStops);

  // Thuật toán tự cài đặt: đồ thị OSM nạp từ file một lần, dùng chung cho mọi request.
  const roadGraphSource = new OsmFileGraphSource(resolve(apiRoot, env.OSM_GRAPH_FILE));
  const pathfindingController = new PathfindingController(
    new FindPathUseCase(roadGraphSource, { dijkstra: new DijkstraSolver(), astar: new AStarSolver() }),
    new GetRoadGraphInfoUseCase(roadGraphSource),
  );
  return {
    optimizationController,
    trafficController,
    placeSearchController,
    routeController,
    rerouteController,
    findRouteStops,
    explorePlaces,
    pathfindingController,
  };
}
