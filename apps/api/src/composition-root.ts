import { SupabaseTrafficReportRepository } from './modules/traffic/infrastructure/repositories/SupabaseTrafficReportRepository.js';
import { CreateTrafficReportUseCase } from './modules/traffic/application/use-cases/CreateTrafficReportUseCase.js';
import { ListTrafficReportsUseCase } from './modules/traffic/application/use-cases/ListTrafficReportsUseCase.js';
import { UpdateRoadClearanceUseCase } from './modules/traffic/application/use-cases/UpdateRoadClearanceUseCase.js';
import { TrafficController } from './modules/traffic/presentation/TrafficController.js';
import { PhotonPlaceSearchProvider } from './modules/places/infrastructure/providers/PhotonPlaceSearchProvider.js';
import { SearchPlacesUseCase } from './modules/places/application/use-cases/SearchPlacesUseCase.js';
import { PlaceSearchController } from './modules/places/presentation/PlaceSearchController.js';
import { VietmapRouteProvider } from './modules/navigation/infrastructure/providers/VietmapRouteProvider.js';
import { CalculateRouteUseCase } from './modules/navigation/application/use-cases/CalculateRouteUseCase.js';
import { RouteController } from './modules/navigation/presentation/RouteController.js';
import { GeminiVisionProvider } from './modules/ai-vision/infrastructure/providers/GeminiVisionProvider.js';
import { SupabaseAiAnalysisRepository } from './modules/ai-vision/infrastructure/repositories/SupabaseAiAnalysisRepository.js';
import { SupabaseAiImageStorage } from './modules/ai-vision/infrastructure/storage/SupabaseAiImageStorage.js';
import { AnalyzeTrafficImageUseCase } from './modules/ai-vision/application/use-cases/AnalyzeTrafficImageUseCase.js';
import { RecognizeTrafficSignUseCase } from './modules/ai-vision/application/use-cases/RecognizeTrafficSignUseCase.js';
import { ListAiAnalysesUseCase } from './modules/ai-vision/application/use-cases/ListAiAnalysesUseCase.js';
import { ConsumeAiQuotaUseCase } from './modules/ai-vision/application/use-cases/ConsumeAiQuotaUseCase.js';
import { SupabaseAiQuotaRepository } from './modules/ai-vision/infrastructure/repositories/SupabaseAiQuotaRepository.js';
import { AiVisionController } from './modules/ai-vision/presentation/AiVisionController.js';
import { env } from './config/env.js';
/** Composition root – chỉ nơi này biết class implementation cụ thể. */
export function createContainer() {
  const trafficRepository = new SupabaseTrafficReportRepository();
  const trafficController = new TrafficController(
    new CreateTrafficReportUseCase(trafficRepository),
    new ListTrafficReportsUseCase(trafficRepository),
    new UpdateRoadClearanceUseCase(trafficRepository),
  );
  const placeSearchController = new PlaceSearchController(new SearchPlacesUseCase(new PhotonPlaceSearchProvider()));
  const routeController = new RouteController(new CalculateRouteUseCase(new VietmapRouteProvider(env.VIETMAP_API_KEY)));
  const visionProvider = new GeminiVisionProvider();
  const analysisRepository = new SupabaseAiAnalysisRepository();
  const imageStorage = new SupabaseAiImageStorage();
  const aiQuota = new ConsumeAiQuotaUseCase(new SupabaseAiQuotaRepository());
  const aiVisionController = new AiVisionController(
    new AnalyzeTrafficImageUseCase(visionProvider, analysisRepository, imageStorage),
    new RecognizeTrafficSignUseCase(visionProvider, analysisRepository, imageStorage),
    new ListAiAnalysesUseCase(analysisRepository),
  );
  return { trafficController, placeSearchController, routeController, aiVisionController, aiQuota };
}
