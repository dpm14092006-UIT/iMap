import type { StopCategory, StopPlace } from '@routetwin/shared';
export type StopBounds = { south: number; west: number; north: number; east: number };
export interface StopPlaceProvider {
  search(category: StopCategory, bounds: StopBounds): Promise<StopPlace[]>;
}
