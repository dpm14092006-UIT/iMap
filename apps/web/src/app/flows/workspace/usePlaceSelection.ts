import { useState } from 'react';
import type { Poi } from '../../../features/explore/types';
import type { DirectionsController } from '../../../features/routing/hooks/useDirections';
import { basicPlaceFromPoint } from '../../../features/places/domain/pointPlace';
import type { Place } from '../../../features/places/types';
import type { LatLng } from '../../../shared/geo/types';
import type { FeatureKey } from '../../types';

type Options = {
  openPanel: (key: FeatureKey | null) => void;
  focusAfterPanel: (point: LatLng, zoom?: number) => void;
  directions: DirectionsController;
  currentLocation: LatLng | null;
};

/** Địa điểm đang xem chi tiết (kèm POI nếu có) và điểm đang chọn trên bản đồ cho panel giao thông/trợ lý. */
export function usePlaceSelection({ openPanel, focusAfterPanel, directions, currentLocation }: Options) {
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [selectedPoi, setSelectedPoi] = useState<Poi | null>(null);
  const [selectedMapPoint, setSelectedMapPoint] = useState<LatLng | null>(null);

  const clearPlace = () => {
    setSelectedPlace(null);
    setSelectedPoi(null);
  };

  const openPlace = (place: Place, poi: Poi | null = null) => {
    setSelectedPlace(place);
    setSelectedPoi(poi);
    openPanel('place');
    focusAfterPanel(place);
  };

  /** "Tìm đường đến đây": điểm đến = địa điểm, điểm đi = GPS nếu đã định vị. */
  const openDirections = (place: Place) => {
    if (currentLocation) directions.setOrigin(basicPlaceFromPoint(currentLocation, 'gps'));
    directions.setDestination(place);
    clearPlace();
    openPanel('directions');
  };

  return {
    selectedPlace,
    selectedPoi,
    setSelectedPoi,
    selectedMapPoint,
    setSelectedMapPoint,
    clearPlace,
    openPlace,
    openDirections,
  };
}

export type PlaceSelection = ReturnType<typeof usePlaceSelection>;
