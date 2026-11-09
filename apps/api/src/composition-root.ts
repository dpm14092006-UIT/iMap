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
import { PhotonPlaceSearchProvider } from './modules/places/infrastructure/providers/PhotonPlaceSearchProvider.js';
import { SearchPlacesUseCase } from './modules/places/application/use-cases/SearchPlacesUseCase.js';
import { PlaceSearchController } from './modules/places/presentation/PlaceSearchController.js';
import { VietmapRouteProvider } from './modules/navigation/infrastructure/providers/VietmapRouteProvider.js';
import { CalculateRouteUseCase } from './modules/navigation/application/use-cases/CalculateRouteUseCase.js';
import { RouteController } from './modules/navigation/presentation/RouteController.js';
import { env } from './config/env.js';
/** Composition root – chỉ nơi này biết class implementation cụ thể. */
export function createContainer() {
  const trafficRepository = new SupabaseTrafficReportRepository();
  const trafficController = new TrafficController(
    new CreateTrafficReportUseCase(trafficRepository),
    new ListTrafficReportsUseCase(trafficRepository),
    new UpdateRoadClearanceUseCase(trafficRepository),
    new AnalyzeTrafficImageUseCase(new GeminiTrafficImageAnalyzer(env.GEMINI_API_KEY, env.GEMINI_MODEL, env.GEMINI_TRAFFIC_AI_ENABLED)),
  );
  const placeSearchController = new PlaceSearchController(new SearchPlacesUseCase(new PhotonPlaceSearchProvider()));
  const routeProvider = new VietmapRouteProvider(env.VIETMAP_API_KEY);
  const routeController = new RouteController(new CalculateRouteUseCase(routeProvider));
  const stopPlaces = new OverpassStopPlaceProvider(env.OVERPASS_API_URL);
  const stopParser = new AiStopIntentParser({ provider: env.STOP_AI_PROVIDER, model: env.STOP_AI_MODEL, apiKey: env.GEMINI_API_KEY, ollamaUrl: env.OLLAMA_BASE_URL });
  const findRouteStops = new FindRouteStopsUseCase(routeProvider, stopPlaces, stopParser);
  const explorePlaces = new ExplorePlacesUseCase(stopParser, stopPlaces, findRouteStops);
  return { trafficController, placeSearchController, routeController, findRouteStops, explorePlaces };
}
