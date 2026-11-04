import { useEffect, useRef, type MutableRefObject } from 'react';
import type { DemoPlace, MapIncident, MapLayer, RoutePlan } from '../types';
import { LeafletMapController } from '../services/LeafletMapController';

type MapViewProps = {
  layer: MapLayer;
  places: DemoPlace[];
  selectedPlaceId: string | null;
  route: RoutePlan | null;
  incidents: MapIncident[];
  currentLocation: { lat: number; lng: number } | null;
  controllerRef: MutableRefObject<LeafletMapController | null>;
  onSelectPlace: (place: DemoPlace) => void;
  onMapClick: (point: { lat: number; lng: number }) => void;
};

export function MapView({ layer, places, selectedPlaceId, route, incidents, currentLocation, controllerRef, onSelectPlace, onMapClick }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const handlersRef = useRef({ onSelectPlace, onMapClick });
  handlersRef.current = { onSelectPlace, onMapClick };

  useEffect(() => {
    if (!containerRef.current) return;
    const controller = new LeafletMapController(containerRef.current, {
      onSelectPlace: (place) => handlersRef.current.onSelectPlace(place),
      onMapClick: (point) => handlersRef.current.onMapClick(point),
    });
    controllerRef.current = controller;
    const resizeObserver = new ResizeObserver(() => controller.invalidateSize());
    resizeObserver.observe(containerRef.current);
    return () => {
      resizeObserver.disconnect();
      if (controllerRef.current === controller) controllerRef.current = null;
      controller.destroy();
    };
  }, [controllerRef]);

  useEffect(() => {
    controllerRef.current?.update({ layer, places, selectedPlaceId, route, incidents, currentLocation });
  }, [controllerRef, layer, places, selectedPlaceId, route, incidents, currentLocation]);

  return <div ref={containerRef} className="routetwin-leaflet absolute inset-0 z-0" role="region" aria-label="Bản đồ tương tác TP. Hồ Chí Minh" />;
}
