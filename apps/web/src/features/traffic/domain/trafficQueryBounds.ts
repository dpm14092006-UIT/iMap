import type { TrafficReportBounds } from '@routetwin/shared';

const MAX_SPAN = 2;

export function containsTrafficBounds(outer: TrafficReportBounds, inner: TrafficReportBounds): boolean {
  return (
    inner.minLat >= outer.minLat &&
    inner.maxLat <= outer.maxLat &&
    inner.minLng >= outer.minLng &&
    inner.maxLng <= outer.maxLng
  );
}

export function canQueryTraffic(bounds: TrafficReportBounds): boolean {
  return (
    Object.values(bounds).every(Number.isFinite) &&
    bounds.minLat >= -90 &&
    bounds.maxLat <= 90 &&
    bounds.minLng >= -180 &&
    bounds.maxLng <= 180 &&
    bounds.minLat < bounds.maxLat &&
    bounds.minLng < bounds.maxLng &&
    bounds.maxLat - bounds.minLat <= MAX_SPAN &&
    bounds.maxLng - bounds.minLng <= MAX_SPAN
  );
}

/** Fetch a buffer around the viewport, then reuse it until the camera leaves it or zooms in substantially. */
export function trafficQueryBounds(
  viewport: TrafficReportBounds,
  current?: TrafficReportBounds,
  prefetch = true,
): TrafficReportBounds {
  const height = viewport.maxLat - viewport.minLat;
  const width = viewport.maxLng - viewport.minLng;
  if (
    current &&
    canQueryTraffic(current) &&
    containsTrafficBounds(current, viewport) &&
    height >= (current.maxLat - current.minLat) / 4 &&
    width >= (current.maxLng - current.minLng) / 4
  ) {
    return current;
  }
  if (!canQueryTraffic(viewport)) return viewport;
  if (!prefetch) return viewport;
  // Reserve a small margin against floating-point rounding at the server's two-degree limit.
  const pad = (span: number) => Math.min(span / 2, Math.max(0, (MAX_SPAN - span) / 2 - 1e-10));
  return {
    minLat: Math.max(-90, viewport.minLat - pad(height)),
    maxLat: Math.min(90, viewport.maxLat + pad(height)),
    minLng: Math.max(-180, viewport.minLng - pad(width)),
    maxLng: Math.min(180, viewport.maxLng + pad(width)),
  };
}
