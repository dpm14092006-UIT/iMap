import { describe, expect, it } from 'vitest';
import type { PositionFix } from './PositionSource';
import { SpeedEstimator } from './SpeedEstimator';

const fix = (overrides: Partial<PositionFix> = {}): PositionFix => ({
  lat: 10.77,
  lng: 106.7,
  accuracyMeters: 8,
  headingDegrees: null,
  speedMetersPerSecond: null,
  timestampMs: 1_000,
  ...overrides,
});

describe('SpeedEstimator', () => {
  it('uses a valid GPS speed and converts meters per second to km/h', () => {
    expect(new SpeedEstimator().update(fix({ speedMetersPerSecond: 12.5 }))).toBe(45);
  });

  it('accepts a GPS-reported stop and rejects invalid or implausible GPS values', () => {
    const estimator = new SpeedEstimator();
    expect(estimator.update(fix({ speedMetersPerSecond: 0 }))).toBe(0);
    expect(estimator.update(fix({ speedMetersPerSecond: -1, timestampMs: 2_000 }))).toBeNull();
    expect(estimator.update(fix({ speedMetersPerSecond: 100, timestampMs: 3_000 }))).toBeNull();
  });

  it('estimates speed from accurate, time-stamped GPS fixes when speed is unavailable', () => {
    const estimator = new SpeedEstimator();
    expect(estimator.update(fix())).toBeNull();
    const twentyMetersNorth = 20 / 111_320;
    const speed = estimator.update(fix({ lat: 10.77 + twentyMetersNorth, timestampMs: 2_000 }));
    expect(speed).toBeCloseTo(72, 0);
  });

  it('rejects GPS drift, poor accuracy, stale samples, and unrealistic derived speeds', () => {
    const estimator = new SpeedEstimator();
    estimator.update(fix());
    expect(estimator.update(fix({ lat: 10.77 + 10 / 111_320, timestampMs: 2_000 }))).toBeNull();

    estimator.reset();
    estimator.update(fix());
    expect(
      estimator.update(fix({ lat: 10.77 + 20 / 111_320, accuracyMeters: 60, timestampMs: 2_000 })),
    ).toBeNull();

    estimator.reset();
    estimator.update(fix());
    expect(estimator.update(fix({ lat: 10.77 + 20 / 111_320, timestampMs: 20_000 }))).toBeNull();

    estimator.reset();
    estimator.update(fix());
    expect(estimator.update(fix({ lat: 10.77 + 250 / 111_320, timestampMs: 2_000 }))).toBeNull();
  });

  it('smooths normal sample-to-sample variation and does not estimate simulated movement', () => {
    const estimator = new SpeedEstimator();
    expect(estimator.update(fix({ speedMetersPerSecond: 10 }))).toBe(36);
    expect(estimator.update(fix({ speedMetersPerSecond: 14, timestampMs: 2_000 }))).toBe(43.2);

    const demoEstimator = new SpeedEstimator();
    demoEstimator.update(fix());
    expect(demoEstimator.update(fix({ lat: 10.77 + 100 / 111_320, timestampMs: 2_000 }), false)).toBeNull();
  });
});
