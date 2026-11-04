import type { PlaceSuggestion } from '@routetwin/shared';
export interface PlaceSearchProvider {
  suggest(query: string, focus?: {lat:number;lng:number}): Promise<PlaceSuggestion[]>;
}
