import type { PlaceSuggestion } from '@routetwin/shared';
import type { PlaceSearchProvider } from '../ports/PlaceSearchProvider.js';

export class SearchPlacesUseCase {
  constructor(private readonly provider: PlaceSearchProvider) {}

  execute(query: string, focus?: { lat: number; lng: number }): Promise<PlaceSuggestion[]> {
    return this.provider.suggest(query, focus);
  }
}
