import type { LatLng } from '../../../places/types';
import type { PositionFix } from './PositionSource';

const EARTH_RADIUS_METERS = 6_371_000;
const MAX_GPS_SPEED_METERS_PER_SECOND = 70;
const MAX_DERIVED_SPEED_METERS_PER_SECOND = 55.56;
const MAX_DERIVED_ACCURACY_METERS = 40;
const MAX_SAMPLE_AGE_MS = 10_000;
const MIN_SAMPLE_AGE_MS = 500;

type PreviousFix = {
  location: LatLng;
  accuracyMeters: number;
  timestampMs: number;
};

function distanceMeters(a: LatLng, b: LatLng): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(b.lat - a.lat);
  const longitudeDelta = radians(b.lng - a.lng);
  const latitudeA = radians(a.lat);
  const latitudeB = radians(b.lat);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

/** Làm mượt số đo GPS trong ba lần cập nhật gần nhất và bỏ qua các mẫu không đáng tin. */
export class SpeedEstimator {
  private previousFix: PreviousFix | null = null;
  private samplesKph: number[] = [];

  reset(): void {
    this.previousFix = null;
    this.samplesKph = [];
  }

  update(fix: PositionFix, allowDerivedSpeed = true): number | null {
    const location = { lat: fix.lat, lng: fix.lng };
    const accuracyMeters = fix.accuracyMeters;
    const timestampMs = fix.timestampMs;
    const directSpeed = fix.speedMetersPerSecond;
    let sampleKph: number | null =
      typeof directSpeed === 'number' &&
      Number.isFinite(directSpeed) &&
      directSpeed >= 0 &&
      directSpeed <= MAX_GPS_SPEED_METERS_PER_SECOND
        ? directSpeed * 3.6
        : null;

    if (
      sampleKph === null &&
      allowDerivedSpeed &&
      this.previousFix &&
      Number.isFinite(accuracyMeters) &&
      accuracyMeters >= 0 &&
      accuracyMeters <= MAX_DERIVED_ACCURACY_METERS &&
      this.previousFix.accuracyMeters <= MAX_DERIVED_ACCURACY_METERS
    ) {
      const elapsedMs = timestampMs - this.previousFix.timestampMs;
      if (elapsedMs >= MIN_SAMPLE_AGE_MS && elapsedMs <= MAX_SAMPLE_AGE_MS) {
        const distance = distanceMeters(this.previousFix.location, location);
        const noiseThreshold = Math.max(15, accuracyMeters + this.previousFix.accuracyMeters);
        const speedMetersPerSecond = distance > noiseThreshold ? (distance * 1000) / elapsedMs : null;
        if (speedMetersPerSecond !== null && speedMetersPerSecond <= MAX_DERIVED_SPEED_METERS_PER_SECOND) {
          sampleKph = speedMetersPerSecond * 3.6;
        }
      }
    }

    this.previousFix = { location, accuracyMeters, timestampMs };
    if (sampleKph === null || !Number.isFinite(sampleKph)) {
      this.samplesKph = [];
      return null;
    }

    this.samplesKph = [...this.samplesKph.slice(-2), sampleKph];
    return this.samplesKph.reduce((sum, sample) => sum + sample, 0) / this.samplesKph.length;
  }
}
