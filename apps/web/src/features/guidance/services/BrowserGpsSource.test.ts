// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestGeolocation } from '../../../testing/geolocation';
import { BrowserGpsSource } from './BrowserGpsSource';
let gps: TestGeolocation;
beforeEach(() => {
  gps = new TestGeolocation();
  vi.stubGlobal('navigator', { geolocation: gps });
});
afterEach(() => vi.unstubAllGlobals());
describe('native GPS adapter', () => {
  it('does not request GPS before start and requests high accuracy only while running', () => {
    const source = new BrowserGpsSource();
    expect(gps.watches).toHaveLength(0);
    source.start(vi.fn(), vi.fn());
    expect(gps.watches[0]?.options).toEqual({ enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 });
    source.stop();
    expect(gps.cleared).toEqual([0]);
  });
  it('maps native coordinates and units without synthesizing position', () => {
    const fix = vi.fn();
    const source = new BrowserGpsSource();
    source.start(fix, vi.fn());
    gps.fix(0, 10.1, 106.1, { heading: 450, speed: 12 });
    expect(fix).toHaveBeenCalledWith(
      expect.objectContaining({
        lat: 10.1,
        lng: 106.1,
        accuracyMeters: 5,
        headingDegrees: 90,
        speedMetersPerSecond: 12,
      }),
    );
    source.stop();
  });
  it.each([NaN, Infinity, -Infinity])('discards non-finite heading and speed (%s)', (value) => {
    const fix = vi.fn();
    const source = new BrowserGpsSource();
    source.start(fix, vi.fn());
    gps.fix(0, 10, 106, { heading: value, speed: value });
    expect(fix).toHaveBeenCalledWith(
      expect.objectContaining({ headingDegrees: null, speedMetersPerSecond: null }),
    );
    source.stop();
  });
  it.each([
    [1, 'permission-denied'],
    [2, 'unavailable'],
    [3, 'timeout'],
  ])('maps native error %s to %s', (code, expected) => {
    const error = vi.fn();
    const source = new BrowserGpsSource();
    source.start(vi.fn(), error);
    gps.fail(0, Number(code));
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: expected }));
    source.stop();
  });
  it('reports unsupported devices without fabricating a fallback location', () => {
    vi.stubGlobal('navigator', {});
    const fix = vi.fn(),
      error = vi.fn();
    new BrowserGpsSource().start(fix, error);
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ code: 'unsupported' }));
    expect(fix).not.toHaveBeenCalled();
  });
  it('ignores both queued position and error callbacks after stop', () => {
    const fix = vi.fn(),
      error = vi.fn();
    const source = new BrowserGpsSource();
    source.start(fix, error);
    source.stop();
    gps.fix(0);
    gps.fail(0, 1);
    expect(fix).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
  it('replaces an existing watch and ignores the previous watch callbacks', () => {
    const first = vi.fn(),
      second = vi.fn();
    const source = new BrowserGpsSource();
    source.start(first, vi.fn());
    source.start(second, vi.fn());
    gps.fix(0);
    gps.fix(1);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
    expect(gps.cleared).toContain(0);
    source.stop();
  });
});
