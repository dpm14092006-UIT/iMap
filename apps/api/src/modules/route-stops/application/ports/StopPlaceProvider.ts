import type { StopCategory, StopPlace } from '@routetwin/shared';
import type { StopBounds } from '../../domain/routeGeometry.js';

export type { StopBounds };
export interface StopPlaceProvider {
  search(category: StopCategory, bounds: StopBounds): Promise<StopPlace[]>;
}
